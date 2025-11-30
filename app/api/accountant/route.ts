// app/api/accountant/route.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleGenerativeAIStream, StreamingTextResponse } from "ai";

export const runtime = "edge";

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

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) return new Response("Missing API Key", { status: 500 });

    const url = new URL(req.url);
    const debug = url.searchParams.get("debug") === "true";

    const body = await req.json().catch(() => ({}));

    // ---- STRONG ACCOUNTANT SYSTEM PROMPT (also included as first "system" content) ----
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

    const messages = Array.isArray(body.messages) ? body.messages : [];
    const lastMessage = messages.length ? messages[messages.length - 1] : { content: "" };
    const historyMessages = messages.length > 1 ? messages.slice(0, -1) : [];

    const genAI = new GoogleGenerativeAI(apiKey);

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      // keep systemInstruction too (belt-and-suspenders)
      systemInstruction: ACCOUNTANT_PROMPT,
    });

    // Build contents and ensure first message is system role
    const contents: any[] = [];
    contents.push({ role: "system", parts: [{ text: ACCOUNTANT_PROMPT }] });

    for (const msg of historyMessages) {
      const role = msg.role === "user" ? "user" : msg.role === "assistant" ? "assistant" : "user";
      if (msg.content) contents.push({ role, parts: [{ text: safeTrim(msg.content) }] });
    }

    // Current Message & image handling
    const userText = safeTrim(lastMessage.content, 4000);
    const hasAttachment =
      Array.isArray(lastMessage.experimental_attachments) &&
      lastMessage.experimental_attachments.length > 0;

    if (hasAttachment) {
      const att = lastMessage.experimental_attachments[0];
      let base64: string | null = null;
      let mimeType = "image/png";

      if (att?.url) {
        if (typeof att.url === "string" && att.url.startsWith("data:")) {
          const comma = att.url.indexOf(",");
          mimeType = att.url.slice(5, comma).split(";")[0] ?? "image/png";
          base64 = att.url.slice(comma + 1);
        } else if (typeof att.url === "string") {
          base64 = await urlToBase64(att.url);
        }
      }

      if (base64) {
        contents.push({
          role: "user",
          parts: [
            { text: userText ? userText : "Analyze this document for accounting data and return JSON only." },
            { inlineData: { data: base64, mimeType } },
          ],
        });
      } else {
        // attachment present but failed -> push text and ask the model to instruct user
        contents.push({
          role: "user",
          parts: [{ text: userText + " (attachment present but could not fetch the image)." }],
        });
      }
    } else {
      // no attachment - send the user text (could be CSV or question)
      contents.push({ role: "user", parts: [{ text: userText || "" }] });
    }

    // DEBUG: log contents sent to model
    console.log("ACCOUNTANT -> contents:", JSON.stringify(contents, null, 2));

    // If debug param set, use non-streaming call to inspect raw output
    if (debug && typeof (model as any).generateText === "function") {
      try {
        const resp = await (model as any).generateText({
          contents,
          generationConfig: { temperature: 0.1, maxOutputTokens: 2000 },
        });

        // Depending on SDK shape - attempt to extract text:
        const raw = JSON.stringify(resp, null, 2);
        console.log("DEBUG raw model response:", raw);
        // return raw for inspection
        return new Response(raw, { status: 200, headers: { "Content-Type": "application/json" } });
      } catch (e) {
        console.error("Debug generateText error:", e);
      }
    }

    // Production: streaming response
    const responseStream = await (model as any).generateContentStream({
      contents,
      generationConfig: { temperature: 0.1, maxOutputTokens: 2000 },
    });

    return new StreamingTextResponse(GoogleGenerativeAIStream(responseStream));
  } catch (err: any) {
    console.error("ACCOUNTANT route error:", err);
    return new Response("Error", { status: 500 });
  }
}
