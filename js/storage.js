// Persistência em localStorage do Python AI Dojo.
// Chave única, migração por versão, export/import, backup antes de migrar.

import { t } from "./i18n.js";

const CHAVE = "pyai_dojo_save";
const CHAVE_BACKUP = "pyai_dojo_save_backup";
export const SCHEMA_VERSAO = 3;

// MIGRACOES[n] migra um save de schema_versao n para n+1 (aplicadas em cadeia).
const MIGRACOES = {
  // v1 -> v2: redesign calm-tech. Tema "auto" (antigo padrão, que virava escuro
  // em sistemas no modo escuro) passa a "claro"; adiciona campos novos.
  1: (s) => {
    s.config = s.config || {};
    if (s.config.tema === "auto" || s.config.tema == null) s.config.tema = "claro";
    if (s.config.particulas == null) s.config.particulas = true;
    s.config.som = true;           // o antigo padrão "false" era acidental; o jogo agora tem som
    if (s.config.reduzir == null) s.config.reduzir = false;
    if (s.dias_praticados == null) s.dias_praticados = 0;
    if (s.ultimo_dia === undefined) s.ultimo_dia = null;
    return s;
  },
  // v2 -> v3: garante estímulos ligados (houve saves antigos com som/partículas
  // desligados por padrão acidental — o jogo é vivo por padrão).
  2: (s) => {
    s.config = s.config || {};
    s.config.som = true;
    s.config.particulas = true;
    s.config.reduzir = false;
    if (s.config.tema == null || s.config.tema === "auto") s.config.tema = "claro";
    return s;
  },
};

export function novoSave() {
  return {
    schema_versao: SCHEMA_VERSAO,
    xp_total: 0,
    runs_completas: 0,
    run_atual: { numero: 1, tier: 1, nivel_atual: "variaveis", exercicio_atual: null },
    streak: { atual: 0, melhor: 0 },
    maestria: {}, // conceito -> estrelas (0-3)
    revisao: [], // {exercicio_id, caixa, criado_pos, criado_ato, criado_run, erros}
    historico: {}, // exercicio_id -> {tentativas, resolvido, dicas_usadas, tempos, pb_tempo, ...}
    dan: { vencidos: 0 },
    dias_praticados: 0,
    ultimo_dia: null,
    config: { som: true, particulas: true, reduzir: false, tema: "claro" },
  };
}

// ---------------------------------------------------------------------------
// normalizarSave: o save é ENTRADA NÃO CONFIÁVEL (vem de um arquivo importado ou
// de um localStorage que pode ter sido adulterado). Reconstrói o objeto por
// whitelist com coerção de tipo: números viram números finitos >= 0, strings
// viram strings curtas, booleanos só são true se forem exatamente true, e
// historico[*].web_codigo só guarda html/css/js como string truncada. Nada que
// sai daqui pode carregar HTML/JS para dentro de um innerHTML como "número".
// ---------------------------------------------------------------------------
const CHAVES_PROIBIDAS = new Set(["__proto__", "constructor", "prototype"]);
const LIMITE = 1e9;

function inteiro(x, padrao = 0, min = 0, max = LIMITE) {
  const n = typeof x === "number" ? x : (typeof x === "string" && x.trim() !== "" ? Number(x) : NaN);
  if (!Number.isFinite(n)) return padrao;
  return Math.min(max, Math.max(min, Math.floor(n)));
}
function texto(x, max = 80) {
  return typeof x === "string" ? x.slice(0, max) : null;
}
function chaveOk(k) {
  return typeof k === "string" && k.length > 0 && k.length <= 120 && !CHAVES_PROIBIDAS.has(k);
}
function objeto(x) {
  return x && typeof x === "object" && !Array.isArray(x) ? x : {};
}

function normalizarWebCodigo(w) {
  if (!w || typeof w !== "object" || Array.isArray(w)) return null;
  const out = {};
  for (const k of ["html", "css", "js"]) {
    if (typeof w[k] === "string") out[k] = truncarCodigo(w[k]);
  }
  return Object.keys(out).length ? out : null;
}

