// Renderização das telas + micro-animações. Sem framework, sem imagens,
// sem webfonts. Ícones = SVG inline minúsculos. Textos via t() (js/i18n.js).

import * as engine from "./engine.js";
import { exerciciosDe } from "./content.js";
import {
  ICONE_NIVEL, ICONE_CADEADO, ICONE_GRAFICO, ICONE_LAB, ICONE_ALVO,
  ICONE_FAIXA_MODO, ICONE_RAIO, ICONE_CHECK, ICONE_CONFIG,
  ICONE_SETA_DIR, AVATAR_CUBO, iconeFaixa,
} from "./icones.js";
import { cuboPlataforma, cuboSvg } from "./mundo.js";
import { t, glossario } from "./i18n.js";
// alias de t() para escopos onde "t" é variável local (laços sobre testes,
// map sobre tipos de arquivo html/css/js)
const tr = t;

// versão de cache dos assets: herda o ?v= com que este módulo foi importado
// (import map do index.html) — bump lá busta imagens aqui junto.
export const V = new URL(import.meta.url).search || "";
export const assetUrl = (nome) => `./assets/${nome}.png${V}`;

// Cenários de fundo POR TELA que já existem em assets/ (cada ato e o
// laboratório podem ter o seu). Lista explícita — sem ela o app tentaria
// carregar arquivos inexistentes e sujaria o console com 404. Ao adicionar
// uma arte nova (cena-ato1.png, cena-lab.png…), inclua o nome aqui.
export const CENAS = new Set([]);

// Dojo OS: ícone de desktop por nível (sprites da folha A2 do pacote).
// Bosses = troféu; boss final = janela LLM (pedido do prompt r8).
const ICONE_POR_SLUG = {
  variaveis: "icone-01",       // pasta com noodles — ponto de partida
  texto: "icone-02",           // livro com circuitos
  colecoes: "icone-03",        // pilha de documentos
  funcoes: "icone-12",         // engrenagens
  comprehensions: "icone-04",  // fluxograma
  excecoes: "icone-05",        // besouro
  arquivos: "icone-22",        // disquete
  regex: "icone-06",           // lupa sobre papel
  classes: "icone-23",         // caixa de presente (objetos encapsulados)
  http: "icone-11",            // robô no balão de fala
  resiliencia: "icone-21",     // ampulheta (retry/espera)
  assincrono: "icone-16",      // terminal verde (event loop)
  numpy: "icone-17",           // calculadora
  pandas: "icone-08",          // planilha com balde
  chunking: "icone-24",        // livro com "?" (picotar texto)
  embeddings: "icone-07",      // rede neural
  llm: "icone-09",             // cérebro com barra de progresso
  estruturada: "icone-10",     // gráfico nos eixos (dados estruturados)
  boss1: "icone-15", boss2: "icone-15", boss3: "icone-15", boss4: "icone-15",
  boss5: "icone-13",           // janela LLM com a lhama
};
const iconeDoNivel = (slug) => ICONE_POR_SLUG[slug] || "icone-24";

// moldura de janela do Dojo OS (9-slice do chrome-07 via CSS .janela)
// rótulo curto do custo da dica (o completo vai no title): os 5 botões
// dica/solução/pular cabem em menos linhas na coluna estreita da aula
const custoCurto = (i) => t("custo.curto." + i);
const custoLongo = (i) => t("custo.longo." + i);

// rótulo de exibição de um conceito (tag estável do conteúdo). O manifest de
// cada idioma pode trazer "rotulos_conceitos": {tag: rótulo}; sem ele, a tag.
export function rotuloConceito(conteudo, tag) {
  const r = conteudo && conteudo.manifest && conteudo.manifest.rotulos_conceitos;
  return (r && typeof r[tag] === "string" && r[tag]) || tag;
}

export function janela(titulo, corpo, cls = "") {
  return `<section class="janela ${cls}">
    <div class="janela-barra"><span class="janela-titulo">${esc(titulo)}</span>
      <span class="janela-btns" aria-hidden="true"><i class="jbt jbt-min"></i><i class="jbt jbt-max"></i><i class="jbt jbt-x"></i></span></div>
    <div class="janela-corpo">${corpo}</div>
  </section>`;
}


// ---------------------------------------------------------------------------
// utilidades
// ---------------------------------------------------------------------------
// número vindo do save -> texto seguro para innerHTML (defesa em profundidade:
// o storage já normaliza, mas nenhum valor do save entra cru num template).
export function num(x) {
  const n = Number(x);
  return Number.isFinite(n) ? String(n) : "0";
}

export function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

