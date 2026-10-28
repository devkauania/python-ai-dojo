// O MUNDO "DESERTO DE PAPEL" do Dojo (r4): mapa horizontal orgânico, 2D+3D
// por perspectiva atmosférica — dunas em camadas que fundem com o céu ao
// longe e esquentam/escurecem perto, sol baixo com halo largo BORRADO de
// verdade, amarelo/creme que descansa a vista durante a leitura.
// ZERO polígonos aparentes: tudo é caminho de curvas (C/Q), silhuetas suaves
// e assimétricas. O glow segue a linguagem do site kauanmendesai: anel largo
// de baixa opacidade + ambiente difuso + forma duplicada borrada por trás —
// NUNCA linha branca definida, NUNCA núcleo branco.
// - cuboSvg: pedra polida do deserto (mesmo contrato {tam, cor, traco, dep}).
// - cuboPlataforma: platô de pedra/areia orgânico com topo elíptico (palco do
//   ícone gravado em tinta escura), flanco sombreado, sombra de contato.
//   Estados via glow dourado (anel + duplicata borrada pulsante no atual).
// - montarMundo: fundo (céu + sol + 3 cordilheiras na bruma + calor), meio
//   (2 cordões de dunas + marcos orgânicos por distrito: oásis, rocha-arco,
//   mesas, noite nascendo com fogueira), frente (duna contínua, capim seco,
//   pedras, pegadas, motes de poeira dourada), trilha de caravana pontilhada
//   com progresso dourado (#trilha-fill, mesma mecânica de dasharray).
// - iniciarSuavidade: Lenis global sincronizado com o GSAP.
// - revelarTela/cerimoniaCubos: reveals com stagger e pedras que assentam
//   com poeira dourada.
// Fallbacks: sem GSAP, tela estreita ou "reduzir animações" => scroll nativo
// com snap, sem parallax, arte estática digna. Nada aqui depende de rede.
// Performance: no MÁXIMO 1 <filter feGaussianBlur> por svg (sol no fundo,
// halo da trilha na frente, duplicata do monte nos nós ativos); todo o resto
// do glow é radial/linearGradient MUITO gradual, definido uma vez por <defs>
// (prefixo g4-) e reusado por url(#id).

// ---------------------------------------------------------------------------
// suavidade global (Lenis + GSAP ticker)
// ---------------------------------------------------------------------------
let _lenis = null;
let _tickerFn = null;

function reduzAtivo() {
  return document.documentElement.getAttribute("data-reduz") === "1";
}

export function iniciarSuavidade() {
  // Dojo OS r8.5: o jogo rola DENTRO do tubo (#tv-scroll, scroll nativo).
  // O Lenis interceptava a roda no window e mataria o scroll do contêiner —
  // aposentado; um CRT não tem smooth-scroll mesmo.
  return null;
}

export function atualizarSuavidade() {
  if (reduzAtivo()) {
    if (_lenis) {
      try { _lenis.destroy(); } catch { /* ok */ }
      if (_tickerFn && window.gsap) window.gsap.ticker.remove(_tickerFn);
      _lenis = null;
      _tickerFn = null;
    }
  } else if (!_lenis) {
    iniciarSuavidade();
  }
}

export function rolarPara(alvo, opts = {}) {
  const tubo = document.getElementById("tv-scroll");
  if (typeof alvo === "number") {
    if (tubo) tubo.scrollTo({ top: alvo, behavior: opts.imediato ? "auto" : "smooth" });
    else window.scrollTo({ top: alvo, behavior: opts.imediato ? "auto" : "smooth" });
  } else if (alvo && alvo.scrollIntoView) {
    alvo.scrollIntoView({ behavior: opts.imediato ? "auto" : "smooth", block: "center" });
  }
}

// ---------------------------------------------------------------------------
// helpers de curva + tokens com fallback (DNA do site: papel creme + dourado
// #C4A35A "sparingly for highlights"; styles.css é a fonte da verdade, os
// fallbacks só evitam quebra se um tema antigo estiver em cache)
// ---------------------------------------------------------------------------
const OURO = "var(--ouro, var(--amarelo-deep, #C4A35A))";
const HALO = "var(--halo, rgba(196, 163, 90, 0.30))";
const glowD = (a) => `var(--d${a + 1}-glow, var(--d${a + 1}-soft))`;

// contador p/ ids únicos de gradiente (cada svg tem o seu <defs>)
let _gid = 0;

// determinístico (mesma cena a cada visita)
const rnd = (i, sal) => { const v = Math.sin(i * 127.1 + sal * 311.7) * 43758.5453; return v - Math.floor(v); };

// caminho suave por pontos (Q com ponto médio: curvas contínuas, sem quinas)
function caminhoSuave(pts) {
  if (pts.length < 3) {
    return "M " + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" L ");
  }
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    d += ` Q ${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
  }
  const u = pts[pts.length - 1];
  d += ` L ${u[0].toFixed(1)} ${u[1].toFixed(1)}`;
  return d;
}

// cordilheira de duna: silhueta fechada de cristas suaves e assimétricas
// (deterministica) que desce até o pé do svg — o "3D" vem de empilhar essas
// cristas com opacidades/cores diferentes (perspectiva atmosférica)
function crista(wTot, base, amp, sal, passoX, hFundo) {
  const pts = [];
  for (let x = -60; x <= wTot + 60 + passoX; x += passoX) {
    const r = rnd(Math.round(x / passoX) + 3, sal);
    pts.push([x, base - (0.2 + 0.8 * r) * amp]);
  }
  return `${caminhoSuave(pts)} L ${(wTot + 60).toFixed(1)} ${(hFundo + 20).toFixed(1)} L -60 ${(hFundo + 20).toFixed(1)} Z`;
}

// ---------------------------------------------------------------------------
// PEDRA POLIDA — miniatura de duna/seixo do deserto (boas-vindas/cerimônia).
// Mesmo contrato do antigo cubo: {tam, cor, traco, dep}; traco = aresta de
// apoio discreta (escura, jamais branca).
// ---------------------------------------------------------------------------
export function cuboSvg({ tam = 48, cor = "var(--laranja)", traco = "var(--laranja-edge)", dep = null } = {}) {
  const a = tam / 2;
  const d = dep == null ? tam * 0.62 : dep;
  const w = tam + 8, h = a + d + a / 2 + 8;
  const cx = w / 2;
  const id = `g4j${_gid++}-`;
  const yT = 7, yB = h - 7;
  const cy = (yT + yB) / 2, ry = (yB - yT) / 2;
  const rx = Math.min(a * 0.98, w / 2 - 3);
  const f = (v) => v.toFixed(1);
  // seixo assimétrico só de curvas (ombro mais alto à esquerda)
  const dPedra = `M ${f(cx - rx)} ${f(cy + ry * 0.15)}
    C ${f(cx - rx * 1.03)} ${f(cy - ry * 0.7)} ${f(cx - rx * 0.45)} ${f(yT)} ${f(cx + rx * 0.08)} ${f(yT + ry * 0.05)}
    C ${f(cx + rx * 0.7)} ${f(yT + ry * 0.14)} ${f(cx + rx * 1.02)} ${f(cy - ry * 0.35)} ${f(cx + rx * 0.94)} ${f(cy + ry * 0.4)}
    C ${f(cx + rx * 0.86)} ${f(yB - ry * 0.1)} ${f(cx + rx * 0.3)} ${f(yB)} ${f(cx - rx * 0.25)} ${f(yB - ry * 0.05)}
    C ${f(cx - rx * 0.8)} ${f(yB - ry * 0.14)} ${f(cx - rx)} ${f(cy + ry * 0.6)} ${f(cx - rx)} ${f(cy + ry * 0.15)} Z`;
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true" style="overflow:visible">
    <defs>
      <radialGradient id="${id}h" cx="50%" cy="50%" r="50%">
        <stop offset="0%" style="stop-color:${OURO}" stop-opacity="0.25"/>
        <stop offset="60%" style="stop-color:${OURO}" stop-opacity="0.10"/>
        <stop offset="100%" style="stop-color:${OURO}" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="${id}l" x1="0" y1="0" x2="0.8" y2="1">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.20"/>
        <stop offset="55%" stop-color="#ffffff" stop-opacity="0.04"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.16"/>
      </linearGradient>
      <radialGradient id="${id}s" cx="50%" cy="50%" r="50%">
        <stop offset="0%" style="stop-color:var(--ink)" stop-opacity="0.18"/>
        <stop offset="70%" style="stop-color:var(--ink)" stop-opacity="0.07"/>
        <stop offset="100%" style="stop-color:var(--ink)" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <ellipse cx="${f(cx)}" cy="${f(cy + ry * 0.3)}" rx="${f(rx * 1.9)}" ry="${f(ry * 1.45)}" fill="url(#${id}h)"/>
    <ellipse cx="${f(cx)}" cy="${f(yB + 2)}" rx="${f(rx * 1.05)}" ry="${f(Math.max(3, ry * 0.22))}" fill="url(#${id}s)"/>
    <path d="${dPedra}" style="fill:${cor}"/>
    <path d="${dPedra}" fill="url(#${id}l)"/>
    <ellipse cx="${f(cx + rx * 0.2)}" cy="${f(yT + ry * 0.5)}" rx="${f(rx * 0.4)}" ry="${f(ry * 0.28)}" fill="#ffffff" opacity="0.10"/>
    <path d="M ${f(cx - rx * 0.7)} ${f(yB - ry * 0.1)} Q ${f(cx)} ${f(yB + ry * 0.12)} ${f(cx + rx * 0.7)} ${f(yB - ry * 0.16)}" fill="none" style="stroke:${traco}" stroke-width="1.2" opacity="0.35"/>
  </svg>`;
}

