import { NextResponse } from "next/server";

export const runtime = "edge";

const GOOGLE_TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";

function cleanTextForTTS(text: string): string {
  if (!text) return "";
  return text
    .replace(/\p{Extended_Pictographic}/gu, "") 
    .replace(/[*#_`~-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const VOICE_CONFIG = {
  // 🇺🇸 ENGLISH: Journey (Hollywood Level)
  en: {
    female: { name: "en-US-Journey-F", languageCode: "en-US" }, 
    male:   { name: "en-US-Journey-D", languageCode: "en-US" },
  },
  
  // 🇮🇳 HINGLISH: The "Cute & Smart" Setup
  // We use 'en-IN-Neural2-A' (Indian English).
  // Why? Because it reads English words inside Hindi sentences PERFECTLY.
  // No "Angrez" accent, no spelling out words. Just pure Indian flow.
  hi: {
    female: { name: "en-IN-Neural2-A", languageCode: "en-IN" }, 
    male:   { name: "en-IN-Neural2-C", languageCode: "en-IN" }, 
  },

  // 🇸🇦 ARABIC: Wavenet (Stable)
  ar: {
    female: { name: "ar-XA-Wavenet-A", languageCode: "ar-XA" }, 
    male:   { name: "ar-XA-Wavenet-B", languageCode: "ar-XA" },
  },

  // 🇫🇷 FRENCH: Neural2
  fr: {
    female: { name: "fr-FR-Neural2-A", languageCode: "fr-FR" },
    male:   { name: "fr-FR-Neural2-B", languageCode: "fr-FR" },
  }
};

function detectLanguageFallback(text: string) {
  if (/[\u0600-\u06FF]/.test(text)) return "ar"; 
  if (/\b(bonjour|merci|ça|oui|non)\b/i.test(text)) return "fr"; 
  if (/\b(kya|kyu|hai|haan|nahi|suno|acha|theek|bhai|yaar|batao|sahi|matlab|kuch|aur|mai|hum|tum|aap)\b/i.test(text)) return "hi";
  return "en"; 
}

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

    // 🧠 Language Logic
    let langPrefix = "en";
    const detected = detectLanguageFallback(textToSpeak);

    if (requestedLangCode) {
        if (requestedLangCode.startsWith('hi') || requestedLangCode === 'en-IN') langPrefix = 'hi';
        else if (requestedLangCode.startsWith('ar')) langPrefix = 'ar';
        else if (requestedLangCode.startsWith('fr')) langPrefix = 'fr';
        else langPrefix = 'en';
    } else {
        langPrefix = detected;
    }

    if (detected === 'hi') langPrefix = 'hi';
    if (detected === 'ar') langPrefix = 'ar';

    // @ts-ignore
    const selectedVoice = VOICE_CONFIG[langPrefix][gender];

    // 🎛️ AUDIO TUNING (The "Personality" Layer)
    let audioConfig: any = {
        audioEncoding: "MP3",
        speakingRate: 1.0, 
        pitch: 0.0,
    };

    // 🔥 HINGLISH SPECIAL SETTINGS
    if (langPrefix === 'hi') {
        if (gender === 'female') {
            // 👩 AMINA: "Cute & Energetic"
            // Pitch +2.5 = Young, sweet, anime-like (Not deep/robotic)
            // Speed 1.1 = Energetic conversational flow (Not boring reading)
            audioConfig.pitch = 2.5; 
            audioConfig.speakingRate = 1.1; 
        } else {
            // 👨 MOHAMMAD: "Professional"
            audioConfig.pitch = -1.5; 
            audioConfig.speakingRate = 1.0; 
        }
    } 
    // 🌍 OTHER LANGUAGES (Keep Natural)
    else {
        audioConfig.speakingRate = 1.0;
        audioConfig.pitch = 0.0;
    }

    const requestBody = {
      input: { text: textToSpeak },
      voice: {
        languageCode: selectedVoice.languageCode,
        name: selectedVoice.name,
      },
      audioConfig: audioConfig,
    };

    const response = await fetch(`${GOOGLE_TTS_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
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