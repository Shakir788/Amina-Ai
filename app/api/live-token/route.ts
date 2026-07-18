// app/api/live-token/route.ts
// Vercel serverless route — Gemini Live ke liye short-lived (ephemeral) token deti hai.
// Browser is token se SEEDHA Google se connect hota hai (koi always-on server nahi chahiye).

import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

// authTokens.create ke liye node runtime (edge nahi)
export const runtime = "nodejs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function POST() {
  const apiKey =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing GOOGLE_GENERATIVE_AI_API_KEY" },
      { status: 500, headers: CORS }
    );
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { apiVersion: "v1alpha" }, // ephemeral token = v1alpha zaroori
    });

    const now = Date.now();
    const token = await ai.authTokens.create({
      config: {
        // 1 baar naya session start karne ke liye; ~30 min tak resumable
        uses: 1,
        expireTime: new Date(now + 30 * 60 * 1000).toISOString(),        // 30 min
        newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),   // 1 min me use karo
        httpOptions: { apiVersion: "v1alpha" },
      },
    });

    // token.name hi wo string hai jo client "apiKey" ki tarah use karega
    return NextResponse.json({ token: token.name }, { headers: CORS });
  } catch (err: any) {
    console.error("❌ live-token error:", err?.message || err);
    return NextResponse.json(
      { error: "Could not create live token" },
      { status: 500, headers: CORS }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: CORS });
}
