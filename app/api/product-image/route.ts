// app/api/product-image/route.ts
import { NextRequest, NextResponse } from "next/server";
import { generateProductImageSet } from "@/app/lib/googleImageGen";

export const runtime = "nodejs";
export const maxDuration = 60; // image generation can take a bit — raise if your host allows

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("image") as File | null;
    const posesRaw = formData.get("poses") as string | null; // JSON string array
    const modelType = (formData.get("modelType") as string | null) || "model";

    if (!file) {
      return NextResponse.json(
        { error: "No image file uploaded (field name must be 'image')." },
        { status: 400 }
      );
    }
    if (!posesRaw) {
      return NextResponse.json(
        { error: "No poses provided (field name must be 'poses', JSON array of strings)." },
        { status: 400 }
      );
    }

    let poses: string[];
    try {
      poses = JSON.parse(posesRaw);
      if (!Array.isArray(poses) || poses.length === 0) throw new Error();
    } catch {
      return NextResponse.json(
        { error: "'poses' must be a non-empty JSON array of strings." },
        { status: 400 }
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const imageBase64 = bytes.toString("base64");
    const mimeType = file.type || "image/jpeg";

    const results = await generateProductImageSet(
      { imageBase64, mimeType, modelType },
      poses
    );

    if (results.length === 0) {
      return NextResponse.json(
        { error: "All pose generations failed. Try a clearer product photo or simpler pose text." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      images: results.map((r) => ({
        dataUrl: `data:${r.mimeType};base64,${r.imageBase64}`,
      })),
      requested: poses.length,
      succeeded: results.length,
    });
  } catch (err: any) {
    console.error("product-image route error:", err);
    return NextResponse.json(
      { error: err?.message || "Unexpected server error." },
      { status: 500 }
    );
  }
}