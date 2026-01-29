import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com', // Google User Images
      },
      {
        protocol: 'https',
        hostname: 'googleusercontent.com',     // Fallback
      }
    ],
  },
};

export default nextConfig;