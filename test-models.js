// test-models.js
const fs = require('fs');
const path = require('path');

// 1. Load Environment Variables (Try .env.local first, then .env)
const envLocalPath = path.resolve(process.cwd(), '.env.local');
const envPath = path.resolve(process.cwd(), '.env');

if (fs.existsSync(envLocalPath)) {
    require('dotenv').config({ path: envLocalPath });
    console.log("✅ Loaded .env.local");
} else if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
    console.log("✅ Loaded .env");
} else {
    console.log("⚠️ No .env file found. Ensure GOOGLE_API_KEY is set in your terminal.");
}

async function listModels() {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY;

    if (!apiKey) {
        console.error("❌ Error: API Key not found in environment variables.");
        return;
    }

    console.log(`\n🔑 Checking models for Key starting with: ${apiKey.substring(0, 8)}...`);

    try {
        // Direct REST API call to see exactly what Google returns
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (data.models) {
            console.log("\n📋 === AVAILABLE MODELS LIST ===");
            const geminiModels = data.models
                .filter(m => m.name.includes("gemini"))
                .map(m => m.name.replace("models/", ""));
            
            geminiModels.forEach(model => console.log(`- ${model}`));
            
            console.log("\n✅ Check finished.");
        } else {
            console.log("❌ No models returned from Google.");
        }

    } catch (e) {
        console.error("❌ Request Failed:", e.message);
    }
}

listModels();