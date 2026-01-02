import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const docRelativePath = path.join("docs", "manual", "README.md");
const docPath = path.join(repoRoot, docRelativePath);

function printHeader(title) {
  process.stdout.write(`\n${title}\n`);
  process.stdout.write(`${"-".repeat(title.length)}\n`);
}

function tryOpen(targetPath) {
  const platform = process.platform;

  if (platform === "win32") {
    return spawnSync("cmd", ["/c", "start", "", targetPath], { stdio: "ignore" }).status === 0;
  }

  if (platform === "darwin") {
    return spawnSync("open", [targetPath], { stdio: "ignore" }).status === 0;
  }

  return spawnSync("xdg-open", [targetPath], { stdio: "ignore" }).status === 0;
}

printHeader("PontoFácil - Onboarding");

process.stdout.write("Checklist rápido:\n");
process.stdout.write("- Leia a documentação viva em docs/manual/README.md\n");
process.stdout.write("- Admin (Next.js): pnpm --filter admin dev\n");
process.stdout.write("- API (FastAPI): veja README.md (setup venv + uvicorn)\n");
process.stdout.write("\n");

if (!existsSync(docPath)) {
  process.stderr.write(`Não encontrei o arquivo de doc: ${docRelativePath}\n`);
  process.stderr.write("Abra manualmente a partir do README.md na raiz do repo.\n");
  process.exitCode = 1;
} else {
  printHeader("Documentação");
  process.stdout.write(`Doc principal: ${docRelativePath}\n`);

  const opened = tryOpen(docPath);
  if (!opened) {
    process.stdout.write("\nNão consegui abrir automaticamente no seu sistema. Abra manualmente:\n");
    process.stdout.write(`${docRelativePath}\n`);
  }
}
