"use client";

import { useChat } from "ai/react";
import { 
  Send, Mic, Paperclip, Phone, X, Trash2, 
  Briefcase, Heart, Music, MapPin, Calculator, Sparkles,
  Mail, Calendar, CheckCircle, Square, Play, Download, 
  Image as ImageIcon, Loader2, Gamepad2, 
  Clock, CloudSun, Wind, Droplets, Globe, Search, Headphones,
  Video, Monitor 
} from "lucide-react";
import { useRef, useEffect, useState, ChangeEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import StressBuster from './StressBuster'; 
import VisionManager from './VisionManager'; // 👈 Ensure this file exists in components folder

// ==========================================
// 1. NEON ANIME AVATAR
// ==========================================
const CuteAvatar = ({ isSpeaking, isListening }: { isSpeaking: boolean, isListening: boolean }) => {
  return (
    <motion.div 
      animate={{ y: [0, -6, 0] }} 
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      className="relative w-60 h-60 rounded-full flex flex-col items-center justify-center bg-[#050505] border-[4px] border-purple-500/50 shadow-[0_0_60px_rgba(168,85,247,0.5),inset_0_0_40px_rgba(168,85,247,0.2)] overflow-hidden"
    >
      <div className="absolute top-4 w-32 h-16 bg-white/5 rounded-[100%] blur-xl rotate-[-10deg]"></div>
      <div className="flex gap-8 mb-2 z-10 items-center mt-4">
        <div className="relative group">
            <motion.div 
              initial={{ scaleY: 1 }}
              animate={{ scaleY: [1, 1, 0.1, 1, 1, 1] }} 
              transition={{ repeat: Infinity, duration: 4.5, times: [0, 0.9, 0.92, 0.95, 0.98, 1] }}
              className="w-16 h-20 bg-gradient-to-b from-[#00f2ff] via-[#008cff] to-[#001aff] rounded-[50%] border-[3px] border-white/10 shadow-[0_0_25px_rgba(0,242,255,0.4)] relative overflow-hidden"
            >
                <div className="absolute bottom-[-10%] left-[20%] w-[60%] h-[70%] bg-black/60 rounded-full blur-[2px]"></div>
                <div className="absolute top-3 left-3 w-6 h-8 bg-white rounded-full opacity-95 rotate-[-20deg] blur-[0.5px] shadow-[0_0_10px_white]"></div>
                <div className="absolute bottom-4 right-4 w-2 h-2 bg-white rounded-full opacity-80"></div>
                <div className="absolute bottom-0 w-full h-1/2 bg-gradient-to-t from-cyan-300/40 to-transparent"></div>
            </motion.div>
        </div>
        <div className="relative group">
            <motion.div 
              initial={{ scaleY: 1 }}
              animate={{ scaleY: [1, 1, 0.1, 1, 1, 1] }} 
              transition={{ repeat: Infinity, duration: 4.5, times: [0, 0.9, 0.92, 0.95, 0.98, 1] }}
              className="w-16 h-20 bg-gradient-to-b from-[#00f2ff] via-[#008cff] to-[#001aff] rounded-[50%] border-[3px] border-white/10 shadow-[0_0_25px_rgba(0,242,255,0.4)] relative overflow-hidden"
            >
                <div className="absolute bottom-[-10%] left-[20%] w-[60%] h-[70%] bg-black/60 rounded-full blur-[2px]"></div>
                <div className="absolute top-3 left-3 w-6 h-8 bg-white rounded-full opacity-95 rotate-[-20deg] blur-[0.5px] shadow-[0_0_10px_white]"></div>
                <div className="absolute bottom-4 right-4 w-2 h-2 bg-white rounded-full opacity-80"></div>
                <div className="absolute bottom-0 w-full h-1/2 bg-gradient-to-t from-cyan-300/40 to-transparent"></div>
            </motion.div>
        </div>
      </div>
      <div className="h-8 flex items-center justify-center mt-2 z-20">
        {isSpeaking ? (
            <motion.div
                animate={{ height: [6, 14, 6], width: [14, 18, 14], borderRadius: ["12px", "16px", "12px"] }}
                transition={{ duration: 0.25, repeat: Infinity, ease: "easeInOut" }}
                className="bg-pink-200 shadow-[0_0_10px_rgba(244,114,182,0.6)]"
            />
        ) : (
            <div className="w-4 h-2 bg-pink-300/80 rounded-b-full shadow-[0_0_5px_pink]"></div>
        )}
      </div>
    </motion.div>
  );
};

// ==========================================
// 2. IMAGE GENERATOR COMPONENT
// ==========================================
const ImageGenerator = ({ toolInvocation }: { toolInvocation: any }) => {
  const { args, result } = toolInvocation;
  const [isExpanded, setIsExpanded] = useState(true);
  const [isLoadingImage, setIsLoadingImage] = useState(true);

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

  if (result.error) {
    return (
      <div className="mt-3 p-3 bg-red-900/20 border border-red-500/50 rounded-lg flex items-center gap-3">
        <X className="text-red-400" size={18} />
        <span className="text-sm text-red-200">Image generation failed. Try again.</span>
      </div>
    );
  }

  const imageUrl = result.imageUrl;

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    try {
        const response = await fetch(imageUrl, { mode: 'cors' });
        if (!response.ok) throw new Error("Network error");
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = `amina_art_${Date.now()}.jpg`;
        document.body.appendChild(link); link.click();
        document.body.removeChild(link); window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Download fallback:", error);
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
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mt-4 w-full max-w-md bg-[#0a0a0a] rounded-2xl overflow-hidden border border-purple-500/40 shadow-2xl relative group">
      <div className="absolute top-0 left-0 w-full p-3 bg-gradient-to-b from-black/80 to-transparent flex justify-between items-start z-10">
        <div className="flex items-center gap-2 px-2 py-1 bg-black/40 backdrop-blur-md rounded-full border border-white/10">
            <Sparkles size={12} className="text-purple-400" /> <span className="text-[10px] font-bold text-white uppercase tracking-wide">AI Generated</span>
        </div>
        <button onClick={() => setIsExpanded(false)} className="p-1.5 bg-black/40 hover:bg-red-500/80 backdrop-blur-md rounded-full text-white/70 hover:text-white transition-all"><X size={14} /></button>
      </div>
      <div className="relative aspect-square w-full bg-gray-900 flex items-center justify-center overflow-hidden">
        {isLoadingImage && (<div className="absolute inset-0 flex items-center justify-center z-0"><Loader2 size={32} className="text-purple-500 animate-spin" /></div>)}
        <img src={imageUrl} alt={args.prompt} className={`w-full h-full object-cover transition-opacity duration-500 relative z-10 ${isLoadingImage ? 'opacity-0' : 'opacity-100'}`} onLoad={() => setIsLoadingImage(false)} onError={() => setIsLoadingImage(false)} />
      </div>
      <div className="p-4 bg-gray-900/90 border-t border-purple-500/20">
        <p className="text-xs text-gray-400 italic mb-3 line-clamp-2">"{args.prompt}"</p>
        <div className="flex gap-2">
            <button onClick={handleDownload} className="flex-1 flex items-center justify-center gap-2 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-white text-xs font-bold transition-all"><Download size={14} /> Download High Res</button>
        </div>
      </div>
    </motion.div>
  );
};

// ==========================================
// 3. INVOICE TABLE & MEDIA MANAGER
// ==========================================
const InvoiceTable = ({ data }: { data: any }) => {
  if (!data?.rows) return null;
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-gray-700 bg-gray-900 shadow-2xl animate-in fade-in zoom-in duration-300">
      <div className="bg-gray-800 px-4 py-3 border-b border-gray-700 flex justify-between items-center">
        <div className="flex items-center gap-2 text-blue-400"><Briefcase size={16} /><span className="font-bold text-sm">Amina CPA Report</span></div>
        <span className="text-xs text-gray-500">{data.summary.rowCount} Items Found</span>
      </div>
      <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="text-xs text-gray-400 uppercase bg-gray-800/50"><tr><th className="px-4 py-3">Item</th><th className="px-4 py-3 text-right">Qty</th><th className="px-4 py-3 text-right">Price</th><th className="px-4 py-3 text-right">Tax</th><th className="px-4 py-3 text-right">Total</th></tr></thead><tbody className="divide-y divide-gray-800">{data.rows.map((row: any, i: number) => (<tr key={i} className="hover:bg-gray-800/30 transition-colors"><td className="px-4 py-3 font-medium text-white">{row.item}</td><td className="px-4 py-3 text-right text-gray-400">{row.qty}</td><td className="px-4 py-3 text-right text-gray-300">{row.price.toFixed(2)}</td><td className="px-4 py-3 text-right text-red-300 text-xs">{row.tax > 0 ? `+${row.tax.toFixed(2)}` : '-'}</td><td className="px-4 py-3 text-right font-bold text-green-400">{row.computedTotal.toFixed(2)}</td></tr>))}</tbody></table></div>
      <div className="bg-gray-800/80 px-4 py-3 border-t border-gray-700 flex flex-col gap-1 items-end"><div className="flex justify-between w-40 text-xs text-gray-400"><span>Total Tax:</span><span>{data.summary.totalTax.toFixed(2)}</span></div><div className="flex justify-between w-40 text-lg font-bold text-white"><span>Grand Total:</span><span className="text-green-400">{data.summary.grandTotal.toFixed(2)} MAD</span></div></div>
    </div>
  );
};

const broadcastStop = (sourceId: string | null = null) => {
    if (typeof window !== 'undefined') {
        const action = sourceId ? 'stop_others' : 'stop_all';
        const event = new CustomEvent("AMINA_MEDIA_EVENT", { detail: { action, sourceId } });
        window.dispatchEvent(event);
    }
};

const YouTubePlayer = ({ toolInvocation }: { toolInvocation: any }) => {
    const [isPlaying, setIsPlaying] = useState(true);
    const playerId = useRef(Math.random().toString(36).substr(2, 9)).current; 
    const { args, result } = toolInvocation;
    useEffect(() => {
        broadcastStop(playerId); 
        const handleSignal = (e: any) => {
            const { action, sourceId } = e.detail;
            if (action === 'stop_all') setIsPlaying(false);
            else if (action === 'stop_others' && sourceId !== playerId) setIsPlaying(false);
        };
        window.addEventListener("AMINA_MEDIA_EVENT", handleSignal);
        return () => window.removeEventListener("AMINA_MEDIA_EVENT", handleSignal);
    }, []);
    if (!isPlaying) return (<div className="mt-2 p-2 px-3 rounded-lg bg-gray-800/50 border border-gray-700 flex items-center gap-2 opacity-50 w-fit"><Square size={12} className="text-red-400" fill="currentColor"/> <span className="text-[10px] text-gray-500 uppercase tracking-wider">Session Ended</span></div>);
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const videoId = result?.videoId;
    const videoSrc = videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1&origin=${origin}` : `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(args.query)}&origin=${origin}`;
    return (<div className="mt-3 w-full max-w-md bg-black/40 rounded-xl overflow-hidden border border-red-900/50 shadow-lg relative group animate-in zoom-in duration-300"><div className="relative z-20 p-2 bg-red-900/20 text-red-400 text-xs flex items-center justify-between font-bold border-b border-red-900/30"><div className="flex items-center gap-2"><Music size={14} /> Playing on YouTube</div><button onClick={(e) => { e.stopPropagation(); setIsPlaying(false); }} className="p-1.5 bg-red-500/20 hover:bg-red-500 text-red-200 hover:text-white rounded-full transition-all cursor-pointer z-50"><X size={14} strokeWidth={3} /></button></div><iframe width="100%" height="220" src={videoSrc} title="YouTube" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="w-full relative z-10" /></div>);
};

const StopAction = () => { useEffect(() => { broadcastStop(null); }, []); return (<div className="mt-2 p-2 px-4 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold w-fit flex items-center gap-2 animate-pulse"><Square size={10} fill="currentColor" /> Music Stopped</div>); };

// ==========================================
// 4. RENDER TOOLS
// ==========================================
const RenderToolInvocation = ({ toolInvocation }: { toolInvocation: any }) => {
  const { toolName, args, result } = toolInvocation;
  
  if (toolName === 'generateImage') return <ImageGenerator toolInvocation={toolInvocation} />;
  if (toolName === 'playYoutube') return <YouTubePlayer toolInvocation={toolInvocation} />;
  if (toolName === 'stopMusic') return <StopAction />;
  
  if (toolName === 'googleSearch') {
      return (
          <div className="mt-2 flex items-center gap-2 text-xs text-gray-400 bg-gray-900/50 p-2 rounded-lg border border-gray-800 w-fit animate-in fade-in">
              <Search size={12} className="text-green-400" /> 
              <span>Searching Google for: <span className="text-white font-medium">{args.query}</span>...</span>
          </div>
      );
  }

  if (toolName === 'getCurrentTime') {
      if (!result) return <div className="mt-2 animate-pulse text-xs text-gray-500 flex gap-2"><Clock size={14}/> Checking time...</div>;
      return (
          <div className="mt-3 p-4 bg-gray-900 border border-gray-700 rounded-xl max-w-xs shadow-lg flex items-center gap-4">
              <div className="p-3 bg-blue-900/30 rounded-full text-blue-400"><Clock size={24} /></div>
              <div>
                  <div className="text-2xl font-bold text-white">{result.time}</div>
                  <div className="text-xs text-gray-400">{result.date}</div>
                  <div className="text-[10px] text-blue-400 uppercase tracking-widest mt-1">📍 {result.location}</div>
              </div>
          </div>
      );
  }

  if (toolName === 'getWeather') {
      if (!result) return <div className="mt-2 animate-pulse text-xs text-gray-500 flex gap-2"><CloudSun size={14}/> Checking weather...</div>;
      if (result.error) return <div className="text-red-400 text-xs mt-2">Could not find weather.</div>;
      
      return (
          <div className="mt-3 p-4 bg-gradient-to-br from-gray-900 to-blue-900/20 border border-blue-500/30 rounded-xl max-w-xs shadow-lg">
              <div className="flex justify-between items-start mb-2">
                  <div>
                      <div className="text-3xl font-bold text-white">{result.temperature}</div>
                      <div className="text-sm text-blue-200">{result.condition}</div>
                  </div>
                  <CloudSun size={32} className="text-yellow-400" />
              </div>
              <div className="flex gap-4 mt-3 pt-3 border-t border-white/10">
                  <div className="flex items-center gap-1.5 text-xs text-gray-300"><Droplets size={12} className="text-blue-400"/> {result.humidity}</div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-300"><Wind size={12} className="text-gray-400"/> {result.wind}</div>
              </div>
              <div className="text-[10px] text-right text-gray-500 mt-2 uppercase tracking-wider">📍 {result.location}</div>
          </div>
      );
  }

  if (toolName === 'showMap') {
      const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(args.location)}&output=embed`;
      return (<div className="mt-3 w-full max-w-md bg-black/40 rounded-xl overflow-hidden border border-green-900/50"><div className="p-2 bg-green-900/20 text-green-400 font-bold flex gap-2"><MapPin size={14}/> Location</div><div className="h-48 bg-gray-800"><iframe width="100%" height="100%" frameBorder="0" style={{border:0, filter:'invert(90%) hue-rotate(180deg)'}} src={mapSrc} allowFullScreen></iframe></div></div>);
  }
  if (toolName === 'scheduleEvent') { return (<div className="mt-2 p-3 bg-purple-900/20 border border-purple-500/30 rounded-lg flex items-center gap-3"><Calendar className="text-purple-400" /><div><div className="text-xs text-purple-300 font-bold">Event Scheduled</div><div className="text-sm text-white">{args.title} on {args.date}</div></div><CheckCircle className="text-green-500 ml-auto" size={16} /></div>); }
  if (toolName === 'sendEmail') { return (<div className="mt-3 w-full max-w-sm bg-gray-900 rounded-xl border border-blue-800/50 shadow-lg"><div className="bg-blue-900/20 p-3 border-b border-blue-800/30 flex items-center gap-2"><div className="p-1.5 bg-blue-500 rounded-full"><Mail size={12} className="text-white" /></div><span className="text-sm font-bold text-blue-300">Email Draft</span></div><div className="p-4 text-sm space-y-3"><div className="flex gap-2"><span className="text-gray-500 w-8 text-xs uppercase">To:</span><span className="text-white font-medium">{args.to}</span></div><div className="flex gap-2"><span className="text-gray-500 w-8 text-xs uppercase">Sub:</span><span className="text-white">{args.subject}</span></div><div className="bg-black/30 p-3 rounded-lg text-gray-300 text-xs italic border-l-2 border-blue-500">"{args.body}"</div></div></div>); }
  return null;
};

