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
  // 🇺🇸 ENGLISH: Journey
  en: {
    female: { name: "en-US-Journey-F", languageCode: "en-US" },
    male: { name: "en-US-Journey-D", languageCode: "en-US" },
  },

  // 🇮🇳 HINDI / HINGLISH
  hi: {
    female: { name: "en-IN-Neural2-A", languageCode: "en-IN" },
    male: { name: "en-IN-Neural2-C", languageCode: "en-IN" },
  },

  // 🇸🇦 ARABIC
  ar: {
    female: { name: "ar-XA-Wavenet-A", languageCode: "ar-XA" },
    male: { name: "ar-XA-Wavenet-B", languageCode: "ar-XA" },
  },

  // 🇫🇷 FRENCH
  fr: {
    female: { name: "fr-FR-Neural2-A", languageCode: "fr-FR" },
    male: { name: "fr-FR-Neural2-B", languageCode: "fr-FR" },
  },
};

type LanguagePrefix = keyof typeof VOICE_CONFIG;

function normalizeLanguage(value: unknown): LanguagePrefix | null {
  if (typeof value !== "string") return null;

  const valueLower = value.toLowerCase().trim();

  if (valueLower.startsWith("ar")) return "ar";
  if (valueLower.startsWith("fr")) return "fr";
  if (valueLower.startsWith("hi") || valueLower === "in") return "hi";
  if (valueLower.startsWith("en")) return "en";

  return null;
}

/**
 * Fast, language-agnostic script detection.
 * This is deliberately NOT based on Hinglish keywords.
 */
function detectLanguageByScript(text: string): LanguagePrefix | null {
  if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(text)) return "ar";

  // Devanagari covers Hindi written in its native script.
  if (/[\u0900-\u097F]/.test(text)) return "hi";

  // French and English both use Latin script, so their distinction is
  // handled by the semantic detector below when the API key is available.
  return null;
}

/**
 * Semantic language detector.
 *
 * This is intentionally tiny and returns ONLY one language code. It means
 * Roman Hindi/Hinglish is no longer tied to a fixed keyword list in the UI.
 * If this call fails, the script detector and requested language remain the
 * safe fallbacks.
 */
async function detectLanguageWithGemini(text: string, apiKey: string): Promise<LanguagePrefix | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);

    const model = "gemini-2.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const prompt = `Classify the language of this text for text-to-speech.\n\nReturn ONLY one token: EN, HI, FR, or AR.\n\nRules:\n- HI includes Hindi written in Devanagari AND Roman Hindi/Hinglish.\n- AR includes Arabic.\n- FR includes French.\n- EN includes English.\n- For mixed Hindi-English text, choose HI if Hindi is a meaningful part of the sentence; otherwise choose EN.\n\nText:\n${text.slice(0, 2500)}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 4,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data = await response.json();
    const result = String(
      data?.candidates?.[0]?.content?.parts?.[0]?.text || ""
    )
      .trim()
      .toUpperCase();

    if (result.includes("AR")) return "ar";
    if (result.includes("FR")) return "fr";
    if (result.includes("HI")) return "hi";
    if (result.includes("EN")) return "en";

    return null;
  } catch (error) {
    console.warn("⚠️ Semantic TTS language detection skipped:", error);
    return null;
  }
}

/**
 * Last-resort fallback only. This is NOT the primary detector and does not
 * control normal Amina understanding. It exists so TTS still works if the
 * Gemini language detector is unavailable.
 */
function detectLanguageFallback(text: string): LanguagePrefix {
  const scriptLanguage = detectLanguageByScript(text);
  if (scriptLanguage) return scriptLanguage;

  // Very small French safety net for cases where the semantic detector is
  // unavailable. No Hinglish keyword list is used here.
  if (/\b(bonjour|merci|salut|français|française|avec|pour|dans|une|les|des)\b/i.test(text)) {
    return "fr";
  }

  return "en";
}

