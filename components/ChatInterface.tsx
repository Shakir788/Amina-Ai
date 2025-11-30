"use client";

import { useChat } from "ai/react";
import { Send, Mic, Paperclip, Phone, X, Trash2, Square, Briefcase, Heart } from "lucide-react";
import { useRef, useEffect, useState, ChangeEvent } from "react";

export default function ChatInterface() {
  // --- STATE: ACCOUNTANT MODE ---
  const [isAccountantMode, setIsAccountantMode] = useState(false);

  // --- USE CHAT HOOK (Dynamic API) ---
  const { messages, input, handleInputChange, handleSubmit, isLoading, append, setMessages } =
    useChat({
      api: isAccountantMode ? '/api/accountant' : '/api/chat',
    });

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  
  // Ref to control audio playback
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // States
  const [isCallActive, setIsCallActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false); 
  const [statusText, setStatusText] = useState("");
  const [voiceGender, setVoiceGender] = useState<"female" | "male">("female");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Typing indicator
  const [isTyping, setIsTyping] = useState(false);

  // --- THEME COLORS ---
  const themeColor = isAccountantMode ? "blue" : "purple";
  const themeGradient = isAccountantMode ? "from-blue-500 to-cyan-500" : "from-purple-500 to-pink-500";
  const themeBorder = isAccountantMode ? "border-blue-500" : "border-purple-500";

  // --- PERMANENT MEMORY ---
  const MAX_STORE_MESSAGES = 30;
  useEffect(() => {
    const saved = localStorage.getItem("amina_memory_v1");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setMessages(parsed.slice(-MAX_STORE_MESSAGES));
        }
      } catch (e) {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (messages.length === 0) return;
    const toStore = messages.slice(-MAX_STORE_MESSAGES).map((m: any) => {
      return { id: m.id, role: m.role, content: (m.content || "").slice(0, 1000) };
    });
    const id = setTimeout(() => {
      try {
        localStorage.setItem("amina_memory_v1", JSON.stringify(toStore));
      } catch (e) {}
    }, 400);
    return () => clearTimeout(id);
  }, [messages, setMessages]);

  const clearChat = () => {
    if (confirm("Are you sure you want to delete memory?")) {
      localStorage.removeItem("amina_memory_v1");
      setMessages([]);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // --- HELPERS ---
  const cleanTextForSpeech = (text: string) => {
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}]/gu;
    return text.replace(emojiRegex, "").replace(/[*#_`~-]/g, "").trim();
  };

  type Mood = "sad" | "angry" | "tired" | "happy" | "neutral";
  function detectMoodFromText(text: string): Mood {
    if (!text) return "neutral";
    const t = text.toLowerCase();
    if (/[😭😢😞😔😟]/.test(text)) return "sad";
    if (/[😡😤🤬]/.test(text)) return "angry";
    if (/[😴😪💤]/.test(text)) return "tired";
    if (/[😊😍😁😃😂🎉]/.test(text)) return "happy";
    const sadWords = ["sad", "cry", "hurt", "tired", "broken", "miss"];
    const angryWords = ["angry", "mad", "upset", "furious"];
    const tiredWords = ["tired", "sleepy", "exhausted"];
    const happyWords = ["happy", "good", "great", "awesome", "love", "fine", "alhamdulillah", "thanks"];
    if (sadWords.some((w) => t.includes(w))) return "sad";
    if (angryWords.some((w) => t.includes(w))) return "angry";
    if (tiredWords.some((w) => t.includes(w))) return "tired";
    if (happyWords.some((w) => t.includes(w))) return "happy";
    return "neutral";
  }

  // --- NEW STOP FUNCTION ---
  const stopSpeaking = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsSpeaking(false);
      if (isCallActive) {
        setStatusText("Listening...");
        startListening();
      } else {
        setStatusText("");
      }
    }
  };

  // ==========================================
  // --- SMART AUTO-LANGUAGE SPEAK FUNCTION ---
  // ==========================================
  const speak = async (rawText: string) => {
    if (isCallActive) setIsListening(false);
    stopSpeaking(); // Stop previous audio first

    const textToProcess = cleanTextForSpeech(rawText);
    if (!textToProcess) return;

    // Detect Language
    const isArabic = /[\u0600-\u06FF]/.test(textToProcess);

    let selectedVoice = "";
    if (isArabic) {
      selectedVoice = voiceGender === "female" ? "ar-EG-SalmaNeural" : "ar-EG-ShakirNeural";
    } else {
      selectedVoice = voiceGender === "female" ? "en-US-AriaNeural" : "en-US-GuyNeural";
    }

    setStatusText(
      voiceGender === "female" 
        ? (isArabic ? "Amina (Arabic)..." : "Amina is speaking...") 
        : (isArabic ? "Mohammad (Arabic)..." : "Mohammad is speaking...")
    );
    setIsSpeaking(true); // START VISUALIZER

    try {
      let ssml = textToProcess;
      if (!isArabic) {
        ssml = ssml
          .replace(/hmm/gi, "<break time='200ms'/> hmm <break time='300ms'/>")
          .replace(/ahh/gi, "ahh <break time='200ms'/>")
          .replace(/\(laugh\)/gi, "<mstts:express-as style='cheerful'>ha ha ha</mstts:express-as>")
          .replace(/\.{3}/g, "<break time='300ms'/>");
      }

      const res = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: ssml, voice: selectedVoice }),
      });

      if (!res.ok) throw new Error("TTS API Error");

      const buffer = await res.arrayBuffer();
      const blob = new Blob([buffer], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
        setIsSpeaking(false); // STOP VISUALIZER
        
        if (isCallActive) {
          setStatusText("Listening...");
          startListening();
        } else {
          setStatusText("");
        }
      };

      await audio.play();

    } catch (e) {
      console.log("SPEAK ERROR:", e);
      setStatusText("Error playing audio");
      setIsSpeaking(false);
    }
  };

  // --- Speech Recognition ---
  let recognitionRef: any = null;
  const getRecognitionCtor = () =>
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;

  const startListening = () => {
    if (!isCallActive) return;
    if (isSpeaking) return;

    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setStatusText("Speech recognition not supported");
      return;
    }

    if (!recognitionRef) recognitionRef = new Ctor();
    try {
      recognitionRef.continuous = false;
      recognitionRef.interimResults = false;
      recognitionRef.lang = navigator.language || "en-US";

      recognitionRef.onstart = () => {
        setIsListening(true);
        setStatusText("Listening...");
      };
      recognitionRef.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript ?? "";
        if (transcript.trim()) {
          setStatusText("Thinking...");
          setIsListening(false);
          append({ role: "user", content: transcript } as any);
        }
      };
      recognitionRef.onerror = () => {
        setIsListening(false);
        setStatusText("Tap Avatar to Speak");
      };
      recognitionRef.onend = () => {
        setIsListening(false);
      };
      recognitionRef.start();
    } catch (e) {}
  };

  useEffect(() => {
    return () => {
      try { recognitionRef?.stop?.(); } catch (e) {}
      if(audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (isCallActive && !isLoading && lastMessage && lastMessage.role === "assistant") {
      speak(lastMessage.content);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, isLoading, isCallActive]);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    if (isLoading) {
      t = setTimeout(() => setIsTyping(true), 260);
    } else {
      setIsTyping(false);
    }
    return () => { if (t) clearTimeout(t); };
  }, [isLoading]);

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last?.role === "assistant") setIsTyping(false);
  }, [messages]);

  // ==========================================
  // --- NEW IMAGE HANDLER LOGIC (COMPRESSION) ---
  // ==========================================
  
  // Helper: Resize image to prevent large payloads
  async function resizeAndToDataUrl(file: File, maxW = 1024, maxH = 1024): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = () => {
        img.onload = () => {
          let w = img.width, h = img.height;
          const ratio = Math.min(1, Math.min(maxW / w, maxH / h));
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) return reject("no-canvas-context");
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.78); // compressed jpeg
          resolve(dataUrl);
        };
        img.onerror = () => reject("image-load-error");
        img.src = reader.result as string;
      };
      reader.onerror = () => reject("file-read-error");
      reader.readAsDataURL(file);
    });
  }

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      // Resize & compress
      const smallDataUrl = await resizeAndToDataUrl(file, 1024, 1024);
      setSelectedImage(smallDataUrl);
    } catch (err) {
      console.error("Image resize error, falling back:", err);
      // Fallback to original if resize fails
      const reader = new FileReader();
      reader.onloadend = () => setSelectedImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // --- UPDATED SUBMIT LOGIC (Single Append Call) ---
  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if ((!input.trim() && !selectedImage) || isLoading) return;

    const mood = detectMoodFromText(input);

    if (selectedImage) {
      // 1) Append with Image (SDK handles API call automatically)
      await append({
        role: "user",
        content: input || "[Image]",
        experimental_mood: mood,
        experimental_attachments: [{ name: "image.jpg", contentType: "image/jpeg", url: selectedImage }],
      } as any);

      // Clear selected image in UI
      clearImage();

    } else {
      // 2) Append text only
      await append({ role: "user", content: input, experimental_mood: mood } as any);
    }

    // cleanup input
    try { handleInputChange({ target: { value: "" } } as any); } catch (e) {}
  };

  // --- MARKDOWN RENDERER ---
  const escapeHtml = (unsafe: string) =>
    unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");

  function renderMarkdownToHtml(raw: string) {
    if (!raw) return "";
    let out = escapeHtml(raw);
    out = out.replace(/^### (.*$)/gim, "<h3 class='text-md font-semibold'>$1</h3>");
    out = out.replace(/^## (.*$)/gim, "<h2 class='text-lg font-semibold'>$1</h2>");
    out = out.replace(/^# (.*$)/gim, "<h1 class='text-xl font-bold'>$1</h1>");
    out = out.replace(/\*\*(.+?)\*\*/gim, "<strong>$1</strong>");
    out = out.replace(/\*(.+?)\*/gim, "<em>$1</em>");
    out = out.replace(/```([\s\S]*?)```/g, "<pre class='bg-gray-800 p-2 rounded my-2 overflow-x-auto'><code>$1</code></pre>"); // Basic code block
    out = out.replace(/\n/g, "<br/>");
    return out;
  }

  const RenderContent = ({ text }: { text?: string }) => {
    if (!text) return null;
    const html = renderMarkdownToHtml(text);
    return <div className="prose prose-invert max-w-full" dangerouslySetInnerHTML={{ __html: html }} />;
  };

  // --- VISUALIZER COMPONENT ---
  const AudioWaveform = () => (
    <div className="flex items-center gap-1.5 h-16 absolute z-20 pointer-events-none">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className={`w-2.5 bg-gradient-to-t ${themeGradient} rounded-full animate-wave shadow-[0_0_15px_rgba(168,85,247,0.6)]`}
          style={{
            animationDelay: `${i * 0.15}s`,
            animationDuration: '1s'
          }}
        />
      ))}
      <style jsx>{`
        @keyframes wave {
          0%, 100% { height: 20%; opacity: 0.7; }
          50% { height: 100%; opacity: 1; }
        }
        .animate-wave {
          animation: wave infinite ease-in-out;
        }
      `}</style>
    </div>
  );

  const TypingBubble = () => (
    <>
      <style jsx>{`
        .amina-typing { display: inline-flex; gap: 6px; }
        .amina-typing span {
          width: 8px; height: 8px; border-radius: 9999px;
          background: rgba(255, 255, 255, 0.85); opacity: 0.35;
          animation: amina-blink 900ms infinite;
        }
        .amina-typing span:nth-child(2) { animation-delay: 120ms; }
        .amina-typing span:nth-child(3) { animation-delay: 240ms; }
        @keyframes amina-blink {
          0% { opacity: 0.25; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(-5px); }
          100% { opacity: 0.25; transform: translateY(0); }
        }
      `}</style>
      <div className="flex items-start gap-3 mb-3 animate-in">
        <div className={`w-9 h-9 rounded-full overflow-hidden border-2 ${themeBorder}`}>
          <img src="/Amina_logo.png" alt="Amina" className="w-full h-full object-cover" />
        </div>
        <div>
          <div className="bg-[#111827] text-gray-200 px-4 py-2 rounded-xl shadow-md max-w-xs">
            <div className="amina-typing"><span></span><span></span><span></span></div>
          </div>
        </div>
      </div>
    </>
  );

  // -----------------------
  // RENDER JSX
  // -----------------------
  return (
    <div className="flex flex-col h-screen bg-black text-white font-sans relative">
      {/* HEADER */}
      <header className="h-16 border-b border-white/10 flex items-center px-4 justify-between bg-black/80 fixed w-full top-0 z-50 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full overflow-hidden border-2 ${themeBorder} transition-colors duration-500`}>
            <img src="/Amina_logo.png" alt="Amina" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className={`font-bold text-lg text-transparent bg-clip-text bg-gradient-to-r ${themeGradient} transition-all duration-500`}>
              {isAccountantMode ? "AMINA CPA" : "AMINA AI"}
            </h1>
            <p className="text-[10px] text-green-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
              {isAccountantMode ? "Work Mode" : "Online"}
            </p>
          </div>
        </div>

        {/* CENTER TOGGLE BUTTON */}
        <button 
          onClick={() => setIsAccountantMode(!isAccountantMode)}
          className={`hidden md:flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold border transition-all duration-300 ${
            isAccountantMode 
            ? "bg-blue-600/20 border-blue-500 text-blue-300 hover:bg-blue-600/30" 
            : "bg-pink-600/20 border-pink-500 text-pink-300 hover:bg-pink-600/30"
          }`}
        >
           {isAccountantMode ? <Briefcase size={16}/> : <Heart size={16}/>}
           {isAccountantMode ? "Accountant Mode" : "Bestie Mode"}
        </button>

        <div className="flex gap-2">
          {/* Mobile Toggle Button (Icon Only) */}
          <button 
            onClick={() => setIsAccountantMode(!isAccountantMode)}
            className={`md:hidden p-2 rounded-full transition-all ${
                isAccountantMode ? "bg-blue-600/20 text-blue-300" : "bg-pink-600/20 text-pink-300"
            }`}
          >
             {isAccountantMode ? <Briefcase size={20}/> : <Heart size={20}/>}
          </button>

          <button onClick={clearChat} className="p-2 bg-red-600/20 text-red-400 rounded-full hover:bg-red-600/40" title="Clear Memory">
            <Trash2 size={20} />
          </button>
          <button
            onClick={() => {
              setIsCallActive(true);
              setTimeout(() => startListening(), 500);
            }}
            className="p-2 bg-green-600/20 text-green-400 rounded-full hover:bg-green-600/30"
          >
            <Phone size={20} />
          </button>
        </div>
      </header>

      {/* CALL OVERLAY */}
      {isCallActive && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center animate-in fade-in duration-300">
          <button
            onClick={() => {
              setIsCallActive(false);
              stopSpeaking();
              try { recognitionRef?.stop?.(); } catch (_) {}
            }}
            className="absolute top-6 right-6 p-3 bg-gray-800 rounded-full hover:bg-gray-700 z-50"
          >
            <X size={24} />
          </button>

          <div className="relative cursor-pointer" onClick={() => !isListening && startListening()}>
            {/* Background Glow */}
            <div
              className={`absolute inset-0 ${voiceGender === "female" ? (isAccountantMode ? "bg-blue-600" : "bg-purple-600") : "bg-green-600"
              } rounded-full blur-3xl opacity-40 ${isListening || isSpeaking ? "animate-pulse scale-125" : ""} transition-all duration-1000`}
            ></div>

            {/* Avatar */}
            <div
              className={`w-48 h-48 rounded-full overflow-hidden border-4 ${isAccountantMode ? "border-blue-500" : "border-purple-500"
              } relative z-10 transition-colors duration-500`}
            >
              <img src="/Amina_logo.png" alt="Amina" className="w-full h-full object-cover" />
            </div>

            {/* Mic / Visualizer Overlay */}
            <div className="absolute inset-0 flex items-center justify-center z-20">
               {isSpeaking ? (
                 <AudioWaveform /> 
               ) : isListening ? (
                 <div className="bg-green-500 p-3 rounded-full border-2 border-black animate-bounce shadow-lg">
                   <Mic size={24} fill="white" />
                 </div>
               ) : null}
            </div>
          </div>

          <h2 className="mt-10 text-3xl font-bold text-white">
            {voiceGender === "female" ? (isAccountantMode ? "Amina (CPA)" : "Amina") : "Mohammad"}
          </h2>
          <p className={`text-lg mt-2 font-medium animate-pulse ${statusText === "Listening..." ? "text-green-400" : "text-purple-300"
            }`}>
            {statusText || "Tap Avatar to Start"}
          </p>

          {/* STOP BUTTON */}
          {isSpeaking && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                stopSpeaking();
              }}
              className="mt-6 px-6 py-2 bg-red-500/80 hover:bg-red-600 text-white rounded-full flex items-center gap-2 transition-all animate-in fade-in slide-in-from-bottom-4"
            >
              <Square size={16} fill="white" /> Stop Speaking
            </button>
          )}

          {/* Controls */}
          <div className="absolute bottom-12 flex items-center gap-3">
             <button
              onClick={() => setVoiceGender((v) => (v === "female" ? "male" : "female"))}
              className="px-6 py-3 rounded-full bg-white/10 border border-white/10 hover:bg-white/20 transition-all"
            >
              Switch Voice ({voiceGender})
            </button>
          </div>
        </div>
      )}

      {/* CHAT AREA */}
      <main className="flex-1 overflow-y-auto pt-20 pb-24 px-4 md:px-20 lg:px-64 scroll-smooth">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center animate-in fade-in duration-700">
            <div className={`w-32 h-32 rounded-full overflow-hidden border-4 ${themeBorder} mb-6 shadow-[0_0_30px_rgba(168,85,247,0.3)]`}>
              <img src="/Amina_logo.png" alt="Amina" className="w-full h-full object-cover" />
            </div>
            <h2
              className={`text-3xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r ${themeGradient} mb-4 drop-shadow-sm`}
              style={{ fontFamily: "sans-serif" }}
            >
              {isAccountantMode ? "Work Mode On 📊" : "أهلاً بكِ يا دعاء ❤️"}
            </h2>
            <p className="text-lg text-gray-300">
                {isAccountantMode 
                 ? "Ready to crunch numbers. Send me a bill or ask for formulas." 
                 : "أنا أمينة، كيف حالك اليوم؟"}
            </p>
          </div>
        )}

        {messages.map((m: any) => (
          <div key={m.id}>
            <div className="mb-3">
              {m.role === "assistant" ? (
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-full overflow-hidden border-2 ${themeBorder}`}>
                    <img src="/Amina_logo.png" alt="Amina" className="w-full h-full object-cover" />
                  </div>
                  <div className="bg-[#111827] text-gray-200 px-4 py-3 rounded-xl shadow-md max-w-3xl">
                    <RenderContent text={m.content} />
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 justify-end">
                  <div className={`bg-gradient-to-r ${themeGradient} text-white px-4 py-2 rounded-full max-w-xs break-words`}>
                    {/* Render Image Attachment if exists */}
                    {m.experimental_attachments?.map((attachment: any, index: number) => (
                      <div key={index} className="mb-2 rounded-lg overflow-hidden">
                        <img 
                          src={attachment.url} 
                          alt="attachment" 
                          className="w-full h-auto max-h-48 object-cover"
                        />
                      </div>
                    ))}
                    <RenderContent text={m.content} />
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {isTyping && <TypingBubble />}
        <div ref={messagesEndRef} />
      </main>

      {/* FOOTER / INPUT */}
      <footer className="fixed bottom-0 w-full p-4 bg-black/90 backdrop-blur-md z-50 border-t border-white/10">
        <div className="max-w-3xl mx-auto">
          {selectedImage && (
            <div className="mb-2 relative w-fit animate-in slide-in-from-bottom-2">
              <img src={selectedImage} alt="Selected" className={`w-20 h-20 object-cover rounded-lg border ${themeBorder}`} />
              <button onClick={clearImage} className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1">
                <X size={12} fill="white" />
              </button>
            </div>
          )}

          <form onSubmit={handleFormSubmit} className="relative flex items-center gap-2 bg-[#1a1a1a] border border-white/10 p-2 pl-4 rounded-full shadow-2xl">
            <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
            <button type="button" onClick={() => fileInputRef.current?.click()} className={`text-gray-400 hover:text-${themeColor}-400`}>
              <Paperclip size={20} />
            </button>

            <input
              className="flex-1 bg-transparent border-none outline-none text-white"
              value={input}
              onChange={handleInputChange}
              placeholder={isAccountantMode ? "Ask about Excel or upload invoice..." : "Message Amina..."}
            />

            <button type="button" onClick={() => { if (!isListening) startListening(); }} className="p-2 text-gray-400 hover:text-white">
              <Mic size={20} />
            </button>

            <button type="submit" disabled={isLoading || (!input.trim() && !selectedImage)} className={`p-3 bg-${themeColor}-600 text-white rounded-full`}>
              <Send size={18} />
            </button>
          </form>
        </div>
      </footer>
    </div>
  );
}