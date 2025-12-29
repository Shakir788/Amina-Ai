"use client";

import { useState, useRef } from "react";
import { Play, Loader2, Sparkles } from "lucide-react";

export default function VoiceLab() {
  const [text, setText] = useState("Tum kaise ho? Aaj mausam bahot acha hai.");
  const [pitch, setPitch] = useState(0);
  const [speed, setSpeed] = useState(1.0);
  const [voiceId, setVoiceId] = useState("en-IN-Neural2-A"); // Default Indian English (Best for Hinglish)
  const [loading, setLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const testVoice = async () => {
    if (!text) return;
    setLoading(true);
    try {
      const res = await fetch("/api/test-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceId, pitch, speed }),
      });
      
      const data = await res.json();
      if (data.audio) {
        const audio = new Audio("data:audio/mp3;base64," + data.audio);
        audioRef.current = audio;
        audio.play();
      }
    } catch (e) {
      alert("Error generating voice");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-10 flex flex-col items-center justify-center font-sans">
      <div className="w-full max-w-lg bg-gray-900 border border-purple-500/30 p-8 rounded-2xl shadow-2xl">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2 text-purple-400">
          <Sparkles /> Amina Voice Laboratory
        </h1>

        {/* Text Input */}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full bg-black/50 border border-gray-700 rounded-xl p-4 text-white mb-6 focus:border-purple-500 outline-none"
          rows={3}
        />

        {/* Voice Selector */}
        <div className="mb-4">
          <label className="text-xs text-gray-400 uppercase font-bold">Voice Model</label>
          <select 
            value={voiceId} 
            onChange={(e) => setVoiceId(e.target.value)}
            className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg p-2"
          >
            {/* HINGLISH SPECIALIST (Recommended) */}
            <option value="en-IN-Neural2-A">🇮🇳 Indian English - Neural2-A (Female)</option>
            <option value="en-IN-Neural2-D">🇮🇳 Indian English - Neural2-D (Female)</option>
            
            {/* PURE HINDI (Test karein ki ye robotic hai ya nahi) */}
            <option value="hi-IN-Neural2-A">🇮🇳 Hindi - Neural2-A (Female)</option>
            <option value="hi-IN-Neural2-D">🇮🇳 Hindi - Neural2-D (Female)</option>
            
            {/* MALE OPTIONS */}
            <option value="en-IN-Neural2-C">🇮🇳 Male - Neural2-C</option>
          </select>
        </div>

        {/* Sliders */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="text-xs text-gray-400 uppercase font-bold flex justify-between">
              Pitch <span>{pitch}</span>
            </label>
            <input 
              type="range" min="-5" max="5" step="0.5" 
              value={pitch} onChange={(e) => setPitch(parseFloat(e.target.value))}
              className="w-full accent-purple-500 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer mt-2"
            />
            <p className="text-[10px] text-gray-500 mt-1">Lower = Deep/Warm, Higher = Cute/Young</p>
          </div>
          <div>
            <label className="text-xs text-gray-400 uppercase font-bold flex justify-between">
              Speed <span>{speed}</span>
            </label>
            <input 
              type="range" min="0.5" max="1.5" step="0.05" 
              value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))}
              className="w-full accent-blue-500 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer mt-2"
            />
          </div>
        </div>

        {/* Test Button */}
        <button
          onClick={testVoice}
          disabled={loading}
          className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:opacity-90 transition-all"
        >
          {loading ? <Loader2 className="animate-spin" /> : <Play fill="white" />}
          Test Voice
        </button>
      </div>
    </div>
  );
}