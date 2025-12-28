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
    .replace(/\p{Extended_Pictographic}/gu, "") 
    .replace(/[*#_`~-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/* ==========================================
   💎 PREMIUM VOICE CONFIGURATION
========================================== */
const VOICE_CONFIG = {
  // 🇺🇸 English (Journey = Expressive & Human-like)
  en: {
    female: { name: "en-US-Journey-F", languageCode: "en-US" },
    male:   { name: "en-US-Journey-D", languageCode: "en-US" },
  },
  
  // 🇮🇳 Hinglish (FIXED: Using Indian English Neural voices for natural flow)
  // Ye voices Hinglish text (Roman script) ko sabse best padhti hain.
  hi: {
    female: { name: "en-IN-Neural2-D", languageCode: "en-IN" }, 
    male:   { name: "en-IN-Neural2-B", languageCode: "en-IN" },
  },

  // 🇸🇦 Arabic (Wavenet)
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
  // Agar Hindi words dikhe toh 'hi' return karo (jo ab en-IN voice use karega)
  if (/\b(kya|hai|haan|nahi|suno|acha|theek|bhai|yaar)\b/i.test(text)) return "hi";
  return "en"; 
}

/* ==========================================
   🚀 MAIN API ROUTE
========================================== */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    let rawText = body?.text || "";
    let requestedLangCode = body?.lang || ""; 
    const gender = body?.voice === "male" ? "male" : "female";

    if (!rawText) return NextResponse.json({ error: "No text" }, { status: 400 });

    const textToSpeak = cleanTextForTTS(rawText);
    if (!textToSpeak) return new Response(null, { status: 200 });

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Key Missing" }, { status: 500 });

    // 🔥 SMART LANGUAGE SELECTION
    let langPrefix = "en";
    
    // Agar Frontend se 'hi-IN' aaya, toh hum usse override karke apni config use karenge
    if (requestedLangCode && requestedLangCode.startsWith('hi')) {
        langPrefix = 'hi';
    } else if (requestedLangCode) {
        const prefix = requestedLangCode.split('-')[0];
        // @ts-ignore
        if (VOICE_CONFIG[prefix]) langPrefix = prefix;
    } else {
        langPrefix = detectLanguageFallback(textToSpeak);
    }

    // @ts-ignore
    const selectedVoice = VOICE_CONFIG[langPrefix][gender];

    // 🔥 AUDIO CONFIG
    let audioConfig: any = {
        audioEncoding: "MP3",
        speakingRate: 1.0, 
        pitch: 0.0,
    };

    // 1. English Journey Voices: NO pitch/rate changes allowed (Crash ho jate hain)
    if (langPrefix === 'en') {
        audioConfig.speakingRate = 1.0;
        audioConfig.pitch = 0.0;
    } 
    // 2. Hinglish (Indian English): Thoda tez aur natural variation
    else if (langPrefix === 'hi') {
        audioConfig.speakingRate = 1.15; // Hinglish thodi fast natural lagti hai
        audioConfig.pitch = gender === 'female' ? 1.0 : -1.0; 
    }
    // 3. Others (Arabic/French)
    else {
        const randomPitch = (Math.random() * 2) - 1; 
        const randomRate = 1.0 + (Math.random() * 0.1 - 0.05);
        audioConfig.pitch = randomPitch;
        audioConfig.speakingRate = randomRate;
    }

    const requestBody = {
      input: { text: textToSpeak },
      voice: {
        languageCode: selectedVoice.languageCode,
        name: selectedVoice.name,
      },
      audioConfig: audioConfig,
    };

    // 🔥 CALL GOOGLE TTS
    const response = await fetch(`${GOOGLE_TTS_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("🔥 Google TTS API Error:", errorText);
      
      // Fallback: Agar Premium voice fail ho jaye (Quota/Permissions), toh standard use karo
      return NextResponse.json({ error: "TTS API Failed", details: errorText }, { status: 500 });
    }

    const data = await response.json();
    const audioContent = data.audioContent; 
    const audioBuffer = Uint8Array.from(atob(audioContent), c => c.charCodeAt(0));

    return new Response(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.byteLength.toString(),
        "X-AI-Speech": "true" 
      },
    });

  } catch (error: any) {
    console.error("Server Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}