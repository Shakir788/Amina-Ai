"use client";

import { useChat } from "ai/react";
import { 
  Send, Mic, Paperclip, Phone, X, Trash2, 
  Briefcase, Heart, Music, MapPin, Calculator, Sparkles,
  Mail, Calendar, CheckCircle
} from "lucide-react";
import { useRef, useEffect, useState, ChangeEvent } from "react";
import { motion, AnimatePresence } from "framer-motion"; 

// ==========================================
// 1. INVOICE TABLE (UNCHANGED)
// ==========================================
const InvoiceTable = ({ data }: { data: any }) => {
  if (!data?.rows) return null;
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-gray-700 bg-gray-900 shadow-2xl animate-in fade-in zoom-in duration-300">
      <div className="bg-gray-800 px-4 py-3 border-b border-gray-700 flex justify-between items-center">
        <div className="flex items-center gap-2 text-blue-400"><Briefcase size={16} /><span className="font-bold text-sm">Amina CPA Report</span></div>
        <span className="text-xs text-gray-500">{data.summary.rowCount} Items Found</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-400 uppercase bg-gray-800/50">
            <tr>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-4 py-3 text-right">Tax</th>
              <th className="px-4 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {data.rows.map((row: any, i: number) => (
              <tr key={i} className="hover:bg-gray-800/30 transition-colors">
                <td className="px-4 py-3 font-medium text-white">{row.item}</td>
                <td className="px-4 py-3 text-right text-gray-400">{row.qty}</td>
                <td className="px-4 py-3 text-right text-gray-300">{row.price.toFixed(2)}</td>
                <td className="px-4 py-3 text-right text-red-300 text-xs">{row.tax > 0 ? `+${row.tax.toFixed(2)}` : '-'}</td>
                <td className="px-4 py-3 text-right font-bold text-green-400">{row.computedTotal.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="bg-gray-800/80 px-4 py-3 border-t border-gray-700 flex flex-col gap-1 items-end">
        <div className="flex justify-between w-40 text-xs text-gray-400"><span>Total Tax:</span><span>{data.summary.totalTax.toFixed(2)}</span></div>
        <div className="flex justify-between w-40 text-lg font-bold text-white"><span>Grand Total:</span><span className="text-green-400">{data.summary.grandTotal.toFixed(2)} MAD</span></div>
      </div>
    </div>
  );
};

