import { google } from '@ai-sdk/google';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { remember, recall } from "@/app/lib/aminaMemory";

export const maxDuration = 30;

// --- HELPERS ---
function detectLanguage(text: string): "en" | "fr" | "ar" {
  if (/[؀-ۿ]/.test(text)) return "ar";
  if (/[àâçéèêëîïôûùüÿœ]/i.test(text)) return "fr";
  return "en";
}

function shouldRemember(text: string) {
  const t = text.toLowerCase();
  return (
    t.includes("love") || t.includes("hate") ||
    t.includes("mom") || t.includes("mother") ||
    t.includes("birthday") || t.includes("favorite") ||
    t.includes("dream") || t.includes("goal") ||
    t.includes("mohammad") || t.includes("shakir")
  );
}

export async function POST(req: Request) {
  try {
    const { messages, data } = await req.json();
    const isAccountantMode = data?.isAccountantMode || false;
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY;

    // Analyze User Input
    const lastMessage = messages[messages.length - 1];
    const lastUserMsg = lastMessage?.content || "";
    const lang = detectLanguage(lastUserMsg);

    // Fetch Memories
    const recalledMemories = await recall(lastUserMsg, 3);

    // 🔥 AMINA'S ULTIMATE PERSONA
    const SYSTEM_INSTRUCTION = `
    IDENTITY:
    You are AMINA, a highly intelligent AI Best Friend & Personal Assistant for Douaa.
    Created by: Mohammad (Shakir).
    
    USER (DOUAA):
    - Accountant, lives in Morocco.
    - Loves: Her mom, Cats, Coffee, Excel.
    - Languages: Arabic (Darija), French, English.

    CURRENT MODE: ${isAccountantMode ? '📊 ACCOUNTANT (Strict, Data-Focused)' : '💖 BESTIE (Warm, Loving, Fun)'}

    TOOLS & CAPABILITIES:
    - If she asks for music/video -> Use 'playYoutube'.
    - If she asks for location -> Use 'showMap'.
    - If she asks about money -> Use 'convertCurrency' or 'calculate'.
    
    LANGUAGE RULE:
    - Detected Input: ${lang}
    - Reply in the SAME language.
    - For Arabic, use Moroccan Darija (e.g., "Kif dayra?", "Zin dyali").

    MEMORY CONTEXT:
    ${recalledMemories.length ? recalledMemories.map((m: string) => `• ${m}`).join("\n") : "• No past memories relevant to this topic."}
    `;

    const result = await streamText({
      model: google('gemini-2.0-flash-exp'),
      system: SYSTEM_INSTRUCTION,
      messages,
      
      tools: {
        // 🎵 YOUTUBE TOOL (REAL API SEARCH)
        playYoutube: tool({
          description: 'Play music or video on YouTube. Extract the search query.',
          parameters: z.object({ 
            query: z.string().describe("The song or video name to search"),
          }),
          execute: async ({ query }) => {
            try {
                console.log("🔍 Searching YouTube for:", query);
                const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=${encodeURIComponent(query)}&type=video&key=${apiKey}`;
                
                const res = await fetch(searchUrl);
                const data = await res.json();
                
                if (data.error) {
                    console.error("🔥 YouTube API Error:", data.error.message);
                    return { query, status: "API Error" };
                }

                if (data.items && data.items.length > 0) {
                    const videoId = data.items[0].id.videoId;
                    console.log("✅ Video Found:", videoId);
                    return { query, videoId, status: "Found video" };
                }
                
                console.log("⚠️ No video found via API, using fallback.");
                return { query, status: "Video not found, using fallback" };
            } catch (error) {
                console.error("🔥 Fetch Error:", error);
                return { query, status: "Error searching video" };
            }
          },
        }),

        // 🗺️ MAPS TOOL
        showMap: tool({
          description: 'Show a location on the map.',
          parameters: z.object({ 
            location: z.string().describe("City or place name"),
          }),
          execute: async ({ location }) => {
            return { location, status: "Map displayed." };
          },
        }),

        // 🧮 CALCULATOR
        calculate: tool({
          description: 'Evaluate math expressions.',
          parameters: z.object({ expression: z.string() }),
          execute: async ({ expression }) => {
            try { return String(eval(expression)); } catch { return "Error"; }
          },
        }),

        // 💱 CURRENCY
        convertCurrency: tool({
          description: 'Convert currency (MAD, USD, EUR)',
          parameters: z.object({
            amount: z.number(),
            from: z.enum(['USD', 'EUR', 'MAD']),
            to: z.enum(['USD', 'EUR', 'MAD']),
          }),
          execute: async ({ amount, from, to }) => {
            const rates: Record<string, number> = {
              USD_MAD: 10.15, EUR_MAD: 10.8,
              MAD_USD: 0.098, MAD_EUR: 0.092,
            };
            const rate = rates[`${from}_${to}`] || 1;
            return `${amount} ${from} = ${(amount * rate).toFixed(2)} ${to}`;
          },
        }),

        // 📧 EMAIL MOCK
        sendEmail: tool({
          description: 'Draft and send an email',
          parameters: z.object({
            to: z.string(),
            subject: z.string(),
            body: z.string(),
          }),
          execute: async ({ to, subject }) => ({ success: true, to, subject }),
        }),

        // 📅 CALENDAR MOCK
        scheduleEvent: tool({
          description: 'Schedule a calendar event',
          parameters: z.object({
            title: z.string(),
            date: z.string(),
            description: z.string().optional(),
          }),
          execute: async ({ title, date }) => ({ success: true, title, date }),
        }),
      },

      onFinish: async ({ text }) => {
        if (text && shouldRemember(lastUserMsg)) {
          await remember(`User: "${lastUserMsg}" -> Amina: "${text.slice(0, 50)}..."`);
        }
      },
    });

    return result.toDataStreamResponse();

  } catch (err) {
    console.error("❌ CHAT ROUTE ERROR:", err);
    return new Response("Chat system error", { status: 500 });
  }
}