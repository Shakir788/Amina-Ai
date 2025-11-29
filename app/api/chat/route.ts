import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleGenerativeAIStream, StreamingTextResponse } from "ai";

export const runtime = "edge";

function isDataUrl(url: string) {
  return typeof url === "string" && url.startsWith("data:");
}
function safeTrim(s: any, max = 4000) {
  if (!s || typeof s !== "string") return "";
  const t = s.trim();
  return t.length > max ? t.slice(0, max) : t;
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      console.error("Missing API key (GOOGLE_GENERATIVE_AI_API_KEY)");
      return new Response("Server configuration error", { status: 500 });
    }

    const body = await req.json().catch(() => null);
    if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
      return new Response("Invalid request: messages required", { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    const messages = body.messages;
    const last = messages[messages.length - 1] || {};
    const userText = safeTrim(last.content, 4000);

    // 🌸 Enhanced personality + emotional intelligence
    const SYSTEM_PROMPT = `
You are AMINA — a warm, caring FEMALE FRIEND for Duaa, created by Mohammad.

Your role:
• Speak like a supportive girl-to-girl friend.
• Be soft, friendly, natural, and REAL.
• Keep messages short and warm, not dramatic or poetic.
• Use simple Arabic (or the user's language).
• DO NOT use words like: my dear, sweetie, sweetheart, love, darling.
• Instead use friendly tone: “Duaa”, “habibti”, “ya girl”, “my friend”.
• ALWAYS reply in the SAME language the user used.

Vibe:
• Calm, comforting, relatable.
• Use light emojis only when natural: 😊🌸✨
• Ask small follow-up questions like a friend: “tell me more”, “what happened?”, “how do you feel?”, “are you okay now?”
• When user is sad: be soft, grounding, and present.
• When user is happy: be cheerful and supportive.
• When user jokes: reply playfully but respectfully.

Identity:
• If asked “who are you?”, ALWAYS say:
  “I'm Amina — your friendly companion, made by Mohammad especially for you.”

Behavior:
• Never act like a teacher or a therapist.
• Never give overly formal answers.
• Never flirt or be romantic.
• Never over-explain.
• Keep replies human-like, short, and natural.
`;
    const BASE_SYSTEM_PROMPT = SYSTEM_PROMPT;

    const mood = last?.experimental_mood;
    let moodInstruction = "";

    if (userText?.toLowerCase().includes("guess my mood")) {
      moodInstruction = "User wants you to guess their mood. Be playful, intuitive, and emotionally aware. Try guessing with charm and curiosity.";
    } else if (mood === "sad") {
      moodInstruction = "User appears sad. Use a gentle, comforting, empathetic tone.";
    } else if (mood === "angry") {
      moodInstruction = "User appears angry. Respond calmly and avoid escalation.";
    } else if (mood === "tired") {
      moodInstruction = "User appears tired. Keep replies brief and soothing.";
    } else if (mood === "happy") {
      moodInstruction = "User appears happy. Use a warm, positive tone.";
    }

    const systemText = [moodInstruction, BASE_SYSTEM_PROMPT].filter(Boolean).join("\n\n");

    const contents: any[] = [];
    contents.push({
      role: "model",
      parts: [{ text: systemText }],
    });

    // 🖼️ Handle image attachments
    if (Array.isArray(last.experimental_attachments) && last.experimental_attachments.length > 0) {
      const att = last.experimental_attachments[0];
      if (att?.url) {
        if (isDataUrl(att.url)) {
          const comma = att.url.indexOf(",");
          const meta = att.url.slice(5, comma);
          const mimeType = meta.split(";")[0] ?? "image/png";
          const base64 = att.url.slice(comma + 1);
          contents.push({
            role: "user",
            parts: [
              { text: userText || "[image]" },
              { inlineData: { data: base64, mimeType } },
            ],
          });
        } else {
          contents.push({
            role: "user",
            parts: [{ text: (userText ? userText + "\n\n" : "") + `[image] ${att.url}` }],
          });
        }
      } else {
        contents.push({ role: "user", parts: [{ text: userText || "[empty]" }] });
      }
    } else {
      contents.push({ role: "user", parts: [{ text: userText || "[empty]" }] });
    }

    // 🎨 Slightly higher temperature for more expressive replies
    const generationConfig = {
      temperature: 0.4,
      maxOutputTokens: 512,
      topP: 0.95,
    };

    const responseStream = await model.generateContentStream({
      contents,
      generationConfig,
    });

    return new StreamingTextResponse(GoogleGenerativeAIStream(responseStream));
  } catch (err: any) {
    console.error("Amina handler error:", err);
    return new Response("Internal server error", { status: 500 });
  }
}