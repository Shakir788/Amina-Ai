"use client";

import { useState, useRef, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

interface VisionManagerProps {
  onAnalysisComplete: (text: string) => void;
  mode: "camera" | "screen" | null;
  onClose: () => void;
}

export default function VisionManager({ onAnalysisComplete, mode, onClose }: VisionManagerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [status, setStatus] = useState("Initializing...");
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // 1. START CAMERA OR SCREEN SHARE
  useEffect(() => {
    const startStream = async () => {
      try {
        let newStream: MediaStream;
        
        if (mode === "screen") {
          // @ts-ignore
          newStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        } else {
          newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
        }

        setStream(newStream);
        if (videoRef.current) {
          videoRef.current.srcObject = newStream;
        }
        setStatus(mode === "screen" ? "Watching Screen..." : "Looking at you...");
        
        startAnalysisLoop();

      } catch (err) {
        console.error("Stream Error:", err);
        setStatus("Permission Denied / Error");
        setTimeout(onClose, 2000);
      }
    };

    if (mode) startStream();

    return () => stopStream();
  }, [mode]);

  // 2. CLEANUP
  const stopStream = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setStream(null);
  };

  // 3. CAPTURE & ANALYZE LOOP
  const startAnalysisLoop = () => {
    intervalRef.current = setInterval(async () => {
      if (!videoRef.current || !canvasRef.current || isAnalyzing) return;

      setIsAnalyzing(true);
      
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        ctx.drawImage(videoRef.current, 0, 0);
        
        const base64Image = canvasRef.current.toDataURL("image/jpeg", 0.5); // Lower quality for speed

        try {
          await analyzeImage(base64Image);
        } catch (e) {
          console.error("Analysis Failed", e);
        }
      }
      setIsAnalyzing(false);
    }, 5000); // 5 Seconds Interval
  };

  // 4. SEND TO GEMINI (API)
  const analyzeImage = async (base64Image: string) => {
    // 🔥 UPDATED STRICT PROMPT: NO BACKGROUND DETAILS
    const prompt = mode === "screen" 
      ? "Analyze this screen content extremely briefly. Find bugs or summarize text in 1 sentence."
      : "You are looking at the user. IGNORE the background, walls, and lighting. Focus ONLY on their face and emotion. Describe the vibe in maximum 6 words. Example: 'He looks deep in thought', 'He is smiling', 'He looks tired'. Do not describe clothes or furniture.";

    const res = await fetch("/api/vision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image", image: base64Image }
            ]
          }
        ]
      })
    });

    const data = await res.json();
    if (data.text) {
      onAnalysisComplete(data.text);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="fixed top-20 right-4 w-48 md:w-64 bg-black/90 border-2 border-purple-500/50 rounded-xl overflow-hidden shadow-2xl z-[100] group"
      drag
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 500 }}
    >
      {/* Header */}
      <div className="absolute top-0 w-full p-2 bg-gradient-to-b from-black/80 to-transparent flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
            {isAnalyzing ? <Loader2 size={14} className="text-purple-400 animate-spin"/> : <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
            <span className="text-[10px] font-bold text-white uppercase tracking-wider">{mode === 'screen' ? 'Screen' : 'Live Cam'}</span>
        </div>
        <button onClick={onClose} className="p-1 bg-black/50 hover:bg-red-500 rounded-full text-white transition-colors">
            <X size={14} />
        </button>
      </div>

      {/* Video Preview */}
      <div className="relative aspect-[3/4] bg-gray-900">
        <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className={`w-full h-full object-cover ${mode === 'camera' ? 'scale-x-[-1]' : ''}`} 
        />
        <canvas ref={canvasRef} className="hidden" />
        <div className="absolute bottom-0 w-full p-2 bg-black/60 text-center">
            <p className="text-[10px] text-gray-300">{status}</p>
        </div>
      </div>
    </motion.div>
  );
}