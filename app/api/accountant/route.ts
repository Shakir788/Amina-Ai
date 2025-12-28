import { NextResponse } from "next/server";
// 👇 1. IMPORT DNS (Network Fix - Bahut Zaroori Hai)
import dns from 'node:dns'; 

export const runtime = "nodejs";

// 👇 2. MAGIC FIX FOR TIMEOUTS (Force IPv4)
try {
    dns.setDefaultResultOrder('ipv4first');
} catch (e) {
    console.log("DNS setup skipped");
}

// =========================================
// ✅ ACCOUNTANT CONFIG
// =========================================
// 🔥 Using 2.0 Flash because it is BEST for Vision/OCR
const MODEL_NAME = "gemini-2.0-flash"; 

// ---------------------------------------------
// ⭐ HELPER: CLEAN GEMINI JSON
// ---------------------------------------------
function cleanJsonString(text: string) {
  return text.replace(/^```json\s*/, "").replace(/\s*```$/, "").trim();
}

// ---------------------------------------------
// ⭐ STRICT ACCOUNTANT SYSTEM PROMPT
// ---------------------------------------------
const ACCOUNTANT_PROMPT = `
You are "Amina CPA", an expert AI Accountant and Data Extractor.

YOUR GOAL:
1. Analyze the User's Input (Text OR Image).
2. Extract financial data (Items, Prices, Quantities, Taxes).
3. Output STRICT JSON only. Do not speak.

INPUT TYPES:
- **Image (Invoice/Bill/Menu):** Extract every visible line item accurately. Use OCR logic.
- **Text (Data):** Convert the text data into the structured format below.

STRICT JSON SCHEMA (YOU MUST FOLLOW THIS):
{
  "rows": [
    {
      "item": "Description of item",
      "price": 0.00,
      "qty": 1,
      "tax": 0.00,
      "computedTotal": 0.00, 
      "issue": null 
    }
  ],
  "summary": {
    "rowCount": 0,
    "grandTotal": 0.00,
    "totalTax": 0.00
  },
  "issues": []
}

RULES:
1. **computedTotal** = (price * qty) + tax.
2. If specific data is missing (e.g., tax), assume 0 but mention it in "issues" if it looks wrong.
3. If an image is blurry or unreadable, return an issue in the "issues" array.
4. **Rounding:** Always round money to 2 decimal places.
5. **No Chatter:** Do not output "Here is your data". Just the JSON object.
`;

// ---------------------------------------------
// ⭐ GEMINI API CALL
// ---------------------------------------------
async function callGeminiAccountant(userText: string, imageBase64?: string) {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) throw new Error("Missing Google API Key");

  // Format Model ID correctly
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

  // 1. Construct Payload
  const parts: any[] = [];
  
  parts.push({ 
    text: `${ACCOUNTANT_PROMPT}\n\nUSER REQUEST: ${userText || "Analyze this image and extract data."}` 
  });

  if (imageBase64) {
    parts.push({
      inline_data: {
        mime_type: "image/jpeg",
        data: imageBase64
      }
    });
  }

  const body = {
    contents: [{ role: "user", parts: parts }],
    generationConfig: {
      temperature: 0.1, // Precision mode (Creative mode OFF)
      responseMimeType: "application/json", 
    }
  };

  // 2. Fetch
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const txt = await response.text();
    console.error("Accountant API Error:", txt);
    throw new Error(`Gemini Accountant Error: ${txt}`);
  }

  const data = await response.json();
  
  // 3. Extract Text
  const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!candidate) throw new Error("No data returned from Gemini");

  return cleanJsonString(candidate);
}

// ---------------------------------------------
// ⭐ MAIN POST HANDLER
// ---------------------------------------------
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const messages = Array.isArray(body.messages) ? body.messages : [];
    
    // Get the last user message text (if any)
    let userText = "";
    // Check if the structure is from 'useChat' (messages array) or direct payload
    if (messages.length > 0) {
        const lastMsg = messages[messages.length - 1];
        if (typeof lastMsg.content === 'string') {
            userText = lastMsg.content;
        } else if (Array.isArray(lastMsg.content)) {
            // Handle multi-modal content array
            const textPart = lastMsg.content.find((c: any) => c.type === 'text');
            if (textPart) userText = textPart.text;
        }
    }

    // Check for Image Attachment
    let imageBase64: string | undefined = undefined;
    
    // 🔥 FIX 1: Check DIRECT DATA Payload First (Force Send from Frontend)
    if (body.data?.image_base64) {
      console.log("📸 Accountant: Image found in DATA payload");
      const raw = body.data.image_base64;
      const parts = raw.split(",");
      imageBase64 = parts.length > 1 ? parts[1] : raw;
    } 
    // 🔥 FIX 2: Check inside 'messages' content (New Vercel AI SDK format)
    else if (messages.length > 0) {
        const lastMsg = messages[messages.length - 1];
        // If content is array (text + image)
        if (Array.isArray(lastMsg.content)) {
            const imgPart = lastMsg.content.find((c: any) => c.type === 'image');
            if (imgPart && imgPart.image) {
                 console.log("📸 Accountant: Image found in Message Content");
                 const raw = imgPart.image;
                 const parts = raw.split(",");
                 imageBase64 = parts.length > 1 ? parts[1] : raw;
            }
        }
        // Fallback: experimental_attachments
        else if (lastMsg.experimental_attachments?.[0]?.url) {
            console.log("📸 Accountant: Image found in Attachments");
            const dataUrl = lastMsg.experimental_attachments[0].url;
            const parts = dataUrl.split(",");
            imageBase64 = parts.length > 1 ? parts[1] : parts[0];
        }
    }

    console.log(`📊 Accountant (2.0) analyzing... Image Present: ${!!imageBase64}`);

    // CALL GEMINI
    const jsonString = await callGeminiAccountant(userText, imageBase64);

    // PARSE & RETURN
    try {
      const parsedData = JSON.parse(jsonString);
      
      // Basic Validation
      if(!parsedData.rows) parsedData.rows = [];
      if(!parsedData.summary) parsedData.summary = { rowCount: 0, grandTotal: 0, totalTax: 0 };

      return NextResponse.json(parsedData, { status: 200 });
    } catch (e) {
      console.error("JSON Parse Error:", jsonString);
      return NextResponse.json({
        rows: [],
        summary: { rowCount: 0, grandTotal: 0, totalTax: 0 },
        issues: [{ row: 0, message: "AI returned invalid data format." }]
      });
    }

  } catch (err: any) {
    console.error("ACCOUNTANT ROUTE ERROR:", err);
    return NextResponse.json({
      rows: [],
      summary: { rowCount: 0, grandTotal: 0, totalTax: 0 },
      issues: [{ row: 0, message: "Server Error: " + err.message }]
    });
  }
}