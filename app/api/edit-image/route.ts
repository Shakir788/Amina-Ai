import { NextRequest, NextResponse } from "next/server";
import { editImageWithGemini } from "@/app/lib/editImageWithGemini";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { image, instruction } = await req.json();

    if (typeof image !== "string" || !image.startsWith("data:image/")) {
      return NextResponse.json({ success: false, error: "Valid image data URL required." }, { status: 400 });
    }
    if (typeof instruction !== "string" || !instruction.trim()) {
      return NextResponse.json({ success: false, error: "Instruction is required." }, { status: 400 });
    }

    const result = await editImageWithGemini(image, instruction);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("edit-image route error:", err);
    return NextResponse.json({ success: false, error: err?.message || "Unexpected server error." }, { status: 500 });
  }
}