

import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
const IMAGE_MODEL = "gemini-3-pro-image";

export interface GenerateProductImageInput {
  /** Base64-encoded bytes of the source product photo (no data: prefix) */
  imageBase64: string;
  /** e.g. "image/jpeg" or "image/png" */
  mimeType: string;
  /** Human description of the pose/scene, e.g. "walking pose, studio white background" */
  posePrompt: string;
  /** Optional: "female model", "male model", "plus-size model", etc. */
  modelType?: string;
}

export interface GenerateProductImageResult {
  /** Base64-encoded PNG/JPEG bytes of the generated image */
  imageBase64: string;
  mimeType: string;
}

/**
 * Sends the product photo + a text instruction to Gemini and asks it to
 * return an edited image: the same garment, worn by a model, in the
 * requested pose. Gemini's image model supports image-in / image-out
 * editing, so the garment's color/pattern/design is preserved instead of
 * being redrawn from scratch.
 */
export async function generateProductImage(
  input: GenerateProductImageInput
): Promise<GenerateProductImageResult> {
  const { imageBase64, mimeType, posePrompt, modelType = "model" } = input;

  const instruction = [
    `Take the clothing item in this photo and generate a photorealistic image of a ${modelType} wearing it.`,
    `Pose / scene: ${posePrompt}.`,
    `Keep the garment's exact color, pattern, fabric texture, and design unchanged — only change the pose, background, and add a realistic model.`,
    `Lighting should look like a professional e-commerce fashion shoot.`,
  ].join(" ");

  const response = await ai.models.generateContent({
    model: IMAGE_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType, data: imageBase64 } },
          { text: instruction },
        ],
      },
    ],
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) => p.inlineData?.data);

  if (!imagePart?.inlineData?.data) {
    // Model sometimes returns only text (e.g. if it refused/couldn't comply)
    const textPart = parts.find((p) => p.text)?.text;
    throw new Error(
      textPart
        ? `Image generation failed: ${textPart}`
        : "Image generation failed: no image returned by the model."
    );
  }

  return {
    imageBase64: imagePart.inlineData.data,
    mimeType: imagePart.inlineData.mimeType || "image/png",
  };
}

/**
 * Generates the same garment across several poses in one call, in parallel.
 * Useful for a product page that wants 3-4 angles at once.
 */
export async function generateProductImageSet(
  base: Omit<GenerateProductImageInput, "posePrompt">,
  posePrompts: string[]
): Promise<GenerateProductImageResult[]> {
  const jobs = posePrompts.map((posePrompt) =>
    generateProductImage({ ...base, posePrompt })
  );
  // Promise.allSettled so one failed pose doesn't kill the whole batch
  const results = await Promise.allSettled(jobs);
  return results
    .filter(
      (r): r is PromiseFulfilledResult<GenerateProductImageResult> =>
        r.status === "fulfilled"
    )
    .map((r) => r.value);
}