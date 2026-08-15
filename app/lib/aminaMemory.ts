// app/lib/aminaMemory.ts
// =====================================================
// 🧠 AMINA MEMORY ENGINE v3
// Reliable long-term + profile memory
//
// - Uses the current Gemini Embedding 2 API
// - Keeps file-based storage for compatibility
// - Never blocks chat if embeddings fail
// - Protects against old/incompatible embedding vectors
// - Preserves the existing public API:
//     setProfile()
//     getProfile()
//     remember()
//     recall()
//     clearMemory()
// =====================================================

import fs from "fs";
import path from "path";
import crypto from "crypto";

/* =====================================================
   TYPES
===================================================== */

export type MemoryItem = {
  id: string;
  text: string;
  embedding: number[];
  createdAt: number;
  tags?: string[];

  // New metadata. Optional so old memory files remain readable.
  embeddingModel?: string;
  embeddingDimensions?: number;
};

type MemoryStore = {
  profile: Record<string, string>;
  memories: MemoryItem[];
};

/* =====================================================
   CONFIG
===================================================== */

const MEMORY_DIR = path.join(process.cwd(), "data");
const MEMORY_FILE = path.join(MEMORY_DIR, "amina.memory.json");

//
// Current Gemini embedding model.
//
// Google has deprecated the older:
//   text-embedding-004
//   embedding-001
//   gemini-embedding-001
//
// Gemini Embedding 2 is the current replacement.
//
const EMBEDDING_MODEL = "gemini-embedding-2";

// 768 is a supported/recommended output size and keeps the
// local JSON memory file much smaller than the default vector.
const EMBEDDING_DIMENSIONS = 768;

const MAX_MEMORIES = 500;

// Never let memory embedding work hold the chat for long.
const EMBEDDING_TIMEOUT_MS = 3000;

/* =====================================================
   INIT STORAGE
===================================================== */

function ensureStorage() {
  if (!fs.existsSync(MEMORY_DIR)) {
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
  }

  if (!fs.existsSync(MEMORY_FILE)) {
    const empty: MemoryStore = {
      profile: {},
      memories: [],
    };

    fs.writeFileSync(
      MEMORY_FILE,
      JSON.stringify(empty, null, 2),
      "utf-8"
    );
  }
}

function loadStore(): MemoryStore {
  ensureStorage();

  try {
    const raw = fs.readFileSync(
      MEMORY_FILE,
      "utf-8"
    );

    const parsed = JSON.parse(raw);

    return {
      profile:
        parsed?.profile &&
        typeof parsed.profile === "object"
          ? parsed.profile
          : {},

      memories:
        Array.isArray(parsed?.memories)
          ? parsed.memories
          : [],
    };
  } catch (error) {
    console.error(
      "Memory Load Failed:",
      error
    );

    return {
      profile: {},
      memories: [],
    };
  }
}

function saveStore(store: MemoryStore) {
  try {
    ensureStorage();

    fs.writeFileSync(
      MEMORY_FILE,
      JSON.stringify(store, null, 2),
      "utf-8"
    );
  } catch (error) {
    console.error(
      "Memory Save Failed:",
      error
    );
  }
}

/* =====================================================
   API KEY
===================================================== */

function getGoogleApiKey(): string {
  return (
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    ""
  );
}

/* =====================================================
   EMBEDDINGS
===================================================== */

/**
 * Generate an embedding using the current Gemini Embedding 2
 * REST endpoint.
 *
 * We intentionally use fetch here instead of the old
 * @google/generative-ai embedding API because:
 *
 *   - text-embedding-004 is retired
 *   - embedding-001 is retired
 *   - Gemini Embedding 2 is the current model
 *   - AbortController gives us a real timeout
 *
 * If anything fails, [] is returned and the rest of AMINA
 * continues normally.
 */
