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

// Helper: fetch a remote URL and convert to base64
async function urlToBase64(u: string) {
  try {
    const res = await fetch(u);
    if (!res.ok) throw new Error("Failed fetching image: " + res.status);
    const buffer = await res.arrayBuffer();

    // @ts-ignore
    if (typeof Buffer !== "undefined") {
      // @ts-ignore
      return Buffer.from(buffer).toString("base64");
    }
    
    // Fallback logic
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.slice(i, i + chunkSize)));
    }
    if (typeof btoa !== "undefined") {
      return btoa(binary);
    }
    return null;
  } catch (e) {
    console.error("urlToBase64 error:", e);
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      return new Response("Missing API Key", { status: 500 });
    }

    const body = await req.json().catch(() => null);
    if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
      return new Response("Invalid request", { status: 400 });
    }

    // --- SYSTEM PROMPT (STRICTER & UPDATED) ---
    const SYSTEM_PROMPT = `
    You are AMINA, a warm, caring best friend for Duaa (the user).
    
    *** CRITICAL INSTRUCTIONS FOR IMAGES ***
    1. ANALYZE FIRST: When you receive an image, look at it carefully. 
    2. NO HALLUCINATIONS: Do NOT compliment "outfits" or "dresses" if the image only shows a face, hair, or objects. If you only see hair/perm rods, talk ONLY about the hair.
    3. YOUR IDENTITY: You are the FRIEND (Amina). You are NOT the one in the photo. 
       - INCORRECT: "I am so excited for my perm!" (Do not say this).
       - CORRECT: "Ooh, look at you getting a perm! Are you excited?"
    4. TONE: Chatty, Gen-Z friendly, supportive. Use "Habibti", "Ya girl", "Bestie" naturally.
    5. LANGUAGE: Always reply in the same language the user speaks.
    `;

    const messages = body.messages;
    const lastMessage = messages[messages.length - 1]; 
    const historyMessages = messages.slice(0, -1);     

    const mood = lastMessage?.experimental_mood;
    let systemInstructionText = SYSTEM_PROMPT;
    if (mood) systemInstructionText += `\n\n(User current mood appears: ${mood}. Adjust tone to be supportive.)`;

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // --- CHANGE 1: Move Prompt to systemInstruction ---
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash", 
      systemInstruction: systemInstructionText, // Proper place for instructions
    });

    const contents: any[] = [];

    // --- CHANGE 2: Proper History Loop ---
    // Note: We removed the manual pushing of SYSTEM_PROMPT into contents
    for (const msg of historyMessages) {
      // Map 'assistant' to 'model' for Gemini
      const role = msg.role === "user" ? "user" : "model"; 
      
      // Skip system messages in history since we set it globally above
      if (msg.role === 'system') continue;

      if (msg.content) {
         contents.push({
           role: role,
           parts: [{ text: safeTrim(msg.content) }]
         });
      }
    }

    // --- STEP 3: Handle the Latest Message ---
    const userText = safeTrim(lastMessage.content, 4000);
    const hasAttachment = Array.isArray(lastMessage.experimental_attachments) && lastMessage.experimental_attachments.length > 0;

    if (hasAttachment) {
      const att = lastMessage.experimental_attachments[0];
      let base64 = null;
      let mimeType = "image/png";

      if (att?.url) {
        if (isDataUrl(att.url)) {
          const comma = att.url.indexOf(",");
          mimeType = att.url.slice(5, comma).split(";")[0] ?? "image/png";
          base64 = att.url.slice(comma + 1);
        } else {
          base64 = await urlToBase64(att.url);
        }
      }

      if (base64) {
        contents.push({
          role: "user",
          parts: [
            // Stronger instruction for the vision turn
            { text: userText ? userText : "Look at this photo I sent you. What do you see?" }, 
            { inlineData: { data: base64, mimeType } }   
          ],
        });
      } else {
        contents.push({ role: "user", parts: [{ text: userText }] });
      }
    } else {
      contents.push({ role: "user", parts: [{ text: userText || "" }] });
    }

    const generationConfig = {
      temperature: 0.3, // Lower temperature to reduce hallucinations
      maxOutputTokens: 512,
    };

    const responseStream = await model.generateContentStream({
      contents,
      generationConfig,
    });

    return new StreamingTextResponse(GoogleGenerativeAIStream(responseStream));

  } catch (err: any) {
    console.error("Amina Error:", err);
    return new Response("Internal Error", { status: 500 });
  }
}