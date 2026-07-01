import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@xenova/transformers",
    "chromadb",
    "simple-git",
  ],
}

export default nextConfig