// prepara o ícone para a gravação no platô: (1) injeta vector-effect nos
// traços (a gravação achata Y — sem isso o stroke deformaria) e (2) re-embrulha
// num <g> com os atributos de apresentação que viviam na tag <svg> raiz
// descartada (fill/stroke/linecap) — sem eles os paths caíam no default SVG
// (fill preto, stroke none) e o ícone sumia ou virava blob.
function iconeParaEngrave(svgIcone, largura = 2) {
  const miolo = String(svgIcone || "")
    .replace(/^[\s\S]*?<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "")
    .replace(/<(path|rect|circle|ellipse|line|polyline|polygon)\b/g, '<$1 vector-effect="non-scaling-stroke"');
  return `<g fill="none" stroke="currentColor" stroke-width="${largura}" stroke-linecap="round" stroke-linejoin="round">${miolo}</g>`;
}

// ---------------------------------------------------------------------------
// PLATÔ DE PEDRA/AREIA — nó da trilha: monte assimétrico só de curvas com
// topo elíptico plano (palco do ícone gravado em tinta escura), flanco com
// gradiente de sombreamento (volume), sombra de contato elíptica suave.
// Glow do site: anel largo de baixa opacidade + halo de chão em gradiente
// gradual + (atual/boss) duplicata do monte BORRADA por trás (.halo-base,
// pulsa via GSAP no montarMundo). Sem stroke branco em lugar nenhum.
// Bounding preservado: ~92x88 / boss 112x106.
// ---------------------------------------------------------------------------
export function cuboPlataforma({ icone = "", estado = "normal", boss = false } = {}) {
  const w = boss ? 112 : 92;
  const h = boss ? 106 : 88;
  const cx = w / 2;
  const yT = boss ? 40 : 30;        // centro do platô (elipse-palco)
  const rxT = boss ? 32 : 26;
  const ryT = boss ? 11 : 9;
  const yBase = boss ? 82 : 64;
  const id = `g4p${_gid++}-`;
  const f = (v) => v.toFixed(1);
  const escala = boss ? 1.9 : 1.5;
  const engraveT = `translate(${cx},${yT}) scale(1,0.62) scale(${escala}) translate(-12,-12)`;

  // silhueta do monte (assimétrica, base direita mais larga), só curvas
  const monte = (dy = 0) => `M ${f(cx - rxT - 8)} ${f(yBase + dy)}
    C ${f(cx - rxT - 10)} ${f(yBase + dy - (yBase - yT) * 0.55)} ${f(cx - rxT - 4)} ${f(yT + dy + 7)} ${f(cx - rxT + 1)} ${f(yT + dy + 1)}
    C ${f(cx - rxT * 0.5)} ${f(yT + dy - 4)} ${f(cx + rxT * 0.55)} ${f(yT + dy - 4)} ${f(cx + rxT - 1)} ${f(yT + dy + 1)}
    C ${f(cx + rxT + 5)} ${f(yT + dy + 8)} ${f(cx + rxT + 11)} ${f(yBase + dy - (yBase - yT) * 0.4)} ${f(cx + rxT + 10)} ${f(yBase + dy)}
    C ${f(cx + rxT * 0.55)} ${f(yBase + dy + 5)} ${f(cx - rxT * 0.55)} ${f(yBase + dy + 5)} ${f(cx - rxT - 8)} ${f(yBase + dy)} Z`;

  if (estado === "bloqueado") {
    // semi-enterrado na areia: monte afundado, deriva de areia cobrindo a
    // base, tudo esmaecido — sem halo, sem anel
    const dy = boss ? 12 : 9;
    return `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true">
      <defs>
        <linearGradient id="${id}a" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style="stop-color:var(--areia-no, var(--superficie))" stop-opacity="0"/>
          <stop offset="100%" style="stop-color:var(--areia-no, var(--superficie))" stop-opacity="0.9"/>
        </linearGradient>
        <radialGradient id="${id}s" cx="50%" cy="50%" r="50%">
          <stop offset="0%" style="stop-color:var(--ink)" stop-opacity="0.14"/>
          <stop offset="70%" style="stop-color:var(--ink)" stop-opacity="0.05"/>
          <stop offset="100%" style="stop-color:var(--ink)" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <g opacity="0.6">
        <ellipse cx="${cx}" cy="${yBase + dy + 7}" rx="${rxT + 9}" ry="7" fill="url(#${id}s)"/>
        ${boss ? `<path d="M ${f(cx - rxT + 6)} ${f(yT + dy + 2)} C ${f(cx - rxT + 4)} ${f(yT + dy - 10)} ${f(cx - rxT + 2)} ${f(yT + dy - 18)} ${f(cx - rxT + 1)} ${f(yT + dy - 24)}" fill="none" style="stroke:var(--ink-faint)" stroke-width="2" stroke-linecap="round" opacity="0.7"/>` : ""}
        <path d="${monte(dy)}" style="fill:var(--ink-faint)" opacity="0.22"/>
        <ellipse cx="${cx}" cy="${yT + dy}" rx="${rxT}" ry="${ryT}" style="fill:var(--ink-faint)" opacity="0.18"/>
        <path d="M 2 ${f(yBase + dy - 4)} C ${f(cx * 0.5)} ${f(yBase + dy - 11)} ${f(cx * 1.3)} ${f(yBase + dy - 1)} ${w - 2} ${f(yBase + dy - 8)} L ${w - 2} ${h} L 2 ${h} Z" fill="url(#${id}a)"/>
        <g transform="translate(0,${dy})"><g transform="${engraveT}" style="color:var(--ink-faint)" opacity="0.65">${iconeParaEngrave(icone)}</g></g>
      </g>
    </svg>`;
  }

  // estados vivos: cor do monte + tinta do ícone + glow dourado do site
  const E_ = {
    normal:    { cor: "var(--areia-no, var(--superficie))", ink: "var(--ink-soft)", halo: HALO, haloOp: 0.30, blur: false, anel: false, selo: false },
    atual:     { cor: "var(--laranja)", ink: "#3d2408", halo: OURO, haloOp: 0.34, blur: true,  anel: true,  selo: false },
    feito:     { cor: "var(--verde)",   ink: "#26411f", halo: "var(--verde)", haloOp: 0.24, blur: false, anel: false, selo: true },
    boss:      { cor: "var(--amarelo)", ink: "#4a3407", halo: OURO, haloOp: 0.28, blur: true,  anel: false, selo: false },
    bossfeito: { cor: "var(--verde)",   ink: "#26411f", halo: "var(--verde)", haloOp: 0.26, blur: true,  anel: false, selo: true },
  };
  const e = E_[estado] || E_.normal;

  // ÚNICO filtro do svg (regra do r4): só existe quando o estado usa a
  // duplicata borrada (a técnica de halo do site)
  const filtro = e.blur
    ? `<filter id="${id}b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7"/></filter>`
    : "";
  const cyG = yT + 16;
  const haloDup = e.blur
    ? `<path class="halo-base" d="${monte()}" style="fill:${e.halo}" opacity="0.55" filter="url(#${id}b)" transform="translate(${cx} ${cyG}) scale(1.16 1.24) translate(${-cx} ${-cyG})"/>`
    : "";
  const classeHaloChao = e.blur ? "" : ' class="halo-base"';

  // estandarte do boss: mastro levemente curvo + bandeira de borda ondulada
  let bandeira = "";
  if (boss) {
    const px = cx - rxT + 6, py = yT + 2;
    const tx = px - 5, ty = 10;
    const corBand = e.selo ? "var(--verde)" : OURO;
    const dBand = `M ${tx} ${ty} C ${tx + 14} ${ty - 3} ${tx + 24} ${ty + 1} ${tx + 31} ${ty + 5} C ${tx + 23} ${ty + 9} ${tx + 13} ${ty + 12} ${tx + 1} ${ty + 10} Z`;
    bandeira = `
      <path d="M ${px} ${py} C ${px - 2} ${py - 12} ${tx + 1} ${ty + 12} ${tx} ${ty}" fill="none" style="stroke:var(--ink-soft)" stroke-width="2.2" stroke-linecap="round"/>
      <path d="${dBand}" style="fill:${corBand}" opacity="0.9"/>
      <path d="${dBand}" fill="url(#${id}t)" opacity="0.5"/>`;
  }

  const anel = e.anel
    ? `<ellipse cx="${cx}" cy="${yT}" rx="${rxT + 7}" ry="${ryT + 4}" fill="none" style="stroke:${OURO}" stroke-width="3.5" opacity="0.30"/>`
    : "";
  const selo = e.selo
    ? `<g opacity="0.9">
        <circle cx="${cx + rxT - 4}" cy="${yT + ryT + 8}" r="4.2" style="fill:${OURO}" opacity="0.85"/>
        <circle cx="${cx + rxT - 4}" cy="${yT + ryT + 8}" r="7" fill="none" style="stroke:${OURO}" stroke-width="1.6" opacity="0.30"/>
      </g>`
    : "";

  return `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true">
    <defs>
      ${filtro}
      <radialGradient id="${id}h" cx="50%" cy="50%" r="50%">
        <stop offset="0%" style="stop-color:${e.halo}" stop-opacity="${e.haloOp}"/>
        <stop offset="55%" style="stop-color:${e.halo}" stop-opacity="${(e.haloOp * 0.45).toFixed(3)}"/>
        <stop offset="100%" style="stop-color:${e.halo}" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="${id}s" cx="50%" cy="50%" r="50%">
        <stop offset="0%" style="stop-color:var(--ink)" stop-opacity="0.20"/>
        <stop offset="70%" style="stop-color:var(--ink)" stop-opacity="0.08"/>
        <stop offset="100%" style="stop-color:var(--ink)" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="${id}fl" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#000000" stop-opacity="0.16"/>
        <stop offset="45%" stop-color="#000000" stop-opacity="0"/>
        <stop offset="62%" stop-color="#ffffff" stop-opacity="0"/>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0.12"/>
      </linearGradient>
      <linearGradient id="${id}fv" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.10"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.14"/>
      </linearGradient>
      <linearGradient id="${id}t" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.20"/>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0.02"/>
      </linearGradient>
    </defs>
    <ellipse${classeHaloChao} cx="${cx}" cy="${yBase - 2}" rx="${rxT + 16}" ry="14" fill="url(#${id}h)"/>
    ${haloDup}
    <ellipse cx="${cx}" cy="${yBase + 8}" rx="${rxT + 10}" ry="7.5" fill="url(#${id}s)"/>
    <path d="${monte()}" style="fill:${e.cor}"/>
    <path d="${monte()}" fill="url(#${id}fl)"/>
    <path d="${monte()}" fill="url(#${id}fv)"/>
    <ellipse cx="${cx}" cy="${yT}" rx="${rxT}" ry="${ryT}" style="fill:${e.cor}"/>
    <ellipse cx="${cx}" cy="${yT}" rx="${rxT}" ry="${ryT}" fill="url(#${id}t)"/>
    ${bandeira}
    ${anel}
    ${selo}
    <g transform="${engraveT}" style="color:${e.ink}">${iconeParaEngrave(icone, 2.2)}</g>
  </svg>`;
}

