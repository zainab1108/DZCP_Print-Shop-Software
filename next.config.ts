import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Proof uploads (images/PDFs) go through a server action.
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
