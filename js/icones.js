// ---------------------------------------------------------------------------
// icones.js — biblioteca central de ícones geométricos do dojo
//
// Linguagem visual: cubos e prismas em projeção dimétrica 2:1 (a inclinação
// clássica de jogo isométrico: 2 de horizontal para 1 de vertical, ~26.57°),
// luz sempre do topo-esquerda (face de cima mais clara, face direita escura).
//
// Regras dos traçados (valem para TODOS os ícones daqui):
//   - grid 24px, traço 2px, pontas quadradas (linecap square / linejoin miter)
//   - só retas: horizontais, verticais, diagonais 45° ou 2:1 (ex: dx4,dy2)
//   - zero <circle>, zero arcos — círculos viram losangos ou octógonos
//   - coordenadas limpas (inteiros ou .5) para ficarem nítidas no grid
//   - acentos pequenos preenchidos (fill="currentColor") são permitidos
//   - margem ~3px até a borda do viewBox, silhuetas centradas
// ---------------------------------------------------------------------------

// helper: casca <svg> padrão 24x24 com o traço geométrico do dojo
export function svgIco(paths, extra = "") {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">${paths}${extra}</svg>`;
}

// portal/torii de dojo geométrico — mesmo ícone para todos os bosses de ato:
// verga com pontas erguidas a 45°, duas colunas retas, travessa e prumo central
const TORII = svgIco('<path d="M3 5l2 2h14l2-2"/><path d="M7 7v14M17 7v14M5 12h14M12 7v5"/>');

// ---------------------------------------------------------------------------
// ícones da trilha (um por nível)
// ---------------------------------------------------------------------------
export const ICONE_NIVEL = {
  // cubo dimétrico: losango 2:1 no topo + arestas verticais + Y interno
  // (a caixa que guarda um valor)
  variaveis: svgIco('<path d="M12 4 20 8v8l-8 4-8-4V8z"/><path d="M4 8l8 4 8-4M12 12v8"/>'),

  // linhas de texto de comprimentos variados
  texto: svgIco('<path d="M4 6h16M4 12h11M4 18h14"/>'),

  // grade 2x2 de quadrados + sinal de "mais um item"
  colecoes: svgIco('<rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/><rect x="4" y="13" width="7" height="7"/><path d="M16.5 14v5M14 16.5h5"/>'),

  // caixa-máquina: seta entra pela esquerda, seta sai pela direita
  funcoes: svgIco('<rect x="8" y="7" width="8" height="10"/><path d="M3 12h5M6 10l2 2-2 2M16 12h5M19 10l2 2-2 2"/>'),

  boss1: TORII,

  // raio angular: zigue-zague a 45° com ponta de seta em esquadro
  comprehensions: svgIco('<path d="M17 3 8 12h6l-8 8"/><path d="M6 15v5h5"/>'),

  // escudo angular (pentágono apontando para baixo) com exclamação reta
  excecoes: svgIco('<path d="M4 3h16v8l-8 8-8-8z"/><path d="M12 7v5"/>', '<path d="M12 14l1.5 1.5L12 17l-1.5-1.5z" fill="currentColor" stroke="none"/>'),

  // documento com canto dobrado a 45° + duas linhas de texto
  arquivos: svgIco('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>'),

  // lupa geométrica: lente = quadrado rotacionado 45°, cabo na diagonal 45°
  regex: svgIco('<path d="M10 4l6 6-6 6-6-6z"/><path d="M14 14l6 6"/>'),

  // árvore de herança: um quadrado em cima, dois embaixo, conectores retos
  classes: svgIco('<rect x="8.5" y="3" width="7" height="7"/><rect x="4" y="14" width="7" height="7"/><rect x="13" y="14" width="7" height="7"/><path d="M12 10v2M7.5 14v-2h9v2"/>'),

  boss2: TORII,

  // globo sem curvas: octógono + meridiano vertical + equador horizontal
  http: svgIco('<path d="M8 3h8l5 5v8l-5 5H8l-5-5V8z"/><path d="M12 3v18M3 12h18"/>'),

  // ciclo de retry quadrado: dois "L" em rotação com pontas de seta a 45°
  resiliencia: svgIco('<path d="M5 16V8h11M13 5l3 3-3 3"/><path d="M19 8v8H8M11 13l-3 3 3 3"/>'),

  // duas setas horizontais em sentidos opostos, intercaladas
  assincrono: svgIco('<path d="M4 8h13M14 5l3 3-3 3"/><path d="M20 16H7M10 13l-3 3 3 3"/>'),

  // matriz 3x3: quadrado com duas divisões verticais e duas horizontais
  numpy: svgIco('<rect x="3" y="3" width="18" height="18"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>'),

  // tabela com linha de cabeçalho destacada (rótulos curtos no topo)
  pandas: svgIco('<rect x="3" y="4" width="18" height="16"/><path d="M3 9h18M12 9v11M3 14.5h18"/><path d="M6 6.5h4M14 6.5h4"/>'),

  boss3: TORII,

  // colchetes [ ] com dois blocos quadrados dentro (texto fatiado)
  chunking: svgIco('<path d="M8 3H4v18h4M16 3h4v18h-4"/><rect x="9.5" y="6.5" width="5" height="5"/><rect x="9.5" y="12.5" width="5" height="5"/>'),

  // losangos 2:1 concêntricos + núcleo central cheio (espaço vetorial)
  embeddings: svgIco('<path d="M12 7.5 21 12l-9 4.5L3 12z"/><path d="M12 10l4 2-4 2-4-2z"/>', '<path d="M12 11l2 1-2 1-2-1z" fill="currentColor" stroke="none"/>'),

  boss4: TORII,

  // balão de fala retangular com cauda triangular a 45° + linhas de texto
  llm: svgIco('<path d="M4 4h16v12h-9l-4 4v-4H4z"/><path d="M8 8h8M8 12h5"/>'),

  // chaves { } angulares — todas as pontas a 45°, nenhuma curva
  estruturada: svgIco('<path d="M10 4l-2 2v4l-2 2 2 2v4l2 2"/><path d="M14 4l2 2v4l2 2-2 2v4l-2 2"/>'),

  // coroa angular do BOSS FINAL: três picos em zigue-zague 45° + base + gema
  boss5: svgIco('<path d="M4 17V7l4 4 4-4 4 4 4-4v10z"/><path d="M4 20h16"/>', '<path d="M12 12l1.5 1.5L12 15l-1.5-1.5z" fill="currentColor" stroke="none"/>'),
};

