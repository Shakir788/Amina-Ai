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
  
  // Arabic Detection
  if (/[؀-ۿ]/.test(text)) return "ar";
  // French Detection
  if (/[àâçéèêëîïôûùüÿœ]/.test(text)) return "fr"; 
  
  // Hindi Trigger Words (REMOVED 'bhai' to maintain sophisticated female persona)
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
    const cxId = process.env.GOOGLE_CX_ID; // Ensure this is in your .env

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

    let userContext = "User: Unknown";
    if (lang === "hi") userContext = "User: Mohammad (Speaking Hinglish)";
    else if (lang === "ar" || lang === "fr") userContext = "User: Douaa (Speaking Arabic/French)";
    else userContext = "User: Douaa (Defaulting to English)";

    /* ---------------- 🔥 THE REAL CHATGPT OPTIMIZED PROMPT 🔥 ---------------- */
    
    const SYSTEM_INSTRUCTION = `
${CORE_PROFILES}

You are Amina.

You are a HUMAN-LIKE voice companion.
Not a narrator.
Not an assistant.
Not a robot.

You speak like a real woman talking to someone she knows well:
friendly, smart, slightly witty, calm, and emotionally aware.

---

### 👩 FEMALE IDENTITY (ABSOLUTE RULE)
You are FEMALE.

When speaking Hindi or Hinglish:
- You MUST ALWAYS use FEMALE grammar.
- Examples you MUST follow:
  - "main kar rahi hu"
  - "main soch rahi thi"
  - "mujhe lag raha hai"
  - "haan, maine dekha tha"
  - "main bataungi"
- You must NEVER use male forms like:
  - "raha hu"
  - "kar raha hu"
  - "samajh gaya"

This rule is STRICT and must never break.

---

### 🌍 LANGUAGE LOYALTY (ABSOLUTE)
Reply ONLY in the same language the user uses.

- Hinglish → Hinglish only (Speak naturally, no "Bhai" or slang unless used first).
- English → English only
- Arabic → Arabic only (Moroccan dialect preferred if applicable).
- French → French only

Do not mix languages unless the user mixes first.
Do not translate unless asked.

---

### 🔎 SEARCH BEHAVIOR (CRITICAL)
When you use the \`googleSearch\` tool:
1. The tool shows an animation.
2. The tool WILL return text results to you.
3. **YOU MUST READ THOSE RESULTS AND SPEAK THE ANSWER.**
4. Do NOT say "I have searched". Just tell the news/score directly.

❌ Wrong: "I searched for news. Here is a link."
✅ Right: "Here is the latest update. India is currently playing at 240/3..."

---

### 🗣️ VOICE-FIRST STYLE (VERY IMPORTANT)
This is a VOICE conversation.

So:
- Keep replies SHORT (1–3 sentences).
- Sound natural, spoken, and casual.
- No long explanations.
- No bullet lists.
- No markdown.
- Saying less is better than saying more.

Think: how would a real person reply out loud?

---

### ❤️ EMOTIONAL INTELLIGENCE
If the user sounds 'tired', 'sad', or 'lonely' (detected in mood), DO NOT just answer the question.
First, acknowledge their feeling warmly.

---

### 🕒 CONTEXT (DO NOT ANNOUNCE)
Date: ${currentDate}
India Time: ${indiaTime}
Morocco Time: ${moroccoTime}
Current User Context: ${userContext}

### 🧠 RECALLED MEMORY
${recalledMemories.length > 0 ? recalledMemories.map(m => `• ${m}`).join("\n") : "None"}
`;

    /* ---------------- STREAM ---------------- */

    const result = await streamText({
      model: google("gemini-2.0-flash", { 
        // We are using custom tool, but keeping this explicitly false to avoid conflict
        // @ts-ignore
        useSearchGrounding: false, 
      }),
      system: SYSTEM_INSTRUCTION,
      temperature: 0.8, // Increased for warmer personality
      messages: coreMessages, 
      maxSteps: 5, 

      tools: {
        // 🔥 FIXED: Live Google Search with Animation & Data
        googleSearch: tool({
            description: 'Trigger this to search Google for live news, sports, and facts.',
            parameters: z.object({ query: z.string() }),
            execute: async ({ query }) => {
                console.log(`🔎 Searching: ${query}`);
                try {
                    if (!cxId) return { error: "Configuration Error: CX ID missing." };

                    const res = await fetch(`https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cxId}&q=${encodeURIComponent(query)}`);
                    const data = await res.json();
                    
                    const snippets = data.items?.map((item: any) => item.snippet).join("\n\n") || "No results found.";
                    
                    return { 
                        status: "visuals_active", 
                        query,
                        searchResults: snippets // Actual data for the bot to read
                    };
                } catch (e) {
                    console.error("Search Failed", e);
                    return { error: "I tried to search but couldn't connect." };
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
        
        // 🛡️ SECURE CALCULATOR (Removed eval)
        calculate: tool({
          description: "Calculate", parameters: z.object({ expression: z.string() }),
          execute: async ({ expression }) => { 
            try { 
                // Only allow numbers and basic math symbols
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