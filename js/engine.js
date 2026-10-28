// Regras do jogo: XP, streak, faixas, maestria, revisão espaçada (Leitner),
// progressão de runs/tiers, Modo Dan e Modo Livre.
// A faixa é SEMPRE derivada (nunca persistida). O "tempo" da revisão é o
// progresso no jogo — nunca calendário.

import { exerciciosDe } from "./content.js";
import { truncarCodigo } from "./storage.js";

// ---------------------------------------------------------------------------
// XP e streak
// ---------------------------------------------------------------------------
export function multiplicadorStreak(streak) {
  if (streak >= 10) return 1.5;
  if (streak >= 5) return 1.25;
  if (streak >= 3) return 1.1;
  return 1.0;
}

// piso da run N = 70% do XP máximo teórico (base, sem streak) até aquela run
export function pisoXp(conteudo, runN) {
  let total = 0;
  for (let t = 1; t <= runN; t++) total += conteudo.xpMaxPorTier[t] || 0;
  return Math.round(total * 0.7);
}

function hist(save, exId) {
  if (!save.historico[exId]) {
    save.historico[exId] = {
      tentativas: 0,
      resolvido: false,
      dicas_usadas: 0,
      solucao_vista: false,
      pulado: false,
      xp_ganho: 0,
      xp_zerado: false,
      estrela_pendente: false,
      recuperado: false,
      ultimo_codigo: null,
    };
  }
  return save.historico[exId];
}

export function registrarTentativa(save, exId, codigo) {
  const h = hist(save, exId);
  h.tentativas += 1;
  h.ultimo_codigo = truncarCodigo(codigo);
}

export function registrarCodigo(save, exId, codigo) {
  hist(save, exId).ultimo_codigo = truncarCodigo(codigo);
}

// ---------------------------------------------------------------------------
// Resolução de exercício (fluxo normal, revisão, modo livre)
// ---------------------------------------------------------------------------
export function resolverExercicio(save, conteudo, ex, opts = {}) {
  const { dicaMax = 0, viuSolucao = false, emRevisao = false, pulado = false } = opts;
  const h = hist(save, ex.id);
  const jaResolvido = h.resolvido;
  const evento = { xpGanho: 0, estrelasNovas: [], fimNivel: null, fimAto: null, fimRun: false };

  h.resolvido = true;
  h.pulado = pulado;
  h.dicas_usadas = Math.max(h.dicas_usadas, dicaMax);
  if (viuSolucao) h.solucao_vista = true;

  // streak: só muda no PRIMEIRO solve ou em revisão (rejogar no Livre/Dan não
  // mexe na ofensiva). Dica 2+, solução ou pulo quebram; errar teste NUNCA.
  const quebraStreak = dicaMax >= 2 || viuSolucao || pulado;
  if (!jaResolvido || emRevisao) {
    if (quebraStreak) {
      save.streak.atual = 0;
    } else {
      save.streak.atual += 1;
      save.streak.melhor = Math.max(save.streak.melhor, save.streak.atual);
    }
  }

  // XP
  if (emRevisao && jaResolvido) {
    // pago em resolverRevisaoItem (50% do base, na promoção de caixa)
  } else if (!jaResolvido) {
    let xp = ex.xp;
    if (pulado || viuSolucao || dicaMax >= 3) {
      xp = 0;
      h.xp_zerado = true; // recuperável na fila de revisão
    } else if (dicaMax === 2) {
      xp = Math.round(xp * 0.5);
    }
    xp = Math.round(xp * multiplicadorStreak(save.streak.atual));
    h.xp_ganho = xp;
    save.xp_total += xp;
    evento.xpGanho = xp;
  }

  // maestria (estrelas por conceito; solução vista adia a estrela)
  if (!pulado) {
    let alvo = 0;
    if (ex.tier === 1) alvo = 1;
    else if (ex.tier === 2 && dicaMax <= 1 && !viuSolucao) alvo = 2;
    else if (ex.tier === 3 && dicaMax === 0 && !viuSolucao) alvo = 3;
    if (viuSolucao && ex.tier === 1) {
      h.estrela_pendente = true;
      alvo = 0;
    }
    if (alvo > 0) {
      for (const c of ex.conceitos) {
        const atual = save.maestria[c] || 0;
        if (alvo > atual) {
          save.maestria[c] = alvo;
          evento.estrelasNovas.push({ conceito: c, estrelas: alvo });
        }
      }
    }
  }

  // entrada na fila de revisão — só na PRIMEIRA resolução (rejogar não reinjeta)
  if (!emRevisao && !jaResolvido) {
    if (dicaMax === 2) entrarFila(save, conteudo, ex, 2);
    else if (dicaMax >= 3 || viuSolucao || pulado) entrarFila(save, conteudo, ex, 1);
  }

  // fechamentos (nível/ato/run) — só no fluxo normal da trilha
  if (!emRevisao && !jaResolvido) {
    const node = conteudo.trilhaPorSlug.get(ex.nivel);
    if (node && nivelCompleto(save, conteudo, ex.nivel, ex.tier)) {
      evento.fimNivel = ex.nivel;
      if (atoCompleto(save, conteudo, node.atoIdx, ex.tier)) evento.fimAto = node.atoId;
      if (fimDeRun(save, conteudo, ex.tier)) evento.fimRun = true;
    }
  }
  return evento;
}

