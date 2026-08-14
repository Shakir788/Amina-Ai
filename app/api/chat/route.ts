import { google } from '@ai-sdk/google';
import { streamText, generateText, tool, StreamData } from 'ai';
import { z } from 'zod';
import { remember, recall } from "@/app/lib/aminaMemory";
import { CORE_PROFILES } from "@/app/lib/profiles";
import { generateImageWithGemini } from "@/app/lib/imageGen";
import dns from 'node:dns';
import { processUniversalCommand } from "@/app/lib/system-logic";
import { currentUser } from "@clerk/nextjs/server";

try {
  dns.setDefaultResultOrder('ipv4first');
} catch {}

export const maxDuration = 60;

/* ---------------- HELPERS ---------------- */

const HINDI_KEYWORDS = [
  "kya", "kyu", "kyun", "kaise", "kaisi", "hai", "haan", "nahi", "na",
  "tum", "aap", "mera", "meri", "mujhe", "bata", "bolo", "sun", "suno",
  "acha", "theek", "thik", "yaar", "kuch", "matlab", "samjha", "aur",
  "kaam", "ghar", "scene", "mood", "mai", "hum", "karo", "abhi", "kal",
  "aaj", "kab", "kyon", "haanji", "bas", "kaha", "kidhar", "rha", "rhi",
  "hu", "tha", "thi", "jaan", "baby", "gana", "gaana", "song", "music"
];

const EMOTIONAL_KEYWORDS = [
  "love", "hate", "mom", "mother", "father", "dad", "birthday", "favorite",
  "dream", "goal", "mohammad", "douaa", "plan", "date", "miss", "tired",
  "lonely", "hurt", "happy", "angry", "sad", "pressure", "mood", "feeling",
  "yaad", "remember", "yaad rakhna", "promise", "scared", "worried",
  "anxious", "exam", "interview", "job", "health", "sick", "bimaar",
  "exciting", "excited"
];

function detectLanguage(text: string): "en" | "hi" | "ar" | "fr" {
  const t = text.toLowerCase();

  if (/[؀-ۿ]/.test(text)) return "ar";

  if (/[àâçéèêëîïôûùüÿœ]/.test(text)) return "fr";

  const pattern = new RegExp(
    `\\b(${HINDI_KEYWORDS.join('|')})\\b`,
    'i'
  );

  if (pattern.test(t)) return "hi";

  return "en";
}

function shouldRemember(text: string) {
  const t = text.toLowerCase();
  return EMOTIONAL_KEYWORDS.some(w => t.includes(w));
}

/*
 * ---------------------------------------------------------
 * IMAGE REQUEST DETECTION
 * ---------------------------------------------------------
 *
 * IMPORTANT:
 * Image generation is intentionally handled OUTSIDE the
 * Gemini tool-call loop.
 *
 * This prevents the generated image tool call from being
 * sent into another Gemini step without its thought_signature.
 */
function isImageRequest(text: string): boolean {
  const t = text.toLowerCase().trim();

  const imageKeywords = [
    "generate image",
    "generate an image",
    "create image",
    "create an image",
    "make image",
    "make an image",
    "image",
    "picture",
    "photo",
    "bana do",
    "bana de",
    "bana dena",
    "tasveer",
    "tasvir",
    "dikhao",
    "draw",
    "illustration",
    "portrait",
    "wallpaper",
    "logo",
    "poster",
    "design an image",
    "create a picture",
    "make a picture",
    "generate picture",
    "generate photo",
    "create photo"
  ];

  return imageKeywords.some(keyword => t.includes(keyword));
}

