import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const XRAY_VERSION = "v26.3.27";
export const XRAY_SOURCE_URL = `https://github.com/XTLS/Xray-core/tree/${XRAY_VERSION}`;
export const XRAY_LICENSE_FILE = "xray-LICENSE.txt";

export const XRAY_ASSETS = {
  "aarch64-apple-darwin": {
    name: "Xray-macos-arm64-v8a.zip",
    sha256: "2e93a67e8aa1936ecefb307e120830fcbd4c643ab9b1c46a2d0838d5f8409eaf",
  },
  "x86_64-apple-darwin": {
    name: "Xray-macos-64.zip",
    sha256: "f5b0471d3459eff1b82e48af0aeac186abcc3298210070afbbbd8437a4e8b203",
  },
  "x86_64-unknown-linux-gnu": {
    name: "Xray-linux-64.zip",
    sha256: "23cd9af937744d97776ee35ecad4972cf4b2109d1e0fe6be9930467608f7c8ae",
  },
  "aarch64-unknown-linux-gnu": {
    name: "Xray-linux-arm64-v8a.zip",
    sha256: "4d30283ae614e3057f730f67cd088a42be6fdf91f8639d82cb69e48cde80413c",
  },
  "x86_64-pc-windows-msvc": {
    name: "Xray-windows-64.zip",
    sha256: "d004c39288ce9ada487c6f398c7c545f7d749e44bdfdd59dbc9f865afba4e1ad",
  },
};

export function requestedTarget() {
  const targetIndex = process.argv.indexOf("--target");
  if (targetIndex !== -1 && process.argv[targetIndex + 1]) {
    return process.argv[targetIndex + 1];
  }
  if (process.env.TARGET) {
    return process.env.TARGET;
  }

  const result = spawnSync("rustc", ["-vV"], { encoding: "utf8" });
  const match = result.stdout?.match(/^host:\s*(.+)$/m);
  if (!match) {
    throw new Error("Unable to determine the Rust target");
  }
  return match[1].trim();
}

export function xrayBinaryName(target) {
  return `xray-${target}${target.includes("windows") ? ".exe" : ""}`;
}

export function xrayDownloadUrl(assetName) {
  return `https://github.com/XTLS/Xray-core/releases/download/${XRAY_VERSION}/${assetName}`;
}

// `powershell -Command "<script>" a b` appends the trailing values to the
// command text rather than binding them to $args, so the script ran with a
// null -LiteralPath. Handing the paths over as environment variables binds
// them for real and sidesteps quoting of Windows paths and spaces.
export function windowsExtractionInvocation(archive, destinationDir) {
  return {
    args: [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "Expand-Archive -LiteralPath $env:DONUT_XRAY_ARCHIVE -DestinationPath $env:DONUT_XRAY_DESTINATION -Force",
    ],
    env: {
      ...process.env,
      DONUT_XRAY_ARCHIVE: archive,
      DONUT_XRAY_DESTINATION: destinationDir,
    },
  };
}

export async function downloadXray(target = requestedTarget()) {
  const asset = XRAY_ASSETS[target];
  if (!asset) {
    throw new Error(`Xray-core is not packaged for Rust target '${target}'`);
  }
  return "";
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  downloadXray().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
