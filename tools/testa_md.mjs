// Roda o md() REAL do ui.js sobre TODO o conteúdo e detecta HTML corrompido.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TMP = path.join(process.env.TEMP || ".", "md-test-" + Date.now());
fs.mkdirSync(TMP, { recursive: true });

// stub dos imports do ui.js (só queremos md/esc)
let src = fs.readFileSync(path.join(RAIZ, "js/ui.js"), "utf8");
src = src.replace(/^import[\s\S]*?from\s+["'][^"']+["'];?$/gm, "");
src = "const t = (k) => k;\nconst glossario = () => ({});\nconst engine = {};\nconst exerciciosDe = () => [];\n" +
  "const ICONE_NIVEL='',ICONE_CADEADO='',ICONE_GRAFICO='',ICONE_LAB='',ICONE_ALVO='',ICONE_FAIXA_MODO='',ICONE_RAIO='',ICONE_CHECK='',ICONE_CONFIG='',ICONE_SETA_DIR='',AVATAR_CUBO='';\n" +
  "const iconeFaixa=()=> '';\nconst cuboPlataforma=()=> '';\nconst cuboSvg=()=> '';\n" + src;
const arq = path.join(TMP, "ui-teste.mjs");
fs.writeFileSync(arq, src, "utf8");
const { md } = await import("file://" + arq.replace(/\\/g, "/"));

// verificador de aninhamento: <code>/<strong>/<em> bem formados?
function corrompido(html) {
  const pilha = [];
  const re = /<(\/?)(code|strong|em|span|pre|p|ul|li|h3|br)\b[^>]*>/g;
  let m;
  while ((m = re.exec(html))) {
    const [, fecha, tag] = m;
    if (tag === "br") continue;
    if (!fecha) pilha.push(tag);
    else {
      if (pilha.length === 0) return `fecha ${tag} sem abrir`;
      const topo = pilha.pop();
      if (topo !== tag) return `esperava </${topo}> veio </${tag}>`;
    }
  }
  if (pilha.length) return "não fechou: " + pilha.join(",");
  return null;
}

const problemas = [];
function checar(id, campo, texto) {
  if (typeof texto !== "string" || !texto) return;
  const html = md(texto);
  const err = corrompido(html);
  // asterisco literal dentro de code que sumiu do html
  const codesFonte = [...texto.matchAll(/`([^`\n]+)`/g)].map((x) => x[1]);
  const escapar = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const perdidos = codesFonte.filter((c) => c.includes("*") && !html.includes(escapar(c)));
  if (err || perdidos.length) {
    problemas.push({ id, campo, err, perdidos, amostra: html.slice(0, 220) });
  }
}

function varrer(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) { varrer(p); continue; }
    if (!f.endsWith(".json")) continue;
    let d;
    try { d = JSON.parse(fs.readFileSync(p, "utf8")); } catch { continue; }
    const exs = Array.isArray(d) ? d : (d.exercicios || d.web || []);
    if (!Array.isArray(exs)) continue;
    for (const ex of exs) {
      if (!ex || typeof ex !== "object") continue;
      checar(ex.id, "enunciado", ex.enunciado_md);
      checar(ex.id, "explicacao", ex.explicacao_md);
      (ex.dicas || []).forEach((dc, i) => checar(ex.id, "dica" + (i + 1), dc));
    }
  }
}
varrer(path.join(RAIZ, "content"));

console.log("=== CAMPOS COM HTML CORROMPIDO / ASTERISCO PERDIDO:", problemas.length, "===");
for (const p of problemas) {
  console.log(`\n[${p.id}] ${p.campo}`);
  if (p.err) console.log("  nesting:", p.err);
  if (p.perdidos.length) console.log("  code perdido:", JSON.stringify(p.perdidos));
  console.log("  html:", p.amostra.replace(/\n/g, " "));
}
fs.rmSync(TMP, { recursive: true, force: true });