// ---------------------------------------------------------------------------
// ícones de interface
// ---------------------------------------------------------------------------

// cadeado: corpo quadrado + alça trapezoidal (ombros a 45°, sem arco)
export const ICONE_CADEADO = svgIco('<rect x="5" y="11" width="14" height="9"/><path d="M8 11V9l3-3h2l3 3v2"/>', '<path d="M12 13.5l1.5 1.5L12 16.5l-1.5-1.5z" fill="currentColor" stroke="none"/>');

// gráfico: eixo em L + três barras verticais crescentes
export const ICONE_GRAFICO = svgIco('<path d="M4 4v16h16"/><path d="M9 20v-5M13 20v-9M17 20v-13"/>');

// laboratório web: erlenmeyer de retas (gargalo vertical, laterais 1:2)
export const ICONE_LAB = svgIco('<path d="M10 3v6l-5 10h14l-5-10V3"/><path d="M8 3h8M8 15h8"/>');

// alvo (modo livre): losangos 45° concêntricos + centro cheio
export const ICONE_ALVO = svgIco('<path d="M12 3l9 9-9 9-9-9z"/><path d="M12 7l5 5-5 5-5-5z"/>', '<path d="M12 10l2 2-2 2-2-2z" fill="currentColor" stroke="none"/>');

// faixa de karatê (modo dan): banda horizontal + nó quadrado + pontas a 45°
export const ICONE_FAIXA_MODO = svgIco('<rect x="3" y="9" width="18" height="6"/><rect x="9" y="8" width="6" height="8"/><path d="M10 16l-4 4M14 16l4 4"/>');

// raio 16px do header: zigue-zague 45° com ponta de seta em esquadro
export const ICONE_RAIO = '<svg class="ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M11 3 6 8h4l-5 5"/><path d="M5 9v4h4"/></svg>';

// check 16px: dois segmentos retos a 45°
export const ICONE_CHECK = '<svg class="ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M2 8l4 4 8-8"/></svg>';

// configurações: porca sextavada de retas (laterais 1:2) + losango central
export const ICONE_CONFIG = svgIco('<path d="M7 4h10l4 8-4 8H7l-4-8z"/><path d="M12 8l4 4-4 4-4-4z"/>');

// chevron de navegação (dois segmentos a 45°)
export const ICONE_SETA_DIR = svgIco('<path d="M9 5l7 7-7 7"/>');

// ---------------------------------------------------------------------------
// avatar: cubo dimétrico 2:1 laranja, o companheiro do jogador
// Luz do topo-esquerda: topo claro, frente média, direita escura.
// Cores literais de propósito — o cubinho é laranja nos dois temas.
// ---------------------------------------------------------------------------
export const AVATAR_CUBO = `<svg viewBox="0 0 40 40" aria-hidden="true">
  <path d="M20 6 34 13 20 20 6 13Z" fill="#f5c98a"/>
  <path d="M6 13 20 20V34L6 27Z" fill="#eda75f"/>
  <path d="M34 13 20 20V34l14-7Z" fill="#c47a35"/>
  <path d="M20 6 34 13V27L20 34 6 27V13Z" fill="none" stroke="#4a3b2a" stroke-width="2" stroke-linejoin="miter"/>
  <path d="M6 13 20 20 34 13M20 20V34" fill="none" stroke="#4a3b2a" stroke-width="2"/>
  <rect x="9" y="19" width="3" height="6" fill="#4a3b2a"/>
  <rect x="15" y="22" width="3" height="6" fill="#4a3b2a"/>
  <path d="M20 11 24 13 20 15 16 13Z" fill="#f2cf6b"/>
</svg>`;

// ---------------------------------------------------------------------------
// faixas de graduação: banda horizontal + nó quadrado central + duas pontas
// caindo a 45°. Cores literais (a cor da faixa é a cor da faixa em qualquer
// tema); contorno fino #8a7358 como hoje.
// ---------------------------------------------------------------------------
import { t } from "./i18n.js";

export function iconeFaixa(faixa, tam = 18) {
  const cores = { branca: "#e6e9ed", azul: "#4f8fd9", roxa: "#9b6dd6", marrom: "#a0714f", preta: "#2a2a2e" };
  const c = cores[faixa] || cores.branca;
  return `<svg width="${tam}" height="${tam}" viewBox="0 0 24 24" aria-label="${t("faixa.aria", { faixa: t("cor." + faixa) })}" class="faixa-ico">` +
    `<path d="M9 16h3l-4 4H5z" fill="${c}" stroke="#8a7358" stroke-width="1" stroke-linejoin="miter"/>` +
    `<path d="M12 16h3l4 4h-3z" fill="${c}" stroke="#8a7358" stroke-width="1" stroke-linejoin="miter"/>` +
    `<rect x="2" y="9" width="20" height="6" fill="${c}" stroke="#8a7358" stroke-width="1"/>` +
    `<rect x="9" y="8" width="6" height="8" fill="${c}" stroke="#8a7358" stroke-width="1"/>` +
    `</svg>`;
}
