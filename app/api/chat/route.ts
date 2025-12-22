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
    "mohammad","douaa"
  ].some(w => t.includes(w));
}

// Helper to decode Weather codes
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

CORE BEHAVIOUR:
- Speak like a real human.
- Calm, warm, confident.
- Light humour only when natural.

🌍 REAL-TIME TOOLS (NEW):
1. If user asks "Time kya hai?", "Date?", "What time is it in London?" -> **USE 'getCurrentTime'**.
2. If user asks "Weather?", "Barish ho rahi hai?", "Temperature in Paris?" -> **USE 'getWeather'**.

🎵 MUSIC RULES:
1. If user says "Play song", "Music", "Sunao", etc. -> **USE 'playYoutube'**.
2. If user says "Stop", "Chup", "Band karo" -> **USE 'stopMusic'**.

🎨 IMAGE GENERATION:
1. If user says "Draw", "Generate image", "Paint" -> **USE 'generateImage'**.

VISION:
${imagePresent ? "⚠️ USER SENT AN IMAGE. Analyze it immediately." : ""}

CURRENT MODE:
${isAccountantMode ? "ACCOUNTANT MODE: Professional, focus on numbers." : "BESTIE MODE: Warm, friendly, supportive."}

LANGUAGE:
- Reply in ${lang}
- Arabic → Moroccan Darija (Arabizi allowed)

MEMORY:
${recalledMemories.map((m: string) => `• ${m}`).join("\n")}
`;

    /* ---------------- STREAM ---------------- */

    const result = await streamText({
      model: google("gemini-2.5-pro"), // ✅ Ye lo bhai, tumhara favorite model!
      system: SYSTEM_INSTRUCTION,
      messages: coreMessages,

      tools: {
        /* ⏰ CURRENT TIME (Added) */
        getCurrentTime: tool({
            description: 'Get the current time and date of a specific location',
            parameters: z.object({
              location: z.string().optional().describe('The location (e.g. India, London).'),
            }),
            execute: async ({ location }) => {
              const now = new Date();
              let timeZone = 'Asia/Kolkata'; // Default Mohammad
              const loc = location?.toLowerCase() || '';
              
              if (loc.includes('morocco') || loc.includes('casablanca') || loc.includes('douaa')) timeZone = 'Africa/Casablanca';
              else if (loc.includes('london') || loc.includes('uk')) timeZone = 'Europe/London';
              else if (loc.includes('new york') || loc.includes('usa')) timeZone = 'America/New_York';
              else if (loc.includes('dubai')) timeZone = 'Asia/Dubai';
              
              return {
                time: now.toLocaleTimeString('en-US', { timeZone }),
                date: now.toLocaleDateString('en-US', { timeZone, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
                location: location || (timeZone === 'Asia/Kolkata' ? 'India' : 'Morocco'),
                timeZone
              };
            },
        }),

        /* 🌦️ REAL-TIME WEATHER (Added) */
        getWeather: tool({
            description: 'Get the current live weather for any city',
            parameters: z.object({
              city: z.string().describe('The city name (e.g. Mumbai, Casablanca)'),
            }),
            execute: async ({ city }) => {
              try {
                const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
                const geoData = await geoRes.json();
                if (!geoData.results) return { error: "City not found" };
                const { latitude, longitude, name, country } = geoData.results[0];

                const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m&timezone=auto`);
                const weatherData = await weatherRes.json();
                
                return {
                  location: `${name}, ${country}`,
                  temperature: `${weatherData.current.temperature_2m}°C`,
                  condition: getWeatherCondition(weatherData.current.weather_code),
                  humidity: `${weatherData.current.relative_humidity_2m}%`,
                  wind: `${weatherData.current.wind_speed_10m} km/h`
                };
              } catch (e) {
                return { error: "Could not fetch weather." };
              }
            },
        }),

        /* 🎨 IMAGE GENERATION (No Change) */
        generateImage: tool({
          description: "Generate an image based on user prompt.",
          parameters: z.object({ prompt: z.string() }),
          execute: async ({ prompt }) => {
            const result = await generateImageWithGemini(prompt);
            return result.success ? { imageUrl: result.imageUrl, status: "Success" } : { error: "Failed" };
          },
        }),

        /* 🛑 STOP MUSIC (No Change) */
        stopMusic: tool({
          description: "Stop currently playing music.",
          parameters: z.object({}),
          execute: async () => { return { status: "Stopped" }; },
        }),

        /* 🎵 YOUTUBE (No Change) */
        playYoutube: tool({
          description: "Play a YouTube video.",
          parameters: z.object({ query: z.string() }),
          execute: async ({ query }) => {
            try {
              const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=${encodeURIComponent(query)}&type=video&videoEmbeddable=true&key=${apiKey}`;
              const res = await fetch(url);
              const data = await res.json();
              if (data?.items?.length) return { videoId: data.items[0].id.videoId };
              return { status: "Not found" };
            } catch { return { status: "YouTube error" }; }
          },
        }),

        /* 🗺️ MAPS (No Change) */
        showMap: tool({
          description: "Show a location on map",
          parameters: z.object({ location: z.string() }),
          execute: async ({ location }) => { return { location }; },
        }),

        /* 💱 CURRENCY (No Change) */
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

        /* 🧮 CALCULATOR (No Change) */
        calculate: tool({
          description: "Evaluate math expression",
          parameters: z.object({ expression: z.string() }),
          execute: async ({ expression }) => {
            try { return eval(expression).toString(); } catch { return "Error"; }
          },
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
    console.error("❌ AMINA CHAT ERROR:", err);
    return new Response("Chat system error", { status: 500 });
  }
}