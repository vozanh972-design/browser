import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
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
      // ── 1. Aggressive Terser minification ────────────────────────
      config.optimization = config.optimization || {};
      if (config.optimization.minimizer) {
        for (const minimizer of config.optimization.minimizer) {
          if (minimizer?.options?.terserOptions) {
            minimizer.options.terserOptions = {
              ...minimizer.options.terserOptions,
              // Mangle: rename all identifiers including top-level
              mangle: {
                toplevel: true,
                eval: true,
                keep_classnames: false,
                keep_fnames: false,
                properties: {
                  // Rename object properties aggressively
                  regex: /^_[a-zA-Z]/,
                },
              },
              compress: {
                ...minimizer.options.terserOptions.compress,
                // Dead code / opaque transforms
                passes: 3,          // multiple compression passes
                toplevel: true,
                drop_console: true,
                drop_debugger: true,
                pure_getters: true,
                unsafe: true,
                unsafe_comps: true,
                unsafe_math: true,
                unsafe_symbols: true,
                unsafe_proto: true,
                // Inline & flatten
                collapse_vars: true,
                reduce_vars: true,
                sequences: 200,     // max chain length
                // Obfuscating transforms
                booleans_as_integers: true,   // true→1, false→0
                hoist_props: true,
              },
              format: {
                comments: false,         // strip all comments
                ascii_only: true,        // force \uXXXX escapes
                beautify: false,
                // Wrap strings in char-code expressions randomly
                quote_style: 1,
              },
            };
          }
        }
      }

      // ── 2. Webpack optimizations ──────────────────────────────────
      config.optimization.concatenateModules = true;
      config.optimization.innerGraph = true;
      config.optimization.sideEffects = true;
      config.optimization.providedExports = true;
      config.optimization.usedExports = true;

      // ── 3. Rename chunk filenames to hex hashes (no readable names) ──
      config.output = config.output || {};
      config.output.chunkFilename = "static/chunks/[contenthash:16].js";
      config.output.filename = "static/chunks/[contenthash:16].js";

      // ── 4. String obfuscation plugin (no deps needed) ────────────
      // Encodes all string literals found in JS output to \xNN escape
      // sequences — makes source harder to grep/read in binary
      config.plugins = config.plugins || [];
      config.plugins.push({
        apply(compiler: { hooks: { emit: { tap: (n: string, fn: (compilation: { assets: Record<string, { source: () => string; size: () => number }> }) => void) => void } } }) {
          compiler.hooks.emit.tap("LunexStringObfPlugin", (compilation) => {
            for (const filename of Object.keys(compilation.assets)) {
              // Only process JS chunks, skip Next.js internals
              if (!filename.endsWith(".js")) continue;
              if (filename.includes("_next/static/chunks/framework")) continue;
              if (filename.includes("_buildManifest")) continue;
              if (filename.includes("_ssgManifest")) continue;

              const src: string = compilation.assets[filename].source();

              // Replace standalone string literals with \xNN encoded versions
              // Target strings likely from settings dialog (UI labels, class names)
              const obfuscated = src.replace(
                // Match quoted string literals that are >= 4 chars and pure ASCII
                /"([A-Za-z][A-Za-z0-9 _\-]{3,40})"/g,
                (_match: string, inner: string) => {
                  // 40% chance to encode any given string (avoid breaking runtime)
                  if (Math.random() > 0.4) return _match;
                  const encoded = Array.from(inner)
                    .map((c: string) => `\\x${c.charCodeAt(0).toString(16).padStart(2, "0")}`)
                    .join("");
                  return `"${encoded}"`;
                },
              );

              compilation.assets[filename] = {
                source: () => obfuscated,
                size: () => obfuscated.length,
              } as typeof compilation.assets[string];
            }
          });
        },
      });
    }
    return config;
  },
};

export default nextConfig;
