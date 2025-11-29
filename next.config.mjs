/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // 👈 Ye line jaroori hai double messages rokne ke liye
  experimental: {
    serverComponentsExternalPackages: ["msedge-tts", "edge-tts", "ws", "bufferutil", "utf-8-validate"],
  },
};

export default nextConfig;