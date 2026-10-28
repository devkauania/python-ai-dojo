// Cursor do Dojo OS: sprites do pacote de assets (A6), sem rastro.
// cursor:none SÓ quando o custom está ativo; touch/reduzir devolvem o nativo.

const V = new URL(import.meta.url).search || "";
// hx/hy = hotspot em pixels NATIVOS do sprite (todos têm 289px de altura).
// O deslocamento real é hx*k, com k = altura renderizada / altura nativa —
// assim o ponto quente acompanha o tamanho do cursor (CSS --z) sem recalcular.
const ALTURA_NATIVA = 289;
const SPRITES = {
  seta: { src: `./assets/cursor-seta.png${V}`, hx: 3, hy: 3 },      // ponta no topo-esq
  mao: { src: `./assets/cursor-mao.png${V}`, hx: 68, hy: 6 },       // ponta do dedo
  texto: { src: `./assets/cursor-texto.png${V}`, hx: 39, hy: 144 }, // centro do I
  espera: { src: `./assets/cursor-espera.png${V}`, hx: 80, hy: 144 },
};
const SEL_MAO = "button, a, summary, select, label, [role=button], input[type=checkbox], input[type=radio]";
const SEL_TEXTO = "textarea, input[type=text], input[type=number], input:not([type]), .editor";

let el = null;
let modo = "seta";
let ligado = false;
let ultimo = null; // último pointermove (p/ trocar o sprite sem esperar o mouse mexer)

function escala() {
  const alt = el && el.getBoundingClientRect().height;
  return alt ? alt / ALTURA_NATIVA : 26 / ALTURA_NATIVA;
}

function podeAtivar() {
  if (window.matchMedia("(pointer: coarse)").matches) return false;
  if (document.documentElement.getAttribute("data-reduz") === "1") return false;
  return true;
}

function aplicar(m) {
  if (m === modo || !el) return;
  modo = m;
  const s = SPRITES[m];
  el.src = s.src;
}

function aoMover(e) {
  if (!el) return;
  ultimo = e;
  const alvo = e.target;
  let m = "seta";
  if (alvo instanceof Element) {
    if (alvo.closest(SEL_TEXTO)) m = "texto";
    else if (alvo.closest(SEL_MAO)) m = "mao";
  }
  if (document.body.classList.contains("ocupado")) m = "espera";
  aplicar(m);
  const s = SPRITES[modo];
  const k = escala();
  el.style.transform = `translate3d(${e.clientX - s.hx * k}px, ${e.clientY - s.hy * k}px, 0)`;
  el.style.display = "block";
}

function ligar() {
  if (ligado) return;
  ligado = true;
  el = document.createElement("img");
  el.id = "cursor-os";
  el.alt = "";
  el.setAttribute("aria-hidden", "true");
  el.src = SPRITES.seta.src;
  document.body.appendChild(el);
  document.documentElement.classList.add("cursor-os-ativo");
  window.addEventListener("pointermove", aoMover, { passive: true });
  document.addEventListener("pointerleave", () => { if (el) el.style.display = "none"; });
  // Sobre um <iframe> (o preview.exe do Lab Web) o documento pai para de
  // receber pointermove: o sprite congelava na borda enquanto o iframe mostrava
  // o cursor NATIVO dele — dois cursores na tela. Esconde o nosso lá dentro.
  document.addEventListener("pointerover", (e) => {
    if (!el) return;
    if (e.target && e.target.tagName === "IFRAME") el.style.display = "none";
  }, true);
  // "clique" físico: a seta afunda 1px enquanto o botão está pressionado
  window.addEventListener("pointerdown", () => { if (el) el.style.marginLeft = el.style.marginTop = "1px"; }, { passive: true });
  window.addEventListener("pointerup", () => { if (el) el.style.marginLeft = el.style.marginTop = "0px"; }, { passive: true });
}

function desligar() {
  if (!ligado) return;
  ligado = false;
  window.removeEventListener("pointermove", aoMover);
  document.documentElement.classList.remove("cursor-os-ativo");
  if (el) { el.remove(); el = null; }
}

// ampulheta enquanto o Python/os testes rodam: liga/desliga a classe e já
// reaplica o sprite na última posição (o pointermove pode demorar a vir)
export function definirOcupado(sim) {
  document.body.classList.toggle("ocupado", !!sim);
  if (el && ultimo) aoMover(ultimo);
}

export function iniciarCursor() {
  atualizarCursor();
}

// re-avalia touch/reduzir (chamado no boot e quando a config muda)
export function atualizarCursor() {
  if (podeAtivar()) ligar();
  else desligar();
}
