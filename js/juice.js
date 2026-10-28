// Camada de "juice" do Dojo — direção de arte r3 "NEON BRUMA".
// Som sintetizado (Web Audio, zero arquivos): palheta "thock" de teclado
// mecânico — seca, com peso, satisfatória. Sem caudas longas, sem reverb.
// Partículas: luz aditiva dreamy (orbes com halo difuso, fagulhas com rastro,
// glints losango 2:1) — nada de cacos quadrados chapados.
// Tudo respeita as preferências (som/partículas/reduzir). Nada bloqueia a UI.

let ctx = null;
let cfg = { som: true, particulas: true };
let reduzMovimento = false;

let _unlockRegistrado = false;
export function configurarJuice(config) {
  cfg = { som: config?.som !== false, particulas: config?.particulas !== false };
  // Movimento controlado pela CONFIG (não pelo sistema): o jogo é vivo por
  // padrão. Só suprime partículas se o usuário ativar "reduzir animações".
  reduzMovimento = config?.reduzir === true;
  // desbloqueio de áudio no PRIMEIRO gesto em qualquer lugar (robusto contra
  // políticas de autoplay — não depende de um botão específico)
  if (!_unlockRegistrado) {
    _unlockRegistrado = true;
    document.addEventListener("pointerdown", () => acordarAudio(), { passive: true });
  }
}

// Cadeia master: notas -> lowpass (arredonda o topo sem matar o "clack") ->
// master. Lowpass em ~5kHz: os transientes de tecla (1.8–3.5kHz) passam
// inteiros, mas nada estridente acima disso escapa.
let filtro = null;
let master = null;

// AudioContext só pode nascer após um gesto do usuário — criamos preguiçosamente.
function audio() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
    filtro = ctx.createBiquadFilter();
    filtro.type = "lowpass";
    filtro.frequency.value = 5000;      // deixa o transiente da "tecla" respirar
    filtro.Q.value = 0.4;
    master = ctx.createGain();
    master.gain.value = 0.95;
    filtro.connect(master);
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
  return ctx;
}

// alguns navegadores suspendem o contexto até um gesto; retoma sob demanda
export function acordarAudio() {
  const a = audio();
  if (a && a.state === "suspended") a.resume().catch(() => {});
}

// ---------------------------------------------------------------------------
// blocos de síntese da palheta "thock"
// ---------------------------------------------------------------------------

// buffer de ruído branco reutilizável (0.25s cobre do tick de 8ms ao shimmer
// de 200ms — as fontes só param antes do fim)
let bufRuido = null;
function ruido(a) {
  if (bufRuido) return bufRuido;
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * 0.25), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  bufRuido = buf;
  return buf;
}

// (a) transiente: ruído curtíssimo por filtro — o "clack" do contato da tecla.
// tipoFiltro "bandpass" (padrão) p/ o clack; "highpass" p/ shimmer; "lowpass"
// p/ knock abafado.
function transiente(inicio, freqFiltro, dur, ganho, q = 1.2, tipoFiltro = "bandpass") {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + inicio;
  const src = a.createBufferSource();
  src.buffer = ruido(a);
  const f = a.createBiquadFilter();
  f.type = tipoFiltro;
  f.frequency.value = freqFiltro;
  f.Q.value = q;
  const g = a.createGain();
  g.gain.setValueAtTime(ganho, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f);
  f.connect(g);
  g.connect(filtro);
  src.start(t);
  src.stop(t + dur + 0.02);
}

// (b) corpo: grave com pitch-drop rápido e decay exponencial — o peso do
// "thock". Ataque quase instantâneo (som seco), sem cauda.
function corpo(inicio, freq, dur, ganho, tipoOsc = "triangle", queda = 1.5) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + inicio;
  const osc = a.createOscillator();
  osc.type = tipoOsc;
  osc.frequency.setValueAtTime(freq * queda, t);
  osc.frequency.exponentialRampToValueAtTime(freq, t + 0.03); // pitch-drop rápido
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(ganho, t + 0.004);      // ataque seco
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);       // decay curto
  osc.connect(g);
  g.connect(filtro);
  osc.start(t);
  osc.stop(t + dur + 0.03);
}

