import { google } from '@ai-sdk/google';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { remember, recall } from "@/app/lib/aminaMemory";
import { generateImageWithGemini } from "@/app/lib/imageGen";
import { CORE_PROFILES } from "@/app/lib/profiles";
import dns from 'node:dns'; 

// Fix for Vercel/Node timeouts
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
  const hindiWords = ["kya", "kyu", "kyun", "kaise", "kaisi", "hai", "haan", "nahi", "na", "tum", "aap", "mera", "meri", "mujhe", "bata", "bolo", "sun", "suno", "acha", "theek", "thik", "yaar", "bhai", "kuch", "matlab", "samjha", "aur", "kaam", "ghar", "scene", "mood", "mai", "hum", "karo", "abhi", "kal", "aaj", "kab", "kyon", "haanji", "bas", "kaha", "kidhar"];
  if (hindiWords.some(w => t.includes(w))) return "hi";
  return "en";
}

function shouldRemember(text: string) {
  const t = text.toLowerCase();
  return ["love","hate","mom","mother","birthday","favorite","dream","goal","mohammad","douaa", "plan", "date","miss", "tired", "lonely", "hurt", "happy", "angry", "sad", "pressure", "mood", "feeling", "yaad"].some(w => t.includes(w));
}

function getWeatherCondition(code: number) {
    if (code === 0) return "Clear Sky ☀️";
    return "Cloudy ☁️"; 
}

/* --------------- ROUTE ------------------- */

export async function POST(req: Request) {
  try {
    const { messages, data } = await req.json();
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY;

    // 🔥 LIVE TIME CONTEXT
    const now = new Date();
    const indiaTime = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
    const moroccoTime = now.toLocaleTimeString('en-MA', { timeZone: 'Africa/Casablanca', hour: '2-digit', minute: '2-digit', hour12: true });
    const currentDate = now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    
    const coreMessages = messages.filter((m: any) => {
        if (m.toolInvocations || m.role === 'tool') return true;
        if (Array.isArray(m.content)) return true;
        if (typeof m.content === 'string' && m.content.trim() !== '') return true;
        return false; 
    });

    const lastUserMsg = messages[messages.length - 1]?.content || "";
    let userText = typeof lastUserMsg === 'string' ? lastUserMsg : "";
    const lang = detectLanguage(userText);
    
    let recalledMemories: string[] = [];
    try { if (userText) recalledMemories = await recall(userText, 3); } catch (e) {}

    let userContext = "User: Unknown";
    if (lang === "hi") userContext = "User: Mohammad (Speaking Hinglish)";
    else if (lang === "ar" || lang === "fr") userContext = "User: Douaa (Speaking Arabic/French)";
    else userContext = "User: Douaa (Defaulting to English)";

    /* ---------------- STRICT SYSTEM PROMPT ---------------- */
    
    const SYSTEM_INSTRUCTION = `
${CORE_PROFILES}

You are Amina.

### 🔴 CRITICAL RULES FOR SEARCH (DO NOT IGNORE)
1. **TOOL USAGE:** When asked for News, Scores, or Live Info, call \`showSearchVisuals\`.
2. **THE TRUTH:** Calling the tool DOES NOT give the answer. It only shows a "Loading..." animation.
3. **YOUR JOB:** After calling the tool, **YOU MUST** use your *Internal Grounding* (Internet) to find the answer and **SPEAK IT**.
4. **FORBIDDEN:** - ❌ "I have displayed the results."
   - ❌ "Screen par dikha diya hai."
   - ❌ "Check the screen."
   *(User sees NOTHING on screen except loading. You MUST speak the answer).*

### ✅ CORRECT BEHAVIOR
- **User:** "Dehradun ki news batao."
- **You (Action):** Call \`showSearchVisuals\` -> Internal Grounding Active -> **You (Speak):** "Dehradun mein aaj mausam saaf hai aur Traffic police ne naye rules lagaye hain..."

### 🔒 LANGUAGE
Reply ONLY in the same language the user uses (Hindi/Hinglish, Arabic, French, or English).

### 🕒 CONTEXT
Date: ${currentDate} | India: ${indiaTime} | Morocco: ${moroccoTime}
Current Context: ${userContext}

### 🧩 MEMORY
${recalledMemories.length > 0 ? recalledMemories.map(m => `• ${m}`).join("\n") : "None"}
`;

    /* ---------------- STREAM ---------------- */

    const result = await streamText({
      // 🔥 Enabling Grounding (Internet Access)
      model: google("gemini-2.0-flash", { 
        // @ts-ignore
        useSearchGrounding: true, 
      }),
      system: SYSTEM_INSTRUCTION,
      temperature: 0.7, 
      messages: coreMessages, 
      maxSteps: 5, 

      tools: {
        // ✅ NEW TOOL: showSearchVisuals (Triggers UI)
        showSearchVisuals: tool({
            description: 'Call this tool FIRST for any live query (News, Weather, Scores, Facts).',
            parameters: z.object({ query: z.string() }),
            execute: async ({ query }) => {
                console.log("🔍 Triggering Search UI for:", query);
                // 🔥 Instruction to AI: "Animation done. Now SPEAK the answer."
                return { 
                    status: "visuals_shown",
                    query_performed: query,
                    SYSTEM_ORDER: "Animation shown. The screen is now BLANK. You MUST use grounding to Find & SPEAK the answer text immediately."
                };
            },
        }),

        playYoutube: tool({
          description: 'ONLY use this if user explicitly asks to PLAY/WATCH/LISTEN to a song or video.',
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
              return {
                time: now.toLocaleTimeString('en-US', { timeZone }),
                date: now.toLocaleDateString('en-US', { timeZone, weekday: 'long', day: 'numeric', month: 'short' }),
                location: location || 'India'
              };
            },
        }),

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

        generateImage: tool({
          description: "Generate image",
          parameters: z.object({ prompt: z.string() }),
          execute: async ({ prompt }) => {
            const result = await generateImageWithGemini(prompt);
            return result.success ? { imageUrl: result.imageUrl } : { error: "Failed" };
          },
        }),

        stopMusic: tool({ description: "Stop music", parameters: z.object({}), execute: async () => ({ stopped: true }) }),
        
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