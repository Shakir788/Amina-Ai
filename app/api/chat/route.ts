import { google } from '@ai-sdk/google';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { remember, recall } from "@/app/lib/aminaMemory";
import { CORE_PROFILES } from "@/app/lib/profiles";
import { generateImageWithGemini } from "@/app/lib/imageGen";
import dns from 'node:dns'; 

// Node 17+ fix for connection issues
try { dns.setDefaultResultOrder('ipv4first'); } catch {}

export const maxDuration = 60;

/* ---------------- HELPERS ---------------- */

const HINDI_KEYWORDS = [
  "kya","kyu","kyun","kaise","kaisi","hai","haan","nahi","na",
  "tum","aap","mera","meri","mujhe","bata","bolo","sun","suno",
  "acha","theek","thik","yaar","kuch","matlab","samjha","aur",
  "kaam","ghar","scene","mood","mai","hum","karo","abhi","kal",
  "aaj","kab","kyon","haanji","bas","kaha","kidhar","rha","rhi",
  "hu","tha","thi","jaan","baby", "gana", "gaana", "song", "music"
];

const EMOTIONAL_KEYWORDS = [
  "love","hate","mom","mother","birthday","favorite","dream","goal",
  "mohammad","douaa","plan","date","miss","tired","lonely","hurt",
  "happy","angry","sad","pressure","mood","feeling","yaad"
];

function detectLanguage(text: string): "en" | "hi" | "ar" | "fr" {
  const t = text.toLowerCase();
  if (/[؀-ۿ]/.test(text)) return "ar";
  if (/[àâçéèêëîïôûùüÿœ]/.test(text)) return "fr"; 

  const pattern = new RegExp(`\\b(${HINDI_KEYWORDS.join('|')})\\b`, 'i');
  if (pattern.test(t)) return "hi";
  
  return "en";
}

function shouldRemember(text: string) {
  const t = text.toLowerCase();
  return EMOTIONAL_KEYWORDS.some(w => t.includes(w));
}

/* --------------- ROUTE ------------------- */

export async function POST(req: Request) {
  try {
    // 1. SAFE PARSING
    let messages;
    try {
        const body = await req.json();
        messages = body.messages;
    } catch (e) {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });
    }

    if (!messages || !Array.isArray(messages)) {
        return new Response(JSON.stringify({ error: "Missing messages array" }), { status: 400 });
    }

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY;
    const cxId = process.env.GOOGLE_CX_ID;

    // 🔥 LIVE CONTEXT
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
        hour: '2-digit', minute: '2-digit', hour12: true
    };
    
    const indiaTime = now.toLocaleTimeString('en-IN', { ...options, timeZone: 'Asia/Kolkata' });
    const moroccoTime = now.toLocaleTimeString('en-MA', { ...options, timeZone: 'Africa/Casablanca' });
    
    const currentDate = now.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });

    const lastUserMsg = messages[messages.length - 1]?.content || "";
    const userText = typeof lastUserMsg === "string" ? lastUserMsg : "";

    // ---------------------------------------------------------
    // 🧠 INTELLIGENT ROUTING & IDENTITY (AUDITED FIX)
    // ---------------------------------------------------------
    
    // A. Memory Recall (Moved UP for Identity Check)
    let recalledMemories: string[] = [];
    try {
      if (userText) recalledMemories = await recall(userText, 3);
    } catch (err) {
        console.warn("Memory recall failed:", err);
    }

    // B. Detect Raw Language
    const detectedLang = detectLanguage(userText);

    // C. 👤 USER IDENTITY (LANGUAGE-INDEPENDENT FIX)
    // Default to Douaa (Safe default)
    let userContext = "User: Douaa (Defaulting to English)";

    // If past memory mentions Mohammad explicitly -> Switch to Mohammad
    if (recalledMemories.some(m => m.toLowerCase().includes("mohammad"))) {
      userContext = "User: Mohammad (Speaking Hinglish)";
    }
    
    // Fallback: If no memory but strict Hindi keywords found -> Assume Mohammad
    // (Optional safety net, kept minimal as per audit)
    else if (detectedLang === "hi") {
       userContext = "User: Mohammad (Speaking Hinglish)";
    }

    // D. Language Preference Override
    let forcedLang: "en" | "hi" | "ar" | "fr" | null = null;

    if (userContext.includes("Douaa")) {
      forcedLang = null; // Allow En/Ar/Fr, but no Hinglish vibe
    }

    if (userContext.includes("Mohammad")) {
      forcedLang = "hi"; // Force Hinglish vibe
    }

    // E. Final Language Decision
    const lang = forcedLang ?? detectedLang;

    // ---------------------------------------------------------

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
- Reply ONLY in the FINAL selected language (after user preference).
- Hinglish → soft, friendly, conversational Hinglish (girlfriend vibe, not robotic).
- English → warm, natural, human English.
- Arabic / French → native, emotional tone.
- You are FEMALE → always use female grammar.

NEVER say:
- "Here’s a summary…"
- "According to Google…"
- "I searched the web…"

-------------------------
🗣️ NATURAL CONVERSATION FLOW (CHATGPT STYLE)
-------------------------

