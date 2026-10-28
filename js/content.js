// Carga e indexação do conteúdo (manifest + atos + bosses).
// Idioma: pt lê content/*.json; en lê content/en/*.json (MESMOS nomes de
// arquivo, MESMOS ids — contrato em tools/i18n_check.py e docs/I18N.md).

import { t, idioma } from "./i18n.js";

// Versão do módulo (o mesmo ?v= com que o content.js foi carregado pelo import
// map). Anexada às URLs de conteúdo para que o navegador possa CACHEAR os JSON
// com segurança: um bump de ?v= invalida o cache (igual ao grafo de módulos ES).
// Sem isto o boot dependia de `no-store` (rede obrigatória em TODO load/reload —
// frágil: um reload offline/flaky derrubava o jogo na tela de erro).
const V = new URL(import.meta.url).search; // ex.: "?v=21" (ou "" fora do import map)

// pasta de conteúdo de um idioma ("./content/" para pt, "./content/en/" para en)
export function pastaConteudo(lang) {
  return lang === "en" ? "./content/en/" : "./content/";
}

export async function carregarConteudo(lang = idioma()) {
  const pasta = pastaConteudo(lang);
  const manifest = await buscarJson(pasta + "manifest.json");
  const nomes = manifest.atos.map((a) => a.arquivo).concat([manifest.bosses_arquivo]);
  const arquivos = await Promise.all(nomes.map((n) => buscarJson(pasta + n)));

  // Laboratório Web (opcional — tolera ausência)
  let webLab = [];
  const webPorNivel = new Map();
  try {
    const web = await buscarJson(pasta + "web-lab.json");
    webLab = web.exercicios || [];
    for (const ex of webLab) {
      ex.trilha = "web";
      const chave = ex.nivel || "web";
      if (!webPorNivel.has(chave)) webPorNivel.set(chave, []);
      webPorNivel.get(chave).push(ex);
    }
  } catch {
    webLab = [];
  }

  const porId = new Map();
  const porNivelTier = new Map(); // "slug|tier" -> [exercicios ordenados]
  for (const arq of arquivos) {
    for (const ex of arq.exercicios || []) {
      if (porId.has(ex.id)) console.warn("id duplicado no conteúdo:", ex.id);
      porId.set(ex.id, ex);
      const chave = ex.nivel + "|" + ex.tier;
      if (!porNivelTier.has(chave)) porNivelTier.set(chave, []);
      porNivelTier.get(chave).push(ex);
    }
  }
  for (const ex of webLab) porId.set(ex.id, ex); // acessíveis por id/hash
  for (const lista of porNivelTier.values()) {
    lista.sort((a, b) => (a.id < b.id ? -1 : 1));
  }

  // trilha linear: [{slug, titulo, tipo, atoId, atoTitulo, atoIdx, conceitos, pos}]
  const trilha = [];
  manifest.atos.forEach((ato, atoIdx) => {
    ato.niveis.forEach((nivel) => {
      trilha.push({
        slug: nivel.slug,
        titulo: nivel.titulo,
        tipo: nivel.tipo,
        atoId: ato.id,
        atoTitulo: ato.titulo,
        atoIdx,
        conceitos: nivel.conceitos,
        pos: trilha.length,
      });
    });
  });
  const trilhaPorSlug = new Map(trilha.map((n) => [n.slug, n]));

  // XP máximo teórico por tier (base, sem multiplicadores de streak)
  const xpMaxPorTier = { 1: 0, 2: 0, 3: 0 };
  for (const ex of porId.values()) {
    xpMaxPorTier[ex.tier] += ex.xp;
  }

  return { manifest, porId, porNivelTier, trilha, trilhaPorSlug, xpMaxPorTier,
           webLab, webPorNivel };
}

export function exerciciosDe(conteudo, slug, tier) {
  return conteudo.porNivelTier.get(slug + "|" + tier) || [];
}

async function buscarJson(url) {
  // retry COM TIMEOUT: além de falha transiente (Failed to fetch), uma conexão
  // pode TRAVAR sem nunca rejeitar (visto ao vivo: no burst de 7 fetches
  // paralelos, 2-3 pendura(va)m para sempre → boot eterno em tela vazia).
  // O AbortController converte o travamento em erro → a retentativa resolve.
  let ultimoErro;
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 4000 + tentativa * 2000);
    try {
      const r = await fetch(url + V, { cache: "default", signal: ctl.signal });
      if (!r.ok) throw new Error("status " + r.status);
      return await r.json();
    } catch (e) {
      ultimoErro = e;
      await new Promise((res) => setTimeout(res, 250 * (tentativa + 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(t("erro.carregar", { url, msg: ultimoErro?.message }));
}
