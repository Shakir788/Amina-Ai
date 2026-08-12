// app/api/chats/[id]/messages/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin as supabase } from "@/app/lib/supabaseAdmin";

// 🆕 Uploads a base64 data-URL to Supabase Storage and returns a public URL.
// Returns null (and logs) if upload fails — caller should just skip storing the image then.
async function uploadBase64Image(dataUrl: string, chatId: string): Promise<string | null> {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
  if (!match) return null;
  const [, mimeType, base64Data] = match;
  const ext = mimeType.split("/")[1] || "jpg";
  const path = `${chatId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const buffer = Buffer.from(base64Data, "base64");

  const { error } = await supabase.storage.from("chat-images").upload(path, buffer, {
    contentType: mimeType,
    upsert: false,
  });

  if (error) {
    console.error("Image upload error:", error);
    return null;
  }

  const { data } = supabase.storage.from("chat-images").getPublicUrl(path);
  return data.publicUrl;
}

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
  const rawImageUrl = typeof body?.imageUrl === "string" && body.imageUrl.trim() ? body.imageUrl : null;

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

  // 🆕 base64 data-URL aayi ho toh pehle Storage pe upload karo, DB mein sirf URL jaayega
  let imageUrl: string | null = null;
  if (rawImageUrl) {
    imageUrl = rawImageUrl.startsWith("data:image/")
      ? await uploadBase64Image(rawImageUrl, id)
      : rawImageUrl; // already a hosted URL — store as-is
  }

  const { data: message, error: insertError } = await supabase
    .from("messages")
    .insert({ chat_id: id, role, content, image_url: imageUrl })
    .select("id, role, content, image_url, created_at")
    .single();

  if (insertError) {
    console.error("Save message error:", insertError);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Just bump updatedAt so the sidebar re-sorts — title comes from auto-rename
  await supabase.from("chats").update({ updated_at: new Date().toISOString() }).eq("id", id);

  return NextResponse.json(message);
}