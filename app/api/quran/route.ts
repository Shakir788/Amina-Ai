// app/api/quran/route.ts
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

function safeTrim(s: any) {
  return typeof s === "string" ? s.trim() : "";
}

function loadData(): Ayah[] {
  try {
    const filePathSample = path.join(process.cwd(), "data", "quran.sample.json");
    const filePathFull = path.join(process.cwd(), "data", "quran.json");
    const filePath = fs.existsSync(filePathFull) ? filePathFull : filePathSample;
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw) as Ayah[];
  } catch (e) {
    console.error("Failed to load quran data:", e);
    return [];
  }
}

function findAyah(data: Ayah[], s: number, a: number) {
  return data.find((x) => x.surah === s && x.ayah === a) || null;
}

function searchKeyword(data: Ayah[], q: string, limit = 5) {
  const k = q.toLowerCase();
  return data.filter(d =>
    (d.translation_en && d.translation_en.toLowerCase().includes(k)) ||
    (d.arabic && d.arabic.toLowerCase().includes(k))
  ).slice(0, limit);
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const s = url.searchParams.get("s");
    const a = url.searchParams.get("a");
    const q = url.searchParams.get("q");
    const data = loadData();

    if (s && a) {
      const surah = parseInt(s, 10);
      const ayah = parseInt(a, 10);
      const found = findAyah(data, surah, ayah);
      if (found) {
        return NextResponse.json(found);
      } else {
        return new Response("Not found", { status: 404 });
      }
    }

    if (q) {
      const results = searchKeyword(data, q, 10);
      return NextResponse.json(results);
    }

    // default: return small info
    return NextResponse.json({ message: "Quran API ready. Use ?s=2&a=286 or ?q=patience" });
  } catch (err) {
    console.error(err);
    return new Response("Server error", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    // Accept messages array like your chat route: { messages: [{role:'user', content: 'recite 2:286'}] }
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const last = messages.length ? safeTrim(messages[messages.length - 1].content) : "";

    const data = loadData();

    // parse "2:286" or "recite 2:286"
    const m = last.match(/(\d{1,3})\s*[:]\s*(\d{1,3})/);
    if (m) {
      const s = parseInt(m[1], 10);
      const a = parseInt(m[2], 10);
      const found = findAyah(data, s, a);
      if (found) return NextResponse.json(found);
      return new Response(`Surah ${s}:${a} not found`, { status: 404 });
    }

    // simple keyword search
    if (last) {
      const results = searchKeyword(data, last, 5);
      if (results.length > 0) return NextResponse.json(results);
    }

    return NextResponse.json({ message: "Kuch samajh nahi aaya. Type 'recite 2:286' or 'ayat about patience'." });
  } catch (e) {
    console.error(e);
    return new Response("Error", { status: 500 });
  }
}
