// realtime-server.js
const { GoogleGenerativeAI } = require("@google/generative-ai");
const WebSocket = require("ws");
require("dotenv").config(); // .env file se API Key lega

const API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

if (!API_KEY) {
  console.error("❌ Error: GOOGLE_GENERATIVE_AI_API_KEY is missing in .env");
  process.exit(1);
}

// Gemini 2.0 Config
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

// WebSocket Server on Port 8080 (Next.js 3000 par chalta hai, yeh alag chalega)
const wss = new WebSocket.Server({ port: 8080 });

console.log("🚀 Real-Time Voice Server running on ws://localhost:8080");

wss.on("connection", async (ws) => {
  console.log("✅ Client Connected for Voice Chat");

  // Gemini Chat Session Start
  const chat = model.startChat({
    history: [
      {
        role: "user",
        parts: [{ text: "You are Amina, a helpful and fast voice assistant. Speak naturally, be concise. Use fillers like 'hmm' or 'aha' to sound human." }],
      },
    ],
  });

  ws.on("message", async (data) => {
    try {
      // Frontend se jo Audio (Blob/Buffer) aayega, usse text/audio samjhein
      // Note: Asli duplex ke liye humein yahan binary handling karni hogi
      // Abhi hum simple approach le rahe hain: Text/Audio receive -> Stream Response
      
      const message = data.toString(); // Assume frontend sends text/base64 for now
      
      // Agar raw audio bytes bhej rahe ho toh logic alag hoga. 
      // Abhi text-based trigger test karte hain fast response ke liye.
      
      const result = await chat.sendMessageStream(message);
      
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        // Server turant Client ko chunk bhejega
        if (chunkText) {
          ws.send(JSON.stringify({ type: "text", content: chunkText }));
        }
      }
      
      // Signal finish
      ws.send(JSON.stringify({ type: "done" }));

    } catch (error) {
      console.error("Error generating response:", error);
      ws.send(JSON.stringify({ type: "error", message: error.message }));
    }
  });

  ws.on("close", () => {
    console.log("❌ Client Disconnected");
  });
});