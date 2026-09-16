import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  productionBrowserSourceMaps: false,
  images: {
    unoptimized: true,
  },
  distDir: "dist",
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  turbopack: {},
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      config.optimization = config.optimization || {};
      if (config.optimization.minimizer) {
        for (const minimizer of config.optimization.minimizer) {
          if (minimizer?.options?.terserOptions) {
            minimizer.options.terserOptions.mangle = {
              toplevel: true,
            };
            minimizer.options.terserOptions.format = {
              comments: false,
            };
          }
        }
      }
    }
    return config;
  },
};

export default nextConfig;
