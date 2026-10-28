// Cursor do Dojo OS: sprites do pacote de assets (A6), sem rastro.
// cursor:none SÓ quando o custom está ativo; touch/reduzir devolvem o nativo.

const V = new URL(import.meta.url).search || "";
const SPRITES = {
  seta: { src: `./assets/cursor-seta.png${V}`, dx: -3, dy: -2 },   // ponta no topo-esq
  mao: { src: `./assets/cursor-mao.png${V}`, dx: -10, dy: -3 },    // ponta do dedo
  texto: { src: `./assets/cursor-texto.png${V}`, dx: -6, dy: -13 }, // centro do I
  espera: { src: `./assets/cursor-espera.png${V}`, dx: -11, dy: -13 },
};
const SEL_MAO = "button, a, summary, select, label, [role=button], input[type=checkbox], input[type=radio]";
const SEL_TEXTO = "textarea, input[type=text], input[type=number], input:not([type]), .editor";

let el = null;
let modo = "seta";
let ligado = false;

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
  const alvo = e.target;
  let m = "seta";
  if (alvo instanceof Element) {
    if (alvo.closest(SEL_TEXTO)) m = "texto";
    else if (alvo.closest(SEL_MAO)) m = "mao";
  }
  if (document.body.classList.contains("ocupado")) m = "espera";
  aplicar(m);
  const s = SPRITES[modo];
  el.style.transform = `translate3d(${e.clientX + s.dx}px, ${e.clientY + s.dy}px, 0)`;
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

export function iniciarCursor() {
  atualizarCursor();
}

// re-avalia touch/reduzir (chamado no boot e quando a config muda)
export function atualizarCursor() {
  if (podeAtivar()) ligar();
  else desligar();
}
