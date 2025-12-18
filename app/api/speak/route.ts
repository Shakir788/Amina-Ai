import { NextResponse } from "next/server";

export const runtime = "edge";

// Google Cloud TTS Endpoint
const GOOGLE_TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";

/* ==========================================
   🧹 HELPER: REMOVE EMOJIS & MARKDOWN
========================================== */
function cleanTextForTTS(text: string): string {
  if (!text) return "";
  return text
    // 1. Remove All Emojis (Nuclear Regex)
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}]/gu, "")
    // 2. Remove Markdown symbols (*, #, _, etc.) jo bolne me ajeeb lagte hain
    .replace(/[*#_`~-]/g, "")
    // 3. Remove extra spaces
    .replace(/\s+/g, " ")
    .trim();
}

/* ==========================================
   💎 PREMIUM VOICE CONFIGURATION
========================================== */
const VOICE_CONFIG = {
  en: {
    female: { name: "en-US-Journey-F", languageCode: "en-US" },
    male:   { name: "en-US-Journey-D", languageCode: "en-US" },
  },
  ar: {
    female: { name: "ar-XA-Wavenet-A", languageCode: "ar-XA" }, 
    male:   { name: "ar-XA-Wavenet-B", languageCode: "ar-XA" },
  },
  fr: {
    female: { name: "fr-FR-Neural2-A", languageCode: "fr-FR" },
    male:   { name: "fr-FR-Neural2-B", languageCode: "fr-FR" },
  }
};

/* ==========================================
   🕵️ HELPER: DETECT LANGUAGE
========================================== */
function detectLanguage(text: string) {
  if (/[\u0600-\u06FF]/.test(text)) return "ar"; // Arabic
  if (/\b(bonjour|merci|ça|oui|non)\b/i.test(text)) return "fr"; // French
  return "en"; // Default English
}

/* ==========================================
   🚀 MAIN API ROUTE
========================================== */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    let rawText = body?.text || "";
    const gender = body?.voice === "male" ? "male" : "female";

    if (!rawText) return NextResponse.json({ error: "No text" }, { status: 400 });

    // 🔥 STEP 1: CLEAN THE TEXT (Emojis Hatao)
    const textToSpeak = cleanTextForTTS(rawText);

    // Agar emojis hatane ke baad text khali ho gaya (e.g. sirf "😊" bheja tha)
    if (!textToSpeak) {
        // Return silent success (Audio bajane ki zarurat nahi)
        return new Response(null, { status: 200 });
    }

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Key Missing" }, { status: 500 });

    // 🔥 STEP 2: LANGUAGE & VOICE
    const lang = detectLanguage(textToSpeak);
    // @ts-ignore
    const selectedVoice = VOICE_CONFIG[lang][gender];

    let requestBody: any = {
      input: { text: textToSpeak }, // Cleaned Text bhej rahe hain
      voice: {
        languageCode: selectedVoice.languageCode,
        name: selectedVoice.name,
      },
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate: 1.0, 
        pitch: 0.0,
      },
    };

    // Special settings for Arabic (Cute Pitch)
    if (lang === "ar" && gender === "female") {
       requestBody.audioConfig.pitch = 2.0; 
       requestBody.audioConfig.speakingRate = 1.05; 
    }

    // 🔥 STEP 3: CALL GOOGLE
    const response = await fetch(`${GOOGLE_TTS_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("🔥 Google TTS API Error:", errorText);
      return NextResponse.json({ error: "TTS API Failed", details: errorText }, { status: 500 });
    }

    const data = await response.json();
    const audioContent = data.audioContent; 

    const audioBuffer = Uint8Array.from(atob(audioContent), c => c.charCodeAt(0));

    return new Response(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.byteLength.toString(),
      },
    });

  } catch (error: any) {
    console.error("Server Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}