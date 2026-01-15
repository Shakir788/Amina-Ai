export async function generateImageWithGemini(prompt: string): Promise<any> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY;

  // ---------------------------------------------------------
  // 1️⃣ OPTION A: GOOGLE IMAGEN 3
  // ---------------------------------------------------------
  try {
    if (apiKey) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${apiKey}`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [{ prompt: prompt }],
          parameters: { sampleCount: 1, aspectRatio: "1:1" },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const base64Image = data.predictions?.[0]?.bytesBase64Encoded;
        
        if (base64Image) {
          console.log("✅ Generated with Google Imagen");
          // 👇 IMPORTANT: Object Format Return Karo
          return {
            success: true,
            imageUrl: `data:image/png;base64,${base64Image}`
          };
        }
      }
    }
  } catch (error) {
    console.warn("⚠️ Google Image Gen failed, switching to backup...", error);
  }

  // ---------------------------------------------------------
  // 2️⃣ OPTION B: POLLINATIONS (Backup)
  // ---------------------------------------------------------
  try {
    const safePrompt = encodeURIComponent(prompt);
    const randomSeed = Math.floor(Math.random() * 1000000);
    
    // Nologo aur Flux model best hain
    const imageUrl = `https://image.pollinations.ai/prompt/${safePrompt}?width=1024&height=1024&seed=${randomSeed}&nologo=true&model=flux`;
    
    // Check link alive
    const res = await fetch(imageUrl);
    if (res.ok) {
        console.log("✅ Generated with Pollinations Backup");
        // 👇 IMPORTANT: Yahan bhi Object Format Return Karo
        return {
            success: true,
            imageUrl: imageUrl
        };
    }
  } catch (e) {
    console.error("❌ Both Google and Backup failed");
  }

  return { success: false, error: "Generation failed" };
}