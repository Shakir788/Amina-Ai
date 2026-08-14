"use client";

import { useChat } from "ai/react";
import {
  Send, Mic, Paperclip, Phone, X, Trash2,
  Heart, Music, MapPin, Sparkles,
  Mail, Calendar, CheckCircle, Square, Download,
  Image as ImageIcon, Loader2, Gamepad2,
  Clock, CloudSun, Wind, Droplets, Search, Headphones,
  Video, Monitor, Menu, ShoppingBag, Wand2, Share2,
  Paintbrush
} from "lucide-react";
import React, { useRef, useEffect, useState, ChangeEvent, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import StressBuster from './StressBuster';
import VisionManager from './VisionManager';

// Hardware bridge
import { executeMobileAction } from '@/app/lib/mobile-hardware';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { useRealtimeVoice } from './RealtimeVoice';
import ChatSidebar from './ChatSidebar';
import SmartChips from "./SmartChips";
import ImageVault from './ImageVault';
import SketchPad from './SketchPad'; 

// ==========================================================
// PREMIUM SOUND EFFECTS (Web Audio API) 🎵
// ==========================================================
const playSuccessSound = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContext();
    
    // Main "Ting" sound
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // Note A5
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1); // Slide to A6
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05); // Fade in
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5); // Fade out
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
    
    // Secondary "Sparkle" chord layer
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1108.73, ctx.currentTime); // Note C#6
    gain2.gain.setValueAtTime(0, ctx.currentTime);
    gain2.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.05);
    osc2.stop(ctx.currentTime + 0.6);
  } catch (e) {
    console.log("Audio not supported", e);
  }
};

// ==========================================================
// DESIGN TOKENS
// ==========================================================
const THEME = {
  id: "personal",
  label: "Amina",
  from: "#A855F7",
  to: "#F472B6",
  soft: "#F3E8FF",
  text: "#7C3AED",
  sky: "linear-gradient(160deg, #FDEBF3 0%, #F3E7FB 35%, #E4D3F5 70%, #D9C2EE 100%)",
  icon: Heart,
};

// ==========================================================
// BACKGROUND
// ==========================================================
const AmbientBackground = memo(() => {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none transform-gpu" style={{ background: THEME.sky }}>
      <motion.div
        animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[-10%] left-[10%] w-[420px] h-[420px] rounded-full blur-[100px] opacity-40"
        style={{ background: THEME.from }}
      />
      <motion.div
        animate={{ x: [0, -25, 0], y: [0, 25, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-[-10%] right-[10%] w-[460px] h-[460px] rounded-full blur-[110px] opacity-40"
        style={{ background: THEME.to }}
      />
    </div>
  );
});
AmbientBackground.displayName = "AmbientBackground";

// ==========================================================
// TYPEWRITER
// ==========================================================
const TypewriterEffect = ({ content, isLast, isLoading }: { content: string; isLast: boolean; isLoading: boolean }) => {
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    if (!isLast || !isLoading) {
      setDisplayedText(content);
      return;
    }
    if (displayedText.length < content.length) {
      const tId = setTimeout(() => {
        setDisplayedText(content.slice(0, displayedText.length + 3));
      }, 10);
      return () => clearTimeout(tId);
    }
  }, [content, isLast, isLoading, displayedText]);

  return (
    <div className="prose prose-sm max-w-none leading-relaxed prose-p:text-[#3A2E4A]">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayedText || content}</ReactMarkdown>
      {isLast && isLoading && displayedText.length < content.length && (
        <span className="inline-block w-1.5 h-4 ml-1 bg-[#A855F7] animate-pulse align-middle rounded-full" />
      )}
    </div>
  );
};

// ==========================================================
// WELCOME SCREEN
// ==========================================================
const SUGGESTIONS = [
  { icon: ShoppingBag, title: "Create product photos", desc: "Turn a garment photo into a model shot", prompt: "Help me create product photos for a new dress." },
  { icon: Calendar, title: "Plan my day", desc: "Lay out today's priorities together", prompt: "Help me plan my day." },
  { icon: Music, title: "Play something", desc: "Ask Amina to play music or set the mood", prompt: "Play some relaxing music for me." },
];

