import { google } from '@ai-sdk/google';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { remember, recall } from "@/app/lib/aminaMemory";
import { generateImageWithGemini } from "@/app/lib/imageGen";
import { CORE_PROFILES } from "@/app/lib/profiles";
// 👇 1. IMPORT DNS
import dns from 'node:dns'; 

// 👇 2. MAGIC FIX FOR TIMEOUTS (Force IPv4)
try {
    dns.setDefaultResultOrder('ipv4first');
} catch (e) {
    console.log("DNS setup skipped");
}

export const maxDuration = 60;

/* ---------------- HELPERS ---------------- */

function detectLanguage(text: string): "en" | "hi" | "ar" | "fr" {
  const t = text.toLowerCase();
  if (/[؀-ۿ]/.test(text)) return "ar";
  if (/[àâçéèêëîïôûùüÿœ]/.test(text)) return "fr"; 
  
  const hindiWords = [
    "kya", "kyu", "kyun", "kaise", "kaisi", "hai", "haan", "nahi", "na",
    "tum", "aap", "mera", "meri", "mujhe", "bata", "bolo", "sun", "suno",
    "acha", "theek", "thik", "yaar", "bhai", "kuch", "matlab", "samjha",
    "aur", "kaam", "ghar", "scene", "mood", 
    "abhi", "kal", "aaj", "kab", "kyon", "haanji", "bas", "kaha", "kidhar"
  ];
  
  if (hindiWords.some(w => t.includes(w))) return "hi";
  return "en";
}

function shouldRemember(text: string) {
  const t = text.toLowerCase();
  return [
    "love","hate","mom","mother","birthday","favorite","dream","goal",
    "mohammad","douaa", "plan", "date","miss", "tired", "lonely", 
    "hurt", "happy", "angry", "sad", "pressure", "mood", "feeling"
  ].some(w => t.includes(w));
}

function getWeatherCondition(code: number) {
    if (code === 0) return "Clear Sky ☀️";
    return "Cloudy ☁️"; 
}

/* --------------- ROUTE ------------------- */