async function embedText(
  text: string
): Promise<number[]> {
  const cleanText = text?.trim();

  if (!cleanText) {
    return [];
  }

  const apiKey = getGoogleApiKey();

  if (!apiKey) {
    console.warn(
      "⚠️ Memory embedding skipped: Google API key missing."
    );

    return [];
  }

  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, EMBEDDING_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },

        body: JSON.stringify({
          content: {
            parts: [
              {
                text: cleanText,
              },
            ],
          },

          embedContentConfig: {
            outputDimensionality:
              EMBEDDING_DIMENSIONS,
          },
        }),

        signal: controller.signal,
      }
    );

    if (!response.ok) {
      const errorText =
        await response.text().catch(() => "");

      console.warn(
        `⚠️ Memory embedding failed (${response.status}):`,
        errorText.slice(0, 500)
      );

      return [];
    }

    const data = await response.json();

    const values =
      data?.embedding?.values;

    if (
      !Array.isArray(values) ||
      values.length === 0
    ) {
      console.warn(
        "⚠️ Memory embedding returned no vector."
      );

      return [];
    }

    const numericValues = values.filter(
      (value: unknown): value is number =>
        typeof value === "number" &&
        Number.isFinite(value)
    );

    if (
      numericValues.length !==
      EMBEDDING_DIMENSIONS
    ) {
      console.warn(
        `⚠️ Unexpected embedding dimension: ${numericValues.length}. Expected ${EMBEDDING_DIMENSIONS}.`
      );

      return [];
    }

    return numericValues;
  } catch (error: any) {
    if (error?.name === "AbortError") {
      console.warn(
        `⚠️ Memory embedding timed out after ${EMBEDDING_TIMEOUT_MS}ms.`
      );
    } else {
      console.warn(
        "⚠️ Memory embedding skipped:",
        error?.message || error
      );
    }

    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

/* =====================================================
   SIMILARITY
===================================================== */

function cosineSimilarity(
  a: number[],
  b: number[]
): number {
  /*
   * IMPORTANT:
   *
   * Older memory files may contain vectors generated by
   * a different embedding model/dimension.
   *
   * Never compare vectors with different dimensions.
   */
  if (
    !Array.isArray(a) ||
    !Array.isArray(b) ||
    a.length === 0 ||
    b.length === 0 ||
    a.length !== b.length
  ) {
    return 0;
  }

  let dot = 0;
  let na = 0;
  let nb = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }

  if (na === 0 || nb === 0) {
    return 0;
  }

  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/* =====================================================
   PUBLIC API
===================================================== */

/**
 * 🔐 Save profile facts.
 *
 * Example:
 *   setProfile("name", "Shakir")
 *
 * Profile memory does NOT require embeddings.
 * This is intentional: important facts should not disappear
 * just because the embedding API is temporarily unavailable.
 */
export function setProfile(
  key: string,
  value: string
) {
  if (!key?.trim() || !value?.trim()) {
    return;
  }

  const store = loadStore();

  store.profile[key.trim()] =
    value.trim();

  saveStore(store);
}

/**
 * 📖 Get profile
 */
export function getProfile(): Record<string, string> {
  return loadStore().profile;
}

/**
 * 🧠 Save long-term semantic memory.
 *
 * Existing behavior is preserved:
 * - empty text ignored
 * - duplicates ignored
 * - maximum 500 memories
 *
 * Improvement:
 * - uses Gemini Embedding 2
 * - embedding failure never crashes AMINA
 */
export async function remember(
  text: string,
  tags: string[] = []
): Promise<void> {
  if (!text || !text.trim()) {
    return;
  }

  const cleanText = text.trim();
  const store = loadStore();

  /*
   * Avoid duplicates using normalized text.
   */
  const normalized =
    cleanText.toLowerCase();

  const duplicate =
    store.memories.find(
      (memory) =>
        memory?.text
          ?.trim()
          .toLowerCase() === normalized
    );

  if (duplicate) {
    return;
  }

  /*
   * Generate the new embedding.
   */
  const embedding =
    await embedText(cleanText);

  /*
   * Do not store a semantic memory without a valid
   * embedding. Otherwise it would never be retrievable
   * through semantic recall.
   */
  if (embedding.length === 0) {
    console.warn(
      "⚠️ Memory not stored because embedding generation failed."
    );

    return;
  }

  const memory: MemoryItem = {
    id: crypto.randomUUID(),

    text: cleanText,

    embedding,

    createdAt: Date.now(),

    tags: Array.isArray(tags)
      ? tags
      : [],

    embeddingModel:
      EMBEDDING_MODEL,

    embeddingDimensions:
      embedding.length,
  };

  store.memories.unshift(memory);

  /*
   * Keep the newest memories only.
   */
  if (
    store.memories.length >
    MAX_MEMORIES
  ) {
    store.memories =
      store.memories.slice(
        0,
        MAX_MEMORIES
      );
  }

  saveStore(store);

  console.log(
    `🧠 Memory saved: "${cleanText.slice(0, 100)}"`
  );
}

/**
 * 🔍 Recall relevant memories.
 *
 * The query is embedded with the SAME current model and
 * dimension as new memories.
 *
 * Old/incompatible vectors are simply ignored.
 */
export async function recall(
  query: string,
  limit = 5
): Promise<string[]> {
  try {
    const store = loadStore();

    if (
      !Array.isArray(store.memories) ||
      store.memories.length === 0
    ) {
      return [];
    }

    if (!query || !query.trim()) {
      return [];
    }

    /*
     * Protect the caller from an invalid limit.
     */
    const safeLimit = Math.max(
      1,
      Math.min(
        Number.isFinite(limit)
          ? Math.floor(limit)
          : 5,
        20
      )
    );

    /*
     * Generate query embedding.
     */
    const queryEmbedding =
      await embedText(query);

    if (
      queryEmbedding.length === 0
    ) {
      return [];
    }

    /*
     * Rank only compatible vectors.
     */
    const ranked = store.memories
      .filter(
        (memory) =>
          Array.isArray(
            memory?.embedding
          ) &&
          memory.embedding.length ===
            queryEmbedding.length
      )
      .map((memory) => ({
        text: memory.text,
        score: cosineSimilarity(
          queryEmbedding,
          memory.embedding
        ),
      }))
      .filter(
        (item) =>
          Number.isFinite(item.score) &&
          item.score > 0.65
      )
      .sort(
        (a, b) =>
          b.score - a.score
      )
      .slice(0, safeLimit)
      .map((item) => item.text);

    if (ranked.length > 0) {
      console.log(
        `🧠 Memory recall: ${ranked.length} relevant memories found.`
      );
    }

    return ranked;
  } catch (error) {
    /*
     * Memory must NEVER be allowed to break normal chat.
     */
    console.error(
      "Recall Error (Ignored):",
      error
    );

    return [];
  }
}

/**
 * 🧹 Optional reset (dev only)
 */
export function clearMemory() {
  const empty: MemoryStore = {
    profile: {},
    memories: [],
  };

  saveStore(empty);

  console.log(
    "🧹 Amina memory cleared."
  );
}
