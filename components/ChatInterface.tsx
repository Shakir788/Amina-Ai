"use client";

import { useChat } from "ai/react";
import { Send, Mic, Paperclip, Phone, X, Sparkles, Trash2 } from "lucide-react";
import { useRef, useEffect, useState, ChangeEvent } from "react";
import MessageBubble from "./MessageBubble";

export default function ChatInterface() {
  const { messages, input, handleInputChange, handleSubmit, isLoading, append, setMessages } =
    useChat();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  
  // Ref to control audio playback (stop/start)
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // States
  const [isCallActive, setIsCallActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [voiceGender, setVoiceGender] = useState<"female" | "male">("female");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Typing indicator
  const [isTyping, setIsTyping] = useState(false);

  // --- PERMANENT MEMORY (debounced & limited) ---
  const MAX_STORE_MESSAGES = 30;
  useEffect(() => {
    const saved = localStorage.getItem("amina_memory_v1");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setMessages(parsed.slice(-MAX_STORE_MESSAGES));
        }
      } catch (e) {
        // ignore parse errors
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Debounce writes to avoid frequent localStorage operations
    if (messages.length === 0) return;
    const toStore = messages.slice(-MAX_STORE_MESSAGES).map((m: any) => {
      return { id: m.id, role: m.role, content: (m.content || "").slice(0, 1000) };
    });

    const id = setTimeout(() => {
      try {
        localStorage.setItem("amina_memory_v1", JSON.stringify(toStore));
      } catch (e) {
        // ignore storage errors (private mode etc.)
      }
    }, 400);

    return () => clearTimeout(id);
  }, [messages, setMessages]);

  const clearChat = () => {
    if (confirm("Are you sure you want to delete memory?")) {
      localStorage.removeItem("amina_memory_v1");
      setMessages([]);
    }
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // --- HELPERS ---
  const cleanTextForSpeech = (text: string) => {
    const emojiRegex =
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}]/gu;
    return text.replace(emojiRegex, "").replace(/[*#_`~-]/g, "").trim();
  };

  // ---- MOOD DETECTION ----
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

  // ==========================================
  // --- SMART AUTO-LANGUAGE SPEAK FUNCTION ---
  // ==========================================
  const speak = async (rawText: string) => {
    // Stop listening while speaking to avoid echo
    if (isCallActive) setIsListening(false);

    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    // Clean text lightly
    const textToProcess = cleanTextForSpeech(rawText);
    if (!textToProcess) return;

    // 1. Detect if text is Arabic (Checks for Arabic unicode range)
    const isArabic = /[\u0600-\u06FF]/.test(textToProcess);

    // 2. Select Voice based on Language AND Gender
    let selectedVoice = "";
    
    if (isArabic) {
      // Use High Quality Arabic Voices
      selectedVoice = voiceGender === "female" 
        ? "ar-EG-SalmaNeural"   // Egyptian Arabic (Female - Friendly)
        : "ar-EG-ShakirNeural"; // Egyptian Arabic (Male)
    } else {
      // Use High Quality English Voices
      selectedVoice = voiceGender === "female" 
        ? "en-US-AriaNeural"    // US English (Female - Expressive)
        : "en-US-GuyNeural";    // US English (Male - Calm)
    }

    // Set Status Text
    setStatusText(
      voiceGender === "female" 
        ? (isArabic ? "Amina (Arabic)..." : "Amina is speaking...") 
        : (isArabic ? "Mohammad (Arabic)..." : "Mohammad is speaking...")
    );

    try {
      // 3. Prepare SSML
      // Only apply English "hmm/laugh" hacks if it's NOT Arabic (to avoid weird accents)
      let ssml = textToProcess;
      
      if (!isArabic) {
        ssml = ssml
          .replace(/hmm/gi, "<break time='200ms'/> hmm <break time='300ms'/>")
          .replace(/ahh/gi, "ahh <break time='200ms'/>")
          .replace(/\(laugh\)/gi, "<mstts:express-as style='cheerful'>ha ha ha</mstts:express-as>")
          .replace(/\.{3}/g, "<break time='300ms'/>");
      }

      // 4. Send Request
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
      audioRef.current = audio; // Store ref to handle cleanup/stopping

      // IMPORTANT: When audio finishes, resume listening if in call mode
      audio.onended = () => {
        URL.revokeObjectURL(url); // Memory cleanup
        audioRef.current = null;
        
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
    }
  };

  // --- SpeechRecognition: single instance + cleanup ---
  let recognitionRef: any = null;
  const getRecognitionCtor = () =>
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;

  const startListening = () => {
    if (!isCallActive) return;
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
    } catch (e) {
      // sometimes start throws if started already
    }
  };

  useEffect(() => {
    // cleanup on unmount
    return () => {
      try {
        recognitionRef?.stop?.();
      } catch (e) {}
      
      if(audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // speak assistant replies when call active
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (isCallActive && !isLoading && lastMessage && lastMessage.role === "assistant") {
      speak(lastMessage.content);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, isLoading, isCallActive]);

  // --- TYPING ANIMATION HANDLING ---
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    if (isLoading) {
      t = setTimeout(() => setIsTyping(true), 260); // small delay to avoid flicker
    } else {
      setIsTyping(false);
    }
    return () => {
      if (t) clearTimeout(t);
    };
  }, [isLoading]);

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last?.role === "assistant") setIsTyping(false);
  }, [messages]);

  // --- FILE HANDLERS ---
  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setSelectedImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };
  const clearImage = () => {
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // --- HANDLERS: form submit with mood ---
  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if ((!input.trim() && !selectedImage) || isLoading) return;

    const mood = detectMoodFromText(input);

    if (selectedImage) {
      append({
        role: "user",
        content: input,
        experimental_mood: mood,
        experimental_attachments: [{ name: "image.png", contentType: "image/png", url: selectedImage }],
      } as any);
      clearImage();
    } else {
      append({ role: "user", content: input, experimental_mood: mood } as any);
      handleSubmit(e);
    }
  };

  // --------------------------
  // --- Simple Markdown-ish renderer
  // --------------------------
  const escapeHtml = (unsafe: string) =>
    unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  function renderMarkdownToHtml(raw: string) {
    if (!raw) return "";
    let out = escapeHtml(raw);
    out = out.replace(/^### (.*$)/gim, "<h3 class='text-md font-semibold'>$1</h3>");
    out = out.replace(/^## (.*$)/gim, "<h2 class='text-lg font-semibold'>$1</h2>");
    out = out.replace(/^# (.*$)/gim, "<h1 class='text-xl font-bold'>$1</h1>");
    out = out.replace(/\*\*(.+?)\*\*/gim, "<strong>$1</strong>");
    out = out.replace(/\*(.+?)\*/gim, "<em>$1</em>");
    out = out.replace(/\n/g, "<br/>");
    return out;
  }

  const RenderContent = ({ text }: { text?: string }) => {
    if (!text) return null;
    const html = renderMarkdownToHtml(text);
    return <div className="prose prose-invert max-w-full" dangerouslySetInnerHTML={{ __html: html }} />;
  };

  // --- TYPING BUBBLE component ---
  const TypingBubble = () => (
    <>
      <style jsx>{`
        .amina-typing {
          display: inline-flex;
          gap: 6px;
        }
        .amina-typing span {
          width: 8px;
          height: 8px;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.85);
          opacity: 0.35;
          transform: translateY(0);
          animation: amina-blink 900ms infinite;
        }
        .amina-typing span:nth-child(2) {
          animation-delay: 120ms;
        }
        .amina-typing span:nth-child(3) {
          animation-delay: 240ms;
        }
        @keyframes amina-blink {
          0% {
            opacity: 0.25;
            transform: translateY(0);
          }
          50% {
            opacity: 1;
            transform: translateY(-5px);
          }
          100% {
            opacity: 0.25;
            transform: translateY(0);
          }
        }
      `}</style>

      <div className="flex items-start gap-3 mb-3 animate-in">
        <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-purple-500">
          <img src="/Amina_logo.png" alt="Amina" className="w-full h-full object-cover" />
        </div>
        <div>
          <div className="bg-[#111827] text-gray-200 px-4 py-2 rounded-xl shadow-md max-w-xs">
            <div className="amina-typing">
              <span></span>
              <span></span>
              <span></span>
            </div>
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
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-purple-500">
            <img src="/Amina_logo.png" alt="Amina" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
              AMINA AI
            </h1>
            <p className="text-[10px] text-green-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>Online
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={clearChat}
            className="p-2 bg-red-600/20 text-red-400 rounded-full hover:bg-red-600/40"
            title="Clear Memory"
          >
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
              // Stop audio and listening
              if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
              }
              try {
                recognitionRef?.stop?.();
              } catch (_) {}
            }}
            className="absolute top-6 right-6 p-3 bg-gray-800 rounded-full hover:bg-gray-700"
          >
            <X size={24} />
          </button>

          <div className="relative cursor-pointer" onClick={() => !isListening && startListening()}>
            <div
              className={`absolute inset-0 ${voiceGender === "female" ? "bg-purple-600" : "bg-blue-600"
                } rounded-full blur-3xl opacity-40 ${isListening ? "animate-pulse scale-125" : ""} transition-all duration-1000`}
            ></div>

            <div
              className={`w-48 h-48 rounded-full overflow-hidden border-4 ${voiceGender === "female" ? "border-purple-500" : "border-blue-500"
                } relative z-10`}
            >
              <img src="/Amina_logo.png" alt="Amina" className="w-full h-full object-cover" />
            </div>

            {isListening && (
              <div className="absolute bottom-2 right-2 bg-green-500 p-2 rounded-full border-2 border-black z-20 animate-bounce">
                <Mic size={20} fill="white" />
              </div>
            )}
          </div>

          <h2 className="mt-10 text-3xl font-bold text-white">
            {voiceGender === "female" ? "Amina" : "Mohammad"}
          </h2>
          <p className={`text-lg mt-2 font-medium animate-pulse ${statusText === "Listening..." ? "text-green-400" : "text-purple-300"
            }`}>
            {statusText || "Tap Avatar to Start"}
          </p>

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
            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-purple-500 mb-6 shadow-[0_0_30px_rgba(168,85,247,0.3)]">
              <img src="/Amina_logo.png" alt="Amina" className="w-full h-full object-cover" />
            </div>
            <h2
              className="text-3xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-purple-400 mb-4 drop-shadow-sm"
              style={{ fontFamily: "sans-serif" }}
            >
              أهلاً بكِ يا دعاء ❤️
            </h2>
            <p className="text-lg text-gray-300">أنا أمينة، كيف حالك اليوم؟</p>
          </div>
        )}

        {messages.map((m: any) => (
          <div key={m.id}>
            <div className="mb-3">
              {m.role === "assistant" ? (
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-purple-500">
                    <img src="/Amina_logo.png" alt="Amina" className="w-full h-full object-cover" />
                  </div>
                  <div className="bg-[#111827] text-gray-200 px-4 py-3 rounded-xl shadow-md max-w-3xl">
                    <RenderContent text={m.content} />
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 justify-end">
                  <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 rounded-full max-w-xs">
                    <RenderContent text={m.content} />
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Typing animation */}
        {isTyping && <TypingBubble />}

        <div ref={messagesEndRef} />
      </main>

      {/* FOOTER / INPUT */}
      <footer className="fixed bottom-0 w-full p-4 bg-black/90 backdrop-blur-md z-50 border-t border-white/10">
        <div className="max-w-3xl mx-auto">
          {selectedImage && (
            <div className="mb-2 relative w-fit animate-in slide-in-from-bottom-2">
              <img src={selectedImage} alt="Selected" className="w-20 h-20 object-cover rounded-lg border border-purple-500" />
              <button onClick={clearImage} className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1">
                <X size={12} fill="white" />
              </button>
            </div>
          )}

          <form onSubmit={handleFormSubmit} className="relative flex items-center gap-2 bg-[#1a1a1a] border border-white/10 p-2 pl-4 rounded-full shadow-2xl">
            <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
            <button type="button" onClick={() => fileInputRef.current?.click()} className="text-gray-400 hover:text-purple-400">
              <Paperclip size={20} />
            </button>

            <input
              className="flex-1 bg-transparent border-none outline-none text-white"
              value={input}
              onChange={handleInputChange}
              placeholder="Message Amina..."
            />

            <button type="button" onClick={() => { if (!isListening) startListening(); }} className="p-2 text-gray-400 hover:text-white">
              <Mic size={20} />
            </button>

            <button type="submit" disabled={isLoading || (!input.trim() && !selectedImage)} className="p-3 bg-purple-600 text-white rounded-full">
              <Send size={18} />
            </button>
          </form>
        </div>
      </footer>
    </div>
  );
}