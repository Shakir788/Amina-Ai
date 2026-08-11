/** @type {import('next').NextConfig} */
const nextConfig = {
 output: process.env.BUILD_FOR_CAPACITOR ? 'export' : undefined,
  images: {
    unoptimized: true, 
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  }
};

export default nextConfig;