// markdown mínimo: parágrafos, `code`, ```blocos```, **negrito**, *itálico*, listas, ## títulos
export function md(texto) {
  if (!texto) return "";
  const blocos = [];
  let resto = String(texto).replaceAll("\r\n", "\n");
  // Blocos ```: abertura E fechamento só contam em LINHA PRÓPRIA (regra do
  // CommonMark). Os bosses têm blocos ```python que CONTÊM uma cerca no meio
  // de uma string (a regex `r"```json..."`): com o fechamento valendo no meio
  // da linha, o bloco era cortado ali e o resto do código vazava como prosa —
  // e uma crase-tripla dentro de `código inline` virava um <pre> no meio da
  // frase, sumindo com o padrão que o aluno precisa copiar.
  resto = resto.replace(/^[ \t]*```(\w*)[ \t]*\n([\s\S]*?)\n[ \t]*```[ \t]*$/gm, (_m, _lang, corpo) => {
    blocos.push(`<pre class="cod"><code>${esc(aparar(corpo))}</code></pre>`);
    return `[[B${blocos.length - 1}]]`;
  });
  // `code` vira placeholder ANTES de negrito/itálico: senão os asteriscos
  // DENTRO do código (`**kwargs`, `*tokens`, `\s*`) pareiam com asteriscos da
  // prosa e comem o código do aluno (ex.: `log_parametros(**params)` virava
  // "log_parametros(params)" com <strong> cruzado). Mesmo truque dos blocos ```.
  const linhaFmt = (l) => {
    const inline = [];
    // Delimitador = sequencia de N crases ISOLADA (CommonMark): assim
    // `re.search(r"```json...```")` fecha na ultima crase simples e as
    // triplas ficam DENTRO do codigo, como o autor escreveu.
    let s = esc(l).replace(/(?<!`)(`+)(?!`)([\s\S]*?)(?<!`)\1(?!`)/g, (_m, _cr, c) => {
      inline.push(c);
      return `\u0000C${inline.length - 1}\u0000`;
    });
    s = s
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
    return s.replace(/\u0000C(\d+)\u0000/g, (_m, i) => `<code>${inline[Number(i)]}</code>`);
  };
  const paragrafos = resto.split(/\n{2,}/).map((p) => {
    const linhas = p.split("\n").filter((l) => l.trim() !== "");
    if (!linhas.length) return "";
    if (linhas.every((l) => /^\s*[-*]\s+/.test(l))) {
      return "<ul>" + linhas.map((l) => `<li>${linhaFmt(l.replace(/^\s*[-*]\s+/, ""))}</li>`).join("") + "</ul>";
    }
    if (/^##\s+/.test(linhas[0])) {
      return `<h3>${linhaFmt(linhas[0].replace(/^##\s+/, ""))}</h3>` +
        (linhas.length > 1 ? `<p>${linhas.slice(1).map(linhaFmt).join("<br>")}</p>` : "");
    }
    if (/^\[\[B\d+\]\]$/.test(p.trim())) return p.trim();
    return `<p>${linhas.map(linhaFmt).join("<br>")}</p>`;
  });
  let html = paragrafos.join("");
  // balões de glossário: termos-chave em `code` de prosa ganham hover com a
  // definição (o que é + pra que serve). Roda ANTES de recolocar os blocos
  // ```...``` — dentro de código de verdade não há balão (seria ruído).
  html = html.replace(/<code>([^<]+)<\/code>/g, (m, tok) => {
    const bruto = tok.trim()
      .replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">")
      .replaceAll("&quot;", '"').replaceAll("&#39;", "'");
    const def = glossario()[bruto];
    if (!def) return m;
    return `<code class="glos" tabindex="0">${tok}<span class="glos-balao" role="tooltip"><strong>${esc(bruto)}</strong>${esc(def)}</span></code>`;
  });
  html = html.replace(/\[\[B(\d+)\]\]/g, (_m, i) => blocos[Number(i)] ?? _m);
  return html;
}

// posiciona os balões que estourariam a borda ÚTIL (flip esq/dir).
// A borda é a da TELA DA TV (#tv-scroll, que faz o clipping), não a da janela:
// medir contra window.innerWidth deixava o balão ser cortado pela moldura sem
// nunca acionar o flip (pior em ultrawide, onde a TV é bem mais estreita).
export function ligarGlossario() {
  const tubo = document.getElementById("tv-scroll");
  const limites = () => {
    const r = tubo ? tubo.getBoundingClientRect() : null;
    return r && r.width ? { esq: r.left, dir: r.right } : { esq: 0, dir: window.innerWidth };
  };
  document.querySelectorAll("code.glos").forEach((el) => {
    const ajustar = () => {
      const balao = el.querySelector(".glos-balao");
      if (!balao) return;
      balao.classList.remove("esq", "dir");
      const lim = limites();
      const r = balao.getBoundingClientRect();
      if (r.left < lim.esq + 8) balao.classList.add("esq");
      else if (r.right > lim.dir - 8) balao.classList.add("dir");
    };
    el.addEventListener("mouseenter", ajustar);
    el.addEventListener("focus", ajustar);
  });
}

function estrelas(n, max = 3) {
  let s = "";
  for (let i = 0; i < max; i++) {
    s += `<span class="estrela ${i < n ? "cheia" : ""}">${i < n ? "★" : "☆"}</span>`;
  }
  return `<span class="estrelas" title="${t("estrelas.title", { n, max })}">${s}</span>`;
}

// ---------------------------------------------------------------------------
// header permanente
// ---------------------------------------------------------------------------
export function header(ctx) {
  const { save, conteudo } = ctx;
  const ex = ctx.sessao.exAtual;
  let progressoNivel = "";
  const node = ex ? conteudo.trilhaPorSlug.get(ex.nivel) : null;
  if (ex && node) {
    const p = engine.progressoNivel(save, conteudo, ex.nivel, ex.tier);
    progressoNivel = `<span class="hdr-prog">${p.feitos}/${p.total}</span>`;
  }
  const streak = save.streak.atual;
  const fila = save.revisao.length;

  // tabs na taskbar: Atos na área de trabalho, trilhas no Laboratório
  let tabsAto = "";
  if (ctx.tela && ctx.tela.nome === "mapa") {
    tabsAto = conteudo.manifest.atos.map((ato, i) =>
      `<button class="tb-app tb-ato ${i === ctx.atoTab ? "ativo" : ""}" data-ato-tab="${i}"
        title="${esc(ato.titulo)}" aria-pressed="${i === ctx.atoTab}">${t("hdr.ato", { n: i + 1 })}</button>`).join("");
  } else if (ctx.tela && ctx.tela.nome === "laboratorio") {
    const ativa = ctx.labTab || 0;
    tabsAto = [...conteudo.webPorNivel.keys()].map((nv, i) =>
      `<button class="tb-app tb-ato ${i === ativa ? "ativo" : ""}" data-lab-tab="${i}"
        title="${esc(nomeNivelWeb(nv))}" aria-pressed="${i === ativa}">${esc(nomeNivelWebCurto(nv))}</button>`
    ).join("");
  }
  const hora = new Date().toTimeString().slice(0, 5);
  const tecladoAberto = document.body.classList.contains("vk-aberto");

  return `<header class="hdr">
    <button class="tb-start" id="btn-config" title="${t("hdr.start.title")}" aria-label="${t("hdr.start.title")}">Start</button>
    <a class="tb-app" href="#/mapa" title="${t("hdr.dojo.title")}" aria-label="${t("hdr.dojo.aria")}"><img src="${assetUrl("taskbar-07")}" alt=""><span class="tb-rotulo">Dojo</span></a>
    ${tabsAto}
    <div class="hdr-meio">
      <a class="tb-app" href="#/web" title="${t("hdr.lab")}" aria-label="${t("hdr.lab")}"><img src="${assetUrl("taskbar-10")}" alt=""><span class="tb-rotulo">${t("hdr.lab")}</span></a>
      <a class="tb-app" href="#/progresso" title="${t("hdr.progresso")}" aria-label="${t("hdr.progresso")}"><img src="${assetUrl("taskbar-09")}" alt=""><span class="tb-rotulo">${t("hdr.progresso")}</span></a>
      ${progressoNivel}
    </div>
    <span class="tb-espaco"></span>
    <div class="hdr-dir">
      <button class="tb-app ${tecladoAberto ? "ativo" : ""}" id="btn-teclado"
        title="${esc(t("hdr.teclado.title"))}"
        aria-label="${t("hdr.teclado.aria")}" aria-pressed="${tecladoAberto}">
        <img src="${assetUrl("keycap")}" alt=""><span class="tb-rotulo">${t("hdr.teclado")}</span></button>
      ${streak > 0 ? `<span class="hdr-streak" id="hdr-streak">${ICONE_RAIO}${num(streak)}</span>` : ""}
      ${fila > 0 ? `<a class="hdr-fila" href="#/mapa" title="${t("hdr.fila.title")}">${t("hdr.fila", { n: num(fila) })}</a>` : ""}
      <span class="hdr-xp" id="hdr-xp" title="${t("hdr.xp.title")}"><img src="${assetUrl("taskbar-12")}" alt="">${num(save.xp_total)} XP</span>
      <span class="tb-relogio" id="tb-relogio">${hora.slice(0, 2)}<i class="pisca">:</i>${hora.slice(3)}</span>
    </div>
  </header>`;
}

// ---------------------------------------------------------------------------
// telas de boas-vindas / save corrompido / erro fatal
// ---------------------------------------------------------------------------
export function telaErroFatal(msg) {
  return `<div class="tela-centro">
    ${janela(t("jan.erro"), `
      <p><strong>${t("erro.titulo")}</strong></p>
      <p>${t("erro.texto")}</p>
      <p class="mono peq">${esc(msg || "")}</p>
      <button class="btn btn-primario" id="btn-recarregar">${t("erro.recarregar")}</button>`)}
  </div>`;
}

export function telaCorrompido() {
  return `<div class="tela-centro">
    ${janela(t("jan.corrompido"), `
      <p><strong>${t("corrompido.titulo")}</strong></p>
      <p>${t("corrompido.texto")}</p>
      <div class="linha-botoes">
        <button class="btn btn-primario" id="btn-reset-corrompido">${t("corrompido.zero")}</button>
        <label class="btn">${t("importar.save")}<input type="file" id="input-import-corrompido" accept=".json" hidden></label>
      </div>`)}
  </div>`;
}

// seletor de idioma (boas-vindas e Configurações): botões PT/EN, o atual pressionado
export function seletorIdioma(atual) {
  return `<span class="linha-botoes seletor-idioma" role="group" aria-label="${t("idioma.rotulo")}">
    ${["pt", "en"].map((l) => `<button class="btn btn-peq ${l === atual ? "ativo" : ""}" data-lang="${l}"
      aria-pressed="${l === atual}" lang="${l === "en" ? "en" : "pt-BR"}">${t("idioma." + l)}</button>`).join("")}
  </span>`;
}

export function telaBoasVindas(novo, recap, lang) {
  return `<div class="tela-centro tela-bv">
    ${janela(t("jan.bv"), `
      <h1 class="bv-titulo">Python AI Dojo</h1>
      ${novo
        ? `<p class="sub bv-sub">${t("bv.sub.novo")}</p>`
        : `<p class="sub bv-sub">${t("bv.sub.volta")}${recap ? " " + esc(recap) : ""}</p>`}
      <!-- o botão fica na coluna do Cato (ao lado do retrato), não numa linha
           própria abaixo: a janela termina onde o conteúdo termina -->
      <div class="tutor-fala bv-fala">
        <img class="tutor-retrato" src="${assetUrl("tutor-gato")}" alt="${t("bv.cato.alt")}">
        <div class="bv-lado">
          <p class="peq">${t("bv.cato.fala")}</p>
          <p class="bv-cta"><button class="btn btn-primario btn-grande" id="btn-comecar" data-som-proprio>${novo ? t("bv.comecar") : t("bv.continuar")}</button></p>
          <p class="bv-idioma">${seletorIdioma(lang)}</p>
        </div>
      </div>`, "janela-bv")}
  </div>`;
}

// ---------------------------------------------------------------------------
// mapa da trilha
// ---------------------------------------------------------------------------
const nomeFaixa = (fx) => t("faixa." + fx);

// Dojo OS: o mapa é a ÁREA DE TRABALHO — wallpaper, ícones .exe por nível,
// janela leia-me com o hero, e as tabs de Ato ficam na taskbar (header).
export function telaMapa(ctx) {
  const { save, conteudo } = ctx;
  const tier = save.run_atual.tier;
  const fx = engine.faixa(save, conteudo);
  const proximo = engine.proximoExercicio(save, conteudo);
  const proxNode = proximo ? conteudo.trilhaPorSlug.get(proximo.nivel) : null;
  let primeiroIncompleto = conteudo.trilha.length;
  for (const n of conteudo.trilha) {
    if (!engine.nivelCompleto(save, conteudo, n.slug, tier)) { primeiroIncompleto = n.pos; break; }
  }
  const feitosWeb = (conteudo.webLab || []).filter((e) => save.historico[e.id]?.resolvido).length;

  const atoIdx = ctx.atoTab;
  const ato = conteudo.manifest.atos[atoIdx];
  let niveisHtml = "";
  let iNo = 0;
  for (const nivel of ato.niveis) {
    const node = conteudo.trilhaPorSlug.get(nivel.slug);
    const p = engine.progressoNivel(save, conteudo, nivel.slug, tier);
    const completo = p.total > 0 && p.feitos === p.total;
    const bloqueado = node.pos > primeiroIncompleto
      || (nivel.slug === "boss5" && tier === 3 && !["marrom", "preta"].includes(fx));
    const atual = node.pos === primeiroIncompleto && !completo && !bloqueado;
    niveisHtml += `<button class="no ${completo ? "feito" : atual ? "atual" : ""}"
      data-slug="${nivel.slug}" data-ato="${atoIdx}" ${bloqueado ? "disabled" : ""}
      style="--i:${iNo++}"
      title="${esc(ato.titulo)} · ${esc(nivel.titulo)}${bloqueado ? t("bloqueado.parenteses") : ""}">
      <span class="no-icone">
        <img class="no-img" src="${assetUrl(iconeDoNivel(nivel.slug))}" alt="">
        ${bloqueado ? `<img class="no-cadeado" src="${assetUrl("icone-18")}" alt="${t("bloqueado")}">` : ""}
        ${completo ? `<img class="no-badge" src="${assetUrl("icone-20")}" alt="${t("concluido")}">` : ""}
      </span>
      <span class="no-etiqueta">
        <span class="no-nome"><span class="no-rotulo">${esc(nivel.titulo)}</span></span>
        <span class="no-sub">${completo ? t("concluido") : bloqueado ? t("bloqueado") : `${p.feitos}/${p.total}`}</span>
      </span>
    </button>`;
  }
  const atosHtml = `<section class="mapa-ato">
    <h2>${t("mapa.ato", { n: atoIdx + 1, titulo: esc(ato.titulo) })}</h2>
    <div class="mapa-niveis">${niveisHtml}</div></section>`;

  let resto = "";
  if (fx === "marrom") {
    const chk = engine.checklistPreta(save, conteudo);
    resto += `<div class="painel"><h3>${t("mapa.checklist")}</h3>
      <ul class="checklist">
        <li class="${chk.boss5T3 ? "ok" : ""}">${t("mapa.chk.boss")}</li>
        <li class="${chk.conceitosOk ? "ok" : ""}">${t("mapa.chk.conceitos", { pct: Math.round(chk.pctConceitos * 100) })}</li>
        <li class="${chk.filaVazia ? "ok" : ""}">${t("mapa.chk.fila", { n: num(chk.filaTamanho) })}</li>
      </ul></div>`;
  }
  if (fx === "preta") {
    resto += `<div class="linha-botoes"><button class="btn" id="btn-certificado">${t("certificado.botao")}</button>
      <button class="btn btn-fantasma" id="btn-modo-dan">${t("modo.dan")}</button>
      <button class="btn btn-fantasma" id="btn-modo-livre">${t("modo.livre")}</button></div>`;
  }

  const leiame = janela(t("jan.leiame"), `
    <h1>Python AI Dojo</h1>
    <p class="sub">${t("mapa.sub", { run: num(save.run_atual.numero), faixa: esc(nomeFaixa(fx)), xp: num(save.xp_total) })}</p>
    <div class="linha-botoes">
      ${proximo ? `<button class="btn btn-primario" id="btn-continuar">${t("continuar.alvo", { titulo: esc(proxNode.titulo) })}</button>` : ""}
      <button class="btn btn-peq" id="btn-progresso">${t("hdr.progresso")}</button>
      <button class="btn btn-peq" id="btn-laboratorio">${t("mapa.lab", { feitos: feitosWeb, total: (conteudo.webLab || []).length })}</button>
    </div>
    ${resto}`, "janela-leiame");

  return `<div class="mapa desktop">
    ${leiame}
    <div class="mapa-atos">${atosHtml}</div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Progresso (tempos, evolução, estrelas)
// ---------------------------------------------------------------------------
export function fmtTempo(ms) {
  if (ms == null) return "—";
  const s = ms / 1000;
  if (s < 60) return s.toFixed(1) + "s";
  // arredonda os segundos TOTAIS primeiro (senão 119.6s viraria "1m60s")
  const st = Math.round(s);
  const m = Math.floor(st / 60);
  return `${m}m${String(st % 60).padStart(2, "0")}s`;
}

export function telaProgresso(ctx) {
  const { save, conteudo } = ctx;
  const resolvidos = Object.values(save.historico).filter((h) => h.resolvido).length;
  const semDica = Object.values(save.historico).filter((h) => h.resolvido && !h.dicas_usadas && !h.solucao_vista && !h.pulado).length;
  const conceitosTres = Object.values(save.maestria || {}).filter((n) => n >= 3).length;
  const totalConceitos = new Set(conteudo.trilha.flatMap((n) => n.conceitos)).size;
  const dias = save.dias_praticados || 0;

  // evolução: exercícios com >=2 tempos, mostrando os 2 mais recentes
  const evol = [];
  for (const [id, h] of Object.entries(save.historico)) {
    if (h.tempos && h.tempos.length >= 2) {
      const ex = conteudo.porId.get(id);
      const ult = h.tempos.slice(-2);
      evol.push({ id, titulo: ex ? ex.titulo : id, ant: ult[0], rec: ult[1], best: h.pb_tempo });
    }
  }
  evol.sort((a, b) => (b.rec.t || 0) - (a.rec.t || 0));

  let html = `<div class="trilha-topo reveal"><div class="trilha-titulo"><h1>${t("prog.titulo")}</h1>
    <p class="sub">${t("prog.sub")}</p></div><a class="btn btn-fantasma" href="#/mapa">${t("voltar.seta")}</a></div>`;

  html += `<div class="progresso-grade reveal">
    <div class="stat-card"><div class="num">${num(save.xp_total)}</div><div class="lab">${t("prog.xp")}</div></div>
    <div class="stat-card"><div class="num">${resolvidos}</div><div class="lab">${t("prog.resolvidos")}</div></div>
    <div class="stat-card"><div class="num">${resolvidos ? Math.round((semDica / resolvidos) * 100) : 0}%</div><div class="lab">${t("prog.semDica")}</div></div>
    <div class="stat-card"><div class="num">${num(save.streak.melhor)}</div><div class="lab">${t("prog.melhorStreak")}</div></div>
    <div class="stat-card"><div class="num">${conceitosTres}/${totalConceitos}</div><div class="lab">${t("prog.conceitos")}</div></div>
    <div class="stat-card"><div class="num">${num(dias)}</div><div class="lab">${t("prog.dias")}</div></div>
  </div>`;

  html += `<h3 class="reveal">${t("prog.evolucao")} <span class="peq">${t("prog.evolucao.sub")}</span></h3>`;
  if (!evol.length) {
    html += `<p class="sub">${t("prog.vazio")}</p>`;
  } else {
    html += `<div class="evolucao">`;
    for (const e of evol.slice(0, 20)) {
      const delta = e.ant.t - e.rec.t;
      const melhorou = delta > 0;
      html += `<div class="evo-linha">
        <span class="evo-nome">${esc(e.titulo)}</span>
        <span class="evo-tempos">${fmtTempo(e.ant.t)} → ${fmtTempo(e.rec.t)}</span>
        <span class="${melhorou ? "tempo-melhora" : "tempo-piora"}">${melhorou ? t("prog.maisRapido", { t: fmtTempo(Math.abs(delta)) }) : delta === 0 ? t("prog.igual") : "▲ " + fmtTempo(Math.abs(delta))}</span>
        <span class="peq" title="${t("prog.recorde.title")}">${t("prog.recorde", { t: fmtTempo(e.best) })}</span>
      </div>`;
    }
    html += `</div>`;
  }
  return `<div class="mapa">${janela(t("jan.progresso"), html)}</div>`;
}

// dicas reveladas: o Cato fala DENTRO da própria janela, logo abaixo dos botões
// de dica (antes ficavam soltas no papel de parede, abaixo da aula inteira)
function dicasArea(dicasHtml) {
  return `<div class="dicas-area" id="dicas-area">${dicasHtml ? `<div class="janela-tutor tutor-fala">
    <img class="tutor-retrato" src="${assetUrl("tutor-gato")}" alt="Cato">
    <div class="tutor-dicas">${dicasHtml}</div></div>` : ""}</div>`;
}

// ---------------------------------------------------------------------------
// tela de exercício
// ---------------------------------------------------------------------------
export function telaExercicio(ctx) {
  const { save, conteudo, sessao } = ctx;
  const ex = sessao.exAtual;
  const node = conteudo.trilhaPorSlug.get(ex.nivel);
  const h = save.historico[ex.id];
  const codigo = (h && h.ultimo_codigo) || ex.starter_code;
  const exsNivel = exerciciosDe(conteudo, ex.nivel, ex.tier);
  const idx = exsNivel.findIndex((e) => e.id === ex.id);

  // explicação: a do exercício, ou a do 1º do nível+tier (colapsada)
  let explicacao = "";
  if (ex.explicacao_md) {
    explicacao = `<div class="explicacao">${md(ex.explicacao_md)}</div>`;
  } else {
    const primeira = exsNivel.find((e) => e.explicacao_md);
    if (primeira) {
      explicacao = `<details class="explicacao-rever"><summary>${t("ex.rever")}</summary>
        <div class="explicacao">${md(primeira.explicacao_md)}</div></details>`;
    }
  }

  let dicasHtml = "";
  for (let i = 1; i <= 3; i++) {
    if (sessao.dicaRevelada >= i) {
      dicasHtml += `<div class="dica"><span class="dica-num">${t("dica.n", { i })}</span> ${md(ex.dicas[i - 1])}</div>`;
    }
  }
  const botoesDica = [];
  for (let i = sessao.dicaRevelada + 1; i <= 3; i++) {
    botoesDica.push(`<button class="btn btn-peq" data-dica="${i}" id="btn-dica-${i}" title="${t("dica.title", { i, custo: custoLongo(i) })}">${t("dica.n", { i })} · ${custoCurto(i)}</button>`);
  }

  const contexto = sessao.emRevisao
    ? `<span class="chip chip-rev">${t("ex.chip.revisao", { c: sessao.emRevisao.caixaAtual || "?" })}</span>`
    : sessao.modoLivre
      ? `<span class="chip">${t("ex.chip.livre")}</span>`
      : sessao.modoDan
        ? `<span class="chip">${t("ex.chip.dan")}</span>`
        : "";

  return `<div class="ex-layout">
    <aside class="ex-sidebar" id="ex-sidebar">
      ${conteudo.manifest.atos.map((ato, ai) => {
        const aberto = node ? ai === node.atoIdx : ai === 0;
        return `<details ${aberto ? "open" : ""}><summary>${esc(ato.titulo)}</summary>
          ${ato.niveis.map((n) => {
            const p = engine.progressoNivel(save, conteudo, n.slug, ex.tier);
            const atual = n.slug === ex.nivel;
            return `<button class="side-nivel ${atual ? "atual" : ""}" data-slug="${n.slug}">
              ${p.total > 0 && p.feitos === p.total ? ICONE_CHECK : ""}<span>${esc(n.titulo)}</span><span class="peq">${p.feitos}/${p.total}</span></button>`;
          }).join("")}
        </details>`;
      }).join("")}
    </aside>
    <section class="ex-enunciado">
      ${janela(t("jan.aula"), `
        <div class="ex-cab">
          <a class="btn btn-fantasma btn-peq" href="#/mapa">${t("ex.areaTrabalho")}</a>
          ${contexto}
        </div>
        <div class="aula-cab">
          <img class="tutor-retrato tutor-mini" src="${assetUrl("tutor-gato")}" alt="${t("ex.cato.alt")}">
          <div><h2>${esc(ex.titulo)}</h2><p class="peq aula-fala">${node ? `${esc(node.atoTitulo)} · ${esc(node.titulo)} · ` : ""}${t("ex.posicao", { tier: ex.tier, i: idx + 1, n: exsNivel.length })}</p></div>
        </div>
        <div class="linha-botoes dicas-botoes">
          ${botoesDica.join("")}
          <button class="btn btn-peq" id="btn-solucao" title="${t("ex.solucao.title")}">${t("ex.solucao")}</button>
          <button class="btn btn-peq" id="btn-pular" title="${t("ex.pular.title")}">${t("ex.pular")}</button>
        </div>
        ${dicasArea(dicasHtml)}
        ${explicacao}
        <div class="enunciado">${md(ex.enunciado_md)}</div>`)}
    </section>
    <section class="ex-editor">
      ${janela(t("jan.resolucao"), `
      <div class="cao-codigo">
        <img class="tutor-retrato tutor-mini" src="${assetUrl("tutor-cao")}"
          alt="${t("ex.billy.alt")}"
          title="${t("ex.billy.title")}">
        <div class="editor-caixa">
          <div class="editor-gutter" id="editor-gutter">1</div>
          <textarea id="editor" class="editor" spellcheck="false" autocomplete="off"
            autocapitalize="off" aria-label="${t("ex.editor.aria")}">${esc(codigo)}</textarea>
        </div>
      </div>
      <div id="vk-slot" class="vk-slot"></div>
      <div class="editor-acoes">
        <button class="btn btn-primario" id="btn-rodar">${t("rodar")} <span class="atalho">Ctrl+Enter</span></button>
        <button class="btn btn-fantasma btn-peq" id="btn-restaurar">${t("ex.restaurar")}</button>
        <span class="pkg-status peq" id="pkg-status"></span>
        <button class="btn btn-primario oculto" id="btn-proximo">${t("proximo")} <span class="atalho">Enter</span></button>
      </div>
      <!-- a microfala do Billy vem DEPOIS do Rodar: ela aparecia entre o
           editor e o botão e o empurrava 40px para baixo da taskbar -->
      <p class="billy-fala oculto" id="billy-fala" aria-live="polite"></p>
      <div class="resultados" id="resultados" aria-live="polite"></div>`)}
    </section>
  </div>`;
}

// resultado da execução -> painel
export function painelResultado(resultado, ex, xpGanho) {
  const r = resultado;
  if (r.status === "erro_sintaxe") {
    const e = r.erro || {};
    return `<div class="res res-sintaxe">
      <p class="res-titulo">${t("res.sintaxe", { linha: e.linha ?? "?" })}</p>
      <p>${esc(e.mensagem_didatica)}</p>
      ${e.trecho ? `<pre class="cod"><code>${esc(e.trecho)}</code></pre>` : ""}
      <details><summary>${t("ver.erro.completo")}</summary><p class="mono peq">${esc(e.mensagem_original)}</p></details>
    </div>`;
  }
  if (r.status === "erro_execucao") {
    const e = r.erro || {};
    return `<div class="res res-erro">
      <p class="res-titulo">${t("res.execucao")}${e.linha ? t("res.execucao.linha", { linha: e.linha }) : ""}</p>
      <p>${esc(e.mensagem_didatica)}</p>
      <details><summary>${t("ver.erro.completo")}</summary><p class="mono peq">${esc(e.mensagem_original)}</p></details>
      ${r.stdout ? `<details><summary>${t("res.saidaAteErro")}</summary><pre class="cod"><code>${esc(r.stdout)}</code></pre></details>` : ""}
    </div>`;
  }
  if (r.status === "timeout") {
    const e = r.erro || {};
    return `<div class="res res-erro">
      <p class="res-titulo">${t("res.timeout")}</p>
      <p>${esc(e.mensagem_didatica || t("res.timeout.padrao"))}</p>
    </div>`;
  }
  // ok ou falha_teste: lista de testes
  const falhas = r.testes.filter((t) => !t.passou);
  const ocultosOk = r.testes.filter((t) => t.oculto && t.passou).length;
  let html = "";
  if (r.status === "ok") {
    html += `<div class="res res-ok">
      <span class="check-svg"><svg viewBox="0 0 32 32"><path class="check-path" d="M6 17l7 7 13-15" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/></svg></span>
      <span class="res-titulo">${t("res.ok")}</span>
      ${xpGanho > 0 ? `<span class="xp-badge" id="xp-badge">+${num(xpGanho)} XP</span>` : ""}
    </div>`;
  } else {
    html += `<div class="res res-falha"><p class="res-titulo">${t("res.falha", { falhas: falhas.length, total: r.testes.length })}</p></div>`;
  }
  let primeiraFalha = true;
  for (const t of r.testes) {
    if (t.passou) continue;
    const aberto = primeiraFalha;
    primeiraFalha = false;
    html += `<details class="teste teste-falha" ${aberto ? "open" : ""}>
      <summary>✗ ${esc(t.nome)}${t.oculto ? ` <span class="peq">${tr("res.oculto")}</span>` : ""}</summary>
      ${t.mensagem ? `<p>${esc(t.mensagem)}</p>` : ""}
      ${t.esperado !== null ? `<div class="esp-obt">
        <div><span class="rotulo">${tr("esperado")}</span><pre class="cod"><code>${esc(t.esperado)}</code></pre></div>
        <div><span class="rotulo">${tr("obtido")}</span><pre class="cod"><code>${esc(t.obtido)}</code></pre></div>
      </div>` : ""}
      ${t.diff ? `<details><summary>diff</summary><pre class="cod diff"><code>${esc(t.diff)}</code></pre></details>` : ""}
    </details>`;
  }
  const visiveisOk = r.testes.filter((t) => !t.oculto && t.passou);
  if (visiveisOk.length) {
    html += `<details class="teste"><summary>${t("res.visiveisOk", { n: visiveisOk.length })}</summary>
      <ul>${visiveisOk.map((t) => `<li>✓ ${esc(t.nome)}</li>`).join("")}</ul></details>`;
  }
  if (ocultosOk) html += `<p class="peq">${t("res.ocultosOk", { n: ocultosOk })}</p>`;
  if (r.stdout) {
    html += `<details class="teste"><summary>${t("res.saida")}</summary><pre class="cod"><code>${esc(r.stdout)}</code></pre></details>`;
  }
  return html;
}

// ---------------------------------------------------------------------------
// fechamentos
// ---------------------------------------------------------------------------
export function telaFimNivel(ctx, slug, revisoesDevidas) {
  const { save, conteudo, sessao } = ctx;
  const node = conteudo.trilhaPorSlug.get(slug);
  const tier = sessao.tierFechamento || save.run_atual.tier;
  const exs = exerciciosDe(conteudo, slug, tier);
  const xpNivel = exs.reduce((s, e) => s + (save.historico[e.id]?.xp_ganho || 0), 0);
  const resumoConceitos = node.conceitos.slice(0, 4).map((c) => rotuloConceito(conteudo, c)).join(", ");
  return `<div class="tela-centro">
    <div class="cer-cubos" id="cer-cubos" aria-hidden="true"></div>
    ${janela(t("jan.fimNivel"), `<div class="painel-fim">
      <p class="peq">${esc(node.atoTitulo)}</p>
      <h2>${t("fim.nivel", { titulo: esc(node.titulo) })}</h2>
      <ul class="fim-lista">
        ${exs.map((e) => {
          const h = save.historico[e.id] || {};
          const semDica = h.resolvido && !h.dicas_usadas && !h.solucao_vista && !h.pulado;
          return `<li>${h.resolvido ? "✓" : "·"} ${esc(e.titulo)} ${semDica ? `<span class="peq">${t("fim.semDica")}</span>` : ""}</li>`;
        }).join("")}
      </ul>
      <p>${t("fim.xpNivel", { xp: num(xpNivel), streak: num(save.streak.atual) })}</p>
      <p>${t("fim.sabe", { conceitos: esc(resumoConceitos) })}</p>
      <div class="barra-fim"><span class="barra-fim-fill" id="barra-fim"></span></div>
      <div class="linha-botoes">
        <button class="btn btn-primario" id="btn-fim-continuar">${t("continuar")}</button>
        ${revisoesDevidas.length ? `<button class="btn" id="btn-fim-revisar">${t("fim.revisar", { n: revisoesDevidas.length, min: revisoesDevidas.length + 1 })}</button>` : ""}
        <button class="btn btn-fantasma" id="btn-fim-parar">${t("fim.parar")}</button>
      </div>
      <p class="peq oculto" id="msg-parar">${t("fim.msgParar")}</p>
    </div>`)}
  </div>`;
}

export function telaFimAto(ctx, atoId) {
  const { save, conteudo, sessao } = ctx;
  const atoIdx = conteudo.manifest.atos.findIndex((a) => a.id === atoId);
  const ato = conteudo.manifest.atos[atoIdx];
  const tier = sessao.tierFechamento || save.run_atual.tier;
  const proximoAto = conteudo.manifest.atos[atoIdx + 1];
  const xpAto = conteudo.trilha
    .filter((n) => n.atoIdx === atoIdx)
    .flatMap((n) => exerciciosDe(conteudo, n.slug, tier))
    .reduce((s, e) => s + (save.historico[e.id]?.xp_ganho || 0), 0);
  const conceitos = [...new Set(conteudo.trilha.filter((n) => n.atoIdx === atoIdx).flatMap((n) => n.conceitos))];
  return `<div class="tela-centro tela-ato">
    <div class="cer-cubos" id="cer-cubos" aria-hidden="true"></div>
    ${janela(t("jan.fimAto"), `
    <h1>${t("fim.ato")}</h1>
    <h2>${esc(ato.titulo)}</h2>
    <div class="grade-conceitos reveal">
      ${conceitos.map((c) => `<div class="conceito-card"><span>${esc(rotuloConceito(conteudo, c))}</span>${estrelas(save.maestria[c] || 0)}</div>`).join("")}
    </div>
    <p>${t("fim.xpAto", { xp: num(xpAto) })}</p>
    <div class="mapa-mini">${conteudo.manifest.atos.map((a, i) =>
      `<span class="mapa-mini-ato ${i <= atoIdx ? "feito" : ""}">${i + 1}</span>`).join("")}</div>
    <button class="btn btn-primario btn-grande" id="btn-fim-ato">
      ${proximoAto ? t("fim.seguirPara", { titulo: esc(proximoAto.titulo) }) : t("fim.seguir")}</button>`)}
  </div>`;
}

export function telaFimRun(ctx) {
  const { save, conteudo, sessao } = ctx;
  const tier = sessao.tierFechamento || save.run_atual.tier;
  const st = engine.estatisticasRun(save, conteudo, tier);
  const fxNova = engine.faixa(save, conteudo);
  const proximoTier = Math.min(tier + 1, 3);
  const desbloqueou = engine.tierDesbloqueado(save, conteudo) > tier;
  // preview: 1º exercício do 1º nível, tier atual vs próximo
  const exAtual = exerciciosDe(conteudo, "variaveis", tier)[0];
  const exProx = exerciciosDe(conteudo, "variaveis", proximoTier)[0];
  const piso = engine.pisoXp(conteudo, tier);
  return `<div class="tela-centro tela-run">
    ${janela(t("jan.fimRun"), `
    <h1>${t("fim.run", { n: tier })}</h1>
    <div class="faixa-cerimonia">${iconeFaixa(fxNova, 120)}<div class="brilho"></div></div>
    <h2>${esc(nomeFaixa(fxNova))}</h2>
    <p>${t("fim.runStats", { xp: num(st.xp), pct: Math.round(st.pctSemDica * 100), n: num(st.resolvidos) })}</p>
    ${!desbloqueou && tier < 3 ? `<p class="peq">${t("fim.destravar", { run: proximoTier, piso: num(piso), xp: num(save.xp_total) })}</p>` : ""}
    ${tier < 3 && exAtual && exProx ? `<div class="preview-tier">
      <p class="peq">${t("fim.preview")}</p>
      <div class="preview-lado-a-lado">
        <div><span class="rotulo">${t("fim.tier", { t: tier })}</span><div class="preview-md">${md(exAtual.enunciado_md.slice(0, 280))}</div></div>
        <div><span class="rotulo">${t("fim.tier", { t: proximoTier })}</span><div class="preview-md">${md(exProx.enunciado_md.slice(0, 280))}</div></div>
      </div></div>` : ""}
    <div class="linha-botoes">
      ${tier < 3 && desbloqueou ? `<button class="btn btn-primario btn-grande" id="btn-comecar-run">${t("fim.comecarRun", { n: proximoTier })}</button>` : ""}
      <button class="btn" id="btn-run-mapa">${t("voltar.mapa")}</button>
    </div>`)}
  </div>`;
}

export function telaFaixaPreta(ctx) {
  const { save, conteudo } = ctx;
  const st1 = engine.estatisticasRun(save, conteudo, 1);
  const st2 = engine.estatisticasRun(save, conteudo, 2);
  const st3 = engine.estatisticasRun(save, conteudo, 3);
  const total = st1.resolvidos + st2.resolvidos + st3.resolvidos;
  return `<div class="tela-preta">
    <h1>${t("preta.titulo")}</h1>
    <p class="preta-sub">${t("preta.sub")}</p>
    <div class="preta-stats">
      <div><span class="num">${num(save.xp_total)}</span><span>XP</span></div>
      <div><span class="num">${total}</span><span>${t("preta.exercicios")}</span></div>
      <div><span class="num">${num(save.streak.melhor)}</span><span>${t("preta.melhorStreak")}</span></div>
      <div><span class="num">${Math.round(engine.pctConceitos3Estrelas(save, conteudo) * 100)}%</span><span>${t("preta.conceitos")}</span></div>
    </div>
    <div class="linha-botoes">
      <button class="btn" id="btn-certificado">${t("certificado.botao")}</button>
      <button class="btn btn-fantasma" id="btn-modo-dan">${t("modo.dan")}</button>
      <button class="btn btn-fantasma" id="btn-modo-livre">${t("modo.livre")}</button>
      <button class="btn btn-fantasma" id="btn-preta-mapa">${t("voltar.mapa")}</button>
    </div>
  </div>`;
}
// (a tela preta fica direto sobre o wallpaper — texto com sombra via CSS)

// ---------------------------------------------------------------------------
// modo livre / dan
// ---------------------------------------------------------------------------
export function telaLivre(ctx) {
  const { save, conteudo } = ctx;
  let html = `<div class="mapa-topo reveal"><h1>${t("livre.titulo")}</h1>
    <a class="btn" href="#/mapa">${t("voltar")}</a></div>
    <p class="sub reveal">${t("livre.sub")}</p>`;
  for (const [atoIdx, ato] of conteudo.manifest.atos.entries()) {
    html += `<section class="ato"><h2>${esc(ato.titulo)}</h2>`;
    for (const nivel of ato.niveis) {
      html += `<h3 class="livre-nivel">${esc(nivel.titulo)}</h3><div class="livre-grade">`;
      for (const tier of [1, 2, 3]) {
        for (const ex of exerciciosDe(conteudo, nivel.slug, tier)) {
          const feito = save.historico[ex.id]?.resolvido;
          html += `<button class="livre-ex ${feito ? "completo" : ""}" data-exid="${ex.id}"
            title="${esc(ex.titulo)}">T${tier}·${ex.id.slice(-2)}</button>`;
        }
      }
      html += `</div>`;
    }
    html += `</section>`;
  }
  return `<div class="mapa">${janela(t("jan.livre"), html)}</div>`;
}

export function telaDan(ctx) {
  const { save, conteudo } = ctx;
  const bossIdx = save.dan.vencidos;
  const desafios = engine.danDesafios(conteudo, bossIdx);
  const dans = Math.floor(save.dan.vencidos / 3);
  let listras = "";
  for (let i = 0; i < Math.min(dans, 6); i++) listras += "▮";
  return `<div class="mapa">${janela(t("jan.dan"), `<div class="mapa-topo"><h1>${t("dan.titulo")} ${listras ? `<span class="chip">${listras}</span>` : ""}</h1>
    <a class="btn" href="#/mapa">${t("voltar")}</a></div>
    <p class="sub">${t("dan.sub", { n: num(bossIdx + 1) })}</p>
    <div class="niveis">
      ${desafios.map((ex, i) => {
        const node = conteudo.trilhaPorSlug.get(ex.nivel);
        const feito = ctx.sessao.danFeitos?.includes(ex.id);
        return `<button class="nivel ${feito ? "completo" : ""}" data-exid="${ex.id}">
          <span class="nivel-nome">${feito ? ICONE_CHECK : `${i + 1}.`} ${esc(ex.titulo)}</span>
          <span class="nivel-info">${esc(node.atoTitulo)}</span></button>`;
      }).join("")}
    </div>`)}
  </div>`;
}

// ---------------------------------------------------------------------------
// Laboratório Web (exercícios interativos)
// ---------------------------------------------------------------------------
// rótulos traduzidos (js/i18n.js): categoria, trilha e trilha curta. Chave
// desconhecida (conteúdo novo sem rótulo) cai no próprio slug.
const comFallback = (chave, bruto) => {
  const r = t(chave);
  return r === chave ? bruto : r;
};
const rotuloCategoria = (cat) => comFallback("cat." + cat, cat);
const nomeNivelWeb = (nv) => comFallback("web.nivel." + nv, nv);
// rótulos curtos p/ as tabs da taskbar (os longos empurravam Lab Web/Progresso
// para fora da barra)
const nomeNivelWebCurto = (nv) => comFallback("web.curto." + nv, nv);

// Resumo rastreável do Laboratório Web: quantos exercícios foram concluídos,
// quanto XP já foi ganho neles e qual é o PRÓXIMO exercício não resolvido
// (na mesma ordem das trilhas exibidas — alimenta o botão "Continuar").
function resumoLaboratorio(save, conteudo) {
  let feitos = 0;
  let xpGanho = 0;
  let proximo = null;
  for (const exs of conteudo.webPorNivel.values()) {
    for (const ex of exs) {
      const h = save.historico[ex.id];
      if (h && h.resolvido) {
        feitos += 1;
        xpGanho += h.xp_ganho || 0;
      } else if (!proximo) {
        proximo = ex;
      }
    }
  }
  return { total: conteudo.webLab.length, feitos, xpGanho, proximo };
}

// ícone .exe por CATEGORIA do exercício web (mesma folha A2 do desktop)
const ICONE_CATEGORIA_WEB = {
  "conserte-back": "icone-16",   // terminal verde (o servidor)
  "conserte-front": "icone-05",  // besouro (bug na tela)
  "construa-front": "icone-12",  // engrenagens e sliders
  "ligue": "icone-07",           // rede de nós (front ↔ back)
};

// O Laboratório é uma ÁREA DE TRABALHO igual à do Dojo: cada exercício é um
// programa .exe sobre o papel de parede, as trilhas viram tabs na taskbar e o
// hero mora numa janela leia-me. Mesmos contratos: .nivel[data-webid].
export function telaLaboratorio(ctx) {
  const { save, conteudo } = ctx;
  const { total, feitos, xpGanho, proximo } = resumoLaboratorio(save, conteudo);
  const pct = total ? Math.round((feitos / total) * 100) : 0;
  const completo = total > 0 && feitos >= total;

  const trilhas = [...conteudo.webPorNivel.entries()];
  const idx = Math.min(Math.max(ctx.labTab || 0, 0), Math.max(trilhas.length - 1, 0));
  const [nivel, exs] = trilhas[idx] || ["", []];
  const nome = nomeNivelWeb(nivel);
  const feitosTrilha = exs.filter((e) => save.historico[e.id]?.resolvido).length;

  let icones = "";
  exs.forEach((ex, i) => {
    const h = save.historico[ex.id];
    const feito = !!(h && h.resolvido);
    const cat = rotuloCategoria(ex.categoria);
    const rotulo = feito
      ? t("lab.rotulo.feito", { titulo: ex.titulo, cat, xp: num(h.xp_ganho) })
      : t("lab.rotulo.aberto", { titulo: ex.titulo, cat, xp: num(ex.xp) });
    icones += `<button class="no nivel ${feito ? "feito" : ""}" data-webid="${esc(ex.id)}"
      style="--i:${i}" title="${esc(cat)} · ${esc(ex.titulo)}" aria-label="${esc(rotulo)}">
      <span class="no-icone">
        <img class="no-img" src="${assetUrl(ICONE_CATEGORIA_WEB[ex.categoria] || "icone-24")}" alt="">
        ${feito ? `<img class="no-badge" src="${assetUrl("icone-20")}" alt="${t("concluido")}">` : ""}
      </span>
      <span class="no-etiqueta">
        <span class="no-nome"><span class="no-rotulo">${esc(ex.titulo)}</span></span>
        <span class="no-sub">${feito ? `+${num(h.xp_ganho)} XP` : `${ex.xp} XP`}</span>
      </span>
    </button>`;
  });

  const cta = completo
    ? `<p class="chip lab-selo" role="status">${ICONE_CHECK} ${t("lab.completo", { total })}</p>`
    : proximo
      ? `<button class="btn btn-primario nivel lab-continuar" data-webid="${esc(proximo.id)}"
          aria-label="${t("lab.continuar.aria", { titulo: esc(proximo.titulo) })}">
          ${t("continuar.alvo", { titulo: esc(proximo.titulo) })}</button>`
      : "";

  const leiame = janela(t("jan.lab"), `
    <h1>${t("lab.titulo")}</h1>
    <p class="sub">${t("lab.sub")}</p>
    <p class="lab-hero-num">${t("lab.num", { feitos, total })}
      <span class="peq">${t("lab.xp", { xp: num(xpGanho) })}</span></p>
    <div class="lab-prog" role="progressbar" aria-valuemin="0" aria-valuemax="${total}"
      aria-valuenow="${feitos}"
      aria-label="${t("lab.prog.aria", { feitos, total })}">
      <div class="lab-prog-fill" style="width:${pct}%"></div>
    </div>
    <div class="linha-botoes">${cta}
      <a class="btn btn-peq" href="#/mapa">${t("lab.areaTrabalho")}</a></div>`, "janela-leiame");

  return `<div class="mapa desktop">
    ${leiame}
    <div class="mapa-atos">
      <section class="mapa-ato">
        <h2>${esc(nome)} — ${feitosTrilha}/${exs.length}</h2>
        <div class="mapa-niveis">${icones}</div>
      </section>
    </div>
  </div>`;
}

const ROTULO_ARQ = { html: "HTML", css: "CSS", js: "JavaScript" };

export function telaExercicioWeb(ctx) {
  const { save, conteudo, sessao } = ctx;
  const ex = sessao.exAtual;
  const h = save.historico[ex.id];
  const editaveis = ex.editaveis || ["js"];
  const codigoSalvo = (h && h.web_codigo) || null;

  let explicacao = ex.explicacao_md ? `<div class="explicacao">${md(ex.explicacao_md)}</div>` : "";

  let dicasHtml = "";
  for (let i = 1; i <= 3; i++) {
    if (sessao.dicaRevelada >= i) {
      dicasHtml += `<div class="dica"><span class="dica-num">${t("dica.n", { i })}</span> ${md(ex.dicas[i - 1])}</div>`;
    }
  }
  const botoesDica = [];
  for (let i = sessao.dicaRevelada + 1; i <= 3; i++) {
    botoesDica.push(`<button class="btn btn-peq" data-dica="${i}" id="btn-dica-${i}" title="${t("dica.title", { i, custo: custoLongo(i) })}">${t("dica.n", { i })} · ${custoCurto(i)}</button>`);
  }

  // editores só para arquivos editáveis; fixos ficam como referência colapsada
  const fixos = ["html", "css", "js"].filter((t) => !editaveis.includes(t) && (ex["web_" + t] || "").trim());
  const editores = editaveis.map((t) => {
    const val = (codigoSalvo && codigoSalvo[t] != null) ? codigoSalvo[t] : (ex["web_" + t] || "");
    return `<div class="web-arquivo">
      <div class="web-arquivo-cab"><span class="rotulo">${ROTULO_ARQ[t]}</span>
        <button class="btn btn-peq btn-fantasma" data-restaurar="${t}">${tr("restaurar")}</button></div>
      <div class="editor-caixa"><textarea id="web-ed-${t}" class="editor web-editor" spellcheck="false"
        autocomplete="off" autocapitalize="off" data-arq="${t}" aria-label="${tr("web.editor.aria", { arq: ROTULO_ARQ[t] })}">${esc(val)}</textarea></div>
    </div>`;
  }).join("");

  const fixosHtml = fixos.length ? `<details class="web-fixos"><summary>${t("web.fixos", { lista: fixos.map((a) => ROTULO_ARQ[a]).join(", ") })}</summary>
    ${fixos.map((t) => `<div class="rotulo">${ROTULO_ARQ[t]}</div><pre class="cod"><code>${esc(ex["web_" + t] || "")}</code></pre>`).join("")}</details>` : "";

  return `<div class="web-layout">
    <section class="ex-enunciado">
      ${janela(t("jan.briefing"), `
        <div class="ex-cab">
          <a class="btn btn-fantasma btn-peq" href="#/web">${t("web.voltarLab")}</a>
          <span class="chip">${esc(rotuloCategoria(ex.categoria))}</span>
        </div>
        <div class="aula-cab">
          <img class="tutor-retrato tutor-mini" src="${assetUrl("tutor-gato")}" alt="${t("ex.cato.alt")}">
          <div><h2>${esc(ex.titulo)}</h2><p class="peq aula-fala">${esc(nomeNivelWeb(ex.nivel))}</p></div>
        </div>
        <div class="linha-botoes dicas-botoes">
          ${botoesDica.join("")}
          <button class="btn btn-peq" id="btn-solucao" title="${t("web.solucao.title")}">${t("ex.solucao")}</button>
          <button class="btn btn-peq" id="btn-pular" title="${t("web.pular.title")}">${t("web.pular")}</button>
        </div>
        ${dicasArea(dicasHtml)}
        ${explicacao}
        <div class="enunciado">${md(ex.enunciado_md)}</div>
        ${fixosHtml}`)}
    </section>
    <section class="web-trabalho">
      ${janela(t("jan.editorWeb"), `
      <div class="cao-codigo">
        <img class="tutor-retrato tutor-mini" src="${assetUrl("tutor-cao")}"
          alt="${t("ex.billy.alt")}"
          title="${t("ex.billy.title")}">
        <div class="web-editores">${editores}</div>
      </div>
      <div id="vk-slot" class="vk-slot"></div>
      <div class="editor-acoes">
        <button class="btn btn-primario" id="btn-rodar">${t("rodar.testes")} <span class="atalho">Ctrl+Enter</span></button>
        <button class="btn btn-primario oculto" id="btn-proximo">${t("proximo")} <span class="atalho">Enter</span></button>
      </div>
      <!-- a microfala do Billy vem DEPOIS do Rodar: ela aparecia entre o
           editor e o botão e o empurrava 40px para baixo da taskbar -->
      <p class="billy-fala oculto" id="billy-fala" aria-live="polite"></p>
      <div class="resultados" id="resultados" aria-live="polite"></div>`)}
      ${janela(t("jan.preview"), `
      <div class="web-preview-caixa">
        <div class="web-preview-cab"><span class="rotulo">${t("web.preview")}</span><span class="peq">${t("web.preview.sub")}</span></div>
        <iframe id="web-preview" class="web-preview" sandbox="allow-scripts allow-forms" title="${t("web.preview.title")}"></iframe>
      </div>`)}
    </section>
  </div>`;
}

export function painelResultadoWeb(resultado, xpGanho) {
  const r = resultado;
  if (r.status === "erro") {
    return `<div class="res res-erro"><p class="res-titulo">${t("res.web.travou")}</p><p class="mono peq">${esc(r.erroPagina || "")}</p></div>`;
  }
  let html = "";
  const falhas = r.testes.filter((t) => !t.passou);
  if (r.status === "ok") {
    html += `<div class="res res-ok">
      <span class="check-svg"><svg viewBox="0 0 32 32"><path class="check-path" d="M6 17l7 7 13-15" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/></svg></span>
      <span class="res-titulo">${t("res.web.ok")}</span>
      ${xpGanho > 0 ? `<span class="xp-badge" id="xp-badge">+${num(xpGanho)} XP</span>` : ""}
    </div>`;
  } else {
    html += `<div class="res res-falha"><p class="res-titulo">${t("res.web.falha", { falhas: falhas.length, total: r.testes.length })}</p>
      ${r.erroPagina ? `<p class="peq" style="color:var(--erro)">${esc(r.erroPagina)}</p>` : ""}</div>`;
  }
  let primeira = true;
  for (const t of r.testes) {
    if (t.passou) continue;
    const aberto = primeira; primeira = false;
    html += `<details class="teste teste-falha" ${aberto ? "open" : ""}>
      <summary>✗ ${esc(t.nome)}</summary>
      ${t.mensagem ? `<p>${esc(t.mensagem)}</p>` : ""}
      ${t.esperado !== null ? `<div class="esp-obt">
        <div><span class="rotulo">${tr("esperado")}</span><pre class="cod"><code>${esc(t.esperado)}</code></pre></div>
        <div><span class="rotulo">${tr("obtido")}</span><pre class="cod"><code>${esc(t.obtido)}</code></pre></div></div>` : ""}
    </details>`;
  }
  const oks = r.testes.filter((t) => t.passou);
  if (oks.length && r.status !== "ok") {
    html += `<details class="teste"><summary>${t("res.web.jaPassam", { n: oks.length })}</summary><ul>${oks.map((t) => `<li>✓ ${esc(t.nome)}</li>`).join("")}</ul></details>`;
  }
  return html;
}

// ---------------------------------------------------------------------------
// modais
// ---------------------------------------------------------------------------
export function modalSolucao(ex) {
  return `<div class="modal-fundo" id="modal-fundo">
    <div class="modal" role="dialog" aria-modal="true">
      <h3>${t("modal.solucao.titulo")}</h3>
      <p>${t("modal.solucao.texto")}</p>
      <div class="linha-botoes">
        <button class="btn" id="btn-modal-cancelar">${t("modal.solucao.cancelar")}</button>
        <button class="btn btn-primario" id="btn-modal-confirmar">${t("modal.solucao.confirmar")}</button>
      </div>
    </div>
  </div>`;
}

// código exibido num <pre>: sem linhas em branco no topo (o <pre> as mostra
// como uma 1ª linha vazia) nem espaço sobrando no fim
function aparar(codigo) {
  return String(codigo ?? "").replace(/^(?:[ \t]*\r?\n)+/, "").replace(/\s+$/, "");
}

export function modalSolucaoCorpo(ex) {
  return `<div class="modal-fundo" id="modal-fundo">
    <div class="modal modal-larga" role="dialog" aria-modal="true">
      <h3>${t("modal.solucao.corpo.titulo", { titulo: esc(ex.titulo) })}</h3>
      <pre class="cod"><code>${esc(aparar(ex.solucao_referencia))}</code></pre>
      <p class="peq">${t("modal.solucao.corpo.nota")}</p>
      <div class="linha-botoes"><button class="btn btn-primario" id="btn-modal-fechar">${t("modal.entendi")}</button></div>
    </div>
  </div>`;
}

export function modalConfig(ctx) {
  const c = ctx.save.config;
  const tema = c.tema;
  const som = c.som !== false;
  const part = c.particulas !== false;
  return `<div class="modal-fundo" id="modal-fundo">
    <div class="modal" role="dialog" aria-modal="true">
      <h3>${t("cfg.titulo")}</h3>
      <div class="config-linha"><span>${t("idioma.rotulo")}</span>
        <select id="sel-idioma" aria-label="${t("idioma.rotulo")}">
          <option value="pt" lang="pt-BR" ${ctx.lang === "pt" ? "selected" : ""}>${t("idioma.pt")}</option>
          <option value="en" lang="en" ${ctx.lang === "en" ? "selected" : ""}>${t("idioma.en")}</option>
        </select></div>
      <div class="config-linha"><span>${t("cfg.tema")}</span>
        <select id="sel-tema">
          <option value="claro" ${tema === "claro" ? "selected" : ""}>${t("cfg.tema.claro")}</option>
          <option value="escuro" ${tema === "escuro" ? "selected" : ""}>${t("cfg.tema.escuro")}</option>
          <option value="auto" ${tema === "auto" ? "selected" : ""}>${t("cfg.tema.auto")}</option>
        </select></div>
      <div class="config-linha"><span>${t("cfg.som")}</span>
        <label class="switch"><input type="checkbox" id="chk-som" ${som ? "checked" : ""}><span class="trilho"></span></label></div>
      <div class="config-linha"><span>${t("cfg.particulas")}</span>
        <label class="switch"><input type="checkbox" id="chk-part" ${part ? "checked" : ""}><span class="trilho"></span></label></div>
      <div class="config-linha"><span>${t("cfg.reduzir")}</span>
        <label class="switch"><input type="checkbox" id="chk-reduz" ${c.reduzir === true ? "checked" : ""}><span class="trilho"></span></label></div>
      <div class="config-linha"><span>${t("cfg.estimulos")}</span>
        <button class="btn btn-peq" id="btn-testar-estimulos" data-som-proprio>${t("cfg.testar")}</button></div>
      <div class="config-linha"><span>${t("cfg.save")}</span>
        <span class="linha-botoes">
          <button class="btn btn-peq" id="btn-exportar">${t("cfg.exportar")}</button>
          <label class="btn btn-peq">${t("cfg.importar")}<input type="file" id="input-importar" accept=".json" hidden></label>
          <button class="btn btn-peq btn-perigo" id="btn-resetar">${t("cfg.zerar")}</button>
        </span></div>
      <p class="peq">${t("cfg.rodape")}</p>
      <div class="linha-botoes"><button class="btn" id="btn-modal-fechar">${t("fechar")}</button></div>
    </div>
  </div>`;
}

// ---------------------------------------------------------------------------
// certificado imprimível
// ---------------------------------------------------------------------------
export function abrirCertificado(ctx) {
  const { save, conteudo } = ctx;
  const total = Object.values(save.historico).filter((h) => h.resolvido).length;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<!doctype html><html lang="${t("cert.lang")}"><head><meta charset="utf-8">
    <title>${t("cert.title")}</title>
    <style>
      body{font-family:Georgia,serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f5f2ea;color:#222}
      .cert{border:6px double #8a7040;padding:60px 80px;text-align:center;background:#fffdf7;max-width:640px}
      h1{font-size:34px;margin:0 0 8px} .sub{letter-spacing:3px;text-transform:uppercase;font-size:12px;color:#8a7040}
      .stats{margin-top:24px;font-size:14px;color:#555} .faixa{font-size:20px;margin-top:16px}
      @media print{body{background:#fff}}
    </style></head><body><div class="cert">
    <p class="sub">${t("cert.sub")}</p>
    <h1>${t("cert.h1")}</h1>
    <p>${t("cert.trilha")}</p>
    <p class="faixa">${t("cert.faixa")}</p>
    <p class="stats">${t("cert.stats", { n: num(total), xp: num(save.xp_total), streak: num(save.streak.melhor) })}</p>
    <p class="stats">${t("cert.rodape")}</p>
    </div><script>window.print()<\/script></body></html>`);
  w.document.close();
}

// ---------------------------------------------------------------------------
// helpers de editor
// ---------------------------------------------------------------------------
export function ligarEditor(textarea, gutter, aoRodar) {
  const atualizarGutter = () => {
    if (!gutter) return;
    const n = textarea.value.split("\n").length;
    let s = "";
    for (let i = 1; i <= n; i++) s += i + "\n";
    gutter.textContent = s;
    gutter.scrollTop = textarea.scrollTop;
  };
  textarea.addEventListener("input", atualizarGutter);
  if (gutter) textarea.addEventListener("scroll", () => (gutter.scrollTop = textarea.scrollTop));
  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const ini = textarea.selectionStart;
      const fim = textarea.selectionEnd;
      // setRangeText + evento "input": preserva o undo do navegador (Ctrl+Z)
      // e avisa quem escuta — sem isso o preview do Lab Web não atualizava
      // depois de indentar (só na próxima tecla).
      textarea.setRangeText("    ", ini, fim, "end");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      atualizarGutter();
    } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      aoRodar();
    }
  });
  atualizarGutter();
}

export function irParaLinha(textarea, linha) {
  const linhas = textarea.value.split("\n");
  let pos = 0;
  for (let i = 0; i < Math.min(linha - 1, linhas.length); i++) pos += linhas[i].length + 1;
  textarea.focus();
  textarea.setSelectionRange(pos, pos + (linhas[linha - 1] || "").length);
}
