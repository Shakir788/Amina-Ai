// ✅ FORCE NODE RUNTIME (VERY IMPORTANT)
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const text = body?.text;
    const voice = body?.voice || "en-US-AriaNeural";

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    const tts = new MsEdgeTTS();

    await tts.setMetadata(
      voice,
      OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3
    );

    const { audioStream } = await tts.toStream(text);

    const chunks: Uint8Array[] = [];

    for await (const chunk of audioStream) {
      chunks.push(chunk);
    }

    // ✅ Convert to Uint8Array (Browser Compatible)
    const audioBuffer = new Uint8Array(
      chunks.reduce((acc, c) => acc + c.length, 0)
    );

    let offset = 0;
    for (const chunk of chunks) {
      audioBuffer.set(chunk, offset);
      offset += chunk.length;
    }

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.length.toString(),
      },
    });

  } catch (err: any) {
    console.error("TTS API ERROR:", err);
    return NextResponse.json(
      { error: "Failed to generate speech" },
      { status: 500 }
    );
  }
}
