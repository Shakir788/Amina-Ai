// 📂 app/lib/imageGen.ts

export async function generateImageWithGemini(prompt: string): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
  try {
    console.log(`🎨 Generating art for: "${prompt}"`);

    // 🔥 USING POLLINATIONS AI (Fast, Free, No API Key needed)
    // Hum seed random kar rahe hain taki har baar nayi image bane
    const seed = Math.floor(Math.random() * 1000000);
    
    // Construct the URL directly
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?nologo=true&private=true&enhance=true&seed=${seed}&model=flux`;

    // Hum bas URL return karenge, browser apne aap load kar lega
    return { 
      success: true, 
      imageUrl: imageUrl 
    };

  } catch (error: any) {
    console.error("❌ Image Gen Error:", error);
    return { success: false, error: "Failed to generate image." };
  }
}