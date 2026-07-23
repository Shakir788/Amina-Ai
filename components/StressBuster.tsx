"use client";

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { X, Sparkles, Zap, Camera, Hand, Heart, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

// --- 🎵 AUDIO ENGINE ---
const playSound = (type: 'change' | 'love' | 'chaos' | 'shield' | 'snap' | 'push') => {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    const tone = (freq: number, wave: OscillatorType, dur: number, vol: number, ramp?: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = wave;
        osc.frequency.setValueAtTime(freq, now);
        if (ramp) osc.frequency.linearRampToValueAtTime(ramp, now + dur * 0.5);
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(now + dur);
    };

    if (type === 'change') { tone(600, 'sine', 1, 0.1); }
    else if (type === 'love') { tone(400, 'triangle', 2, 0.15, 600); }
    else if (type === 'chaos') { tone(150, 'sawtooth', 0.8, 0.3); }
    else if (type === 'shield') { tone(220, 'sine', 0.6, 0.08, 440); tone(330, 'sine', 0.6, 0.05, 660); }
    else if (type === 'snap') {
        // Quick sharp crack + low rumble (Doctor-Strange-ish spell snap)
        tone(900, 'square', 0.08, 0.12);
        tone(80, 'sawtooth', 0.5, 0.2);
    }
    else if (type === 'push') { tone(120, 'sine', 0.4, 0.25, 40); }
};

// --- 🌌 SHAPE / SPELL LIBRARY ---
const PARTICLE_COUNT = 4500;
const sin = Math.sin, cos = Math.cos, PI = Math.PI, random = Math.random;

const SHAPES = [
    { name: "Astral Sphere", fn: () => { const r = 7, t = random() * PI * 2, p = Math.acos(2 * random() - 1); return [r * sin(p) * cos(t), r * sin(p) * sin(t), r * cos(p)]; } },
    { name: "Eternal Love", fn: (i: number) => {
        const t = random() * PI * 2;
        const x1 = 16 * Math.pow(sin(t), 3) - 8; const y1 = 13 * cos(t) - 5 * cos(2 * t) - 2 * cos(3 * t) - cos(4 * t);
        const x2 = 16 * Math.pow(sin(t), 3) + 8; const y2 = 13 * cos(t) - 5 * cos(2 * t) - 2 * cos(3 * t) - cos(4 * t);
        if (i % 2 === 0) return [x1 * 0.3, y1 * 0.3, (random() - 0.5) * 4];
        return [x2 * 0.3, y2 * 0.3, (random() - 0.5) * 4];
    }},
    { name: "Galaxy Spiral", fn: (i: number) => { const a = i * 0.05, r = i * 0.004; return [r * 8 * cos(a), (random() - 0.5) * 3, r * 8 * sin(a)]; } },
    { name: "DNA Helix", fn: (i: number) => { const t = i * 0.1; return [sin(t) * 3, (i / PARTICLE_COUNT) * 20 - 10, cos(t) * 3]; } },
    { name: "Sling Ring Portal", fn: () => {
        // Concentric mandala-like rings (Doctor Strange portal)
        const ring = Math.floor(random() * 5);
        const r = 3 + ring * 2.2;
        const t = random() * PI * 2;
        return [r * cos(t), r * sin(t), (random() - 0.5) * 1.5];
    }},
    { name: "Hourglass", fn: () => { const t = random() * PI * 2, h = (random() - 0.5) * 12, r = Math.abs(h) * 0.8 + 0.5; return [r * cos(t), h, r * sin(t)]; } },
    { name: "StarBurst", fn: () => { const r = random() * 15, t = random() * PI * 2, p = random() * PI; return [r * sin(p) * cos(t), r * sin(p) * sin(t), r * cos(p)]; } },
];

const getShapePositions = (index: number) => {
    const fn = SHAPES[index].fn;
    const targets: number[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) { const pos = fn(i); targets.push(pos[0], pos[1], pos[2]); }
    return targets;
};
let currentTargets: number[] = [];

// --- 🔮 MAGIC CIRCLE (Sling Ring style sigil) ---
function createSigilImage(colorHex: string): string {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const cx = size / 2, cy = size / 2;
    ctx.strokeStyle = colorHex;
    ctx.fillStyle = colorHex;
    ctx.lineWidth = 2;
    ctx.shadowColor = colorHex;
    ctx.shadowBlur = 12;

    // Outer rings
    [230, 200, 170].forEach((r, idx) => {
        ctx.globalAlpha = 0.7 - idx * 0.15;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, PI * 2); ctx.stroke();
    });

    // Radial rune ticks
    ctx.globalAlpha = 0.9;
    for (let i = 0; i < 32; i++) {
        const a = (i / 32) * PI * 2;
        const len = i % 4 === 0 ? 22 : 10;
        ctx.beginPath();
        ctx.moveTo(cx + cos(a) * 200, cy + sin(a) * 200);
        ctx.lineTo(cx + cos(a) * (200 - len), cy + sin(a) * (200 - len));
        ctx.stroke();
    }

    // Inner geometric star
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    for (let i = 0; i <= 8; i++) {
        const a = (i / 8) * PI * 2 + PI / 8;
        const r = i % 2 === 0 ? 140 : 70;
        const x = cx + cos(a) * r, y = cy + sin(a) * r;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.stroke();

    // Small orbiting dots
    for (let i = 0; i < 12; i++) {
        const a = (i / 12) * PI * 2;
        ctx.beginPath(); ctx.arc(cx + cos(a) * 170, cy + sin(a) * 170, 4, 0, PI * 2); ctx.fill();
    }

    ctx.globalAlpha = 1;
    return canvas.toDataURL();
}

type HandFxState = {
    open: boolean; fistPrev: boolean; scale: number;
    prevPalmSize: number; lastPushTime: number;
    prevPinchDist: number; lastSnapTime: number;
    rawScreenX: number; rawScreenY: number;
};

export default function StressBuster({ onClose }: { onClose: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const trailCanvasRef = useRef<HTMLCanvasElement>(null);
  const trailCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const trailPointsRef = useRef<{ x: number; y: number }[][]>([[], []]);
  const [shapeName, setShapeName] = useState("Astral Sphere");
  const [isChaos, setIsChaos] = useState(false);
  const [cameraMode, setCameraMode] = useState(false);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [activeSpell, setActiveSpell] = useState<string | null>(null);

  const aiRef = useRef<{ landmarker: HandLandmarker | null }>({ landmarker: null });
  const particlesRef = useRef<THREE.Points | null>(null);
  const shapeIndexRef = useRef(0);
  const lastGestureTime = useRef(0);
  const lastUltimateTime = useRef(0);

  const targetRotation = useRef({ x: 0, y: 0 });
  const currentRotation = useRef({ x: 0, y: 0 });
  const rotationVelocity = useRef({ x: 0, y: 0 });
  const targetScale = useRef(1);
  const currentScale = useRef(1);
  const shockwaveRef = useRef({ active: false, start: 0 });
  const snapBurstRef = useRef({ active: false, start: 0 });

  // 2D screen-space magic circle overlays (not part of the 3D scene, so they
  // never blend/mix with the particle shapes and always track hand position 1:1).
  const magicRingRefs = useRef<(HTMLDivElement | null)[]>([null, null]);
  const sigilFrontRefs = useRef<(HTMLDivElement | null)[]>([null, null]);
  const sigilBackRefs = useRef<(HTMLDivElement | null)[]>([null, null]);
  const ringScreenPos = useRef([
    { x: 0, y: 0 }, { x: 0, y: 0 },
  ]);
  const sigilImages = useRef<string[]>(['', '']);
  const handFx = useRef<HandFxState[]>([
    { open: false, fistPrev: false, scale: 0, prevPalmSize: 0, lastPushTime: 0, prevPinchDist: 1, lastSnapTime: 0, rawScreenX: 0, rawScreenY: 0 },
    { open: false, fistPrev: false, scale: 0, prevPalmSize: 0, lastPushTime: 0, prevPinchDist: 1, lastSnapTime: 0, rawScreenX: 0, rawScreenY: 0 },
  ]);

  const vibrate = (pattern: number | number[]) => { if (navigator.vibrate) navigator.vibrate(pattern); };

  const flashSpell = (name: string) => {
      setActiveSpell(name);
      setTimeout(() => setActiveSpell(prev => (prev === name ? null : prev)), 1200);
  };

  const updateShape = (index: number) => {
      shapeIndexRef.current = index;
      setShapeName(SHAPES[index].name);
      currentTargets = getShapePositions(index);
      playSound(SHAPES[index].name === "Eternal Love" ? 'love' : 'change');
  };

  // 🖥️ Go fullscreen the moment this opens. Esc is handled natively by the
  // Fullscreen API — as soon as the browser exits fullscreen (Esc, or the
  // browser's own exit button), we close this overlay too, so Esc takes the
  // user straight back to the normal screen in one press.
  useEffect(() => {
      const el = rootRef.current;
      if (el && el.requestFullscreen) {
          el.requestFullscreen().catch(() => { /* needs a user gesture on some browsers — see camera button fallback */ });
      }
      const handleFsChange = () => {
          if (!document.fullscreenElement) onClose();
      };
      document.addEventListener('fullscreenchange', handleFsChange);
      return () => {
          document.removeEventListener('fullscreenchange', handleFsChange);
          if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      };
  }, []);

  useEffect(() => {
    if (!mountRef.current) return;
    currentTargets = getShapePositions(0);

    const scene = new THREE.Scene();
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(0xff00de, 1, 100);
    pointLight.position.set(10, 10, 10);
    scene.add(pointLight);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.z = 20;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountRef.current.appendChild(renderer.domElement);

    // Magic circle images (one per possible hand) — gold + cyan Doctor-Strange palette.
    // These render as a DOM overlay, not in the 3D scene, so they stay crisp and
    // never blend into the particle shapes.
    sigilImages.current = [createSigilImage('#ffb700'), createSigilImage('#00e5ff')];
    ringScreenPos.current = [
        { x: window.innerWidth / 2, y: window.innerHeight / 2 },
        { x: window.innerWidth / 2, y: window.innerHeight / 2 },
    ];
    for (let g = 0; g < 2; g++) {
        const url = `url(${sigilImages.current[g]})`;
        if (sigilFrontRefs.current[g]) sigilFrontRefs.current[g]!.style.backgroundImage = url;
        if (sigilBackRefs.current[g]) sigilBackRefs.current[g]!.style.backgroundImage = url;
    }

    // 🖌️ Air-trail canvas — glowing light trail that follows the hand, so
    // waving/drawing in the air actually paints a shape (Doctor-Strange-ish).
    if (trailCanvasRef.current) {
        trailCanvasRef.current.width = window.innerWidth;
        trailCanvasRef.current.height = window.innerHeight;
        trailCtxRef.current = trailCanvasRef.current.getContext('2d');
    }
    trailPointsRef.current = [[], []];

    // 💃 Dance-reactive motion sensing — cheap frame-diff on a tiny downscaled
    // copy of the video, no extra AI model. Captures overall body/head motion
    // (not just hands) so the whole particle cloud sways/bounces with the user.
    const motionCanvas = document.createElement('canvas');
    motionCanvas.width = 32; motionCanvas.height = 24;
    const motionCtx = motionCanvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | null;
    let prevFrame: Uint8ClampedArray | null = null;
    let danceEnergy = 0;
    let swayX = 0, swayY = 0;

    // Particles
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const color = new THREE.Color();
    for (let i = 0; i < PARTICLE_COUNT * 3; i += 3) {
      positions[i] = (random() - 0.5) * 50; positions[i + 1] = (random() - 0.5) * 50; positions[i + 2] = (random() - 0.5) * 50;
      color.setHSL(random(), 0.8, 0.6); colors[i] = color.r; colors[i + 1] = color.g; colors[i + 2] = color.b;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const canvas = document.createElement('canvas'); canvas.width = 16; canvas.height = 16; const ctx = canvas.getContext('2d');
    if (ctx) { const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8); g.addColorStop(0, '#fff'); g.addColorStop(1, 'transparent'); ctx.fillStyle = g; ctx.fillRect(0, 0, 16, 16); }
    const texture = new THREE.CanvasTexture(canvas);

    const material = new THREE.PointsMaterial({ size: 0.5, map: texture, vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    const particles = new THREE.Points(geometry, material);
    scene.add(particles);
    particlesRef.current = particles;

    // Pointer / touch (non-camera)
    const handlePointer = (x: number, y: number) => {
        if (!(window as any).isCameraActive) {
            targetRotation.current.y = (x / window.innerWidth - 0.5) * 3;
            targetRotation.current.x = -(y / window.innerHeight - 0.5) * 3;
        }
    };
    const handleTap = () => { if (!(window as any).isCameraActive) updateShape((shapeIndexRef.current + 1) % SHAPES.length); };
    window.addEventListener('mousemove', (e) => handlePointer(e.clientX, e.clientY));
    window.addEventListener('touchmove', (e) => handlePointer(e.touches[0].clientX, e.touches[0].clientY));
    mountRef.current.addEventListener('click', handleTap); mountRef.current.addEventListener('touchstart', handleTap);

    let animationId: number;
    let time = 0;

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      time += 0.02;
      const isCam = (window as any).isCameraActive;
      let anyHandDetected = false;

      // Fade out magic circles by default each frame unless refreshed below
      for (let g = 0; g < 2; g++) {
          const fx = handFx.current[g];
          fx.open = false;
      }

      if (isCam && aiRef.current.landmarker && videoRef.current && videoRef.current.readyState >= 2) {
          try {
              const result = aiRef.current.landmarker.detectForVideo(videoRef.current, performance.now());
              const now = Date.now();

              result.landmarks.forEach((lm, handIdx) => {
                  if (handIdx > 1) return;
                  anyHandDetected = true;
                  const fx = handFx.current[handIdx];
                  const palm = lm[9];
                  const wrist = lm[0];

                  // Primary hand (0) drives rotation + zoom
                  if (handIdx === 0) {
                      targetRotation.current.y = (0.5 - palm.x) * 5;
                      targetRotation.current.x = (0.5 - palm.y) * 5;

                      const pinchDist = Math.hypot(lm[8].x - lm[4].x, lm[8].y - lm[4].y);
                      targetScale.current = 0.5 + pinchDist * 10;
                  }

                  // Open palm detection (fingers extended)
                  const isOpen = lm[8].y < lm[6].y && lm[12].y < lm[10].y && lm[16].y < lm[14].y && lm[20].y < lm[18].y;
                  fx.open = isOpen;

                  // Fist -> change spell
                  const isFist = lm[8].y > lm[6].y && lm[12].y > lm[10].y && lm[16].y > lm[14].y && lm[20].y > lm[18].y;
                  if (isFist && !fx.fistPrev && now - lastGestureTime.current > 900) {
                      lastGestureTime.current = now;
                      updateShape((shapeIndexRef.current + 1) % SHAPES.length);
                      flashSpell(SHAPES[shapeIndexRef.current].name);
                      vibrate(40);
                  }
                  fx.fistPrev = isFist;

                  // Push gesture: palm size (wrist->middle_mcp) growing fast = hand rushing toward camera
                  const palmSize = Math.hypot(lm[9].x - wrist.x, lm[9].y - wrist.y);
                  if (fx.prevPalmSize > 0 && palmSize - fx.prevPalmSize > 0.035 && now - fx.lastPushTime > 1200) {
                      fx.lastPushTime = now;
                      shockwaveRef.current = { active: true, start: performance.now() };
                      playSound('push'); vibrate(60);
                      flashSpell('Force Push');
                  }
                  fx.prevPalmSize = palmSize;

                  // Snap gesture: thumb+middle come together fast then apart
                  const tmDist = Math.hypot(lm[4].x - lm[12].x, lm[4].y - lm[12].y);
                  if (fx.prevPinchDist > 0.15 && tmDist < 0.06 && now - fx.lastSnapTime > 1500) {
                      fx.lastSnapTime = now;
                      snapBurstRef.current = { active: true, start: performance.now() };
                      playSound('snap'); vibrate([30, 30, 60]);
                      flashSpell('Snap!');
                  }
                  fx.prevPinchDist = tmDist;

                  // Raw screen-space target for this hand's magic circle (mirrored,
                  // like looking in a mirror — matches selfie-camera expectation)
                  fx.rawScreenX = (1 - palm.x) * window.innerWidth;
                  fx.rawScreenY = palm.y * window.innerHeight;
              });

              // Ultimate spell: both hands open and spread apart
              if (result.landmarks.length === 2 && handFx.current[0].open && handFx.current[1].open) {
                  const w0 = result.landmarks[0][0], w1 = result.landmarks[1][0];
                  const spread = Math.hypot(w0.x - w1.x, w0.y - w1.y);
                  if (spread > 0.55 && now - lastUltimateTime.current > 3000) {
                      lastUltimateTime.current = now;
                      triggerChaosInternal();
                      flashSpell('Multiverse Rift');
                  }
              }
          } catch (e) {}
      }

      // 💃 Dance-reactive body motion (runs whenever the camera is on, hands or
      // not — reacts to head shakes, swaying, full-body dancing).
      if (isCam && videoRef.current && videoRef.current.readyState >= 2 && motionCtx) {
          try {
              motionCtx.drawImage(videoRef.current, 0, 0, 32, 24);
              const frame = motionCtx.getImageData(0, 0, 32, 24).data;
              if (prevFrame) {
                  let totalDiff = 0, sumX = 0, sumY = 0, count = 0;
                  for (let py = 0; py < 24; py++) {
                      for (let px = 0; px < 32; px++) {
                          const idx = (py * 32 + px) * 4;
                          const d = Math.abs(frame[idx] - prevFrame[idx]) + Math.abs(frame[idx + 1] - prevFrame[idx + 1]) + Math.abs(frame[idx + 2] - prevFrame[idx + 2]);
                          if (d > 40) { totalDiff += d; sumX += px; sumY += py; count++; }
                      }
                  }
                  const energyRaw = Math.min(totalDiff / 12000, 1);
                  danceEnergy += (energyRaw - danceEnergy) * 0.15;
                  if (count > 8) {
                      const cx = (sumX / count) / 32 - 0.5;
                      const cy = (sumY / count) / 24 - 0.5;
                      swayX += (cx - swayX) * 0.12;
                      swayY += (cy - swayY) * 0.12;
                  } else { swayX *= 0.94; swayY *= 0.94; }
              }
              prevFrame = frame;
          } catch (e) {}
      } else {
          danceEnergy *= 0.9; swayX *= 0.9; swayY *= 0.9;
      }

      if (!anyHandDetected) { trailPointsRef.current[0] = []; trailPointsRef.current[1] = []; }

      // Update magic ring positions first (smoothed) — the trail below reuses
      // this same smoothed position, so the wave motion matches the ring
      // exactly instead of jittering from raw per-frame landmark noise.
      for (let g = 0; g < 2; g++) {
          const fx = handFx.current[g];
          const el = magicRingRefs.current[g];
          const posLerp = ringScreenPos.current[g];
          posLerp.x += (fx.rawScreenX - posLerp.x) * 0.35;
          posLerp.y += (fx.rawScreenY - posLerp.y) * 0.35;

          fx.scale += ((fx.open ? 1 : 0) - fx.scale) * 0.25;
          if (el) {
              if (fx.scale > 0.01) {
                  el.style.display = 'block';
                  el.style.opacity = String(Math.min(fx.scale, 1));
                  el.style.transform = `translate(${posLerp.x}px, ${posLerp.y}px) translate(-50%, -50%) scale(${0.4 + fx.scale * 0.6})`;
              } else {
                  el.style.display = 'none';
              }
          }

          // Cute soft wave trail — only while a hand is actually on screen and
          // moving, built from the smoothed position so it curves gently
          // instead of zig-zagging, and stays short so it never turns into a
          // scribble sitting on top of the shape.
          if (isCam && anyHandDetected) {
              const trailArr = trailPointsRef.current[g];
              const last = trailArr[trailArr.length - 1];
              if (!last || Math.hypot(posLerp.x - last.x, posLerp.y - last.y) > 3) {
                  trailArr.push({ x: posLerp.x, y: posLerp.y });
                  if (trailArr.length > 18) trailArr.shift();
              }
          }
      }

      // Fade + draw the wave trail — thin, soft, tapered (thicker/brighter at
      // the newest point, fading to nothing at the tail) so it reads as a
      // gentle glowing wave rather than a harsh straight line.
      if (trailCtxRef.current) {
          const tctx = trailCtxRef.current;
          tctx.globalCompositeOperation = 'destination-out';
          tctx.fillStyle = 'rgba(0,0,0,0.18)';
          tctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
          tctx.globalCompositeOperation = 'source-over';
          tctx.lineCap = 'round'; tctx.lineJoin = 'round';
          [0, 1].forEach((g) => {
              const pts = trailPointsRef.current[g];
              if (pts.length < 2) return;
              const glowColor = g === 0 ? '#ffb700' : '#00e5ff';
              tctx.shadowColor = glowColor;
              tctx.shadowBlur = 10;
              for (let i = 1; i < pts.length; i++) {
                  const t = i / pts.length; // 0 (oldest) -> 1 (newest)
                  tctx.globalAlpha = t * 0.45;
                  tctx.lineWidth = 0.8 + t * 2.2;
                  tctx.strokeStyle = glowColor;
                  tctx.beginPath();
                  tctx.moveTo(pts[i - 1].x, pts[i - 1].y);
                  tctx.lineTo(pts[i].x, pts[i].y);
                  tctx.stroke();
              }
          });
          tctx.globalAlpha = 1;
      }

      // Rotation with inertia/momentum
      const smoothing = 0.18;
      rotationVelocity.current.x += (targetRotation.current.x - currentRotation.current.x) * smoothing;
      rotationVelocity.current.y += (targetRotation.current.y - currentRotation.current.y) * smoothing;
      rotationVelocity.current.x *= 0.82;
      rotationVelocity.current.y *= 0.82;
      currentRotation.current.x += rotationVelocity.current.x;
      currentRotation.current.y += rotationVelocity.current.y;

      currentScale.current += (targetScale.current - currentScale.current) * 0.1;

      if (!anyHandDetected && !isCam) {
          targetRotation.current.y += 0.0; // no auto-drift target, but keep gentle spin via velocity
          rotationVelocity.current.y += 0.0006; // gentle auto rotate
          targetScale.current = 1;
      }

      particles.rotation.x = currentRotation.current.x + swayY * 1.4 + sin(time * 4) * danceEnergy * 0.04;
      particles.rotation.y = currentRotation.current.y + swayX * 1.4;
      const dancePulse = 1 + danceEnergy * 0.35;
      particles.scale.set(currentScale.current * dancePulse, currentScale.current * dancePulse, currentScale.current * dancePulse);

      const pos = particles.geometry.attributes.position.array as Float32Array;
      const col = particles.geometry.attributes.color.array as Float32Array;
      const chaos = (window as any).isChaosActive;

      const shockActive = shockwaveRef.current.active;
      const shockElapsed = shockActive ? (performance.now() - shockwaveRef.current.start) / 1000 : 0;
      if (shockActive && shockElapsed > 0.6) shockwaveRef.current.active = false;

      const snapActive = snapBurstRef.current.active;
      const snapElapsed = snapActive ? (performance.now() - snapBurstRef.current.start) / 1000 : 0;
      if (snapActive && snapElapsed > 0.5) snapBurstRef.current.active = false;

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const ix = i * 3;
        let tx = currentTargets[ix] || 0; let ty = currentTargets[ix + 1] || 0; let tz = currentTargets[ix + 2] || 0;

        if (chaos) {
            // Organic swirling chaos instead of pure random jitter
            const a = i * 0.017 + time * 2;
            const r = 20 + 25 * sin(i * 0.01 + time);
            tx = r * cos(a) + sin(time * 3 + i) * 10;
            ty = r * sin(a * 1.3) + cos(time * 2 + i) * 10;
            tz = 30 * sin(i * 0.021 + time * 1.5);
        }

        const speed = chaos ? 0.15 : 0.07;
        pos[ix] += (tx - pos[ix]) * speed;
        pos[ix + 1] += (ty - pos[ix + 1]) * speed;
        pos[ix + 2] += (tz - pos[ix + 2]) * speed;

        // Shockwave impulse (radial push)
        if (shockActive) {
            const dist = Math.hypot(pos[ix], pos[ix + 1], pos[ix + 2]) || 1;
            const force = (1 - shockElapsed / 0.6) * 0.6;
            pos[ix] += (pos[ix] / dist) * force;
            pos[ix + 1] += (pos[ix + 1] / dist) * force;
            pos[ix + 2] += (pos[ix + 2] / dist) * force;
        }

        // Snap disintegrate flicker (particles scatter briefly then reform)
        if (snapActive) {
            pos[ix] += (random() - 0.5) * (1 - snapElapsed / 0.5) * 2;
            pos[ix + 1] += (random() - 0.5) * (1 - snapElapsed / 0.5) * 2;
            pos[ix + 2] += (random() - 0.5) * (1 - snapElapsed / 0.5) * 2;
        }

        const hue = (time * 0.05 + i * 0.0001) % 1;
        const saturation = shapeName === "Eternal Love" ? 0.9 : 0.8;
        let lightness = (chaos ? 0.8 : 0.6) + danceEnergy * 0.15;
        color.setHSL(hue, saturation, lightness);

        if (shapeName === "Eternal Love" && random() > 0.7) color.setHSL(random() * 0.1 - 0.05, 1, 0.6);
        if ((shockActive || snapActive) && random() > 0.85) color.setHSL(0.12, 1, 0.65); // gold flash

        col[ix] = color.r; col[ix + 1] = color.g; col[ix + 2] = color.b;
      }
      particles.geometry.attributes.position.needsUpdate = true;
      particles.geometry.attributes.color.needsUpdate = true;
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight);
        if (trailCanvasRef.current) { trailCanvasRef.current.width = window.innerWidth; trailCanvasRef.current.height = window.innerHeight; }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      if (mountRef.current) mountRef.current.removeChild(renderer.domElement);
      if (aiRef.current.landmarker) aiRef.current.landmarker.close();
      if (videoRef.current && videoRef.current.srcObject) (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      (window as any).isCameraActive = false; (window as any).isChaosActive = false;
    };
  }, []);

  const triggerChaosInternal = () => {
      setIsChaos(true); (window as any).isChaosActive = true; playSound('chaos'); vibrate(80);
      setTimeout(() => { setIsChaos(false); (window as any).isChaosActive = false; updateShape(shapeIndexRef.current); }, 2000);
  };

  const toggleCamera = async (e: React.MouseEvent) => {
      e.stopPropagation();
      // Fallback: some browsers only allow requestFullscreen from a direct
      // click gesture, so retry it here if the auto-attempt on open failed.
      if (!document.fullscreenElement && rootRef.current?.requestFullscreen) {
          rootRef.current.requestFullscreen().catch(() => {});
      }
      if (cameraMode) {
          setCameraMode(false); (window as any).isCameraActive = false;
          if (videoRef.current && videoRef.current.srcObject) { (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop()); videoRef.current.srcObject = null; }
      } else {
          setIsLoadingAI(true);
          try {
              const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm");
              aiRef.current.landmarker = await HandLandmarker.createFromOptions(vision, {
                  baseOptions: { modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`, delegate: "GPU" },
                  runningMode: "VIDEO", numHands: 2
              });
              const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 640, height: 480 } });
              if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.onloadedmetadata = () => videoRef.current!.play(); }
              setCameraMode(true); (window as any).isCameraActive = true;
          } catch (err) { alert("Camera error. Permissions?"); }
          setIsLoadingAI(false);
      }
  };

  const triggerChaos = (e: React.MouseEvent) => { e.stopPropagation(); triggerChaosInternal(); flashSpell('Chaos Spell'); };

  return (
    <motion.div ref={rootRef} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] bg-black overflow-hidden font-sans">
      <div ref={mountRef} className="w-full h-full cursor-pointer touch-none" />
      <video ref={videoRef} className="hidden" playsInline muted></video>
      <canvas ref={trailCanvasRef} className="absolute inset-0 z-[44] pointer-events-none" />

      <style>{`
        @keyframes sigilSpinCW { from { transform: translate(-50%, -50%) rotate(0deg); } to { transform: translate(-50%, -50%) rotate(360deg); } }
        @keyframes sigilSpinCCW { from { transform: translate(-50%, -50%) rotate(0deg); } to { transform: translate(-50%, -50%) rotate(-360deg); } }
      `}</style>
      {/* Doctor-Strange-style magic circles — a screen-space overlay (not in the
          3D scene), so they track the hand 1:1 and never blend into the particles. */}
      {[0, 1].map((g) => (
          <div
              key={g}
              ref={(el) => { magicRingRefs.current[g] = el; }}
              className="absolute top-0 left-0 z-[45] pointer-events-none"
              style={{ display: 'none', width: 260, height: 260, willChange: 'transform, opacity' }}
          >
              <div
                  ref={(el) => { sigilFrontRefs.current[g] = el; }}
                  className="absolute inset-0"
                  style={{
                      backgroundSize: 'contain', backgroundRepeat: 'no-repeat',
                      animation: 'sigilSpinCW 7s linear infinite',
                      filter: `drop-shadow(0 0 14px ${g === 0 ? '#ffb700' : '#00e5ff'})`,
                  }}
              />
              <div
                  ref={(el) => { sigilBackRefs.current[g] = el; }}
                  className="absolute inset-0"
                  style={{
                      backgroundSize: 'contain', backgroundRepeat: 'no-repeat',
                      animation: 'sigilSpinCCW 5s linear infinite',
                      transform: 'scale(0.72)',
                      filter: `drop-shadow(0 0 10px ${g === 0 ? '#ffb700' : '#00e5ff'})`,
                  }}
              />
          </div>
      ))}
      <div className="absolute top-4 right-4 z-50"><button onClick={onClose} className="p-2 bg-white/10 rounded-full hover:bg-red-500/20 text-white transition-all"><X size={24} /></button></div>

      <div className="absolute top-6 left-6 z-40 pointer-events-none">
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#ffb700] via-[#ff00de] to-[#00ffff] flex items-center gap-3 drop-shadow-[0_0_10px_rgba(255,183,0,0.8)]">
              Mystic Flow {cameraMode && <span className="text-xs bg-amber-500 text-black px-2 py-1 rounded-full animate-pulse border border-white font-bold">SORCERER MODE</span>}
          </h1>
          <p className="text-cyan-200 text-lg font-bold mt-1 tracking-widest flex items-center gap-2">{shapeName === "Eternal Love" && <Heart fill="currentColor" size={18} className="text-pink-500 animate-pulse" />} {shapeName.toUpperCase()}</p>

          <AnimatePresence mode='wait'>
            {cameraMode ? (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 p-3 bg-black/60 border-l-4 border-[#ffb700] rounded backdrop-blur-md max-w-xs">
                    <p className="text-white text-sm font-bold mb-1 flex items-center gap-2"><Shield size={14} /> Sorcerer Gestures:</p>
                    <p className="text-gray-300 text-xs flex items-center gap-2 mt-1">🖐️ Open Palm = Summon Magic Circle</p>
                    <p className="text-gray-300 text-xs flex items-center gap-2 mt-1">✊ Fist = Cast New Spell (change shape)</p>
                    <p className="text-gray-300 text-xs flex items-center gap-2 mt-1">🤏 Pinch = Zoom In/Out</p>
                    <p className="text-gray-300 text-xs flex items-center gap-2 mt-1">👋 Push Hand Forward = Shockwave Blast</p>
                    <p className="text-gray-300 text-xs flex items-center gap-2 mt-1">🫰 Snap (thumb+middle) = Disintegrate</p>
                    <p className="text-gray-300 text-xs flex items-center gap-2 mt-1">🙌 Both Hands Open + Spread = Multiverse Rift</p>
                    <p className="text-gray-300 text-xs flex items-center gap-2 mt-1">✍️ Move Hand = Paints a Light Trail in the Air</p>
                    <p className="text-gray-300 text-xs flex items-center gap-2 mt-1">🕺 Dance / Sway / Nod = The Whole Cloud Moves With You</p>
                </motion.div>
            ) : (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-gray-400 text-xs mt-2 flex items-center gap-1"><Hand size={12} /> Swipe to rotate • Tap to change</motion.p>
            )}
          </AnimatePresence>
      </div>

      <AnimatePresence>
        {activeSpell && (
            <motion.div
                initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.3 }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none"
            >
                <span className="text-3xl md:text-5xl font-black text-amber-300 drop-shadow-[0_0_20px_rgba(255,183,0,0.9)] tracking-wider">{activeSpell.toUpperCase()}</span>
            </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute bottom-10 w-full flex flex-col items-center gap-6 z-50 pointer-events-none">
          {isLoadingAI && <div className="bg-black/80 border border-amber-400 px-6 py-3 rounded-full text-amber-300 font-bold text-sm flex items-center gap-3 shadow-[0_0_20px_#ffb700]"><Sparkles size={18} className="animate-spin" /> Opening the Sling Ring...</div>}
          <div className="flex gap-6 pointer-events-auto items-center">
            <button onClick={toggleCamera} className={`p-5 rounded-full transition-all duration-300 border-2 ${cameraMode ? "bg-gradient-to-tr from-amber-500 to-pink-600 border-white shadow-[0_0_30px_#ffb700] scale-110" : "bg-white/10 border-white/20 hover:bg-white/20 hover:scale-105"}`}>
                <Camera fill={cameraMode ? "white" : "none"} size={28} className={cameraMode ? "text-white" : "text-gray-300"} />
            </button>
            <button onClick={triggerChaos} className={`group relative flex items-center gap-3 px-10 py-5 rounded-full font-black text-white text-lg transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-[0_0_40px_rgba(0,255,255,0.4)] ${isChaos ? "bg-red-600 scale-110 ring-4 ring-red-400" : "bg-gradient-to-r from-[#ffb700] via-[#ff00de] to-[#00ffff] hover:shadow-[0_0_60px_rgba(255,0,222,0.6)]"}`}>
                <Zap fill="white" size={24} className={isChaos ? "animate-bounce" : "group-hover:rotate-12 transition-transform"} /> {isChaos ? "CASTING!!" : "CAST CHAOS SPELL"}
            </button>
          </div>
      </div>
    </motion.div>
  );
}