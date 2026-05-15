// app/lib/aminaMemory.ts
// =====================================================
// 🧠 AMINA MEMORY ENGINE v2 (Timeout Protected)
// ChatGPT-style long-term + short-term memory
// Uses Gemini Embeddings + File System
// =====================================================

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";

/* =====================================================
   TYPES
===================================================== */

export type MemoryItem = {
  id: string;
  text: string;
  embedding: number[];
  createdAt: number;
  tags?: string[];
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

const EMBEDDING_MODEL = "text-embedding-004"; // Updated to newer model
const MAX_MEMORIES = 500; // safe limit

/* =====================================================
   INIT STORAGE
===================================================== */

function ensureStorage() {
  if (!fs.existsSync(MEMORY_DIR)) fs.mkdirSync(MEMORY_DIR);
  if (!fs.existsSync(MEMORY_FILE)) {
    const empty: MemoryStore = { profile: {}, memories: [] };
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(empty, null, 2));
  }
}

function loadStore(): MemoryStore {
  ensureStorage();
  try {
    return JSON.parse(fs.readFileSync(MEMORY_FILE, "utf-8"));
  } catch {
    return { profile: {}, memories: [] };
  }
}

function saveStore(store: MemoryStore) {
  try {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(store, null, 2));
  } catch (e) {
    console.error("Memory Save Failed:", e);
  }
}

/* =====================================================
   EMBEDDINGS (WITH TIMEOUT SHIELD 🛡️)
===================================================== */

// 🔥 Helper: 3 Second Timeout Rule
const timeoutPromise = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms));

async function embedText(text: string): Promise<number[]> {
  // 🔥 FIX: Empty text check
  if (!text || !text.trim()) {
    return []; 
  }

  const apiKey =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GOOGLE_API_KEY;

  if (!apiKey) return []; // Bina key ke crash mat karo

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });

  try {
    // 🏁 RACE: Google vs 3 Seconds
    // Jo pehle khatam hoga wahi jeetega. Agar Google slow hai, toh Timeout jeet jayega.
    const result: any = await Promise.race([
        model.embedContent(text),
        timeoutPromise(3000) // 3 Second Max Wait
    ]);
    
    return result.embedding.values;

  } catch (error) {
    console.warn("⚠️ Memory Embedding Skipped (Timeout/Network):", error);
    return []; // Empty bhejo taaki app ruk na jaye
  }
}

/* =====================================================
   SIMILARITY
===================================================== */

function cosineSimilarity(a: number[], b: number[]) {
  // Fix: Agar embedding empty ho, to similarity 0 hai
  if (!a || !b || !a.length || !b.length) return 0;

  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/* =====================================================
   PUBLIC API
===================================================== */

/**
 * 🔐 Save profile facts
 * Example: setProfile("name", "Douaa")
 */
export function setProfile(key: string, value: string) {
  const store = loadStore();
  store.profile[key] = value;
  saveStore(store);
}

/**
 * 📖 Get profile
 */
export function getProfile() {
  return loadStore().profile;
}

/**
 * 🧠 Save long-term memory
 */
export async function remember(
  text: string,
  tags: string[] = []
): Promise<void> {
  // Empty text ko yaad mat rakho
  if (!text || !text.trim()) return;

  const store = loadStore();

  // avoid duplicates
  if (store.memories.find((m) => m.text === text)) return;

  // 🔥 Safe Embed Call
  const embedding = await embedText(text);
  
  // Agar embedding fail hui (Timeout/Network), to save mat karo (Taaki kachra na bhare)
  if (embedding.length === 0) return;

  const memory: MemoryItem = {
    id: crypto.randomUUID(),
    text,
    embedding,
    tags,
    createdAt: Date.now(),
  };

  store.memories.unshift(memory);

  // trim old memories
  if (store.memories.length > MAX_MEMORIES) {
    store.memories = store.memories.slice(0, MAX_MEMORIES);
  }

  saveStore(store);
}

/**
 * 🔍 Recall relevant memories
 */
export async function recall(
  query: string,
  limit = 5
): Promise<string[]> {
  try {
      const store = loadStore();
      if (!store.memories.length) return [];
      if (!query || !query.trim()) return [];

      // 🔥 Safe Embed Call (With 3s Timeout)
      const queryEmbedding = await embedText(query);
      
      // Agar embedding fail hui (Net slow), toh purani yaadein mat dhoondo, 
      // seedha empty return karo taaki Chat na ruke.
      if (queryEmbedding.length === 0) return [];

      const ranked = store.memories
        .map((m) => ({
          text: m.text,
          score: cosineSimilarity(queryEmbedding, m.embedding),
        }))
        .filter((x) => x.score > 0.65) // Thoda loose kiya (0.75 -> 0.65) taaki zyada yaad aaye
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((x) => x.text);

      return ranked;
  } catch (error) {
      console.error("Recall Error (Ignored):", error);
      return []; // Fail safe return
  }
}

/**
 * 🧹 Optional reset (dev only)
 */
export function clearMemory() {
  const empty: MemoryStore = { profile: {}, memories: [] };
  saveStore(empty);
}