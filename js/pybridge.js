// Ponte main-thread <-> Web Worker do Pyodide.
// Responsável por: spawn/respawn do worker, timeout em 2 estágios
// (SIGINT via SharedArrayBuffer -> terminate+respawn), pacotes lazy.
// Idioma: todo payload leva "lang" (o runner/mocks falam o idioma do aluno).

import { t, idioma } from "./i18n.js";

const ESCALADA_MS = 2000; // após o SIGINT, 2s para o worker responder

export class PyBridge {
  constructor(callbacks = {}) {
    this.aoMudarFase = callbacks.aoMudarFase || (() => {});
    this.aoProgressoPacote = callbacks.aoProgressoPacote || (() => {});
    this.worker = null;
    this.fase = "inativo"; // inativo|baixando|iniciando|preparando|pronto|reiniciando|erro
    this.sab = null;
    this.interrupt = null;
    this.pacotesCarregados = new Set();
    this.reqSeq = 0;
    this.pendentes = new Map(); // reqId -> {resolve, timers}
    this.pendentesPacotes = new Map();
    this.prontoPromise = null;
    this.prontoResolve = null;
    this.erroFatal = null;
  }

  get sigintDisponivel() {
    return typeof SharedArrayBuffer !== "undefined" && self.crossOriginIsolated === true;
  }

  iniciar() {
    if (this.worker) return this.prontoPromise;
    this.erroFatal = null;
    this.prontoPromise = new Promise((res) => (this.prontoResolve = res));
    this.worker = new Worker("./js/pyworker.js?v=64", { type: "module" });
    this.worker.onmessage = (ev) => this._aoMensagem(ev.data || {});
    this.worker.onerror = (e) => {
      this._setFase("erro", String(e.message || t("py.erroWorker")));
      this._falharPendentes(t("py.caiu"));
    };
    if (this.sigintDisponivel) {
      this.sab = new SharedArrayBuffer(1);
      this.interrupt = new Uint8Array(this.sab);
    }
    this.worker.postMessage({ type: "init", interruptBuffer: this.sab, lang: idioma() });
    return this.prontoPromise;
  }

  _setFase(fase, msg) {
    this.fase = fase;
    if (fase === "erro") this.erroFatal = msg || t("py.erroDesconhecido");
    this.aoMudarFase(fase, msg);
  }

  _aoMensagem(msg) {
    if (msg.type === "fase") {
      this._setFase(msg.fase);
      if (msg.fase === "pronto" && this.prontoResolve) this.prontoResolve();
    } else if (msg.type === "pkg-progresso") {
      this.aoProgressoPacote(msg.msg);
    } else if (msg.type === "pacotes-ok" || msg.type === "pacotes-erro") {
      const p = this.pendentesPacotes.get(msg.reqId);
      if (p) {
        this.pendentesPacotes.delete(msg.reqId);
        if (msg.type === "pacotes-ok") p.resolve();
        else p.reject(new Error(msg.msg));
      }
    } else if (msg.type === "resultado") {
      const p = this.pendentes.get(msg.reqId);
      if (p) {
        this.pendentes.delete(msg.reqId);
        p.limparTimers();
        if (this.interrupt) this.interrupt[0] = 0;
        let resultado;
        try {
          resultado = JSON.parse(msg.json);
        } catch {
          resultado = this._resultadoFatal(t("py.ilegivel"));
        }
        p.resolve(resultado);
      }
    } else if (msg.type === "erro-fatal") {
      this._setFase("erro", msg.msg);
      for (const [, p] of this.pendentes) {
        p.limparTimers();
        p.resolve(this._resultadoFatal(msg.msg));
      }
      this.pendentes.clear();
    }
  }

  _resultadoFatal(texto) {
    return {
      status: "erro_execucao",
      stdout: "",
      erro: {
        tipo: "AmbientePython",
        linha: null,
        mensagem_didatica: t("py.fatal.didatica"),
        mensagem_original: texto,
      },
      testes: [],
    };
  }

  // resolve toda execução pendente como erro fatal e rejeita toda espera de
  // pacote — chamado quando o worker cai (onerror), para não deixar o await
  // pendurado (soft-lock do botão Rodar) nem esperar o timeout inteiro com
  // mensagem enganosa de "loop infinito".
  _falharPendentes(msg) {
    for (const [, p] of this.pendentes) {
      p.limparTimers();
      p.resolve(this._resultadoFatal(msg));
    }
    this.pendentes.clear();
    for (const [, p] of this.pendentesPacotes) p.reject(new Error(msg));
    this.pendentesPacotes.clear();
  }

  _resultadoTimeout(timeoutS) {
    return {
      status: "timeout",
      stdout: "",
      erro: {
        tipo: "Timeout",
        linha: null,
        mensagem_didatica: t("py.timeout.didatica", { s: timeoutS }),
        mensagem_original: t("py.timeout.original"),
      },
      testes: [],
    };
  }

  async garantirPacotes(pacotes) {
    const faltam = (pacotes || []).filter((p) => !this.pacotesCarregados.has(p));
    if (!faltam.length) return;
    const reqId = ++this.reqSeq;
    const promessa = new Promise((resolve, reject) => {
      // timeout finito: sem isto, um worker que morre no loadPackage deixaria a
      // promessa pendurada para sempre (soft-lock). 60s cobre numpy/pandas.
      const timer = setTimeout(() => {
        this.pendentesPacotes.delete(reqId);
        reject(new Error(t("py.pacotesTimeout")));
      }, 60000);
      this.pendentesPacotes.set(reqId, {
        resolve: () => { clearTimeout(timer); resolve(); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });
    });
    this.worker.postMessage({ type: "pacotes", reqId, pacotes: faltam });
    await promessa;
    faltam.forEach((p) => this.pacotesCarregados.add(p));
  }

  // Executa um payload; SEMPRE resolve (nunca rejeita) com um resultado canônico.
  executar(payload) {
    if (this.fase !== "pronto") {
      return Promise.resolve(
        this._resultadoFatal(t("py.naoPronto"))
      );
    }
    const reqId = ++this.reqSeq;
    // o idioma do runner acompanha a interface (quem chama pode fixar outro)
    if (!payload.lang) payload = { ...payload, lang: idioma() };
    const timeoutMs = (payload.timeout_s || 5) * 1000;
    return new Promise((resolve) => {
      let timerTimeout = null;
      let timerEscalada = null;
      const limparTimers = () => {
        if (timerTimeout) clearTimeout(timerTimeout);
        if (timerEscalada) clearTimeout(timerEscalada);
      };
      const estourar = () => {
        const pendente = this.pendentes.get(reqId);
        if (!pendente) return;
        this.pendentes.delete(reqId);
        limparTimers();
        pendente.resolve(this._resultadoTimeout(payload.timeout_s || 5));
        this._respawn();
      };
      timerTimeout = setTimeout(() => {
        if (this.interrupt) {
          this.interrupt[0] = 2; // SIGINT -> KeyboardInterrupt no código do aluno
          timerEscalada = setTimeout(estourar, ESCALADA_MS);
        } else {
          estourar(); // sem SAB: caminho degradado direto
        }
      }, timeoutMs);
      this.pendentes.set(reqId, { resolve, limparTimers });
      this.worker.postMessage({ type: "executar", reqId, payload });
    });
  }

  _respawn() {
    // toda espera de pacote pendente morre com o worker — nunca deixar pendurado
    for (const [, p] of this.pendentesPacotes) p.reject(new Error(t("py.reiniciado")));
    this.pendentesPacotes.clear();
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pacotesCarregados.clear();
    this._setFase("reiniciando");
    this.iniciar();
  }
}
