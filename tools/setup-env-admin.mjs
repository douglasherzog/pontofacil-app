import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { execSync } from "node:child_process";

const ROOT = process.cwd();
const ENV_PATH = path.join(ROOT, "apps", "admin", ".env.local");

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--url") out.url = argv[++i];
    if (a === "--anon") out.anon = argv[++i];
    if (a === "--service") out.service = argv[++i];
  }
  return out;
}

function parseEnvFile(contents) {
  const lines = contents.split(/\r?\n/);
  const map = new Map();
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1);
    map.set(key, value);
  }
  return map;
}

function serializeEnvFile(map) {
  const keys = Array.from(map.keys()).sort((a, b) => a.localeCompare(b));
  return keys.map((k) => `${k}=${map.get(k) ?? ""}`).join("\n") + "\n";
}

function createRl() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

function getClipboardText() {
  try {
    const out = execSync("powershell -NoProfile -Command Get-Clipboard", {
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    });
    return String(out ?? "").trim();
  } catch {
    return "";
  }
}

function extractSupabaseUrl(text) {
  const m = text.match(/https:\/\/[a-z0-9-]+\.supabase\.co/);
  return m?.[0];
}

async function askWithDefault(rl, label, def) {
  const shown = def ? ` [${def}]` : "";
  const v = (await ask(rl, `${label}:${shown} `)).trim();
  return v || def || "";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const existing = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf8") : "";
  const map = parseEnvFile(existing);

  const clipboard = getClipboardText();
  const clipUrl = extractSupabaseUrl(clipboard);

  const defaultUrl =
    args.url ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    map.get("NEXT_PUBLIC_SUPABASE_URL") ||
    clipUrl ||
    "";
  const defaultAnon =
    args.anon ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    map.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") ||
    "";
  const defaultService =
    args.service ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    map.get("SUPABASE_SERVICE_ROLE_KEY") ||
    "";

  const rl = createRl();
  try {
    const supabaseUrl = await askWithDefault(rl, "NEXT_PUBLIC_SUPABASE_URL", defaultUrl);
    const anonKey = await askWithDefault(rl, "NEXT_PUBLIC_SUPABASE_ANON_KEY", defaultAnon);
    const serviceKey = await askWithDefault(rl, "SUPABASE_SERVICE_ROLE_KEY (opcional)", defaultService);

    if (!supabaseUrl || !anonKey) {
      throw new Error("Valores vazios: preencha URL e ANON KEY.");
    }

    map.set("NEXT_PUBLIC_SUPABASE_URL", supabaseUrl);
    map.set("NEXT_PUBLIC_SUPABASE_ANON_KEY", anonKey);
    if (serviceKey) {
      map.set("SUPABASE_SERVICE_ROLE_KEY", serviceKey);
    }

    fs.mkdirSync(path.dirname(ENV_PATH), { recursive: true });
    fs.writeFileSync(ENV_PATH, serializeEnvFile(map), "utf8");

    console.log(`\n✅ Criado/atualizado: ${ENV_PATH}`);
    console.log("⚠️  Não commite esse arquivo. Ele é local por segurança.\n");
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error("\n❌ Falha ao gerar .env.local:");
  console.error(err?.message ?? err);
  process.exit(1);
});
