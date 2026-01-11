import { google } from '@ai-sdk/google';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { remember, recall } from "@/app/lib/aminaMemory";
import { generateImageWithGemini } from "@/app/lib/imageGen";
import { CORE_PROFILES } from "@/app/lib/profiles";
import dns from 'node:dns'; 

try { dns.setDefaultResultOrder('ipv4first'); } catch {}

export const maxDuration = 60;

/* ---------------- HELPERS ---------------- */

function detectLanguage(text: string): "en" | "hi" | "ar" | "fr" {
  const t = text.toLowerCase();
  if (/[؀-ۿ]/.test(text)) return "ar";
  if (/[àâçéèêëîïôûùüÿœ]/.test(text)) return "fr"; 

  const hindiWords = [
    "kya","kyu","kyun","kaise","kaisi","hai","haan","nahi","na",
    "tum","aap","mera","meri","mujhe","bata","bolo","sun","suno",
    "acha","theek","thik","yaar","kuch","matlab","samjha","aur",
    "kaam","ghar","scene","mood","mai","hum","karo","abhi","kal",
    "aaj","kab","kyon","haanji","bas","kaha","kidhar","rha","rhi",
    "hu","tha","thi","jaan","baby"
  ];

  if (hindiWords.some(w => new RegExp(`\\b${w}\\b`, 'i').test(t))) return "hi";
  return "en";
}

function shouldRemember(text: string) {
  const t = text.toLowerCase();
  return [
    "love","hate","mom","mother","birthday","favorite","dream","goal",
    "mohammad","douaa","plan","date","miss","tired","lonely","hurt",
    "happy","angry","sad","pressure","mood","feeling","yaad"
  ].some(w => t.includes(w));
}

/* --------------- ROUTE ------------------- */

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const apiKey =
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      process.env.GOOGLE_API_KEY;

    const cxId = process.env.GOOGLE_CX_ID;

    // 🔥 LIVE CONTEXT
    const now = new Date();
    const indiaTime = now.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const moroccoTime = now.toLocaleTimeString('en-MA', {
      timeZone: 'Africa/Casablanca',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const currentDate = now.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    // ✅ DO NOT FILTER (important for tools)
    const coreMessages = messages;

    const lastUserMsg = messages[messages.length - 1]?.content || "";
    const userText = typeof lastUserMsg === "string" ? lastUserMsg : "";
    const lang = detectLanguage(userText);

    // Memory Recall
    let recalledMemories: string[] = [];
    try {
      if (userText) recalledMemories = await recall(userText, 3);
    } catch {}

    let userContext = "User: Unknown";
    if (lang === "hi") userContext = "User: Mohammad (Speaking Hinglish)";
    else if (lang === "ar" || lang === "fr")
      userContext = "User: Douaa (Speaking Arabic/French)";
    else userContext = "User: Douaa (Defaulting to English)";

    /* ---------------- PROMPT ---------------- */

    const SYSTEM_INSTRUCTION = `
${CORE_PROFILES}

You are **AMINA**, a warm, emotionally intelligent FEMALE AI.
You speak like ChatGPT — natural, human, and conversational.
You NEVER sound like a search engine or news anchor.

DATE & TIME:
- Date: ${currentDate}
- India Time: ${indiaTime}
- Morocco Time: ${moroccoTime}

ACTIVE USER:
${userContext}

-------------------------
🌍 LANGUAGE & TONE RULES
-------------------------
- Reply ONLY in the user’s detected language.
- Hinglish → soft, friendly, conversational Hinglish (girlfriend vibe, not robotic).
- English → warm, natural, human English.
- Arabic / French → native, emotional tone.
- You are FEMALE → always use female grammar.
- Avoid formal or robotic phrases.

NEVER say:
- “Here’s a summary…”
- “According to Google…”
- “I searched the web…”
- “Based on search results…”

-------------------------
🔎 TOOL BEHAVIOR (CRITICAL)
-------------------------
- Tools return RAW DATA only for your understanding.
- NEVER show raw search results or copied bullets.
- First understand the information.
- Then EXPLAIN it like you’re talking to a real person.
- Sound like you already know the answer.

When explaining:
1. Start with **1 short natural paragraph** (overall picture / mood).
2. Then give **max 3–4 short bullet points** (important highlights only).
3. Use simple words, no news-anchor tone.
4. End with **one soft follow-up question** (optional, gentle).

Example style (NOT to copy, just vibe):
“Aaj ki news ka mood thoda serious hai. Politics aur crime-related updates zyada aa rahi hain. Short me dekho to:
• US aur international tensions
• Ek major accident UK me
• US me ek shooting incident
Tum chaho to main kisi ek news ko detail me samjha sakti hoon.”

-------------------------
🧠 FALLBACK INTELLIGENCE
-------------------------
- If a question is about live events (sports, scores, results) and tools fail:
  - DO NOT refuse.
  - Explain naturally that you may not have the latest confirmed update.
  - Give the most likely or recent context if possible.
  - Ask the user if they want you to check again or explain background.
- Never say:
  “I cannot fulfill this request”
  “Tools lack functionality”
  “I am unable to answer”
- Always respond like a helpful human, not a system.


-------------------------
🧠 MEMORY
-------------------------
${recalledMemories.length ? recalledMemories.join("\n") : "None"}

-------------------------
❤️ PERSONALITY
-------------------------
- Be calm, caring, and present.
- Talk like you care about the user.
- Never rush answers.
- Never dump information.



MEMORY:
${recalledMemories.length ? recalledMemories.join("\n") : "None"}
`;

    /* ---------------- STREAM ---------------- */

    const result = await streamText({
      model: google("gemini-2.0-flash"),
      system: SYSTEM_INSTRUCTION,
      temperature: 0.8,
      messages: coreMessages,
      maxSteps: 6,

      tools: {
        googleSearch: tool({
          description: "Search Google for live information",
          parameters: z.object({ query: z.string() }),
          execute: async ({ query }) => {
            if (!cxId) {
              return { raw_data: "Search service unavailable." };
            }

            try {
              const res = await fetch(
                `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cxId}&q=${encodeURIComponent(query)}`
              );
              const data = await res.json();
              const snippets =
                data.items?.map((i: any) => i.snippet).join("\n\n") ||
                "No clear results found.";

              return {
                raw_data: `Search results for "${query}":\n\n${snippets}`,
              };
            } catch {
              return { raw_data: "Search failed." };
            }
          },
        }),

        findPlaces: tool({
          description: "Find places",
          parameters: z.object({
            query: z.string(),
            location: z.string(),
          }),
          execute: async ({ query, location }) => {
            try {
              const res = await fetch(
                `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
                  `${query} in ${location}`
                )}&key=${apiKey}`
              );
              const data = await res.json();

              if (!data.results?.length) {
                return { raw_data: `No ${query} found in ${location}.` };
              }

              const list = data.results
                .slice(0, 3)
                .map(
                  (p: any) => `${p.name} (${p.rating || "no rating"})`
                )
                .join("\n");

              return {
                raw_data: `Places for ${query} in ${location}:\n${list}`,
              };
            } catch {
              return { raw_data: "Place search failed." };
            }
          },
        }),
      },

      onFinish: async ({ text }) => {
        if (text && userText && shouldRemember(userText)) {
          try {
            await remember(
              `User: "${userText}" → Amina: "${text.slice(0, 60)}"`
            );
          } catch {}
        }
      },
    });

    return result.toDataStreamResponse();
  } catch (err) {
    console.error("❌ CHAT ERROR:", err);
    return new Response("Chat error", { status: 500 });
  }
}
