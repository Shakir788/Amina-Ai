// app/api/chats/[id]/messages/route.ts

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin as supabase } from "@/app/lib/supabaseAdmin";

/*
 * ---------------------------------------------------------
 * SUPABASE STORAGE
 * ---------------------------------------------------------
 *
 * All generated/edited base64 images are uploaded to:
 *
 *     chat-images
 *
 * The messages table stores only the public URL.
 */

const IMAGE_BUCKET = "chat-images";

async function ensureImageBucket(): Promise<boolean> {
  try {
    const { data: bucket, error: getError } =
      await supabase.storage.getBucket(IMAGE_BUCKET);

    /*
     * Bucket doesn't exist.
     * Create it as public.
     */
    if (getError || !bucket) {
      console.log(
        `📦 Creating Supabase Storage bucket: ${IMAGE_BUCKET}`
      );

      const { error: createError } =
        await supabase.storage.createBucket(
          IMAGE_BUCKET,
          {
            public: true,
            fileSizeLimit: "20MB",
            allowedMimeTypes: [
              "image/png",
              "image/jpeg",
              "image/jpg",
              "image/webp",
              "image/gif",
            ],
          }
        );

      /*
       * If another request created it at the same time,
       * don't treat that as a fatal problem.
       */
      if (
        createError &&
        !createError.message
          ?.toLowerCase()
          .includes("already exists")
      ) {
        console.error(
          "❌ Create image bucket error:",
          createError
        );

        return false;
      }

      return true;
    }

    /*
     * Bucket already exists but might be private.
     *
     * The Vault needs a public URL because we store
     * getPublicUrl() in messages.image_url.
     */
    if (bucket.public !== true) {
      console.log(
        `🔓 Making ${IMAGE_BUCKET} bucket public...`
      );

      const { error: updateError } =
        await supabase.storage.updateBucket(
          IMAGE_BUCKET,
          {
            public: true,
          }
        );

      if (updateError) {
        console.error(
          "❌ Failed to make image bucket public:",
          updateError
        );

        return false;
      }
    }

    return true;

  } catch (error) {
    console.error(
      "❌ Storage bucket check failed:",
      error
    );

    return false;
  }
}

/**
 * Upload a base64 data URL to Supabase Storage
 * and return a public URL.
 *
 * Returns null if upload fails.
 */
async function uploadBase64Image(
  dataUrl: string,
  chatId: string
): Promise<string | null> {

  /*
   * Gemini normally returns:
   *
   * data:image/png;base64,AAAA...
   *
   * or:
   *
   * data:image/jpeg;base64,AAAA...
   */

  const match = dataUrl.match(
    /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/
  );

  if (!match) {
    console.error(
      "❌ Invalid image data URL received."
    );

    return null;
  }

  const [, mimeType, base64Data] = match;

  /*
   * Normalize extension.
   */
  let ext =
    mimeType
      .split("/")
      .pop()
      ?.toLowerCase() || "png";

  /*
   * jpg is the usual extension for image/jpeg.
   */
  if (ext === "jpeg") {
    ext = "jpg";
  }

  /*
   * Make sure the bucket is available.
   */
  const bucketReady =
    await ensureImageBucket();

  if (!bucketReady) {
    console.error(
      "❌ Image bucket is not ready."
    );

    return null;
  }

  /*
   * Unique path per chat/image.
   */
  const path =
    `${chatId}/` +
    `${Date.now()}-` +
    `${Math.random()
      .toString(36)
      .slice(2)}.` +
    `${ext}`;

  try {
    const buffer =
      Buffer.from(base64Data, "base64");

    console.log(
      `⬆️ Uploading image to Supabase Storage: ${path}`
    );

    const { error: uploadError } =
      await supabase.storage
        .from(IMAGE_BUCKET)
        .upload(
          path,
          buffer,
          {
            contentType: mimeType,
            upsert: false,
            cacheControl: "31536000",
          }
        );

    if (uploadError) {
      console.error(
        "❌ Image upload error:",
        uploadError
      );

      return null;
    }

    /*
     * Get the public URL.
     */
    const {
      data: publicUrlData
    } =
      supabase.storage
        .from(IMAGE_BUCKET)
        .getPublicUrl(path);

    const publicUrl =
      publicUrlData?.publicUrl;

    if (!publicUrl) {
      console.error(
        "❌ Supabase returned no public URL."
      );

      return null;
    }

    console.log(
      "✅ Image uploaded successfully:"
    );

    console.log(publicUrl);

    return publicUrl;

  } catch (error) {
    console.error(
      "❌ Exception while uploading image:",
      error
    );

    return null;
  }
}

