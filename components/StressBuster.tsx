"use client";

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { X, Sparkles, Zap, Camera, Hand, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

// --- 🎵 AUDIO ENGINE ---
const playSound = (type: 'change' | 'love' | 'chaos') => {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;

    if (type === 'change') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(600, now); 
        gain.gain.setValueAtTime(0.1, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 1);
    } else if (type === 'love') {
        // Special sound for love shape
        osc.type = 'triangle'; osc.frequency.setValueAtTime(400, now); osc.frequency.linearRampToValueAtTime(600, now+0.5);
        gain.gain.setValueAtTime(0.15, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 2);
    } else {
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, now);
        gain.gain.setValueAtTime(0.3, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    }
    osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(now + 2);
};

// --- 🌌 EXTENSIVE SHAPE LIBRARY ---
const PARTICLE_COUNT = 4000;
const sin = Math.sin, cos = Math.cos, PI = Math.PI, random = Math.random;

const SHAPES = [
    { name: "Magic Sphere", fn: (i:number) => { const r=7, t=random()*PI*2, p=Math.acos(2*random()-1); return [r*sin(p)*cos(t), r*sin(p)*sin(t), r*cos(p)]; } },
    // 🔥 NEW: Eternal Love (Couple Shape representation) 🔥
    { name: "Eternal Love", fn: (i:number) => { 
        const t = random() * PI * 2;
        // Heart 1 (Left)
        const x1 = 16*Math.pow(sin(t),3) - 8; const y1 = 13*cos(t)-5*cos(2*t)-2*cos(3*t)-cos(4*t);
        // Heart 2 (Right & intertwining)
        const x2 = 16*Math.pow(sin(t),3) + 8; const y2 = 13*cos(t)-5*cos(2*t)-2*cos(3*t)-cos(4*t);
        // Mix them based on index
        if (i % 2 === 0) return [x1*0.3, y1*0.3, (random()-0.5)*4];
        return [x2*0.3, y2*0.3, (random()-0.5)*4];
    }},
    { name: "Galaxy Spiral", fn: (i:number) => { const a=i*0.05, r=i*0.004; return [r*8*cos(a), (random()-0.5)*3, r*8*sin(a)]; } },
    { name: "DNA Helix", fn: (i:number) => { const t=i*0.1; return [sin(t)*3, (i/PARTICLE_COUNT)*20-10, cos(t)*3]; } },
    { name: "Saturn Ring", fn: (i:number) => { if(i<PARTICLE_COUNT*0.2) return [4*sin(random()*PI*2)*cos(random()*PI), 4*sin(random()*PI*2)*sin(random()*PI), 4*cos(random()*PI*2)]; const a=random()*PI*2, r=8+random()*3; return [r*cos(a), 0.3*(random()-0.5), r*sin(a)]; } },
    { name: "Hourglass", fn: (i:number) => { const t=random()*PI*2, h=(random()-0.5)*12, r=Math.abs(h)*0.8+0.5; return [r*cos(t), h, r*sin(t)]; } },
    { name: "StarBurst", fn: (i:number) => { const r=random()*15, t=random()*PI*2, p=random()*PI; return [r*sin(p)*cos(t), r*sin(p)*sin(t), r*cos(p)]; } },
];

const getShapePositions = (index: number) => {
    const fn = SHAPES[index].fn;
    const targets = [];
    for(let i=0; i<PARTICLE_COUNT; i++) { const pos = fn(i); targets.push(pos[0], pos[1], pos[2]); }
    return targets;
};
let currentTargets: number[] = [];

