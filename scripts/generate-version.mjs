import fs from "node:fs";

const packageJson = JSON.parse(fs.readFileSync("./package.json", "utf-8"));
const version = packageJson.version || "1.0.2";

const versionData = {
  version: version,
  min_version: version,
  force_update: true,
  download_url:
    "https://raw.githubusercontent.com/theanh39/lunexexe/main/AutoLunex.exe",
  title: `Yêu cầu cập nhật AutoLunex v${version}`,
  message: `Đã có bản cập nhật mới v${version}. Hệ thống sẽ tự động tải ngầm và cập nhật.`,
  release_notes: [
    `Bản cập nhật AutoLunex phiên bản v${version}`,
    "Tối ưu hóa hiệu suất và nâng cao tính ổn định",
    "Bắt buộc cập nhật để đồng bộ toàn bộ tính năng",
  ],
};

const jsonStr = `${JSON.stringify(versionData, null, 2)}\n`;

fs.writeFileSync("./version.json", jsonStr, "utf-8");

if (!fs.existsSync("./public")) {
  fs.mkdirSync("./public", { recursive: true });
}
fs.writeFileSync("./public/version.json", jsonStr, "utf-8");

console.log(`[Version Builder] Generated version.json for v${version}`);
