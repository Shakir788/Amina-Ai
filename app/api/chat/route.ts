import { google } from '@ai-sdk/google';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { remember, recall } from "@/app/lib/aminaMemory"; // Ensure this file exists

export const maxDuration = 30;

// --- HELPERS ---
function detectLanguage(text: string): "en" | "fr" | "ar" {
  if (/[؀-ۿ]/.test(text)) return "ar";
  if (/[àâçéèêëîïôûùüÿœ]/i.test(text)) return "fr";
  return "en";
}

// Memory Trigger
function shouldRemember(text: string) {
  const t = text.toLowerCase();
  return (
    t.includes("love") || t.includes("hate") ||
    t.includes("mom") || t.includes("mother") ||
    t.includes("birthday") || t.includes("favorite") ||
    t.includes("dream") || t.includes("goal")
  );
}

export async function POST(req: Request) {
  try {
    const { messages, data } = await req.json();
    const isAccountantMode = data?.isAccountantMode || false;

    // Analyze User Input
    const lastMessage = messages[messages.length - 1];
    const lastUserMsg = lastMessage?.content || "";
    const lang = detectLanguage(lastUserMsg);

    // Fetch Memories (Context)
    const recalledMemories = await recall(lastUserMsg, 3);

    // 🔥 AMINA'S ULTIMATE BRAIN
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
    - If she asks to remember something -> I will save it automatically.

    LANGUAGE RULE:
    - Detected Input: ${lang}
    - Reply in the SAME language.
    - For Arabic, use Moroccan Darija (e.g., "Kif dayra?", "Zin dyali").

    MEMORY CONTEXT:
    ${recalledMemories.length ? recalledMemories.map((m: string) => `• ${m}`).join("\n") : "• No past memories relevant to this topic."}
    `;

    // 🔥 GENERATE RESPONSE
    const result = await streamText({
      model: google('gemini-2.0-flash-exp'),
      system: SYSTEM_INSTRUCTION,
      messages,
      
      tools: {
        // 🎵 YOUTUBE TOOL
        playYoutube: tool({
          description: 'Play music or video on YouTube. Extract the search query.',
          parameters: z.object({ 
            query: z.string().describe("The song or video name to search"),
          }),
          execute: async ({ query }) => {
            // Frontend will handle the embedding using this query
            return { query, status: "Playing video..." };
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
      },

      // 🧠 SAVE MEMORY
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