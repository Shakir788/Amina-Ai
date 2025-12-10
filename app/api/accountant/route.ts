// app/api/accountant/route.ts
import { NextResponse } from "next/server";

export const runtime = "edge";

/* ------------------ Helpers (same as yours) ------------------ */
function safeTrim(s: any, max = 4000) {
  if (!s || typeof s !== "string") return "";
  const t = s.trim();
  return t.length > max ? t.slice(0, max) : t;
}

async function urlToBase64(u: string) {
  try {
    const res = await fetch(u);
    if (!res.ok) throw new Error("Failed fetching image: " + res.status);
    const buffer = await res.arrayBuffer();

    // @ts-ignore
    if (typeof Buffer !== "undefined") return Buffer.from(buffer).toString("base64");

    let binary = "";
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.slice(i, i + chunkSize)));
    }
    if (typeof btoa !== "undefined") return btoa(binary);
    return null;
  } catch (e) {
    console.error("urlToBase64 error:", e);
    return null;
  }
}

/* ------------------ ✅ STRONG ACCOUNTANT SYSTEM PROMPT (UNCHANGED) ------------------ */
const ACCOUNTANT_PROMPT = `
You are "Amina CPA", a professional Accountant & Excel Expert Assistant.

RULES (MUST FOLLOW EXACTLY):
1) INPUT: You'll receive a JSON array or an image attachment with accounting rows.
2) OUTPUT: Return JSON ONLY (no extra text, no explanation).
   Schema:
   {
     "rows": [
       {
         "item": "string",
         "price": 0.00,
         "qty": 0,
         "tax": 0.00,
         "computedTotal": 0.00,
         "providedTotal": 0.00 | null,
         "issue": null | "string"
       }
     ],
     "summary": {
       "rowCount": 0,
       "grandTotal": 0.00,
       "totalTax": 0.00
     },
     "issues": [ { "row": 0, "message": "Total mismatch" } ]
   }

3) COMPUTATION: computedTotal = price * qty + tax (assume tax is absolute amount unless field named tax_percent).
4) ROUND numbers to 2 decimals.
5) DO NOT INVENT DATA. If data is missing, mark fields null, and add an issue entry.
6) If an image is provided, extract only visible rows. Do not invent extra rows.
7) Temperature 0.1 - deterministic output.

Return strictly parsable JSON following exactly the schema above.
`.trim();

/* ------------------ ✅ OpenRouter Key Rotation ------------------ */
const OPENROUTER_KEYS = (process.env.OPENROUTER_KEYS || "")
  .split(",")
  .map(k => k.trim())
  .filter(Boolean);

let OR_KEY_INDEX = 0;
function getNextOpenRouterKey() {
  if (!OPENROUTER_KEYS.length) return null;
  const k = OPENROUTER_KEYS[OR_KEY_INDEX % OPENROUTER_KEYS.length];
  OR_KEY_INDEX++;
  return k;
}

/* ------------------ ✅ OpenRouter Call ------------------ */
async function callOpenRouter(messages: { role: string; content: string }[]) {
  const key = getNextOpenRouterKey();
  if (!key) throw new Error("No OpenRouter key configured");

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "mistralai/mistral-7b-instruct",
      messages,
      temperature: 0.1,
      max_tokens: 2000,
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`OpenRouter failed ${res.status}: ${txt}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

/* ------------------ ✅ HuggingFace Fallback ------------------ */
async function callHuggingFace(prompt: string) {
  const hfKey = process.env.HUGGINGFACE_API_KEY;
  if (!hfKey) throw new Error("No HuggingFace key");

  const res = await fetch(
    "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${hfKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: { max_new_tokens: 2000, temperature: 0.1 },
      }),
    }
  );

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`HF failed ${res.status}: ${t}`);
  }

  const data = await res.json();
  if (Array.isArray(data) && data[0]?.generated_text) return data[0].generated_text;
  if (data?.generated_text) return data.generated_text;
  return JSON.stringify(data).slice(0, 4000);
}

/* ------------------ ✅ MAIN POST HANDLER ------------------ */
export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const debug = url.searchParams.get("debug") === "true";

    const body = await req.json().catch(() => ({}));
    const messages = Array.isArray(body.messages) ? body.messages : [];

    const lastMessage = messages.length ? messages[messages.length - 1] : { content: "" };
    const historyMessages = messages.length > 1 ? messages.slice(0, -1) : [];

    /* ---------- Build chat messages ---------- */
    const chatMessages: { role: string; content: string }[] = [];

    // SYSTEM role (first always)
    chatMessages.push({
      role: "system",
      content: ACCOUNTANT_PROMPT,
    });

    for (const msg of historyMessages) {
      const role = msg.role === "assistant" ? "assistant" : "user";
      if (msg.content) {
        chatMessages.push({
          role,
          content: safeTrim(msg.content),
        });
      }
    }

    // Current message + image handling
    const userText = safeTrim(lastMessage.content, 4000);
    const hasAttachment =
      Array.isArray(lastMessage.experimental_attachments) &&
      lastMessage.experimental_attachments.length > 0;

    if (hasAttachment) {
      const att = lastMessage.experimental_attachments[0];
      let base64: string | null = null;

      if (att?.url && typeof att.url === "string") {
        if (att.url.startsWith("data:")) {
          base64 = att.url.split(",")[1];
        } else {
          base64 = await urlToBase64(att.url);
        }
      }

      if (base64) {
        chatMessages.push({
          role: "user",
          content:
            (userText || "Analyze this document for accounting data and return JSON only.") +
            "\n[Image attached]",
        });
      } else {
        chatMessages.push({
          role: "user",
          content: userText + " (attachment present but could not be fetched)",
        });
      }
    } else {
      chatMessages.push({
        role: "user",
        content: userText || "",
      });
    }

    if (debug) {
      return NextResponse.json({ debugMessages: chatMessages });
    }

    /* ---------- ✅ Try OpenRouter first ---------- */
    try {
      const reply = await callOpenRouter(chatMessages);
      return NextResponse.json(reply, { status: 200 });
    } catch (orErr) {
      console.warn("Accountant OR failed, falling back to HF:", orErr);

      const hfPrompt = chatMessages
        .map(m => `${m.role.toUpperCase()}: ${m.content}`)
        .join("\n\n");

      try {
        const hfReply = await callHuggingFace(hfPrompt);
        return NextResponse.json(hfReply, { status: 200 });
      } catch (hfErr) {
        console.error("Accountant HF failed:", hfErr);

        return NextResponse.json(
          {
            rows: [],
            summary: { rowCount: 0, grandTotal: 0, totalTax: 0 },
            issues: [{ row: 0, message: "AI service unavailable" }],
          },
          { status: 200 }
        );
      }
    }
  } catch (err) {
    console.error("ACCOUNTANT route error:", err);
    return new Response("Error", { status: 500 });
  }
}