// ---------------------------------------------------------------------------
// estado do mundo montado
// ---------------------------------------------------------------------------
let _mundo = null; // { st, tl, teardown: [] }

export function destruirMundo() {
  if (!_mundo) return;
  for (const fn of _mundo.teardown) { try { fn(); } catch { /* ok */ } }
  if (window.ScrollTrigger) {
    try { window.ScrollTrigger.getAll().forEach((t) => t.kill()); } catch { /* ok */ }
  }
  _mundo = null;
}

// ---------------------------------------------------------------------------
// montarMundo — lê o DOM da tela do mapa e constrói o mundo
// ---------------------------------------------------------------------------
let _pluginsOk = false;
function registrarPlugins() {
  if (_pluginsOk || !window.gsap) return;
  try {
    for (const p of ["ScrollTrigger", "MotionPathPlugin", "ScrollToPlugin"]) {
      if (window[p]) window.gsap.registerPlugin(window[p]);
    }
    _pluginsOk = true;
  } catch (e) { console.warn("gsap plugins:", e); }
}

export function montarMundo() {
  destruirMundo();
  registrarPlugins();
  const wrap = document.getElementById("mundo-wrap");
  const viewport = document.getElementById("mundo-viewport");
  const frente = document.getElementById("camada-frente");
  const meio = document.getElementById("camada-meio");
  const fundo = document.getElementById("camada-fundo");
  if (!wrap || !viewport || !frente) return;
  const nos = Array.from(frente.querySelectorAll(".no[data-slug]"));
  const N = nos.length;
  if (!N) return;

  // rebuild (resize) reaproveita o MESMO DOM: limpa o SVG da montagem
  // anterior e desfaz o modo nativo antes de decidir o modo de novo
  frente.querySelectorAll(":scope > svg").forEach((s) => s.remove());
  wrap.classList.remove("nativo");
  frente.style.position = "";

  _mundo = { st: null, tl: null, teardown: [] };
  const reduz = reduzAtivo();
  const gsap = window.gsap;
  const estreito = window.innerWidth < 900;
  const pinado = !reduz && !estreito && !!gsap && !!window.ScrollTrigger;
  const comPulso = !!gsap && !reduz; // pulso de luz viajando na trilha

  // o mundo É a tela: viewport = altura da janela menos o header, sem descida
  // vertical antes do scroll lateral (o pin engata no scroll 0)
  const hdr = document.querySelector("header.hdr");
  const hdrH = hdr ? hdr.offsetHeight : 0;
  viewport.style.height = Math.max(360, window.innerHeight - hdrH) + "px";

  const vw = viewport.clientWidth || window.innerWidth;
  const H = viewport.clientHeight || 520;

  // ---- layout dos nós: escada que sobe até o boss de cada ato ----
  const segX = 250;
  const x0 = Math.max(230, vw * 0.42);
  const xs = nos.map((_, i) => x0 + i * segX);
  const W = xs[N - 1] + Math.max(300, vw * 0.5);

  const porAto = new Map();
  nos.forEach((el, i) => {
    const ato = el.dataset.ato || "0";
    if (!porAto.has(ato)) porAto.set(ato, []);
    porAto.get(ato).push(i);
  });
  const solo = H * 0.64;
  const passo = Math.min(28, H * 0.05);
  const ys = new Array(N);
  for (const [, idxs] of porAto) {
    idxs.forEach((i, k) => { ys[i] = solo - k * passo; });
  }
  const ehBoss = nos.map((el) => el.classList.contains("no-boss"));
  const chao = (i) => ys[i] + (ehBoss[i] ? 50 : 42); // ponto da trilha sob o platô

  // ---- trilha de caravana: waypoints suaves (subidas em smoothstep + leve
  //      ondulação determinística) — x sempre monotônico, então a mecânica de
  //      comprimento/dasharray continua exata ----
  const pontos = [];
  const addSeg = (xa, ya, xb, yb, sal) => {
    const passos = Math.max(2, Math.round((xb - xa) / 62));
    for (let k = 1; k <= passos; k++) {
      const t = k / passos;
      const s = t * t * (3 - 2 * t);
      const fim = k === passos;
      const wob = fim ? 0 : (rnd(Math.round((xa + (xb - xa) * t) / 7), sal) - 0.5) * 8;
      pontos.push([xa + (xb - xa) * t, ya + (yb - ya) * s + wob]);
    }
  };
  const xIni = xs[0] - Math.min(170, x0 - 40);
  pontos.push([xIni, chao(0) + 5]);
  addSeg(xIni, chao(0) + 5, xs[0], chao(0), 21);
  for (let i = 1; i < N; i++) addSeg(xs[i - 1], chao(i - 1), xs[i], chao(i), 21 + i);
  addSeg(xs[N - 1], chao(N - 1), xs[N - 1] + 150, chao(N - 1) + 4, 87);

  // comprimento acumulado (p/ progresso exato via dasharray)
  let acum = 0;
  for (let i = 1; i < pontos.length; i++) {
    const [x1, y1] = pontos[i - 1], [x2, y2] = pontos[i];
    acum += Math.hypot(x2 - x1, y2 - y1);
  }
  const compAte = (x) => {
    let c = 0;
    for (let i = 1; i < pontos.length; i++) {
      const [x1, y1] = pontos[i - 1], [x2, y2] = pontos[i];
      const seg = Math.hypot(x2 - x1, y2 - y1);
      if (x >= x1 && x <= x2) return c + seg * ((x - x1) / Math.max(1, x2 - x1));
      c += seg;
    }
    return c;
  };
  const dTrilho = "M " + pontos.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" L ");

  // ---- distritos (x-range por ato) ----
  const atosIdx = Array.from(porAto.keys()).sort();
  const distritos = atosIdx.map((ato) => {
    const idxs = porAto.get(ato);
    return { ato: Number(ato), x1: xs[idxs[0]] - segX * 0.55, x2: xs[idxs[idxs.length - 1]] + segX * 0.55 };
  });
  const corDistrito = (a) => `var(--d${Math.min(a, 3) + 1})`;
  const distritoDe = (x) => {
    for (const d of distritos) if (x >= d.x1 && x < d.x2) return d.ato;
    return x < distritos[0].x1 ? distritos[0].ato : distritos[distritos.length - 1].ato;
  };

  // ---- sombras de contato dos nós: elipses em gradiente radial (sem blur) ----
  let sombras = "";
  nos.forEach((el, i) => {
    const aa = ehBoss[i] ? 54 : 42;
    sombras += `<ellipse class="sombra-no" data-i="${i}" cx="${xs[i]}" cy="${chao(i) + 6}" rx="${aa}" ry="${(aa * 0.26).toFixed(1)}" fill="url(#g4f-sombra)"/>`;
  });

  // ---- decoração de chão: capim seco em curvas + pedras arredondadas ----
  let decorFrente = "";
  let nDecor = 0;
  for (let i = 0; i < 44 && nDecor < 12; i++) {
    const x = x0 - 120 + rnd(i, 7) * (W - x0);
    const y = solo + 46 + rnd(i, 9) * (H - solo - 86);
    if (nos.some((_, k) => Math.abs(xs[k] - x) < 95 && Math.abs(ys[k] - y) < 120)) continue;
    const ato = Math.min(distritoDe(x), 3);
    const cd = corDistrito(ato);
    const xg = x.toFixed(1), yg = y.toFixed(1);
    nDecor++;
    if (rnd(i, 10) < 0.62) {
      // tufo de capim seco: lâminas curvas partindo da mesma base
      const hh = 10 + rnd(i, 11) * 10;
      decorFrente += `<g opacity="0.75">
        <ellipse cx="${xg}" cy="${yg}" rx="9" ry="2.5" fill="url(#g4f-sombra)"/>
        <path d="M ${xg} ${yg} q ${(-hh * 0.35).toFixed(1)} ${(-hh * 0.8).toFixed(1)} ${(-hh * 0.7).toFixed(1)} ${(-hh).toFixed(1)}" fill="none" style="stroke:var(--ink-faint)" stroke-width="1.4" stroke-linecap="round"/>
        <path d="M ${xg} ${yg} q ${(-hh * 0.1).toFixed(1)} ${(-hh).toFixed(1)} ${(-hh * 0.15).toFixed(1)} ${(-hh * 1.25).toFixed(1)}" fill="none" style="stroke:var(--ink-faint)" stroke-width="1.3" stroke-linecap="round" opacity="0.8"/>
        <path d="M ${xg} ${yg} q ${(hh * 0.2).toFixed(1)} ${(-hh * 0.9).toFixed(1)} ${(hh * 0.55).toFixed(1)} ${(-hh * 1.05).toFixed(1)}" fill="none" style="stroke:${cd}" stroke-width="1.4" stroke-linecap="round" opacity="0.7"/>
        <path d="M ${xg} ${yg} q ${(hh * 0.4).toFixed(1)} ${(-hh * 0.5).toFixed(1)} ${(hh * 0.8).toFixed(1)} ${(-hh * 0.6).toFixed(1)}" fill="none" style="stroke:var(--ink-faint)" stroke-width="1.2" stroke-linecap="round" opacity="0.7"/>
      </g>`;
    } else {
      // pedra arredondada (blob de curvas), assentada com sombrinha
      const pa = 8 + rnd(i, 12) * 8;
      decorFrente += `<g opacity="0.7">
        <ellipse cx="${xg}" cy="${(y + 1).toFixed(1)}" rx="${(pa * 1.1).toFixed(1)}" ry="3" fill="url(#g4f-sombra)"/>
        <path d="M ${(x - pa).toFixed(1)} ${yg}
          C ${(x - pa).toFixed(1)} ${(y - pa * 0.85).toFixed(1)} ${(x - pa * 0.25).toFixed(1)} ${(y - pa * 1.05).toFixed(1)} ${(x + pa * 0.3).toFixed(1)} ${(y - pa * 0.8).toFixed(1)}
          C ${(x + pa * 0.85).toFixed(1)} ${(y - pa * 0.55).toFixed(1)} ${(x + pa).toFixed(1)} ${(y - pa * 0.15).toFixed(1)} ${(x + pa * 0.9).toFixed(1)} ${yg}
          C ${(x + pa * 0.4).toFixed(1)} ${(y + pa * 0.16).toFixed(1)} ${(x - pa * 0.5).toFixed(1)} ${(y + pa * 0.16).toFixed(1)} ${(x - pa).toFixed(1)} ${yg} Z"
          style="fill:var(--ink-faint)" opacity="0.35"/>
      </g>`;
    }
  }

  // ---- motes de poeira dourada flutuando (pontinhos com halo gradiente) ----
  let motes = "";
  for (let i = 0; i < 10; i++) {
    const x = x0 - 80 + rnd(i, 61) * (W - x0);
    const y = H * 0.28 + rnd(i, 62) * H * 0.4;
    motes += `<g class="vagalume" transform="translate(${x.toFixed(1)},${y.toFixed(1)})" opacity="${(0.4 + rnd(i, 63) * 0.45).toFixed(2)}">
      <circle r="6" fill="url(#g4f-mote)"/>
      <circle r="1.5" style="fill:${OURO}" opacity="0.8"/>
    </g>`;
  }

  // defs da frente (prefixo g4f-): sombra, mote, dunas — e o ÚNICO filtro do
  // svg, reservado para o halo borrado da trilha de progresso
  const defsFrente = `<defs>
    <filter id="g4f-blur" x="-5%" y="-40%" width="110%" height="180%"><feGaussianBlur stdDeviation="6"/></filter>
    <filter id="g5-duna" x="-3%" y="-12%" width="106%" height="124%">
      <!-- textura de duna: borda deslocada por ruído (orgânico de verdade) +
           grão de areia multiplicado por cima — estático, calculado 1x -->
      <feTurbulence type="fractalNoise" baseFrequency="0.012 0.03" numOctaves="3" seed="7" result="ruido"/>
      <feDisplacementMap in="SourceGraphic" in2="ruido" scale="16" xChannelSelector="R" yChannelSelector="G" result="desloc"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="11" result="grao"/>
      <feColorMatrix in="grao" type="matrix" values="0 0 0 0 0.36  0 0 0 0 0.29  0 0 0 0 0.17  0 0 0 0.35 0" result="graoCor"/>
      <feComposite in="graoCor" in2="desloc" operator="in" result="graoClip"/>
      <feBlend in="desloc" in2="graoClip" mode="multiply"/>
    </filter>
    <filter id="g5-ondula" x="-4%" y="-20%" width="108%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency="0.02 0.09" numOctaves="2" seed="19" result="r2"/>
      <feDisplacementMap in="SourceGraphic" in2="r2" scale="9" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <radialGradient id="g4f-sombra" cx="50%" cy="50%" r="50%">
      <stop offset="0%" style="stop-color:var(--ink)" stop-opacity="0.16"/>
      <stop offset="70%" style="stop-color:var(--ink)" stop-opacity="0.07"/>
      <stop offset="100%" style="stop-color:var(--ink)" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="g4f-mote" cx="50%" cy="50%" r="50%">
      <stop offset="0%" style="stop-color:${OURO}" stop-opacity="0.5"/>
      <stop offset="55%" style="stop-color:${OURO}" stop-opacity="0.18"/>
      <stop offset="100%" style="stop-color:${OURO}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="g4f-duna1" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" style="stop-color:var(--ceu-horizonte, ${OURO})" stop-opacity="0.28"/>
      <stop offset="100%" style="stop-color:var(--ceu-horizonte, ${OURO})" stop-opacity="0.06"/>
    </linearGradient>
    <linearGradient id="g4f-duna2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" style="stop-color:var(--areia-frente, var(--superficie))" stop-opacity="0.96"/>
      <stop offset="100%" style="stop-color:var(--ink-faint)" stop-opacity="0.45"/>
    </linearGradient>
  </defs>`;

  // trilha: guia pontilhada + pegadas duplas defasadas + progresso dourado
  // (#trilha-fill, mesma mecânica de dasharray) com halo LARGO borrado por
  // baixo (#trilha-fill-halo = duplicata blur) + pulso viajante sutil.
  // Nada de linha sólida grossa, nada de branco.
  const svgFrente = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">
    ${defsFrente}
    <path d="${crista(W, solo + 4, 30, 31, 320, H)}" fill="url(#g4f-duna1)" filter="url(#g5-ondula)"/>
    <path d="${crista(W, solo + 42, 26, 33, 260, H)}" fill="url(#g4f-duna2)" filter="url(#g5-duna)"/>
    ${(() => {
      // ondulações de vento na areia: riscos longos e suaves seguindo a duna,
      // tinta rala, ondulados pelo filtro — o "penteado" do vento
      let riscos = "";
      for (let i = 0; i < 14; i++) {
        const ry = solo + 58 + rnd(i, 71) * (H - solo - 74);
        const rx = rnd(i, 72) * (W - 420);
        const rw = 200 + rnd(i, 73) * 340;
        const arco = 5 + rnd(i, 74) * 9;
        riscos += `<path d="M ${rx.toFixed(0)} ${ry.toFixed(0)} q ${(rw / 2).toFixed(0)} ${-arco.toFixed(0)} ${rw.toFixed(0)} 0" fill="none" style="stroke:var(--ink-soft)" stroke-width="1.1" stroke-linecap="round" opacity="${(0.05 + rnd(i, 75) * 0.05).toFixed(3)}"/>`;
      }
      return `<g filter="url(#g5-ondula)" aria-hidden="true">${riscos}</g>`;
    })()}
    <g id="g-sombras">${sombras}</g>
    ${decorFrente}
    <path d="${dTrilho}" fill="none" transform="translate(0,6)" style="stroke:var(--ink-soft)" stroke-width="2.8" stroke-linecap="round" stroke-dasharray="0.1 17" stroke-dashoffset="4" opacity="0.20"/>
    <path d="${dTrilho}" fill="none" transform="translate(3,9)" style="stroke:var(--ink-soft)" stroke-width="2.8" stroke-linecap="round" stroke-dasharray="0.1 17" stroke-dashoffset="12" opacity="0.16"/>
    <path id="trilha-base" d="${dTrilho}" fill="none" style="stroke:var(--ink-faint)" stroke-width="2.4" stroke-dasharray="0.1 9" stroke-linecap="round" opacity="0.55"/>
    <path id="trilha-fill-halo" d="${dTrilho}" fill="none" style="stroke:${OURO}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" opacity="0.30" filter="url(#g4f-blur)"/>
    <path id="trilha-fill" d="${dTrilho}" fill="none" style="stroke:${OURO}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>
    ${comPulso ? `<path class="trilha-pulso" d="${dTrilho}" fill="none" style="stroke:${OURO}" stroke-width="3.2" stroke-linecap="round" opacity="0.35"/>` : ""}
    ${motes}
  </svg>`;

  // ---- camada do meio (0.6x): cordões de dunas médias + MARCOS orgânicos ----
  const fM = 0.6, fF = 0.2;
  const dist = Math.max(1, W - vw);
  const Wm = vw + dist * fM;
  const Wf = vw + dist * fF;
  const mapear = (x, f) => (vw / 2) * (1 - f) + f * x;

  const defsMeio = `<defs>${[0, 1, 2, 3].map((ai) => `
    <linearGradient id="g4m-g${ai}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" style="stop-color:var(--d${ai + 1})" stop-opacity="0.42"/>
      <stop offset="100%" style="stop-color:var(--d${ai + 1})" stop-opacity="0.08"/>
    </linearGradient>
    <radialGradient id="g4m-h${ai}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" style="stop-color:${glowD(ai)}" stop-opacity="0.7"/>
      <stop offset="60%" style="stop-color:${glowD(ai)}" stop-opacity="0.26"/>
      <stop offset="100%" style="stop-color:${glowD(ai)}" stop-opacity="0"/>
    </radialGradient>`).join("")}
    <linearGradient id="g4m-duna1" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" style="stop-color:var(--ceu-horizonte, ${OURO})" stop-opacity="0.30"/>
      <stop offset="100%" style="stop-color:var(--ceu-horizonte, ${OURO})" stop-opacity="0.04"/>
    </linearGradient>
    <linearGradient id="g4m-duna2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" style="stop-color:var(--ink-faint)" stop-opacity="0.26"/>
      <stop offset="100%" style="stop-color:var(--ink-faint)" stop-opacity="0.05"/>
    </linearGradient>
    <linearGradient id="g4m-agua" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" style="stop-color:var(--rio-claro)" stop-opacity="0.85"/>
      <stop offset="100%" style="stop-color:var(--rio)" stop-opacity="0.55"/>
    </linearGradient>
    <radialGradient id="g4m-fogo" cx="50%" cy="60%" r="55%">
      <stop offset="0%" style="stop-color:var(--sol, #fff6e2)" stop-opacity="0.9"/>
      <stop offset="45%" style="stop-color:var(--laranja)" stop-opacity="0.7"/>
      <stop offset="100%" style="stop-color:var(--laranja)" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="g4m-noite" cx="50%" cy="100%" r="100%">
      <stop offset="0%" style="stop-color:var(--d4)" stop-opacity="0.20"/>
      <stop offset="100%" style="stop-color:var(--d4)" stop-opacity="0"/>
    </radialGradient>
  </defs>`;

  // palmeira curva (tronco em Q + folhas em arcos que caem)
  const palmeira = (pxN, pyN, s) => {
    const px = pxN.toFixed(1), py = pyN.toFixed(1);
    const tX = pxN + 14 * s, tY = pyN - 52 * s;
    const folha = (dx1, dy1, dx2, dy2, op) =>
      `<path d="M ${tX.toFixed(1)} ${tY.toFixed(1)} q ${(dx1 * s).toFixed(1)} ${(dy1 * s).toFixed(1)} ${(dx2 * s).toFixed(1)} ${(dy2 * s).toFixed(1)}" fill="none" style="stroke:var(--d1)" stroke-width="${(2.4 * s).toFixed(1)}" stroke-linecap="round" opacity="${op}"/>`;
    return `<g opacity="0.9">
      <path d="M ${px} ${py} q ${(4 * s).toFixed(1)} ${(-30 * s).toFixed(1)} ${(14 * s).toFixed(1)} ${(-52 * s).toFixed(1)}" fill="none" style="stroke:var(--ink-soft)" stroke-width="${(3 * s).toFixed(1)}" stroke-linecap="round"/>
      ${folha(-14, -12, -30, -4, 0.9)}
      ${folha(-8, -16, -20, -20, 0.8)}
      ${folha(2, -16, 10, -22, 0.85)}
      ${folha(12, -10, 26, -12, 0.9)}
      ${folha(14, -2, 30, 2, 0.8)}
      ${folha(-16, -4, -32, 6, 0.75)}
    </g>`;
  };

  const yM = Math.round(H * 0.74); // linha de terra dos marcos
  let decorMeio = `
    <path d="${crista(Wm, H * 0.66, 40, 51, 320, H)}" fill="url(#g4m-duna1)"/>
    <path d="${crista(Wm, H * 0.76, 34, 52, 260, H)}" fill="url(#g4m-duna2)"/>`;
  distritos.forEach((dd) => {
    const ai = Math.min(dd.ato, 3);
    const xc = Math.round(mapear((dd.x1 + dd.x2) / 2, fM));
    if (ai === 0) {
      // ato 1: OÁSIS — lagoa espelhada + palmeiras curvas
      decorMeio += `<g>
        <ellipse cx="${xc}" cy="${yM}" rx="150" ry="22" fill="url(#g4m-h0)"/>
        <ellipse cx="${xc + 8}" cy="${yM + 2}" rx="80" ry="13" fill="url(#g4m-agua)"/>
        <ellipse cx="${xc + 16}" cy="${yM}" rx="44" ry="6" style="fill:var(--rio-claro)" opacity="0.45"/>
        ${palmeira(xc - 66, yM + 4, 1)}
        ${palmeira(xc - 92, yM + 8, 0.72)}
        ${palmeira(xc + 96, yM + 6, 0.85)}
      </g>`;
    } else if (ai === 1) {
      // ato 2: ROCHA-ARCO erodida (um único contorno de curvas com vão)
      decorMeio += `<g>
        <ellipse cx="${xc}" cy="${yM}" rx="150" ry="22" fill="url(#g4m-h1)"/>
        <path d="M ${xc - 74} ${yM}
          C ${xc - 78} ${yM - 56} ${xc - 54} ${yM - 90} ${xc - 12} ${yM - 92}
          C ${xc + 32} ${yM - 94} ${xc + 58} ${yM - 62} ${xc + 56} ${yM}
          L ${xc + 32} ${yM}
          C ${xc + 34} ${yM - 44} ${xc + 20} ${yM - 62} ${xc - 8} ${yM - 62}
          C ${xc - 34} ${yM - 62} ${xc - 48} ${yM - 40} ${xc - 48} ${yM} Z" fill="url(#g4m-g1)"/>
        <path d="M ${xc - 66} ${yM - 34} C ${xc - 50} ${yM - 42} ${xc + 38} ${yM - 46} ${xc + 50} ${yM - 36}" fill="none" style="stroke:var(--d2)" stroke-width="1.4" opacity="0.3"/>
        <path d="M ${xc - 72} ${yM - 16} C ${xc - 56} ${yM - 22} ${xc + 42} ${yM - 24} ${xc + 54} ${yM - 16}" fill="none" style="stroke:var(--d2)" stroke-width="1.2" opacity="0.22"/>
        <path d="M ${xc + 84} ${yM} C ${xc + 84} ${yM - 18} ${xc + 96} ${yM - 26} ${xc + 108} ${yM - 22} C ${xc + 122} ${yM - 18} ${xc + 126} ${yM - 6} ${xc + 124} ${yM} Z" fill="url(#g4m-g1)" opacity="0.8"/>
      </g>`;
    } else if (ai === 2) {
      // ato 3: MESAS/falésias de ombros arredondados + estratos em curvas
      decorMeio += `<g>
        <ellipse cx="${xc}" cy="${yM}" rx="160" ry="22" fill="url(#g4m-h2)"/>
        <path d="M ${xc - 150} ${yM}
          C ${xc - 148} ${yM - 64} ${xc - 142} ${yM - 78} ${xc - 126} ${yM - 80}
          C ${xc - 100} ${yM - 83} ${xc - 74} ${yM - 82} ${xc - 60} ${yM - 77}
          C ${xc - 48} ${yM - 72} ${xc - 44} ${yM - 48} ${xc - 42} ${yM} Z" fill="url(#g4m-g2)"/>
        <path d="M ${xc - 10} ${yM}
          C ${xc - 8} ${yM - 52} ${xc - 2} ${yM - 64} ${xc + 14} ${yM - 66}
          C ${xc + 42} ${yM - 69} ${xc + 66} ${yM - 66} ${xc + 78} ${yM - 60}
          C ${xc + 88} ${yM - 55} ${xc + 92} ${yM - 36} ${xc + 94} ${yM} Z" fill="url(#g4m-g2)"/>
        <path d="M ${xc + 118} ${yM} C ${xc + 120} ${yM - 34} ${xc + 126} ${yM - 42} ${xc + 138} ${yM - 43} C ${xc + 152} ${yM - 44} ${xc + 160} ${yM - 38} ${xc + 162} ${yM} Z" fill="url(#g4m-g2)" opacity="0.75"/>
        <path d="M ${xc - 146} ${yM - 40} Q ${xc - 96} ${yM - 46} ${xc - 46} ${yM - 38}" fill="none" style="stroke:var(--d3)" stroke-width="1.3" opacity="0.3"/>
        <path d="M ${xc - 6} ${yM - 30} Q ${xc + 44} ${yM - 36} ${xc + 92} ${yM - 26}" fill="none" style="stroke:var(--d3)" stroke-width="1.2" opacity="0.25"/>
      </g>`;
    } else {
      // ato 4: NOITE nascendo — domo crepuscular, estrelas, fogueira com
      // fumaça curva
      const fx = xc + 40, fy = yM + 2;
      let estrelas = "";
      for (let k = 0; k < 6; k++) {
        const sxk = xc - 130 + Math.round(rnd(k, 55) * 260);
        const syk = Math.round(yM - 58 - rnd(k, 56) * 72);
        estrelas += `<circle cx="${sxk}" cy="${syk}" r="${(1 + rnd(k, 57) * 0.9).toFixed(1)}" style="fill:var(--d4)" opacity="${(0.5 + rnd(k, 58) * 0.4).toFixed(2)}"/>`;
      }
      decorMeio += `<g>
        <ellipse cx="${xc}" cy="${yM}" rx="170" ry="110" fill="url(#g4m-noite)"/>
        <ellipse cx="${xc}" cy="${yM}" rx="150" ry="22" fill="url(#g4m-h3)"/>
        ${estrelas}
        <ellipse cx="${fx}" cy="${fy}" rx="26" ry="7" fill="url(#g4m-fogo)" opacity="0.5"/>
        <path d="M ${fx - 8} ${fy} C ${fx - 9} ${fy - 3} ${fx - 3} ${fy - 5} ${fx} ${fy - 4} C ${fx + 3} ${fy - 5} ${fx + 9} ${fy - 3} ${fx + 8} ${fy} Z" style="fill:var(--ink-soft)" opacity="0.55"/>
        <path d="M ${fx} ${fy - 2} C ${fx - 6} ${fy - 8} ${fx - 3} ${fy - 16} ${fx} ${fy - 20} C ${fx + 3} ${fy - 16} ${fx + 6} ${fy - 8} ${fx} ${fy - 2} Z" fill="url(#g4m-fogo)"/>
        <path d="M ${fx} ${fy - 22} C ${fx - 6} ${fy - 32} ${fx + 6} ${fy - 40} ${fx - 2} ${fy - 52}" fill="none" style="stroke:var(--ink-faint)" stroke-width="2" stroke-linecap="round" opacity="0.3"/>
      </g>`;
    }
  });
  const svgMeio = `<svg width="${Wm}" height="${H}" viewBox="0 0 ${Wm} ${H}" aria-hidden="true">${defsMeio}${decorMeio}</svg>`;

  // ---- camada de fundo (0.2x): céu creme-dourado, sol baixo com halo
  //      BORRADO de verdade (o único filtro deste svg), nuvens suaves,
  //      3 cordilheiras fundindo com o céu (atmosfera), bruma e bandas de
  //      calor — a profundidade real que segura a imersão ----
  const defsFundo = `<defs>
    <filter id="g4b-blur" x="-120%" y="-120%" width="340%" height="340%"><feGaussianBlur stdDeviation="16"/></filter>
    <linearGradient id="g4b-ceu" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" style="stop-color:var(--ceu-topo, var(--bg-2, var(--bg)))" stop-opacity="0.9"/>
      <stop offset="55%" style="stop-color:var(--ceu-meio, var(--bg))" stop-opacity="0.55"/>
      <stop offset="100%" style="stop-color:var(--ceu-horizonte, ${OURO})" stop-opacity="0.30"/>
    </linearGradient>
    <radialGradient id="g4b-sol" cx="50%" cy="50%" r="50%">
      <stop offset="0%" style="stop-color:var(--sol, #fff6e2)" stop-opacity="0.9"/>
      <stop offset="55%" style="stop-color:var(--sol, #fff6e2)" stop-opacity="0.5"/>
      <stop offset="100%" style="stop-color:var(--sol, #fff6e2)" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="g4b-solhalo" cx="50%" cy="50%" r="50%">
      <stop offset="0%" style="stop-color:var(--sol-halo, ${HALO})" stop-opacity="0.55"/>
      <stop offset="55%" style="stop-color:var(--sol-halo, ${HALO})" stop-opacity="0.22"/>
      <stop offset="100%" style="stop-color:var(--sol-halo, ${HALO})" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="g4b-d1" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" style="stop-color:var(--ceu-horizonte, ${OURO})" stop-opacity="0.16"/>
      <stop offset="100%" style="stop-color:var(--ceu-horizonte, ${OURO})" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="g4b-d2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" style="stop-color:var(--ceu-horizonte, ${OURO})" stop-opacity="0.26"/>
      <stop offset="100%" style="stop-color:var(--ceu-horizonte, ${OURO})" stop-opacity="0.02"/>
    </linearGradient>
    <linearGradient id="g4b-d3" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" style="stop-color:var(--ink-faint)" stop-opacity="0.30"/>
      <stop offset="100%" style="stop-color:var(--ink-faint)" stop-opacity="0.04"/>
    </linearGradient>
    <linearGradient id="g4b-bruma" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" style="stop-color:var(--bruma, var(--bg))" stop-opacity="0"/>
      <stop offset="100%" style="stop-color:var(--bruma, var(--bg))" stop-opacity="1"/>
    </linearGradient>
    <radialGradient id="g4b-nuvem" cx="50%" cy="50%" r="50%">
      <stop offset="0%" style="stop-color:var(--sol, #fff6e2)" stop-opacity="0.30"/>
      <stop offset="100%" style="stop-color:var(--sol, #fff6e2)" stop-opacity="0"/>
    </radialGradient>
  </defs>`;
  // nuvem alongada de curvas (forma fixa, escala via transform)
  const nuvem = (nx, ny, s) =>
    `<g transform="translate(${Math.round(nx)} ${Math.round(ny)}) scale(${s})">
      <path d="M -70 0 C -58 -14 -24 -18 0 -10 C 18 -16 52 -12 64 -2 C 46 6 -46 6 -70 0 Z" fill="url(#g4b-nuvem)"/>
    </g>`;
  // banda de calor (heat shimmer): risco largo ondulado de opacidade baixa
  const bandaCalor = (yBand, sal) => {
    const pts = [];
    for (let x = -40; x <= Wf + 240; x += 240) {
      pts.push([x, yBand + (rnd(Math.round(x / 240), sal) - 0.5) * 8]);
    }
    return caminhoSuave(pts);
  };
  const xSol = Math.round(Wf * 0.66), ySol = Math.round(H * 0.34);
  const decorFundo = `
    <rect x="0" y="0" width="${Wf}" height="${H}" fill="url(#g4b-ceu)"/>
    <ellipse cx="${xSol}" cy="${ySol}" rx="210" ry="140" fill="url(#g4b-solhalo)"/>
    <circle cx="${xSol}" cy="${ySol}" r="46" style="fill:var(--sol, #fff6e2)" opacity="0.5" filter="url(#g4b-blur)"/>
    <circle cx="${xSol}" cy="${ySol}" r="34" fill="url(#g4b-sol)"/>
    ${nuvem(Wf * 0.2, H * 0.17, 1)}
    ${nuvem(Wf * 0.48, H * 0.11, 0.8)}
    ${nuvem(Wf * 0.86, H * 0.2, 1.15)}
    <path d="${crista(Wf, H * 0.5, 26, 71, 340, H)}" fill="url(#g4b-d1)"/>
    <path d="${crista(Wf, H * 0.56, 34, 72, 300, H)}" fill="url(#g4b-d2)"/>
    <path d="${crista(Wf, H * 0.63, 44, 73, 260, H)}" fill="url(#g4b-d3)"/>
    <rect x="0" y="${Math.round(H * 0.55)}" width="${Wf}" height="${Math.round(H * 0.45)}" fill="url(#g4b-bruma)"/>
    <path class="g4-shimmer" d="${bandaCalor(H * 0.52, 91)}" fill="none" style="stroke:var(--ceu-horizonte, ${OURO})" stroke-width="6" stroke-linecap="round" opacity="0.10"/>
    <path class="g4-shimmer" d="${bandaCalor(H * 0.585, 92)}" fill="none" style="stroke:var(--ceu-horizonte, ${OURO})" stroke-width="5" stroke-linecap="round" opacity="0.07"/>
  `;
  const svgFundo = `<svg width="${Wf}" height="${H}" viewBox="0 0 ${Wf} ${H}" aria-hidden="true">${defsFundo}${decorFundo}</svg>`;

  // ---- injeta as camadas ----
  frente.style.width = W + "px";
  meio.style.width = Wm + "px";
  fundo.style.width = Wf + "px";
  frente.insertAdjacentHTML("afterbegin", svgFrente);
  meio.innerHTML = svgMeio;
  fundo.innerHTML = svgFundo;

  // ---- posiciona nós e avatar ----
  nos.forEach((el, i) => {
    el.style.left = xs[i] + "px";
    el.style.top = ys[i] + "px";
  });
  const fill = frente.querySelector("#trilha-fill");
  const fillHalo = frente.querySelector("#trilha-fill-halo");
  const comprimento = acum;
  fill.style.strokeDasharray = comprimento;
  if (fillHalo) fillHalo.style.strokeDasharray = comprimento;

  // progresso = até o nó atual (ou último feito)
  let idxFeito = 0;
  nos.forEach((el, i) => { if (el.classList.contains("feito")) idxFeito = i + 1; });
  const idxAtual = nos.findIndex((el) => el.classList.contains("atual"));
  const alvoIdx = Math.min(N - 1, idxAtual >= 0 ? idxAtual : idxFeito);
  const fracao = compAte(xs[alvoIdx]) / comprimento;
  fill.style.strokeDashoffset = comprimento * (1 - fracao);
  if (fillHalo) fillHalo.style.strokeDashoffset = comprimento * (1 - fracao);

  const av = document.getElementById("avatar");
  if (av) { av.style.left = xs[alvoIdx] + "px"; av.style.top = (chao(alvoIdx) - 20) + "px"; }
  // halo difuso dourado atrás do guia (injetado uma vez; a marca vem de ui.js)
  if (av && !av.querySelector(".avatar-halo")) {
    const haloAv = document.createElement("span");
    haloAv.className = "avatar-halo";
    haloAv.setAttribute("aria-hidden", "true");
    haloAv.style.cssText = "position:absolute;left:50%;top:58%;width:70px;height:46px;" +
      "transform:translate(-50%,-50%);pointer-events:none;opacity:0.85;" +
      `background:radial-gradient(closest-side, ${HALO} 0%, transparent 72%);`;
    av.prepend(haloAv);
  }

  // ---- HUD + minimapa ----
  const huds = Array.from(document.querySelectorAll(".hud-ato"));
  const minis = Array.from(document.querySelectorAll(".mini-no"));
  let hudAtivo = -1;
  const setHud = (ato) => {
    if (ato === hudAtivo) return;
    hudAtivo = ato;
    huds.forEach((el) => el.classList.toggle("ativo", Number(el.dataset.atoidx) === ato));
  };
  let miniAtivo = -1;
  const setMini = (idx) => {
    if (idx === miniAtivo) return;
    miniAtivo = idx;
    minis.forEach((el, i) => el.classList.toggle("atual", i === idx));
  };
  const atualizarPorCentro = (xCentro) => {
    setHud(distritoDe(xCentro));
    let melhor = 0, md = Infinity;
    xs.forEach((x, i) => { const dd = Math.abs(x - xCentro); if (dd < md) { md = dd; melhor = i; } });
    setMini(melhor);
  };
  atualizarPorCentro(xs[alvoIdx]);

  // ---- animações de vida: os platôs ficam ASSENTADOS (nada de flutuar no
  //      deserto) — o que respira é o glow (.halo-base), a sombra de contato,
  //      a poeira dourada e o calor no horizonte ----
  if (gsap && !reduz) {
    nos.forEach((el, i) => {
      const durF = 2.6 + rnd(i, 41) * 1.3;
      const delayF = rnd(i, 42) * 1.8;
      const haloNo = el.querySelector(".no-cubo .halo-base");
      if (haloNo) {
        gsap.to(haloNo, { opacity: 0.32, duration: durF, ease: "sine.inOut",
          yoyo: true, repeat: -1, delay: delayF });
      }
      const sombra = frente.querySelector(`.sombra-no[data-i="${i}"]`);
      if (sombra) {
        gsap.to(sombra, { scale: 0.9, opacity: 0.8, transformOrigin: "50% 50%", duration: durF,
          ease: "sine.inOut", yoyo: true, repeat: -1, delay: delayF });
      }
    });
    if (av) {
      gsap.to(av.querySelector(".marca"), { y: -4, duration: 1.9, ease: "sine.inOut", yoyo: true, repeat: -1 });
      const haloAv = av.querySelector(".avatar-halo");
      if (haloAv) gsap.to(haloAv, { opacity: 0.45, duration: 1.9, ease: "sine.inOut", yoyo: true, repeat: -1 });
    }
    // motes de poeira: deriva lenta + respiração de brilho
    frente.querySelectorAll(".vagalume").forEach((v, i) => {
      gsap.to(v, { y: (rnd(i, 64) - 0.5) * 26, x: (rnd(i, 65) - 0.5) * 20,
        duration: 3 + rnd(i, 66) * 2.5, ease: "sine.inOut", yoyo: true, repeat: -1, delay: rnd(i, 67) * 2 });
      gsap.to(v, { opacity: 0.2 + rnd(i, 68) * 0.35, duration: 1.6 + rnd(i, 69) * 1.6,
        ease: "sine.inOut", yoyo: true, repeat: -1 });
    });
    // bandas de calor tremulando de leve no horizonte (só opacity/x)
    fundo.querySelectorAll(".g4-shimmer").forEach((s, i) => {
      gsap.to(s, { x: 8 + rnd(i, 71) * 10, opacity: 0.04, duration: 2.4 + rnd(i, 72) * 1.6,
        ease: "sine.inOut", yoyo: true, repeat: -1, delay: rnd(i, 73) });
    });
    // pulso de luz viajando pela trilha inteira
    const pulso = frente.querySelector(".trilha-pulso");
    if (pulso) {
      pulso.style.strokeDasharray = `26 ${comprimento}`;
      gsap.fromTo(pulso, { strokeDashoffset: 26 },
        { strokeDashoffset: -comprimento, duration: Math.max(7, comprimento / 240), ease: "none", repeat: -1 });
    }
    // entrada: preenchimento da trilha (dourado + halo) + assentamento dos nós
    const fills = fillHalo ? [fill, fillHalo] : [fill];
    gsap.fromTo(fills, { strokeDashoffset: comprimento },
      { strokeDashoffset: comprimento * (1 - fracao), duration: 1.5, ease: "power2.inOut" });
    gsap.from(nos.map((el) => el.querySelector(".no-cubo")), {
      opacity: 0, y: -18, duration: 0.55, stagger: 0.05, ease: "back.out(1.5)", clearProps: "opacity,transform",
    });
    if (av && window.MotionPathPlugin && fracao > 0.01) {
      gsap.to(av, { duration: 1.5, ease: "power2.inOut",
        motionPath: { path: "#trilha-fill", align: "#trilha-fill", alignOrigin: [0.5, 0.95],
          start: Math.max(0, fracao - 0.08), end: fracao } });
    }
  }

  // ---------------------------------------------------------------------
  // modo PINADO (desktop): roda do mouse percorre o mundo
  // ---------------------------------------------------------------------
  if (pinado) {
    const ST = window.ScrollTrigger;
    const paradas = xs.map((x) => Math.min(1, Math.max(0, (x - vw / 2) / dist)));
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: wrap,
        pin: true,
        scrub: 1,
        anticipatePin: 1,
        start: () => "top " + hdrH,
        end: () => "+=" + dist,
        snap: { snapTo: paradas, duration: { min: 0.25, max: 0.6 }, ease: "power2.out", delay: 0.1 },
        invalidateOnRefresh: true,
        onUpdate: (self) => atualizarPorCentro(self.progress * dist + vw / 2),
      },
    });
    tl.to(frente, { x: -dist, ease: "none" }, 0)
      .to(meio, { x: -dist * fM, ease: "none" }, 0)
      .to(fundo, { x: -dist * fF, ease: "none" }, 0);
    const st = tl.scrollTrigger;
    _mundo.tl = tl;
    _mundo.st = st;

    const irParaParada = (idx, imediato = false) => {
      const p = paradas[Math.max(0, Math.min(N - 1, idx))];
      rolarPara(st.start + p * (st.end - st.start), { imediato, duracao: 1.15 });
    };

    // câmera desliza até o nó atual ao abrir o mapa
    requestAnimationFrame(() => {
      ST.refresh();
      setTimeout(() => irParaParada(alvoIdx), 250);
    });

    // minimapa clicável
    minis.forEach((el, i) => { el.onclick = () => irParaParada(i); });

    // setas <- / ->
    const aoTeclar = (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const el = document.activeElement;
      if (el && ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return;
      e.preventDefault();
      const p = st.progress;
      let idx = 0, md = Infinity;
      paradas.forEach((pp, i) => { const dd = Math.abs(pp - p); if (dd < md) { md = dd; idx = i; } });
      irParaParada(idx + (e.key === "ArrowRight" ? 1 : -1));
    };
    document.addEventListener("keydown", aoTeclar);
    _mundo.teardown.push(() => document.removeEventListener("keydown", aoTeclar));
    _mundo.teardown.push(() => { try { tl.kill(); } catch { /* ok */ } });
  } else {
    // -------------------------------------------------------------------
    // modo NATIVO (mobile / reduzir / sem gsap): scroll horizontal + snap
    // -------------------------------------------------------------------
    wrap.classList.add("nativo");
    frente.style.position = "relative";
    const irPara = (i, imediato = false) => {
      viewport.scrollTo({ left: xs[i] - vw / 2, behavior: imediato || reduz ? "auto" : "smooth" });
    };
    requestAnimationFrame(() => irPara(alvoIdx, true));
    minis.forEach((el, i) => { el.onclick = () => irPara(i); });
    const aoRolar = () => atualizarPorCentro(viewport.scrollLeft + vw / 2);
    viewport.addEventListener("scroll", aoRolar, { passive: true });
    _mundo.teardown.push(() => viewport.removeEventListener("scroll", aoRolar));
    const aoTeclar = (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const el = document.activeElement;
      if (el && ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return;
      e.preventDefault();
      viewport.scrollBy({ left: e.key === "ArrowRight" ? segX : -segX, behavior: "smooth" });
    };
    document.addEventListener("keydown", aoTeclar);
    _mundo.teardown.push(() => document.removeEventListener("keydown", aoTeclar));
  }

  // ---- arrastar para navegar (o cursor grab do viewport é pra valer) ----
  // o rebuild por resize reaproveita o viewport: TODO listener entra no
  // teardown (senão duplicam a cada resize e o wheel/drag multiplica).
  let arrastando = false, dragX = 0, dragBase = 0;
  const aoPegar = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest(".no, button, a")) return; // não rouba cliques
    arrastando = true;
    dragX = e.clientX;
    dragBase = pinado ? (window.pageYOffset || document.documentElement.scrollTop) : viewport.scrollLeft;
    try { viewport.setPointerCapture(e.pointerId); } catch { /* ok */ }
  };
  const aoArrastar = (e) => {
    if (!arrastando) return;
    const dx = e.clientX - dragX;
    if (pinado) rolarPara(dragBase - dx, { imediato: true });
    else viewport.scrollLeft = dragBase - dx;
  };
  const soltar = () => { arrastando = false; };
  viewport.addEventListener("pointerdown", aoPegar);
  viewport.addEventListener("pointermove", aoArrastar);
  viewport.addEventListener("pointerup", soltar);
  viewport.addEventListener("pointercancel", soltar);
  _mundo.teardown.push(() => {
    viewport.removeEventListener("pointerdown", aoPegar);
    viewport.removeEventListener("pointermove", aoArrastar);
    viewport.removeEventListener("pointerup", soltar);
    viewport.removeEventListener("pointercancel", soltar);
  });

  // modo nativo: roda do mouse também anda LATERALMENTE (paridade com o
  // pinado). Nas extremidades o evento passa — a página continua rolável.
  if (!pinado) {
    const aoRodar = (e) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const max = viewport.scrollWidth - viewport.clientWidth;
      const noFim = viewport.scrollLeft >= max - 1 && e.deltaY > 0;
      const noInicio = viewport.scrollLeft <= 1 && e.deltaY < 0;
      if (noFim || noInicio) return;
      viewport.scrollLeft += e.deltaY;
      e.preventDefault();
    };
    viewport.addEventListener("wheel", aoRodar, { passive: false });
    _mundo.teardown.push(() => viewport.removeEventListener("wheel", aoRodar));
  }

  // rebuild no resize (debounce)
  let tResize = null;
  const aoRedimensionar = () => {
    if (tResize) clearTimeout(tResize);
    tResize = setTimeout(() => {
      if (document.getElementById("mundo-viewport")) montarMundo();
    }, 200);
  };
  window.addEventListener("resize", aoRedimensionar, { passive: true });
  _mundo.teardown.push(() => window.removeEventListener("resize", aoRedimensionar));
  if (gsap) {
    _mundo.teardown.push(() => {
      try {
        gsap.killTweensOf([frente, meio, fundo, "#trilha-fill", "#trilha-fill-halo", ".trilha-pulso",
          ".no-cubo", ".halo-base", ".sombra-no", ".vagalume", ".g4-shimmer",
          "#avatar .marca", "#avatar .avatar-halo", "#avatar"]);
      } catch { /* ok */ }
    });
  }
}

// ---------------------------------------------------------------------------
// reveals com stagger (linguagem do site) — para as telas internas
// ---------------------------------------------------------------------------
export function revelarTela() {
  const els = Array.from(document.querySelectorAll(".reveal, .reveal-esq, .reveal-escala"));
  if (!els.length) return;
  const gsap = window.gsap;
  if (!gsap || reduzAtivo()) {
    els.forEach((el) => { el.style.opacity = "1"; el.style.transform = "none"; });
    return;
  }
  // will-change dinâmico: promove a camada de composição só DURANTE a animação
  // e a limpa depois (via clearProps), em vez de mantê-la fixa no CSS por tela.
  els.forEach((el) => { el.style.willChange = "transform, opacity"; });
  gsap.to(els, {
    opacity: 1, x: 0, y: 0, scale: 1,
    duration: 0.6, stagger: 0.07, ease: "power2.out",
    clearProps: "transform,willChange",
  });
  // cinto de segurança: se o tween não completar (ticker travado, aba de
  // fundo, qualquer falha de ambiente), NUNCA deixe a tela invisível.
  setTimeout(() => {
    els.forEach((el) => {
      if (el.isConnected && getComputedStyle(el).opacity === "0") {
        el.style.opacity = "1";
        el.style.transform = "none";
      }
    });
  }, 1200);
}

// ---------------------------------------------------------------------------
// cerimônia (Dojo OS): sprites do pacote (estrela/selo/moeda) caem com bounce.
// Nenhuma arte desenhada em código — só posiciona PNGs fatiados do pacote.
// ---------------------------------------------------------------------------
const V_ASSETS = new URL(import.meta.url).search || "";
export function cerimoniaCubos(container, _cores = []) {
  if (!container) return;
  const sprites = ["icone-19", "icone-20", "taskbar-12"];
  container.innerHTML = sprites.map((s, i) =>
    `<img class="cer-cubo" src="./assets/${s}.png${V_ASSETS}" alt="" aria-hidden="true"
      style="position:relative;display:inline-block;width:${46 - i * 6}px;margin:0 2px;z-index:${10 - i};image-rendering:pixelated">`
  ).join("");
  const cubos = container.querySelectorAll(".cer-cubo");
  const gsap = window.gsap;
  if (!gsap || reduzAtivo()) return;
  gsap.timeline().from(cubos, {
    y: -90, opacity: 0, duration: 0.55, stagger: 0.16, ease: "bounce.out",
  });
}
