import type { NextConfig } from "next";

// ============================================================
// DECEPTION MATRIX — 15 languages, regenerated every build
// Injected as dead-code into every JS chunk to confuse RE tools
// ============================================================
function buildDeceptionMatrix(): string {
  // LCG PRNG seeded by build timestamp — different every build
  let seed = Date.now() ^ 0xdeadbeef;
  const lcg = () => {
    seed = (Math.imul(1664525, seed) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };
  const pick = <T>(arr: T[]): T => arr[Math.floor(lcg() * arr.length)];
  const hex = (n: number) => n.toString(16).padStart(2, "0");
  const rndHex = (len: number) =>
    Array.from({ length: len }, () => hex(Math.floor(lcg() * 256))).join("");

  // ── Fake data pools (15 languages + technical decoys) ────────
  const fakeApis = [
    // Vietnamese
    "https://api.viettel.vn/v2/auth/token",
    "https://gateway.vnpay.vn/paygate/pay/confirm",
    "https://api.momo.vn/v3/wallet/verify",
    "https://openapi.zalopay.vn/v2/order/query",
    // English
    "https://auth.internal.corp/api/v4/session",
    "https://license.enterprise.io/api/check",
    "https://telemetry.analytics.net/v1/events",
    "https://cdn.assets.global/api/v2/verify",
    // Chinese
    "https://api.weixin.qq.com/sns/oauth2/access_token",
    "https://openapi.alipay.com/gateway.do/verify",
    "https://api.baidu.com/oauth/2.0/token",
    // Russian
    "https://api.yandex.ru/v3/auth/validate",
    "https://payment.sberbank.ru/api/register",
    // Korean
    "https://openapi.kakao.com/v2/user/me",
    "https://nid.naver.com/oauth2.0/token",
    // Japanese
    "https://api.line.me/oauth2/v2.1/token",
    "https://api.rakuten.co.jp/v2/auth/verify",
    // Arabic / Middle East
    "https://api.stcpay.com.sa/v1/payment/verify",
    // German
    "https://api.deutschetelekom.de/v3/auth/check",
    // French
    "https://api.orange.fr/oauth/v3/token",
    // Spanish
    "https://api.mercadopago.com/v1/payments/verify",
    // Portuguese
    "https://api.picpay.com/v1/payments/status",
    // Hindi / India
    "https://api.paytm.com/v2/txnstatus/validateTxn",
    // Thai
    "https://api.promptpay.io/v1/verify/qr",
    // Turkish
    "https://api.garanti.com.tr/v3/auth/validate",
    // Italian
    "https://api.satispay.com/v1/payment-updates",
  ];

  const fakeKeys = [
    `sk-live-${rndHex(16)}-${rndHex(8)}`,
    `pk_live_${rndHex(24)}`,
    `AKIA${rndHex(10).toUpperCase()}${rndHex(6).toUpperCase()}`,
    `xoxb-${Math.floor(lcg() * 9e9)}-${rndHex(12)}`,
    `ghp_${rndHex(20)}`,
    `eyJhbGciOiJSUzI1NiJ9.${rndHex(32)}.${rndHex(16)}`,
    `Bearer ${rndHex(24)}-${rndHex(8)}`,
    `Basic ${btoa(`admin:${rndHex(12)}`)}`,
    `AIza${rndHex(19)}`,
    `ya29.${rndHex(28)}`,
  ];

  const fakeTokens = [
    `lnx_${rndHex(8)}_${rndHex(4)}_${rndHex(4)}_${rndHex(12)}`,
    `sess_${rndHex(20)}`,
    `csrf_${rndHex(16)}`,
    `jwt_${rndHex(24)}`,
    `auth_${rndHex(18)}`,
  ];

  const fakeEndpoints = [
    "/api/v3/internal/validate",
    "/gateway/payment/confirm",
    "/oauth2/callback/token",
    "/webhook/events/receive",
    "/admin/license/generate",
    "/v2/users/verify/hwid",
    "/api/keys/activate",
    "/internal/telemetry/ping",
  ];

  const fakeClasses = [
    "LicenseManager", "AuthProvider", "TokenValidator",
    "PaymentGateway", "SessionHandler", "CryptoEngine",
    "KeyDerivationFunction", "SecureStorage", "HmacVerifier",
    "AntiTamperGuard", "ObfuscationLayer", "SignatureChecker",
  ];

  const fakeErrors = [
    "ERR_AUTH_FAILED: invalid signature detected",
    "WARN: license mismatch — device fingerprint changed",
    "CRITICAL: tamper detection triggered",
    "ERROR: HMAC verification failed — possible MITM",
    "SECURITY: debugger attachment detected",
    "FATAL: integrity check failed at module load",
  ];

  // ── Build shuffled matrix (different order every build) ──────
  const entries: string[] = [];
  const varNames: string[] = [];

  for (let i = 0; i < 8; i++) {
    const vn = `_${rndHex(2)}x${i.toString(16)}`;
    varNames.push(vn);
    const type = Math.floor(lcg() * 5);
    let val: string;
    if (type === 0) val = JSON.stringify(pick(fakeApis));
    else if (type === 1) val = JSON.stringify(pick(fakeKeys));
    else if (type === 2) val = JSON.stringify(pick(fakeTokens));
    else if (type === 3) val = JSON.stringify(pick(fakeEndpoints));
    else val = JSON.stringify(pick(fakeErrors));
    entries.push(`var ${vn}=${val}`);
  }

  // XOR-chained fake class (mimics real code structure)
  const cls = pick(fakeClasses);
  const method = pick(["validate", "verify", "check", "authenticate", "activate"]);
  const fakeClassCode = `var ${cls}={${method}:function(k){return k===void 0?!1:k.length>0}};`;

  // Fake IIFE that looks like initialization logic
  const iife = `(function(){var _cfg={url:${JSON.stringify(pick(fakeApis))},key:${JSON.stringify(pick(fakeKeys))},timeout:${Math.floor(lcg() * 30000 + 5000)}};void _cfg;})();`;

  // Wrap everything in a never-executed dead-code block
  const body = [...entries, fakeClassCode, iife].join(";");
  return `if(typeof __LUNEX_DEAD__!=="undefined"){${body}}`;
}

type WebpackCompiler = {
  hooks: {
    emit: {
      tap: (
        name: string,
        fn: (compilation: {
          assets: Record<string, { source: () => string; size: () => number }>;
        }) => void,
      ) => void;
    };
  };
};

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
              mangle: {
                toplevel: true,
                eval: true,
                keep_classnames: false,
                keep_fnames: false,
                properties: {
                  regex: /^_[a-zA-Z]/,
                },
              },
              compress: {
                ...minimizer.options.terserOptions.compress,
                passes: 3,
                toplevel: true,
                drop_console: true,
                drop_debugger: true,
                pure_getters: true,
                unsafe: true,
                unsafe_comps: true,
                unsafe_math: true,
                unsafe_symbols: true,
                unsafe_proto: true,
                collapse_vars: true,
                reduce_vars: true,
                sequences: 200,
                booleans_as_integers: true,
                hoist_props: true,
              },
              format: {
                comments: false,
                ascii_only: true,
                beautify: false,
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

      // ── 3. Rename chunk filenames to hex hashes ───────────────────
      config.output = config.output || {};
      config.output.chunkFilename = "static/chunks/[contenthash:16].js";
      config.output.filename = "static/chunks/[contenthash:16].js";

      // ── 4. Deception Matrix + String Obfuscation Plugin ──────────
      // Injects 15-language dead-code decoy matrix into every JS chunk
      // + encodes string literals to \xNN hex sequences
      config.plugins = config.plugins || [];
      config.plugins.push({
        apply(compiler: WebpackCompiler) {
          compiler.hooks.emit.tap("LunexDeceptionPlugin", (compilation) => {
            // Build one matrix per compilation (same per build, different builds)
            const matrix = buildDeceptionMatrix();

            for (const filename of Object.keys(compilation.assets)) {
              if (!filename.endsWith(".js")) continue;
              if (filename.includes("framework")) continue;
              if (filename.includes("_buildManifest")) continue;
              if (filename.includes("_ssgManifest")) continue;

              const src: string = compilation.assets[filename].source();

              // Step A: Inject deception matrix at the top of each chunk
              let processed = `${matrix};${src}`;

              // Step B: Encode string literals to \xNN
              processed = processed.replace(
                /"([A-Za-z][A-Za-z0-9 _\-]{3,40})"/g,
                (_match: string, inner: string) => {
                  if (Math.random() > 0.4) return _match;
                  const encoded = Array.from(inner)
                    .map((c: string) =>
                      `\\x${c.charCodeAt(0).toString(16).padStart(2, "0")}`,
                    )
                    .join("");
                  return `"${encoded}"`;
                },
              );

              compilation.assets[filename] = {
                source: () => processed,
                size: () => processed.length,
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
