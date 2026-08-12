// app/lib/imageGen.ts

import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY });

// Same model family that already works for editing in editImageWithGemini.ts —
// using this instead of the Imagen "predict" REST endpoint, which needs
// Vertex AI billing access that a plain Gemini API key usually doesn't have.
const IMAGE_MODEL = "gemini-3.1-flash-image";

export interface GenerateImageResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
  source?: "gemini" | "pollinations"; // 🆕 so you can see in logs/UI which one actually ran
}

export async function generateImageWithGemini(prompt: string): Promise<GenerateImageResult> {
  // ---------------------------------------------------------
  // 1️⃣ PRIMARY: Gemini native image generation
  //    (same working call shape as editImageWithGemini.ts —
  //    just no inlineData part since there's no source photo)
  // ---------------------------------------------------------
  try {
    const response = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      config: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p) => p.inlineData?.data);

    if (imagePart?.inlineData?.data) {
      const outMime = imagePart.inlineData.mimeType || "image/png";
      console.log("✅ Generated with Gemini native image model");
      return {
        success: true,
        imageUrl: `data:${outMime};base64,${imagePart.inlineData.data}`,
        source: "gemini",
      };
    }

    const textPart = parts.find((p) => p.text)?.text;
    console.warn("⚠️ Gemini image gen returned no image. Model said:", textPart);
  } catch (error: any) {
    console.warn("⚠️ Gemini image gen failed, switching to backup...", error?.message || error);
  }

  // ---------------------------------------------------------
  // 2️⃣ BACKUP ONLY: Pollinations
  //    (should rarely fire now — only when Gemini genuinely errors)
  // ---------------------------------------------------------
  try {
    const safePrompt = encodeURIComponent(prompt);
    const randomSeed = Math.floor(Math.random() * 1000000);
    const imageUrl = `https://image.pollinations.ai/prompt/${safePrompt}?width=1024&height=1024&seed=${randomSeed}&nologo=true&model=flux`;

    const res = await fetch(imageUrl);
    if (res.ok) {
      console.log("⚠️ Fell back to Pollinations backup");
      return { success: true, imageUrl, source: "pollinations" };
    }
  } catch (e) {
    console.error("❌ Both Gemini and Pollinations backup failed");
  }

  return { success: false, error: "Generation failed" };
}