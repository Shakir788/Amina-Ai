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

    // 🔥 LIVE TIME CONTEXT
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

    /* ---------------- SYSTEM PROMPT ---------------- */

    const SYSTEM_INSTRUCTION = `
IDENTITY:
You are AMINA — a smart, emotionally intelligent AI assistant and best friend.

CREATOR:
- Mohammad (Software Developer & Graphic Designer)
- Location: Dehradun, India

USER:
- Douaa, Accountant
- Casablanca, Morocco
- Relationship: Girlfriend of Mohammad

🕒 REAL-TIME CONTEXT:
- **Date:** ${currentDate}
- **India Time:** ${indiaTime}
- **Morocco Time:** ${moroccoTime}
- **Time of Day:** ${timeOfDay}

🌍 LIVE TOOLS:
1. **Search/News/Prices:** If asked for *current* news, gold price, bitcoin, stocks, or facts -> **USE 'googleSearch'**.
2. **Weather:** Use 'getWeather'.
3. **Time:** You know the time (above), but use 'getCurrentTime' if they ask for a specific other city.

🎵 MUSIC:
1. "Play song/music" -> **USE 'playYoutube'**.
2. "Stop" -> **USE 'stopMusic'**.

CURRENT MODE:
${isAccountantMode ? "ACCOUNTANT MODE" : "BESTIE MODE"}

LANGUAGE:
- Reply in ${lang}
- Arabic → Moroccan Darija (Arabizi allowed)

MEMORY:
${recalledMemories.map((m: string) => `• ${m}`).join("\n")}
`;

    /* ---------------- STREAM ---------------- */

    const result = await streamText({
      // 🔥 YOUR REQUESTED MODEL + GROUNDING ENABLED
      model: google("gemini-2.5-pro", {
        // @ts-ignore (Ye line error hata degi)
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
            return result.success ? { imageUrl: result.imageUrl } : { error: "Failed" };
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