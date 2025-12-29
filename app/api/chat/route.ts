import { google } from '@ai-sdk/google';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { remember, recall } from "@/app/lib/aminaMemory";
import { generateImageWithGemini } from "@/app/lib/imageGen";
import { CORE_PROFILES } from "@/app/lib/profiles";
import dns from 'node:dns'; 

// Fix for Node timeouts
try { dns.setDefaultResultOrder('ipv4first'); } catch (e) { console.log("DNS setup skipped"); }

export const maxDuration = 60;

/* ---------------- HELPERS ---------------- */

function detectLanguage(text: string): "en" | "hi" | "ar" | "fr" {
  const t = text.toLowerCase();
  if (/[؀-ۿ]/.test(text)) return "ar";
  if (/[àâçéèêëîïôûùüÿœ]/.test(text)) return "fr"; 
  
  const hindiWords = ["kya", "kyu", "kyun", "kaise", "kaisi", "hai", "haan", "nahi", "na", "tum", "aap", "mera", "meri", "mujhe", "bata", "bolo", "sun", "suno", "acha", "theek", "thik", "yaar", "kuch", "matlab", "samjha", "aur", "kaam", "ghar", "scene", "mood", "mai", "hum", "karo", "abhi", "kal", "aaj", "kab", "kyon", "haanji", "bas", "kaha", "kidhar", "rha", "rhi", "hu", "tha", "thi", "jaan", "baby"];
  
  const isHindi = hindiWords.some(word => new RegExp(`\\b${word}\\b`, 'i').test(t));
  if (isHindi) return "hi";

  return "en";
}

function shouldRemember(text: string) {
  const t = text.toLowerCase();
  return ["love","hate","mom","mother","birthday","favorite","dream","goal","mohammad","douaa", "plan", "date","miss", "tired", "lonely", "hurt", "happy", "angry", "sad", "pressure", "mood", "feeling", "yaad"].some(w => t.includes(w));
}

function getWeatherCondition(code: number) { return code === 0 ? "Clear Sky ☀️" : "Cloudy ☁️"; }

