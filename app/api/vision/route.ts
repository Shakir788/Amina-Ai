import { google } from "@ai-sdk/google";
import { generateText, CoreMessage } from "ai"; // 🔥 Change 1: 'generateText'

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { messages, data } = await req.json();

    // 🕵️‍♂️ TRIPLE CHECK FOR IMAGE
    let base64Image = data?.image;

    if (!base64Image) {
        const lastMessage = messages[messages.length - 1];
        if (Array.isArray(lastMessage.content)) {
            const imagePart = lastMessage.content.find((c: any) => c.type === 'image');
            if (imagePart) base64Image = imagePart.image;
        }
    }

    if (!base64Image) {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage?.experimental_attachments?.length > 0) {
            base64Image = lastMessage.experimental_attachments[0].url;
        }
    }

    if (!base64Image) {
        return new Response(JSON.stringify({ text: "I can't see the image. Upload again?" }), { status: 200 });
    }

    // 🧠 MESSAGE CONSTRUCTION
    const lastUserMessage = messages[messages.length - 1];
    let promptText = "Analyze this image";
    if (typeof lastUserMessage.content === 'string') promptText = lastUserMessage.content;

    const coreMessages: CoreMessage[] = [
        {
            role: 'user',
            content: [
                { type: 'text', text: promptText },
                { type: 'image', image: base64Image }
            ]
        }
    ];

    const SYSTEM_INSTRUCTION = `
    ROLE: You are the visual cortex (eyes) of an AI assistant named Amina.
    TASK: Analyze the provided image objectively.
    RULES:
    - Start directly with the description.
    - NO raw JSON formatting. Just plain, clear text.
    - IF LOGO/UI: Describe design & colors.
    - IF FACE: Describe expression & context.
    `;

    // 🔥 Change 2: Use 'generateText' instead of stream
    // Ye pura text ek baar me return karega (No weird 0:"...")
    const result = await generateText({
      model: google("gemini-2.5-pro"),
      system: SYSTEM_INSTRUCTION,
      messages: coreMessages, 
      temperature: 0.2,
    });

    // 🔥 Change 3: Return Simple JSON
    return Response.json({ text: result.text });

  } catch (err) {
    console.error("❌ VISION ROUTE ERROR:", err);
    return Response.json({ text: "Internal Vision Error" }, { status: 500 });
  }
}