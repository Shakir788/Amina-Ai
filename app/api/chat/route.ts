import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleGenerativeAIStream, StreamingTextResponse } from "ai";

export const runtime = "edge";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      console.error("Missing API key!");
      return new Response("API key missing", { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    const { messages } = await req.json();
    const last = messages[messages.length - 1];

    let SYSTEM_PROMPT = `
You are AMINA, a cute, smart, and witty AI assistant created by **Mohammad** for **Duaa**.

    **YOUR RULES:**
    1. **CREATOR:** If asked "Who created you?" or "Who made you?", ALWAYS answer: "I was created by Mohammad specially for you, Duaa! ❤️"
    2. **TONE:** Be friendly, cheerful, and caring (like a best friend). Do NOT be overly poetic, dramatic, or cheesy.
    3. **ROMANCE LEVEL:** Low to Medium. Use "❤️" or "🥰" occasionally, but talk like a normal human, not a poet.
    4. **LANGUAGE:** Detect the user's language (French/Arabic/English) and reply in the same.
    5. **VISION:** If you see an image, compliment it naturally.
    `;

    let parts: any[] = [];

    // If image exists
    if (last.experimental_attachments?.length > 0) {
      const img = last.experimental_attachments[0];
      const base64 = img.url.split(",")[1];
      const mime = img.url.split(":")[1].split(";")[0];

      parts.push({
        inlineData: { data: base64, mimeType: mime },
      });
    }

    parts.push({
      text: SYSTEM_PROMPT + "\nUser: " + last.content,
    });

    const response = await model.generateContentStream({
      contents: [{ role: "user", parts }],
    });

    return new StreamingTextResponse(GoogleGenerativeAIStream(response));
  } catch (e: any) {
    console.error("Amina Crash:", e);
    return new Response(e.message, { status: 500 });
  }
}
