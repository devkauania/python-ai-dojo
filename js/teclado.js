// Teclado virtual do Dojo OS — o teclado branco antigo amarelado, montado com
// o 9-slice de assets/keycap.png (folha keycaps.png do dono). Nada de arte em
// código: o cap é sprite; as legendas são texto.
//
// - espelha o teclado FÍSICO: keydown/keyup acendem a tecla correspondente
//   (por e.code, independente do layout do usuário);
// - cada tecla é CLICÁVEL e insere o caractere no editor focado — inclusive
//   as que faltam em teclados compactos/ABNT (contrabarra, pipe, chaves...);
// - som "tecla" (MX Black suave) no aperto físico dentro de editores e no
//   clique virtual (respeita a config de som via juice.tocar).

import * as juice from "./juice.js";
import { t, t as tr } from "./i18n.js"; // tr: dentro do laço, "t" é a tecla

// [code físico, legenda base, legenda com shift, largura em unidades]
const LINHAS = [
  [
    ["Backquote", "`", "~"], ["Digit1", "1", "!"], ["Digit2", "2", "@"],
    ["Digit3", "3", "#"], ["Digit4", "4", "$"], ["Digit5", "5", "%"],
    ["Digit6", "6", "^"], ["Digit7", "7", "&"], ["Digit8", "8", "*"],
    ["Digit9", "9", "("], ["Digit0", "0", ")"], ["Minus", "-", "_"],
    ["Equal", "=", "+"], ["Backspace", "⌫", null, 2],
  ],
  [
    ["Tab", "Tab", null, 1.6], ["KeyQ", "q", "Q"], ["KeyW", "w", "W"],
    ["KeyE", "e", "E"], ["KeyR", "r", "R"], ["KeyT", "t", "T"],
    ["KeyY", "y", "Y"], ["KeyU", "u", "U"], ["KeyI", "i", "I"],
    ["KeyO", "o", "O"], ["KeyP", "p", "P"], ["BracketLeft", "[", "{"],
    ["BracketRight", "]", "}"], ["Backslash", "\\", "|", 1.4],
  ],
  [
    ["CapsLock", "Caps", null, 1.9], ["KeyA", "a", "A"], ["KeyS", "s", "S"],
    ["KeyD", "d", "D"], ["KeyF", "f", "F"], ["KeyG", "g", "G"],
    ["KeyH", "h", "H"], ["KeyJ", "j", "J"], ["KeyK", "k", "K"],
    ["KeyL", "l", "L"], ["Semicolon", ";", ":"], ["Quote", "'", "\""],
    ["Enter", "Enter", null, 2.1],
  ],
  [
    ["ShiftLeft", "Shift", null, 2.4], ["KeyZ", "z", "Z"], ["KeyX", "x", "X"],
    ["KeyC", "c", "C"], ["KeyV", "v", "V"], ["KeyB", "b", "B"],
    ["KeyN", "n", "N"], ["KeyM", "m", "M"], ["Comma", ",", "<"],
    ["Period", ".", ">"], ["Slash", "/", "?"], ["ShiftRight", "Shift", null, 2.4],
  ],
  [["Space", "", null, 11]],
];

let raiz = null;      // <div id="teclado-virtual">
let alvo = null;      // último textarea/input focado (recebe a digitação)
let shift = false;    // shift virtual one-shot
let caps = false;

function ehEditavel(el) {
  return el && (el.tagName === "TEXTAREA"
    || (el.tagName === "INPUT" && /^(text|number|search|url|email)?$/.test(el.type || "text")));
}

function atualizarLegendas() {
  if (!raiz) return;
  const ativo = shift !== caps; // p/ letras; símbolos seguem só o shift
  raiz.querySelectorAll(".vk-tecla[data-base]").forEach((el) => {
    const base = el.dataset.base;
    const alt = el.dataset.shift || "";
    const letra = /^[a-z]$/.test(base);
    const usarAlt = letra ? ativo : shift;
    el.textContent = usarAlt && alt ? alt : base;
  });
  raiz.querySelector('[data-code="ShiftLeft"]').classList.toggle("travada", shift);
  raiz.querySelector('[data-code="ShiftRight"]').classList.toggle("travada", shift);
  raiz.querySelector('[data-code="CapsLock"]').classList.toggle("travada", caps);
}