function normalizarHistorico(hs) {
  const out = {};
  for (const [id, bruto] of Object.entries(objeto(hs))) {
    if (!chaveOk(id) || !bruto || typeof bruto !== "object") continue;
    const h = {
      tentativas: inteiro(bruto.tentativas),
      resolvido: bruto.resolvido === true,
      dicas_usadas: inteiro(bruto.dicas_usadas, 0, 0, 10),
      solucao_vista: bruto.solucao_vista === true,
      pulado: bruto.pulado === true,
      xp_ganho: inteiro(bruto.xp_ganho),
      xp_zerado: bruto.xp_zerado === true,
      estrela_pendente: bruto.estrela_pendente === true,
      recuperado: bruto.recuperado === true,
      ultimo_codigo: typeof bruto.ultimo_codigo === "string" ? truncarCodigo(bruto.ultimo_codigo) : null,
    };
    if ("web_codigo" in bruto) h.web_codigo = normalizarWebCodigo(bruto.web_codigo);
    if (Array.isArray(bruto.tempos)) {
      h.tempos = bruto.tempos
        .filter((t) => t && typeof t === "object")
        .map((t) => ({ t: inteiro(t.t) }))
        .slice(-8);
    }
    if (bruto.pb_tempo != null) {
      const pb = inteiro(bruto.pb_tempo, -1);
      if (pb >= 0) h.pb_tempo = pb;
    }
    out[id] = h;
  }
  return out;
}

export function normalizarSave(s) {
  const base = novoSave();
  const src = objeto(s);
  const run = objeto(src.run_atual);
  const streak = objeto(src.streak);
  const cfg = objeto(src.config);
  const maestria = {};
  for (const [c, v] of Object.entries(objeto(src.maestria))) {
    if (chaveOk(c)) maestria[c] = inteiro(v, 0, 0, 3);
  }
  const revisao = (Array.isArray(src.revisao) ? src.revisao : [])
    .filter((r) => r && typeof r === "object" && chaveOk(r.exercicio_id))
    .slice(0, 500)
    .map((r) => ({
      exercicio_id: r.exercicio_id,
      caixa: inteiro(r.caixa, 1, 1, 4),
      criado_pos: inteiro(r.criado_pos),
      criado_ato: inteiro(r.criado_ato),
      criado_run: inteiro(r.criado_run, 1),
      erros: inteiro(r.erros),
    }));
  const config = {
    som: cfg.som !== false,
    particulas: cfg.particulas !== false,
    reduzir: cfg.reduzir === true,
    tema: ["claro", "escuro", "auto"].includes(cfg.tema) ? cfg.tema : "claro",
  };
  if (typeof cfg.teclado === "boolean") config.teclado = cfg.teclado;
  // idioma: só "pt" | "en"; ausente = o boot decide (navegador / save antigo = pt)
  if (cfg.lang === "pt" || cfg.lang === "en") config.lang = cfg.lang;
  const ultimo = texto(src.ultimo_dia, 10);
  return {
    schema_versao: SCHEMA_VERSAO,
    xp_total: inteiro(src.xp_total),
    runs_completas: inteiro(src.runs_completas, 0, 0, 3),
    run_atual: {
      numero: inteiro(run.numero, 1, 1, 3),
      tier: inteiro(run.tier, 1, 1, 3),
      nivel_atual: texto(run.nivel_atual) || base.run_atual.nivel_atual,
      exercicio_atual: texto(run.exercicio_atual, 120),
    },
    streak: { atual: inteiro(streak.atual), melhor: inteiro(streak.melhor) },
    maestria,
    revisao,
    historico: normalizarHistorico(src.historico),
    dan: { vencidos: inteiro(objeto(src.dan).vencidos, 0, 0, 1000) },
    dias_praticados: inteiro(src.dias_praticados),
    ultimo_dia: ultimo && /^\d{4}-\d{2}-\d{2}$/.test(ultimo) ? ultimo : null,
    config,
  };
}

