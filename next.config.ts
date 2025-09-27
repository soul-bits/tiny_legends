import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    reactCompiler: false,
  },
  compiler: {
    // Disable React compiler to avoid compatibility issues
    removeConsole: false,
  },
};

export default nextConfig;