// ==========================================
// 5. MAIN CHAT INTERFACE
// ==========================================
export default function ChatInterface() {
  const [isAccountantMode, setIsAccountantMode] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false); 
  const [statusText, setStatusText] = useState("");
  const [voiceGender, setVoiceGender] = useState<"female" | "male">("female");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [faceExpression, setFaceExpression] = useState<"idle" | "listening" | "speaking" | "thinking">("idle");
  const [isBlinking, setIsBlinking] = useState(false);
  const [showGame, setShowGame] = useState(false);
  const [showHeadphoneNotice, setShowHeadphoneNotice] = useState(false); 
  
  // 🔥 VISION STATE
  const [visionMode, setVisionMode] = useState<"camera" | "screen" | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ttsController = useRef<AbortController | null>(null);
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastSpokenId = useRef<string | null>(null);
  const isInterruptedRef = useRef(false);

  const theme = isAccountantMode 
    ? { border: "border-blue-500", text: "text-blue-300", bg: "bg-blue-600", gradient: "from-blue-500 to-cyan-500" }
    : { border: "border-purple-500", text: "text-purple-300", bg: "bg-purple-600", gradient: "from-purple-500 to-pink-500", glow: "rgba(168, 85, 247, 0.6)" };

  const { messages, input, handleInputChange, handleSubmit, isLoading, append, setMessages, setInput } = useChat({
    api: "/api/chat",
    body: { data: { isAccountantMode } },
    maxSteps: 5,
    onError: (err) => console.error("Chat Error:", err),
  });

  const MAX_STORE_MESSAGES = 30;
  const storageKey = isAccountantMode ? "amina_memory_accountant" : "amina_memory_bestie";

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) { try { const parsed = JSON.parse(saved); if (Array.isArray(parsed)) setMessages(parsed.slice(-MAX_STORE_MESSAGES)); } catch (e) {} }
    else { setMessages([]); }
  }, [isAccountantMode]);

  useEffect(() => {
    if (messages.length === 0) return;
    const toStore = messages.slice(-MAX_STORE_MESSAGES).map((m: any) => ({ 
        id: m.id, role: m.role, content: (typeof m.content === 'string' ? m.content : "Image"), toolInvocations: m.toolInvocations 
    }));
    const id = setTimeout(() => { try { localStorage.setItem(storageKey, JSON.stringify(toStore)); } catch (e) {} }, 400);
    return () => clearTimeout(id);
  }, [messages, storageKey]);

  const clearChat = () => { if (confirm(`Delete ${isAccountantMode ? 'Accountant' : 'Personal'} memory?`)) { localStorage.removeItem(storageKey); setMessages([]); stopSpeaking(); } };
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
      if (isCallActive) {
          setShowHeadphoneNotice(true);
          const t = setTimeout(() => setShowHeadphoneNotice(false), 6000);
          return () => clearTimeout(t);
      }
  }, [isCallActive]);

  // 🔥 VISION CALLBACK: Send camera/screen data to Chat
  const handleVisionData = async (visionText: string) => {
      if (!visionText) return;
      // Send as hidden system message so Amina reacts to it
      // The filter below prevents this from showing in the UI
      await append({ 
          role: 'user', 
          content: `[VISION DETECTED]: ${visionText}. React naturally to this.` 
      });
  };

  // ... (Stop Speaking logic - No Change)
  const stopSpeaking = () => {
    isInterruptedRef.current = true;
    if (ttsController.current) { ttsController.current.abort(); ttsController.current = null; }
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; audioRef.current.src = ""; audioRef.current = null; }
    setIsSpeaking(false); setStatusText(""); setFaceExpression("idle");
  };

  const splitIntoChunks = (text: string) => { return text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text]; };

  const speakChunk = async (text: string, lang: string) => {
      if (isInterruptedRef.current) return; 
      ttsController.current = new AbortController();
      const signal = ttsController.current.signal;
      try {
          const res = await fetch("/api/speak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, voice: voiceGender, lang }), signal });
          if (!res.ok) throw new Error("TTS Failed");
          if (isInterruptedRef.current) return;
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audioRef.current = audio;
          return new Promise<void>((resolve) => {
              audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
              if (!isInterruptedRef.current) { audio.play().catch(e => resolve()); } else { resolve(); }
          });
      } catch (e: any) { if (e.name !== 'AbortError') console.error("Chunk Error:", e); }
  };

  const speak = async (rawText: string, messageId: string) => {
    if (lastSpokenId.current === messageId) return;
    lastSpokenId.current = messageId;
    isInterruptedRef.current = true; stopSpeaking(); await new Promise(r => setTimeout(r, 50)); isInterruptedRef.current = false;
    const cleanText = rawText.replace(/[\u{1F600}-\u{1F64F}]/gu, "").replace(/[*#_`~-]/g, "").trim();
    if (!cleanText) return;
    let langForTTS = "en-US"; 
    const hinglishMarkers = ["kya", "kyu", "kaise", "kaisi", "hai", "tha", "thi", "haan", "nahi", "tum", "aap", "mera", "mujhe", "batao", "suno", "acha", "theek", "yaar", "bhai", "matlab", "samjha", "aur", "kuch", "bol", "dekh"];
    const isHinglish = hinglishMarkers.some(word => new RegExp(`\\b${word}\\b`, 'i').test(cleanText));
    const isArabicScript = /[؀-ۿ]/.test(cleanText);
    if (isArabicScript) langForTTS = "ar-XA"; else if (isHinglish) langForTTS = "hi-IN"; 
    setStatusText(voiceGender === "female" ? "Amina Speaking..." : "Mohammad Speaking...");
    setIsSpeaking(true); setFaceExpression("speaking");
    startListening(); 
    const chunks = splitIntoChunks(cleanText);
    for (const chunk of chunks) {
        if (isInterruptedRef.current) break; 
        await speakChunk(chunk, langForTTS);
        if (isInterruptedRef.current) break;
        await new Promise(r => setTimeout(r, 200)); 
    }
    if (!isInterruptedRef.current) { setIsSpeaking(false); if (isCallActive) { setStatusText("Listening..."); setFaceExpression("listening"); } else { setStatusText(""); setFaceExpression("idle"); } }
  };

  useEffect(() => { const timeoutId = setTimeout(() => { const last = messages[messages.length - 1]; if (isCallActive && last?.role === "assistant" && !isLoading && last.id !== lastSpokenId.current) { speak(last.content, last.id); } }, 100); return () => clearTimeout(timeoutId); }, [messages, isLoading, isCallActive]);

  const startListening = () => {
    if (!isCallActive) return; 
    if (recognitionRef.current) try { recognitionRef.current.stop(); } catch(e){}
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return setStatusText("Mic not supported");
    const recognition = new SR();
    recognitionRef.current = recognition;
    recognition.continuous = true; recognition.interimResults = true; recognition.lang = "en-US"; 
    recognition.onstart = () => { setIsListening(true); if (!isSpeaking) { setStatusText("Listening..."); setFaceExpression("listening"); } };
    recognition.onresult = (e: any) => { 
        const t = e.results?.[e.results.length - 1]?.[0]?.transcript; 
        const isFinal = e.results?.[e.results.length - 1]?.isFinal;
        if (isSpeaking && t && t.trim().length > 2) { console.log("BARGE-IN:", t); isInterruptedRef.current = true; stopSpeaking(); setFaceExpression("listening"); setStatusText("Listening..."); }
        if (isFinal && t?.trim().length > 1) { setStatusText("Thinking..."); setIsListening(false); recognition.stop(); setFaceExpression("thinking"); append({ role: "user", content: t }); } 
    };
    recognition.onerror = () => { };
    recognition.onend = () => { if (isCallActive && !isLoading) { setTimeout(() => { if(isCallActive) startListening(); }, 100); } };
    try { recognition.start(); } catch(e){}
  };

  const handleAvatarClick = () => { if (isSpeaking) { isInterruptedRef.current = true; stopSpeaking(); setTimeout(() => startListening(), 100); } else if (!isListening) { startListening(); } };

  // ... (Other helpers same)
  useEffect(() => { if (isLoading) { setFaceExpression("thinking"); } else if (!isSpeaking && !isCallActive) { setFaceExpression("idle"); } }, [isLoading, isSpeaking, isCallActive]);
  useEffect(() => { const interval = setInterval(() => { if (faceExpression === "idle") { setIsBlinking(true); setTimeout(() => setIsBlinking(false), 150); } }, 4000); return () => clearInterval(interval); }, [faceExpression]);
  async function resizeAndToDataUrl(file: File): Promise<string> { return new Promise((resolve) => { const img = new Image(); const reader = new FileReader(); reader.onload = (e) => { img.src = e.target?.result as string; }; img.onload = () => { const canvas = document.createElement("canvas"); const ctx = canvas.getContext("2d"); const scale = Math.min(1024 / img.width, 1024 / img.height, 1); canvas.width = img.width * scale; canvas.height = img.height * scale; ctx?.drawImage(img, 0, 0, canvas.width, canvas.height); resolve(canvas.toDataURL("image/jpeg", 0.7)); }; reader.readAsDataURL(file); }); }
  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => { if (e.target.files?.[0]) setSelectedImage(await resizeAndToDataUrl(e.target.files[0])); };
  const handleFormSubmit = async (e: React.FormEvent) => { e.preventDefault(); if ((!input?.trim() && !selectedImage) || isLoading) return; const userMessage = input; const imageToSend = selectedImage; setInput(""); setSelectedImage(null); if (imageToSend) { const userMsgId = Date.now().toString(); const newUserMsg = { id: userMsgId, role: 'user', content: userMessage || "Analyze this image", experimental_attachments: [{ name: "image.jpg", contentType: "image/jpeg", url: imageToSend }] }; setMessages(prev => [...prev, newUserMsg as any]); const assistantMsgId = (Date.now() + 1).toString(); setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: "👀 Looking at image..." } as any]); try { const res = await fetch("/api/vision", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: [{ type: "text", text: userMessage || "Analyze this image" }, { type: "image", image: imageToSend }] }] }), }); const data = await res.json(); setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: data.text } : m)); } catch (err) { console.error("Vision Error:", err); setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: "Error analyzing image." } : m)); } return; } await append({ role: "user", content: userMessage }, { body: { data: { isAccountantMode } } }); };
  const RenderContent = ({ text }: { text?: any }) => { if (!text || typeof text !== 'string') return null; const html = text.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br/>"); try { if (text.trim().startsWith('{') && text.includes('"rows":')) { const data = JSON.parse(text); if (data.rows && data.summary) return <InvoiceTable data={data} />; } } catch (e) {} return <div className="prose prose-invert max-w-full text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />; };
  const MessageContent = ({ message }: { message: any }) => { if (!message || !message.content) return null; if (Array.isArray(message.content)) { return ( <div className="flex flex-col gap-2"> {message.content.map((part: any, i: number) => { if (part.type === 'image' && part.image) return <div key={i} className="rounded-lg overflow-hidden border border-white/20 my-2"><img src={part.image} className="w-full max-w-xs h-auto" /></div>; if (part.type === 'text' && part.text) return <RenderContent key={i} text={part.text} />; return null; })} </div> ); } const hasAttachments = message.experimental_attachments && message.experimental_attachments.length > 0; if (hasAttachments) { return ( <div className="flex flex-col gap-2"> <div className="rounded-lg overflow-hidden border border-white/20 my-2"><img src={message.experimental_attachments[0].url} className="w-full max-w-xs h-auto object-cover" /></div> <RenderContent text={message.content} /> </div> ); } return <RenderContent text={message.content} />; };

  return (
    <div className="flex flex-col h-screen bg-black text-white font-sans relative">
      <header className="h-16 border-b border-white/10 flex items-center px-4 justify-between bg-black/80 fixed w-full top-0 z-50 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full overflow-hidden border-2 ${theme.border}`}><img src="/Amina_logo.png" className="w-full h-full object-cover" /></div>
          <div><h1 className={`font-bold text-lg text-transparent bg-clip-text bg-gradient-to-r ${theme.gradient}`}>{isAccountantMode ? "AMINA CPA" : "AMINA AI"}</h1><p className="text-[10px] text-green-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> Online</p></div>
        </div>
        <div className="flex gap-2 items-center">
            {/* 🔥 NEW VISION BUTTONS */}
            <button onClick={() => setVisionMode('camera')} className="p-2 bg-pink-600/20 text-pink-400 rounded-full border border-pink-500/30 hover:bg-pink-600 hover:text-white transition-all"><Video size={20} /></button>
            <button onClick={() => setVisionMode('screen')} className="p-2 bg-blue-600/20 text-blue-400 rounded-full border border-blue-500/30 hover:bg-blue-600 hover:text-white transition-all"><Monitor size={20} /></button>

            <button onClick={() => setShowGame(true)} className="p-2 bg-purple-600/20 text-purple-400 rounded-full border border-purple-500/30 hover:bg-purple-600 hover:text-white transition-all" title="Stress Buster Mode">
                <Gamepad2 size={20} />
            </button>
            {isAccountantMode && (
                <button onClick={() => setShowCalculator(!showCalculator)} className="p-2 bg-gray-800 text-green-400 rounded-full hover:bg-gray-700 transition-all border border-green-500/30">
                    <Calculator size={20} />
                </button>
            )}
            <button onClick={() => setIsAccountantMode(!isAccountantMode)} className={`p-2 rounded-full ${isAccountantMode ? "bg-blue-600/20 text-blue-300" : "bg-purple-600/20 text-purple-300"}`}>{isAccountantMode ? <Briefcase size={20}/> : <Heart size={20}/>}</button>
            <button onClick={clearChat} className="p-2 bg-red-600/20 text-red-400 rounded-full"><Trash2 size={20} /></button>
            <button onClick={() => setIsCallActive(true)} className="p-2 bg-green-600/20 text-green-400 rounded-full"><Phone size={20} /></button>
        </div>
      </header>
      
      <AnimatePresence>
        {isAccountantMode && showCalculator && (
            <motion.div initial={{ x: 300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 300, opacity: 0 }} className="fixed right-4 top-20 z-40 bg-gray-900 border border-gray-700 p-4 rounded-2xl shadow-2xl w-64">
                <div className="flex justify-between items-center mb-2"><span className="text-sm font-bold text-green-400">Calculator</span><button onClick={() => setShowCalculator(false)}><X size={16} className="text-gray-500 hover:text-white" /></button></div>
                <div className="h-64 bg-black rounded-lg flex items-center justify-center text-gray-500 text-xs overflow-hidden">
                    <iframe src="https://www.desmos.com/scientific" width="100%" height="100%" style={{border:0}} />
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
      {isCallActive && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center">
          <button onClick={() => { setIsCallActive(false); stopSpeaking(); }} className="absolute top-6 right-6 p-3 bg-gray-800 rounded-full hover:bg-gray-700 z-50"><X size={24} /></button>
          
          <div className="relative cursor-pointer" onClick={handleAvatarClick}>
            <CuteAvatar isSpeaking={isSpeaking || isListening} isListening={isListening} />
            <div className="absolute inset-0 flex items-center justify-center z-20">
               {isSpeaking ? null : isListening ? (<div className="bg-green-500 p-3 rounded-full border-2 border-black animate-bounce shadow-lg"><Mic size={24} fill="white" /></div>) : null}
            </div>
          </div>
          
          {/* 🔥 HEADPHONE NOTICE TOAST */}
          <AnimatePresence>
            {showHeadphoneNotice && (
                <motion.div 
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="absolute top-20 bg-black/80 text-white px-4 py-2 rounded-full border border-white/20 flex items-center gap-2 text-sm backdrop-blur-md z-[110]"
                >
                    <Headphones size={16} className="text-purple-400" /> Use headphones for best experience! 🎧
                </motion.div>
            )}
          </AnimatePresence>

          <h2 className="mt-10 text-3xl font-bold text-white">{voiceGender === "female" ? "Amina" : "Mohammad"}</h2>
          <p className={`text-lg mt-2 font-medium ${theme.text}`}>{statusText || "Tap Avatar to Start"}</p>
          <div className="absolute bottom-12 flex items-center gap-3"><button onClick={() => setVoiceGender((v) => (v === "female" ? "male" : "female"))} className="px-6 py-3 rounded-full bg-white/10 border border-white/10 hover:bg-white/20 transition-all">Switch Voice ({voiceGender})</button></div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* 🔥 VISION MANAGER OVERLAY */}
      <AnimatePresence>
        {visionMode && (
            <VisionManager 
                mode={visionMode} 
                onClose={() => setVisionMode(null)} 
                onAnalysisComplete={handleVisionData} // Call Amina logic
            />
        )}
      </AnimatePresence>

      <main className="flex-1 overflow-y-auto pt-20 pb-24 px-4 md:px-20 lg:px-64 scroll-smooth">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center animate-in fade-in">
            <div className={`w-32 h-32 rounded-full overflow-hidden border-4 ${theme.border} mb-6 shadow-[0_0_30px_rgba(168,85,247,0.3)]`}><img src="/Amina_logo.png" className="w-full h-full object-cover" /></div>
            <h2 className={`text-3xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r ${theme.gradient} mb-4`}>{isAccountantMode ? "Work Mode On" : "أهلاً بكِ يا دعاء ❤️"}</h2>
            <p className="text-lg text-gray-300">{isAccountantMode ? "Ready to crunch numbers." : "I am here for you."}</p>
          </div>
        )}
        
        {messages.map((m: any) => {
            // 🔥 HIDE VISION LOGS (This is what hides the [VISION DETECTED] text)
            if (typeof m.content === 'string' && m.content.startsWith("[VISION DETECTED]")) return null;

            const hasContent = (m.content && typeof m.content === 'string' && m.content.trim().length > 0) || (Array.isArray(m.content) && m.content.length > 0);
            const hasTools = m.toolInvocations && m.toolInvocations.length > 0;
            if (!hasContent && !hasTools) return null; 

            return (
              <div key={m.id} className="mb-4">
                  {m.role === "assistant" ? (
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-full overflow-hidden border-2 ${theme.border} shrink-0`}><img src="/Amina_logo.png" className="w-full h-full object-cover" /></div>
                      <div className="flex flex-col gap-1 max-w-3xl">
                          {hasContent && (
                              <div className="bg-[#111827] text-gray-200 px-4 py-3 rounded-xl shadow-md border border-white/5 mb-1">
                                  <MessageContent message={m} />
                              </div>
                          )}
                          {m.toolInvocations?.map((tool: any) => (<RenderToolInvocation key={tool.toolCallId} toolInvocation={tool} />))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3 justify-end">
                      <div className={`bg-gradient-to-r ${theme.gradient} text-white px-4 py-2 rounded-full max-w-xs break-words shadow-lg`}>
                        <MessageContent message={m} />
                      </div>
                    </div>
                  )}
              </div>
            );
        })}
        {isLoading && <div className="flex items-center gap-2 text-gray-500 text-xs ml-14 animate-pulse"><Sparkles size={12} /> Amina is thinking...</div>}
        <div ref={messagesEndRef} />
      </main>

      <footer className="fixed bottom-0 w-full p-4 bg-black/90 backdrop-blur-md z-50 border-t border-white/10">
        <div className="max-w-3xl mx-auto">
          {selectedImage && <div className="mb-2 relative w-fit animate-in slide-in-from-bottom-2"><img src={selectedImage} alt="Selected" className={`w-20 h-20 object-cover rounded-lg border ${theme.border}`} /><button onClick={() => setSelectedImage(null)} className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1"><X size={12} fill="white" /></button></div>}
          <form onSubmit={handleFormSubmit} className="relative flex items-center gap-2 bg-[#1a1a1a] border border-white/10 p-2 pl-4 rounded-full shadow-2xl">
            <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
            <button type="button" onClick={() => fileInputRef.current?.click()} className="text-gray-400 hover:text-white"><Paperclip size={20} /></button>
            <input className="flex-1 bg-transparent border-none outline-none text-white" value={input} onChange={handleInputChange} placeholder={isAccountantMode ? "Enter data..." : "Message..."} />
            <button type="button" onClick={() => { if (!isListening) startListening(); }} className="p-2 text-gray-400 hover:text-white"><Mic size={20} /></button>
            <button type="submit" disabled={isLoading} className={`p-3 ${theme.bg} text-white rounded-full`}><Send size={18} /></button>
          </form>
        </div>
      </footer>

      <AnimatePresence>
        {showGame && (
            <StressBuster onClose={() => setShowGame(false)} />
        )}
      </AnimatePresence>

    </div>
  );
}