export function pularExercicio(save, conteudo, ex) {
  return resolverExercicio(save, conteudo, ex, { pulado: true });
}

// Exercícios do Laboratório Web: progressão leve (XP + maestria + streak),
// sem acoplamento com tiers/faixas/fechamentos da trilha Python.
export function resolverWeb(save, ex, { dicaMax = 0, viuSolucao = false } = {}) {
  const h = hist(save, ex.id);
  const jaResolvido = h.resolvido;
  const evento = { xpGanho: 0, estrelasNovas: [] };
  h.resolvido = true;
  h.dicas_usadas = Math.max(h.dicas_usadas, dicaMax);
  if (viuSolucao) h.solucao_vista = true;

  const quebraStreak = dicaMax >= 2 || viuSolucao;
  if (!jaResolvido) {                 // rejogar exercício web não infla o streak
    if (quebraStreak) save.streak.atual = 0;
    else {
      save.streak.atual += 1;
      save.streak.melhor = Math.max(save.streak.melhor, save.streak.atual);
    }
  }

  if (!jaResolvido) {
    let xp = ex.xp || 20;
    if (viuSolucao || dicaMax >= 3) { xp = 0; h.xp_zerado = true; }
    else if (dicaMax === 2) xp = Math.round(xp * 0.5);
    xp = Math.round(xp * multiplicadorStreak(save.streak.atual));
    h.xp_ganho = xp;
    save.xp_total += xp;
    evento.xpGanho = xp;
  }

  // maestria: web dá 1 estrela nos conceitos ao resolver sem ver solução
  if (!viuSolucao) {
    for (const c of ex.conceitos || []) {
      if ((save.maestria[c] || 0) < 1) {
        save.maestria[c] = 1;
        evento.estrelasNovas.push({ conceito: c, estrelas: 1 });
      }
    }
  }
  return evento;
}

// pular exercício web — usa hist() para não deixar campos faltando (senão
// dicas_usadas viraria NaN ao re-resolver depois).
export function pularWeb(save, ex) {
  const h = hist(save, ex.id);
  if (!h.resolvido) {
    h.pulado = true;
    h.resolvido = true;
    h.xp_zerado = true;
    save.streak.atual = 0;
  }
  return h;
}

// ---------------------------------------------------------------------------
// Best-times: registro de tempo de resolução (abertura -> acerto) + recordes
// ---------------------------------------------------------------------------
export function registrarTempo(save, exId, ms) {
  const h = hist(save, exId);
  if (!h.tempos) h.tempos = [];
  h.tempos.push({ t: Math.round(ms) });
  if (h.tempos.length > 8) h.tempos = h.tempos.slice(-8);
  const anterior = h.pb_tempo != null ? h.pb_tempo : null;
  const novoRecorde = anterior == null || ms < anterior;
  if (novoRecorde) h.pb_tempo = Math.round(ms);
  return { novoRecorde, anterior, atual: Math.round(ms) };
}

