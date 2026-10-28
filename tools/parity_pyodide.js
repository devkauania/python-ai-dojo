// Paridade verify ↔ navegador: roda TODOS os exercícios Python no Pyodide REAL
// (mesmo PyBridge/worker do jogo) — a solução de referência tem de dar "ok" e o
// starter_code NÃO pode dar "ok" (anti-trivialidade, igual ao tools/verify.py).
//
// Uso (com o jogo servido em http://localhost:8321 — ver run.bat / tools/serve.py):
//   npm install
//   node tools/parity_pyodide.js            # tudo
//   node tools/parity_pyodide.js ato4       # filtra por prefixo de id
//   DOJO_LANG=en node tools/parity_pyodide.js   # conteúdo content/en + runner em inglês
const { chromium } = require("playwright-core");

const BASE = process.env.DOJO_URL || "http://localhost:8321";
const FILTRO = process.argv[2] || "";
const LANG = process.env.DOJO_LANG === "en" ? "en" : "pt";

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await (await browser.newContext()).newPage();
  const erros = [];
  page.on("pageerror", (e) => erros.push(`[pageerror] ${e.message}`));
  await page.goto(BASE + "/?lang=" + LANG, { waitUntil: "domcontentloaded" });
  if (LANG !== "pt") console.log("Idioma:", LANG);

  const resultado = await page.evaluate(async ([filtro, lang]) => {
    const { definirIdioma } = await import("/js/i18n.js");
    definirIdioma(lang); // antes do worker: init e payloads levam o idioma
    const { carregarConteudo } = await import("/js/content.js");
    const { PyBridge } = await import("/js/pybridge.js");
    const c = await carregarConteudo(lang);
    const bridge = new PyBridge();
    await bridge.iniciar();
    const rodar = async (ex, codigo) => {
      if (ex.pacotes?.length) await bridge.garantirPacotes(ex.pacotes);
      const r = await bridge.executar({
        codigo,
        testes_visiveis: ex.testes_visiveis,
        testes_ocultos: ex.testes_ocultos,
        mocks: ex.mocks || [],
        arquivos: ex.arquivos || {},
        timeout_s: ex.timeout_s || (ex.pacotes?.length ? 15 : 5),
        lang,
      });
      return r.status;
    };
    const saida = [];
    for (const ex of c.porId.values()) {
      if (ex.trilha === "web" || !ex.solucao_referencia) continue;
      if (filtro && !ex.id.startsWith(filtro)) continue;
      const sol = await rodar(ex, ex.solucao_referencia);
      const starter = await rodar(ex, ex.starter_code || "");
      saida.push({ id: ex.id, sol, starter });
    }
    return saida;
  }, [FILTRO, LANG]);

  let falhas = 0;
  for (const r of resultado) {
    const ok = r.sol === "ok" && r.starter !== "ok";
    if (!ok) {
      falhas++;
      console.log(`FALHOU ${r.id}: solução=${r.sol} starter=${r.starter}`);
    }
  }
  for (const e of erros) console.log(e);
  console.log(`\nPyodide: ${resultado.length - falhas}/${resultado.length} verdes`);
  await browser.close();
  process.exit(falhas || erros.length || !resultado.length ? 1 : 0);
})();