// uma "tecla": clack (ruído bandpass) + thock (corpo grave). brilho = centro
// do bandpass do transiente (1.8–3.5kHz).
function thock(inicio, freq = 125, ganho = 0.45, brilho = 2400) {
  transiente(inicio, brilho, 0.014, ganho * 0.4, 1.4);
  corpo(inicio, freq, 0.09, ganho, "triangle");
}

// pingo harmônico doce e curtíssimo (tempero, nunca protagonista)
function pingar(inicio, freq, dur, ganho) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + inicio;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(ganho, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(filtro);
  osc.start(t);
  osc.stop(t + dur + 0.03);
}

// paleta "teclado mecânico": seco, com peso, satisfatório — sem reverb
export function tocar(tipo) {
  if (!cfg.som) return;
  acordarAudio();
  const a = audio();
  if (!a) return;
  if (tipo === "sucesso") {
    // thock-thock (2º mais agudo) + harmônico doce curtíssimo
    thock(0, 130, 0.45, 2300);
    thock(0.09, 170, 0.42, 2800);
    pingar(0.1, 660, 0.07, 0.07);
  } else if (tipo === "estrela") {
    // tick vítreo agudo e seco (contato de vidro, não sino)
    transiente(0, 3400, 0.022, 0.22, 3);
    pingar(0, 1976, 0.05, 0.09);
  } else if (tipo === "recorde") {
    // 4 thocks ascendentes rápidos + shimmer de ruído highpass (~200ms)
    [110, 130, 155, 185].forEach((f, i) => thock(i * 0.07, f, 0.42, 2200 + i * 300));
    transiente(0.24, 2000, 0.2, 0.07, 0.7, "highpass");
  } else if (tipo === "nivel") {
    // 3 thocks arpejados secos
    [112, 140, 176].forEach((f, i) => thock(i * 0.08, f, 0.44, 2200 + i * 250));
  } else if (tipo === "inicio") {
    // knock duplo acolhedor (mais grave, menos clack) + hum grave curto
    thock(0, 96, 0.4, 1800);
    thock(0.12, 96, 0.34, 1800);
    pingar(0.02, 82, 0.25, 0.1);
  } else if (tipo === "clique") {
    thock(0, 120, 0.38, 2400); // a tecla básica
  } else if (tipo === "tecla") {
    // MX Black linear: bottom-out suave, grave, sem clack estridente —
    // pitch/brilho levemente aleatórios para não soar metralhadora
    thock(0, 86 + Math.random() * 22, 0.2, 1450 + Math.random() * 450);
  } else if (tipo === "erro") {
    // thud duplo abafado — grave, seco, sem drama
    transiente(0, 500, 0.02, 0.12, 0.8, "lowpass");
    corpo(0, 95, 0.1, 0.4, "sine", 1.3);
    corpo(0.09, 80, 0.11, 0.3, "sine", 1.3);
  }
}

// ---------------------------------------------------------------------------
// partículas — "luz neon dreamy" (blend aditivo)
// Três tipos: ORBE (núcleo branco-quente + halo difuso), FAGULHA (risco curto
// na direção do voo, com micro-rastro) e GLINT (losango 2:1 raro e brilhante —
// eco da linguagem dimétrica). Zero contorno, zero caco chapado.
// ---------------------------------------------------------------------------
let canvas = null;
let cvctx = null;
let particulas = [];
let rodando = false;
let relogio = 0; // contador de frames p/ flicker/sway

// paleta neon dos distritos (d1 aurora, d2 dourado, d3 coral, d4 violeta)
// + um azul-bruma de tempero; núcleo sempre branco-quente
const NEON = ["#d9b96c", "#c4a35a", "#e0a468", "#c98a5e", "#b9a06a"];
const NUCLEO = "#f0dcae";

function sortearCor() {
  return NEON[(Math.random() * NEON.length) | 0];
}

// hex -> "r,g,b" (p/ montar rgba() dos gradientes)
function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

