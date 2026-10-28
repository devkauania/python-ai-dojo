// Harness web 30/30: para CADA exercício do Lab, roda os testes_web com o
// webrunner REAL do jogo — a solução tem de PASSAR e o starter tem de FALHAR.
const { chromium } = require("playwright-core");
const BASE = "http://localhost:8321";

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await (await browser.newContext()).newPage();
  const erros = [];
  page.on("pageerror", (e) => erros.push(`[pageerror] ${e.message}`));
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#btn-comecar", { timeout: 40000 });

  const resultado = await page.evaluate(async () => {
    const { carregarConteudo } = await import("/js/content.js");
    const webrunner = await import("/js/webrunner.js");
    const c = await carregarConteudo();
    const saida = [];
    for (const ex of c.webLab) {
      const sol = {};
      const start = {};
      for (const t of ["html", "css", "js"]) {
        const base = ex["web_" + t] ?? "";
        start[t] = base;
        sol[t] = (ex.editaveis || ["js"]).includes(t)
          ? (ex["solucao_" + t] ?? base) : base;
      }
      let okSol = false, okStart = false, erro = null;
      try {
        const r1 = await webrunner.rodarTestesWeb(sol, ex.testes_web);
        okSol = r1.status === "ok";
        const r2 = await webrunner.rodarTestesWeb(start, ex.testes_web);
        okStart = r2.status === "ok";
      } catch (e) { erro = String(e); }
      saida.push({ id: ex.id, okSol, startFalha: !okStart, erro });
    }
    return saida;
  });

  let verdes = 0;
  for (const r of resultado) {
    const ok = r.okSol && r.startFalha && !r.erro;
    if (ok) verdes++;
    else console.log("FALHA", r.id, "solucaoPassa=", r.okSol, "starterFalha=", r.startFalha, r.erro || "");
  }
  console.log(`\n=== WEB ${verdes}/${resultado.length} (solução passa E starter falha) ===`);
  console.log("erros de página:", erros.length);
  await browser.close();
  process.exit(verdes === resultado.length && erros.length === 0 ? 0 : 1);
})().catch((e) => { console.error("ABORTOU:", e); process.exit(2); });
