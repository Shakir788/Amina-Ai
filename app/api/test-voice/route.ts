import { NextResponse } from "next/server";

export const runtime = "edge";

const GOOGLE_TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";

export async function POST(req: Request) {
  try {
    // Frontend se settings lenge taaki live test kar sakein
    const { text, voiceId, pitch, speed } = await req.json();
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    const requestBody = {
      input: { text: text }, 
      voice: {
        languageCode: voiceId.startsWith('en') ? 'en-IN' : 'hi-IN',
        name: voiceId, // Example: "hi-IN-Neural2-A" or "en-IN-Neural2-A"
      },
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate: speed || 1.0, 
        pitch: pitch || 0.0,
        effectsProfileId: ["handset-class-device"] // Tera idea: Audio clean karne ke liye
      },
    };

    const response = await fetch(`${GOOGLE_TTS_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();
    
    if (data.error) throw new Error(data.error.message);

    return NextResponse.json({ audio: data.audioContent });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}