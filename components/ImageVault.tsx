import React from 'react';
import { X, Download, ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ImageVault({ 
  images, 
  onClose 
}: { 
  images: Record<string, string>, 
  onClose: () => void 
}) {
  const imageList = Object.values(images).reverse(); // Latest pehle dikhane ke liye

  const handleDownload = async (url: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `amina_vault_${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, "_blank");
    }
  };

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      >
        <motion.div 
          initial={{ scale: 0.95, y: 20 }} 
          animate={{ scale: 1, y: 0 }} 
          exit={{ scale: 0.95, y: 20 }}
          className="bg-[#FDFCFE] w-full max-w-4xl h-[85vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-black/10"
        >
          {/* Vault Header */}
          <div className="flex items-center justify-between p-5 border-b border-black/5 bg-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#F3E8FF] rounded-xl text-[#7C3AED]">
                <ImageIcon size={20} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#231A2E]">Amina Vault</h2>
                <p className="text-xs text-[#9B92AA] font-medium">Your generated and edited masterpieces ✨</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-red-50 text-[#5B5468] hover:text-red-500 rounded-full transition-all"
            >
              <X size={20} />
            </button>
          </div>

          {/* Vault Grid */}
          <div className="flex-1 overflow-y-auto p-6 bg-[#FAF8FC]">
            {imageList.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-[#9B92AA] gap-3">
                <ImageIcon size={48} className="opacity-20" />
                <p>No images yet. Start creating!</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 auto-rows-max">
                {imageList.map((imgUrl, idx) => (
                  <div key={idx} className="relative group rounded-2xl overflow-hidden border border-black/5 shadow-sm bg-white aspect-square flex items-center justify-center">
                    <img src={imgUrl} alt="Vault item" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    
                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button 
                        onClick={(e) => handleDownload(imgUrl, e)}
                        className="p-3 bg-white/90 hover:bg-white rounded-full text-[#3A2E4A] transform translate-y-4 group-hover:translate-y-0 transition-all shadow-lg"
                        title="Download high res"
                      >
                        <Download size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}