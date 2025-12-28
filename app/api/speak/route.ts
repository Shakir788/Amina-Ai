import { NextResponse } from "next/server";

export const runtime = "edge";

// Google Cloud TTS Endpoint
const GOOGLE_TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";

/* ==========================================
   🧹 HELPER: REMOVE EMOJIS & MARKDOWN
========================================== */
/* ==========================================
   🧹 HELPER: REMOVE EMOJIS & MARKDOWN
========================================== */
function cleanTextForTTS(text: string): string {
  if (!text) return "";
  return text
    // 1. Remove All Emojis (Modern & Clean Way) 🧹
    .replace(/\p{Extended_Pictographic}/gu, "") 
    // 2. Remove Markdown symbols
    .replace(/[*#_`~-]/g, "")
    // 3. Remove extra spaces
    .replace(/\s+/g, " ")
    .trim();
}

/* ==========================================
   💎 PREMIUM VOICE CONFIGURATION
========================================== */
const VOICE_CONFIG = {
  // 🇺🇸 English
  en: {
    female: { name: "en-US-Journey-F", languageCode: "en-US" },
    male:   { name: "en-US-Journey-D", languageCode: "en-US" },
  },
  // 🇮🇳 Hindi / Hinglish (Best for Indian English mix)
  hi: {
    female: { name: "hi-IN-Neural2-A", languageCode: "hi-IN" }, 
    male:   { name: "hi-IN-Neural2-B", languageCode: "hi-IN" },
  },
  // 🇸🇦 Arabic (Wavenet = Clear)
  ar: {
    female: { name: "ar-XA-Wavenet-A", languageCode: "ar-XA" }, 
    male:   { name: "ar-XA-Wavenet-B", languageCode: "ar-XA" },
  },
  // 🇫🇷 French (Neural2)
  fr: {
    female: { name: "fr-FR-Neural2-A", languageCode: "fr-FR" },
    male:   { name: "fr-FR-Neural2-B", languageCode: "fr-FR" },
  }
};

/* ==========================================
   🕵️ HELPER: FALLBACK DETECT LANGUAGE
========================================== */
function detectLanguageFallback(text: string) {
  if (/[\u0600-\u06FF]/.test(text)) return "ar"; 
  if (/\b(bonjour|merci|ça|oui|non)\b/i.test(text)) return "fr"; 
  if (/\b(kya|hai|haan|nahi|suno|acha)\b/i.test(text)) return "hi";
  return "en"; 
}

/* ==========================================
   🚀 MAIN API ROUTE
========================================== */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    let rawText = body?.text || "";
    const requestedLangCode = body?.lang || ""; 
    const gender = body?.voice === "male" ? "male" : "female";

    if (!rawText) return NextResponse.json({ error: "No text" }, { status: 400 });

    // 🔥 STEP 1: CLEAN THE TEXT
    const textToSpeak = cleanTextForTTS(rawText);

    if (!textToSpeak) {
        return new Response(null, { status: 200 });
    }

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Key Missing" }, { status: 500 });

    // 🔥 STEP 2: SMART LANGUAGE SELECTION
    let langPrefix = "en";
    if (requestedLangCode) {
        const prefix = requestedLangCode.split('-')[0];
        // @ts-ignore
        if (VOICE_CONFIG[prefix]) langPrefix = prefix;
    } else {
        langPrefix = detectLanguageFallback(textToSpeak);
    }

    // @ts-ignore
    const selectedVoice = VOICE_CONFIG[langPrefix][gender];

    // 🔥 STEP 3: ADD HUMAN VARIATION (Fixes Robotic Tone)
    // Thoda sa randomness add kar rahe hain taaki har baar alag feel aaye
    const randomPitch = (Math.random() * 2) - 1; // -1 to +1 variation
    const randomRate = 1.0 + (Math.random() * 0.1 - 0.05); // 0.95 to 1.05 variation

    let requestBody: any = {
      input: { text: textToSpeak },
      voice: {
        languageCode: selectedVoice.languageCode,
        name: selectedVoice.name,
      },
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate: randomRate, 
        pitch: randomPitch,
      },
    };

    // Special Tweaks
    if (langPrefix === "ar" && gender === "female") {
       requestBody.audioConfig.pitch = 1.0 + Math.random(); 
       requestBody.audioConfig.speakingRate = 1.05; 
    }
    if (langPrefix === "hi") {
        requestBody.audioConfig.speakingRate = 1.1; // Hinglish thoda fast acha lagta hai
    }

    // 🔥 STEP 4: CALL GOOGLE
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

    // 🔥 STEP 5: ADD AI HEADER (ChatGPT Suggestion)
    return new Response(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.byteLength.toString(),
        "X-AI-Speech": "true" // Tagging this as AI speech
      },
    });

  } catch (error: any) {
    console.error("Server Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}