import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

// Load environment variables from .env
dotenv.config({ path: ".env" });

export default defineConfig({
  schema: "./schema.ts", // Agar tera schema.ts kisi aur folder mein hai (like ./lib/schema.ts), toh path update kar dena
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});