function inserir(texto) {
  const el = ehEditavel(document.activeElement) ? document.activeElement : alvo;
  if (!el || !el.isConnected) return;
  el.focus();
  const ini = el.selectionStart ?? el.value.length;
  const fim = el.selectionEnd ?? el.value.length;
  el.setRangeText(texto, ini, fim, "end");
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function apagar() {
  const el = ehEditavel(document.activeElement) ? document.activeElement : alvo;
  if (!el || !el.isConnected) return;
  el.focus();
  const ini = el.selectionStart ?? 0;
  const fim = el.selectionEnd ?? 0;
  if (ini === fim && ini > 0) el.setRangeText("", ini - 1, fim, "end");
  else el.setRangeText("", ini, fim, "end");
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function aoApertarVirtual(code, base, altLabel) {
  juice.tocar("tecla");
  if (code === "ShiftLeft" || code === "ShiftRight") { shift = !shift; atualizarLegendas(); return; }
  if (code === "CapsLock") { caps = !caps; atualizarLegendas(); return; }
  if (code === "Backspace") { apagar(); }
  else if (code === "Tab") { inserir("    "); }
  else if (code === "Enter") { inserir("\n"); }
  else if (code === "Space") { inserir(" "); }
  else {
    const letra = /^[a-z]$/.test(base);
    const usarAlt = letra ? (shift !== caps) : shift;
    inserir(usarAlt && altLabel ? altLabel : base);
  }
  if (shift) { shift = false; atualizarLegendas(); } // shift virtual é one-shot
}

export function iniciarTeclado() {
  if (raiz) return;
  raiz = document.createElement("div");
  raiz.id = "teclado-virtual";
  raiz.setAttribute("role", "group");
  raiz.setAttribute("aria-label", t("vk.aria"));
  for (const linha of LINHAS) {
    const div = document.createElement("div");
    div.className = "vk-linha";
    for (const [code, base, alt, w] of linha) {
      const t = document.createElement("button");
      t.type = "button";
      t.className = "vk-tecla";
      t.dataset.code = code;
      if (base && (alt || /^[a-z`\d\[\]\\;',.\/=-]$/.test(base) || base.length === 1)) {
        t.dataset.base = base;
        if (alt) t.dataset.shift = alt;
      }
      t.textContent = base;
      if (w) t.style.flex = w >= 10 ? "1 1 auto" : `0 0 calc(${w} * var(--vk-u))`;
      t.setAttribute("aria-label", code === "Space" ? tr("vk.espaco") : base || code);
      // As teclas não entram na ordem de Tab: são ~61 paradas mortas entre o
      // editor e o "Rodar". Quem usa teclado já tem... o teclado.
      t.tabIndex = -1;
      // pointerdown + preventDefault: o editor NÃO perde o foco ao clicar
      t.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        aoApertarVirtual(code, base, alt);
        t.classList.add("apertada");
      });
      t.addEventListener("pointerup", () => t.classList.remove("apertada"));
      t.addEventListener("pointerleave", () => t.classList.remove("apertada"));
      // ativação por Enter/Espaço (clique sintético, detail === 0): o
      // pointerdown não dispara nesse caminho, então a tecla ficava inerte.
      t.addEventListener("click", (e) => {
        if (e.detail !== 0) return;
        aoApertarVirtual(code, base, alt);
      });
      div.appendChild(t);
    }
    raiz.appendChild(div);
  }
  document.body.appendChild(raiz);

  // rastreia o editor focado (p/ onde vai a digitação virtual)
  document.addEventListener("focusin", (e) => {
    if (ehEditavel(e.target)) alvo = e.target;
  });

  // espelho do teclado físico: acende a tecla + som em TODA digitação
  // (qualquer um dos teclados soa e acende — pedido do dono)
  document.addEventListener("keydown", (e) => {
    const el = raiz.querySelector(`.vk-tecla[data-code="${CSS.escape(e.code)}"]`);
    if (el) el.classList.add("apertada");
    if (!e.repeat) juice.tocar("tecla");
  }, true);
  document.addEventListener("keyup", (e) => {
    const el = raiz.querySelector(`.vk-tecla[data-code="${CSS.escape(e.code)}"]`);
    if (el) el.classList.remove("apertada");
  }, true);
  window.addEventListener("blur", () => {
    raiz.querySelectorAll(".vk-tecla.apertada").forEach((el) => el.classList.remove("apertada"));
  });
}

// Reacopla o teclado no slot (ou devolve ao body). USA A REFERÊNCIA do módulo:
// depois de um render (innerHTML), o elemento fica DESTACADO do DOM — um
// getElementById devolveria null e o teclado sumiria para sempre (bug r8.6).
export function acoplarTeclado(slot) {
  if (!raiz) return;
  if (slot) slot.appendChild(raiz);
  else if (raiz.parentElement !== document.body) document.body.appendChild(raiz);
}

export function alternarTeclado(forcar) {
  const abrir = forcar != null ? forcar : !document.body.classList.contains("vk-aberto");
  document.body.classList.toggle("vk-aberto", abrir);
  return abrir;
}

export function tecladoAberto() {
  return document.body.classList.contains("vk-aberto");
}
