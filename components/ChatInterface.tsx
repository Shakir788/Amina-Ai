"use client";

import { useChat } from "ai/react";
import { 
  Send, Mic, Paperclip, Phone, X, Trash2, Square, 
  Briefcase, Heart, Music, MapPin, Calculator, Sparkles,
  Mail, CheckCircle, Zap, Calendar
} from "lucide-react";
import { useRef, useEffect, useState, ChangeEvent } from "react";

// ==========================================
// 🧾 INVOICE TABLE & TOOLS (Keep your UI)
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
// 💬 MAIN CHAT INTERFACE
// ==========================================
export default function ChatInterface() {
  // State
  const [isAccountantMode, setIsAccountantMode] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false); 
  const [statusText, setStatusText] = useState("");
  const [voiceGender, setVoiceGender] = useState<"female" | "male">("female");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [faceExpression, setFaceExpression] = useState<"idle" | "listening" | "speaking" | "thinking">("idle");
  const [isBlinking, setIsBlinking] = useState(false);

  // Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastSpokenId = useRef<string | null>(null); // Prevents Double Voice

  // --- THEME ---
  const theme = isAccountantMode 
    ? { border: "border-blue-500", text: "text-blue-300", bg: "bg-blue-600", gradient: "from-blue-500 to-cyan-500", glow: "rgba(59, 130, 246, 0.6)" }
    : { border: "border-purple-500", text: "text-purple-300", bg: "bg-purple-600", gradient: "from-purple-500 to-pink-500", glow: "rgba(168, 85, 247, 0.6)" };

  // --- CHAT HOOK ---
  const { messages, input, handleInputChange, handleSubmit, isLoading, append, setMessages, setInput } = useChat({
    api: "/api/chat",
    body: { mode: isAccountantMode ? "accountant" : "bestie" },
    onError: (err) => console.error("Chat Error:", err),
  });

  // --- MEMORY ---
  const MAX_STORE_MESSAGES = 30;
  useEffect(() => {
    const saved = localStorage.getItem("amina_memory_v1");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setMessages(parsed.slice(-MAX_STORE_MESSAGES));
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    if (messages.length === 0) return;
    const toStore = messages.slice(-MAX_STORE_MESSAGES).map((m: any) => ({ 
        id: m.id, role: m.role, content: (m.content || "").slice(0, 1000) 
    }));
    const id = setTimeout(() => {
      try { localStorage.setItem("amina_memory_v1", JSON.stringify(toStore)); } catch (e) {}
    }, 400);
    return () => clearTimeout(id);
  }, [messages, setMessages]);

  const clearChat = () => {
    if (confirm("Delete memory?")) {
      localStorage.removeItem("amina_memory_v1");
      setMessages([]);
      stopSpeaking();
    }
  };

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // ==========================================
  // --- AUDIO LOGIC (SIMPLE & STABLE) ---
  // ==========================================
  
  const stopSpeaking = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setIsSpeaking(false);
    
    // If call is active, go back to listening
    if (isCallActive) {
        setStatusText("Listening...");
        setFaceExpression("listening");
        startListening();
    } else {
        setStatusText("");
        setFaceExpression("idle");
    }
  };

  const speak = async (rawText: string, messageId: string) => {
    // Prevent double speaking
    if (lastSpokenId.current === messageId) return;
    lastSpokenId.current = messageId;

    // Stop listening while speaking
    setIsListening(false);
    if (recognitionRef.current) try { recognitionRef.current.stop(); } catch(e){}

    // Stop previous audio
    if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
    }

    const cleanText = rawText.replace(/[\u{1F600}-\u{1F64F}]/gu, "").replace(/[*#_`~-]/g, "").trim();
    if (!cleanText) return;

    setStatusText(voiceGender === "female" ? "Amina Speaking..." : "Mohammad Speaking...");
    setIsSpeaking(true);
    setFaceExpression("speaking");

    try {
      const res = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: cleanText, voice: voiceGender }),
      });

      if (!res.ok) throw new Error("TTS Failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(url);
        // Loop back to listening if call is active
        if (isCallActive) {
            setStatusText("Listening...");
            setFaceExpression("listening");
            startListening();
        } else {
            setStatusText("");
            setFaceExpression("idle");
        }
      };

      await audio.play();

    } catch (e) {
      console.error("Speak Error:", e);
      setIsSpeaking(false);
      setFaceExpression("idle");
      // Fallback
      if(isCallActive) startListening();
    }
  };

  // --- AUTO SPEAK TRIGGER ---
  useEffect(() => {
    const last = messages[messages.length - 1];
    // Rule: Call Active + AI Message + Not Loading + Not Spoken Yet
    if (isCallActive && last?.role === "assistant" && !isLoading && last.id !== lastSpokenId.current) {
      speak(last.content, last.id);
    }
  }, [messages, isLoading, isCallActive]);

  // --- SPEECH RECOGNITION ---
  const startListening = () => {
    if (!isCallActive || isSpeaking) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return setStatusText("Mic not supported");

    if (recognitionRef.current) try { recognitionRef.current.stop(); } catch(e){}

    const recognition = new SR();
    recognitionRef.current = recognition;
    recognition.continuous = false; // Simple mode: Listen -> Stop -> Send
    recognition.interimResults = false;
    recognition.lang = "en-US"; // Or auto detect if needed

    recognition.onstart = () => {
      setIsListening(true);
      setStatusText("Listening...");
      setFaceExpression("listening");
    };

    recognition.onresult = (e: any) => {
      const t = e.results?.[0]?.[0]?.transcript;
      if (t?.trim()) {
        setStatusText("Thinking...");
        setIsListening(false);
        setFaceExpression("thinking");
        append({ role: "user", content: t });
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
      setStatusText("Tap Avatar");
      setFaceExpression("idle");
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    try { recognition.start(); } catch(e){}
  };

  // --- UI EFFECTS ---
  useEffect(() => {
    if (isLoading) {
        setFaceExpression("thinking");
    } else if (!isSpeaking && !isCallActive) {
        setFaceExpression("idle");
    }
  }, [isLoading, isSpeaking, isCallActive]);

  // Blink logic
  useEffect(() => {
    const interval = setInterval(() => {
      if (faceExpression === "idle") {
        setIsBlinking(true);
        setTimeout(() => setIsBlinking(false), 150);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [faceExpression]);

  // --- FILE HANDLING ---
  async function resizeAndToDataUrl(file: File): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = (e) => { img.src = e.target?.result as string; };
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const scale = Math.min(1024 / img.width, 1024 / img.height, 1);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      reader.readAsDataURL(file);
    });
  }

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setSelectedImage(await resizeAndToDataUrl(e.target.files[0]));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input?.trim() && !selectedImage) || isLoading) return;
    const currentInput = input;
    setInput("");
    if (selectedImage) {
      await append({
        role: "user",
        content: currentInput || "[Image]",
        experimental_attachments: [{ name: "img.jpg", contentType: "image/jpeg", url: selectedImage }],
      } as any, { data: { isAccountantMode } });
      setSelectedImage(null);
    } else {
      await append({ role: "user", content: currentInput } as any, { data: { isAccountantMode } });
    }
  };

  // --- RENDERERS ---
  const RenderContent = ({ text }: { text?: string }) => {
    if (!text) return null;
    // Basic Markdown
    const html = text.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br/>");
    
    // Check for JSON Invoice Data
    try {
      if (text.trim().startsWith('{') && text.includes('"rows":')) {
        const data = JSON.parse(text);
        if (data.rows && data.summary) return <InvoiceTable data={data} />;
      }
    } catch (e) {}
    
    return <div className="prose prose-invert max-w-full text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />;
  };

  // Keep your Tool Renderer logic if used
  const RenderToolInvocation = ({ toolInvocation }: { toolInvocation: any }) => {
    const { toolName, args, result } = toolInvocation;
    if (toolName === 'playYoutube') {
        const videoSrc = args.videoId ? `https://www.youtube.com/embed/${args.videoId}?autoplay=1` : `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(args.query)}`;
        return <div className="mt-3 w-full max-w-md bg-black/40 rounded-xl overflow-hidden border border-red-900/50 shadow-lg"><iframe width="100%" height="220" src={videoSrc} frameBorder="0" allowFullScreen /></div>;
    }
    if (toolName === 'showMap') return <div className="mt-3 w-full max-w-md bg-black/40 rounded-xl overflow-hidden border border-green-900/50"><div className="p-2 bg-green-900/20 text-green-400 font-bold flex gap-2"><MapPin size={14}/> Location</div><div className="h-48 bg-gray-800"><iframe width="100%" height="100%" frameBorder="0" style={{border:0, filter:'invert(90%) hue-rotate(180deg)'}} src={`https://maps.google.com/maps?q=${encodeURIComponent(args.location)}&t=&z=13&ie=UTF8&iwloc=&output=embed`} allowFullScreen></iframe></div></div>;
    // ... Add other tools here if needed
    return null;
  };

  const AudioWaveform = () => (
    <div className="flex items-center gap-1.5 h-16 absolute z-20 pointer-events-none">
      {[...Array(5)].map((_, i) => (
        <div key={i} className={`w-2.5 bg-gradient-to-t ${theme.gradient} rounded-full animate-wave shadow-[0_0_15px_rgba(168,85,247,0.6)]`} style={{ animationDelay: `${i * 0.15}s`, animationDuration: '1s' }} />
      ))}
    </div>
  );

  const getAvatarSrc = () => {
    if (isBlinking) return "/amina_blink.png";
    if (faceExpression === "speaking") return "/amina_speaking.gif";
    if (faceExpression === "listening") return "/amina_listening.png";
    if (faceExpression === "thinking") return "/amina_thinking.png";
    // Fallback logic
    return "/amina_idle.png";
  };

  return (
    <div className="flex flex-col h-screen bg-black text-white font-sans relative">
      <style jsx global>{`
        @keyframes wave { 0%, 100% { height: 20%; opacity: 0.7; } 50% { height: 100%; opacity: 1; } }
        .animate-wave { animation: wave infinite ease-in-out; }
      `}</style>

      {/* HEADER */}
      <header className="h-16 border-b border-white/10 flex items-center px-4 justify-between bg-black/80 fixed w-full top-0 z-50 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full overflow-hidden border-2 ${theme.border}`}>
            <img src="/Amina_logo.png" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className={`font-bold text-lg text-transparent bg-clip-text bg-gradient-to-r ${theme.gradient}`}>{isAccountantMode ? "AMINA CPA" : "AMINA AI"}</h1>
            <p className="text-[10px] text-green-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> Online</p>
          </div>
        </div>
        <div className="flex gap-2">
            <button onClick={() => setIsAccountantMode(!isAccountantMode)} className={`p-2 rounded-full ${isAccountantMode ? "bg-blue-600/20 text-blue-300" : "bg-purple-600/20 text-purple-300"}`}>{isAccountantMode ? <Briefcase size={20}/> : <Heart size={20}/>}</button>
            <button onClick={clearChat} className="p-2 bg-red-600/20 text-red-400 rounded-full"><Trash2 size={20} /></button>
            <button onClick={() => setIsCallActive(true)} className="p-2 bg-green-600/20 text-green-400 rounded-full"><Phone size={20} /></button>
        </div>
      </header>

      {/* CALL OVERLAY */}
      {isCallActive && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center animate-in fade-in duration-300">
          <button onClick={() => { setIsCallActive(false); stopSpeaking(); }} className="absolute top-6 right-6 p-3 bg-gray-800 rounded-full hover:bg-gray-700 z-50"><X size={24} /></button>
          
          <div className="relative cursor-pointer" onClick={() => !isListening && startListening()}>
            <div className={`absolute inset-0 ${voiceGender === "female" ? theme.bg : "bg-green-600"} rounded-full blur-3xl opacity-40 ${isListening || isSpeaking ? "animate-pulse scale-125" : ""} transition-all duration-1000`}></div>
            <div className={`w-48 h-48 rounded-full overflow-hidden border-4 ${theme.border} relative z-10`}>
              <img src={getAvatarSrc()} onError={(e) => e.currentTarget.src="/Amina_logo.png"} className="w-full h-full object-cover" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center z-20">
               {isSpeaking ? <AudioWaveform /> : isListening ? <div className="bg-green-500 p-3 rounded-full border-2 border-black animate-bounce shadow-lg"><Mic size={24} fill="white" /></div> : null}
            </div>
          </div>

          <h2 className="mt-10 text-3xl font-bold text-white">{voiceGender === "female" ? "Amina" : "Mohammad"}</h2>
          <p className={`text-lg mt-2 font-medium ${theme.text}`}>{statusText || "Tap Avatar to Start"}</p>
          
          <div className="absolute bottom-12 flex items-center gap-3">
             <button onClick={() => setVoiceGender((v) => (v === "female" ? "male" : "female"))} className="px-6 py-3 rounded-full bg-white/10 border border-white/10 hover:bg-white/20 transition-all">Switch Voice ({voiceGender})</button>
          </div>
        </div>
      )}

      {/* MESSAGES */}
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
                      <div className="bg-[#111827] text-gray-200 px-4 py-3 rounded-xl shadow-md border border-white/5"><RenderContent text={m.content} /></div>
                      {m.toolInvocations?.map((tool: any) => (<RenderToolInvocation key={tool.toolCallId} toolInvocation={tool} />))}
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 justify-end">
                  <div className={`bg-gradient-to-r ${theme.gradient} text-white px-4 py-2 rounded-full max-w-xs break-words shadow-lg`}>
                    {m.experimental_attachments?.map((attachment: any, i: number) => (<div key={i} className="mb-2 rounded-lg overflow-hidden"><img src={attachment.url} className="w-full h-auto max-h-48 object-cover" /></div>))}
                    <RenderContent text={m.content} />
                  </div>
                </div>
              )}
          </div>
        ))}
        {isLoading && <div className="flex items-center gap-2 text-gray-500 text-xs ml-14 animate-pulse"><Sparkles size={12} /> Amina is thinking...</div>}
        <div ref={messagesEndRef} />
      </main>

      {/* FOOTER */}
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