// ==========================================
// 2. TOOL RENDERER (UNCHANGED)
// ==========================================
const RenderToolInvocation = ({ toolInvocation }: { toolInvocation: any }) => {
  const { toolName, args, result } = toolInvocation;
  
  if (toolName === 'playYoutube') {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const videoId = result?.videoId;
      const videoSrc = videoId 
          ? `https://www.youtube.com/embed/${videoId}?autoplay=1&origin=${origin}` 
          : `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(args.query)}&origin=${origin}`;
      return (
          <div className="mt-3 w-full max-w-md bg-black/40 rounded-xl overflow-hidden border border-red-900/50 shadow-lg">
              <div className="p-2 bg-red-900/20 text-red-400 text-xs flex items-center gap-2 font-bold"><Music size={14} /> Playing on YouTube</div>
              <iframe width="100%" height="220" src={videoSrc} title="YouTube" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="w-full" />
          </div>
      );
  }

  if (toolName === 'showMap') {
      const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(args.location)}&output=embed`;
      return (
          <div className="mt-3 w-full max-w-md bg-black/40 rounded-xl overflow-hidden border border-green-900/50">
              <div className="p-2 bg-green-900/20 text-green-400 font-bold flex gap-2"><MapPin size={14}/> Location</div>
              <div className="h-48 bg-gray-800">
                  <iframe width="100%" height="100%" frameBorder="0" style={{border:0, filter:'invert(90%) hue-rotate(180deg)'}} src={mapSrc} allowFullScreen></iframe>
              </div>
          </div>
      );
  }
  
  if (toolName === 'scheduleEvent') {
      return (
          <div className="mt-2 p-3 bg-purple-900/20 border border-purple-500/30 rounded-lg flex items-center gap-3">
             <Calendar className="text-purple-400" />
             <div><div className="text-xs text-purple-300 font-bold">Event Scheduled</div><div className="text-sm text-white">{args.title} on {args.date}</div></div><CheckCircle className="text-green-500 ml-auto" size={16} />
          </div>
      );
  }

  if (toolName === 'sendEmail') {
      return (
         <div className="mt-3 w-full max-w-sm bg-gray-900 rounded-xl border border-blue-800/50 shadow-lg">
             <div className="bg-blue-900/20 p-3 border-b border-blue-800/30 flex items-center gap-2"><div className="p-1.5 bg-blue-500 rounded-full"><Mail size={12} className="text-white" /></div><span className="text-sm font-bold text-blue-300">Email Draft</span></div>
             <div className="p-4 text-sm space-y-3"><div className="flex gap-2"><span className="text-gray-500 w-8 text-xs uppercase">To:</span><span className="text-white font-medium">{args.to}</span></div><div className="flex gap-2"><span className="text-gray-500 w-8 text-xs uppercase">Sub:</span><span className="text-white">{args.subject}</span></div><div className="bg-black/30 p-3 rounded-lg text-gray-300 text-xs italic border-l-2 border-blue-500">"{args.body}"</div></div>
         </div>
      );
  }
  return null;
};

// ==========================================
// 3. MAIN CHAT INTERFACE
// ==========================================
export default function ChatInterface() {
  const [isAccountantMode, setIsAccountantMode] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false); // 🔥 NEW: Calculator Toggle
  const [isCallActive, setIsCallActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false); 
  const [statusText, setStatusText] = useState("");
  const [voiceGender, setVoiceGender] = useState<"female" | "male">("female");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [faceExpression, setFaceExpression] = useState<"idle" | "listening" | "speaking" | "thinking">("idle");
  const [isBlinking, setIsBlinking] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastSpokenId = useRef<string | null>(null);

  const theme = isAccountantMode 
    ? { border: "border-blue-500", text: "text-blue-300", bg: "bg-blue-600", gradient: "from-blue-500 to-cyan-500" }
    : { border: "border-purple-500", text: "text-purple-300", bg: "bg-purple-600", gradient: "from-purple-500 to-pink-500", glow: "rgba(168, 85, 247, 0.6)" };

  // 1. ALWAYS USE CHAT API DEFAULT (Vision handled manually)
  const { messages, input, handleInputChange, handleSubmit, isLoading, append, setMessages, setInput } = useChat({
    api: "/api/chat",
    body: { data: { isAccountantMode } },
    onError: (err) => console.error("Chat Error:", err),
  });

  const MAX_STORE_MESSAGES = 30;

  // 🔥 NEW MEMORY LOGIC: Separate Keys for Bestie & Accountant
  const storageKey = isAccountantMode ? "amina_memory_accountant" : "amina_memory_bestie";

  // LOAD MESSAGES (Switch Logic)
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) { 
        try { 
            const parsed = JSON.parse(saved); 
            if (Array.isArray(parsed)) setMessages(parsed.slice(-MAX_STORE_MESSAGES)); 
        } catch (e) {} 
    } else {
        setMessages([]); // Agar naye mode me koi chat nahi hai, to clear karo
    }
  }, [isAccountantMode]); // Run whenever Mode changes

  // SAVE MESSAGES (Dependent on current Mode)
  useEffect(() => {
    if (messages.length === 0) return;
    const toStore = messages.slice(-MAX_STORE_MESSAGES).map((m: any) => ({ 
        id: m.id, role: m.role, content: (typeof m.content === 'string' ? m.content : "Image"), toolInvocations: m.toolInvocations 
    }));
    const id = setTimeout(() => { 
        try { localStorage.setItem(storageKey, JSON.stringify(toStore)); } catch (e) {} 
    }, 400);
    return () => clearTimeout(id);
  }, [messages, storageKey]); // Depend on messages AND storageKey

  const clearChat = () => { 
      if (confirm(`Delete ${isAccountantMode ? 'Accountant' : 'Personal'} memory?`)) { 
          localStorage.removeItem(storageKey); 
          setMessages([]); 
          stopSpeaking(); 
      } 
  };

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const stopSpeaking = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; audioRef.current = null; }
    setIsSpeaking(false);
    if (isCallActive) { setStatusText("Listening..."); setFaceExpression("listening"); startListening(); } 
    else { setStatusText(""); setFaceExpression("idle"); }
  };

  const speak = async (rawText: string, messageId: string) => {
    if (lastSpokenId.current === messageId) return;
    lastSpokenId.current = messageId;
    if (isListening) { setIsListening(false); try { recognitionRef.current?.stop(); } catch(e){} }
    if (audioRef.current) { audioRef.current.pause(); }

    const cleanText = rawText.replace(/[\u{1F600}-\u{1F64F}]/gu, "").replace(/[*#_`~-]/g, "").trim();
    if (!cleanText) return;

    setStatusText(voiceGender === "female" ? "Amina Speaking..." : "Mohammad Speaking...");
    setIsSpeaking(true); setFaceExpression("speaking");

    try {
      const res = await fetch("/api/speak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: cleanText, voice: voiceGender }) });
      if (!res.ok) throw new Error("TTS Failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { setIsSpeaking(false); URL.revokeObjectURL(url); if (isCallActive) { setStatusText("Listening..."); setFaceExpression("listening"); startListening(); } else { setStatusText(""); setFaceExpression("idle"); } };
      await audio.play();
    } catch (e) { setIsSpeaking(false); setFaceExpression("idle"); if(isCallActive) startListening(); }
  };

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (isCallActive && last?.role === "assistant" && !isLoading && last.id !== lastSpokenId.current) { speak(last.content, last.id); }
  }, [messages, isLoading, isCallActive]);

  const startListening = () => {
    if (!isCallActive || isSpeaking) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return setStatusText("Mic not supported");
    if (recognitionRef.current) try { recognitionRef.current.stop(); } catch(e){}
    const recognition = new SR();
    recognitionRef.current = recognition;
    recognition.continuous = false; recognition.interimResults = false; recognition.lang = "en-US";
    recognition.onstart = () => { setIsListening(true); setStatusText("Listening..."); setFaceExpression("listening"); };
    recognition.onresult = (e: any) => { const t = e.results?.[0]?.[0]?.transcript; if (t?.trim()) { setStatusText("Thinking..."); setIsListening(false); setFaceExpression("thinking"); append({ role: "user", content: t }); } };
    recognition.onerror = () => { setIsListening(false); setStatusText("Tap Avatar"); setFaceExpression("idle"); };
    recognition.onend = () => { setIsListening(false); };
    try { recognition.start(); } catch(e){}
  };

  useEffect(() => { if (isLoading) { setFaceExpression("thinking"); } else if (!isSpeaking && !isCallActive) { setFaceExpression("idle"); } }, [isLoading, isSpeaking, isCallActive]);
  useEffect(() => { const interval = setInterval(() => { if (faceExpression === "idle") { setIsBlinking(true); setTimeout(() => setIsBlinking(false), 150); } }, 4000); return () => clearInterval(interval); }, [faceExpression]);

  async function resizeAndToDataUrl(file: File): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image(); const reader = new FileReader();
      reader.onload = (e) => { img.src = e.target?.result as string; };
      img.onload = () => {
        const canvas = document.createElement("canvas"); const ctx = canvas.getContext("2d");
        const scale = Math.min(1024 / img.width, 1024 / img.height, 1);
        canvas.width = img.width * scale; canvas.height = img.height * scale;
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      reader.readAsDataURL(file);
    });
  }

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => { if (e.target.files?.[0]) setSelectedImage(await resizeAndToDataUrl(e.target.files[0])); };

  // 🔥 CLEAN & SIMPLE SUBMIT HANDLER (Stable Vision Fix included)
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input?.trim() && !selectedImage) || isLoading) return;
    
    const userMessage = input;
    const imageToSend = selectedImage;
    
    setInput("");
    setSelectedImage(null);

    // CASE 1: VISION MODE
    if (imageToSend) {
      // UI Update (Optimistic)
      const userMsgId = Date.now().toString();
      const newUserMsg = {
          id: userMsgId, role: 'user', content: userMessage || "Analyze this image",
          experimental_attachments: [{ name: "image.jpg", contentType: "image/jpeg", url: imageToSend }]
      };
      setMessages(prev => [...prev, newUserMsg as any]);

      // Assistant Placeholder (Loading...)
      const assistantMsgId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: "👀 Looking at image..." } as any]);

      try {
          // Fetch Simple JSON
          const res = await fetch("/api/vision", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: [{ role: "user", content: [{ type: "text", text: userMessage || "Analyze this image" }, { type: "image", image: imageToSend }] }] }),
          });

          const data = await res.json(); 
          setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: data.text } : m));

      } catch (err) {
          console.error("Vision Error:", err);
          setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: "Error analyzing image." } : m));
      }
      return;
    }

    // CASE 2: NORMAL CHAT
    await append({ role: "user", content: userMessage }, { body: { data: { isAccountantMode } } });
  };

  // 🔥 SAFE RENDER CONTENT
  const RenderContent = ({ text }: { text?: any }) => {
    if (!text || typeof text !== 'string') return null;
    const html = text.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br/>");
    try { if (text.trim().startsWith('{') && text.includes('"rows":')) { const data = JSON.parse(text); if (data.rows && data.summary) return <InvoiceTable data={data} />; } } catch (e) {}
    return <div className="prose prose-invert max-w-full text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />;
  };

  // 🔥 UNIVERSAL MESSAGE RENDERER
  const MessageContent = ({ message }: { message: any }) => {
    if (!message || !message.content) return null;
    if (Array.isArray(message.content)) {
        return (
            <div className="flex flex-col gap-2">
                {message.content.map((part: any, i: number) => {
                    if (part.type === 'image' && part.image) return <div key={i} className="rounded-lg overflow-hidden border border-white/20 my-2"><img src={part.image} className="w-full max-w-xs h-auto" /></div>;
                    if (part.type === 'text' && part.text) return <RenderContent key={i} text={part.text} />;
                    return null;
                })}
            </div>
        );
    }
    const hasAttachments = message.experimental_attachments && message.experimental_attachments.length > 0;
    if (hasAttachments) {
         return (
            <div className="flex flex-col gap-2">
                <div className="rounded-lg overflow-hidden border border-white/20 my-2"><img src={message.experimental_attachments[0].url} className="w-full max-w-xs h-auto object-cover" /></div>
                <RenderContent text={message.content} />
            </div>
         );
    }
    return <RenderContent text={message.content} />;
  };

  const getAvatarSrc = () => {
    if (isBlinking) return "/amina_blink.png"; if (faceExpression === "speaking") return "/amina_speaking.gif"; if (faceExpression === "listening") return "/amina_listening.png"; if (faceExpression === "thinking") return "/amina_thinking.png"; return "/amina_idle.png";
  };

  return (
    <div className="flex flex-col h-screen bg-black text-white font-sans relative">
      <header className="h-16 border-b border-white/10 flex items-center px-4 justify-between bg-black/80 fixed w-full top-0 z-50 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full overflow-hidden border-2 ${theme.border}`}><img src="/Amina_logo.png" className="w-full h-full object-cover" /></div>
          <div><h1 className={`font-bold text-lg text-transparent bg-clip-text bg-gradient-to-r ${theme.gradient}`}>{isAccountantMode ? "AMINA CPA" : "AMINA AI"}</h1><p className="text-[10px] text-green-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> Online</p></div>
        </div>
        <div className="flex gap-2 items-center">
            {/* 🔥 NEW: CALCULATOR TOGGLE (Only in Accountant Mode) */}
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
      
      {/* 🔥 NEW: CALCULATOR WIDGET */}
      <AnimatePresence>
        {isAccountantMode && showCalculator && (
            <motion.div initial={{ x: 300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 300, opacity: 0 }} className="fixed right-4 top-20 z-40 bg-gray-900 border border-gray-700 p-4 rounded-2xl shadow-2xl w-64">
                <div className="flex justify-between items-center mb-2"><span className="text-sm font-bold text-green-400">Calculator</span><button onClick={() => setShowCalculator(false)}><X size={16} className="text-gray-500 hover:text-white" /></button></div>
                {/* Embedded Scientific Calculator */}
                <div className="h-64 bg-black rounded-lg flex items-center justify-center text-gray-500 text-xs overflow-hidden">
                    <iframe src="https://www.desmos.com/scientific" width="100%" height="100%" style={{border:0}} />
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      {/* CALL OVERLAY (UNCHANGED) */}
      <AnimatePresence>
      {isCallActive && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center">
          <button onClick={() => { setIsCallActive(false); stopSpeaking(); }} className="absolute top-6 right-6 p-3 bg-gray-800 rounded-full hover:bg-gray-700 z-50"><X size={24} /></button>
          <div className="relative cursor-pointer" onClick={() => !isListening && startListening()}>
            <div className={`absolute inset-0 ${voiceGender === "female" ? theme.bg : "bg-green-600"} rounded-full blur-3xl opacity-40 ${isListening || isSpeaking ? "animate-pulse scale-125" : ""} transition-all duration-1000`}></div>
            <div className={`w-48 h-48 rounded-full overflow-hidden border-4 ${theme.border} relative z-10`}><img src={getAvatarSrc()} onError={(e) => e.currentTarget.src="/Amina_logo.png"} className="w-full h-full object-cover" /></div>
            <div className="absolute inset-0 flex items-center justify-center z-20">
               {isSpeaking ? (<div className="flex items-center gap-1.5 h-16 pointer-events-none">{[...Array(5)].map((_, i) => (<div key={i} className={`w-2.5 bg-gradient-to-t ${theme.gradient} rounded-full animate-wave shadow-[0_0_15px_rgba(168,85,247,0.6)]`} style={{ animationDelay: `${i * 0.15}s`, animationDuration: '1s' }} />))}</div>) : isListening ? (<div className="bg-green-500 p-3 rounded-full border-2 border-black animate-bounce shadow-lg"><Mic size={24} fill="white" /></div>) : null}
            </div>
          </div>
          <h2 className="mt-10 text-3xl font-bold text-white">{voiceGender === "female" ? "Amina" : "Mohammad"}</h2>
          <p className={`text-lg mt-2 font-medium ${theme.text}`}>{statusText || "Tap Avatar to Start"}</p>
          <div className="absolute bottom-12 flex items-center gap-3"><button onClick={() => setVoiceGender((v) => (v === "female" ? "male" : "female"))} className="px-6 py-3 rounded-full bg-white/10 border border-white/10 hover:bg-white/20 transition-all">Switch Voice ({voiceGender})</button></div>
        </motion.div>
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
        
        {messages.map((m: any) => (
          <div key={m.id} className="mb-4">
              {m.role === "assistant" ? (
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-full overflow-hidden border-2 ${theme.border} shrink-0`}><img src="/Amina_logo.png" className="w-full h-full object-cover" /></div>
                  <div className="flex flex-col gap-1 max-w-3xl">
                      <div className="bg-[#111827] text-gray-200 px-4 py-3 rounded-xl shadow-md border border-white/5">
                          <MessageContent message={m} />
                      </div>
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
        ))}
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
    </div>
  );
}