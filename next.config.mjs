/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Note: Naam 'serverComponentsExternalPackages' hai yahan
    serverComponentsExternalPackages: ["msedge-tts", "edge-tts", "ws", "bufferutil", "utf-8-validate"],
  },
};

export default nextConfig;