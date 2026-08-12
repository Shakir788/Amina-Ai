// app/lib/editImageWithGemini.ts

import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY });

// 🔥 THE UPGRADE: Changed from "flash" (basic) to "pro" (premium photorealistic)
const IMAGE_MODEL = "gemini-3-pro-image";

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
      // ✅ Tells the model we specifically want an IMAGE back
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