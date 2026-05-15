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

// 🛡️ FALLBACK FUNCTION (Jugaad for Free Voice)
async function useFreeFallbackTTS(text: string, lang: string = 'hi') {
    console.log("⚡ Switching to Fast Fallback TTS...");
    try {
        // Google Translate TTS (Unofficial but reliable & free)
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=tw-ob`;
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        
        return new Response(arrayBuffer, {
            headers: { "Content-Type": "audio/mpeg" }
        });
    } catch (e) {
        return NextResponse.json({ error: "All TTS methods failed" }, { status: 500 });
    }
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
    
    // 🛑 Agar API Key nahi hai, seedha Fallback use karo
    if (!apiKey) {
        return await useFreeFallbackTTS(textToSpeak, requestedLangCode?.split('-')[0] || 'hi');
    }

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

    // 🎛️ AUDIO TUNING
    let audioConfig: any = {
        audioEncoding: "MP3",
        speakingRate: 1.0, 
        pitch: 0.0,
    };

    if (langPrefix === 'hi') {
        if (gender === 'female') {
            audioConfig.pitch = 2.5; 
            audioConfig.speakingRate = 1.1; 
        } else {
            audioConfig.pitch = -1.5; 
            audioConfig.speakingRate = 1.0; 
        }
    } 
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

    // 🔥 3 SECOND TIMEOUT LOGIC (Ye Naya Hai)
    // Hum ek timer laga rahe hain. Agar 3 second mein Google ne jawab nahi diya, toh hum cancel kar denge.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 Second limit

    try {
        // 🚀 TRY PREMIUM TTS
        const response = await fetch(`${GOOGLE_TTS_URL}?key=${apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
            signal: controller.signal // Signal bhej rahe hain ki kab rukna hai
        });

        clearTimeout(timeoutId); // Agar jawab aa gaya, toh timer band karo

        if (!response.ok) {
            console.warn("Premium TTS Failed (Key Error or Quota), using fallback.");
            return await useFreeFallbackTTS(textToSpeak, langPrefix);
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
        // ⚠️ Agar Timeout (3 sec) hua ya koi error aaya, toh yahan aayega
        console.warn("⚠️ Premium TTS took too long or failed. Switching to Backup.");
        return await useFreeFallbackTTS(textToSpeak, langPrefix);
    }

  } catch (error: any) {
    console.error("Server Error, trying fallback:", error);
    // ⚠️ Koi bhi error aaye, fallback chala do
    return await useFreeFallbackTTS("I am having trouble speaking right now.", "en");
  }
}