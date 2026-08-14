// app/api/images/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin as supabase } from "@/app/lib/supabaseAdmin";

// GET /api/images — returns every image (generated or edited) across ALL of
// this user's chats, newest first. This is what powers a persistent "Gallery"
// that doesn't depend on which chat is currently open.
export async function GET(_req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: chats, error: chatsError } = await supabase
    .from("chats")
    .select("id")
    .eq("user_id", userId);

  if (chatsError) {
    console.error("Fetch chats for gallery error:", chatsError);
    return NextResponse.json({ error: chatsError.message }, { status: 500 });
  }

  const chatIds = (chats || []).map((c) => c.id);
  if (chatIds.length === 0) {
    return NextResponse.json({ images: [] });
  }

  const { data: images, error: imagesError } = await supabase
    .from("messages")
    .select("id, image_url, content, created_at, chat_id")
    .in("chat_id", chatIds)
    .not("image_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (imagesError) {
    console.error("Fetch gallery images error:", imagesError);
    return NextResponse.json({ error: imagesError.message }, { status: 500 });
  }

  return NextResponse.json({ images: images || [] });
}