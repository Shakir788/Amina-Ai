import React, { useRef } from 'react';
import { Sparkles, Image as ImageIcon, Zap, Wand2 } from 'lucide-react';

const CHIPS = [
  { label: "Make it Cyberpunk 🚀", prompt: "Make this highly detailed cyberpunk style with neon lights, dark moody background, high resolution.", icon: Zap },
  { label: "Anime Style 🌸", prompt: "Convert this into a high-quality, vibrant anime style illustration, studio ghibli aesthetic.", icon: Sparkles },
  { label: "Remove Background ✂️", prompt: "Remove the background completely and place the subject on a solid clean white background.", icon: ImageIcon },
  { label: "Sketch Art ✏️", prompt: "Turn this into a detailed pencil sketch, realistic shading, artistic style.", icon: Wand2 },
  { label: "Professional Headshot 📸", prompt: "Transform into a professional LinkedIn headshot, corporate attire, studio lighting, blurred office background.", icon: Sparkles },
];

export default function SmartChips({ onSelect, isImageMode }: { onSelect: (prompt: string) => void, isImageMode: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Agar Image Studio mode nahi hai, toh chips mat dikhao
  if (!isImageMode) return null;

  return (
    <div className="w-full max-w-3xl mx-auto mb-3 overflow-hidden relative">
      <div 
        ref={scrollRef}
        className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide px-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {CHIPS.map((chip, idx) => {
          const Icon = chip.icon;
          return (
            <button
              key={idx}
              onClick={() => onSelect(chip.prompt)}
              className="flex items-center gap-2 whitespace-nowrap px-4 py-2 rounded-full text-xs font-medium bg-white/80 border border-black/5 text-[#5B5468] hover:text-[#7C3AED] hover:border-[#A855F7]/30 hover:bg-[#F3E8FF] transition-all shadow-sm"
            >
              <Icon size={12} />
              {chip.label}
            </button>
          );
        })}
      </div>
      {/* Subtle fade edges for scrolling indication */}
      <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[#FDFCFE] to-transparent pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#FDFCFE] to-transparent pointer-events-none" />
    </div>
  );
}