import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const docsDir = join(root, "docs");
const manualDir = join(docsDir, "manual");
const outPdf = join(docsDir, "Manual-PontoFacil.pdf");
const tmpMd = join(docsDir, "_manual.tmp.md");

const files = [
  "00-visao-geral.md",
  "10-instalacao.md",
  "20-rodando-local.md",
  "30-arquitetura.md",
  "40-api.md",
  "50-admin.md",
  "70-troubleshooting.md",
];

mkdirSync(docsDir, { recursive: true });

for (const f of files) {
  const p = join(manualDir, f);
  if (!existsSync(p)) {
    console.error(`Arquivo não encontrado: ${p}`);
    process.exit(1);
  }
}

const combined = files.map((f) => readFileSync(join(manualDir, f), "utf-8")).join("\n\n---\n\n");
writeFileSync(tmpMd, combined, "utf-8");

const result = spawnSync(
  "pandoc",
  [tmpMd, "-o", outPdf, "--pdf-engine=xelatex"],
  { stdio: "inherit" }
);

if (result.error) {
  console.error("Falha ao executar pandoc. Verifique se o Pandoc está instalado e no PATH.");
  process.exit(1);
}

if (typeof result.status === "number" && result.status !== 0) {
  process.exit(result.status);
}

console.log(`PDF gerado em: ${outPdf}`);
