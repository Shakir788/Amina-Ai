"use client";

import { useChat, Message } from "ai/react";
import { Send, Mic, Paperclip, Phone, X, User, Sparkles, Volume2 } from "lucide-react";
import { useRef, useEffect, useState, ChangeEvent } from "react";
import MessageBubble from "./MessageBubble";

export default function ChatInterface() {
  const { messages, input, handleInputChange, handleSubmit, isLoading, append } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // States
  const [isCallActive, setIsCallActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceGender, setVoiceGender] = useState<'female' | 'male'>('female');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Load Voices (Aur wait karo taaki Google voices load ho jayein)
  useEffect(() => {
    const loadVoices = () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        const available = window.speechSynthesis.getVoices();
        if (available.length > 0) {
            setVoices(available);
        }
      }
    };
    loadVoices();
    // Chrome sometimes needs a little time to load voices
    if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // --- HELPERS (UPDATED FIX) ---
  const cleanTextForSpeech = (text: string) => {
    // Ye updated Regex ab Hearts, Sparkles, Hands sab remove karega
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}]/gu;
    
    return text
      .replace(emojiRegex, '')      // Emojis hatao
      .replace(/[*#_`~-]/g, '')     // Markdown symbols hatao
      .trim();
  };

  // --- SMART VOICE SELECTOR ---
  const getBestVoice = (lang: string, gender: 'female' | 'male') => {
    const femaleKeywords = ["Google US English", "Google", "Natural", "Samantha", "Aria"];
    const maleKeywords = ["Google UK English Male", "David", "Mark"];

    const keywords = gender === 'female' ? femaleKeywords : maleKeywords;

    // 1. Try strict match
    let selectedVoice = voices.find(v => 
      v.lang.includes(lang) && 
      keywords.some(k => v.name.includes(k))
    );

    // 2. Fallback
    return selectedVoice || voices.find(v => v.lang.includes(lang));
  };

  // --- SPEAK FUNCTION ---
  const speak = (rawText: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    setIsListening(false); 
    window.speechSynthesis.cancel();

    const textToSpeak = cleanTextForSpeech(rawText);
    if (!textToSpeak) { if (isCallActive) startListening(); return; }

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    
    // Language Detection
    let langCode = 'en-US';
    if (/[\u0600-\u06FF]/.test(textToSpeak)) langCode = 'ar'; 
    else if (textToSpeak.toLowerCase().includes('bonjour') || textToSpeak.toLowerCase().includes('ça va')) langCode = 'fr';

    const voice = getBestVoice(langCode, voiceGender);
    if(voice) utterance.voice = voice;

    // --- CUTE VOICE SETTINGS ---
    if (voiceGender === 'female') {
        utterance.pitch = 1.15; // Higher pitch = Cuter/Younger
        utterance.rate = 1.05;  // Slightly faster = More energetic
    } else {
        utterance.pitch = 0.9;  // Deeper for male
        utterance.rate = 1.0;
    }

    utterance.onstart = () => setStatusText(voiceGender === 'female' ? "Amina is speaking..." : "Mohammad is speaking...");

    utterance.onend = () => {
      if (isCallActive) {
        setStatusText("Listening...");
        // Instant restart
        startListening(); 
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  // --- LISTEN FUNCTION (Mic) ---
  const startListening = () => {
    if (!isCallActive) return;

    if (typeof window === 'undefined' || !('webkitSpeechRecognition' in window)) {
      return; // Silent fail if not supported
    }

    // @ts-ignore
    const recognition = new window.webkitSpeechRecognition();
    recognition.continuous = false; 
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      setStatusText("Listening...");
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript.trim()) {
        setStatusText("Thinking...");
        setIsListening(false);
        append({ role: 'user', content: transcript });
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
      setStatusText("Tap Avatar to Speak");
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    try { recognition.start(); } catch (e) {}
  };

  // --- TRIGGER ---
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (isCallActive && !isLoading && lastMessage && lastMessage.role === 'assistant') {
      speak(lastMessage.content);
    }
  }, [messages, isLoading, isCallActive]);

  // --- HANDLERS ---
  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setSelectedImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };
  const clearImage = () => { setSelectedImage(null); if (fileInputRef.current) fileInputRef.current.value = ""; };
  
  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if ((!input.trim() && !selectedImage) || isLoading) return;
    if (selectedImage) {
      append({ role: 'user', content: input, experimental_attachments: [{ name: 'image.png', contentType: 'image/png', url: selectedImage }] } as any);
      clearImage();
    } else { handleSubmit(e); }
  };

  return (
    <div className="flex flex-col h-screen bg-black text-white font-sans relative">
      
      {/* CALL MODE OVERLAY */}
      {isCallActive && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center">
           <button onClick={() => {setIsCallActive(false); window.speechSynthesis.cancel();}} className="absolute top-6 right-6 p-3 bg-gray-800 rounded-full hover:bg-gray-700"><X size={24} /></button>
           
           <div className="relative cursor-pointer" onClick={() => !isListening && startListening()}>
             <div className={`absolute inset-0 ${voiceGender === 'female' ? 'bg-purple-600' : 'bg-blue-600'} rounded-full blur-3xl opacity-40 ${isListening ? 'animate-pulse scale-125' : ''} transition-all duration-1000`}></div>
             <div className={`w-48 h-48 rounded-full overflow-hidden border-4 ${voiceGender === 'female' ? 'border-purple-500' : 'border-blue-500'} relative z-10`}>
                <img src="/Amina_logo.png" alt="Amina" className="w-full h-full object-cover" />
             </div>
             {isListening && <div className="absolute bottom-2 right-2 bg-green-500 p-2 rounded-full border-2 border-black z-20 animate-bounce"><Mic size={20} fill="white" /></div>}
           </div>

           <h2 className="mt-10 text-3xl font-bold text-white">{voiceGender === 'female' ? "Amina" : "Mohammad"}</h2>
           
           <p className={`text-lg mt-2 font-medium animate-pulse ${statusText === 'Listening...' ? 'text-green-400' : 'text-purple-300'}`}>
             {statusText || "Tap Avatar to Start"}
           </p>
           
           <button onClick={() => setVoiceGender(v => v === 'female' ? 'male' : 'female')} className="absolute bottom-12 flex items-center gap-3 px-6 py-3 bg-white/10 rounded-full border border-white/10"><Sparkles size={18}/><span className="text-sm">Switch Voice</span></button>
        </div>
      )}

      {/* HEADER */}
      <header className="h-16 border-b border-white/10 flex items-center px-4 justify-between bg-black/80 fixed w-full top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-purple-500"><img src="/Amina_logo.png" alt="Amina" className="w-full h-full object-cover" /></div>
          <div><h1 className="font-bold text-lg text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">AMINA AI</h1><p className="text-[10px] text-green-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>Online</p></div>
        </div>
        <button onClick={() => { setIsCallActive(true); setTimeout(() => startListening(), 500); }} className="p-2 bg-green-600/20 text-green-400 rounded-full"><Phone size={20} /></button>
      </header>

      {/* MAIN CHAT */}
      <main className="flex-1 overflow-y-auto pt-20 pb-24 px-4 md:px-20 lg:px-64 scroll-smooth">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center animate-in fade-in duration-700">
            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-purple-500 mb-6 shadow-[0_0_30px_rgba(168,85,247,0.3)]"><img src="/Amina_logo.png" alt="Amina" className="w-full h-full object-cover" /></div>
            <h2 className="text-3xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-purple-400 mb-4 drop-shadow-sm" style={{ fontFamily: 'sans-serif' }}>أهلاً بكِ يا دعاء ❤️</h2>
            <p className="text-lg text-gray-300">أنا أمينة، كيف حالك اليوم؟</p>
          </div>
        )}
        {messages.map((m: any) => (
            <MessageBubble key={m.id} role={m.role} content={m.content} attachment={m.experimental_attachments?.[0]?.url} />
        ))}
        <div ref={messagesEndRef} />
      </main>

      {/* INPUT */}
      <footer className="fixed bottom-0 w-full p-4 bg-gradient-to-t from-black via-black/90 z-50">
        <div className="max-w-3xl mx-auto">
          {selectedImage && (
             <div className="mb-2 relative w-fit animate-in slide-in-from-bottom-2">
                 <img src={selectedImage} alt="Selected" className="w-20 h-20 object-cover rounded-lg border border-purple-500" />
                 <button onClick={clearImage} className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1"><X size={12} fill="white"/></button>
             </div>
          )}
          <form onSubmit={handleFormSubmit} className="relative flex items-center gap-2 bg-[#1a1a1a] border border-white/10 p-2 pl-4 rounded-full shadow-2xl">
            <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
            <button type="button" onClick={() => fileInputRef.current?.click()} className="text-gray-400 hover:text-purple-400"><Paperclip size={20} /></button>
            <input className="flex-1 bg-transparent border-none outline-none text-white" value={input} onChange={handleInputChange} placeholder="Message Amina..." />
            <button type="button" onClick={() => {if(!isListening) startListening()}} className="p-2 text-gray-400 hover:text-white"><Mic size={20} /></button>
            <button type="submit" disabled={isLoading || (!input.trim() && !selectedImage)} className="p-3 bg-purple-600 text-white rounded-full"><Send size={18} /></button>
          </form>
        </div>
      </footer>
    </div>
  );
}import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleGenerativeAIStream, StreamingTextResponse } from "ai";