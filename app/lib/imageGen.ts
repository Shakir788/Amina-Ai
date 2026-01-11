// 📂 app/lib/imageGen.ts

/**
 * Image models text ko galat draw karte hain.
 * Isliye hum prompt se text / writing related instructions hata dete hain
 * aur explicitly bolte hain: no text, no letters.
 */

// 🔒 REMOVE TEXT-RELATED INSTRUCTIONS
function sanitizePrompt(prompt: string): string {
  if (!prompt) return "";

  return prompt
    // remove common text instructions
    .replace(
      /(text|quote|caption|written|write|words|letters|title|logo|heading|font)[^.,]*/gi,
      ""
    )
    // clean extra spaces
    .replace(/\s+/g, " ")
    .trim();
}

export async function generateImageWithGemini(
  prompt: string
): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
  try {
    console.log(`🎨 Generating art for: "${prompt}"`);

    // 🔥 Random seed so image is different every time
    const seed = Math.floor(Math.random() * 1_000_000);

    // ✅ SANITIZE PROMPT (NO TEXT DRAWING)
    const safePrompt = sanitizePrompt(prompt);

    // 🧠 Final image prompt (visual-only)
    const finalPrompt =
      safePrompt.length > 0
        ? `${safePrompt}, no text, no words, no letters`
        : "cinematic artistic image, no text, no words, no letters";

    // 🔥 Pollinations Image URL
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(
      finalPrompt
    )}?nologo=true&private=true&enhance=true&seed=${seed}&model=flux`;

    // Browser image load karega directly
    return {
      success: true,
      imageUrl,
    };
  } catch (error: any) {
    console.error("❌ Image Gen Error:", error);
    return {
      success: false,
      error: "Failed to generate image.",
    };
  }
}