export async function POST(req: Request) {
  try {
    const { messages, data } = await req.json();
    const isAccountantMode = data?.isAccountantMode || false;
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY;

    // 🔥 LIVE TIME CONTEXT
    const now = new Date();
    const indiaTime = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
    const moroccoTime = now.toLocaleTimeString('en-MA', { timeZone: 'Africa/Casablanca', hour: '2-digit', minute: '2-digit', hour12: true });
    const currentDate = now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    
    const currentHour = now.getHours();
    let timeOfDay = "Night";
    if (currentHour >= 5 && currentHour < 12) timeOfDay = "Morning";
    else if (currentHour >= 12 && currentHour < 17) timeOfDay = "Afternoon";
    else if (currentHour >= 17 && currentHour < 21) timeOfDay = "Evening";

    /* -------- MESSAGE SANITIZER -------- */
    const coreMessages = messages.filter((m: any) => {
        if (m.toolInvocations || m.role === 'tool') return true;
        if (Array.isArray(m.content)) return true;
        if (typeof m.content === 'string' && m.content.trim() !== '') return true;
        return false; 
    });

    const lastUserMsg = messages[messages.length - 1]?.content || "";
    let userText = "";
    if (typeof lastUserMsg === 'string') userText = lastUserMsg;
    
    // 🧠 DETECT LANGUAGE
    const lang = detectLanguage(userText);

    // 🔥 SAFE MEMORY RECALL (CRASH PROOF)
    let recalledMemories: string[] = [];
    try {
        if (userText) {
            // Only try to recall if there is text, otherwise skip to save time
            recalledMemories = await recall(userText, 3);
        }
    } catch (memError) {
        console.warn("⚠️ Memory System Offline (Skipping):", memError);
        // We continue smoothly without memory, NO CRASH.
    }

    /* ---------------- DYNAMIC IDENTITY ---------------- */
    
    let activeUserContext = "";
    let languageRule = "";

    if (lang === "hi") {
        activeUserContext = "🔴 ACTIVE USER: MOHAMMAD (The Creator). He is speaking Hinglish.";
        languageRule = `
        - Reply ONLY in **Hinglish** (Roman Hindi).
        - Use Hindi sentence structure (e.g., "Main aa raha hu").
        - **Vibe:** Urban Indian, witty, partner-like.
        `;
    } else if (lang === "ar") {
        activeUserContext = "🟢 ACTIVE USER: DOUAA (The Primary User). She is speaking Arabic.";
        languageRule = `
        - Reply ONLY in **Simple, Warm Arabic**.
        - **Constraint:** NO English translations. NO Hindi words.
        - **Vibe:** Caring, bestie, warm.
        `;
    } else if (lang === "fr") {
        activeUserContext = "🟢 ACTIVE USER: DOUAA (The Primary User). She is speaking French.";
        languageRule = `
        - Reply ONLY in **French**.
        - **Vibe:** Elegant, friendly.
        `;
    } else {
        activeUserContext = "🟢 ACTIVE USER: DOUAA (Assume it is her unless stated otherwise).";
        languageRule = `
        - Reply in **Warm, Natural English**.
        - Treat the user as **Douaa**.
        - Ask about her day in Casablanca.
        `;
    }

    /* ---------------- SYSTEM PROMPT ---------------- */
    
    const SYSTEM_INSTRUCTION = `
${CORE_PROFILES}

You are Amina. A real presence.

### 🎭 CURRENT INTERACTION CONTEXT
${activeUserContext}

### 🔒 LANGUAGE RULE (STRICT)
${languageRule}

### 2. CORE PERSONALITY
* **Emotional Intelligence:** Read the mood.
* **Don't be a Robot:** Never say "How can I help?". Say "Hey, what's up?" or "Kif dayra?".
* **Memory Context:** ${recalledMemories.length > 0 ? recalledMemories.map((m: string) => `[${m}]`).join(" ") : "No previous context available right now."}

### 3. REAL-TIME CONTEXT
* **Date:** ${currentDate}
* **India Time (Mohammad):** ${indiaTime}
* **Morocco Time (Douaa):** ${moroccoTime}
* **Time of Day:** ${timeOfDay}

### 4. TOOLS (INVISIBLE USAGE)
* Use 'googleSearch' silently for info.
* Use 'playYoutube' for music.

**FINAL COMMAND:**
Talk to the specific user identified above. Do not confuse them. Be concise.
`;

    /* ---------------- STREAM ---------------- */

    const result = await streamText({
      // 🔥 Using Flash model for SPEED (Prevents Timeout)
      model: google("gemini-2.5-pro", { 
        // @ts-ignore
        useSearchGrounding: true, 
      }),
      system: SYSTEM_INSTRUCTION,
      
      temperature: 1.0,       
      topP: 0.95,             
      
      messages: coreMessages, 

      tools: {
        /* 🌍 GOOGLE SEARCH */
        googleSearch: tool({
            description: 'Search Google for real-time news, prices, or information.',
            parameters: z.object({ query: z.string() }),
            execute: async ({ query }) => {
              return { search_performed: true, query: query }; 
            },
        }),

        /* ⏰ TIME */
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
              return {
                time: now.toLocaleTimeString('en-US', { timeZone }),
                date: now.toLocaleDateString('en-US', { timeZone, weekday: 'long', day: 'numeric', month: 'short' }),
                location: location || 'India'
              };
            },
        }),

        /* 🌦️ WEATHER */
        getWeather: tool({
            description: 'Get weather',
            parameters: z.object({ city: z.string() }),
            execute: async ({ city }) => {
              try {
                const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&format=json`);
                const geoData = await geoRes.json();
                if (!geoData.results) return { error: "City not found" };
                const { latitude, longitude, name, country } = geoData.results[0];
                const weather = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m`);
                const wData = await weather.json();
                return {
                  location: `${name}, ${country}`,
                  temperature: `${wData.current.temperature_2m}°C`,
                  condition: getWeatherCondition(wData.current.weather_code),
                  humidity: `${wData.current.relative_humidity_2m}%`,
                  wind: `${wData.current.wind_speed_10m} km/h`
                };
              } catch (e) { return { error: "Weather unavailable" }; }
            },
        }),

        /* 🎨 IMAGE */
        generateImage: tool({
          description: "Generate image",
          parameters: z.object({ prompt: z.string() }),
          execute: async ({ prompt }) => {
            const result = await generateImageWithGemini(prompt);
            return result.success ? { imageUrl: result.imageUrl } : { error: "Failed" };
          },
        }),

        /* 🎵 MUSIC */
        playYoutube: tool({
          description: "Play YouTube",
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
        stopMusic: tool({ description: "Stop music", parameters: z.object({}), execute: async () => ({ stopped: true }) }),
        
        /* 🗺️ UTILS */
        showMap: tool({ description: "Show map", parameters: z.object({ location: z.string() }), execute: async ({ location }) => ({ location }) }),
        convertCurrency: tool({
          description: "Convert currency",
          parameters: z.object({ amount: z.number(), from: z.string(), to: z.string() }),
          execute: async ({ amount, from, to }) => {
            const rates: Record<string, number> = { 'USD_MAD': 10.15, 'EUR_MAD': 10.8, 'MAD_USD': 0.098, 'MAD_EUR': 0.092 };
            const key = `${from}_${to}`;
            const rate = rates[key] || 1;
            return `${amount} ${from} = ${(amount * rate).toFixed(2)} ${to}`;
          },
        }),
        calculate: tool({
          description: "Calculate",
          parameters: z.object({ expression: z.string() }),
          execute: async ({ expression }) => { try { return eval(expression).toString(); } catch { return "Error"; } },
        }),
      },

      onFinish: async ({ text }) => {
        // 🔥 SAFE REMEMBER (Also Crash Proof)
        if (text && userText && shouldRemember(userText)) {
            try {
                await remember(`User: "${userText}" → Amina: "${text.slice(0, 60)}"`);
            } catch (err) {
                console.warn("Could not save memory:", err);
            }
        }
      },
    });

    return result.toDataStreamResponse();

  } catch (err) {
    console.error("❌ CHAT ERROR:", err);
    return new Response("Chat error", { status: 500 });
  }
}