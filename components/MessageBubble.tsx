"use client";

import { motion } from "framer-motion";
import { User, X } from "lucide-react";
import { useState } from "react";

interface MessageProps {
  role: string;
  content: any; // keep flexible
  attachment?: string | null;
  // Optional metadata (if you later add): id, createdAt, etc.
  id?: string;
  createdAt?: string | number;
}

export default function MessageBubble({ role, content, attachment, id, createdAt }: MessageProps) {
  const isAI = role === "assistant";
  const [imgOpen, setImgOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // ----- 1) Safe text extractor (handles string | parts array | object) -----
  function extractText(c: any): string {
    try {
      if (!c && c !== 0) return "";
      if (typeof c === "string") return c;
      if (Array.isArray(c)) {
        // common generative shape: parts = [{ text }, { inlineData }, ...]
        return c.map((p: any) => (typeof p === "string" ? p : p?.text ?? "")).join(" ");
      }
      if (typeof c === "object") {
        // try common fields
        if (typeof c.text === "string") return c.text;
        if (Array.isArray(c.parts)) {
          return c.parts.map((p: any) => (typeof p === "string" ? p : p?.text ?? "")).join(" ");
        }
        // fallback to safe JSON stringify (short)
        try {
          return JSON.stringify(c).slice(0, 2000);
        } catch {
          return "";
        }
      }
      return String(c);
    } catch (e) {
      return "";
    }
  }

  const rawText = extractText(content);

  // ----- 2) Small markdown-like parser -> React nodes (no innerHTML) -----
  // Supports: # Heading, ## Subheading, **bold**, *italic*
  function renderMarkdownToNodes(text: string) {
    if (!text) return null;
    const lines = text.split(/\r?\n/);
    const nodes: React.ReactNode[] = [];

    lines.forEach((line, idx) => {
      // Heading H3 > H2 > H1 detection (note order: ### then ## then #)
      if (/^###\s+/.test(line)) {
        nodes.push(
          <h3 key={idx} className="text-sm md:text-sm font-semibold mb-1">
            {inlineFormat(line.replace(/^###\s+/, ""))}
          </h3>
        );
      } else if (/^##\s+/.test(line)) {
        nodes.push(
          <h2 key={idx} className="text-base md:text-base font-semibold mb-1">
            {inlineFormat(line.replace(/^##\s+/, ""))}
          </h2>
        );
      } else if (/^#\s+/.test(line)) {
        nodes.push(
          <h1 key={idx} className="text-lg md:text-lg font-bold mb-1">
            {inlineFormat(line.replace(/^#\s+/, ""))}
          </h1>
        );
      } else {
        nodes.push(
          <p key={idx} className="mb-1 leading-relaxed">
            {inlineFormat(line)}
          </p>
        );
      }
    });

    return nodes;
  }

  // inline formatting for bold/italic inside a line
  function inlineFormat(line: string): React.ReactNode {
    const parts: React.ReactNode[] = [];
    // regex to split by bold or italic tokens while keeping them
    // Order: strong (**) then italic (*) — we handle nested simply by sequential processing
    let i = 0;
    const boldItalicRegex = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)/g;
    let lastIndex = 0;
    let match;
    while ((match = boldItalicRegex.exec(line)) !== null) {
      const start = match.index;
      if (start > lastIndex) {
        parts.push(line.slice(lastIndex, start));
      }
      if (match[1]) {
        // bold
        parts.push(<strong key={i++} className="font-semibold">{match[2]}</strong>);
      } else if (match[3]) {
        // italic
        parts.push(<em key={i++} className="italic">{match[4]}</em>);
      }
      lastIndex = boldItalicRegex.lastIndex;
    }
    if (lastIndex < line.length) {
      parts.push(line.slice(lastIndex));
    }
    // if nothing matched, return simple text
    if (parts.length === 0) return line;
    return parts;
  }

  // ----- 3) Read-more behavior for long messages -----
  const maxPreview = 500;
  const isLong = rawText.length > maxPreview;
  const previewText = isLong && !expanded ? rawText.slice(0, maxPreview) + "..." : rawText;

  // ----- 4) Format timestamp if provided -----
  const formatTime = (t?: string | number) => {
    try {
      if (!t) return "";
      const date = typeof t === "number" ? new Date(t) : new Date(t);
      return date.toLocaleString();
    } catch {
      return "";
    }
  };

  // ----- 5) image handlers -----
  const onImgError = () => setImgError(true);
  const onImgClick = () => {
    if (!imgError) setImgOpen(true);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex w-full gap-3 mb-6 ${isAI ? "justify-start" : "justify-end"}`}
      >
        {/* AI AVATAR */}
        {isAI && (
          <div className="w-8 h-8 rounded-full overflow-hidden border border-purple-500/50 shadow-lg shadow-purple-500/20 shrink-0 mt-1">
            <img src="/Amina_logo.png" alt="Amina" className="w-full h-full object-cover" />
          </div>
        )}

        <div className={`flex flex-col ${isAI ? "items-start" : "items-end"} max-w-[85%]`}>
          {/* ATTACHMENT */}
          {attachment && !imgError && (
            <div className="mb-2 overflow-hidden rounded-xl border border-purple-500/30 shadow-lg">
              <img
                src={attachment}
                alt="attachment"
                loading="lazy"
                onError={onImgError}
                onClick={onImgClick}
                style={{ width: "100%", height: "auto", maxHeight: 320, cursor: "pointer", display: "block", objectFit: "cover" }}
              />
            </div>
          )}

          {/* IMAGE ERROR / FALLBACK */}
          {attachment && imgError && (
            <div className="mb-2 p-3 bg-gray-800 rounded-xl text-sm text-gray-300">Image cannot be loaded.</div>
          )}

          {/* TEXT BUBBLE */}
          <div
            className={`rounded-2xl px-5 py-3 text-sm md:text-base leading-relaxed shadow-sm whitespace-pre-wrap
            ${isAI
                ? "bg-[#1a1a1a] text-gray-100 border border-gray-800 rounded-tl-sm"
                : "bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-tr-sm shadow-lg"
              }`}
          >
            {/* Render preview or full text with markdown -> nodes */}
            {isLong ? (
              <>
                <div>{renderMarkdownToNodes(previewText)}</div>
                <div className="mt-2 flex gap-3 items-center">
                  <button
                    onClick={() => setExpanded((s) => !s)}
                    className="text-xs text-gray-300 underline"
                    aria-expanded={expanded}
                  >
                    {expanded ? "Show less" : "Read more"}
                  </button>
                </div>
              </>
            ) : (
              <div>{renderMarkdownToNodes(previewText)}</div>
            )}

            {/* optional timestamp */}
            {createdAt && (
              <div className="mt-2 text-[11px] text-gray-400">
                {formatTime(createdAt)}
              </div>
            )}
          </div>
        </div>

        {/* USER AVATAR */}
        {!isAI && (
          <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center border border-gray-700 shrink-0 mt-1">
            <User size={16} className="text-gray-400" />
          </div>
        )}
      </motion.div>

      {/* Simple lightbox modal for image */}
      {imgOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        >
          <div className="absolute top-6 right-6">
            <button
              onClick={() => setImgOpen(false)}
              className="bg-black/60 p-2 rounded-full border border-white/10"
              aria-label="Close image"
            >
              <X size={18} />
            </button>
          </div>
          <div className="max-w-[95%] max-h-[95%]">
            <img
              src={attachment || ""}
              alt="attachment large"
              onError={() => setImgError(true)}
              style={{ maxWidth: "100%", maxHeight: "100%", display: "block", objectFit: "contain" }}
            />
          </div>
        </div>
      )}
    </>
  );
}
