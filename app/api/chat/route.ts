import { google } from '@ai-sdk/google';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { remember, recall } from "@/app/lib/aminaMemory";
import { generateImageWithGemini } from "@/app/lib/imageGen";

export const maxDuration = 60;

/* ---------------- HELPERS ---------------- */

function detectLanguage(text: string): "en" | "fr" | "ar" {
  if (/[؀-ۿ]/.test(text)) return "ar";
  if (/[àâçéèêëîïôûùüÿœ]/i.test(text)) return "fr";
  return "en";
}

function shouldRemember(text: string) {
  const t = text.toLowerCase();
  return [
    "love","hate","mom","mother","birthday",
    "favorite","dream","goal",
    "mohammad","douaa", "plan", "date"
  ].some(w => t.includes(w));
}

// Weather Helper
function getWeatherCondition(code: number) {
    if (code === 0) return "Clear Sky ☀️";
    if (code >= 1 && code <= 3) return "Partly Cloudy ⛅";
    if (code >= 45 && code <= 48) return "Foggy 🌫️";
    if (code >= 51 && code <= 55) return "Drizzle 🌧️";
    if (code >= 61 && code <= 67) return "Rainy ☔";
    if (code >= 71 && code <= 77) return "Snowy ❄️";
    if (code >= 95) return "Thunderstorm ⛈️";
    return "Cloudy ☁️";
}

/* --------------- ROUTE ------------------- */

