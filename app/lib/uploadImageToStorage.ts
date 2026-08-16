// app/lib/uploadImageToStorage.ts
//
// Takes a base64 data URL (what Gemini's image models return) and
// uploads it to Supabase Storage, returning a permanent public URL.
// Used by both imageGen.ts (new images) and editImageWithGemini.ts
// (Product Studio edits) so generated/edited photos survive:
//  - saving to the messages table (a URL fits fine; raw base64 doesn't)
//  - resuming a chat later (the image still loads from storage)
//
// Fails soft: if upload doesn't work (bucket missing, network issue),
// returns null so the caller can fall back to the original base64
// data URL — the feature keeps working, it just won't persist.

import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

const BUCKET = "amina-images";

export async function uploadImageToStorage(
  dataUrl: string,
  folder: string = "generated"
): Promise<string | null> {
  try {
    const match = dataUrl.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
    if (!match) {
      console.warn("uploadImageToStorage: not a valid base64 data URL, skipping upload.");
      return null;
    }
    const [, mimeType, base64Data] = match;
    const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg") || "png";
    const buffer = Buffer.from(base64Data, "base64");
    const path = `${folder}/${crypto.randomUUID()}.${ext}`;

    const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, buffer, {
      contentType: mimeType,
      upsert: false,
    });

    if (error) {
      console.error("uploadImageToStorage: upload failed —", error.message);
      return null;
    }

    const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
    return data?.publicUrl || null;
  } catch (err: any) {
    console.error("uploadImageToStorage: unexpected error —", err?.message || err);
    return null;
  }
}