// app/api/chats/[id]/messages/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin as supabase } from "@/app/lib/supabaseAdmin";

// POST /api/chats/:id/messages — append a message and touch updatedAt.
// Title is NOT set here anymore — /api/chats/:id/auto-rename (Gemini)
// handles giving the chat a proper short title.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const role = body?.role;
  const content = body?.content;
  if (role !== "user" && role !== "assistant") {
    return NextResponse.json({ error: "role must be 'user' or 'assistant'" }, { status: 400 });
  }
  if (typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  const { data: chat } = await supabase.from("chats").select("user_id").eq("id", id).single();
  if (!chat || chat.user_id !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: message, error: insertError } = await supabase
    .from("messages")
    .insert({ chat_id: id, role, content })
    .select("id, role, content, created_at")
    .single();

  if (insertError) {
    console.error("Save message error:", insertError);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Just bump updatedAt so the sidebar re-sorts — title comes from auto-rename
  await supabase.from("chats").update({ updated_at: new Date().toISOString() }).eq("id", id);

  return NextResponse.json(message);
}