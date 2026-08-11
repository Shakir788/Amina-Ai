import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin as supabase } from "@/app/lib/supabaseAdmin";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const { message } = await req.json();

    // 1. Ownership check (security first)
    const { data: chat } = await supabase.from("chats").select("user_id, title").eq("id", id).single();
    if (!chat || chat.user_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Agar title pehle se set hai (New Chat nahi hai), toh skip kar do
    if (chat.title && chat.title !== "New Chat" && chat.title.trim() !== "") {
      return NextResponse.json({ skipped: true });
    }

    // 2. Gemini se short title generate karwao
    const prompt = `Generate a short, 3-to-4 word maximum title for a chat that starts with this message. Do not use quotes or full stops. Message: "${message}"`;

    const response = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: prompt,
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const textPart = parts.find((p) => p.text)?.text;

    let generatedTitle = textPart?.trim() || "Chat";
    // Quotes/full-stop cleanup safety net
    generatedTitle = generatedTitle.replace(/^["']|["']$/g, "").replace(/\.$/, "").slice(0, 60);

    // 3. Supabase mein title update karo
    await supabase.from("chats").update({ title: generatedTitle }).eq("id", id);

    return NextResponse.json({ success: true, title: generatedTitle });
  } catch (error) {
    console.error("Auto-rename error:", error);
    return NextResponse.json({ error: "Failed to auto-rename" }, { status: 500 });
  }
}