import { NextResponse } from "next/server";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

export async function POST(req: Request) {
  try {
    const { text, voice } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    const tts = new MsEdgeTTS();

    // Set voice metadata
    await tts.setMetadata(
      voice || "en-US-AriaNeural",
      OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3
    );

    // --- FIX START ---
    // Error yahan tha. toStream ek object return karta hai, direct stream nahi.
    // Humein usme se 'audioStream' nikalna padega.
    const { audioStream } = await tts.toStream(text);

    const chunks: Buffer[] = [];

    // Ab hum specific audioStream par loop chalayenge
    for await (const chunk of audioStream) {
      chunks.push(Buffer.from(chunk));
    }
    // --- FIX END ---

    const audioBuffer = Buffer.concat(chunks);

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.length.toString(),
      },
    });

  } catch (err: any) {
    console.error("TTS API ERROR:", err);
    return NextResponse.json({ error: "Failed to generate speech" }, { status: 500 });
  }
}