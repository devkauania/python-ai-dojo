// Renderização das telas + micro-animações. Sem framework, sem imagens,
// sem webfonts. Ícones = SVG inline minúsculos. Tudo em PT-BR.

import * as engine from "./engine.js";
import { exerciciosDe } from "./content.js";
import {
  ICONE_NIVEL, ICONE_CADEADO, ICONE_GRAFICO, ICONE_LAB, ICONE_ALVO,
  ICONE_FAIXA_MODO, ICONE_RAIO, ICONE_CHECK, ICONE_CONFIG,
  ICONE_SETA_DIR, AVATAR_CUBO, iconeFaixa,
} from "./icones.js";
import { cuboPlataforma, cuboSvg } from "./mundo.js";
import { GLOSSARIO } from "./glossario.js";

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
const CUSTO_CURTO = ["", "grátis", "–50%", "XP 0"];

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
    const def = GLOSSARIO[bruto];
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
  return `<span class="estrelas" title="${n} de ${max} estrelas">${s}</span>`;
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
        title="${esc(ato.titulo)}" aria-pressed="${i === ctx.atoTab}">Ato ${i + 1}</button>`).join("");
  } else if (ctx.tela && ctx.tela.nome === "laboratorio") {
    const ativa = ctx.labTab || 0;
    tabsAto = [...conteudo.webPorNivel.keys()].map((nv, i) =>
      `<button class="tb-app tb-ato ${i === ativa ? "ativo" : ""}" data-lab-tab="${i}"
        title="${esc(NIVEL_WEB[nv] || nv)}" aria-pressed="${i === ativa}">${esc(NIVEL_WEB_CURTO[nv] || nv)}</button>`
    ).join("");
  }
  const hora = new Date().toTimeString().slice(0, 5);
  const tecladoAberto = document.body.classList.contains("vk-aberto");

  return `<header class="hdr">
    <button class="tb-start" id="btn-config" title="Start — Configurações" aria-label="Start — Configurações">Start</button>
    <a class="tb-app" href="#/mapa" title="Área de trabalho" aria-label="Dojo — área de trabalho"><img src="${assetUrl("taskbar-07")}" alt=""><span class="tb-rotulo">Dojo</span></a>
    ${tabsAto}
    <div class="hdr-meio">
      <a class="tb-app" href="#/web" title="Lab Web" aria-label="Lab Web"><img src="${assetUrl("taskbar-10")}" alt=""><span class="tb-rotulo">Lab Web</span></a>
      <a class="tb-app" href="#/progresso" title="Progresso" aria-label="Progresso"><img src="${assetUrl("taskbar-09")}" alt=""><span class="tb-rotulo">Progresso</span></a>
      ${progressoNivel}
    </div>
    <span class="tb-espaco"></span>
    <div class="hdr-dir">
      <button class="tb-app ${tecladoAberto ? "ativo" : ""}" id="btn-teclado"
        title="Teclado virtual (teclas que faltam no seu teclado: \\ | { } ~ ...)"
        aria-label="Alternar teclado virtual" aria-pressed="${tecladoAberto}">
        <img src="${assetUrl("keycap")}" alt=""><span class="tb-rotulo">Teclado</span></button>
      ${streak > 0 ? `<span class="hdr-streak" id="hdr-streak">${ICONE_RAIO}${num(streak)}</span>` : ""}
      ${fila > 0 ? `<a class="hdr-fila" href="#/mapa">${num(fila)} rev</a>` : ""}
      <span class="hdr-xp" id="hdr-xp" title="XP total"><img src="${assetUrl("taskbar-12")}" alt="">${num(save.xp_total)} XP</span>
      <span class="tb-relogio" id="tb-relogio">${hora.slice(0, 2)}<i class="pisca">:</i>${hora.slice(3)}</span>
    </div>
  </header>`;
}

// ---------------------------------------------------------------------------
// telas de boas-vindas / save corrompido / erro fatal
// ---------------------------------------------------------------------------
export function telaErroFatal(msg) {
  return `<div class="tela-centro">
    ${janela("erro.log", `
      <p><strong>O ambiente Python não carregou.</strong></p>
      <p>O jogo precisa de internet no primeiro carregamento (o Python roda no seu
      navegador, mas é baixado do CDN uma única vez). Verifique a conexão e recarregue.</p>
      <p class="mono peq">${esc(msg || "")}</p>
      <button class="btn btn-primario" id="btn-recarregar">Recarregar</button>`)}
  </div>`;
}

export function telaCorrompido() {
  return `<div class="tela-centro">
    ${janela("save.dat — erro de leitura", `
      <p><strong>O save local não pôde ser lido.</strong></p>
      <p>Você pode começar de novo ou importar um save exportado antes.</p>
      <div class="linha-botoes">
        <button class="btn btn-primario" id="btn-reset-corrompido">Começar do zero</button>
        <label class="btn">Importar save<input type="file" id="input-import-corrompido" accept=".json" hidden></label>
      </div>`)}
  </div>`;
}

export function telaBoasVindas(novo, recap) {
  return `<div class="tela-centro tela-bv">
    ${janela("bem-vindo.txt — Python AI Dojo", `
      <h1 class="bv-titulo">Python AI Dojo</h1>
      ${novo
        ? `<p class="sub bv-sub">Python para IA, um exercício de cada vez. Código de verdade rodando no seu navegador, com feedback imediato.</p>`
        : `<p class="sub bv-sub">Bem-vindo de volta.${recap ? " " + esc(recap) : ""}</p>`}
      <!-- o botão fica na coluna do Cato (ao lado do retrato), não numa linha
           própria abaixo: a janela termina onde o conteúdo termina -->
      <div class="tutor-fala bv-fala">
        <img class="tutor-retrato" src="${assetUrl("tutor-gato")}" alt="Cato, seu tutor">
        <div class="bv-lado">
          <p class="peq">O Cato te espera na área de trabalho. Cada nível é um programa:
          clique duas… não, UMA vez já abre.</p>
          <p class="bv-cta"><button class="btn btn-primario btn-grande" id="btn-comecar" data-som-proprio>${novo ? "Começar" : "Continuar"}</button></p>
        </div>
      </div>`, "janela-bv")}
  </div>`;
}

// ---------------------------------------------------------------------------
// mapa da trilha
// ---------------------------------------------------------------------------
const NOMES_FAIXA = { branca: "Faixa branca", azul: "Faixa azul", roxa: "Faixa roxa", marrom: "Faixa marrom", preta: "Faixa preta" };

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
      title="${esc(ato.titulo)} · ${esc(nivel.titulo)}${bloqueado ? " (bloqueado)" : ""}">
      <span class="no-icone">
        <img class="no-img" src="${assetUrl(iconeDoNivel(nivel.slug))}" alt="">
        ${bloqueado ? `<img class="no-cadeado" src="${assetUrl("icone-18")}" alt="bloqueado">` : ""}
        ${completo ? `<img class="no-badge" src="${assetUrl("icone-20")}" alt="concluído">` : ""}
      </span>
      <span class="no-etiqueta">
        <span class="no-nome"><span class="no-rotulo">${esc(nivel.titulo)}</span></span>
        <span class="no-sub">${completo ? "concluído" : bloqueado ? "bloqueado" : `${p.feitos}/${p.total}`}</span>
      </span>
    </button>`;
  }
  const atosHtml = `<section class="mapa-ato">
    <h2>Ato ${atoIdx + 1} — ${esc(ato.titulo)}</h2>
    <div class="mapa-niveis">${niveisHtml}</div></section>`;

  let resto = "";
  if (fx === "marrom") {
    const chk = engine.checklistPreta(save, conteudo);
    resto += `<div class="painel"><h3>Checklist da faixa preta</h3>
      <ul class="checklist">
        <li class="${chk.boss5T3 ? "ok" : ""}">Vencer o BOSS FINAL no tier 3</li>
        <li class="${chk.conceitosOk ? "ok" : ""}">≥ 80% dos conceitos com 3 estrelas (hoje: ${Math.round(chk.pctConceitos * 100)}%)</li>
        <li class="${chk.filaVazia ? "ok" : ""}">Fila de revisão vazia (hoje: ${chk.filaTamanho})</li>
      </ul></div>`;
  }
  if (fx === "preta") {
    resto += `<div class="linha-botoes"><button class="btn" id="btn-certificado">Certificado imprimível</button>
      <button class="btn btn-fantasma" id="btn-modo-dan">Modo Dan</button>
      <button class="btn btn-fantasma" id="btn-modo-livre">Modo Livre</button></div>`;
  }

  const leiame = janela("leia-me.txt", `
    <h1>Python AI Dojo</h1>
    <p class="sub">Run ${num(save.run_atual.numero)} · ${esc(NOMES_FAIXA[fx])} · ${num(save.xp_total)} XP</p>
    <div class="linha-botoes">
      ${proximo ? `<button class="btn btn-primario" id="btn-continuar">Continuar: ${esc(proxNode.titulo)}</button>` : ""}
      <button class="btn btn-peq" id="btn-progresso">Progresso</button>
      <button class="btn btn-peq" id="btn-laboratorio">Lab Web · ${feitosWeb}/${(conteudo.webLab || []).length}</button>
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

  let html = `<div class="trilha-topo reveal"><div class="trilha-titulo"><h1>Seu progresso</h1>
    <p class="sub">Como você evolui pela prática.</p></div><a class="btn btn-fantasma" href="#/mapa">‹ Voltar</a></div>`;

  html += `<div class="progresso-grade reveal">
    <div class="stat-card"><div class="num">${num(save.xp_total)}</div><div class="lab">XP total</div></div>
    <div class="stat-card"><div class="num">${resolvidos}</div><div class="lab">exercícios resolvidos</div></div>
    <div class="stat-card"><div class="num">${resolvidos ? Math.round((semDica / resolvidos) * 100) : 0}%</div><div class="lab">sem dica</div></div>
    <div class="stat-card"><div class="num">${num(save.streak.melhor)}</div><div class="lab">melhor streak</div></div>
    <div class="stat-card"><div class="num">${conceitosTres}/${totalConceitos}</div><div class="lab">conceitos ★★★</div></div>
    <div class="stat-card"><div class="num">${num(dias)}</div><div class="lab">dias praticados</div></div>
  </div>`;

  html += `<h3 class="reveal">Evolução dos seus tempos <span class="peq">— comparando as duas resoluções mais recentes</span></h3>`;
  if (!evol.length) {
    html += `<p class="sub">Resolva um exercício mais de uma vez (na fila de revisão ou no modo livre) para ver aqui o quanto você acelerou.</p>`;
  } else {
    html += `<div class="evolucao">`;
    for (const e of evol.slice(0, 20)) {
      const delta = e.ant.t - e.rec.t;
      const melhorou = delta > 0;
      html += `<div class="evo-linha">
        <span class="evo-nome">${esc(e.titulo)}</span>
        <span class="evo-tempos">${fmtTempo(e.ant.t)} → ${fmtTempo(e.rec.t)}</span>
        <span class="${melhorou ? "tempo-melhora" : "tempo-piora"}">${melhorou ? "▼ " + fmtTempo(Math.abs(delta)) + " mais rápido" : delta === 0 ? "igual" : "▲ " + fmtTempo(Math.abs(delta))}</span>
        <span class="peq" title="seu recorde">recorde ${fmtTempo(e.best)}</span>
      </div>`;
    }
    html += `</div>`;
  }
  return `<div class="mapa">${janela("progresso.log", html)}</div>`;
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
      explicacao = `<details class="explicacao-rever"><summary>Rever a explicação do nível</summary>
        <div class="explicacao">${md(primeira.explicacao_md)}</div></details>`;
    }
  }

  const custoDica = ["Grátis", "Grátis", "–50% XP", "XP = 0"];
  let dicasHtml = "";
  for (let i = 1; i <= 3; i++) {
    if (sessao.dicaRevelada >= i) {
      dicasHtml += `<div class="dica"><span class="dica-num">Dica ${i}</span> ${md(ex.dicas[i - 1])}</div>`;
    }
  }
  const botoesDica = [];
  for (let i = sessao.dicaRevelada + 1; i <= 3; i++) {
    botoesDica.push(`<button class="btn btn-peq" data-dica="${i}" id="btn-dica-${i}" title="Dica ${i}: ${custoDica[i]}">Dica ${i} · ${CUSTO_CURTO[i]}</button>`);
  }

  const contexto = sessao.emRevisao
    ? `<span class="chip chip-rev">Revisão · caixa ${sessao.emRevisao.caixaAtual || "?"}</span>`
    : sessao.modoLivre
      ? `<span class="chip">Modo livre · sem XP em rejogada</span>`
      : sessao.modoDan
        ? `<span class="chip">Modo Dan</span>`
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
      ${janela("leia-me.txt — aula do Cato", `
        <div class="ex-cab">
          <a class="btn btn-fantasma btn-peq" href="#/mapa">‹ Área de trabalho</a>
          ${contexto}
        </div>
        <div class="aula-cab">
          <img class="tutor-retrato tutor-mini" src="${assetUrl("tutor-gato")}" alt="Cato, o professor">
          <div><h2>${esc(ex.titulo)}</h2><p class="peq aula-fala">${node ? `${esc(node.atoTitulo)} · ${esc(node.titulo)} · ` : ""}tier ${ex.tier} · ${idx + 1}/${exsNivel.length}</p></div>
        </div>
        <div class="linha-botoes dicas-botoes">
          ${botoesDica.join("")}
          <button class="btn btn-peq" id="btn-solucao" title="Ver a solução: o XP deste exercício vira 0 e ele entra na fila de revisão">Solução · XP 0</button>
          <button class="btn btn-peq" id="btn-pular" title="Pular: XP 0 neste exercício e ele entra na fila de revisão">Pular · XP 0</button>
        </div>
        ${dicasArea(dicasHtml)}
        ${explicacao}
        <div class="enunciado">${md(ex.enunciado_md)}</div>`)}
    </section>
    <section class="ex-editor">
      ${janela("resolucao.py — Billy", `
      <div class="cao-codigo">
        <img class="tutor-retrato tutor-mini" src="${assetUrl("tutor-cao")}"
          alt="Billy, seu parceiro de código"
          title="Billy — o código é o balão dele; de vez em quando ele solta uma linha">
        <div class="editor-caixa">
          <div class="editor-gutter" id="editor-gutter">1</div>
          <textarea id="editor" class="editor" spellcheck="false" autocomplete="off"
            autocapitalize="off" aria-label="Editor de código Python">${esc(codigo)}</textarea>
        </div>
      </div>
      <div id="vk-slot" class="vk-slot"></div>
      <div class="editor-acoes">
        <button class="btn btn-primario" id="btn-rodar">Rodar <span class="atalho">Ctrl+Enter</span></button>
        <button class="btn btn-fantasma btn-peq" id="btn-restaurar">Restaurar código inicial</button>
        <span class="pkg-status peq" id="pkg-status"></span>
        <button class="btn btn-primario oculto" id="btn-proximo">Próximo <span class="atalho">Enter</span></button>
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
      <p class="res-titulo">Erro de sintaxe na linha ${e.linha ?? "?"}</p>
      <p>${esc(e.mensagem_didatica)}</p>
      ${e.trecho ? `<pre class="cod"><code>${esc(e.trecho)}</code></pre>` : ""}
      <details><summary>ver erro completo</summary><p class="mono peq">${esc(e.mensagem_original)}</p></details>
    </div>`;
  }
  if (r.status === "erro_execucao") {
    const e = r.erro || {};
    return `<div class="res res-erro">
      <p class="res-titulo">Erro na execução${e.linha ? ` (linha ${e.linha})` : ""}</p>
      <p>${esc(e.mensagem_didatica)}</p>
      <details><summary>ver erro completo</summary><p class="mono peq">${esc(e.mensagem_original)}</p></details>
      ${r.stdout ? `<details><summary>saída até o erro</summary><pre class="cod"><code>${esc(r.stdout)}</code></pre></details>` : ""}
    </div>`;
  }
  if (r.status === "timeout") {
    const e = r.erro || {};
    return `<div class="res res-erro">
      <p class="res-titulo">Tempo esgotado</p>
      <p>${esc(e.mensagem_didatica || "Seu código passou do tempo limite.")}</p>
    </div>`;
  }
  // ok ou falha_teste: lista de testes
  const falhas = r.testes.filter((t) => !t.passou);
  const ocultosOk = r.testes.filter((t) => t.oculto && t.passou).length;
  let html = "";
  if (r.status === "ok") {
    html += `<div class="res res-ok">
      <span class="check-svg"><svg viewBox="0 0 32 32"><path class="check-path" d="M6 17l7 7 13-15" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/></svg></span>
      <span class="res-titulo">Todos os testes passaram!</span>
      ${xpGanho > 0 ? `<span class="xp-badge" id="xp-badge">+${num(xpGanho)} XP</span>` : ""}
    </div>`;
  } else {
    html += `<div class="res res-falha"><p class="res-titulo">${falhas.length} de ${r.testes.length} teste(s) falharam — sem penalidade, ajuste e rode de novo.</p></div>`;
  }
  let primeiraFalha = true;
  for (const t of r.testes) {
    if (t.passou) continue;
    const aberto = primeiraFalha;
    primeiraFalha = false;
    html += `<details class="teste teste-falha" ${aberto ? "open" : ""}>
      <summary>✗ ${esc(t.nome)}${t.oculto ? ' <span class="peq">(teste oculto)</span>' : ""}</summary>
      ${t.mensagem ? `<p>${esc(t.mensagem)}</p>` : ""}
      ${t.esperado !== null ? `<div class="esp-obt">
        <div><span class="rotulo">esperado</span><pre class="cod"><code>${esc(t.esperado)}</code></pre></div>
        <div><span class="rotulo">obtido</span><pre class="cod"><code>${esc(t.obtido)}</code></pre></div>
      </div>` : ""}
      ${t.diff ? `<details><summary>diff</summary><pre class="cod diff"><code>${esc(t.diff)}</code></pre></details>` : ""}
    </details>`;
  }
  const visiveisOk = r.testes.filter((t) => !t.oculto && t.passou);
  if (visiveisOk.length) {
    html += `<details class="teste"><summary>✓ ${visiveisOk.length} teste(s) visível(is) passaram</summary>
      <ul>${visiveisOk.map((t) => `<li>✓ ${esc(t.nome)}</li>`).join("")}</ul></details>`;
  }
  if (ocultosOk) html += `<p class="peq">✓ ${ocultosOk} teste(s) oculto(s) passaram.</p>`;
  if (r.stdout) {
    html += `<details class="teste"><summary>saída (print)</summary><pre class="cod"><code>${esc(r.stdout)}</code></pre></details>`;
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
  const resumoConceitos = node.conceitos.slice(0, 4).join(", ");
  return `<div class="tela-centro">
    <div class="cer-cubos" id="cer-cubos" aria-hidden="true"></div>
    ${janela("nivel_concluido.txt", `<div class="painel-fim">
      <p class="peq">${esc(node.atoTitulo)}</p>
      <h2>Nível concluído: ${esc(node.titulo)}</h2>
      <ul class="fim-lista">
        ${exs.map((e) => {
          const h = save.historico[e.id] || {};
          const semDica = h.resolvido && !h.dicas_usadas && !h.solucao_vista && !h.pulado;
          return `<li>${h.resolvido ? "✓" : "·"} ${esc(e.titulo)} ${semDica ? '<span class="peq">sem dica</span>' : ""}</li>`;
        }).join("")}
      </ul>
      <p>${num(xpNivel)} XP neste nível · streak ${num(save.streak.atual)}</p>
      <p><strong>Você agora sabe:</strong> ${esc(resumoConceitos)}.</p>
      <div class="barra-fim"><span class="barra-fim-fill" id="barra-fim"></span></div>
      <div class="linha-botoes">
        <button class="btn btn-primario" id="btn-fim-continuar">Continuar</button>
        ${revisoesDevidas.length ? `<button class="btn" id="btn-fim-revisar">Revisar agora (${revisoesDevidas.length}) · ~${revisoesDevidas.length + 1} min</button>` : ""}
        <button class="btn btn-fantasma" id="btn-fim-parar">Parar por aqui</button>
      </div>
      <p class="peq oculto" id="msg-parar">Bom ponto para pausar — tudo está salvo.</p>
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
    ${janela("ato_concluido.txt", `
    <h1>Ato concluído</h1>
    <h2>${esc(ato.titulo)}</h2>
    <div class="grade-conceitos reveal">
      ${conceitos.map((c) => `<div class="conceito-card"><span>${esc(c)}</span>${estrelas(save.maestria[c] || 0)}</div>`).join("")}
    </div>
    <p>${xpAto} XP no ato · boss vencido</p>
    <div class="mapa-mini">${conteudo.manifest.atos.map((a, i) =>
      `<span class="mapa-mini-ato ${i <= atoIdx ? "feito" : ""}">${i + 1}</span>`).join("")}</div>
    <button class="btn btn-primario btn-grande" id="btn-fim-ato">
      ${proximoAto ? `Seguir para ${esc(proximoAto.titulo)}` : "Seguir"}</button>`)}
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
    ${janela("run_completa.txt", `
    <h1>Run ${tier} completa</h1>
    <div class="faixa-cerimonia">${iconeFaixa(fxNova, 120)}<div class="brilho"></div></div>
    <h2>Faixa ${fxNova}</h2>
    <p>${st.xp} XP na run · ${Math.round(st.pctSemDica * 100)}% sem dica · ${st.resolvidos} exercícios</p>
    ${!desbloqueou && tier < 3 ? `<p class="peq">Para destravar a run ${proximoTier}, alcance ${piso} XP
      (você tem ${num(save.xp_total)}) — a fila de revisão recupera XP.</p>` : ""}
    ${tier < 3 && exAtual && exProx ? `<div class="preview-tier">
      <p class="peq">O mesmo problema, no próximo tier:</p>
      <div class="preview-lado-a-lado">
        <div><span class="rotulo">tier ${tier}</span><div class="preview-md">${md(exAtual.enunciado_md.slice(0, 280))}</div></div>
        <div><span class="rotulo">tier ${proximoTier}</span><div class="preview-md">${md(exProx.enunciado_md.slice(0, 280))}</div></div>
      </div></div>` : ""}
    <div class="linha-botoes">
      ${tier < 3 && desbloqueou ? `<button class="btn btn-primario btn-grande" id="btn-comecar-run">Começar run ${proximoTier}</button>` : ""}
      <button class="btn" id="btn-run-mapa">Voltar ao mapa</button>
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
    <h1>Faixa preta</h1>
    <p class="preta-sub">Dojo concluído — Python para IA</p>
    <div class="preta-stats">
      <div><span class="num">${num(save.xp_total)}</span><span>XP</span></div>
      <div><span class="num">${total}</span><span>exercícios</span></div>
      <div><span class="num">${num(save.streak.melhor)}</span><span>melhor streak</span></div>
      <div><span class="num">${Math.round(engine.pctConceitos3Estrelas(save, conteudo) * 100)}%</span><span>conceitos ★★★</span></div>
    </div>
    <div class="linha-botoes">
      <button class="btn" id="btn-certificado">Certificado imprimível</button>
      <button class="btn btn-fantasma" id="btn-modo-dan">Modo Dan</button>
      <button class="btn btn-fantasma" id="btn-modo-livre">Modo Livre</button>
      <button class="btn btn-fantasma" id="btn-preta-mapa">Voltar ao mapa</button>
    </div>
  </div>`;
}
// (a tela preta fica direto sobre o wallpaper — texto com sombra via CSS)

// ---------------------------------------------------------------------------
// modo livre / dan
// ---------------------------------------------------------------------------
export function telaLivre(ctx) {
  const { save, conteudo } = ctx;
  let html = `<div class="mapa-topo reveal"><h1>Modo Livre</h1>
    <a class="btn" href="#/mapa">Voltar</a></div>
    <p class="sub reveal">Qualquer exercício, qualquer tier. Rejogadas não dão XP.</p>`;
  for (const [atoIdx, ato] of conteudo.manifest.atos.entries()) {
    html += `<section class="ato"><h2>${esc(ato.titulo)}</h2>`;
    for (const nivel of ato.niveis) {
      html += `<h3 class="livre-nivel">${esc(nivel.titulo)}</h3><div class="livre-grade">`;
      for (const t of [1, 2, 3]) {
        for (const ex of exerciciosDe(conteudo, nivel.slug, t)) {
          const feito = save.historico[ex.id]?.resolvido;
          html += `<button class="livre-ex ${feito ? "completo" : ""}" data-exid="${ex.id}"
            title="${esc(ex.titulo)}">T${t}·${ex.id.slice(-2)}</button>`;
        }
      }
      html += `</div>`;
    }
    html += `</section>`;
  }
  return `<div class="mapa">${janela("modo_livre.exe", html)}</div>`;
}

export function telaDan(ctx) {
  const { save, conteudo } = ctx;
  const bossIdx = save.dan.vencidos;
  const desafios = engine.danDesafios(conteudo, bossIdx);
  const dans = Math.floor(save.dan.vencidos / 3);
  let listras = "";
  for (let i = 0; i < Math.min(dans, 6); i++) listras += "▮";
  return `<div class="mapa">${janela("modo_dan.exe", `<div class="mapa-topo"><h1>Modo Dan ${listras ? `<span class="chip">${listras}</span>` : ""}</h1>
    <a class="btn" href="#/mapa">Voltar</a></div>
    <p class="sub">Boss dan #${bossIdx + 1}: três desafios tier 3 de atos diferentes, em sequência.
    Cada 3 bosses vencidos = 1 dan. A recompensa é o desafio — sem XP.</p>
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
const ROTULO_CATEGORIA = {
  "conserte-back": "Consertar o back-end",
  "conserte-front": "Consertar o front-end",
  "construa-front": "Construir o front-end",
  "ligue": "Ligar front ↔ back",
};
const NIVEL_WEB = {
  eventos: "Eventos & DOM", css: "CSS & Layout", dom: "Manipulação do DOM", js: "Lógica JavaScript",
  dados: "Renderizar Dados", forms: "Formulários & Validação", ui: "Estado & Componentes",
};
// rótulos curtos p/ as tabs da taskbar (os longos empurravam Lab Web/Progresso
// para fora da barra)
const NIVEL_WEB_CURTO = {
  eventos: "Eventos", css: "CSS", dom: "DOM", js: "JS",
  dados: "Dados", forms: "Forms", ui: "Estado",
};

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
  const nome = NIVEL_WEB[nivel] || nivel;
  const feitosTrilha = exs.filter((e) => save.historico[e.id]?.resolvido).length;

  let icones = "";
  exs.forEach((ex, i) => {
    const h = save.historico[ex.id];
    const feito = !!(h && h.resolvido);
    const cat = ROTULO_CATEGORIA[ex.categoria] || ex.categoria;
    const rotulo = feito
      ? `${ex.titulo} — ${cat}, concluído, ${num(h.xp_ganho)} XP ganho`
      : `${ex.titulo} — ${cat}, não concluído, vale ${ex.xp} XP`;
    icones += `<button class="no nivel ${feito ? "feito" : ""}" data-webid="${esc(ex.id)}"
      style="--i:${i}" title="${esc(cat)} · ${esc(ex.titulo)}" aria-label="${esc(rotulo)}">
      <span class="no-icone">
        <img class="no-img" src="${assetUrl(ICONE_CATEGORIA_WEB[ex.categoria] || "icone-24")}" alt="">
        ${feito ? `<img class="no-badge" src="${assetUrl("icone-20")}" alt="concluído">` : ""}
      </span>
      <span class="no-etiqueta">
        <span class="no-nome"><span class="no-rotulo">${esc(ex.titulo)}</span></span>
        <span class="no-sub">${feito ? `+${num(h.xp_ganho)} XP` : `${ex.xp} XP`}</span>
      </span>
    </button>`;
  });

  const cta = completo
    ? `<p class="chip lab-selo" role="status">${ICONE_CHECK} Laboratório completo — ${total} de ${total} exercícios</p>`
    : proximo
      ? `<button class="btn btn-primario nivel lab-continuar" data-webid="${esc(proximo.id)}"
          aria-label="Continuar o laboratório no próximo exercício não concluído: ${esc(proximo.titulo)}">
          Continuar: ${esc(proximo.titulo)}</button>`
      : "";

  const leiame = janela("laboratorio.txt", `
    <h1>Laboratório Web</h1>
    <p class="sub">Conserte e construa telas de verdade, com preview ao vivo.</p>
    <p class="lab-hero-num"><strong>${feitos}</strong> de ${total} concluídos
      <span class="peq">· ${num(xpGanho)} XP no laboratório</span></p>
    <div class="lab-prog" role="progressbar" aria-valuemin="0" aria-valuemax="${total}"
      aria-valuenow="${feitos}"
      aria-label="Progresso geral do laboratório: ${feitos} de ${total} exercícios concluídos">
      <div class="lab-prog-fill" style="width:${pct}%"></div>
    </div>
    <div class="linha-botoes">${cta}
      <a class="btn btn-peq" href="#/mapa">Área de trabalho</a></div>`, "janela-leiame");

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
      dicasHtml += `<div class="dica"><span class="dica-num">Dica ${i}</span> ${md(ex.dicas[i - 1])}</div>`;
    }
  }
  const custoDica = ["", "Grátis", "–50% XP", "XP = 0"];
  const botoesDica = [];
  for (let i = sessao.dicaRevelada + 1; i <= 3; i++) {
    botoesDica.push(`<button class="btn btn-peq" data-dica="${i}" id="btn-dica-${i}" title="Dica ${i}: ${custoDica[i]}">Dica ${i} · ${CUSTO_CURTO[i]}</button>`);
  }

  // editores só para arquivos editáveis; fixos ficam como referência colapsada
  const fixos = ["html", "css", "js"].filter((t) => !editaveis.includes(t) && (ex["web_" + t] || "").trim());
  const editores = editaveis.map((t) => {
    const val = (codigoSalvo && codigoSalvo[t] != null) ? codigoSalvo[t] : (ex["web_" + t] || "");
    return `<div class="web-arquivo">
      <div class="web-arquivo-cab"><span class="rotulo">${ROTULO_ARQ[t]}</span>
        <button class="btn btn-peq btn-fantasma" data-restaurar="${t}">restaurar</button></div>
      <div class="editor-caixa"><textarea id="web-ed-${t}" class="editor web-editor" spellcheck="false"
        autocomplete="off" autocapitalize="off" data-arq="${t}" aria-label="Editor ${ROTULO_ARQ[t]}">${esc(val)}</textarea></div>
    </div>`;
  }).join("");

  const fixosHtml = fixos.length ? `<details class="web-fixos"><summary>Ver arquivos fixos (${fixos.map((t) => ROTULO_ARQ[t]).join(", ")}) — você não precisa editá-los</summary>
    ${fixos.map((t) => `<div class="rotulo">${ROTULO_ARQ[t]}</div><pre class="cod"><code>${esc(ex["web_" + t] || "")}</code></pre>`).join("")}</details>` : "";

  return `<div class="web-layout">
    <section class="ex-enunciado">
      ${janela("briefing.txt — aula do Cato", `
        <div class="ex-cab">
          <a class="btn btn-fantasma btn-peq" href="#/web">‹ Laboratório</a>
          <span class="chip">${esc(ROTULO_CATEGORIA[ex.categoria] || ex.categoria)}</span>
        </div>
        <div class="aula-cab">
          <img class="tutor-retrato tutor-mini" src="${assetUrl("tutor-gato")}" alt="Cato, o professor">
          <div><h2>${esc(ex.titulo)}</h2><p class="peq aula-fala">${esc(NIVEL_WEB[ex.nivel] || ex.nivel)}</p></div>
        </div>
        <div class="linha-botoes dicas-botoes">
          ${botoesDica.join("")}
          <button class="btn btn-peq" id="btn-solucao" title="Ver a solução: o XP deste exercício vira 0">Solução · XP 0</button>
          <button class="btn btn-peq" id="btn-pular" title="Pular este exercício">Pular</button>
        </div>
        ${dicasArea(dicasHtml)}
        ${explicacao}
        <div class="enunciado">${md(ex.enunciado_md)}</div>
        ${fixosHtml}`)}
    </section>
    <section class="web-trabalho">
      ${janela("editor.web — Billy", `
      <div class="cao-codigo">
        <img class="tutor-retrato tutor-mini" src="${assetUrl("tutor-cao")}"
          alt="Billy, seu parceiro de código"
          title="Billy — o código é o balão dele; de vez em quando ele solta uma linha">
        <div class="web-editores">${editores}</div>
      </div>
      <div id="vk-slot" class="vk-slot"></div>
      <div class="editor-acoes">
        <button class="btn btn-primario" id="btn-rodar">Rodar testes <span class="atalho">Ctrl+Enter</span></button>
        <button class="btn btn-primario oculto" id="btn-proximo">Próximo <span class="atalho">Enter</span></button>
      </div>
      <!-- a microfala do Billy vem DEPOIS do Rodar: ela aparecia entre o
           editor e o botão e o empurrava 40px para baixo da taskbar -->
      <p class="billy-fala oculto" id="billy-fala" aria-live="polite"></p>
      <div class="resultados" id="resultados" aria-live="polite"></div>`)}
      ${janela("preview.exe", `
      <div class="web-preview-caixa">
        <div class="web-preview-cab"><span class="rotulo">Preview ao vivo</span><span class="peq">atualiza enquanto você digita</span></div>
        <iframe id="web-preview" class="web-preview" sandbox="allow-scripts allow-forms" title="Preview"></iframe>
      </div>`)}
    </section>
  </div>`;
}

export function painelResultadoWeb(resultado, xpGanho) {
  const r = resultado;
  if (r.status === "erro") {
    return `<div class="res res-erro"><p class="res-titulo">Algo travou ao rodar os testes</p><p class="mono peq">${esc(r.erroPagina || "")}</p></div>`;
  }
  let html = "";
  const falhas = r.testes.filter((t) => !t.passou);
  if (r.status === "ok") {
    html += `<div class="res res-ok">
      <span class="check-svg"><svg viewBox="0 0 32 32"><path class="check-path" d="M6 17l7 7 13-15" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/></svg></span>
      <span class="res-titulo">Funcionou! Todos os testes passaram.</span>
      ${xpGanho > 0 ? `<span class="xp-badge" id="xp-badge">+${num(xpGanho)} XP</span>` : ""}
    </div>`;
  } else {
    html += `<div class="res res-falha"><p class="res-titulo">${falhas.length} de ${r.testes.length} teste(s) ainda falham — ajuste e rode de novo.</p>
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
        <div><span class="rotulo">esperado</span><pre class="cod"><code>${esc(t.esperado)}</code></pre></div>
        <div><span class="rotulo">obtido</span><pre class="cod"><code>${esc(t.obtido)}</code></pre></div></div>` : ""}
    </details>`;
  }
  const oks = r.testes.filter((t) => t.passou);
  if (oks.length && r.status !== "ok") {
    html += `<details class="teste"><summary>✓ ${oks.length} teste(s) já passam</summary><ul>${oks.map((t) => `<li>✓ ${esc(t.nome)}</li>`).join("")}</ul></details>`;
  }
  return html;
}

// ---------------------------------------------------------------------------
// modais
// ---------------------------------------------------------------------------
export function modalSolucao(ex) {
  return `<div class="modal-fundo" id="modal-fundo">
    <div class="modal" role="dialog" aria-modal="true">
      <h3>Ver a solução?</h3>
      <p>Ver a solução zera o XP deste exercício e o coloca na fila de revisão.
      Você poderá recuperar o XP ao resolvê-lo sozinho depois. Ver mesmo assim?</p>
      <div class="linha-botoes">
        <button class="btn" id="btn-modal-cancelar">Voltar ao exercício</button>
        <button class="btn btn-primario" id="btn-modal-confirmar">Ver a solução</button>
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
      <h3>Solução — ${esc(ex.titulo)}</h3>
      <pre class="cod"><code>${esc(aparar(ex.solucao_referencia))}</code></pre>
      <p class="peq">O exercício foi marcado como concluído e entrou na fila de revisão.</p>
      <div class="linha-botoes"><button class="btn btn-primario" id="btn-modal-fechar">Entendi</button></div>
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
      <h3>Configurações</h3>
      <div class="config-linha"><span>Tema</span>
        <select id="sel-tema">
          <option value="claro" ${tema === "claro" ? "selected" : ""}>Claro (pastel)</option>
          <option value="escuro" ${tema === "escuro" ? "selected" : ""}>Escuro</option>
          <option value="auto" ${tema === "auto" ? "selected" : ""}>Automático</option>
        </select></div>
      <div class="config-linha"><span>Som</span>
        <label class="switch"><input type="checkbox" id="chk-som" ${som ? "checked" : ""}><span class="trilho"></span></label></div>
      <div class="config-linha"><span>Partículas</span>
        <label class="switch"><input type="checkbox" id="chk-part" ${part ? "checked" : ""}><span class="trilho"></span></label></div>
      <div class="config-linha"><span>Reduzir animações</span>
        <label class="switch"><input type="checkbox" id="chk-reduz" ${c.reduzir === true ? "checked" : ""}><span class="trilho"></span></label></div>
      <div class="config-linha"><span>Estímulos</span>
        <button class="btn btn-peq" id="btn-testar-estimulos" data-som-proprio>Testar som e partículas</button></div>
      <div class="config-linha"><span>Save</span>
        <span class="linha-botoes">
          <button class="btn btn-peq" id="btn-exportar">Exportar</button>
          <label class="btn btn-peq">Importar<input type="file" id="input-importar" accept=".json" hidden></label>
          <button class="btn btn-peq btn-perigo" id="btn-resetar">Zerar progresso</button>
        </span></div>
      <p class="peq">Python AI Dojo · Pyodide 0.27.7 (Python 3.12) · seu código roda 100% no navegador.</p>
      <div class="linha-botoes"><button class="btn" id="btn-modal-fechar">Fechar</button></div>
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
  w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
    <title>Certificado — Python AI Dojo</title>
    <style>
      body{font-family:Georgia,serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f5f2ea;color:#222}
      .cert{border:6px double #8a7040;padding:60px 80px;text-align:center;background:#fffdf7;max-width:640px}
      h1{font-size:34px;margin:0 0 8px} .sub{letter-spacing:3px;text-transform:uppercase;font-size:12px;color:#8a7040}
      .stats{margin-top:24px;font-size:14px;color:#555} .faixa{font-size:20px;margin-top:16px}
      @media print{body{background:#fff}}
    </style></head><body><div class="cert">
    <p class="sub">Certificado</p>
    <h1>Dojo concluído — Python para IA</h1>
    <p>Trilha completa: fundamentos, dados e robustez, APIs e números, engenharia de IA.</p>
    <p class="faixa">Faixa preta</p>
    <p class="stats">${num(total)} exercícios resolvidos · ${num(save.xp_total)} XP · melhor streak ${num(save.streak.melhor)}</p>
    <p class="stats">Python AI Dojo — jogo local, código real, zero atalhos.</p>
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
