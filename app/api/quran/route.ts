// app/api/quran/route.ts
// =======================================
// ✅ FAST, SAFE, CLEAN QURAN API ROUTE
// =======================================

import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

type Ayah = {
  surah: number;
  ayah: number;
  arabic: string;
  translation_en: string;
};

// -------------------------------
// Helper: Safe Trim
// -------------------------------
function safeTrim(s: any) {
  return typeof s === "string" ? s.trim() : "";
}

// -------------------------------
// Load Quran JSON (fallback safe)
// -------------------------------
function loadQuran(): Ayah[] {
  try {
    const fullPath = path.join(process.cwd(), "data", "quran.json");
    const samplePath = path.join(process.cwd(), "data", "quran.sample.json");

    const finalPath = fs.existsSync(fullPath) ? fullPath : samplePath;
    const raw = fs.readFileSync(finalPath, "utf8");

    return JSON.parse(raw) as Ayah[];
  } catch (err) {
    console.error("❌ Failed to load Quran data:", err);
    return [];
  }
}

// -------------------------------
// Find Specific Ayah
// -------------------------------
function findAyah(data: Ayah[], s: number, a: number) {
  return data.find(x => x.surah === s && x.ayah === a) || null;
}

// -------------------------------
// Keyword Search (Arabic + English)
// -------------------------------
function searchAyat(data: Ayah[], keyword: string, limit = 5) {
  const k = keyword.toLowerCase();

  return data
    .filter(d =>
      d.translation_en?.toLowerCase().includes(k) ||
      d.arabic?.toLowerCase().includes(k)
    )
    .slice(0, limit);
}

// -------------------------------
// ========== GET ROUTE ==========
// Supports:
//  → /api/quran?s=2&a=255
//  → /api/quran?q=mercy
// -------------------------------
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const s = url.searchParams.get("s");
    const a = url.searchParams.get("a");
    const q = url.searchParams.get("q");

    const data = loadQuran();

    // ----------------
    // Search by Ayah
    // ----------------
    if (s && a) {
      const surah = parseInt(s, 10);
      const ayah = parseInt(a, 10);

      const found = findAyah(data, surah, ayah);
      if (found) return NextResponse.json(found);

      return new Response("Ayah not found", { status: 404 });
    }

    // ----------------
    // Keyword Search
    // ----------------
    if (q) {
      const results = searchAyat(data, q, 10);
      return NextResponse.json(results);
    }

    // ----------------
    // Default Response
    // ----------------
    return NextResponse.json({
      message: "Quran API ready. Use ?s=2&a=286 or ?q=mercy"
    });
  } catch (err) {
    console.error("GET Route Error:", err);
    return new Response("Server error", { status: 500 });
  }
}

// -------------------------------
// ========== POST ROUTE ==========
// Supports Chat-like input:
// { messages: [{ role: "user", content: "recite 2:255" }] }
// -------------------------------
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const lastMsg = messages.length ? safeTrim(messages[messages.length - 1].content) : "";

    const data = loadQuran();

    if (!lastMsg) {
      return NextResponse.json({
        message: "Please provide text like 'recite 2:255' or 'ayat about mercy'"
      });
    }

    // -------------------------------
    // A) Parse Ayah Pattern "2:255"
    // -------------------------------
    const match = lastMsg.match(/(\d{1,3})\s*[:]\s*(\d{1,3})/);
    if (match) {
      const surah = parseInt(match[1], 10);
      const ayah = parseInt(match[2], 10);

      const found = findAyah(data, surah, ayah);
      if (found) return NextResponse.json(found);

      return new Response(`Surah ${surah}:${ayah} not found`, { status: 404 });
    }

    // -------------------------------
    // B) Keyword Search
    // -------------------------------
    const results = searchAyat(data, lastMsg, 5);
    if (results.length > 0) return NextResponse.json(results);

    // -------------------------------
    // Fallback
    // -------------------------------
    return NextResponse.json({
      message:
        "Kuch samajh nahi aaya. Try: 'recite 1:1', 'look for mercy', or 'ayat about patience'."
    });
  } catch (err) {
    console.error("POST Route Error:", err);
    return new Response("Server error", { status: 500 });
  }
}
