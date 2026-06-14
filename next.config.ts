import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.clerk.com",
      },
    ],
  },
  allowedDevOrigins: ["10.187.159.181", "10.70.225.181",'unregained-ledgy-charmaine.ngrok-free.dev',],
};

export default nextConfig;
