import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // unpdf and mammoth use Node.js APIs — must run in Node.js runtime, not edge
  serverExternalPackages: ["unpdf", "mammoth"],
};

export default nextConfig;