// sprites de orbe pré-renderizados (1 por cor): núcleo quente + halo em
// radial-gradient. Evita criar gradiente por partícula por frame — barato
// mesmo com dezenas de orbes no ar.
const sprites = new Map();
const SPRITE = 64; // px; desenhado com drawImage escalado
function spriteOrbe(cor) {
  let s = sprites.get(cor);
  if (s) return s;
  s = document.createElement("canvas");
  s.width = SPRITE;
  s.height = SPRITE;
  const c = s.getContext("2d");
  const m = SPRITE / 2;
  const g = c.createRadialGradient(m, m, 0, m, m, m);
  const rc = rgb(cor);
  g.addColorStop(0, "rgba(240,220,174,0.8)");   // núcleo branco-quente
  g.addColorStop(0.16, `rgba(${rc},0.85)`);      // cor viva colada no núcleo
  g.addColorStop(0.42, `rgba(${rc},0.28)`);      // halo difuso largo
  g.addColorStop(1, `rgba(${rc},0)`);            // some sem borda
  c.fillStyle = g;
  c.fillRect(0, 0, SPRITE, SPRITE);
  sprites.set(cor, s);
  return s;
}

// tipos: 0 = orbe, 1 = fagulha, 2 = glint (raro)
function sortearTipo() {
  const r = Math.random();
  if (r < 0.5) return 0;    // ~50% orbes
  if (r < 0.9) return 1;    // ~40% fagulhas
  return 2;                 // ~10% glints
}

