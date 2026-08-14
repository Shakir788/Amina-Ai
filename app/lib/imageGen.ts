// app/lib/imageGen.ts

import { GoogleGenAI } from "@google/genai";

/*
 * ---------------------------------------------------------
 * GOOGLE GEMINI CLIENT
 * ---------------------------------------------------------
 */

const apiKey =
  process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
  process.env.GOOGLE_API_KEY;

const ai = new GoogleGenAI({
  apiKey,
});

/*
 * ---------------------------------------------------------
 * IMAGE MODEL
 * ---------------------------------------------------------
 *
 * Native Gemini image generation.
 *
 * This is intentionally kept separate from the Gemini
 * chat/tool-calling flow in route.ts.
 *
 * That separation prevents image generation from becoming
 * part of another Gemini function-call step where a
 * thought_signature may be required.
 */

const IMAGE_MODEL = "gemini-3.1-flash-image";

/*
 * ---------------------------------------------------------
 * RESULT TYPE
 * ---------------------------------------------------------
 */

export interface GenerateImageResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
  source?: "gemini" | "pollinations";
}

/*
 * ---------------------------------------------------------
 * GEMINI NATIVE IMAGE GENERATION
 * ---------------------------------------------------------
 */

export async function generateImageWithGemini(
  prompt: string
): Promise<GenerateImageResult> {

  // -------------------------------------------------------
  // Basic validation
  // -------------------------------------------------------

  if (!prompt || !prompt.trim()) {
    return {
      success: false,
      error: "Image prompt is empty.",
    };
  }

  if (!apiKey) {
    console.error(
      "❌ Gemini image generation: Google API key is missing."
    );

    // Continue to Pollinations fallback below.
  } else {

    // -----------------------------------------------------
    // 1️⃣ PRIMARY: GEMINI NATIVE IMAGE GENERATION
    // -----------------------------------------------------

    try {
      console.log(
        `🖼️ Gemini image generation started using ${IMAGE_MODEL}`
      );

      const response = await ai.models.generateContent({
        model: IMAGE_MODEL,

        contents: [
          {
            role: "user",
            parts: [
              {
                text: prompt.trim(),
              },
            ],
          },
        ],

        config: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      });

      const parts =
        response.candidates?.[0]?.content?.parts ?? [];

      /*
       * Gemini may return both text and image parts.
       *
       * We only need the first inline image.
       */

      const imagePart = parts.find(
        (part) => part.inlineData?.data
      );

      if (imagePart?.inlineData?.data) {
        const imageData =
          imagePart.inlineData.data;

        const mimeType =
          imagePart.inlineData.mimeType ||
          "image/png";

        console.log(
          "✅ Generated with Gemini native image model"
        );

        return {
          success: true,

          imageUrl:
            `data:${mimeType};base64,${imageData}`,

          source: "gemini",
        };
      }

      /*
       * Gemini responded successfully but didn't return
       * an actual image.
       */

      const textPart = parts.find(
        (part) => part.text
      )?.text;

      console.warn(
        "⚠️ Gemini image generation returned no image.",
        textPart
          ? `Model response: ${textPart}`
          : ""
      );

    } catch (error: unknown) {

      const message =
        error instanceof Error
          ? error.message
          : String(error);

      console.warn(
        "⚠️ Gemini image generation failed. Switching to backup...",
        message
      );
    }
  }

  // -------------------------------------------------------
  // 2️⃣ BACKUP: POLLINATIONS
  // -------------------------------------------------------

  try {
    console.log(
      "🔄 Trying Pollinations image generation backup..."
    );

    const safePrompt =
      encodeURIComponent(prompt.trim());

    const randomSeed =
      Math.floor(Math.random() * 1000000);

    const imageUrl =
      `https://image.pollinations.ai/prompt/${safePrompt}` +
      `?width=1024` +
      `&height=1024` +
      `&seed=${randomSeed}` +
      `&nologo=true` +
      `&model=flux`;

    const res = await fetch(imageUrl);

    if (res.ok) {
      console.log(
        "⚠️ Fell back to Pollinations backup"
      );

      return {
        success: true,
        imageUrl,
        source: "pollinations",
      };
    }

    console.error(
      "❌ Pollinations returned HTTP status:",
      res.status
    );

  } catch (error: unknown) {

    const message =
      error instanceof Error
        ? error.message
        : String(error);

    console.error(
      "❌ Pollinations backup failed:",
      message
    );
  }

  // -------------------------------------------------------
  // 3️⃣ BOTH FAILED
  // -------------------------------------------------------

  console.error(
    "❌ Both Gemini and Pollinations image generation failed."
  );

  return {
    success: false,
    error: "Generation failed",
  };
}