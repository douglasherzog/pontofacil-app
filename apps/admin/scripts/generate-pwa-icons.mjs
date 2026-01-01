import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const adminRoot = path.resolve(__dirname, "..");
const publicDir = path.join(adminRoot, "public");

const srcSvg = path.join(publicDir, "ponto-facil-icon.svg");
const out192 = path.join(publicDir, "icon-192.png");
const out512 = path.join(publicDir, "icon-512.png");

async function ensureExists(filePath) {
  try {
    await fs.access(filePath);
  } catch {
    throw new Error(`Arquivo não encontrado: ${filePath}`);
  }
}

async function main() {
  await ensureExists(srcSvg);

  const svg = await fs.readFile(srcSvg);

  await sharp(svg, { density: 384 })
    .resize(192, 192)
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(out192);

  await sharp(svg, { density: 384 })
    .resize(512, 512)
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(out512);

  console.log("OK: ícones gerados:");
  console.log(`- ${out192}`);
  console.log(`- ${out512}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