// dias praticados — contador que só sobe (sem culpa por pausar; não é streak)
export function marcarDiaPraticado(save, hoje) {
  if (save.ultimo_dia !== hoje) {
    save.ultimo_dia = hoje;
    save.dias_praticados = (save.dias_praticados || 0) + 1;
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Progresso na trilha
// ---------------------------------------------------------------------------
export function nivelCompleto(save, conteudo, slug, tier) {
  const exs = exerciciosDe(conteudo, slug, tier);
  return exs.length > 0 && exs.every((e) => save.historico[e.id]?.resolvido);
}

export function atoCompleto(save, conteudo, atoIdx, tier) {
  return conteudo.trilha
    .filter((n) => n.atoIdx === atoIdx)
    .every((n) => nivelCompleto(save, conteudo, n.slug, tier));
}

// run 1/2: termina ao vencer o boss5 do tier. run 3: o boss5-T3 fica FORA
// (é a prova da faixa preta, destravada na marrom) — a run 3 "fecha" sem ele.
export function fimDeRun(save, conteudo, tier) {
  if (tier <= 2) return nivelCompleto(save, conteudo, "boss5", tier);
  return conteudo.trilha
    .filter((n) => n.slug !== "boss5")
    .every((n) => nivelCompleto(save, conteudo, n.slug, 3));
}

export function runFeita(save, conteudo, n) {
  return fimDeRun(save, conteudo, n);
}

export function tierDesbloqueado(save, conteudo) {
  let t = 1;
  if (runFeita(save, conteudo, 1) && save.xp_total >= pisoXp(conteudo, 1)) t = 2;
  if (t === 2 && runFeita(save, conteudo, 2) && save.xp_total >= pisoXp(conteudo, 2)) t = 3;
  return t;
}

export function proximoExercicio(save, conteudo) {
  const tier = save.run_atual.tier;
  for (const node of conteudo.trilha) {
    if (tier === 3 && node.slug === "boss5" && faixa(save, conteudo) !== "marrom"
        && faixa(save, conteudo) !== "preta") {
      continue; // boss5-T3 é a prova da preta; exige faixa marrom
    }
    for (const ex of exerciciosDe(conteudo, node.slug, tier)) {
      if (!save.historico[ex.id]?.resolvido) return ex;
    }
  }
  return null;
}

export function progressoNivel(save, conteudo, slug, tier) {
  const exs = exerciciosDe(conteudo, slug, tier);
  const feitos = exs.filter((e) => save.historico[e.id]?.resolvido).length;
  return { feitos, total: exs.length };
}

export function progressoAto(save, conteudo, atoIdx, tier) {
  let feitos = 0;
  let total = 0;
  for (const node of conteudo.trilha.filter((n) => n.atoIdx === atoIdx)) {
    const p = progressoNivel(save, conteudo, node.slug, tier);
    feitos += p.feitos;
    total += p.total;
  }
  return { feitos, total };
}

// ---------------------------------------------------------------------------
// Faixas
// ---------------------------------------------------------------------------
export function boss5T3Vencido(save, conteudo) {
  return nivelCompleto(save, conteudo, "boss5", 3);
}

export function pctConceitos3Estrelas(save, conteudo) {
  const todos = new Set();
  for (const n of conteudo.trilha) for (const c of n.conceitos) todos.add(c);
  const tres = [...todos].filter((c) => (save.maestria[c] || 0) >= 3).length;
  return todos.size ? tres / todos.size : 0;
}

export function faixa(save, conteudo) {
  const xp = save.xp_total;
  const marrom = runFeita(save, conteudo, 3) && xp >= pisoXp(conteudo, 3)
    && runFeita(save, conteudo, 2) && runFeita(save, conteudo, 1);
  if (marrom && boss5T3Vencido(save, conteudo)
      && pctConceitos3Estrelas(save, conteudo) >= 0.8
      && save.revisao.length === 0) {
    return "preta";
  }
  if (marrom) return "marrom";
  if (runFeita(save, conteudo, 2) && xp >= pisoXp(conteudo, 2)
      && runFeita(save, conteudo, 1)) return "roxa";
  if (runFeita(save, conteudo, 1) && xp >= pisoXp(conteudo, 1)) return "azul";
  return "branca";
}

export function checklistPreta(save, conteudo) {
  return {
    boss5T3: boss5T3Vencido(save, conteudo),
    pctConceitos: pctConceitos3Estrelas(save, conteudo),
    conceitosOk: pctConceitos3Estrelas(save, conteudo) >= 0.8,
    filaVazia: save.revisao.length === 0,
    filaTamanho: save.revisao.length,
  };
}

// ---------------------------------------------------------------------------
// Revisão espaçada — Leitner com 3 caixas, agendada por PROGRESSO
// ---------------------------------------------------------------------------
function entrarFila(save, conteudo, ex, caixa) {
  const node = conteudo.trilhaPorSlug.get(ex.nivel);
  const existente = save.revisao.find((r) => r.exercicio_id === ex.id);
  if (existente) {
    existente.caixa = Math.min(existente.caixa, caixa);
    return;
  }
  save.revisao.push({
    exercicio_id: ex.id,
    caixa,
    criado_pos: node ? node.pos : 0,
    criado_ato: node ? node.atoIdx : 0,
    criado_run: save.run_atual.numero,
    erros: 0,
  });
}

// momento: {tipo: "fim-nivel"|"fim-ato"|"inicio-run", pos, atoIdx, run}
export function revisoesDevidas(save, conteudo, momento) {
  const devidas = save.revisao.filter((r) => {
    // >= garante que itens criados no ÚLTIMO nó/ato/run ainda fiquem devidos
    // (senão ficariam presos para sempre e travariam a faixa preta).
    if (r.caixa === 1) return momento.tipo === "fim-nivel" && momento.pos >= r.criado_pos;
    if (r.caixa === 2) return momento.tipo === "fim-ato" && momento.atoIdx >= r.criado_ato;
    // caixa 3: no início da próxima run OU no fim de um ato (garante limpeza na run terminal)
    return (momento.tipo === "inicio-run" && momento.run > r.criado_run)
      || (momento.tipo === "fim-ato" && momento.atoIdx >= r.criado_ato);
  });
  devidas.sort((a, b) => a.caixa - b.caixa || a.criado_pos - b.criado_pos);
  return devidas.slice(0, 3);
}

// chamada quando o jogador conclui um item da revisão
export function resolverRevisaoItem(save, conteudo, ex, { sucesso, dicaMax = 0, viuSolucao = false }) {
  const item = save.revisao.find((r) => r.exercicio_id === ex.id);
  if (!item) return { xpGanho: 0, saiuDaFila: false };
  const h = hist(save, ex.id);
  const evento = { xpGanho: 0, saiuDaFila: false };
  if (sucesso && dicaMax === 0 && !viuSolucao) {
    const xp = Math.round(ex.xp * 0.5);
    save.xp_total += xp;
    evento.xpGanho = xp;
    if (h.xp_zerado) {
      h.xp_zerado = false;
      h.recuperado = true;
    }
    item.caixa += 1;
    if (item.caixa > 3) {
      save.revisao = save.revisao.filter((r) => r.exercicio_id !== ex.id);
      evento.saiuDaFila = true;
      if (h.estrela_pendente) {
        h.estrela_pendente = false;
        if (ex.tier === 1) {
          for (const c of ex.conceitos) {
            save.maestria[c] = Math.max(save.maestria[c] || 0, 1);
          }
        }
      }
    }
  } else {
    item.caixa = 1;
    item.erros += 1;
  }
  return evento;
}

// ---------------------------------------------------------------------------
// Modo Dan (pós-preta): desafios remixados determinísticos (seed fixa por dan)
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// cada "boss dan" = 3 exercícios T3 de ATOS diferentes, escolhidos por seed fixa
export function danDesafios(conteudo, danBossIdx) {
  const rng = mulberry32(1000 + danBossIdx);
  const porAto = [[], [], [], []];
  for (const ex of conteudo.porId.values()) {
    if (ex.tier === 3) {
      const node = conteudo.trilhaPorSlug.get(ex.nivel);
      if (node) porAto[node.atoIdx].push(ex);
    }
  }
  for (const lista of porAto) lista.sort((a, b) => (a.id < b.id ? -1 : 1));
  const atos = [0, 1, 2, 3].filter((i) => porAto[i].length);
  // escolhe 3 atos distintos
  for (let i = atos.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [atos[i], atos[j]] = [atos[j], atos[i]];
  }
  const escolhidos = atos.slice(0, 3).map((a) => {
    const lista = porAto[a];
    return lista[Math.floor(rng() * lista.length)];
  });
  return escolhidos;
}

// ---------------------------------------------------------------------------
// Estatísticas para cerimônias
// ---------------------------------------------------------------------------
export function estatisticasRun(save, conteudo, tier) {
  let resolvidos = 0;
  let semDica = 0;
  let xp = 0;
  for (const ex of conteudo.porId.values()) {
    if (ex.tier !== tier) continue;
    const h = save.historico[ex.id];
    if (h?.resolvido) {
      resolvidos += 1;
      xp += h.xp_ganho || 0;
      if (!h.dicas_usadas && !h.solucao_vista && !h.pulado) semDica += 1;
    }
  }
  return { resolvidos, semDica, pctSemDica: resolvidos ? semDica / resolvidos : 0, xp };
}
