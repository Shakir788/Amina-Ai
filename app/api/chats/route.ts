// app/api/chats/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin as supabase } from "@/app/lib/supabaseAdmin";

// GET /api/chats — list the signed-in user's chats, most recently created first
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("chats")
    .select("id, title, created_at") // FIX 1: updated_at hatakar created_at kiya
    .eq("user_id", userId)
    .order("created_at", { ascending: false }); // FIX 2: sort by created_at

  if (error) {
    console.error("List chats error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Shape to match ChatSidebar's Chat type
  const chats = (data || []).map((c) => ({
    id: c.id,
    title: c.title,
    updatedAt: c.created_at, // FIX 3: Frontend ke liye map kar diya
  }));

  return NextResponse.json(chats);
}

// POST /api/chats — create a new empty chat, returns its id
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const title = typeof body?.title === "string" && body.title.trim() ? body.title.trim() : "New Chat";

  const { data, error } = await supabase
    .from("chats")
    .insert({ user_id: userId, title })
    .select("id, title, created_at") // FIX 4: updated_at hatakar created_at kiya
    .single();

  if (error) {
    console.error("Create chat error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // FIX 5: Return created_at
  return NextResponse.json({ id: data.id, title: data.title, updatedAt: data.created_at });
}