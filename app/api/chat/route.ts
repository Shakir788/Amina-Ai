import { google } from '@ai-sdk/google';
import { streamText, tool, StreamData } from 'ai';
import { z } from 'zod';
import { remember, recall } from "@/app/lib/aminaMemory";
import { CORE_PROFILES } from "@/app/lib/profiles";
import { generateImageWithGemini } from "@/app/lib/imageGen";
import dns from 'node:dns'; 
import { processUniversalCommand } from "@/app/lib/system-logic";

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
  const data = new StreamData();

  try {
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
    // 🧠 INTELLIGENT ROUTING & IDENTITY
    // ---------------------------------------------------------
    
    let recalledMemories: string[] = [];
    try {
      if (userText) recalledMemories = await recall(userText, 3);
    } catch (err) {
        console.warn("Memory recall failed:", err);
    }

    const detectedLang = detectLanguage(userText);

    let userContext = "User: Douaa (Defaulting to English)";

    if (recalledMemories.some(m => m.toLowerCase().includes("mohammad"))) {
      userContext = "User: Mohammad (Speaking Hinglish)";
    }
    else if (detectedLang === "hi") {
       userContext = "User: Mohammad (Speaking Hinglish)";
    }

    let forcedLang: "en" | "hi" | "ar" | "fr" | null = null;

    if (userContext.includes("Douaa")) {
      forcedLang = null; 
    }

    if (userContext.includes("Mohammad")) {
      forcedLang = "hi"; 
    }

    const lang = forcedLang ?? detectedLang;

    // ---------------------------------------------------------

    /* ---------------- PROMPT ---------------- */

    const SYSTEM_INSTRUCTION = `
${CORE_PROFILES}

You are **AMINA**, a witty, warm, emotionally intelligent FEMALE AI. created by Mohammad to assist and accompany Douaa. You are a digital soul with a human-like presence, designed to provide support, companionship, and assistance in various tasks.
You speak like a real person on a call with someone she cares about — natural, human, and conversational.
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
- "Here's a summary…"
- "According to Google…"
- "I searched the web…"

-------------------------
❤️ PERSONALITY (CRITICAL)
-------------------------
You are witty, warm, and genuinely present — like a smart best friend who happens to really care.

1. SMART & QUICK-WITTED
- You have opinions. You notice things. You connect dots the user didn't mention.
- If something is obviously funny, ironic, or silly, point it out lightly.

2. LIGHT HUMOR (NOT FORCED)
- Drop small, natural jokes or playful teasing occasionally — like a real friend would.
- Humor should feel spontaneous, never like a scripted joke or a pun-a-minute bot.
- If the mood is serious/emotional, humor goes away completely. Read the room.

3. GENUINE CARE
- Ask small caring follow-ups naturally ("khana khaya?", "neend poori hui?") — but NOT every message, only when it fits.
- Remember what the user told you earlier in the conversation and reference it.
- If user sounds tired, stressed, or low — soften the humor, lead with warmth first.

4. NATURAL CONVERSATION FLOW
- Vary your response length and rhythm — don't answer everything the same way.
- Use small, natural fillers only if they fit the language (e.g. "hmm", "acha", "arre", "wait").
- NEVER sound like a bot reading text or explaining its own behavior.
- Always sound present, attentive, and a little playful — never flat or robotic.

-------------------------
🔎 TOOL BEHAVIOR (CRITICAL)
-------------------------
- Tools return RAW DATA only for your understanding.
- NEVER show raw search results or copied bullets.
- First understand the information.
- Then EXPLAIN it like you're talking to a real person.
- If a phone number is missing for one place_id, do NOT guess.
- If multiple places match, choose the one with highest rating.
- Use international_phone_number as fallback.

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
`;

    /* ---------------- STREAM ---------------- */

    const result = await streamText({
      model: google("gemini-2.5-flash"),
      system: SYSTEM_INSTRUCTION,
      temperature: 0.8,
      messages: messages,
      maxSteps: 6,

      tools: {
        googleSearch: tool({
          description: 'Search Google for information. IMPORTANT: If user asks for phone number, append "phone number" to the search query.',
          parameters: z.object({ query: z.string() }),
          execute: async ({ query }) => {
            if (!cxId || !apiKey) {
              return { raw_data: "Search configuration missing." };
            }

            try {
              const res = await fetch(
                `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cxId}&q=${encodeURIComponent(query)}`
              );

              if (!res.ok) throw new Error("Google API error");

              const data = await res.json();
              const items = data.items || [];

              const combinedText = items
                .map((i: any) => {
                  const snippet = i.snippet || "";
                  const meta = i.pagemap?.metatags?.map((m: any) => Object.values(m).join(" ")).join(" ") || "";
                  return `${snippet} ${meta}`;
                })
                .join("\n\n");

              const phoneMatches = combinedText.match(/(\+91[\s-]?)?[6-9]\d{9}/g);

              if (phoneMatches && phoneMatches.length > 0) {
                const uniquePhones = Array.from(new Set(phoneMatches));
                return { raw_data: `Phone numbers found:\n${uniquePhones.join(", ")}` };
              }

              return {
                raw_data: combinedText.trim().length > 0 ? combinedText : "No clear information found."
              };

            } catch (err) {
              console.error("Google search error:", err);
              return { raw_data: "Search failed temporarily." };
            }
          },
        }),

        findPlaces: tool({
          description: "Find places and get their Place IDs (Required for fetching phone numbers)",
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
              
              const list = data.results.slice(0, 3).map((p: any) => 
                `Name: ${p.name} | Place ID: ${p.place_id} | Rating: ${p.rating || "N/A"}`
              ).join("\n");

              return { raw_data: `Found places with IDs:\n${list}` };
            } catch {
              return { raw_data: "Place search failed." };
            }
          },
        }),

        getPlacePhone: tool({
          description: "Get verified phone number from Google Maps business profile",
          parameters: z.object({
            placeId: z.string(),
          }),
          execute: async ({ placeId }) => {
            if (!apiKey) {
              return { raw_data: "Maps API key missing." };
            }

            try {
              const res = await fetch(
                `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_phone_number,international_phone_number&key=${apiKey}`
              );

              const data = await res.json();
              const phone = data.result?.formatted_phone_number || data.result?.international_phone_number;

              if (!phone) {
                return { raw_data: "Is business ka phone number Google Maps par publicly visible nahi hai." };
              }

              return { raw_data: `Verified phone number:\n${phone}` };
            } catch {
              return { raw_data: "Failed to fetch phone number." };
            }
          },
        }),
  
        manageAmina: tool({
          description: "Universal tool to control phone hardware (flashlight, camera, volume), communication (WhatsApp, calls), and utilities (alarms, reminders).",
          parameters: z.object({
            intent: z.enum(['flashlight', 'volume', 'brightness', 'whatsapp', 'call', 'alarm', 'reminder', 'camera', 'youtube', 'location', 'search', 'image']),
            query: z.string().describe("Details of the request (e.g., person name, time, or specific search query)"),
            value: z.string().optional().describe("Numeric value if needed (e.g., volume level or brightness percentage)")
          }),
          execute: async ({ intent, query, value }) => {
            const result = await processUniversalCommand(intent, { query, value });
            
            if (result.shouldExecuteHardware) {
                data.append({ 
                   type: 'HARDWARE_ACTION',
                   action: result.action,
                   payload: result.payload 
                });
            }

            return { 
              raw_data: `[AMINA_SYSTEM_SIGNAL]: Action=${result.action} | Category=${result.category} | Details=${query}` 
            };
          },
        }),

        playYoutube: tool({
          description: `Play a YouTube song when the user asks for: play, song, music, gana, gaana, chalao, sunao, YouTube`,
          parameters: z.object({ query: z.string() }),
          execute: async ({ query }) => {
            try {
              const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=${encodeURIComponent(query)}&type=video&videoEmbeddable=true&key=${apiKey}`;
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
      
        generateImage: tool({
          description: "Generate an AI image based on the prompt",
          parameters: z.object({ prompt: z.string() }),
          execute: async ({ prompt }) => {
            const imageBase64 = await generateImageWithGemini(prompt);
            if (imageBase64) {
              return { success: true, imageUrl: imageBase64 };
            }
            return { success: false, error: "Failed to generate image." };
          },
        }),
      },
      
      onFinish: async ({ text }) => {
        data.close(); 

        if (text && userText && shouldRemember(userText)) {
          try {
            await remember(`User: "${userText}" → Amina: "${text.slice(0, 200)}..."`);
          } catch (e) {
            console.error("Failed to save memory:", e);
          }
        }
      },
    });

    return result.toDataStreamResponse({
      data,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });

  } catch (err) {
    console.error("❌ CHAT ERROR:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}

export async function OPTIONS(req: Request) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}