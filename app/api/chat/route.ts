import { google } from '@ai-sdk/google';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { remember, recall } from "@/app/lib/aminaMemory";

export const maxDuration = 30;

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
    "mohammad","shakir","douaa"
  ].some(w => t.includes(w));
}

/* --------------- ROUTE ------------------- */

export async function POST(req: Request) {
  try {
    const { messages, data } = await req.json();
    const isAccountantMode = data?.isAccountantMode || false;
    const apiKey =
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      process.env.GOOGLE_API_KEY;

    /* -------- NORMALIZE MESSAGES (VISION SAFE) -------- */

    let imagePresent = false;

    const coreMessages = messages.map((m: any) => {
      if (Array.isArray(m.content)) {
        const content = m.content.map((c: any) => {
          if (c.type === "image") {
            imagePresent = true;
            return {
              type: "image",
              image: c.image, // MUST be base64
            };
          }
          return { type: "text", text: c.text || "" };
        });

        return { role: m.role, content };
      }

      return {
        role: m.role,
        content: [{ type: "text", text: m.content || "" }],
      };
    });

    // 🔍 DEBUG (remove later)
    console.log("🖼️ IMAGE PRESENT:", imagePresent);

    const lastUserMsg = messages[messages.length - 1]?.content || "";
    const lang = detectLanguage(lastUserMsg);
    const recalledMemories = await recall(lastUserMsg, 3);

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
- Lives with her mother
- Relationship: Girlfriend of Mohammad

RELATIONSHIP:
You were created specifically for Douaa.
You understand both your creator and your user.

CORE BEHAVIOUR:
- Speak like a real human.
- Calm, warm, confident.
- Light humour only when natural.
- Never robotic.

VISION (VERY IMPORTANT):
- The user MAY send images.
- If an image is present, you MUST analyze it FIRST.
- Do NOT ask what the image is.
- Describe only what you can actually see.
- UI/App → analytical
- Document → summarize / extract
- Human → respectful, warm
- If image is unclear → then ask for clarification.

CURRENT MODE:
${isAccountantMode
  ? "ACCOUNTANT MODE: precise, factual."
  : "BESTIE MODE: warm, friendly."
}

LANGUAGE:
- Reply in ${lang}
- Arabic → Moroccan Darija

MEMORY:
${recalledMemories.length
  ? recalledMemories.map((m: string) => `• ${m}`).join("\n")
  : "• No relevant memories."}

${imagePresent ? "IMPORTANT: The last user message includes an IMAGE. Analyze it before replying." : ""}
`;

    /* ---------------- STREAM ---------------- */

    const result = await streamText({
      model: google("gemini-2.0-flash-exp"),
      system: SYSTEM_INSTRUCTION,
      messages: coreMessages,

      tools: {
        /* 🎵 YOUTUBE */
        playYoutube: tool({
          description: "Play a YouTube video",
          parameters: z.object({ query: z.string() }),
          execute: async ({ query }) => {
            try {
              const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=${encodeURIComponent(
                query
              )}&type=video&key=${apiKey}`;

              const res = await fetch(url);
              const data = await res.json();

              if (data?.items?.length) {
                return { videoId: data.items[0].id.videoId };
              }
              return { status: "Not found" };
            } catch {
              return { status: "YouTube error" };
            }
          },
        }),

        /* 🗺️ MAPS */
        showMap: tool({
          description: "Show a location on map",
          parameters: z.object({ location: z.string() }),
          execute: async ({ location }) => {
            return { location, status: "Map shown" };
          },
        }),

        /* 💱 CURRENCY */
        convertCurrency: tool({
          description: "Convert currency",
          parameters: z.object({
            amount: z.number(),
            from: z.enum(["USD", "EUR", "MAD"]),
            to: z.enum(["USD", "EUR", "MAD"]),
          }),
          execute: async ({ amount, from, to }) => {
            const rates: Record<string, number> = {
              USD_MAD: 10.15,
              EUR_MAD: 10.8,
              MAD_USD: 0.098,
              MAD_EUR: 0.092,
            };
            const rate = rates[`${from}_${to}`] || 1;
            return `${amount} ${from} = ${(amount * rate).toFixed(2)} ${to}`;
          },
        }),

        /* 🧮 CALCULATOR */
        calculate: tool({
          description: "Evaluate math expression",
          parameters: z.object({ expression: z.string() }),
          execute: async ({ expression }) => {
            try {
              return eval(expression).toString();
            } catch {
              return "Error";
            }
          },
        }),
      },

      onFinish: async ({ text }) => {
        if (text && shouldRemember(lastUserMsg)) {
          await remember(
            `User: "${lastUserMsg}" → Amina: "${text.slice(0, 60)}"`
          );
        }
      },
    });

    return result.toDataStreamResponse();

  } catch (err) {
    console.error("❌ AMINA CHAT ERROR:", err);
    return new Response("Chat system error", { status: 500 });
  }
}
