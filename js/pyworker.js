// Web Worker do Python AI Dojo — carrega o Pyodide, injeta runner + mocks e
// executa o código do aluno. NUNCA roda Python na main thread.
// Pin: Pyodide v0.27.7 (CPython 3.12.7) — paridade com tools/verify.py.

const CDN = "https://cdn.jsdelivr.net/pyodide/v0.27.7/full/";

let pyodide = null;
let pronto = false;
let lang = "pt"; // idioma da interface (vem no init e em cada payload)

// worker não enxerga o import map do jogo: os poucos textos dele ficam aqui
const TEXTOS = {
  pt: {
    baixarFalhou: "não consegui baixar ",
    timeout: "Seu código passou do tempo limite — quase sempre é um loop que nunca termina.",
    timeoutOriginal: "KeyboardInterrupt (interrompido pelo Dojo)",
    antesDoInit: "executar antes do init terminar",
  },
  en: {
    baixarFalhou: "couldn't download ",
    timeout: "Your code went over the time limit — it is almost always a loop that never ends.",
    timeoutOriginal: "KeyboardInterrupt (stopped by the Dojo)",
    antesDoInit: "run requested before init finished",
  },
};
const tx = (k) => (TEXTOS[lang] || TEXTOS.pt)[k];

function post(msg) {
  self.postMessage(msg);
}

async function init(interruptBuffer) {
  try {
    post({ type: "fase", fase: "baixando" });
    const { loadPyodide } = await import(CDN + "pyodide.mjs");
    post({ type: "fase", fase: "iniciando" });
    pyodide = await loadPyodide({ indexURL: CDN });
    if (interruptBuffer) {
      pyodide.setInterruptBuffer(new Uint8Array(interruptBuffer));
    }
    post({ type: "fase", fase: "preparando" });
    // versiona os fetches de py com o mesmo ?v= do worker: agora que o serve.py
    // deixa .py cacheável, o ?v= garante que um update de runner/mocks invalide o
    // cache (bump = URL nova). Sem o ?v= um runner velho poderia ser servido.
    const V = self.location.search; // ex.: "?v=21"
    const [runnerSrc, mocksSrc] = await Promise.all([
      fetch(new URL("../py/runner.py" + V, self.location.href)).then((r) => {
        if (!r.ok) throw new Error(tx("baixarFalhou") + "py/runner.py");
        return r.text();
      }),
      fetch(new URL("../py/mocks_ia.py" + V, self.location.href)).then((r) => {
        if (!r.ok) throw new Error(tx("baixarFalhou") + "py/mocks_ia.py");
        return r.text();
      }),
    ]);
    pyodide.FS.writeFile("/home/pyodide/runner.py", runnerSrc);
    pyodide.FS.writeFile("/home/pyodide/mocks_ia.py", mocksSrc);
    // pré-compila o entry point
    pyodide.runPython('import sys\nsys.path.insert(0, "/home/pyodide")\nimport runner');
    pronto = true;
    post({ type: "fase", fase: "pronto" });
  } catch (e) {
    post({ type: "erro-fatal", msg: String(e && e.message ? e.message : e) });
  }
}

async function carregarPacotes(reqId, pacotes) {
  try {
    await pyodide.loadPackage(pacotes, {
      messageCallback: (m) => post({ type: "pkg-progresso", msg: String(m) }),
    });
    post({ type: "pacotes-ok", reqId });
  } catch (e) {
    post({ type: "pacotes-erro", reqId, msg: String(e && e.message ? e.message : e) });
  }
}

function executar(reqId, payload) {
  if (!pronto) {
    post({ type: "erro-fatal", msg: tx("antesDoInit") });
    return;
  }
  if (payload && (payload.lang === "pt" || payload.lang === "en")) lang = payload.lang;
  try {
    pyodide.globals.set("PAYLOAD_JSON", JSON.stringify(payload));
    const json = pyodide.runPython("runner.executar_json(PAYLOAD_JSON)");
    post({ type: "resultado", reqId, json });
  } catch (e) {
    const texto = String(e && e.message ? e.message : e);
    if (texto.includes("KeyboardInterrupt")) {
      // SIGINT pegou o código fora do try do runner — resultado de timeout honesto
      post({
        type: "resultado",
        reqId,
        json: JSON.stringify({
          status: "timeout",
          stdout: "",
          erro: {
            tipo: "Timeout",
            linha: null,
            mensagem_didatica: tx("timeout"),
            mensagem_original: tx("timeoutOriginal"),
          },
          testes: [],
        }),
      });
    } else {
      post({ type: "erro-fatal", msg: texto });
    }
  }
}

self.onmessage = (ev) => {
  const msg = ev.data || {};
  if (msg.type === "init") {
    if (msg.lang === "pt" || msg.lang === "en") lang = msg.lang;
    init(msg.interruptBuffer || null);
  } else if (msg.type === "pacotes") {
    carregarPacotes(msg.reqId, msg.pacotes);
  } else if (msg.type === "executar") {
    executar(msg.reqId, msg.payload);
  }
};
