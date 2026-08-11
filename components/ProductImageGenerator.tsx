"use client";

// components/ProductImageGenerator.tsx
//
// Simple enough for a non-technical shop owner to run day-to-day:
// 1. Drop in a product photo
// 2. Tap the poses/looks wanted (or type a custom one)
// 3. Generate — download whichever shots work

import { useState, useRef } from "react";

const PRESET_POSES = [
  { label: "Studio front", prompt: "standing straight, facing camera, plain white studio background" },
  { label: "Walking", prompt: "mid-stride walking pose, candid street-style background, soft daylight" },
  { label: "Side angle", prompt: "3/4 side angle pose, plain neutral background" },
  { label: "Seated", prompt: "seated on a stool, relaxed pose, minimal studio background" },
  { label: "Outdoor", prompt: "outdoor lifestyle setting, natural sunlight, blurred background" },
];

type ResultImage = { dataUrl: string };

export default function ProductImageGenerator() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedPoses, setSelectedPoses] = useState<string[]>([PRESET_POSES[0].prompt]);
  const [customPose, setCustomPose] = useState("");
  const [modelType, setModelType] = useState("female model");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ResultImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(f: File | null) {
    setFile(f);
    setResults([]);
    setError(null);
    if (f) setPreviewUrl(URL.createObjectURL(f));
    else setPreviewUrl(null);
  }

  function togglePose(prompt: string) {
    setSelectedPoses((prev) =>
      prev.includes(prompt) ? prev.filter((p) => p !== prompt) : [...prev, prompt]
    );
  }

  function addCustomPose() {
    const trimmed = customPose.trim();
    if (trimmed && !selectedPoses.includes(trimmed)) {
      setSelectedPoses((prev) => [...prev, trimmed]);
      setCustomPose("");
    }
  }

  async function handleGenerate() {
    if (!file) {
      setError("Pehle ek product photo upload karein.");
      return;
    }
    if (selectedPoses.length === 0) {
      setError("Kam se kam ek pose select karein.");
      return;
    }
    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("poses", JSON.stringify(selectedPoses));
      formData.append("modelType", modelType);

      const res = await fetch("/api/product-image", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Generation failed.");
      setResults(data.images || []);
    } catch (e: any) {
      setError(e.message || "Kuch galat ho gaya. Dobara try karein.");
    } finally {
      setLoading(false);
    }
  }

  function downloadImage(dataUrl: string, index: number) {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `amina-product-shot-${index + 1}.png`;
    a.click();
  }

  return (
    <div className="min-h-screen bg-[#faf7f2] text-[#1c1a17]">
      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=Inter:wght@400;500;600&display=swap");
        .font-display { font-family: "Fraunces", serif; }
        .font-body { font-family: "Inter", sans-serif; }
      `}</style>

      <div className="max-w-5xl mx-auto px-6 py-10 font-body">
        <header className="mb-8 border-b border-[#e6ddd0] pb-6">
          <p className="text-xs tracking-[0.2em] uppercase text-[#a8895f] mb-1">Amina Studio</p>
          <h1 className="font-display text-3xl md:text-4xl font-semibold">
            Product photo → model shot
          </h1>
          <p className="text-sm text-[#6b6255] mt-2">
            Ek garment photo daalein, pose chunein, aur seconds mein e-commerce-ready shots paayein.
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Left: upload + controls */}
          <div className="space-y-6">
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-[#6b6255]">
                Product photo
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 border-2 border-dashed border-[#d8cdb9] rounded-lg h-56 flex items-center justify-center cursor-pointer bg-white hover:border-[#a8895f] transition-colors overflow-hidden"
              >
                {previewUrl ? (
                  <img src={previewUrl} alt="preview" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-sm text-[#a39a8c]">Click to upload (jpg/png)</span>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              />
            </div>

            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-[#6b6255]">
                Model type
              </label>
              <select
                value={modelType}
                onChange={(e) => setModelType(e.target.value)}
                className="mt-2 w-full border border-[#d8cdb9] rounded-md px-3 py-2 bg-white text-sm"
              >
                <option value="female model">Female model</option>
                <option value="male model">Male model</option>
                <option value="plus-size model">Plus-size model</option>
                <option value="petite model">Petite model</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-[#6b6255]">
                Poses / looks
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {PRESET_POSES.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => togglePose(p.prompt)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      selectedPoses.includes(p.prompt)
                        ? "bg-[#1c1a17] text-white border-[#1c1a17]"
                        : "bg-white text-[#6b6255] border-[#d8cdb9] hover:border-[#a8895f]"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  value={customPose}
                  onChange={(e) => setCustomPose(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCustomPose()}
                  placeholder="Custom pose likhein... e.g. running on beach"
                  className="flex-1 border border-[#d8cdb9] rounded-md px-3 py-2 bg-white text-sm"
                />
                <button
                  onClick={addCustomPose}
                  className="px-3 py-2 text-sm rounded-md border border-[#d8cdb9] bg-white hover:border-[#a8895f]"
                >
                  Add
                </button>
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full py-3 rounded-md bg-[#a8895f] text-white text-sm font-medium tracking-wide hover:bg-[#8f7350] disabled:opacity-50 transition-colors"
            >
              {loading ? "Generate ho raha hai..." : `Generate ${selectedPoses.length || ""} shot(s)`}
            </button>
          </div>

          {/* Right: results */}
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-[#6b6255]">
              Results
            </label>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {results.length === 0 && !loading && (
                <div className="col-span-2 h-56 flex items-center justify-center text-sm text-[#a39a8c] border border-dashed border-[#e6ddd0] rounded-lg">
                  Generated shots yahan dikhenge
                </div>
              )}
              {loading && (
                <div className="col-span-2 h-56 flex items-center justify-center text-sm text-[#a39a8c] border border-dashed border-[#e6ddd0] rounded-lg animate-pulse">
                  Bana rahe hain...
                </div>
              )}
              {results.map((r, i) => (
                <div key={i} className="relative group border border-[#e6ddd0] rounded-lg overflow-hidden bg-white">
                  <img src={r.dataUrl} alt={`shot-${i}`} className="w-full h-56 object-cover" />
                  <button
                    onClick={() => downloadImage(r.dataUrl, i)}
                    className="absolute bottom-2 right-2 text-xs bg-[#1c1a17]/85 text-white px-3 py-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Download
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}