export default function StressBuster({ onClose }: { onClose: () => void }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [shapeName, setShapeName] = useState("Magic Sphere");
  const [isChaos, setIsChaos] = useState(false);
  const [cameraMode, setCameraMode] = useState(false);
  const [isLoadingAI, setIsLoadingAI] = useState(false);

  const aiRef = useRef<{ landmarker: HandLandmarker | null }>({ landmarker: null });
  const particlesRef = useRef<THREE.Points | null>(null);
  const shapeIndexRef = useRef(0);
  const lastGestureTime = useRef(0);
  
  // 🔥 New Refs for smoother control 🔥
  const targetRotation = useRef({ x: 0, y: 0 });
  const currentRotation = useRef({ x: 0, y: 0 });
  const targetScale = useRef(1);
  const currentScale = useRef(1);

  const updateShape = (index: number) => {
      shapeIndexRef.current = index;
      setShapeName(SHAPES[index].name);
      currentTargets = getShapePositions(index);
      // Play special sound for Love shape
      playSound(SHAPES[index].name === "Eternal Love" ? 'love' : 'change');
  };

  useEffect(() => {
    if (!mountRef.current) return;
    currentTargets = getShapePositions(0);

    // 1. THREE.JS SETUP
    const scene = new THREE.Scene();
    // Add subtle lighting to make shapes look 3D
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(0xff00de, 1, 100);
    pointLight.position.set(10, 10, 10);
    scene.add(pointLight);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.z = 20; // Moved camera back slightly for zoom space

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountRef.current.appendChild(renderer.domElement);

    // 2. PARTICLES
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const color = new THREE.Color();
    for (let i = 0; i < PARTICLE_COUNT * 3; i += 3) {
      positions[i] = (random() - 0.5) * 50; positions[i+1] = (random() - 0.5) * 50; positions[i+2] = (random() - 0.5) * 50;
      color.setHSL(random(), 0.8, 0.6); colors[i] = color.r; colors[i+1] = color.g; colors[i+2] = color.b;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Use a simpler, faster particle texture
    const canvas = document.createElement('canvas'); canvas.width=16; canvas.height=16; const ctx=canvas.getContext('2d');
    if(ctx){ const g=ctx.createRadialGradient(8,8,0,8,8,8); g.addColorStop(0,'#fff'); g.addColorStop(1,'transparent'); ctx.fillStyle=g; ctx.fillRect(0,0,16,16); }
    const texture = new THREE.CanvasTexture(canvas);

    const material = new THREE.PointsMaterial({ size: 0.5, map: texture, vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    const particles = new THREE.Points(geometry, material);
    scene.add(particles);
    particlesRef.current = particles;

    // 3. INPUT HANDLERS
    const handlePointer = (x: number, y: number) => {
        if(!(window as any).isCameraActive) {
            targetRotation.current.y = (x / window.innerWidth - 0.5) * 3;
            targetRotation.current.x = -(y / window.innerHeight - 0.5) * 3;
        }
    };
    const handleTap = () => { if(!(window as any).isCameraActive) updateShape((shapeIndexRef.current + 1) % SHAPES.length); };
    window.addEventListener('mousemove', (e) => handlePointer(e.clientX, e.clientY));
    window.addEventListener('touchmove', (e) => handlePointer(e.touches[0].clientX, e.touches[0].clientY));
    mountRef.current.addEventListener('click', handleTap); mountRef.current.addEventListener('touchstart', handleTap);

    // 4. ANIMATION LOOP
    let animationId: number;
    let time = 0;
    
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      time += 0.02;
      const isCam = (window as any).isCameraActive;
      let isHandDetected = false;

      // --- AI LOGIC (Every Frame for max speed) ---
      if (isCam && aiRef.current.landmarker && videoRef.current && videoRef.current.readyState >= 2) {
          try {
              const result = aiRef.current.landmarker.detectForVideo(videoRef.current, performance.now());
              if (result.landmarks.length > 0) {
                  isHandDetected = true;
                  const lm = result.landmarks[0];
                  const palm = lm[9];
                  
                  // 🔥 1. SUPER FAST ROTATION (High multiplier & smoothing)
                  // Invert X for mirror effect. Multiplier 5 makes it very sensitive to movement.
                  targetRotation.current.y = (0.5 - palm.x) * 5; 
                  targetRotation.current.x = (0.5 - palm.y) * 5;

                  // 🔥 2. PINCH TO ZOOM (Distance between Index tip & Thumb tip)
                  const pinchDist = Math.sqrt(Math.pow(lm[8].x-lm[4].x,2) + Math.pow(lm[8].y-lm[4].y,2));
                  // Map pinch distance (approx 0.02 to 0.2) to Scale (0.5 to 2.5)
                  // Closer pinch = smaller scale. Wider pinch = bigger scale.
                  targetScale.current = 0.5 + (pinchDist * 10); // Adjust multipliers to taste

                  // 🔥 3. FIST GESTURE (Change Shape)
                  const isFist = lm[8].y > lm[6].y && lm[12].y > lm[10].y && lm[16].y > lm[14].y && lm[20].y > lm[18].y;
                  if (isFist && Date.now() - lastGestureTime.current > 1000) {
                      lastGestureTime.current = Date.now();
                      updateShape((shapeIndexRef.current + 1) % SHAPES.length);
                  }
              }
          } catch (e) {}
      }

      // --- PHYSICS UPDATE ---
      // 🔥 SMOOTHING: Increased from 0.05 to 0.25 for very fast response
      const smoothing = 0.25; 
      currentRotation.current.x += (targetRotation.current.x - currentRotation.current.x) * smoothing;
      currentRotation.current.y += (targetRotation.current.y - currentRotation.current.y) * smoothing;
      
      // 🔥 ZOOM SMOOTHING
      currentScale.current += (targetScale.current - currentScale.current) * 0.1;

      if (!isHandDetected && !isCam) {
          currentRotation.current.y += 0.003; // Auto rotate if no input
          targetScale.current = 1; // Reset zoom
      }

      particles.rotation.x = currentRotation.current.x;
      particles.rotation.y = currentRotation.current.y;
      // Apply zoom scale
      particles.scale.set(currentScale.current, currentScale.current, currentScale.current);

      const pos = particles.geometry.attributes.position.array as Float32Array;
      const col = particles.geometry.attributes.color.array as Float32Array;
      const chaos = (window as any).isChaosActive;

      for(let i=0; i<PARTICLE_COUNT; i++) {
        const ix = i * 3;
        let tx = currentTargets[ix] || 0; let ty = currentTargets[ix+1] || 0; let tz = currentTargets[ix+2] || 0;
        if (chaos) { tx = (random()-0.5)*150; ty = (random()-0.5)*150; tz = (random()-0.5)*150; }
        
        // Morph speed
        const speed = chaos ? 0.2 : 0.07;
        pos[ix] += (tx - pos[ix]) * speed;
        pos[ix+1] += (ty - pos[ix+1]) * speed;
        pos[ix+2] += (tz - pos[ix+2]) * speed;
        
        // Color Shift
        const hue = (time*0.05 + i*0.0001) % 1;
        // If Love shape, tend towards pink/red colors
        const saturation = shapeName === "Eternal Love" ? 0.9 : 0.8;
        const lightness = chaos ? 0.8 : 0.6;
        color.setHSL(hue, saturation, lightness);
        
        // If Love shape, force reddish hues periodically
        if(shapeName === "Eternal Love" && random() > 0.7) color.setHSL(random()*0.1 - 0.05, 1, 0.6);

        col[ix] = color.r; col[ix+1] = color.g; col[ix+2] = color.b;
      }
      particles.geometry.attributes.position.needsUpdate = true;
      particles.geometry.attributes.color.needsUpdate = true;
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      if(mountRef.current) mountRef.current.removeChild(renderer.domElement);
      if(aiRef.current.landmarker) aiRef.current.landmarker.close();
      if(videoRef.current && videoRef.current.srcObject) (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      (window as any).isCameraActive = false; (window as any).isChaosActive = false;
    };
  }, []);

  const toggleCamera = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (cameraMode) {
          setCameraMode(false); (window as any).isCameraActive = false;
          if(videoRef.current && videoRef.current.srcObject) { (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop()); videoRef.current.srcObject = null; }
      } else {
          setIsLoadingAI(true);
          try {
              const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm");
              aiRef.current.landmarker = await HandLandmarker.createFromOptions(vision, {
                  baseOptions: { modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`, delegate: "GPU" },
                  runningMode: "VIDEO", numHands: 1
              });
              const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 320, height: 240 } });
              if(videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.onloadedmetadata = () => videoRef.current!.play(); }
              setCameraMode(true); (window as any).isCameraActive = true;
          } catch (err) { alert("Camera error. Permissions?"); }
          setIsLoadingAI(false);
      }
  };

  const triggerChaos = (e: React.MouseEvent) => {
      e.stopPropagation(); setIsChaos(true); (window as any).isChaosActive = true; playSound('chaos');
      setTimeout(() => { setIsChaos(false); (window as any).isChaosActive = false; updateShape(shapeIndexRef.current); }, 2000);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] bg-black overflow-hidden font-sans">
      <div ref={mountRef} className="w-full h-full cursor-pointer touch-none" />
      <video ref={videoRef} className="hidden" playsInline muted></video>
      <div className="absolute top-4 right-4 z-50"><button onClick={onClose} className="p-2 bg-white/10 rounded-full hover:bg-red-500/20 text-white transition-all"><X size={24} /></button></div>
      <div className="absolute top-6 left-6 z-40 pointer-events-none">
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#ff00de] to-[#00ffff] flex items-center gap-3 drop-shadow-[0_0_10px_rgba(255,0,222,0.8)]">
              Dream Flow {cameraMode && <span className="text-xs bg-pink-600 text-white px-2 py-1 rounded-full animate-pulse border border-white">LIVE MAGIC</span>}
          </h1>
          <p className="text-cyan-200 text-lg font-bold mt-1 tracking-widest flex items-center gap-2">{shapeName === "Eternal Love" && <Heart fill="currentColor" size={18} className="text-pink-500 animate-pulse"/>} {shapeName.toUpperCase()}</p>
          <AnimatePresence mode='wait'>
            {cameraMode ? (
                <motion.div initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} className="mt-4 p-3 bg-black/60 border-l-4 border-[#ff00de] rounded backdrop-blur-md max-w-xs">
                    <p className="text-white text-sm font-bold mb-1">🧙‍♀️ Magician Controls:</p>
                    <p className="text-gray-300 text-xs flex items-center gap-2"><Hand size={14}/> Move Fast = Fast Rotation</p>
                    <p className="text-gray-300 text-xs flex items-center gap-2 mt-1">🤏 Pinch Fingers = ZOOM In/Out</p>
                    <p className="text-gray-300 text-xs flex items-center gap-2 mt-1">✊ Make Fist = Change Shape</p>
                </motion.div>
            ) : (
                <motion.p initial={{opacity:0}} animate={{opacity:1}} className="text-gray-400 text-xs mt-2 flex items-center gap-1"><Hand size={12}/> Swipe to rotate • Tap to change</motion.p>
            )}
          </AnimatePresence>
      </div>
      <div className="absolute bottom-10 w-full flex flex-col items-center gap-6 z-50 pointer-events-none">
          {isLoadingAI && <div className="bg-black/80 border border-pink-500 px-6 py-3 rounded-full text-pink-300 font-bold text-sm flex items-center gap-3 shadow-[0_0_20px_#ff00de]"><Sparkles size={18} className="animate-spin"/> Summoning AI Spirit...</div>}
          <div className="flex gap-6 pointer-events-auto items-center">
            <button onClick={toggleCamera} className={`p-5 rounded-full transition-all duration-300 border-2 ${cameraMode ? "bg-gradient-to-tr from-pink-600 to-purple-600 border-white shadow-[0_0_30px_#ff00de] scale-110" : "bg-white/10 border-white/20 hover:bg-white/20 hover:scale-105"}`}>
                <Camera fill={cameraMode ? "white" : "none"} size={28} className={cameraMode ? "text-white" : "text-gray-300"} />
            </button>
            <button onClick={triggerChaos} className={`group relative flex items-center gap-3 px-10 py-5 rounded-full font-black text-white text-lg transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-[0_0_40px_rgba(0,255,255,0.4)] ${isChaos ? "bg-red-600 scale-110 ring-4 ring-red-400" : "bg-gradient-to-r from-[#00ffff] to-[#ff00de] hover:shadow-[0_0_60px_rgba(255,0,222,0.6)]"}`}>
                <Zap fill="white" size={24} className={isChaos ? "animate-bounce" : "group-hover:rotate-12 transition-transform"} /> {isChaos ? "EXPLODING!!" : "STRESS BUSTER"}
            </button>
          </div>
      </div>
    </motion.div>
  );
}