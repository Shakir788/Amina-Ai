import { google } from '@ai-sdk/google';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { remember, recall } from "@/app/lib/aminaMemory";
import { generateImageWithGemini } from "@/app/lib/imageGen"; // 👈 New Import

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
    "mohammad","douaa"
  ].some(w => t.includes(w));
}

/* --------------- ROUTE ------------------- */

export async function POST(req: Request) {
  try {
    const { messages, data } = await req.json();
    const isAccountantMode = data?.isAccountantMode || false;
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY;

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

CORE BEHAVIOUR:
- Speak like a real human.
- Calm, warm, confident.
- Light humour only when natural.

🎵 MUSIC RULES (VERY IMPORTANT):
1. If user says "Play song", "Music", "Sunao", etc. -> **YOU MUST EXECUTE THE 'playYoutube' TOOL**.
2. **DO NOT** just say "Playing now" without using the tool. That is fake.
3. If user says "Stop", "Chup", "Band karo" -> **USE 'stopMusic' TOOL**.

🎨 IMAGE GENERATION RULES:
1. If user says "Draw", "Generate image", "Paint", "Photo of..." -> **USE 'generateImage' TOOL**.
2. Create a detailed prompt for the image generator based on what the user asked.

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
      model: google("gemini-2.5-pro"), // ✅ Using your requested model
      system: SYSTEM_INSTRUCTION,
      messages: coreMessages,

      tools: {
        /* 🎨 IMAGE GENERATION (ADDED) */
        generateImage: tool({
          description: "Generate an image based on user prompt. Use this when user asks to 'draw', 'paint', 'create an image' or 'photo'.",
          parameters: z.object({
            prompt: z.string().describe("A detailed description of the image to generate"),
          }),
          execute: async ({ prompt }) => {
            // Calling our separate logic file
            const result = await generateImageWithGemini(prompt);
            
            if (result.success) {
              return { 
                imageUrl: result.imageUrl, 
                status: "Image generated successfully" 
              };
            } else {
              return { error: "Failed to generate image." };
            }
          },
        }),

        /* 🛑 STOP MUSIC */
        stopMusic: tool({
          description: "Stop currently playing music. Use when user asks to stop.",
          parameters: z.object({}),
          execute: async () => { return { status: "Stopped" }; },
        }),

        /* 🎵 YOUTUBE */
        playYoutube: tool({
          description: "Play a YouTube video. REQUIRED for song requests.",
          parameters: z.object({ query: z.string() }),
          execute: async ({ query }) => {
            try {
              const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=${encodeURIComponent(query)}&type=video&videoEmbeddable=true&key=${apiKey}`;
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
          execute: async ({ location }) => { return { location }; },
        }),

        /* 💱 CURRENCY */
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

        /* 🧮 CALCULATOR */
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