/*
 * ---------------------------------------------------------
 * POST /api/chats/:id/messages
 * ---------------------------------------------------------
 *
 * Appends a message and updates chat.updated_at.
 *
 * imageUrl:
 *   - base64 data URL → uploads to Supabase Storage
 *   - hosted URL → stores directly
 */

export async function POST(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  }
) {
  /*
   * -------------------------------------------------------
   * AUTH
   * -------------------------------------------------------
   */

  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json(
      {
        error: "Unauthorized",
      },
      {
        status: 401,
      }
    );
  }

  const { id } = await params;

  /*
   * -------------------------------------------------------
   * BODY
   * -------------------------------------------------------
   */

  const body =
    await req.json().catch(() => null);

  const role = body?.role;
  const content = body?.content;

  const rawImageUrl =
    typeof body?.imageUrl === "string" &&
    body.imageUrl.trim()
      ? body.imageUrl.trim()
      : null;

  /*
   * -------------------------------------------------------
   * VALIDATION
   * -------------------------------------------------------
   */

  if (
    role !== "user" &&
    role !== "assistant"
  ) {
    return NextResponse.json(
      {
        error:
          "role must be 'user' or 'assistant'",
      },
      {
        status: 400,
      }
    );
  }

  if (
    typeof content !== "string" ||
    !content.trim()
  ) {
    return NextResponse.json(
      {
        error: "content is required",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * -------------------------------------------------------
   * VERIFY CHAT OWNERSHIP
   * -------------------------------------------------------
   */

  const {
    data: chat,
    error: chatError,
  } = await supabase
    .from("chats")
    .select("user_id")
    .eq("id", id)
    .single();

  if (chatError) {
    console.error(
      "Fetch chat ownership error:",
      chatError
    );
  }

  if (
    !chat ||
    chat.user_id !== userId
  ) {
    return NextResponse.json(
      {
        error: "Forbidden",
      },
      {
        status: 403,
      }
    );
  }

  /*
   * -------------------------------------------------------
   * IMAGE HANDLING
   * -------------------------------------------------------
   */

  let imageUrl: string | null = null;

  if (rawImageUrl) {

    /*
     * Base64 image:
     *
     * data:image/png;base64,...
     *
     * Upload it to Storage first.
     */
    if (
      rawImageUrl.startsWith(
        "data:image/"
      )
    ) {
      imageUrl =
        await uploadBase64Image(
          rawImageUrl,
          id
        );

      /*
       * IMPORTANT:
       *
       * Do NOT silently pretend the image was saved.
       *
       * If upload failed, log it clearly.
       */
      if (!imageUrl) {
        console.error(
          "❌ Image was received but could not be saved to Supabase Storage."
        );

        return NextResponse.json(
          {
            error:
              "Message saved, but image upload failed.",
          },
          {
            status: 500,
          }
        );
      }

    } else {

      /*
       * Already-hosted URL.
       */
      imageUrl = rawImageUrl;
    }
  }

  /*
   * -------------------------------------------------------
   * INSERT MESSAGE
   * -------------------------------------------------------
   */

  const {
    data: message,
    error: insertError,
  } = await supabase
    .from("messages")
    .insert({
      chat_id: id,
      role,
      content,
      image_url: imageUrl,
    })
    .select(
      "id, role, content, image_url, created_at"
    )
    .single();

  if (insertError) {
    console.error(
      "❌ Save message error:",
      insertError
    );

    return NextResponse.json(
      {
        error: insertError.message,
      },
      {
        status: 500,
      }
    );
  }

  /*
   * -------------------------------------------------------
   * UPDATE CHAT TIMESTAMP
   * -------------------------------------------------------
   */

  await supabase
    .from("chats")
    .update({
      updated_at:
        new Date().toISOString(),
    })
    .eq("id", id);

  /*
   * -------------------------------------------------------
   * SUCCESS
   * -------------------------------------------------------
   */

  console.log(
    `✅ Message saved: ${message.id}`
  );

  if (message.image_url) {
    console.log(
      "🖼️ Image URL saved to messages.image_url:"
    );

    console.log(
      message.image_url
    );
  }

  return NextResponse.json(
    message
  );
}