const WelcomeScreen = memo(
  ({ name, onPick }: { name: string; onPick: (prompt: string) => void }) => {
    return (
      <div className="w-full max-w-2xl flex flex-col items-center text-center px-4">
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-2">
          <span className="text-[#231A2E]">Hello </span>
          <span className="bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(135deg, ${THEME.from}, ${THEME.to})` }}>
            {name}
          </span>
        </h1>
        <p className="text-xl md:text-2xl text-[#B0A6C0] font-medium mb-8">
          How can I help you today?
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
          {SUGGESTIONS.map((c) => {
            const Icon = c.icon;
            return (
              <button
                key={c.title}
                onClick={() => onPick(c.prompt)}
                className="text-left p-4 rounded-2xl border border-black/5 bg-white/70 hover:bg-white transition-colors shadow-sm"
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ background: `linear-gradient(135deg, ${THEME.from}, ${THEME.to})` }}>
                  <Icon size={15} className="text-white" />
                </div>
                <div className="text-sm font-medium text-[#231A2E] mb-1">{c.title}</div>
                <div className="text-xs text-[#9B92AA] leading-snug">{c.desc}</div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }
);
WelcomeScreen.displayName = "WelcomeScreen";

// ==========================================================
// TOOL INVOCATION RENDERING
// ==========================================================
const RenderToolInvocation = memo(({ toolInvocation }: { toolInvocation: any }) => {
  const { toolName, args, result } = toolInvocation;

  if (toolName === "generateImage") return <ImageGenerator toolInvocation={toolInvocation} />;
  if (toolName === "playYoutube") return <YouTubePlayer toolInvocation={toolInvocation} />;
  if (toolName === "stopMusic") return <StopAction />;

  if (toolName === "showSearchVisuals" || toolName === "googleSearch") {
    return (
      <div className="mt-2 flex items-center gap-2 text-xs text-[#9B92AA] bg-white/70 p-2 rounded-lg border border-black/5 w-fit">
        <Search size={12} style={{ color: THEME.text }} className="animate-pulse" />
        <span>Searching for: <span className="text-[#231A2E] font-medium">{args.query}</span>…</span>
      </div>
    );
  }

  if (toolName === "getCurrentTime") {
    if (!result) return <div className="mt-2 animate-pulse text-xs text-[#B0A6C0] flex gap-2"><Clock size={14} /> Checking time…</div>;
    return (
      <div className="mt-3 p-4 bg-white/80 border border-black/5 rounded-xl max-w-xs shadow-sm flex items-center gap-4">
        <div className="p-3 rounded-full" style={{ background: THEME.soft, color: THEME.text }}><Clock size={22} /></div>
        <div>
          <div className="text-2xl font-semibold text-[#231A2E]">{result.time}</div>
          <div className="text-xs text-[#9B92AA]">{result.date}</div>
          <div className="text-[10px] uppercase tracking-widest mt-1" style={{ color: THEME.text }}>📍 {result.location}</div>
        </div>
      </div>
    );
  }

  if (toolName === "getWeather") {
    if (!result) return <div className="mt-2 animate-pulse text-xs text-[#B0A6C0] flex gap-2"><CloudSun size={14} /> Checking weather…</div>;
    if (result.error) return <div className="text-red-400 text-xs mt-2">Could not find weather.</div>;
    return (
      <div className="mt-3 p-4 bg-white/80 border border-black/5 rounded-xl max-w-xs shadow-sm">
        <div className="flex justify-between items-start mb-2">
          <div>
            <div className="text-3xl font-semibold text-[#231A2E]">{result.temperature}</div>
            <div className="text-sm" style={{ color: THEME.text }}>{result.condition}</div>
          </div>
          <CloudSun size={30} style={{ color: THEME.from }} />
        </div>
        <div className="flex gap-4 mt-3 pt-3 border-t border-black/5">
          <div className="flex items-center gap-1.5 text-xs text-[#5B5468]"><Droplets size={12} style={{ color: THEME.text }} /> {result.humidity}</div>
          <div className="flex items-center gap-1.5 text-xs text-[#5B5468]"><Wind size={12} className="text-[#9B92AA]" /> {result.wind}</div>
        </div>
        <div className="text-[10px] text-right text-[#B0A6C0] mt-2 uppercase tracking-wider">📍 {result.location}</div>
      </div>
    );
  }

  if (toolName === "showMap") {
    const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(args.location)}&output=embed`;
    return (
      <div className="mt-3 w-full max-w-md bg-white/80 rounded-xl overflow-hidden border border-black/5 shadow-sm">
        <div className="p-2 font-medium flex gap-2 text-sm" style={{ background: THEME.soft, color: THEME.text }}><MapPin size={14} /> Location</div>
        <div className="h-48"><iframe width="100%" height="100%" frameBorder="0" src={mapSrc} allowFullScreen /></div>
      </div>
    );
  }

  if (toolName === "scheduleEvent") {
    return (
      <div className="mt-2 p-3 bg-white/80 border border-black/5 rounded-lg flex items-center gap-3 shadow-sm">
        <Calendar style={{ color: THEME.from }} />
        <div>
          <div className="text-xs font-medium" style={{ color: THEME.text }}>Event scheduled</div>
          <div className="text-sm text-[#231A2E]">{args.title} on {args.date}</div>
        </div>
        <CheckCircle className="ml-auto text-emerald-500" size={16} />
      </div>
    );
  }

  if (toolName === "sendEmail") {
    return (
      <div className="mt-3 w-full max-w-sm bg-white/80 rounded-xl border border-black/5 shadow-sm">
        <div className="p-3 border-b border-black/5 flex items-center gap-2" style={{ background: THEME.soft }}>
          <div className="p-1.5 rounded-full" style={{ background: THEME.from }}><Mail size={12} className="text-white" /></div>
          <span className="text-sm font-medium" style={{ color: THEME.text }}>Email draft</span>
        </div>
        <div className="p-4 text-sm space-y-3">
          <div className="flex gap-2"><span className="text-[#9B92AA] w-8 text-xs uppercase">To</span><span className="text-[#231A2E] font-medium">{args.to}</span></div>
          <div className="flex gap-2"><span className="text-[#9B92AA] w-8 text-xs uppercase">Sub</span><span className="text-[#3A2E4A]">{args.subject}</span></div>
          <div className="bg-[#F5F1FA] p-3 rounded-lg text-[#5B5468] text-xs italic border-l-2" style={{ borderColor: THEME.from }}>{args.body}</div>
        </div>
      </div>
    );
  }

  return null;
});
RenderToolInvocation.displayName = "RenderToolInvocation";

const ThinkingIndicator = () => {
  return (
    <div className="flex items-center gap-3 p-4 ml-2">
      <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: THEME.soft }}>
        <Sparkles size={14} style={{ color: THEME.text }} className="animate-spin-slow" />
      </div>
      <div className="flex gap-1 h-4 items-center">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{ height: [4, 14, 4], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
            className="w-1 rounded-full"
            style={{ background: THEME.from }}
          />
        ))}
      </div>
      <span className="text-xs font-medium tracking-wide ml-1" style={{ color: THEME.text }}>thinking…</span>
    </div>
  );
};

const CallAvatar = ({ isSpeaking, isListening }: { isSpeaking: boolean; isListening: boolean }) => {
  return (
    <motion.div
      animate={{ y: [0, -5, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      className="relative w-56 h-56 rounded-full flex flex-col items-center justify-center bg-white shadow-[0_20px_60px_rgba(168,85,247,0.25)] overflow-hidden border-4 border-white"
      style={{ boxShadow: `0 20px 60px ${THEME.from}33` }}
    >
      <div className="flex gap-7 mb-2 mt-6">
        {[0, 1].map((i) => (
          <motion.div
            key={i}
            initial={{ scaleY: 1 }}
            animate={{ scaleY: [1, 1, 0.1, 1, 1, 1] }}
            transition={{ repeat: Infinity, duration: 4.5, times: [0, 0.9, 0.92, 0.95, 0.98, 1] }}
            className="w-16 h-20 rounded-[50%] relative overflow-hidden shadow-inner"
            style={{ background: `linear-gradient(180deg, ${THEME.to}, ${THEME.from})` }}
          >
            <div className="absolute top-3 left-3 w-5 h-6 bg-white rounded-full opacity-90 rotate-[-20deg] blur-[0.5px]" />
          </motion.div>
        ))}
      </div>
      <div className="h-8 flex items-center justify-center mt-2">
        {isSpeaking ? (
          <motion.div
            animate={{ height: [5, 12, 5], width: [12, 16, 12], borderRadius: ["10px", "14px", "10px"] }}
            transition={{ duration: 0.25, repeat: Infinity, ease: "easeInOut" }}
            style={{ background: THEME.from }}
          />
        ) : (
          <div className="w-4 h-1.5 rounded-b-full" style={{ background: THEME.to }} />
        )}
      </div>
    </motion.div>
  );
};

const ImageGenerator = ({ toolInvocation }: { toolInvocation: any }) => {
  const { args, result } = toolInvocation;
  const [isExpanded, setIsExpanded] = useState(true);
  const [isLoadingImage, setIsLoadingImage] = useState(true);

  if (!result) {
    return (
      <div className="mt-3 w-full max-w-sm bg-white/80 rounded-xl border border-black/5 p-4 shadow-sm animate-pulse">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-full" style={{ background: THEME.soft }}><Sparkles size={18} style={{ color: THEME.text }} className="animate-spin-slow" /></div>
          <span className="text-sm font-medium" style={{ color: THEME.text }}>Amina is creating art…</span>
        </div>
        <div className="h-48 bg-[#F5F1FA] rounded-lg flex items-center justify-center"><Loader2 size={30} style={{ color: THEME.from }} className="animate-spin" /></div>
        <div className="mt-2 text-xs text-[#9B92AA] italic">{args.prompt}</div>
      </div>
    );
  }

  if (result.error) {
    return (
      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
        <X className="text-red-400" size={18} />
        <span className="text-sm text-red-500">Image generation failed. Try again.</span>
      </div>
    );
  }

  const imageUrl = result.imageUrl;

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const response = await fetch(imageUrl, { mode: "cors" });
      if (!response.ok) throw new Error("Network error");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `amina_art_${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      window.open(imageUrl, "_blank");
    }
  };

  if (!isExpanded) {
    return (
      <button onClick={() => setIsExpanded(true)} className="mt-2 flex items-center gap-2 px-4 py-2 bg-white/80 rounded-full border border-black/5 text-xs shadow-sm hover:bg-white transition-all" style={{ color: THEME.text }}>
        <ImageIcon size={14} /> View generated image
      </button>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="mt-4 w-full max-w-md bg-white rounded-2xl overflow-hidden border border-black/5 shadow-lg relative">
      <div className="absolute top-0 left-0 w-full p-3 bg-gradient-to-b from-black/30 to-transparent flex justify-between items-start z-10">
        <div className="flex items-center gap-2 px-2 py-1 bg-white/80 backdrop-blur-md rounded-full">
          <Sparkles size={12} style={{ color: THEME.text }} /> <span className="text-[10px] font-medium text-[#231A2E] uppercase tracking-wide">AI generated</span>
        </div>
        <button onClick={() => setIsExpanded(false)} className="p-1.5 bg-white/80 hover:bg-red-100 backdrop-blur-md rounded-full text-[#5B5468] hover:text-red-500 transition-all"><X size={14} /></button>
      </div>
      <div className="relative aspect-square w-full bg-[#F5F1FA] flex items-center justify-center overflow-hidden">
        {isLoadingImage && <div className="absolute inset-0 flex items-center justify-center z-0"><Loader2 size={30} style={{ color: THEME.from }} className="animate-spin" /></div>}
        <img src={imageUrl} alt={args.prompt} className={`w-full h-full object-cover transition-opacity duration-500 relative z-10 ${isLoadingImage ? "opacity-0" : "opacity-100"}`} onLoad={() => setIsLoadingImage(false)} onError={() => setIsLoadingImage(false)} />
      </div>
      <div className="p-4 bg-white border-t border-black/5">
        <p className="text-xs text-[#9B92AA] italic mb-3 line-clamp-2">{args.prompt}</p>
        <button onClick={handleDownload} className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-white text-xs font-semibold transition-all" style={{ background: `linear-gradient(135deg, ${THEME.from}, ${THEME.to})` }}>
          <Download size={14} /> Download high res
        </button>
      </div>
    </motion.div>
  );
};

const broadcastStop = (sourceId: string | null = null) => {
  if (typeof window !== "undefined") {
    const action = sourceId ? "stop_others" : "stop_all";
    window.dispatchEvent(new CustomEvent("AMINA_MEDIA_EVENT", { detail: { action, sourceId } }));
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
      if (action === "stop_all") setIsPlaying(false);
      else if (action === "stop_others" && sourceId !== playerId) setIsPlaying(false);
    };
    window.addEventListener("AMINA_MEDIA_EVENT", handleSignal);
    return () => window.removeEventListener("AMINA_MEDIA_EVENT", handleSignal);
  }, []);

  if (!isPlaying) {
    return (
      <div className="mt-2 p-2 px-3 rounded-lg bg-white/80 border border-black/5 flex items-center gap-2 opacity-60 w-fit">
        <Square size={12} className="text-red-400" fill="currentColor" /> <span className="text-[10px] text-[#9B92AA] uppercase tracking-wider">Session ended</span>
      </div>
    );
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const videoId = result?.videoId;
  const videoSrc = videoId
    ? `https://www.youtube.com/embed/${videoId}?autoplay=1&origin=${origin}`
    : `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(args.query)}&origin=${origin}`;

  return (
    <div className="mt-3 w-full max-w-md bg-white/90 rounded-xl overflow-hidden border border-black/5 shadow-sm relative">
      <div className="p-2 bg-[#FAF8FC] text-[#5B5468] text-xs flex items-center justify-between font-medium border-b border-black/5">
        <div className="flex items-center gap-2"><Music size={14} className="text-[#F472B6]" /> Playing</div>
        <button onClick={(e) => { e.stopPropagation(); setIsPlaying(false); }} className="p-1.5 bg-black/5 hover:bg-red-100 text-[#5B5468] hover:text-red-500 rounded-full transition-all"><X size={14} strokeWidth={3} /></button>
      </div>
      <iframe width="100%" height="220" src={videoSrc} title="YouTube" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="w-full" />
    </div>
  );
};

const StopAction = () => {
  useEffect(() => { broadcastStop(null); }, []);
  return (
    <div className="mt-2 p-2 px-4 rounded-full bg-red-50 border border-red-200 text-red-500 text-xs font-medium w-fit flex items-center gap-2">
      <Square size={10} fill="currentColor" /> Music stopped
    </div>
  );
};

const InputBar = ({
  centered = false,
  input,
  handleInputChange,
  handleFormSubmit,
  selectedImage,
  setSelectedImage,
  fileInputRef,
  handleFileSelect,
  onMicClick,
  isListening,
  isLoading,
  themeFrom,
  themeTo,
  placeholder,
  onSketchClick, // 🔥 Yahan add kiya
}: {
  centered?: boolean;
  input: string;
  handleInputChange: (e: ChangeEvent<HTMLInputElement> | ChangeEvent<HTMLTextAreaElement>) => void;
  handleFormSubmit: (e: React.FormEvent) => void;
  selectedImage: string | null;
  setSelectedImage: (v: string | null) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleFileSelect: (e: ChangeEvent<HTMLInputElement>) => void;
  onMicClick: () => void;
  isListening: boolean;
  isLoading: boolean;
  themeFrom: string;
  themeTo: string;
  placeholder?: string;
  onSketchClick?: () => void; // 🔥 Typescript error fix karne ke liye yahan add kiya
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  useEffect(() => {
    autoResize();
  }, [input]);

  const submitIfNotEmpty = (e: React.FormEvent) => {
    handleFormSubmit(e);
    requestAnimationFrame(() => {
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    });
  };

  return (
    <div className={centered ? "w-full mt-8" : "max-w-3xl mx-auto"}>
      {selectedImage && (
        <div className="mb-2 relative w-fit mx-auto">
          <img src={selectedImage} alt="Selected" className="w-20 h-20 object-cover rounded-lg border-2 border-white shadow" />
          <button onClick={() => setSelectedImage(null)} className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1"><X size={12} color="white" /></button>
        </div>
      )}
      <form onSubmit={submitIfNotEmpty} className="relative flex items-end gap-2 bg-white border border-black/5 p-2 pl-4 rounded-3xl shadow-lg transition-all">
        <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
        <button type="button" onClick={() => fileInputRef.current?.click()} className="text-[#B0A6C0] hover:text-[#5B5468] transition-colors mb-2"><Paperclip size={19} /></button>
        
        {/* 🔥 Yahan aa gaya tera Sketchpad ka button */}
        {onSketchClick && (
          <button type="button" onClick={onSketchClick} className="text-[#B0A6C0] hover:text-[#5B5468] transition-colors mb-2 ml-1" title="Sketchpad">
            <Paintbrush size={18} />
          </button>
        )}

        <textarea
          ref={textareaRef}
          rows={1}
          className="flex-1 bg-transparent border-none outline-none resize-none text-[#231A2E] placeholder:text-[#B0A6C0] text-sm md:text-base py-2 max-h-40 overflow-y-auto"
          value={input}
          onChange={handleInputChange}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submitIfNotEmpty(e);
            }
          }}
          placeholder={placeholder || "Ask something… (Shift+Enter for new line)"}
        />
        <button
          type="button"
          onClick={onMicClick}
          className={`p-2 mb-1 transition-colors ${isListening ? "text-red-500 animate-pulse" : "text-[#B0A6C0] hover:text-[#5B5468]"}`}
          title={isListening ? "Listening…" : "Tap to speak"}
        >
          <Mic size={19} />
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="w-10 h-10 flex items-center justify-center rounded-full transition-all text-white shrink-0"
          style={{ background: `linear-gradient(135deg, ${themeFrom}, ${themeTo})` }}
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
};

// ==========================================================
// CUTE IMAGE LOADING ANIMATION ✨
// ==========================================================
const ImageLoadingAnimation = ({ text }: { text: string }) => {
  return (
    <div className="w-full max-w-sm mt-1 mb-2">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 rounded-full shadow-sm" style={{ background: THEME.soft }}>
          <Sparkles size={16} style={{ color: THEME.text }} className="animate-spin-slow" />
        </div>
        <span className="text-sm font-medium animate-pulse" style={{ color: THEME.text }}>{text}</span>
      </div>
      <div className="relative aspect-square w-full rounded-2xl overflow-hidden border border-black/5 bg-[#F5F1FA] shadow-sm flex items-center justify-center">
        <motion.div
          className="absolute inset-0 opacity-50"
          style={{
            background: `linear-gradient(90deg, transparent, ${THEME.soft}, transparent)`,
            backgroundSize: "200% 100%"
          }}
          animate={{ backgroundPosition: ["200% 0", "-200% 0"] }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
        />
        <Loader2 size={32} style={{ color: THEME.from }} className="animate-spin relative z-10" />
      </div>
    </div>
  );
};

// ==========================================================
// MESSAGE CONTENT (Updated with Share Button)
// ==========================================================
const MessageContent = memo(
  ({ message, isLast, isLoading, localImage }: { message: any; isLast: boolean; isLoading: boolean; localImage?: string }) => {
    if (!message || !message.content) return null;

    const RenderContent = ({ text }: { text?: any }) => {
      if (!text || typeof text !== "string") return null;

      if (text === "Editing the photo…") {
        return <ImageLoadingAnimation text="Amina is weaving her magic... 🎨✨" />;
      }
      if (text === "Looking at the image…") {
        return <ImageLoadingAnimation text="Amina is analyzing the details... 👁️✨" />;
      }

      return (
        <div className="prose prose-sm max-w-none leading-relaxed prose-p:text-[#3A2E4A]">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
        </div>
      );
    };

    // 🔥 Download Logic
    const handleDownloadLocalImage = async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!localImage) return;
      try {
        const res = await fetch(localImage);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `amina_${Date.now()}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch {
        window.open(localImage, "_blank");
      }
    };

    // 🔥 Native Share Logic
    const handleShareLocalImage = async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!localImage) return;
      
      try {
        const res = await fetch(localImage);
        const blob = await res.blob();
        const file = new File([blob], `amina_art_${Date.now()}.jpg`, { type: blob.type });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: 'Amina AI Art',
            text: 'Check out this awesome design I generated with Amina AI! ✨',
            files: [file],
          });
        } else {
          alert("Sharing directly is not supported on this browser. Please use the download button instead! 😅");
        }
      } catch (err) {
        console.error("Share failed:", err);
      }
    };

    return (
      <div className="flex flex-col gap-2">
        {localImage && (
          <div className="rounded-xl overflow-hidden border border-black/5 mt-1 mb-2 shadow-sm bg-black/5 relative group">
            <img src={localImage} alt="Attached/Edited Result" className="w-full max-w-sm h-auto object-contain" />
            
            {/* Action Buttons Container */}
            <div className="absolute bottom-2 right-2 flex gap-2 opacity-90 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
              {/* Share Button */}
              <button
                onClick={handleShareLocalImage}
                className="p-2 bg-white/90 hover:bg-white rounded-full shadow-sm"
                title="Share image"
              >
                <Share2 size={14} className="text-[#5B5468]" />
              </button>
              
              {/* Download Button */}
              <button
                onClick={handleDownloadLocalImage}
                className="p-2 bg-white/90 hover:bg-white rounded-full shadow-sm"
                title="Download image"
              >
                <Download size={14} className="text-[#5B5468]" />
              </button>
            </div>
          </div>
        )}

        {isLast && message.role === "assistant" ? (
          <TypewriterEffect content={typeof message.content === "string" ? message.content : ""} isLast={isLast} isLoading={isLoading} />
        ) : (
          <RenderContent text={message.content} />
        )}
      </div>
    );
  }
);
MessageContent.displayName = "MessageContent";

const EDIT_INTENT_KEYWORDS = [
  "change", "badal", "badlo", "replace", "remove", "hatao", "hata do",
  "background", "backdrop", "model", "pose", "put this on", "wear",
  "edit", "banao", "bana do", "generate", "add", "dress pe", "pehna",
  "color", "colour", "rang", "different", "alag", "short", "style"
];

function looksLikeImageEditRequest(text: string): boolean {
  const t = (text || "").toLowerCase();
  if (!t.trim()) return true;
  return EDIT_INTENT_KEYWORDS.some((k) => t.includes(k));
}

// ==========================================================
// MAIN CHAT INTERFACE
// ==========================================================
export default function ChatInterface() {
  const userName = "Mohammad Shakir Salmani";

  const [localImages, setLocalImages] = useState<Record<string, string>>({});

  const [imageStudioMessages, setImageStudioMessages] = useState<any[]>([]);
  const [imageStudioLocalImages, setImageStudioLocalImages] = useState<Record<string, string>>({});

  const [isCallActive, setIsCallActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [voiceGender, setVoiceGender] = useState<"female" | "male">("female");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [faceExpression, setFaceExpression] = useState<"idle" | "listening" | "speaking" | "thinking">("idle");
  const [showGame, setShowGame] = useState(false);
  const [showHeadphoneNotice, setShowHeadphoneNotice] = useState(false);
  
  // 🔥 NEW STATES FOR VAULT & SKETCHPAD
  const [isVaultOpen, setIsVaultOpen] = useState(false);
  const [isSketchpadOpen, setIsSketchpadOpen] = useState(false);

  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [activeMode, setActiveMode] = useState<"chat" | "image">("chat");
  const [isDictating, setIsDictating] = useState(false);
  const dictationRecRef = useRef<any>(null);

  const currentChatIdRef = useRef<string | null>(null);
  useEffect(() => { currentChatIdRef.current = currentChatId; }, [currentChatId]);

  const [visionMode, setVisionMode] = useState<"camera" | "screen" | null>(null);

  const [isLiveMode, setIsLiveMode] = useState(false);
  const {
    status: rtStatus,
    errorMsg: rtError,
    aiSpeaking: rtSpeaking,
    startCall: rtStart,
    endCall: rtEnd,
  } = useRealtimeVoice();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ttsController = useRef<AbortController | null>(null);
  const isAiSpeakingRef = useRef(false);
  const isProcessingRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastSpokenId = useRef<string | null>(null);
  const isLiveModeRef = useRef(false);

  const { messages, input, handleInputChange, handleSubmit, isLoading, append, setMessages, setInput, data } = useChat({
    api: "/api/chat",
    maxSteps: 5,
    onFinish: async (message) => {
      isProcessingRef.current = false;
      const chatId = currentChatIdRef.current;
      if (chatId) {
        const replyText = typeof message.content === "string" ? message.content : "";
        if (replyText.trim()) saveMessageToDb(chatId, "assistant", replyText);
      }
      if (isCallActive) {
        setTimeout(() => { if (isCallActive && !isAiSpeakingRef.current) startListening(); }, 200);
      }
    },
    onError: (err) => {
      console.error("Chat error:", err);
      isProcessingRef.current = false;
      if (isCallActive) setStatusText("Error. Retrying…");
    },
  });

  async function ensureChatId(): Promise<string | null> {
    if (currentChatIdRef.current) return currentChatIdRef.current;
    try {
      const res = await fetch("/api/chats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      if (!res.ok) throw new Error("Failed to create chat");
      const chat = await res.json();
      currentChatIdRef.current = chat.id;
      setCurrentChatId(chat.id);
      return chat.id;
    } catch (e) {
      console.error("Failed to create chat:", e);
      return null;
    }
  }

  async function saveMessageToDb(chatId: string, role: "user" | "assistant", content: string, imageUrl?: string) {
    try {
      await fetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, content, imageUrl }),
      });
    } catch (e) {
      console.error("Failed to save message:", e);
    }
  }

  async function sendUserMessage(content: string) {
    const wasNewChat = !currentChatIdRef.current;
    const chatId = await ensureChatId();
    if (chatId) {
      saveMessageToDb(chatId, "user", content);
      if (wasNewChat) {
        fetch(`/api/chats/${chatId}/auto-rename`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: content }),
        })
          .then(() => window.dispatchEvent(new Event("chats-updated")))
          .catch((e) => console.error("Auto-rename failed:", e));
      }
    }
    await append({ role: "user", content });
  }

  // 🔥 FIX 1: Fetching both 'image_url' (DB) and 'imageUrl' formats safely
  async function resumeChat(id: string) {
    try {
      const res = await fetch(`/api/chats/${id}`);
      if (!res.ok) throw new Error("Failed to load chat");
      const dataRes = await res.json();
      currentChatIdRef.current = id;
      setCurrentChatId(id);
      setMessages((dataRes.messages || []).map((m: any) => ({ id: m.id, role: m.role, content: m.content })));

      const imgs: Record<string, string> = {};
      (dataRes.messages || []).forEach((m: any) => {
        const img = m.imageUrl || m.image_url; 
        if (img) imgs[m.id] = img;
      });
      setLocalImages(imgs);
    } catch (e) {
      console.error("Failed to resume chat:", e);
    }
  }

  const executedActionsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!data || data.length === 0) return;
    data.forEach((item: any, index: number) => {
      const actionKey = `${item.action}_${index}`;
      if (item?.type === "HARDWARE_ACTION" && !executedActionsRef.current.has(actionKey)) {
        executedActionsRef.current.add(actionKey);
        try { executeMobileAction(item.action, item.payload); } catch (err) { console.error("Failed to trigger mobile hardware:", err); }
      }
    });
  }, [data]);

  useEffect(() => { if (messages.length === 0) executedActionsRef.current.clear(); }, [messages]);

  const MAX_STORE_MESSAGES = 30;
  const storageKey = "amina_memory_bestie";

  // 🔥 FIX 2: Reloading images from Local Storage (Guest mode persistence)
  useEffect(() => {
    if (!currentChatId) {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try { 
          const parsed = JSON.parse(saved); 
          if (Array.isArray(parsed)) {
            setMessages(parsed.slice(-MAX_STORE_MESSAGES)); 
            
            const imgs: Record<string, string> = {};
            parsed.forEach((m: any) => {
              if (m.imageUrl) imgs[m.id] = m.imageUrl;
            });
            setLocalImages(imgs);
          }
        } catch {}
      } else {
        setMessages([]);
      }
    }
  }, [currentChatId]);

  // 🔥 FIX 3: Saving images properly to Local Storage
  useEffect(() => {
    if ((messages.length === 0 && Object.keys(localImages).length === 0) || currentChatId) return;
    const toStore = messages.slice(-MAX_STORE_MESSAGES).map((m: any) => ({
      id: m.id, 
      role: m.role, 
      content: typeof m.content === "string" ? m.content : "Image", 
      toolInvocations: m.toolInvocations,
      imageUrl: localImages[m.id] || null 
    }));
    const idT = setTimeout(() => { try { localStorage.setItem(storageKey, JSON.stringify(toStore)); } catch {} }, 400);
    return () => clearTimeout(idT);
  }, [messages, localImages, storageKey, currentChatId]);

  const clearChat = () => {
    if (activeMode === "image") {
      if (confirm("Clear Image Studio session?")) {
        setImageStudioMessages([]);
        setImageStudioLocalImages({});
      }
      return;
    }
    if (confirm("Delete conversation memory?")) {
      localStorage.removeItem(storageKey);
      setMessages([]);
      setLocalImages({});
      stopSpeaking();
      setCurrentChatId(null);
      currentChatIdRef.current = null;
    }
  };

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    if (isCallActive) {
      setShowHeadphoneNotice(true);
      const tId = setTimeout(() => setShowHeadphoneNotice(false), 6000);
      return () => clearTimeout(tId);
    }
  }, [isCallActive]);

  const handleVisionData = async (visionText: string) => {
    if (!visionText) return;
    await sendUserMessage(`[VISION DETECTED]: ${visionText}. React naturally to this.`);
  };

  const stopSpeaking = () => {
    isAiSpeakingRef.current = false;
    isProcessingRef.current = false;
    if (ttsController.current) { ttsController.current.abort(); ttsController.current = null; }
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; audioRef.current.src = ""; audioRef.current = null; }
    setIsSpeaking(false);
    setStatusText("");
    setFaceExpression("idle");
  };

  const speak = async (rawText: string, messageId: string) => {
    if (lastSpokenId.current === messageId) return;
    lastSpokenId.current = messageId;

    isAiSpeakingRef.current = true;
    if (recognitionRef.current) recognitionRef.current.abort();
    setIsListening(false);

    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setIsSpeaking(false);

    const cleanText = rawText.replace(/[\u{1F600}-\u{1F64F}]/gu, "").replace(/[*#_`~-]/g, "").trim();
    if (!cleanText) { isAiSpeakingRef.current = false; return; }

    let langForTTS = "en-US";
    const hinglishMarkers = ["kya", "kyu", "kaise", "kaisi", "hai", "tha", "thi", "haan", "nahi", "na", "tum", "aap", "mera", "meri", "mujhe", "batao", "suno", "sun", "acha", "theek", "thik", "yaar", "bhai", "matlab", "samjha", "aur", "kuch", "bol", "dekh", "karo", "wale", "wala", "raha", "rahi", "khana", "piya", "sahi", "galat"];
    const lowerText = cleanText.toLowerCase();
    const isHinglish = hinglishMarkers.some((word) => new RegExp(`\\b${word}\\b`, "i").test(lowerText));
    const isArabicScript = /[؀-ۿ]/.test(cleanText);

    if (isArabicScript) langForTTS = "ar-XA";
    else if (isHinglish) langForTTS = "hi-IN";

    setStatusText(voiceGender === "female" ? "Amina speaking…" : "Mohammad speaking…");
    setIsSpeaking(true);
    setFaceExpression("speaking");

    ttsController.current = new AbortController();
    const signal = ttsController.current.signal;

    try {
      const res = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: cleanText, voice: voiceGender, lang: langForTTS }),
        signal,
      });
      if (!res.ok) throw new Error("TTS failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(url);
        isAiSpeakingRef.current = false;
        if (isCallActive) {
          setTimeout(() => { if (isCallActive && !isAiSpeakingRef.current) startListening(); }, 500);
        } else {
          setStatusText("");
          setFaceExpression("idle");
        }
      };

      await audio.play();
    } catch {
      isAiSpeakingRef.current = false;
      setIsSpeaking(false);
      setFaceExpression("idle");
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const last = messages[messages.length - 1];
      if (isCallActive && last?.role === "assistant" && !isLoading && last.id !== lastSpokenId.current) speak(last.content, last.id);
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [messages, isLoading, isCallActive]);

  const startListening = () => {
    if (isLiveModeRef.current) return;
    if (!isCallActive) return;
    if (isAiSpeakingRef.current) return;
    if (isProcessingRef.current) return;

    if (recognitionRef.current) try { recognitionRef.current.stop(); } catch {}

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return setStatusText("Mic not supported");

    const recognition = new SR();
    recognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      if (isAiSpeakingRef.current) { recognition.abort(); return; }
      setIsListening(true);
      setStatusText("Listening…");
      setFaceExpression("listening");
    };

    recognition.onresult = (e: any) => {
      if (isAiSpeakingRef.current) { recognition.abort(); return; }
      const text = e.results?.[0]?.[0]?.transcript;
      if (text?.trim()) {
        setStatusText("Thinking…");
        setIsListening(false);
        recognition.stop();
        setFaceExpression("thinking");
        isProcessingRef.current = true;
        sendUserMessage(text);
      }
    };

    recognition.onerror = () => {
      if (!isAiSpeakingRef.current && !isProcessingRef.current) {
        setIsListening(false);
        setStatusText("Tap to speak");
        setFaceExpression("idle");
      }
    };

    recognition.onend = () => {
      if (!isLiveModeRef.current && isCallActive && !isProcessingRef.current && !isAiSpeakingRef.current && !isLoading) {
        startListening();
      } else {
        setIsListening(false);
      }
    };

    try { recognition.start(); } catch {}
  };

  const startDictation = () => {
    if (isCallActive) { startListening(); return; } 
    if (isDictating) {
      try { dictationRecRef.current?.stop(); } catch {}
      return;
    }

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert("Voice typing isn't supported in this browser."); return; }

    const rec = new SR();
    dictationRecRef.current = rec;
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-US";

    rec.onstart = () => setIsDictating(true);
    rec.onresult = (e: any) => {
      const text = e.results?.[0]?.[0]?.transcript;
      if (text) setInput((prev: string) => (prev ? `${prev} ${text}` : text));
    };
    rec.onerror = () => setIsDictating(false);
    rec.onend = () => setIsDictating(false);

    try { rec.start(); } catch { setIsDictating(false); }
  };

  const handleAvatarClick = () => {
    if (isLiveModeRef.current) return;
    if (isSpeaking) {
      stopSpeaking();
      isAiSpeakingRef.current = false;
      isProcessingRef.current = false;
      setTimeout(() => startListening(), 100);
    } else if (!isListening) {
      startListening();
    }
  };

  const toggleLiveMode = () => {
    if (isLiveMode) {
      isLiveModeRef.current = false;
      rtEnd();
      setIsLiveMode(false);
      setStatusText("");
    } else {
      stopSpeaking();
      if (recognitionRef.current) try { recognitionRef.current.abort(); } catch {}
      isLiveModeRef.current = true;
      setIsLiveMode(true);
      rtStart({
        voice: voiceGender === "female" ? "Aoede" : "Puck",
        userName: voiceGender === "female" ? "Douaa" : "Mohammad",
      });
    }
  };

  useEffect(() => {
    if (isLoading) setFaceExpression("thinking");
    else if (!isSpeaking && !isCallActive) setFaceExpression("idle");
  }, [isLoading, isSpeaking, isCallActive]);

  async function resizeAndToDataUrl(file: File): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = (e) => { img.src = e.target?.result as string; };
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const MAX_DIM = 1280; 
        const scale = Math.min(MAX_DIM / img.width, MAX_DIM / img.height, 1);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.92)); 
      };
      reader.readAsDataURL(file);
    });
  }

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setSelectedImage(await resizeAndToDataUrl(e.target.files[0]));
  };

  function createEnhancedChainPrompt(newUserInstruction: string): string {
    const lowerUserMsg = (newUserInstruction || "").toLowerCase();
    const isGraphicDesign = ["flyer", "poster", "banner", "logo", "design", "graphic", "text", "typography"].some(w => lowerUserMsg.includes(w));

    if (isGraphicDesign) {
      return `Create a highly professional graphic design based on this input: "${newUserInstruction}". Ensure excellent, legible modern typography, vibrant colors, clean layout, and premium marketing quality. Use the original image as a background or asset if provided. Do not force photorealism.`;
    } else {
      const strongPhotographicLock = "A highly detailed, high-resolution realistic photograph, highly detailed and realistic, preserving identity and subject look from the previous realistic edits in this thread, with their casual dress, now modified to include the new change: ";
      const finalResultStyle = ". The final result must be a realistic photo, matching the style and identity, not a cartoon.";
      return `${strongPhotographicLock}${lowerUserMsg}${finalResultStyle}`;
    }
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 🔥 SOUND FIX: Unlock Web Audio API strictly on user click
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContext();
      ctx.resume();
    } catch(err) {}

    if ((!input?.trim() && !selectedImage) || isLoading) return;

    const userMessage = input;
    let imageToSend = selectedImage;

    const studioMode = activeMode === "image";
    const activeMsgs = studioMode ? imageStudioMessages : messages;
    const setActiveMsgs: any = studioMode ? setImageStudioMessages : setMessages;
    const activeLocalImages = studioMode ? imageStudioLocalImages : localImages;
    const setActiveLocalImages = studioMode ? setImageStudioLocalImages : setLocalImages;

    const wantsEdit = studioMode ? true : looksLikeImageEditRequest(userMessage);
    let isChainEdit = false;

    if (!imageToSend && wantsEdit && activeMsgs.length > 0) {
      const reversedMessages = [...activeMsgs].reverse();
      for (const m of reversedMessages) {
        if (activeLocalImages[m.id]) {
          imageToSend = activeLocalImages[m.id];
          isChainEdit = true;
          break;
        }
        if (m.experimental_attachments && m.experimental_attachments.length > 0) {
          imageToSend = m.experimental_attachments[0].url;
          isChainEdit = true;
          break;
        }
      }
    }

    setInput("");
    setSelectedImage(null);

    if (imageToSend) {
      const userMsgId = Date.now().toString();

      if (selectedImage) {
        setActiveLocalImages((prev: Record<string, string>) => ({ ...prev, [userMsgId]: imageToSend as string }));
        setActiveMsgs((prev: any[]) => [...prev, {
          id: userMsgId, role: "user", content: userMessage || "Analyze this image",
        } as any]);
      } else {
        setActiveMsgs((prev: any[]) => [...prev, {
          id: userMsgId, role: "user", content: userMessage,
        } as any]);
      }

      const assistantMsgId = (Date.now() + 1).toString();

      if (wantsEdit) {
        setActiveMsgs((prev: any[]) => [...prev, { id: assistantMsgId, role: "assistant", content: "Editing the photo…" } as any]);
        try {
          const wasNewChat = !currentChatIdRef.current;
          const enhancedInstruction = isChainEdit
            ? createEnhancedChainPrompt(userMessage)
            : userMessage;

          const res = await fetch("/api/edit-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: imageToSend, instruction: enhancedInstruction }),
          });
          const resData = await res.json();

         if (resData.success && resData.imageUrl) {
          playSuccessSound(); 
          setActiveLocalImages((prev: Record<string, string>) => ({ ...prev, [assistantMsgId]: resData.imageUrl }));
          setActiveMsgs((prev: any[]) => prev.map((m) => (m.id === assistantMsgId
            ? { ...m, content: "Ye raha aapka result, kaisa laga? ✨" }
            : m)));
        }

          if (!studioMode) {
            const chatId = await ensureChatId();
            if (chatId) {
              const firstMessageText = userMessage;
              saveMessageToDb(chatId, "user", firstMessageText, selectedImage ? (imageToSend as string) : undefined);
              saveMessageToDb(
                chatId,
                "assistant",
                resData.success ? "Ye raha aapka result, kaisa laga? ✨" : (resData.error || "Edit failed"),
                resData.success ? resData.imageUrl : undefined
              );
              if (wasNewChat) {
                fetch(`/api/chats/${chatId}/auto-rename`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ message: firstMessageText }),
                })
                  .then(() => window.dispatchEvent(new Event("chats-updated")))
                  .catch((e) => console.error("Auto-rename failed:", e));
              }
            }
          }
        } catch (err) {
          console.error("Edit-image error:", err);
          setActiveMsgs((prev: any[]) => prev.map((m) => (m.id === assistantMsgId ? { ...m, content: "Error editing image." } : m)));
        }
        return;
      }

      setActiveMsgs((prev: any[]) => [...prev, { id: assistantMsgId, role: "assistant", content: "Looking at the image…" } as any]);
      try {
        const wasNewChat = !currentChatIdRef.current;
        const res = await fetch("/api/vision", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: [{ role: "user", content: [{ type: "text", text: userMessage || "Analyze this image" }, { type: "image", image: imageToSend }] }] }),
        });
        const resData = await res.json();
        setActiveMsgs((prev: any[]) => prev.map((m) => (m.id === assistantMsgId ? { ...m, content: resData.text } : m)));

        if (!studioMode) {
          const chatId = await ensureChatId();
          if (chatId) {
            const firstMessageText = userMessage || "Analyze this image";
            saveMessageToDb(chatId, "user", firstMessageText, selectedImage ? (imageToSend as string) : undefined);
            if (resData.text) saveMessageToDb(chatId, "assistant", resData.text);
            if (wasNewChat) {
              fetch(`/api/chats/${chatId}/auto-rename`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: firstMessageText }),
              })
                .then(() => window.dispatchEvent(new Event("chats-updated")))
                .catch((e) => console.error("Auto-rename failed:", e));
            }
          }
        }
      } catch (err) {
        console.error("Vision error:", err);
        setActiveMsgs((prev: any[]) => prev.map((m) => (m.id === assistantMsgId ? { ...m, content: "Error analyzing image." } : m)));
      }
      return;
    }

   if (studioMode) {
      const userMsgId = Date.now().toString();
      const assistantMsgId = (Date.now() + 1).toString();
      
      setActiveMsgs((prev: any[]) => [...prev, { id: userMsgId, role: "user", content: userMessage } as any]);
      setActiveMsgs((prev: any[]) => [...prev, { id: assistantMsgId, role: "assistant", content: "Editing the photo…" } as any]);

      try {
        const res = await fetch("/api/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: userMessage }),
        });
        const resData = await res.json();

        if (resData.success && resData.imageUrl) {
          playSuccessSound(); 
          setActiveLocalImages((prev: Record<string, string>) => ({ ...prev, [assistantMsgId]: resData.imageUrl }));
          setActiveMsgs((prev: any[]) => prev.map((m) => (m.id === assistantMsgId ? { ...m, content: "Ye raha aapka naya design! Kaisa laga? ✨" } : m)));
        } else {
          setActiveMsgs((prev: any[]) => prev.map((m) => (m.id === assistantMsgId ? { ...m, content: resData.error || "Generate nahi ho paya, dobara try karo." } : m)));
        }
      } catch (err) {
        console.error("Generate error:", err);
        setActiveMsgs((prev: any[]) => prev.map((m) => (m.id === assistantMsgId ? { ...m, content: "Error generating image." } : m)));
      }
      return;
    }

    await sendUserMessage(userMessage);
  };

  useEffect(() => {
    if (isCallActive || isListening || isAiSpeakingRef.current || isProcessingRef.current) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const wakeWordRec = new SR();
    wakeWordRec.continuous = true;
    wakeWordRec.interimResults = false;
    wakeWordRec.lang = "en-US";
    wakeWordRec.onresult = (e: any) => {
      const lastIndex = e.results.length - 1;
      const transcript = e.results[lastIndex][0].transcript.toLowerCase();
      if (transcript.includes("amina")) {
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        wakeWordRec.stop();
        setIsCallActive(true);
        setTimeout(() => startListening(), 800);
      }
    };
    wakeWordRec.onend = () => {
      if (!isCallActive && !isListening && !isAiSpeakingRef.current && !isProcessingRef.current) {
        try { wakeWordRec.start(); } catch {}
      }
    };
    try { wakeWordRec.start(); } catch {}
    return () => { try { wakeWordRec.stop(); } catch {} };
  }, [isCallActive, isListening]);

  const isImageMode = activeMode === "image";
  const displayMessages = isImageMode ? imageStudioMessages : messages;
  const displayLocalImages = isImageMode ? imageStudioLocalImages : localImages;
  const isChatEmpty = displayMessages.length === 0;

  // 🔥 VAULT FIX: Chat tools se aur local state se saari images extract karo
  const allVaultImages = { ...localImages, ...imageStudioLocalImages };
  messages.forEach(m => {
    m.toolInvocations?.forEach((tool: any, idx: number) => {
      if (tool.toolName === "generateImage" && tool.result?.imageUrl) {
        allVaultImages[`tool_${m.id}_${idx}`] = tool.result.imageUrl;
      }
    });
  });

  return (
    <div className="fixed inset-0 flex bg-[#FDFCFE]">
      <AmbientBackground />

      {/* SIDEBAR */}
      <div className={`transition-all duration-300 ease-in-out shrink-0 h-full overflow-hidden ${isSidebarOpen ? "w-64" : "w-0"}`}>
        <div className="w-64 h-full">
          <ChatSidebar
            currentChatId={currentChatId}
            onSelectChat={resumeChat}
            onNewChat={() => {
              try { localStorage.removeItem(storageKey); } catch {}
              setCurrentChatId(null);
              currentChatIdRef.current = null;
              setMessages([]);
              setLocalImages({});
            }}
          />
        </div>
      </div>

      {/* CHAT COLUMN */}
      <div className="flex-1 flex flex-col relative w-full h-full overflow-hidden">
        {/* HEADER */}
        <header className="pt-[max(env(safe-area-inset-top),14px)] pb-3 flex items-center px-5 justify-between bg-white/70 backdrop-blur-xl border-b border-black/5 shrink-0 z-50">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 -ml-1 hover:bg-black/5 rounded-lg text-[#5B5468] transition-colors">
              <Menu size={19} />
            </button>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-black/5 bg-white text-sm font-medium text-[#3A2E4A]">
              <Heart size={13} style={{ color: THEME.text }} />
              {THEME.label}
            </div>

            <div className="flex items-center bg-white rounded-full border border-black/5 p-0.5 ml-1">
              <button
                onClick={() => setActiveMode("chat")}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${!isImageMode ? "text-white" : "text-[#9B92AA]"}`}
                style={!isImageMode ? { background: `linear-gradient(135deg, ${THEME.from}, ${THEME.to})` } : {}}
              >
                Chat
              </button>
              <button
                onClick={() => setActiveMode("image")}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${isImageMode ? "text-white" : "text-[#9B92AA]"}`}
                style={isImageMode ? { background: `linear-gradient(135deg, ${THEME.from}, ${THEME.to})` } : {}}
              >
                <Wand2 size={12} /> Image Studio
              </button>
            </div>
          </div>

          <div className="flex gap-1.5 items-center">
            {/* 🔥 VAULT BUTTON */}
            <button onClick={() => setIsVaultOpen(true)} className="p-2 hover:bg-black/5 rounded-full text-[#5B5468] transition-all" title="Amina Vault">
              <ImageIcon size={16} />
            </button>

            <button onClick={() => setVisionMode("camera")} className="p-2 hover:bg-black/5 rounded-full text-[#5B5468] transition-all" title="Camera"><Video size={16} /></button>
            <button onClick={() => setVisionMode("screen")} className="p-2 hover:bg-black/5 rounded-full text-[#5B5468] transition-all" title="Screen"><Monitor size={16} /></button>
            <button onClick={() => setShowGame(true)} className="p-2 hover:bg-black/5 rounded-full text-[#5B5468] transition-all" title="Stress buster"><Gamepad2 size={16} /></button>
            <button onClick={clearChat} className="p-2 hover:bg-red-50 rounded-full text-[#5B5468] hover:text-red-500 transition-all" title="Clear chat"><Trash2 size={16} /></button>
            <button onClick={() => setIsCallActive(true)} className="p-2 hover:bg-black/5 rounded-full text-[#5B5468] transition-all" title="Voice call"><Phone size={16} /></button>
          </div>
        </header>

        {isImageMode && (
          <div className="px-5 py-2 text-xs flex items-center gap-2 border-b border-black/5" style={{ background: THEME.soft, color: THEME.text }}>
            <Wand2 size={12} /> Image Studio — upload a photo, then describe the change. Every message here is treated as an edit.
          </div>
        )}

        {/* CALL OVERLAY */}
        <AnimatePresence>
          {isCallActive && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[100] flex flex-col items-center justify-center" style={{ background: THEME.sky }}>
              <button
                onClick={() => { setIsCallActive(false); stopSpeaking(); if (isLiveModeRef.current) { rtEnd(); setIsLiveMode(false); isLiveModeRef.current = false; } }}
                className="absolute top-6 right-6 p-3 bg-white/80 rounded-full hover:bg-white shadow-sm z-50"
              >
                <X size={22} className="text-[#3A2E4A]" />
              </button>

              <div className="relative cursor-pointer" onClick={handleAvatarClick}>
                <CallAvatar isSpeaking={isLiveMode ? rtSpeaking : (isSpeaking || isListening)} isListening={isLiveMode ? (rtStatus === "live" && !rtSpeaking) : isListening} />
                <div className="absolute inset-0 flex items-center justify-center z-20">
                  {!isSpeaking && isListening && (
                    <div className="p-3 rounded-full border-4 border-white animate-bounce shadow-lg" style={{ background: THEME.from }}>
                      <Mic size={22} color="white" />
                    </div>
                  )}
                </div>
              </div>

              <AnimatePresence>
                {showHeadphoneNotice && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute top-20 bg-white/90 text-[#3A2E4A] px-4 py-2 rounded-full shadow-sm flex items-center gap-2 text-sm backdrop-blur-md z-[110]">
                    <Headphones size={16} style={{ color: THEME.text }} /> Use headphones for the best experience
                  </motion.div>
                )}
              </AnimatePresence>

              <h2 className="mt-10 text-2xl font-semibold text-[#231A2E]">{voiceGender === "female" ? "Amina" : "Mohammad"}</h2>
              <p className="text-base mt-2 font-medium" style={{ color: THEME.text }}>
                {isLiveMode
                  ? rtStatus === "live" ? (rtSpeaking ? "Amina speaking…" : "Listening (live)") : (rtStatus === "connecting" ? "Connecting…" : rtStatus)
                  : (statusText || "Tap avatar to start")}
              </p>

              <div className="absolute bottom-12 flex flex-col items-center gap-3">
                <button
                  onClick={toggleLiveMode}
                  className={`px-8 py-3 rounded-full font-medium transition-all shadow-lg ${isLiveMode ? "bg-red-500 text-white" : "text-white"}`}
                  style={!isLiveMode ? { background: `linear-gradient(135deg, ${THEME.from}, ${THEME.to})` } : {}}
                >
                  {rtStatus === "connecting" ? "Connecting…" : isLiveMode ? "End live call" : "Start live mode"}
                </button>
                {isLiveMode && rtStatus === "error" && <p className="text-red-500 text-xs max-w-xs text-center">{rtError} — tap avatar for normal mode</p>}
                <button onClick={() => setVoiceGender((v) => (v === "female" ? "male" : "female"))} disabled={isLiveMode} className="px-6 py-3 rounded-full bg-white/80 shadow-sm hover:bg-white transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm text-[#3A2E4A]">
                  Switch voice ({voiceGender})
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>{visionMode && <VisionManager mode={visionMode} onClose={() => setVisionMode(null)} onAnalysisComplete={handleVisionData} />}</AnimatePresence>
        <AnimatePresence>{showGame && <StressBuster onClose={() => setShowGame(false)} />}</AnimatePresence>
        
        {/* 🔥 VAULT & SKETCHPAD MODALS */}
        <AnimatePresence>
          {isVaultOpen && (
            <ImageVault 
              images={allVaultImages} // 🔥 Yahan change kiya
              onClose={() => setIsVaultOpen(false)} 
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isSketchpadOpen && (
            <SketchPad 
              onClose={() => setIsSketchpadOpen(false)}
              onSave={(dataUrl) => {
                setSelectedImage(dataUrl);
                setIsSketchpadOpen(false);
                // Optional: Automatically trigger generation based on the sketch
                if (isImageMode) {
                  setInput("Make this sketch realistic and highly detailed.");
                }
              }}
            />
          )}
        </AnimatePresence>

        {/* MESSAGES */}
        <main className={`flex-1 overflow-y-auto px-4 md:px-10 lg:px-24 relative z-10 w-full h-full flex flex-col ${isChatEmpty ? "justify-center items-center pb-16" : "pt-6 pb-28 scroll-smooth"}`}>
          {isChatEmpty ? (
            <>
              <WelcomeScreen name={userName} onPick={(p) => setInput(p)} />
              <InputBar
                centered
                input={input}
                handleInputChange={handleInputChange}
                handleFormSubmit={handleFormSubmit}
                selectedImage={selectedImage}
                setSelectedImage={setSelectedImage}
                fileInputRef={fileInputRef}
                handleFileSelect={handleFileSelect}
                onMicClick={startDictation}
                isListening={isDictating}
                isLoading={isLoading}
                themeFrom={THEME.from}
                themeTo={THEME.to}
                placeholder={isImageMode ? "Describe the edit you want… (attach a photo first)" : undefined}
                // 🔥 NAYA: Open Sketchpad function
                onSketchClick={() => setIsSketchpadOpen(true)}
              />
            </>
          ) : (
            <div className="max-w-3xl mx-auto w-full flex flex-col">
              {displayMessages.map((m: any, i: number) => {
                if (typeof m.content === "string" && m.content.startsWith("[VISION DETECTED]")) return null;
                const hasContent = (m.content && typeof m.content === "string" && m.content.trim().length > 0) || (Array.isArray(m.content) && m.content.length > 0);
                const hasTools = m.toolInvocations && m.toolInvocations.length > 0;
                if (!hasContent && !hasTools) return null;

                const isLastMessage = i === displayMessages.length - 1;

                return (
                  <div key={m.id} className="mb-6 w-full">
                    {m.role === "assistant" ? (
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 mt-1 border-2 border-white shadow-sm">
                          <img src="/Amina_logo.png" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex flex-col gap-1 max-w-2xl w-full">
                          {hasContent && (
                            <div className="bg-white text-[#3A2E4A] px-5 py-4 rounded-2xl rounded-tl-sm shadow-sm border border-black/5 mb-1">
                              <MessageContent 
                                message={m} 
                                isLast={isLastMessage} 
                                isLoading={isLoading} 
                                localImage={displayLocalImages[m.id]} 
                              />
                            </div>
                          )}
                          {m.toolInvocations?.map((tool: any) => <RenderToolInvocation key={tool.toolCallId} toolInvocation={tool} />)}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3 justify-end">
                        <div
                          className="text-white px-5 py-3 rounded-2xl rounded-tr-sm max-w-2xl break-words whitespace-pre-wrap shadow-md font-medium"
                          style={{ background: `linear-gradient(135deg, ${THEME.from}, ${THEME.to})` }}
                        >
                          <MessageContent 
                            message={m} 
                            isLast={isLastMessage} 
                            isLoading={isLoading} 
                            localImage={displayLocalImages[m.id]} 
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {isLoading && <ThinkingIndicator />}
              <div ref={messagesEndRef} />
            </div>
          )}
        </main>

        {/* FOOTER INPUT */}
        {!isChatEmpty && (
          <footer className="absolute bottom-0 w-full p-4 pb-6 bg-gradient-to-t from-[#FDFCFE] via-[#FDFCFE]/90 to-transparent z-40">
            <SmartChips 
              isImageMode={isImageMode} 
              onSelect={(chipPrompt) => setInput(chipPrompt)} 
            />
            <InputBar
              input={input}
              handleInputChange={handleInputChange}
              handleFormSubmit={handleFormSubmit}
              selectedImage={selectedImage}
              setSelectedImage={setSelectedImage}
              fileInputRef={fileInputRef}
              handleFileSelect={handleFileSelect}
              onMicClick={startDictation}
              isListening={isDictating}
              isLoading={isLoading}
              themeFrom={THEME.from}
              themeTo={THEME.to}
              placeholder={isImageMode ? "Describe the edit you want… (attach a photo first)" : undefined}
              // 🔥 NAYA: Open Sketchpad function
              onSketchClick={() => setIsSketchpadOpen(true)}
            />
          </footer>
        )}
      </div>
    </div>
  );
}

// 🔥 UPDATE INPUT BAR WITH SKETCH ICON
function InputBarWrapper(props: any) {
  return <InputBar {...props} />;
}