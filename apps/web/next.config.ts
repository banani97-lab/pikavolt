import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Compile the internal workspace packages from TypeScript source. Their
  // exports point at ./src, so no separate build step is needed — this is what
  // lets a fresh Vercel clone build without the gitignored dist/ output.
  transpilePackages: ["@pikavolt/core", "@pikavolt/config"],
  webpack: (config) => {
    // The shared packages use TS/ESM `.js` import specifiers that resolve to
    // `.ts` source (correct for tsc, but webpack needs to be told). Without
    // this, transpiling their source fails with "Can't resolve './x.js'".
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
      ...config.resolve.extensionAlias,
    };
    return config;
  },
};

export default nextConfig;
