// Persistência em localStorage do Python AI Dojo.
// Chave única, migração por versão, export/import, backup antes de migrar.

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
    salvar(save); // salvar() já é try/catch que só avisa — nunca derruba o save
  }
  return { save, corrompido: false, novo: false };
}

export function salvar(save) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(save));
  } catch (e) {
    console.warn("não consegui salvar:", e);
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
    leitor.onerror = () => reject(new Error("não consegui ler o arquivo"));
    leitor.onload = () => {
      try {
        let save = JSON.parse(String(leitor.result));
        if (!save || typeof save.schema_versao !== "number") {
          throw new Error("o arquivo não parece um save do Dojo");
        }
        if (save.schema_versao > SCHEMA_VERSAO) {
          throw new Error("o save é de uma versão mais nova do Dojo");
        }
        while (save.schema_versao < SCHEMA_VERSAO) {
          const migrar = MIGRACOES[save.schema_versao];
          if (!migrar) throw new Error("migração ausente");
          save = migrar(save);
          save.schema_versao += 1;
        }
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
