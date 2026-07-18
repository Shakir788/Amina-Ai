"use client";

// components/RealtimeVoice.tsx
// Amina Realtime Voice — Vercel-only (koi alag server nahi!).
// Browser SEEDHA Gemini Live se connect hota hai ephemeral token ke through.
// Same interface: { status, errorMsg, aiSpeaking, startCall, endCall }

import { useRef, useState, useCallback, useEffect } from "react";
import { GoogleGenAI, Modality } from "@google/genai";

// Token endpoint (same origin). Capacitor/prod me apna deployed URL:
const TOKEN_URL =
  process.env.NEXT_PUBLIC_LIVE_TOKEN_URL || "/api/live-token";

// Model client-side chahiye ab (browser direct connect karta hai)
const MODEL =
  process.env.NEXT_PUBLIC_LIVE_MODEL ||
  "gemini-2.5-flash-native-audio-preview-12-2025";

// Native voices: Puck, Charon, Kore, Fenrir, Aoede, Leda, Orus, Zephyr
export type RtStatus = "idle" | "connecting" | "live" | "error";

interface StartOpts {
  voice?: string;
  context?: string;   // memory / profile summary (Phase 2)
  userName?: string;
}

export function useRealtimeVoice() {
  const [status, setStatus] = useState<RtStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [aiSpeaking, setAiSpeaking] = useState(false);

  const sessionRef = useRef<any>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // Playback (24kHz PCM chunks seamless jodne ke liye)
  const playCtxRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef(0);
  const liveSourcesRef = useRef<AudioBufferSourceNode[]>([]);

  const wantLiveRef = useRef(false);
  const retryRef = useRef(0);
  const MAX_RETRY = 6;
  const optsRef = useRef<StartOpts>({});

  /* ---------- helpers ---------- */
  const downsampleTo16k = (input: Float32Array, inputRate: number): Int16Array => {
    if (inputRate === 16000) {
      const out = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++)
        out[i] = Math.max(-32768, Math.min(32767, input[i] * 32768));
      return out;
    }
    const ratio = inputRate / 16000;
    const outLength = Math.floor(input.length / ratio);
    const out = new Int16Array(outLength);
    for (let i = 0; i < outLength; i++) {
      const s = input[Math.floor(i * ratio)];
      out[i] = Math.max(-32768, Math.min(32767, s * 32768));
    }
    return out;
  };

  const int16ToBase64 = (int16: Int16Array): string => {
    const bytes = new Uint8Array(int16.buffer);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(
        null,
        Array.from(bytes.subarray(i, i + chunk)) as any
      );
    }
    return btoa(binary);
  };

  const playAudioChunk = useCallback((base64Pcm: string) => {
    try {
      if (!playCtxRef.current) {
        playCtxRef.current = new AudioContext({ sampleRate: 24000 });
        nextPlayTimeRef.current = playCtxRef.current.currentTime;
      }
      const ctx = playCtxRef.current;

      const binary = atob(base64Pcm);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const int16 = new Int16Array(bytes.buffer);

      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;

      const buffer = ctx.createBuffer(1, float32.length, 24000);
      buffer.copyToChannel(float32, 0);

      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);

      const startAt = Math.max(ctx.currentTime, nextPlayTimeRef.current);
      src.start(startAt);
      nextPlayTimeRef.current = startAt + buffer.duration;

      setAiSpeaking(true);
      liveSourcesRef.current.push(src);
      src.onended = () => {
        liveSourcesRef.current = liveSourcesRef.current.filter((s) => s !== src);
        if (liveSourcesRef.current.length === 0) setAiSpeaking(false);
      };
    } catch (e) {
      console.error("Playback error:", e);
    }
  }, []);

  const flushPlayback = useCallback(() => {
    liveSourcesRef.current.forEach((s) => { try { s.stop(); } catch {} });
    liveSourcesRef.current = [];
    if (playCtxRef.current) nextPlayTimeRef.current = playCtxRef.current.currentTime;
    setAiSpeaking(false);
  }, []);

  /* ---------- mic ---------- */
  const startMic = useCallback(async () => {
    // 🔴 Echo/feedback fix
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
    });
    micStreamRef.current = stream;

    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;
    const source = audioCtx.createMediaStreamSource(stream);
    sourceRef.current = source;

    const processor = audioCtx.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;

    processor.onaudioprocess = (e) => {
      const session = sessionRef.current;
      if (!session) return;
      const input = e.inputBuffer.getChannelData(0);
      const pcm16 = downsampleTo16k(input, audioCtx.sampleRate);
      try {
        session.sendRealtimeInput({
          audio: { data: int16ToBase64(pcm16), mimeType: "audio/pcm;rate=16000" },
        });
      } catch {}
    };

    source.connect(processor);
    processor.connect(audioCtx.destination);
  }, []);

  const stopMic = useCallback(() => {
    try { processorRef.current?.disconnect(); } catch {}
    try { sourceRef.current?.disconnect(); } catch {}
    try { audioCtxRef.current?.close(); } catch {}
    try { micStreamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
    processorRef.current = null;
    sourceRef.current = null;
    audioCtxRef.current = null;
    micStreamRef.current = null;
  }, []);

  /* ---------- connect (browser -> Gemini direct) ---------- */
  const connect = useCallback(async () => {
    setStatus("connecting");
    setErrorMsg("");

    // 1) Vercel se ephemeral token lao
    let token = "";
    try {
      const res = await fetch(TOKEN_URL, { method: "POST" });
      if (!res.ok) throw new Error("token http " + res.status);
      token = (await res.json()).token;
      if (!token) throw new Error("empty token");
    } catch (e) {
      console.error("token fetch fail:", e);
      setStatus("error");
      setErrorMsg("Token nahi mila. /api/live-token check karo.");
      return;
    }

    // 2) Token se SEEDHA Gemini Live se connect
    try {
      const ai = new GoogleGenAI({
        apiKey: token,
        httpOptions: { apiVersion: "v1alpha" },
      });

      const o = optsRef.current;
      const voiceName = o.voice || "Aoede";
      const persona = `You are Amina — a warm, caring, playful female AI companion on a LIVE voice call${o.userName ? " with " + o.userName : ""}.
Speak naturally in whatever language/mix the user uses (Hindi, Hinglish, Arabic, French, English).
Keep replies short and conversational like a real phone call. Use natural fillers occasionally.
Never mention you are an AI model or read markdown symbols aloud.`;
      const sys = o.context
        ? persona + `\n\nWhat you remember (use naturally):\n${o.context}`
        : persona;

      const session = await ai.live.connect({
        model: MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
          systemInstruction: sys,
        },
        callbacks: {
          onopen: async () => {
            retryRef.current = 0;
            try {
              await startMic();
              setStatus("live");
            } catch (micErr) {
              console.error("Mic error:", micErr);
              setStatus("error");
              setErrorMsg("Microphone access failed. Grant mic permission.");
              try { session.close(); } catch {}
            }
          },
          onmessage: (message: any) => {
            if (message.data) playAudioChunk(message.data);
            if (message.serverContent?.interrupted) flushPlayback();
          },
          onerror: (err: any) => {
            console.error("Gemini Live error:", err?.message || err);
            // reconnect onclose me handle hoga
          },
          onclose: () => {
            sessionRef.current = null;
            stopMic();
            if (!wantLiveRef.current) { setStatus("idle"); return; }
            // 🔁 self-heal: preview model kabhi flaky hota hai
            retryRef.current += 1;
            if (retryRef.current > MAX_RETRY) {
              wantLiveRef.current = false;
              setStatus("error");
              setErrorMsg("Live model abhi unstable hai. Dobara try karo.");
              return;
            }
            setStatus("connecting");
            const delay = Math.min(500 * retryRef.current, 3500);
            setTimeout(() => { if (wantLiveRef.current) connect(); }, delay);
          },
        },
      });

      sessionRef.current = session;
    } catch (err: any) {
      console.error("live.connect fail:", err);
      sessionRef.current = null;
      // retry via same path
      if (!wantLiveRef.current) { setStatus("idle"); return; }
      retryRef.current += 1;
      if (retryRef.current > MAX_RETRY) {
        wantLiveRef.current = false;
        setStatus("error");
        setErrorMsg("Voice connect nahi hua. Model/API key check karo.");
        return;
      }
      const delay = Math.min(500 * retryRef.current, 3500);
      setTimeout(() => { if (wantLiveRef.current) connect(); }, delay);
    }
  }, [playAudioChunk, flushPlayback, startMic, stopMic]);

  /* ---------- public API (same interface) ---------- */
  const startCall = useCallback((opts: StartOpts = {}) => {
    optsRef.current = opts;
    wantLiveRef.current = true;
    retryRef.current = 0;
    connect();
  }, [connect]);

  const endCall = useCallback(() => {
    wantLiveRef.current = false;
    try { sessionRef.current?.close(); } catch {}
    sessionRef.current = null;
    stopMic();
    flushPlayback();
    try { playCtxRef.current?.close(); } catch {}
    playCtxRef.current = null;
    setStatus("idle");
    setAiSpeaking(false);
  }, [stopMic, flushPlayback]);

  useEffect(() => () => { endCall(); }, []); // unmount cleanup

  return { status, errorMsg, aiSpeaking, startCall, endCall };
}