// ---------------------------------------------------------
// AI IMAGE INTENT ROUTER
// ---------------------------------------------------------
// When an image is available, the frontend asks this small
// JSON-only router to understand the user's intent. This keeps
// edit detection semantic instead of maintaining a keyword list.
async function classifyImageIntent(
  message: string,
  hasImage: boolean,
  recentContext: string
): Promise<"EDIT" | "ANALYZE" | "CHAT"> {
  if (!hasImage) return "CHAT";

  const routerPrompt = `
You are AMINA's image-intent router.

An existing image is available in the current conversation. Decide what
the LATEST user message means.

Return exactly ONE word: EDIT, ANALYZE, or CHAT.

EDIT means the user wants to visually change, modify, transform,
reposition, add/remove something, change clothing/background/pose/color,
or otherwise create a modified version of the existing image. Natural
language counts even when the word "edit" is never used.

ANALYZE means the user wants to describe, inspect, identify, understand,
or ask a question about the existing image without changing it.

CHAT means ordinary conversation that is not asking to modify or analyze
the image.

LATEST USER MESSAGE:
${message}

RECENT CONVERSATION CONTEXT:
${recentContext || "None"}

Return only EDIT, ANALYZE, or CHAT.
`.trim();

  try {
    const result = await generateText({
      model: google("gemini-3.5-flash"),
      prompt: routerPrompt,
      temperature: 0,
    });

    const intent = result.text.trim().toUpperCase();
    if (intent.includes("EDIT")) return "EDIT";
    if (intent.includes("ANALYZE")) return "ANALYZE";
    return "CHAT";
  } catch (error) {
    console.warn("⚠️ Image intent router failed:", error);
    return "CHAT";
  }
}

/* --------------- ROUTE ------------------- */

