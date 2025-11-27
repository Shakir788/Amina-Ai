"use client";

import { motion } from "framer-motion";
import { User } from "lucide-react";

interface MessageProps {
  role: string;
  content: any; // 'any' rakha hai taaki error na aaye
  attachment?: string;
}

export default function MessageBubble({ role, content, attachment }: MessageProps) {
  const isAI = role === 'assistant';

  // --- SAFELY RENDER TEXT ---
  // Ye function ensure karega ki screen par sirf TEXT hi dikhe, Object nahi (jo crash karata hai)
  const renderContent = () => {
    try {
      if (typeof content === 'string') return content;
      if (Array.isArray(content)) {
        return content.map((part: any) => part.text || "").join(" ");
      }
      if (typeof content === 'object') {
        return JSON.stringify(content); // Agar object aa gaya to usse string bana do
      }
      return "";
    } catch (e) {
      return "Error displaying message.";
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex w-full gap-3 mb-6 ${isAI ? 'justify-start' : 'justify-end'}`}
    >
      {/* AI AVATAR */}
      {isAI && (
        <div className="w-8 h-8 rounded-full overflow-hidden border border-purple-500/50 shadow-lg shadow-purple-500/20 shrink-0 mt-1">
          <img src="/Amina_logo.png" alt="AI" className="w-full h-full object-cover" />
        </div>
      )}

      <div className={`flex flex-col ${isAI ? 'items-start' : 'items-end'} max-w-[85%]`}>
        
        {/* IMAGE (Only if valid) */}
        {attachment && (
          <div className="mb-2 overflow-hidden rounded-xl border border-purple-500/30 shadow-lg">
            <img 
              src={attachment} 
              alt="attachment" 
              style={{ width: 'auto', height: 'auto', maxHeight: '250px', display: 'block' }}
            />
          </div>
        )}

        {/* TEXT BUBBLE */}
        <div 
          className={`
            rounded-2xl px-5 py-3 text-sm md:text-base leading-relaxed shadow-sm whitespace-pre-wrap
            ${isAI 
              ? 'bg-[#1a1a1a] text-gray-100 border border-gray-800 rounded-tl-sm' 
              : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-tr-sm shadow-lg'
            }
          `}
        >
          {renderContent()}
        </div>
      </div>

      {/* USER AVATAR */}
      {!isAI && (
        <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center border border-gray-700 shrink-0 mt-1">
          <User size={16} className="text-gray-400" />
        </div>
      )}
    </motion.div>
  );
}