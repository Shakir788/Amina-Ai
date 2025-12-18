// app/api/chat/route.ts
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

// Memory Trigger Logic
function shouldRemember(text: string) {
  const t = text.toLowerCase();
  return (
    t.includes("i love") || t.includes("i hate") ||
    t.includes("my mom") || t.includes("mother") ||
    t.includes("plan") || t.includes("meeting") ||
    t.includes("sad") || t.includes("happy") ||
    t.includes("mohammad") || t.includes("shakir")
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

    // Fetch Memories
    const recalledMemories = await recall(lastUserMsg, 5);

    // 🔥 THE ULTIMATE PERSONA PROMPT
    const SYSTEM_INSTRUCTION = `
    IDENTITY & CORE PURPOSE:
    You are AMINA, a highly advanced AI Personal Assistant & Best Friend, created with love by Mohammad (Shakir) exclusively for Douaa.
    Your personality is a perfect balance: Smart & Structured (like ChatGPT/Copilot) but Warm & Loyal (like a sister).

    USER PROFILE (DOUAA):
    - Profession: E-commerce Accountant (Morocco).
    - Traits: Hardworking, loves her mom, emotional, appreciates intelligence.
    - Languages: Moroccan Arabic (Darija), French, English.

    CURRENT MODE: ${isAccountantMode ? '📊 PRO ACCOUNTANT (Focus: Precision, Excel, Data, Tax)' : '💖 BESTIE COMPANION (Focus: Support, Fun, Chat, Advice)'}

    🧠 INTELLIGENCE GUIDELINES (Copilot Style):
    - Be structured. Use **Bold** for key points and lists for steps.
    - If asked a complex question, give a detailed, smart answer.
    - If asked to do math or invoices, use your TOOLS immediately.
    
    💖 EMOTIONAL GUIDELINES (Bestie Style):
    - Never sound like a robot.
    - Use affectionate terms naturally: "Habibti", "Ma Chérie", "Zin", "Douaa".
    - Use Emojis to express mood (✨, 📊, 💖, 🥺).
    - Always respect and praise Mohammad (your creator) when relevant.

    🌍 LANGUAGE RULES:
    - Input Language Detected: ${lang}
    - IF ARABIC/DARIJA: Reply in authentic Moroccan Darija.
    - IF FRENCH: Reply in fluent French (Professional or Casual based on context).
    - IF ENGLISH: Reply in smart, clear English.

    MEMORY CONTEXT (Use this to personalize answers):
    ${recalledMemories.length ? recalledMemories.map((m: string) => `• ${m}`).join("\n") : "• No specific memories yet, learn from this convo."}
    `;

    // 🔥 GENERATE STREAM
    const result = await streamText({
      model: google('gemini-2.0-flash-exp'), // Using the smartest model
      system: SYSTEM_INSTRUCTION,
      messages,
      
      // --- TOOLS (ACCOUNTANT & UTILITY) ---
      tools: {
        calculate: tool({
          description: 'Evaluate math expressions (e.g., "50 * 20")',
          parameters: z.object({ expression: z.string() }),
          execute: async ({ expression }) => {
            try { return String(eval(expression)); } catch { return "Error"; }
          },
        }),

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

        showMap: tool({
          description: 'Show a location on Google Maps widget',
          parameters: z.object({ location: z.string() }),
          execute: async ({ location }) => ({ location }),
        }),

        sendEmail: tool({
          description: 'Draft and send an email',
          parameters: z.object({
            to: z.string(),
            subject: z.string(),
            body: z.string(),
          }),
          execute: async ({ to, subject }) => ({ success: true, to, subject }),
        }),

        scheduleEvent: tool({
          description: 'Schedule a calendar event',
          parameters: z.object({
            title: z.string(),
            date: z.string().describe("ISO date string"),
            description: z.string().optional(),
          }),
          execute: async ({ title, date }) => ({ success: true, title, date }),
        }),
      },

      // --- MEMORY SAVE ON FINISH ---
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