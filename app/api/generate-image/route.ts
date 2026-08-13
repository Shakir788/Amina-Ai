// app/api/generate-image/route.ts
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY });

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();
    if (!prompt) {
      return NextResponse.json({ success: false, error: "Prompt is required." }, { status: 400 });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-image",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p) => p.inlineData?.data);

    if (!imagePart?.inlineData?.data) {
      return NextResponse.json({ success: false, error: "No image returned by the model." });
    }

    const outMime = imagePart.inlineData.mimeType || "image/png";
    return NextResponse.json({ success: true, imageUrl: `data:${outMime};base64,${imagePart.inlineData.data}` });
  } catch (err: any) {
    console.error("generate-image route error:", err);
    return NextResponse.json({ success: false, error: err?.message || "Unexpected server error." }, { status: 500 });
  }
}