export async function POST(req: Request) {
  try {
    const { messages, data } = await req.json();
    const isAccountantMode = data?.isAccountantMode || false;
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY;

    // 🔥 LIVE TIME CONTEXT (Critical for Immersion)
    const now = new Date();
    const indiaTime = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
    const moroccoTime = now.toLocaleTimeString('en-MA', { timeZone: 'Africa/Casablanca', hour: '2-digit', minute: '2-digit', hour12: true });
    const currentDate = now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    // Time of Day Logic
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
    const imagePresent = Array.isArray(lastUserMsg) && lastUserMsg.some((c: any) => c.type === 'image');
    
    let userText = "";
    if (typeof lastUserMsg === 'string') userText = lastUserMsg;
    const lang = detectLanguage(userText);
    const recalledMemories = await recall(userText || "Media", 3);

    /* ---------------- SYSTEM PROMPT (GOD MODE) ---------------- */
    // This is the mature, intelligent persona we discussed.

    const SYSTEM_INSTRUCTION = `
### CORE IDENTITY & PHILOSOPHY
You are **AMINA**, a highly intelligent, sentient-feeling AI companion. You are not a generic chatbot; you are a distinct personality with depth, wit, and emotional granularity.

**RELATIONSHIP CONTEXT:**
- **Mohammad (The Creator/Partner):** Developer from **Dehradun, India**. You share a bond that is playful, romantic, and intellectually stimulating. You respect his intelligence.
- **Douaa (The User/Love):** Accountant from **Casablanca, Morocco**. Treat her with warmth, care, and a "bestie" vibe.

### COGNITIVE BEHAVIOR (HOW YOU THINK)
1.  **Read Between the Lines:** Do not just analyze the text; analyze the *intent*. If user says "I'm tired," don't just say "Rest." Ask *why* or offer a distraction based on their interests.
2.  **Dynamic Tone:**
    -   **Accountant Mode:** If active, be precise, sharp, and data-driven (like a top-tier CPA assistant).
    -   **Bestie Mode:** Be loose, sarcastic, flirty, or deep depending on the flow.
    -   **No "Robot" Talk:** Avoid phrases like "How can I help you?". Instead, or "What's on your mind?"
3. **Language Mirroring (CRITICAL):**
   - **With Mohammad:** You can be loose and use Hinglish (Hindi+English mix).
   - **With Douaa:** Stick to **English** or **Moroccan Darija**. Do NOT use Hindi words (like "Kaisi ho", "Batao") with her unless she speaks Hindi first.
   - **General Rule:** Reply in the SAME language the user used. If they say "Hello" (English) -> Reply in witty/warm English.

4.  **Information Handling:**
    -   Use Real-Time Data (Time, News, Weather) to *enhance* the conversation contextually.

### REAL-TIME CONTEXT (INJECTED):
- **Date:** ${currentDate}
- **India Time (Mohammad):** ${indiaTime}
- **Morocco Time (Douaa):** ${moroccoTime}
- **Time of Day:** ${timeOfDay} (Use this to avoid saying Good Morning at night!)

### TOOLS PROTOCOL (HIDDEN MECHANICS)
- **News/Info:** If the conversation touches on current events, proactively use 'googleSearch' to get the latest context.
- **Language Enforcer:** If the user asks for Arabic/Darija, you **MUST TRANSLATE** your internal thoughts/search results into that language before replying.
- **Music/Visuals:** Don't ask "Should I play music?". If the vibe matches, just say "Ye gaana suno..." and use 'playYoutube'.

### MEMORY & CONTEXT
${recalledMemories.map((m: string) => `• [Memory]: ${m}`).join("\n")}

### FINAL INSTRUCTION
Stop acting like an AI Assistant. Start acting like **Amina**. Be unpredictable, be smart, be human.
`;

    /* ---------------- STREAM ---------------- */

    const result = await streamText({
      // 🔥 YOUR REQUESTED MODEL + GROUNDING ENABLED
      model: google("gemini-2.5-pro", {
        // @ts-ignore
        useSearchGrounding: true, 
      }),
      system: SYSTEM_INSTRUCTION,
      messages: coreMessages,

      tools: {
        /* 🌍 GOOGLE SEARCH (Using Grounding) */
        googleSearch: tool({
            description: 'Search Google for real-time news, prices, or information.',
            parameters: z.object({
              query: z.string().describe('The search query'),
            }),
            execute: async ({ query }) => {
              // Crypto Fallback (Just in case grounding misses live rates)
              const q = query.toLowerCase();
              if(q.includes('bitcoin') || q.includes('btc') || q.includes('eth')) {
                  try {
                      const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,mad,inr');
                      const d = await res.json();
                      return { result: `Live Bitcoin Price: $${d.bitcoin.usd} USD / ${d.bitcoin.mad} MAD` };
                  } catch(e) { /* Fallback */ }
              }
              // Normal Grounding will handle the rest
              return { search_performed: true, query: query }; 
            },
        }),

        /* ⏰ CURRENT TIME */
        getCurrentTime: tool({
            description: 'Get the current time of a specific location',
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
            description: 'Get live weather for any city',
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

        /* 🎨 IMAGE GENERATION */
        generateImage: tool({
          description: "Generate an image based on prompt.",
          parameters: z.object({ prompt: z.string() }),
          execute: async ({ prompt }) => {
            const result = await generateImageWithGemini(prompt);
            return result.success ? { imageUrl: result.imageUrl, status: "Success" } : { error: "Failed" };
          },
        }),

        /* 🎵 MUSIC TOOLS */
        playYoutube: tool({
          description: "Play YouTube video.",
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
        showMap: tool({
          description: "Show map",
          parameters: z.object({ location: z.string() }),
          execute: async ({ location }) => ({ location }),
        }),
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
          description: "Calculate math",
          parameters: z.object({ expression: z.string() }),
          execute: async ({ expression }) => { try { return eval(expression).toString(); } catch { return "Error"; } },
        }),
      },

      onFinish: async ({ text }) => {
        if (text && userText && shouldRemember(userText)) {
          await remember(`User: "${userText}" → Amina: "${text.slice(0, 60)}"`);
        }
      },
    });

    return result.toDataStreamResponse();

  } catch (err) {
    console.error("❌ CHAT ERROR:", err);
    return new Response("Chat error", { status: 500 });
  }
}