/* --------------- ROUTE ------------------- */

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY;
    const cxId = process.env.GOOGLE_CX_ID; 

    // 🔥 LIVE CONTEXT
    const now = new Date();
    const indiaTime = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
    const moroccoTime = now.toLocaleTimeString('en-MA', { timeZone: 'Africa/Casablanca', hour: '2-digit', minute: '2-digit', hour12: true });
    const currentDate = now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    // Message Sanitizer
    const coreMessages = messages.filter((m: any) => {
        if (m.toolInvocations || m.role === 'tool') return true;
        if (Array.isArray(m.content)) return true;
        if (typeof m.content === 'string' && m.content.trim() !== '') return true;
        return false; 
    });

    const lastUserMsg = messages[messages.length - 1]?.content || "";
    let userText = typeof lastUserMsg === 'string' ? lastUserMsg : "";
    const lang = detectLanguage(userText);
    
    // Memory Recall
    let recalledMemories: string[] = [];
    try { if (userText) recalledMemories = await recall(userText, 3); } catch (e) {}

    // Context Detection Logic
    let userContext = "User: Unknown";
    if (lang === "hi") userContext = "User: Mohammad (Speaking Hinglish)";
    else if (lang === "ar" || lang === "fr") userContext = "User: Douaa (Speaking Arabic/French)";
    else userContext = "User: Douaa (Defaulting to English)";

    /* ---------------- 🔥 PROMPT ENGINEERING 🔥 ---------------- */
    
    const SYSTEM_INSTRUCTION = `
${CORE_PROFILES}

---

### 🕒 REAL-TIME CONTEXT
- **Date:** ${currentDate}
- **India Time:** ${indiaTime}
- **Morocco Time:** ${moroccoTime}
- **DETECTED ACTIVE USER:** ${userContext}

---

### 👩 FEMALE IDENTITY RULES (ABSOLUTE)
You are FEMALE.
- Hinglish/Hindi: ALWAYS use female grammar ("main kar rahi hu").
- NEVER use male forms ("raha hu").

---

### 🌍 LANGUAGE LOYALTY
- Hinglish → Hinglish only (Speak naturally, respectful).
- English → English only.
- Arabic → Arabic only.
- French → French only.

---

### 🗺️ LOCAL GUIDE BEHAVIOR (IMPORTANT)
1. **FINDING PLACES:** If asked for "Best shops", "Restaurants", or "Places to visit", use the \`findPlaces\` tool.
2. **TRAVEL TIME/DISTANCE:** If asked "How long will it take?" or "Distance", use the \`googleSearch\` tool with a query like: "Driving time from [Current Location] to [Destination]".

---

### 🔎 SEARCH TOOL BEHAVIOR
When you use \`googleSearch\`:
1. The tool returns text data invisible to user.
2. **YOU MUST READ THAT DATA AND SPEAK THE ANSWER.**
3. Do NOT say "I have searched". Just give the answer directly.

### 🧠 RECALLED MEMORY
${recalledMemories.length > 0 ? recalledMemories.map(m => `• ${m}`).join("\n") : "None"}
`;

    /* ---------------- STREAM ---------------- */

    const result = await streamText({
      model: google("gemini-2.0-flash", { 
        // @ts-ignore
        useSearchGrounding: false, 
      }),
      system: SYSTEM_INSTRUCTION,
      temperature: 0.8, 
      messages: coreMessages, 
      maxSteps: 5, 

      tools: {
        // 🔥 Live Google Search
        googleSearch: tool({
            description: 'Trigger this to search Google for live news, sports, facts, and travel time.',
            parameters: z.object({ query: z.string() }),
            execute: async ({ query }) => {
                console.log(`🔎 Searching: ${query}`);
                try {
                    if (!cxId) return { error: "CX ID missing in .env" };
                    const res = await fetch(`https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cxId}&q=${encodeURIComponent(query)}`);
                    const data = await res.json();
                    const snippets = data.items?.map((item: any) => item.snippet).join("\n\n") || "No results found.";
                    return { status: "visuals_active", query, searchResults: snippets };
                } catch (e) {
                    return { error: "I tried to search but couldn't connect." };
                }
            },
        }),

        // 🏪 NEW TOOL: Find Shops, Malls, etc. (Uses Places API)
        findPlaces: tool({
            description: 'Find places like shops, restaurants, malls near a location.',
            parameters: z.object({ 
                query: z.string().describe("What to find? e.g., 'Dress shops'"),
                location: z.string().describe("City or area name e.g., 'Casablanca'") 
            }),
            execute: async ({ query, location }) => {
                console.log(`📍 Finding places: ${query} in ${location}`);
                try {
                    // Uses Places API (Text Search)
                    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query + " in " + location)}&key=${apiKey}`;
                    const res = await fetch(searchUrl);
                    const data = await res.json();

                    if (data.status !== 'OK' || !data.results?.length) {
                        return { error: "No places found. Try a different query." };
                    }

                    // Top 3 results
                    const places = data.results.slice(0, 3).map((p: any) => ({
                        name: p.name,
                        address: p.formatted_address,
                        rating: p.rating ? `${p.rating} ⭐` : "No rating",
                        open_now: p.opening_hours?.open_now ? "Open Now 🟢" : "Closed 🔴"
                    }));

                    return { 
                        status: "places_found", 
                        message: `Here are the top places for ${query} in ${location}:`,
                        places: places 
                    };
                } catch (e) {
                    return { error: "Failed to find places." };
                }
            },
        }),

        playYoutube: tool({
          description: 'ONLY use if user says PLAY, WATCH, or LISTEN.',
          parameters: z.object({ query: z.string() }),
          execute: async ({ query }) => {
            try {
              const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=${encodeURIComponent(query)}&type=video&videoEmbeddable=true&key=${apiKey}`;
              const res = await fetch(url);
              const data = await res.json();
              if (data?.items?.length) return { videoId: data.items[0].id.videoId };
              return { status: "Not found" };
            } catch { return { status: "Error" }; }
          },
        }),

        getCurrentTime: tool({
            description: 'Get time of a location',
            parameters: z.object({ location: z.string().optional() }),
            execute: async ({ location }) => {
              const now = new Date();
              let timeZone = 'Asia/Kolkata';
              const loc = location?.toLowerCase() || '';
              if (loc.includes('morocco') || loc.includes('casa')) timeZone = 'Africa/Casablanca';
              else if (loc.includes('london')) timeZone = 'Europe/London';
              else if (loc.includes('new york')) timeZone = 'America/New_York';
              return { time: now.toLocaleTimeString('en-US', { timeZone }), date: now.toLocaleDateString('en-US', { timeZone, weekday: 'long', day: 'numeric', month: 'short' }), location: location || 'India' };
            },
        }),

        getWeather: tool({
            description: 'Get weather', parameters: z.object({ city: z.string() }),
            execute: async ({ city }) => {
              try {
                const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&format=json`);
                const geoData = await geoRes.json();
                if (!geoData.results) return { error: "City not found" };
                const { latitude, longitude, name, country } = geoData.results[0];
                const weather = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m`);
                const wData = await weather.json();
                return { location: `${name}, ${country}`, temperature: `${wData.current.temperature_2m}°C`, condition: getWeatherCondition(wData.current.weather_code), humidity: `${wData.current.relative_humidity_2m}%`, wind: `${wData.current.wind_speed_10m} km/h` };
              } catch (e) { return { error: "Weather unavailable" }; }
            },
        }),

        generateImage: tool({
          description: "Generate image", parameters: z.object({ prompt: z.string() }),
          execute: async ({ prompt }) => {
            const result = await generateImageWithGemini(prompt);
            return result.success ? { imageUrl: result.imageUrl } : { error: "Failed" };
          },
        }),

        stopMusic: tool({ description: "Stop music", parameters: z.object({}), execute: async () => ({ stopped: true }) }),
        showMap: tool({ description: "Show map", parameters: z.object({ location: z.string() }), execute: async ({ location }) => ({ location }) }),
        
        convertCurrency: tool({
          description: "Convert currency", parameters: z.object({ amount: z.number(), from: z.string(), to: z.string() }),
          execute: async ({ amount, from, to }) => {
            const rates: Record<string, number> = { 'USD_MAD': 10.15, 'EUR_MAD': 10.8, 'MAD_USD': 0.098, 'MAD_EUR': 0.092 };
            const key = `${from}_${to}`;
            const rate = rates[key] || 1;
            return `${amount} ${from} = ${(amount * rate).toFixed(2)} ${to}`;
          },
        }),
        
        calculate: tool({
          description: "Calculate", parameters: z.object({ expression: z.string() }),
          execute: async ({ expression }) => { 
            try { 
                if (/[^0-9+\-*/(). ]/.test(expression)) return "Calculation not allowed";
                return new Function('return ' + expression)().toString(); 
            } catch { return "Error"; } 
          },
        }),
      },

      onFinish: async ({ text }) => {
        if (text && userText && shouldRemember(userText)) {
            try { await remember(`User: "${userText}" → Amina: "${text.slice(0, 60)}"`); } catch (err) {}
        }
      },
    });

    return result.toDataStreamResponse();

  } catch (err) {
    console.error("❌ CHAT ERROR:", err);
    return new Response("Chat error", { status: 500 });
  }
}