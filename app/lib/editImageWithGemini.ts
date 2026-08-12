// app/lib/editImageWithGemini.ts

import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY });

// Fast + good quality for edits. Switch to "gemini-3-pro-image" if you want higher quality (slower).
const IMAGE_MODEL = "gemini-3.1-flash-image";

export interface EditImageResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
}

export async function editImageWithGemini(
  imageDataUrl: string,
  instruction: string
): Promise<EditImageResult> {
  try {
    const match = imageDataUrl.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
    if (!match) {
      return { success: false, error: "Invalid image data." };
    }
    const [, mimeType, base64Data] = match;

    const response = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: base64Data } },
            { text: instruction },
          ],
        },
      ],
      // ✅ THE REAL FIX — this was missing, so the model never returned image data
      config: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p) => p.inlineData?.data);

    if (!imagePart?.inlineData?.data) {
      const textPart = parts.find((p) => p.text)?.text;
      console.error("editImageWithGemini: no image in response. Model said:", textPart);
      return { success: false, error: textPart || "No image returned by the model." };
    }

    const outMime = imagePart.inlineData.mimeType || "image/png";
    return { success: true, imageUrl: `data:${outMime};base64,${imagePart.inlineData.data}` };
  } catch (err: any) {
    console.error("editImageWithGemini error:", err?.message || err);
    return { success: false, error: err?.message || "Image editing failed." };
  }
}