export function carregar() {
  let bruto;
  try {
    bruto = localStorage.getItem(CHAVE);
  } catch {
    return { save: novoSave(), corrompido: false, novo: true };
  }
  if (!bruto) return { save: novoSave(), corrompido: false, novo: true };
  let save;
  try {
    save = JSON.parse(bruto);
    if (!save || typeof save !== "object" || typeof save.schema_versao !== "number") {
      throw new Error("estrutura inválida");
    }
  } catch {
    return { save: null, corrompido: true, bruto };
  }
  if (save.schema_versao > SCHEMA_VERSAO) {
    return { save: null, corrompido: true, bruto };
  }
  if (save.schema_versao < SCHEMA_VERSAO) {
    // backup é best-effort: falha de ESCRITA (quota cheia) NÃO é corrupção de
    // dados — não pode transformar um save válido em "corrompido".
    try {
      localStorage.setItem(CHAVE_BACKUP, bruto);
    } catch (e) {
      console.warn("backup do save antes da migração falhou:", e);
    }
    try {
      while (save.schema_versao < SCHEMA_VERSAO) {
        const migrar = MIGRACOES[save.schema_versao];
        if (!migrar) throw new Error(`migração ${save.schema_versao} ausente`);
        save = migrar(save);
        save.schema_versao += 1;
      }
    } catch {
      // só aqui é corrupção real: dados que nenhuma migração consegue entender
      return { save: null, corrompido: true, bruto };
    }
  }
  // normaliza SEMPRE (inclusive saves já na versão atual): o localStorage pode ter
  // sido envenenado por um import antigo ou por outra aba. Persiste se mudou.
  const normal = normalizarSave(save);
  if (JSON.stringify(normal) !== bruto) salvar(normal); // salvar() só avisa se falhar
  return { save: normal, corrompido: false, novo: false };
}

export function salvar(save) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(save));
  } catch (e) {
    console.warn("não consegui salvar:", e);
  }
}

// já existe um save gravado neste navegador? (não confunde com save novo em memória)
export function existe() {
  try {
    return localStorage.getItem(CHAVE) != null;
  } catch {
    return false;
  }
}

// Idioma escolhido ANTES de existir save (boas-vindas -> English -> fecha a
// aba): chave própria, pequena, que NÃO conta como save (storage.existe() e o
// "bem-vindo de volta" continuam olhando só CHAVE). Lida entre a URL e o
// idioma do navegador; o save, quando existe, manda.
const CHAVE_IDIOMA = "pyai_dojo_lang";

export function idiomaPreferido() {
  try {
    return localStorage.getItem(CHAVE_IDIOMA);
  } catch {
    return null;
  }
}

export function gravarIdiomaPreferido(l) {
  try {
    localStorage.setItem(CHAVE_IDIOMA, l);
  } catch {
    /* sem storage: a URL (?lang=) ainda carrega a escolha */
  }
}

export function resetar() {
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    /* nada */
  }
}

export function exportar(save) {
  const blob = new Blob([JSON.stringify(save, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "pyai-dojo-save.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function importar(arquivo) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onerror = () => reject(new Error(t("save.lerFalhou")));
    leitor.onload = () => {
      try {
        let save = JSON.parse(String(leitor.result));
        if (!save || typeof save.schema_versao !== "number") {
          throw new Error(t("save.naoParece"));
        }
        if (save.schema_versao > SCHEMA_VERSAO) {
          throw new Error(t("save.maisNovo"));
        }
        while (save.schema_versao < SCHEMA_VERSAO) {
          const migrar = MIGRACOES[save.schema_versao];
          if (!migrar) throw new Error(t("save.migracao"));
          save = migrar(save);
          save.schema_versao += 1;
        }
        save = normalizarSave(save); // arquivo importado = entrada não confiável
        salvar(save);
        resolve(save);
      } catch (e) {
        reject(e);
      }
    };
    leitor.readAsText(arquivo, "utf-8");
  });
}

// Disciplina de tamanho: só o último código, truncado.
export function truncarCodigo(codigo) {
  return (codigo || "").slice(0, 2000);
}
