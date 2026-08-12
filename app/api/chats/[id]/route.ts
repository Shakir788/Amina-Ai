// app/api/chats/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin as supabase } from "@/app/lib/supabaseAdmin";

// GET /api/chats/:id — resume a chat: returns its messages (ownership checked)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  // Ownership check first — don't let user A load user B's chat
  const { data: chat, error: chatError } = await supabase
    .from("chats")
    .select("id, user_id, title")
    .eq("id", id)
    .single();

  if (chatError || !chat) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }
  if (chat.user_id !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: messages, error: msgError } = await supabase
    .from("messages")
    .select("id, role, content, image_url, created_at") // 🆕 image_url added
    .eq("chat_id", id)
    .order("created_at", { ascending: true });

  if (msgError) {
    console.error("Fetch messages error:", msgError);
    return NextResponse.json({ error: msgError.message }, { status: 500 });
  }

  // 🆕 map snake_case -> camelCase so ChatInterface.tsx's `m.imageUrl` works directly
  const mappedMessages = (messages || []).map((m: any) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    imageUrl: m.image_url,
    created_at: m.created_at,
  }));

  return NextResponse.json({ id: chat.id, title: chat.title, messages: mappedMessages });
}

// DELETE /api/chats/:id — delete a chat (messages cascade-delete via FK)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const { data: chat } = await supabase.from("chats").select("user_id").eq("id", id).single();
  if (!chat || chat.user_id !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase.from("chats").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// 🔥 PATCH /api/chats/:id — Update a chat (Rename & Pin)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  // Ownership check
  const { data: chat } = await supabase.from("chats").select("user_id").eq("id", id).single();
  if (!chat || chat.user_id !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { title, isPinned } = body;

  const updateData: any = {};
  if (title !== undefined) updateData.title = title;

  // Note: Assuming you use snake_case in Supabase (is_pinned).
  if (isPinned !== undefined) updateData.is_pinned = isPinned;

  const { data: updatedChat, error } = await supabase
    .from("chats")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Update chat error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(updatedChat);
}