// 🛡️ FALLBACK FUNCTION (Free/backup voice)
async function useFreeFallbackTTS(text: string, lang: string = "en") {
  console.log("⚡ Switching to Fast Fallback TTS...");

  try {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${encodeURIComponent(lang)}&client=tw-ob`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Fallback TTS returned ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();

    return new Response(arrayBuffer, {
      headers: { "Content-Type": "audio/mpeg" },
    });
  } catch (e) {
    console.error("❌ Fallback TTS failed:", e);
    return NextResponse.json(
      { error: "All TTS methods failed" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawText = body?.text || "";
    const requestedLangCode = body?.lang || "";
    const gender = body?.voice === "male" ? "male" : "female";

    if (!rawText) {
      return NextResponse.json(
        { error: "No text" },
        { status: 400 }
      );
    }

    const textToSpeak = cleanTextForTTS(rawText);

    if (!textToSpeak) {
      return new Response(null, { status: 200 });
    }

    const apiKey =
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      process.env.GOOGLE_API_KEY;

    // 🛑 No Google key: use backup immediately.
    if (!apiKey) {
      const requestedFallback =
        normalizeLanguage(requestedLangCode) ||
        detectLanguageFallback(textToSpeak);

      const fallbackLang =
        requestedFallback === "hi"
          ? "hi"
          : requestedFallback === "ar"
            ? "ar"
            : requestedFallback === "fr"
              ? "fr"
              : "en";

      return await useFreeFallbackTTS(
        textToSpeak,
        fallbackLang
      );
    }

    /*
     * -------------------------------------------------------
     * LANGUAGE LOGIC
     * -------------------------------------------------------
     *
     * Priority:
     * 1. Explicit language from caller when it is genuinely explicit.
     * 2. Native-script detection (Arabic / Devanagari).
     * 3. Semantic Gemini detection for English/French/Roman Hindi/Hinglish.
     * 4. Safe English fallback.
     *
     * The old hard-coded Hinglish marker list is intentionally gone.
     */
    const explicitLanguage = normalizeLanguage(requestedLangCode);
    const scriptLanguage = detectLanguageByScript(textToSpeak);

    let langPrefix: LanguagePrefix;

    if (explicitLanguage && requestedLangCode !== "") {
      // The caller may explicitly provide ar/fr/hi/en. Native script still
      // wins when it clearly contradicts a stale caller value.
      if (scriptLanguage) {
        langPrefix = scriptLanguage;
      } else {
        // ChatInterface sends an empty lang so normal responses are detected
        // semantically here. Explicit language from other callers is still
        // respected.
        langPrefix = explicitLanguage;
      }
    } else if (scriptLanguage) {
      langPrefix = scriptLanguage;
    } else {
      langPrefix =
        (await detectLanguageWithGemini(
          textToSpeak,
          apiKey
        )) || detectLanguageFallback(textToSpeak);
    }

    const selectedVoice = VOICE_CONFIG[langPrefix][gender];

    // 🎛️ AUDIO TUNING — existing behaviour preserved.
    const audioConfig: any = {
      audioEncoding: "MP3",
      speakingRate: 1.0,
      pitch: 0.0,
    };

    if (langPrefix === "hi") {
      if (gender === "female") {
        audioConfig.pitch = 2.5;
        audioConfig.speakingRate = 1.1;
      } else {
        audioConfig.pitch = -1.5;
        audioConfig.speakingRate = 1.0;
      }
    } else {
      audioConfig.speakingRate = 1.0;
      audioConfig.pitch = 0.0;
    }

    const requestBody = {
      input: { text: textToSpeak },
      voice: {
        languageCode: selectedVoice.languageCode,
        name: selectedVoice.name,
      },
      audioConfig,
    };

    // 🔥 3 SECOND PREMIUM TTS TIMEOUT — existing behaviour preserved.
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      3000
    );

    try {
      const response = await fetch(
        `${GOOGLE_TTS_URL}?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(
          "Premium TTS Failed (Key Error or Quota), using fallback."
        );

        const fallbackLang =
          langPrefix === "hi"
            ? "hi"
            : langPrefix === "ar"
              ? "ar"
              : langPrefix === "fr"
                ? "fr"
                : "en";

        return await useFreeFallbackTTS(
          textToSpeak,
          fallbackLang
        );
      }

      const data = await response.json();
      const audioContent = data.audioContent;

      if (!audioContent) {
        throw new Error("Google TTS returned no audioContent");
      }

      const audioBuffer = Uint8Array.from(
        atob(audioContent),
        (c) => c.charCodeAt(0)
      );

      return new Response(audioBuffer, {
        headers: {
          "Content-Type": "audio/mpeg",
          "Content-Length": audioBuffer.byteLength.toString(),
          "X-AI-Speech": "true",
          "X-AI-Language": langPrefix,
        },
      });
    } catch (error: any) {
      clearTimeout(timeoutId);

      console.warn(
        "⚠️ Premium TTS took too long or failed. Switching to Backup.",
        error?.message || error
      );

      const fallbackLang =
        langPrefix === "hi"
          ? "hi"
          : langPrefix === "ar"
            ? "ar"
            : langPrefix === "fr"
              ? "fr"
              : "en";

      return await useFreeFallbackTTS(
        textToSpeak,
        fallbackLang
      );
    }
  } catch (error: any) {
    console.error(
      "Server Error, trying fallback:",
      error
    );

    return await useFreeFallbackTTS(
      "I am having trouble speaking right now.",
      "en"
    );
  }
}
