import { NextResponse } from "next/server";

export const runtime = "nodejs";

// =========================================
// ✅ ACCOUNTANT CONFIG
// =========================================
const MODEL_NAME = "gemini-2.5-pro"; // Updated Model

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

  const cleanModelId = MODEL_NAME.replace("models/", "");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModelId}:generateContent?key=${apiKey}`;

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
      temperature: 0.1, 
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
    
    const lastMessage = messages[messages.length - 1];
    const userText = lastMessage?.content || "";

    // Check for Image Attachment
    let imageBase64: string | undefined = undefined;
    
    // 🔥 FIX 1: Check DIRECT DATA Payload First (Force Send from Frontend)
    if (body.data?.image_base64) {
      console.log("📸 Image found in DATA payload");
      const raw = body.data.image_base64;
      // Handle "data:image/jpeg;base64,..." prefix if present
      const parts = raw.split(",");
      imageBase64 = parts.length > 1 ? parts[1] : raw;
    } 
    // 🔥 FIX 2: Fallback to Attachments
    else if (lastMessage?.experimental_attachments?.[0]?.url) {
      console.log("📸 Image found in ATTACHMENTS");
      const dataUrl = lastMessage.experimental_attachments[0].url;
      const parts = dataUrl.split(",");
      if (parts.length > 1) imageBase64 = parts[1];
    }

    console.log(`📊 Accountant (2.0) analyzing... Image Present: ${!!imageBase64}`);

    // CALL GEMINI
    const jsonString = await callGeminiAccountant(userText, imageBase64);

    // PARSE & RETURN
    try {
      const parsedData = JSON.parse(jsonString);
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