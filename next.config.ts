import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse and mammoth use Node.js APIs — must run in Node.js runtime, not edge
  serverExternalPackages: ["pdf-parse", "mammoth"],
};

export default nextConfig;