function garantirCanvas() {
  if (canvas) return;
  canvas = document.createElement("canvas");
  canvas.id = "juice-canvas";
  document.body.appendChild(canvas);
  cvctx = canvas.getContext("2d");
  const redimensionar = () => {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    cvctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  redimensionar();
  window.addEventListener("resize", redimensionar);
}

function desenharOrbe(p, alpha, raio) {
  // flicker sutil de alpha (cada orbe tem fase própria)
  const flick = 0.78 + 0.22 * Math.sin(relogio * 0.45 + p.fase);
  cvctx.globalAlpha = alpha * flick;
  const d = raio * 4; // o sprite inclui o halo — desenha bem maior que o núcleo
  cvctx.drawImage(spriteOrbe(p.cor), p.x - d / 2, p.y - d / 2, d, d);
}

function desenharFagulha(p, alpha, raio) {
  // risco curto na direção da velocidade: cauda transparente -> ponta quente
  const vel = Math.hypot(p.vx, p.vy) || 0.001;
  const comp = Math.min(18, 4 + vel * 2.4) * Math.min(1, raio / 2);
  const tx = p.x - (p.vx / vel) * comp;
  const ty = p.y - (p.vy / vel) * comp;
  const g = cvctx.createLinearGradient(tx, ty, p.x, p.y);
  const rc = rgb(p.cor);
  g.addColorStop(0, `rgba(${rc},0)`);
  g.addColorStop(0.55, `rgba(${rc},0.7)`);
  g.addColorStop(1, "rgba(240,220,174,0.8)"); // ponta quase branca
  cvctx.globalAlpha = alpha;
  cvctx.strokeStyle = g;
  cvctx.lineWidth = 2;
  cvctx.lineCap = "round";
  cvctx.beginPath();
  cvctx.moveTo(tx, ty);
  cvctx.lineTo(p.x, p.y);
  cvctx.stroke();
}

function desenharGlint(p, alpha, raio) {
  // losango 2:1 pequeno e brilhante (a assinatura dimétrica, agora como luz)
  const flick = 0.7 + 0.3 * Math.sin(relogio * 0.6 + p.fase);
  cvctx.globalAlpha = alpha * flick;
  // halozinho por trás p/ não parecer forma recortada
  const d = raio * 5;
  cvctx.drawImage(spriteOrbe(p.cor), p.x - d / 2, p.y - d / 2, d, d);
  cvctx.fillStyle = NUCLEO;
  cvctx.beginPath();
  cvctx.moveTo(p.x - raio, p.y);
  cvctx.lineTo(p.x, p.y - raio * 0.5);
  cvctx.lineTo(p.x + raio, p.y);
  cvctx.lineTo(p.x, p.y + raio * 0.5);
  cvctx.closePath();
  cvctx.fill();
}

function loop() {
  if (!rodando) return;
  relogio++;
  cvctx.globalCompositeOperation = "source-over";
  cvctx.clearRect(0, 0, canvas.width, canvas.height);
  cvctx.globalCompositeOperation = "lighter"; // luz aditiva: sobreposição vira brilho
  particulas = particulas.filter((p) => p.vida > 0);
  for (const p of particulas) {
    if (p.ember) {
      // embers de celebração: queda lenta com sway senoidal
      p.t += 1;
      p.y += p.vy;
      p.x = p.x0 + Math.sin(p.t * p.fSway + p.fase) * p.aSway;
    } else {
      p.vy += p.grav;          // gravidade suave
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= p.drag;          // drag: o burst "assenta"
      p.vy *= p.drag;
    }
    // nascimento com ease-out: cresce rápido no início, acomoda em 1.0
    if (p.escala < 1) p.escala += (1 - p.escala) * 0.22;
    p.vida -= 1;
    const alpha = Math.min(1, p.vida / p.fade);
    const raio = p.r * p.escala;
    if (p.tipo === 1) desenharFagulha(p, alpha, raio);
    else if (p.tipo === 2) desenharGlint(p, alpha, raio);
    else desenharOrbe(p, alpha, raio);
  }
  cvctx.globalAlpha = 1;
  if (particulas.length) requestAnimationFrame(loop);
  else {
    rodando = false;
    cvctx.globalCompositeOperation = "source-over";
  }
}

// burst neon a partir de (x, y). intensidade escala quantidade e energia.
export function estourar(x, y, intensidade = 1) {
  if (!cfg.particulas || reduzMovimento) return;
  garantirCanvas();
  const n = Math.round(20 * intensidade);
  for (let i = 0; i < n; i++) {
    const tipo = sortearTipo();
    const ang = (Math.PI * 2 * i) / n + Math.random() * 0.5;
    // fagulhas saem mais rápidas (o risco precisa de velocidade p/ existir)
    const vel = (tipo === 1 ? 4.5 : 2.5) + Math.random() * 5 * intensidade;
    particulas.push({
      x, y,
      x0: x, t: 0, ember: false,
      vx: Math.cos(ang) * vel,
      vy: Math.sin(ang) * vel - 2.5,
      r: tipo === 2 ? 3 + Math.random() * 3 : 2 + Math.random() * 3.5,
      cor: sortearCor(),
      vida: (tipo === 1 ? 30 : 48) + ((Math.random() * 22) | 0),
      fade: tipo === 1 ? 14 : 26,
      grav: tipo === 1 ? 0.1 : 0.04,
      drag: tipo === 1 ? 0.96 : 0.94,
      fase: Math.random() * Math.PI * 2,
      fSway: 0, aSway: 0,
      tipo,
      escala: 0.35,            // nasce pequeno, ease-out até 1.0
    });
  }
  if (!rodando) {
    rodando = true;
    requestAnimationFrame(loop);
  }
}

// estoura a partir do centro de um elemento (ou do centro da tela)
export function estourarEm(elemento, intensidade = 1) {
  let x = window.innerWidth / 2;
  let y = window.innerHeight / 3;
  if (elemento && elemento.getBoundingClientRect) {
    const r = elemento.getBoundingClientRect();
    x = r.left + r.width / 2;
    y = r.top + r.height / 2;
  }
  estourar(x, y, intensidade);
}

// chuva de embers neon lentos com sway senoidal (cerimônias) — tasteful, ~1.2s
export function celebrar() {
  if (!cfg.particulas || reduzMovimento) return;
  garantirCanvas();
  let lotes = 0;
  const soltar = () => {
    for (let i = 0; i < 10; i++) {
      const x0 = Math.random() * window.innerWidth;
      // embers são orbes (85%) com glints raros (15%); fagulha não cai devagar
      const tipo = Math.random() < 0.15 ? 2 : 0;
      particulas.push({
        x: x0, y: -12,
        x0, t: 0, ember: true,
        vx: 0,
        vy: 0.7 + Math.random() * 1.1,          // queda lenta, contemplativa
        r: tipo === 2 ? 3 + Math.random() * 2.5 : 2.5 + Math.random() * 3,
        cor: sortearCor(),
        vida: 110 + ((Math.random() * 50) | 0),
        fade: 40,
        grav: 0, drag: 1,
        fase: Math.random() * Math.PI * 2,
        fSway: 0.03 + Math.random() * 0.03,     // frequência do balanço
        aSway: 10 + Math.random() * 16,         // amplitude do balanço
        tipo,
        escala: 0.35,
      });
    }
    if (!rodando) {
      rodando = true;
      requestAnimationFrame(loop);
    }
    if (++lotes < 8) setTimeout(soltar, 90);
  };
  soltar();
}
