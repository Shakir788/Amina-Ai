import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// 1. Chat Sessions Table
export const chats = pgTable("chats", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull().default("New Chat"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 2. Chat Messages Table
export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  chatId: uuid("chat_id")
    .references(() => chats.id, { onDelete: "cascade" })
    .notNull(),
  role: text("role").notNull(), // 'user' ya 'assistant'
  content: text("content").notNull(),
  imageUrl: text("image_url"), // 🆕 optional — generated/edited image ka URL ya base64
  createdAt: timestamp("created_at").defaultNow().notNull(),
});