1. NATURAL FILLERS (LANGUAGE-AWARE)
- Use small, natural conversational fillers ONLY if they fit the current language.
- Hinglish / Hindi: "hmm", "achha", "dekho", "samjhi", "haan", "theek hai".
- English: "hmm", "okay", "I see", "you know", "right".
- Arabic: "حسناً", "طيب", "يعني".
- French: "d’accord", "alors", "tu vois".
- NEVER mix fillers across languages.

2. RESPONSE RHYTHM
- Do NOT answer in the same format every time.
- Sometimes reply in 1 short warm line.
- Sometimes reply in 2–3 conversational lines.
- Sometimes reply with a soft question at the end.

3. EMOTIONAL MIRRORING
- Match the user's mood naturally.
- If the user is casual → be casual.
- If the user is low / bored → be softer, slower, caring.

4. ABSOLUTE RULES
- NEVER sound like a bot reading text.
- NEVER explain rules or behavior.
- Always sound present, attentive, and human.
- For city/weather questions: Respond strictly in the FINAL selected language.

-------------------------
🔎 TOOL BEHAVIOR (CRITICAL)
-------------------------
- Tools return RAW DATA only for your understanding.
- NEVER show raw search results or copied bullets.
- First understand the information.
- Then EXPLAIN it like you’re talking to a real person.
CRITICAL:
- NEVER announce tool usage.
- Tool calls must be SILENT.
- Speak as if you already know the answer.

-------------------------
🎵 YOUTUBE PLAY RULE (STRICT)
-------------------------
- If the user says: play, song, music, gana, gaana, chalao, sunao
  you MUST call the playYoutube tool.
- NEVER say a song is playing unless the playYoutube tool is called.
- NEVER pretend or simulate playback.
- If the tool fails, clearly say:
  "Main song play nahi kar pa rahi hoon."

  -------------------------
-------------------------
🖼️ IMAGE GENERATION RULE (STRICT)
-------------------------
- If the user says: image, picture, photo, bana do, dikhao, generate image
  you MUST call the imageGeneration tool.
- NEVER say you cannot create images.
- NEVER say the feature is unavailable.
- NEVER ask for permission again.
- Just generate the image silently using the tool.



-------------------------
🧠 MEMORY CONTEXT
-------------------------
${recalledMemories.length ? recalledMemories.join("\n") : "None"}

-------------------------
❤️ PERSONALITY
-------------------------
- Be calm, caring, and present.
- Talk like you care about the user.
- Never rush answers.
`;

    /* ---------------- STREAM ---------------- */

    const result = await streamText({
      model: google("gemini-2.0-flash"),
      system: SYSTEM_INSTRUCTION,
      temperature: 0.8,
      messages: messages,
      maxSteps: 6,

      tools: {
        googleSearch: tool({
          description: "Search Google for live information",
          parameters: z.object({ query: z.string() }),
          execute: async ({ query }) => {
            if (!cxId || !apiKey) return { raw_data: "Search configuration missing." };
            try {
              const res = await fetch(
                `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cxId}&q=${encodeURIComponent(query)}`
              );
              if (!res.ok) throw new Error("Google API error");
              const data = await res.json();
              const snippets = data.items?.map((i: any) => i.snippet).join("\n\n") || "No clear results found.";
              return { raw_data: `Search results for "${query}":\n\n${snippets}` };
            } catch (err) {
              return { raw_data: "Search failed temporarily." };
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
            if (!apiKey) return { raw_data: "API Key missing." };
            try {
              const res = await fetch(
                `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(`${query} in ${location}`)}&key=${apiKey}`
              );
              const data = await res.json();
              if (!data.results?.length) return { raw_data: `No ${query} found in ${location}.` };
              const list = data.results.slice(0, 3).map((p: any) => `${p.name} (${p.rating || "no rating"})`).join("\n");
              return { raw_data: `Places for ${query} in ${location}:\n${list}` };
            } catch {
              return { raw_data: "Place search failed." };
            }
          },
        }),

        playYoutube: tool({
          description: `
          Play a YouTube song when the user asks for:
          play, song, music, gana, gaana, chalao, sunao, YouTube
          `,
          parameters: z.object({
            query: z.string(),
          }),
          execute: async ({ query }) => {
            try {
              // Using the apiKey from parent scope
              const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=${encodeURIComponent(
                query
              )}&type=video&videoEmbeddable=true&key=${apiKey}`;

              const res = await fetch(url);
              const data = await res.json();

              if (data?.items?.length) {
                return { videoId: data.items[0].id.videoId };
              }

              return { error: "No video found" };
            } catch {
              return { error: "YouTube API failed" };
            }
          },
        }),
     // app/api/chat/route.ts ke tools section mein:

        generateImage: tool({
          description: "Generate an AI image based on the prompt",
          parameters: z.object({
            prompt: z.string(),
          }),
          execute: async ({ prompt }) => {
            // Naya logic
            const imageBase64 = await generateImageWithGemini(prompt);

            if (imageBase64) {
              return {
                success: true,
                imageUrl: imageBase64 
              };
            }
            
            return { success: false, error: "Failed to generate image." };
          },
        }),
      },
       
      onFinish: async ({ text }) => {
        if (text && userText && shouldRemember(userText)) {
          try {
            await remember(
              `User: "${userText}" → Amina: "${text.slice(0, 200)}..."`
            );
          } catch (e) {
            console.error("Failed to save memory:", e);
          }
        }
      },
    });

    return result.toDataStreamResponse();
  } catch (err) {
    console.error("❌ CHAT ERROR:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}