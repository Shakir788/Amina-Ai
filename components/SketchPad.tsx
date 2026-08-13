import React, { useRef, useState, useEffect } from 'react';
import { X, Eraser, Check, Paintbrush } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function SketchPad({ onClose, onSave }: { onClose: () => void, onSave: (dataUrl: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set default white background so it doesn't save as transparent black
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#3A2E4A"; // Dark ink color
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    ctx?.beginPath();
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && canvas) {
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  };

  const saveCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      onSave(canvas.toDataURL("image/jpeg", 0.9)); // Return as base64 image
    }
  };

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-white w-full max-w-md rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-black/10">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-black/5 bg-[#FAF8FC]">
            <div className="flex items-center gap-2 text-[#231A2E] font-bold"><Paintbrush size={18} className="text-[#A855F7]" /> Magic Sketchpad</div>
            <button onClick={onClose} className="p-2 hover:bg-red-50 text-[#5B5468] hover:text-red-500 rounded-full transition-all"><X size={18} /></button>
          </div>
          
          {/* Canvas Area */}
          <div className="p-4 flex items-center justify-center bg-[#FDFCFE] touch-none">
            <canvas
              ref={canvasRef}
              width={600}
              height={600}
              onMouseDown={startDrawing}
              onMouseUp={stopDrawing}
              onMouseOut={stopDrawing}
              onMouseMove={draw}
              onTouchStart={startDrawing}
              onTouchEnd={stopDrawing}
              onTouchMove={draw}
              className="border-2 border-dashed border-[#D9C2EE] rounded-2xl w-full aspect-square cursor-crosshair shadow-inner bg-white"
            />
          </div>
          
          {/* Footer Actions */}
          <div className="p-4 border-t border-black/5 bg-[#FAF8FC] flex justify-between items-center">
            <button onClick={clearCanvas} className="flex items-center gap-2 px-4 py-2 rounded-xl text-[#5B5468] hover:bg-black/5 transition-all font-medium"><Eraser size={16} /> Clear</button>
            <button onClick={saveCanvas} className="flex items-center gap-2 px-6 py-2 rounded-xl text-white font-medium shadow-md transition-all hover:scale-105" style={{ background: "linear-gradient(135deg, #A855F7, #F472B6)" }}><Check size={16} /> Use Sketch</button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}