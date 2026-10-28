// Fluxos PROFUNDOS dos exercícios (forense r9) — Chrome real, cliques reais.
// Cobre o que o harness feliz (verifica_r8) não cobre: dicas com re-render,
// solução (modais aninhados), pular, próximo em cadeia, teclado virtual
// (shift/caps/backspace), web restaurar, Enter global, config (escuro/reduzir),
// rota direta e Tab físico no editor.
const { chromium } = require("playwright-core");
const fs = require("fs");
const path = require("path");

const BASE = "http://localhost:8321";
const SHOTS = process.env.DOJO_SHOTS || path.join(require("os").tmpdir(), "dojo-shots");
fs.mkdirSync(SHOTS, { recursive: true });

const erros = [];
const falhas = [];
function checar(cond, msg) {
  if (cond) console.log("  ok:", msg);
  else { falhas.push(msg); console.log("  FALHOU:", msg); }
}

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 950 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => erros.push(`[pageerror] ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") erros.push(`[console] ${m.text()}`); });

  const sol = async () => page.evaluate(async () => {
    const { carregarConteudo } = await import("/js/content.js");
    const c = await carregarConteudo();
    return c.porId.get(location.hash.slice(5)).solucao_referencia;
  });

  // ---- boot ----
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#btn-comecar", { timeout: 30000 });
  await page.click("#btn-comecar");
  await page.waitForSelector(".no[data-slug]", { timeout: 15000 });

  // ---- 1. abre ex1, espera Python ----
  await page.click(".no[data-slug]:not([disabled])");
  await page.waitForSelector("#editor", { timeout: 10000 });
  const ex1 = await page.evaluate(() => location.hash);
  console.log("ex1:", ex1);
  await page.waitForSelector("#btn-rodar:not([disabled])", { timeout: 240000 });

  // ---- 2. teclado virtual: shift one-shot, caps, backspace ----
  console.log("[teclado]");
  await page.click("#editor");
  await page.evaluate(() => { const e = document.getElementById("editor"); e.value = ""; e.dispatchEvent(new Event("input")); });
  await page.click('.vk-tecla[data-code="KeyA"]');
  await page.click('.vk-tecla[data-code="ShiftLeft"]');
  await page.click('.vk-tecla[data-code="Digit1"]');   // shift one-shot -> !
  await page.click('.vk-tecla[data-code="Digit1"]');   // shift consumido -> 1
  await page.click('.vk-tecla[data-code="CapsLock"]');
  await page.click('.vk-tecla[data-code="KeyB"]');     // caps -> B
  await page.click('.vk-tecla[data-code="KeyB"]');     // caps continua -> B
  await page.click('.vk-tecla[data-code="CapsLock"]');
  await page.click('.vk-tecla[data-code="KeyC"]');     // volta -> c
  await page.click('.vk-tecla[data-code="Backspace"]');// apaga o c
  await page.click('.vk-tecla[data-code="Backslash"]');
  const digitado = await page.inputValue("#editor");
  checar(digitado === "a!1BB\\", `vk digitou "a!1BB\\" (veio ${JSON.stringify(digitado)})`);

  // Tab físico no editor = 4 espaços
  await page.evaluate(() => { const e = document.getElementById("editor"); e.value = ""; e.dispatchEvent(new Event("input")); e.focus(); });
  await page.keyboard.press("Tab");
  checar((await page.inputValue("#editor")) === "    ", "Tab físico inseriu 4 espaços");

  // ---- 3. dicas com re-render preservando estado ----
  console.log("[dicas]");
  await page.evaluate((s) => { const e = document.getElementById("editor"); e.value = s; e.dispatchEvent(new Event("input")); }, "MARCADOR_DO_DONO");
  await page.click("#btn-dica-1");
  await page.waitForSelector(".janela-tutor .tutor-retrato", { timeout: 8000 });
  checar((await page.inputValue("#editor")) === "MARCADOR_DO_DONO", "editor preservado após dica 1");
  checar(await page.$(".vk-slot #teclado-virtual") !== null, "teclado continua acoplado após dica 1");
  const s1 = await sol();
  await page.fill("#editor", s1);
  await page.click("#btn-rodar");
  await page.waitForSelector(".res-ok", { timeout: 120000 });
  const tempos1 = await page.$$eval(".tempo-caixa", (els) => els.length);
  checar(tempos1 === 1, `1 tempo-caixa após verde (veio ${tempos1})`);
  await page.click("#btn-dica-2");
  await page.waitForTimeout(500);
  checar(await page.$(".res-ok") !== null, "resultado verde restaurado após dica 2");
  checar(!(await page.$eval("#btn-proximo", (b) => b.classList.contains("oculto"))), "btn-proximo visível após dica 2");
  const tempos2 = await page.$$eval(".tempo-caixa", (els) => els.length);
  checar(tempos2 === 1, `tempo-caixa não duplicou após dica 2 (veio ${tempos2})`);

  // ---- 3b. correções da forense r9 ----
  console.log("[forense]");
  // md(): asteriscos dentro de code preservados (12 telas afetadas)
  const mdOk = await page.evaluate(async () => {
    const { md } = await import("/js/ui.js");
    const a = md("Escreva `log_parametros(**params)` que aceita **qualquer** conjunto");
    const b = md('Use `re.search(r"```json\\s*(.*?)```", texto)`; depois valide');
    const c = md("espera `base * (2 ** tentativa)` a cada falha");
    return { a, b, c };
  });
  checar(mdOk.a.includes("<code>log_parametros(**params)</code>") && mdOk.a.includes("<strong>qualquer</strong>"),
    "md: **kwargs preservado + negrito correto");
  checar(mdOk.b.includes("```json") && !mdOk.b.includes("<pre"), "md: cerca dentro de code inline preservada");
  checar(mdOk.c.includes("<code>base * (2 ** tentativa)</code>"), "md: backoff exponencial preservado");
  // Tab dispara input (preview web/undo)
  const tabAvisa = await page.evaluate(() => {
    const e = document.getElementById("editor");
    e.value = ""; e.focus();
    let vezes = 0;
    const h = () => vezes++;
    e.addEventListener("input", h);
    e.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
    e.removeEventListener("input", h);
    return { vezes, valor: e.value };
  });
  checar(tabAvisa.vezes >= 1 && tabAvisa.valor === "    ", "Tab do editor dispara evento input");
  // glossário mede contra a tela da TV
  const glosOk = await page.evaluate(() => {
    const t = document.getElementById("tv-scroll");
    return !!t && getComputedStyle(t).overflowY === "auto";
  });
  checar(glosOk, "#tv-scroll é o contêiner de clipping (base do flip do glossário)");
  // teclas virtuais fora da ordem de Tab
  const semTab = await page.$$eval(".vk-tecla", (els) => els.every((e) => e.tabIndex === -1));
  checar(semTab, "teclas virtuais não são paradas de Tab");
  // Enter/Espaço ativa a tecla (clique sintético)
  const ativaPorTeclado = await page.evaluate(() => {
    const e = document.getElementById("editor");
    e.value = ""; e.focus();
    document.querySelector('.vk-tecla[data-code="KeyZ"]').click(); // detail 0
    return e.value;
  });
  checar(ativaPorTeclado === "z", `tecla ativa por Enter/Espaço (veio ${JSON.stringify(ativaPorTeclado)})`);

  // ---- 4. próximo em cadeia ----
  console.log("[proximo]");
  await page.click("#btn-proximo");
  await page.waitForSelector("#editor", { timeout: 10000 });
  const ex2 = await page.evaluate(() => location.hash);
  checar(ex2 !== ex1, `avançou p/ outro exercício (${ex2})`);
  checar((await page.$$eval(".resultados > *", (e) => e.length)) === 0, "resultados limpos no ex2");
  checar(await page.$eval("#btn-proximo", (b) => b.classList.contains("oculto")), "btn-proximo oculto no ex2");
  checar(await page.$(".vk-slot #teclado-virtual") !== null, "teclado acoplado no ex2");

  // ---- 5. ver solução (modais aninhados) ----
  console.log("[solucao]");
  await page.click("#btn-solucao");
  await page.waitForSelector("#btn-modal-confirmar", { timeout: 8000 });
  await page.click("#btn-modal-confirmar");
  await page.waitForSelector("#btn-modal-fechar", { timeout: 8000 });
  await page.click("#btn-modal-fechar");
  await page.waitForTimeout(300);
  checar(await page.$("#modal-raiz") === null, "modais fecharam");
  checar(!(await page.$eval("#btn-proximo", (b) => b.classList.contains("oculto"))), "btn-proximo visível após ver solução");

  // ---- 6. Enter global avança ----
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.keyboard.press("Enter");
  await page.waitForTimeout(600);
  const ex3 = await page.evaluate(() => location.hash);
  checar(ex3 !== ex2, `Enter global avançou (${ex3})`);

  // ---- 7. pular ----
  await page.waitForSelector("#btn-pular", { timeout: 8000 });
  await page.click("#btn-pular");
  await page.waitForTimeout(700);
  const ex4 = await page.evaluate(() => location.hash);
  checar(ex4 !== ex3, `pular avançou (${ex4})`);

  // ---- 8. web: digitar, restaurar, rodar, próximo ----
  console.log("[web]");
  await page.click('.hdr a[href="#/web"]');
  await page.waitForSelector(".nivel[data-webid]", { timeout: 10000 });
  await page.click(".nivel[data-webid]");
  await page.waitForSelector("#web-preview", { timeout: 10000 });
  const webId1 = await page.evaluate(() => location.hash);
  const edAlvo = await page.$$eval(".web-editor", (els) => els[0].id);
  await page.click("#" + edAlvo);
  await page.evaluate((id) => { const e = document.getElementById(id); e.value = "LIXO"; e.dispatchEvent(new Event("input")); }, edAlvo);
  await page.click(`[data-restaurar]`);
  const valRest = await page.inputValue("#" + edAlvo);
  checar(valRest !== "LIXO", "restaurar limpou o lixo digitado");
  const okWeb = await page.evaluate(async () => {
    const { carregarConteudo } = await import("/js/content.js");
    const c = await carregarConteudo();
    const ex = c.porId.get(location.hash.slice(8));
    for (const t of ex.editaveis || ["js"]) {
      const el = document.getElementById("web-ed-" + t);
      if (el) { el.value = ex["solucao_" + t] ?? ex["web_" + t] ?? ""; el.dispatchEvent(new Event("input")); }
    }
    return true;
  });
  checar(okWeb, "solução web preenchida");
  await page.click("#btn-rodar");
  await page.waitForSelector(".res-ok", { timeout: 30000 });
  await page.click("#btn-proximo");
  await page.waitForTimeout(700);
  const webId2 = await page.evaluate(() => location.hash);
  checar(webId2 !== webId1 && webId2.startsWith("#/webex/"), `próximo web avançou (${webId2})`);
  checar(await page.$(".vk-slot #teclado-virtual") !== null, "teclado acoplado no web ex2");

  // ---- 9. config: escuro + reduzir (cursor devolve nativo) ----
  console.log("[config]");
  await page.click("#btn-config");
  await page.waitForSelector("#sel-tema", { timeout: 8000 });
  await page.selectOption("#sel-tema", "escuro");
  checar(await page.$eval(":root", (r) => r.hasAttribute("data-escuro")), "tema escuro aplicou");
  await page.click("#chk-reduz + .trilho");
  await page.waitForTimeout(300);
  checar(await page.$("#cursor-os") === null, "reduzir animações devolveu cursor nativo");
  await page.click("#chk-reduz + .trilho");
  await page.waitForTimeout(300);
  checar(await page.$("#cursor-os") !== null, "cursor custom voltou");
  await page.selectOption("#sel-tema", "claro");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  checar(await page.$("#modal-raiz") === null, "Esc fechou config");

  // ---- 10. rota direta + toggle do teclado persistido ----
  console.log("[rotas]");
  await page.evaluate((h) => { location.hash = h; }, ex1);
  await page.waitForSelector("#editor", { timeout: 10000 });
  checar(true, "rota direta #/ex reabriu exercício");
  await page.click("#btn-teclado");
  await page.waitForTimeout(300);
  const sumiu = await page.$eval("#teclado-virtual", (el) => el.offsetParent === null);
  checar(sumiu, "toggle fechou teclado");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("#btn-comecar", { timeout: 30000 });
  await page.click("#btn-comecar");
  await page.waitForSelector(".no[data-slug]", { timeout: 15000 });
  const aindaFechado = await page.$eval("#teclado-virtual", (el) => el.offsetParent === null);
  checar(aindaFechado, "teclado continuou fechado após reload (config persistiu)");
  await page.click("#btn-teclado");

  await page.screenshot({ path: path.join(SHOTS, "r9-01-final.png") });
  await browser.close();

  const errosReais = erros.filter((e) => !/favicon/i.test(e));
  console.log("\n=== RESULTADO r9 ===");
  console.log("asserções falhas:", falhas.length);
  falhas.forEach((f) => console.log("  ✗ " + f));
  console.log("erros de página/console:", errosReais.length);
  errosReais.forEach((e) => console.log("  " + e));
  process.exit(falhas.length === 0 && errosReais.length === 0 ? 0 : 1);
})().catch((e) => { console.error("ABORTOU:", e); process.exit(2); });
