// 📂 components/ImageGenerator.tsx
"use client";

import { useState } from "react";
import { Sparkles, Download, X, Image as ImageIcon, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export const ImageGenerator = ({ toolInvocation }: { toolInvocation: any }) => {
  const { args, result } = toolInvocation;
  const [isExpanded, setIsExpanded] = useState(true);

  // 1. LOADING STATE
  if (!result) {
    return (
      <div className="mt-3 w-full max-w-sm bg-gray-900 rounded-xl border border-purple-500/30 p-4 animate-pulse">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-purple-500/20 rounded-full">
            <Sparkles size={18} className="text-purple-400 animate-spin-slow" />
          </div>
          <span className="text-sm font-bold text-purple-300">Amina is creating art...</span>
        </div>
        <div className="h-48 bg-gray-800/50 rounded-lg flex items-center justify-center border border-white/5">
           <Loader2 size={32} className="text-purple-500 animate-spin" />
        </div>
        <div className="mt-2 text-xs text-gray-500 italic">"{args.prompt}"</div>
      </div>
    );
  }

  // 2. ERROR STATE
  if (result.error) {
    return (
      <div className="mt-3 p-3 bg-red-900/20 border border-red-500/50 rounded-lg flex items-center gap-3">
        <X className="text-red-400" size={18} />
        <span className="text-sm text-red-200">Image generation failed. Try again.</span>
      </div>
    );
  }

  // 3. SUCCESS STATE (With Fixes)
  const imageUrl = result.imageUrl;

  // Function to handle download in same tab
  const handleDownload = async () => {
    try {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `amina_art_${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Download failed:", error);
        // Fallback: Open in new tab if fetch fails
        window.open(imageUrl, '_blank');
    }
  };


  if (!isExpanded) {
    return (
        <button onClick={() => setIsExpanded(true)} className="mt-2 flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-full border border-purple-500/30 text-purple-300 text-xs hover:bg-gray-700 transition-all">
            <ImageIcon size={14} /> View Generated Image
        </button>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="mt-4 w-full max-w-md bg-[#0a0a0a] rounded-2xl overflow-hidden border border-purple-500/40 shadow-2xl relative group"
    >
      <div className="absolute top-0 left-0 w-full p-3 bg-gradient-to-b from-black/80 to-transparent flex justify-between items-start z-10">
        <div className="flex items-center gap-2 px-2 py-1 bg-black/40 backdrop-blur-md rounded-full border border-white/10">
            <Sparkles size={12} className="text-purple-400" />
            <span className="text-[10px] font-bold text-white uppercase tracking-wide">AI Generated</span>
        </div>
        <button 
            onClick={() => setIsExpanded(false)} 
            className="p-1.5 bg-black/40 hover:bg-red-500/80 backdrop-blur-md rounded-full text-white/70 hover:text-white transition-all"
        >
            <X size={14} />
        </button>
      </div>

      {/* ✅ FINAL FIX: REAL <img> WITH NO-REFERRER */}
<div className="relative aspect-square w-full bg-gray-900 flex items-center justify-center">
  <img
    src={imageUrl}
    alt={args.prompt}
    className="w-full h-full object-cover"
    loading="lazy"
    referrerPolicy="no-referrer"
    crossOrigin="anonymous"
    onError={(e) => {
      (e.currentTarget as HTMLImageElement).style.display = "none";
    }}
  />
</div>

      <div className="p-4 bg-gray-900/90 border-t border-purple-500/20">
        <p className="text-xs text-gray-400 italic mb-3 line-clamp-2">
            "{args.prompt}"
        </p>
        <div className="flex gap-2">
            {/* 🔥 FIX: Using updated handleDownload function */}
            <button 
                onClick={handleDownload}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-white text-xs font-bold transition-all"
            >
                <Download size={14} /> Download High Res
            </button>
        </div>
      </div>
    </motion.div>
  );
};