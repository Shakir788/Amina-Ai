"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { User, X } from "lucide-react";

interface MessageProps {
  role: string;
  content: any; // flexible: string | array | object
  attachment?: string | null;
  id?: string;
  createdAt?: string | number;
  isAccountantMode?: boolean; // ✨ NEW: To change colors based on mode
}

export default function MessageBubble({ 
  role, 
  content, 
  attachment, 
  id, 
  createdAt, 
  isAccountantMode = false // Default to Bestie mode
}: MessageProps) {
  
  const isAI = role === "assistant";
  const [imgOpen, setImgOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // --- COLORS BASED ON MODE ---
  const userGradient = isAccountantMode 
    ? "from-blue-600 to-cyan-600" 
    : "from-purple-600 to-pink-600";
  
  const aiBorderColor = isAccountantMode 
    ? "border-blue-500/50" 
    : "border-purple-500/50";

  // ----- 1) Robust Text Extractor -----
  function extractText(c: any): string {
    try {
      if (!c && c !== 0) return "";
      if (typeof c === "string") return c;
      if (Array.isArray(c)) {
        return c.map((p: any) => (typeof p === "string" ? p : p?.text ?? "")).join(" ");
      }
      if (typeof c === "object") {
        if (typeof c.text === "string") return c.text;
        // Fallback for safety
        try { return JSON.stringify(c).slice(0, 2000); } catch { return ""; }
      }
      return String(c);
    } catch (e) {
      return "";
    }
  }

  const rawText = extractText(content);

  // ----- 2) Safe Preview (Read More logic) -----
  function safePreview(s: string, n = 500) {
    if (!s) return "";
    if (s.length <= n) return s;
    const cut = s.slice(0, n);
    const lastSpace = Math.max(cut.lastIndexOf(" "), cut.lastIndexOf("\n"), cut.lastIndexOf("."));
    const pos = Math.max(120, lastSpace > 0 ? lastSpace : n);
    return cut.slice(0, pos) + "...";
  }

  // ----- 3) Markdown Renderer (Nodes) -----
  function renderMarkdownToNodes(text: string) {
    if (!text) return null;
    const lines = text.split(/\r?\n/);
    const nodes: React.ReactNode[] = [];

    lines.forEach((line, idx) => {
      // Clean up markdown syntax for cleaner UI
      if (/^###\s+/.test(line)) {
        nodes.push(<h3 key={idx} className="text-sm font-bold mb-1 mt-2 text-white/90">{inlineFormat(line.replace(/^###\s+/, ""))}</h3>);
      } else if (/^##\s+/.test(line)) {
        nodes.push(<h2 key={idx} className="text-base font-bold mb-1 mt-3 text-white">{inlineFormat(line.replace(/^##\s+/, ""))}</h2>);
      } else if (/^#\s+/.test(line)) {
        nodes.push(<h1 key={idx} className="text-lg font-extrabold mb-2 mt-3 text-white">{inlineFormat(line.replace(/^#\s+/, ""))}</h1>);
      } else if (/^-\s+/.test(line)) {
         // Bullet points
         nodes.push(<li key={idx} className="ml-4 mb-1 list-disc text-white/80">{inlineFormat(line.replace(/^-\s+/, ""))}</li>);
      } else {
        // Code blocks handling (Simple)
        if (line.startsWith("```")) return; // Skip code fences for now or handle simply
        nodes.push(<p key={idx} className="mb-1 leading-relaxed text-white/90">{inlineFormat(line)}</p>);
      }
    });
    return nodes;
  }

  function inlineFormat(line: string): React.ReactNode {
    const parts: React.ReactNode[] = [];
    const boldItalicRegex = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)/g; // Added inline code support
    let lastIndex = 0;
    let match;
    let i = 0;

    while ((match = boldItalicRegex.exec(line)) !== null) {
      const start = match.index;
      if (start > lastIndex) parts.push(line.slice(lastIndex, start));
      
      if (match[1]) { // Bold
        parts.push(<strong key={`b-${i++}`} className="font-bold text-white">{match[2]}</strong>);
      } else if (match[3]) { // Italic
        parts.push(<em key={`i-${i++}`} className="italic text-white/80">{match[4]}</em>);
      } else if (match[5]) { // Inline Code
        parts.push(<code key={`c-${i++}`} className="bg-black/30 px-1 rounded text-xs font-mono text-yellow-200">{match[6]}</code>);
      }
      lastIndex = boldItalicRegex.lastIndex;
    }
    if (lastIndex < line.length) parts.push(line.slice(lastIndex));
    return parts.length === 0 ? line : parts;
  }

  // ----- Logic -----
  const maxPreview = 600;
  const isLong = rawText.length > maxPreview;
  const previewText = isLong && !expanded ? safePreview(rawText, maxPreview) : rawText;

  const formatTime = (t?: string | number) => {
    try {
      if (!t) return "";
      return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch { return ""; }
  };

  return (
    <>
      {/* LOCAL STYLE FOR BREATHING ANIMATION (To match ChatInterface) */}
      <style jsx>{`
        @keyframes breathe {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
        .animate-breathe { animation: breathe 3s infinite ease-in-out; }
      `}</style>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex w-full gap-3 mb-6 ${isAI ? "justify-start" : "justify-end"}`}
      >
        {/* AI AVATAR (LIVING LOGO STYLE) */}
        {isAI && (
          <div className={`w-9 h-9 rounded-full overflow-hidden border ${aiBorderColor} shadow-lg shrink-0 mt-1 animate-breathe`}>
            <img src="/Amina_logo.png" alt="Amina" className="w-full h-full object-cover" />
          </div>
        )}

        <div className={`flex flex-col ${isAI ? "items-start" : "items-end"} max-w-[85%] break-words`}>
          {/* ATTACHMENT */}
          {attachment && !imgError && (
            <div className={`mb-2 overflow-hidden rounded-xl border ${aiBorderColor} shadow-lg relative group`}>
              <img
                src={attachment}
                alt="attachment"
                loading="lazy"
                onError={() => setImgError(true)}
                onClick={() => setImgOpen(true)}
                className="w-full h-auto max-h-64 object-cover cursor-pointer transition-transform duration-300 group-hover:scale-105"
              />
            </div>
          )}

          {attachment && imgError && (
            <div className="mb-2 p-2 bg-red-900/20 border border-red-500/30 rounded text-xs text-red-300">
              ⚠️ Image failed to load
            </div>
          )}

          {/* MESSAGE BUBBLE */}
          <div
            className={`rounded-2xl px-5 py-3 text-sm md:text-base leading-relaxed shadow-sm whitespace-pre-wrap
            ${isAI
                ? "bg-[#1a1a1a] text-gray-100 border border-white/10 rounded-tl-sm"
                : `bg-gradient-to-r ${userGradient} text-white rounded-tr-sm shadow-md`
              }`}
          >
            {/* CONTENT */}
            <div>{renderMarkdownToNodes(previewText)}</div>

            {isLong && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="mt-2 text-xs opacity-70 hover:opacity-100 underline transition-opacity"
              >
                {expanded ? "Show less" : "Read more"}
              </button>
            )}

            {/* TIMESTAMP */}
            {createdAt && (
              <div className={`mt-1 text-[10px] ${isAI ? "text-gray-500" : "text-white/60"} text-right`}>
                {formatTime(createdAt)}
              </div>
            )}
          </div>
        </div>

        {/* USER AVATAR */}
        {!isAI && (
          <div className={`w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center border border-white/10 shrink-0 mt-1`}>
            <User size={16} className="text-gray-400" />
          </div>
        )}
      </motion.div>

      {/* IMAGE LIGHTBOX */}
      {imgOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <button
            onClick={() => setImgOpen(false)}
            className="absolute top-5 right-5 bg-gray-800/80 p-2 rounded-full hover:bg-gray-700 transition-colors"
          >
            <X size={24} className="text-white" />
          </button>
          <img
            src={attachment || ""}
            alt="Full view"
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
          />
        </div>
      )}
    </>
  );
}