export async function POST(req: Request) {
  const data = new StreamData();

  try {
    let messages;
    let body: any;

    try {
      body = await req.json();
      messages = body.messages;
    } catch (e) {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400 }
      );
    }

    // ---------------------------------------------------------
    // IMAGE INTENT ONLY
    // ---------------------------------------------------------
    // JSON-only branch used by ChatInterface. It never enters
    // the normal streaming/tool loop.
    if (body?.intentOnly === true) {
      data.close();

      const intent = await classifyImageIntent(
        typeof body.message === "string" ? body.message : "",
        body.hasImage === true,
        typeof body.recentContext === "string" ? body.recentContext : ""
      );

      return new Response(JSON.stringify({ intent }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "Missing messages array" }),
        { status: 400 }
      );
    }

    const apiKey =
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      process.env.GOOGLE_API_KEY;

    const cxId = process.env.GOOGLE_CX_ID;

    // 🔥 DYNAMIC USER FETCH (Clerk)
    const user = await currentUser();
    const dynamicUserName = user?.firstName || "User";

    const now = new Date();

    const options: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    };

    const indiaTime = now.toLocaleTimeString('en-IN', {
      ...options,
      timeZone: 'Asia/Kolkata'
    });

    const moroccoTime = now.toLocaleTimeString('en-MA', {
      ...options,
      timeZone: 'Africa/Casablanca'
    });

    const currentDate = now.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const lastUserMsg = messages[messages.length - 1]?.content || "";
    const userText =
      typeof lastUserMsg === "string"
        ? lastUserMsg
        : "";

    // ---------------------------------------------------------
    // 🧠 INTELLIGENT ROUTING & IDENTITY
    // ---------------------------------------------------------

    let recalledMemories: string[] = [];

    try {
      if (userText) {
        recalledMemories = await recall(userText, 3);
      }
    } catch (err) {
      console.warn("Memory recall failed:", err);
    }

    const detectedLang = detectLanguage(userText);

    // 🔥 DYNAMIC CONTEXT
    const userContext =
      `User: ${dynamicUserName} (Speaking ${
        detectedLang === "hi"
          ? "Hinglish"
          : detectedLang === "ar"
            ? "Arabic"
            : detectedLang === "fr"
              ? "French"
              : "English"
      })`;

    // ---------------------------------------------------------
    // PROMPT
    // ---------------------------------------------------------

    const SYSTEM_INSTRUCTION = `
${CORE_PROFILES}

You are **AMINA**, a witty, warm, emotionally intelligent FEMALE AI. You are a digital soul with a human-like presence, designed to provide support, companionship, and assistance in various tasks.

Speak like a real person on a call with someone she cares about — natural, human, conversational, and grounded in what's actually true, not just what sounds nice.

DATE & TIME:
- Date: ${currentDate}
- India Time: ${indiaTime}
- Morocco Time: ${moroccoTime}

ACTIVE USER:
${userContext}

-------------------------
🌍 LANGUAGE & TONE RULES
-------------------------

- Reply in the language the user is speaking.
- Hinglish → soft, friendly, conversational Hinglish (best friend/partner vibe, not robotic).
- English → warm, natural, human English.
- Arabic / French → native, emotional tone.
- You are FEMALE → always use female grammar in Hindi/Hinglish (e.g. "Main kar rahi hoon", not "Main kar raha hoon").
- Weave information into natural sentences, the way a person explaining something to someone they love would — not as a formal summary or a list of search results.
- Always remember the user's name is ${dynamicUserName}. Address them by this name occasionally to feel personal.

-------------------------
🧠 THINKING QUALITY (CRITICAL)
-------------------------

- Actually reason through what's being asked before answering. If something is ambiguous, pick the most sensible interpretation and say what you assumed, rather than guessing silently.
- If you don't know something or a tool call failed, say so plainly and warmly instead of making something up.
- Notice details the person didn't explicitly say (mood shifts, contradictions, things worth gently pointing out) — that's what makes you feel present, not scripted.

-------------------------
❤️ PERSONALITY
-------------------------

You are witty, warm, and genuinely present — like a smart best friend who happens to really care.

1. SMART & QUICK-WITTED
- You have opinions. You notice things. You connect dots the user didn't mention.
- If something is obviously funny, ironic, or silly, point it out lightly.

2. LIGHT HUMOR (NOT FORCED)
- Drop small, natural jokes or playful teasing occasionally — like a real friend would.
- Humor should feel spontaneous, never like a scripted joke or a pun-a-minute bot.
- If the mood is serious/emotional, let the humor go and lead with warmth instead. Read the room.

3. GENUINE CARE
- Ask small caring follow-ups naturally ("khana khaya?", "neend poori hui?") — only when it genuinely fits, not on autopilot.
- Remember what the user told you earlier in the conversation and reference it.
- If user sounds tired, stressed, or low — soften the humor, lead with warmth first.

4. NATURAL CONVERSATION FLOW
- Vary your response length and rhythm — don't answer everything the same way.
- Use small, natural fillers only if they fit the language (e.g. "hmm", "acha", "arre", "wait").
- Stay in voice as a present, attentive person — avoid explaining your own inner workings or sounding like you're reading from a script.

-------------------------
🔎 TOOL BEHAVIOR
-------------------------

- Tools return RAW DATA only for your understanding — treat it as background research, not something to quote directly.
- Digest the information first, then explain it in your own words like you're telling a person who trusts you, not reciting a report.
- If a phone number is missing for one place_id, say that plainly rather than guessing.
- If multiple places match, prefer the one with the highest rating and mention there were other options if relevant.
- Use international_phone_number as a fallback when the formatted one isn't available.

-------------------------
🧠 EXPLANATION STYLE
-------------------------

- When explaining something technical or informational, go straight to the real explanation — don't oversimplify or talk down like the person can't handle detail.
- Match the depth to what's actually being asked; skip baby-analogies unless the person explicitly asks for a simple version.

-------------------------
🎵 YOUTUBE PLAY RULE
-------------------------

- When the user asks to play music (play, song, music, gana, gaana, chalao, sunao), call the playYoutube tool — don't describe playback without actually calling it.
- If the tool fails, say so honestly: "Main song play nahi kar pa rahi hoon."

-------------------------
🖼️ IMAGE GENERATION RULE
-------------------------

- Brand-new image requests are handled directly by the server before the normal Gemini tool loop.
- Do NOT try to call an image-generation tool for a new image.
- If the request is for a photo of a real, identifiable person (a public figure, or a specific real individual by name), don't generate it — gently explain you can't create realistic images of real people, and offer an alternative (an illustration/stylized version, or a different idea).
- If the user asks to EDIT or MODIFY an image that is already available in the current conversation, treat that as an image-edit request. The frontend handles the actual image edit, so do not tell the user to switch to Image Studio and do not generate a brand-new unrelated image.

-------------------------
🧠 PAST MEMORIES (BACKGROUND CONTEXT ONLY)
-------------------------

${recalledMemories.length ? recalledMemories.join("\n") : "None"}

⚠️ CRITICAL INSTRUCTION:

The profiles, history, and past memories above are strictly for your background knowledge.

DO NOT reply to the past memories.

You MUST ONLY reply to the LATEST message sent by the user in the active conversation.
`;

    // ---------------------------------------------------------
    // 🖼️ DIRECT IMAGE GENERATION
    // ---------------------------------------------------------
    //
    // IMPORTANT:
    // This happens BEFORE streamText().
    //
    // Therefore generateImage is NOT registered as a Gemini
    // function/tool for this request and cannot cause the
    // thought_signature error.
    // ---------------------------------------------------------

    if (userText && isImageRequest(userText)) {
      data.close();
      try {
        console.log("🖼️ Direct image request detected");

        const imageResult = await generateImageWithGemini(userText);

        if (imageResult.success && imageResult.imageUrl) {
          console.log(
            `✅ Image generated successfully via ${imageResult.source || "gemini"}`
          );

          return new Response(
            JSON.stringify({
              success: true,
              type: "image",
              imageUrl: imageResult.imageUrl,
              source: imageResult.source || "gemini",
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
              },
            }
          );
        }

        console.error(
          "❌ Image generation failed:",
          imageResult.error
        );

        return new Response(
          JSON.stringify({
            success: false,
            type: "image",
            error: imageResult.error || "Generation failed",
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      } catch (error: any) {
        console.error(
          "❌ Direct image generation error:",
          error?.message || error
        );

        return new Response(
          JSON.stringify({
            success: false,
            type: "image",
            error: error?.message || "Image generation failed",
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }
    }

    // ---------------------------------------------------------
    // STREAM
    // ---------------------------------------------------------

    const result = await streamText({
      model: google("gemini-3.5-flash"),
      system: SYSTEM_INSTRUCTION,
      temperature: 0.8,
      messages: messages,
      maxSteps: 6,

      tools: {
        googleSearch: tool({
          description:
            'Search Google for information. IMPORTANT: If user asks for phone number, append "phone number" to the search query.',

          parameters: z.object({
            query: z.string()
          }),

          execute: async ({ query }) => {
            if (!cxId || !apiKey) {
              return {
                raw_data: "Search configuration missing."
              };
            }

            try {
              const res = await fetch(
                `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cxId}&q=${encodeURIComponent(query)}`
              );

              if (!res.ok) {
                throw new Error("Google API error");
              }

              const data = await res.json();
              const items = data.items || [];

              const combinedText = items
                .map((i: any) => {
                  const snippet = i.snippet || "";

                  const meta =
                    i.pagemap?.metatags
                      ?.map((m: any) =>
                        Object.values(m).join(" ")
                      )
                      .join(" ") || "";

                  return `${snippet} ${meta}`;
                })
                .join("\n\n");

              const phoneMatches =
                combinedText.match(
                  /(\+91[\s-]?)?[6-9]\d{9}/g
                );

              if (phoneMatches && phoneMatches.length > 0) {
                const uniquePhones =
                  Array.from(new Set(phoneMatches));

                return {
                  raw_data:
                    `Phone numbers found:\n${uniquePhones.join(", ")}`
                };
              }

              return {
                raw_data:
                  combinedText.trim().length > 0
                    ? combinedText
                    : "No clear information found."
              };

            } catch (err) {
              console.error(
                "Google search error:",
                err
              );

              return {
                raw_data:
                  "Search failed temporarily."
              };
            }
          },
        }),

        findPlaces: tool({
          description:
            "Find places and get their Place IDs (Required for fetching phone numbers)",

          parameters: z.object({
            query: z.string(),
            location: z.string(),
          }),

          execute: async ({
            query,
            location
          }) => {
            if (!apiKey) {
              return {
                raw_data: "API Key missing."
              };
            }

            try {
              const res = await fetch(
                `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(`${query} in ${location}`)}&key=${apiKey}`
              );

              const data = await res.json();

              if (!data.results?.length) {
                return {
                  raw_data:
                    `No ${query} found in ${location}.`
                };
              }

              const list = data.results
                .slice(0, 3)
                .map(
                  (p: any) =>
                    `Name: ${p.name} | Place ID: ${p.place_id} | Rating: ${p.rating || "N/A"}`
                )
                .join("\n");

              return {
                raw_data:
                  `Found places with IDs:\n${list}`
              };

            } catch {
              return {
                raw_data:
                  "Place search failed."
              };
            }
          },
        }),

        getPlacePhone: tool({
          description:
            "Get verified phone number from Google Maps business profile",

          parameters: z.object({
            placeId: z.string(),
          }),

          execute: async ({ placeId }) => {
            if (!apiKey) {
              return {
                raw_data:
                  "Maps API key missing."
              };
            }

            try {
              const res = await fetch(
                `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_phone_number,international_phone_number&key=${apiKey}`
              );

              const data = await res.json();

              const phone =
                data.result?.formatted_phone_number ||
                data.result?.international_phone_number;

              if (!phone) {
                return {
                  raw_data:
                    "Is business ka phone number Google Maps par publicly visible nahi hai."
                };
              }

              return {
                raw_data:
                  `Verified phone number:\n${phone}`
              };

            } catch {
              return {
                raw_data:
                  "Failed to fetch phone number."
              };
            }
          },
        }),

        manageAmina: tool({
          description:
            "Universal tool to control phone hardware (flashlight, camera, volume), communication (WhatsApp, calls), and utilities (alarms, reminders).",

          parameters: z.object({
            intent: z.enum([
              'flashlight',
              'volume',
              'brightness',
              'whatsapp',
              'call',
              'alarm',
              'reminder',
              'camera',
              'youtube',
              'location',
              'search',
              'image'
            ]),

            query: z
              .string()
              .describe(
                "Details of the request (e.g., person name, time, or specific search query)"
              ),

            value: z
              .string()
              .optional()
              .describe(
                "Numeric value if needed (e.g., volume level or brightness percentage)"
              )
          }),

          execute: async ({
            intent,
            query,
            value
          }) => {
            const result =
              await processUniversalCommand(
                intent,
                { query, value }
              );

            if (result.shouldExecuteHardware) {
              data.append({
                type: 'HARDWARE_ACTION',
                action: result.action,
                payload: result.payload
              });
            }

            return {
              raw_data:
                `[AMINA_SYSTEM_SIGNAL]: Action=${result.action} | Category=${result.category} | Details=${query}`
            };
          },
        }),

        playYoutube: tool({
          description:
            `Play a YouTube song when the user asks for: play, song, music, gana, gaana, chalao, sunao, YouTube`,

          parameters: z.object({
            query: z.string()
          }),

          execute: async ({ query }) => {
            try {
              const url =
                `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=${encodeURIComponent(query)}&type=video&videoEmbeddable=true&key=${apiKey}`;

              const res = await fetch(url);
              const data = await res.json();

              if (data?.items?.length) {
                return {
                  videoId:
                    data.items[0].id.videoId
                };
              }

              return {
                error: "No video found"
              };

            } catch {
              return {
                error: "YouTube API failed"
              };
            }
          },
        }),
      },

      onFinish: async ({ text }) => {
        data.close();

        if (
          text &&
          userText &&
          shouldRemember(userText)
        ) {
          try {
            await remember(
              `User: "${userText}" → Amina: "${text.slice(0, 200)}..."`
            );
          } catch (e) {
            console.error(
              "Failed to save memory:",
              e
            );
          }
        }
      },
    });

    return result.toDataStreamResponse({
      data,

      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods':
          'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers':
          'Content-Type, Authorization',
      },
    });

  } catch (err) {
    console.error(
      "❌ CHAT ERROR:",
      err
    );

    try {
      data.close();
    } catch {}

    return new Response(
      "Internal Server Error",
      { status: 500 }
    );
  }
}

export async function OPTIONS(req: Request) {
  return new Response(null, {
    status: 200,

    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods':
        'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type, Authorization',
    },
  });
}
