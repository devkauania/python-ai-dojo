// Bootstrap, roteamento hash-based e cola geral do Python AI Dojo.

import * as storage from "./storage.js";
import { carregarConteudo, exerciciosDe } from "./content.js";
import * as engine from "./engine.js";
import { PyBridge } from "./pybridge.js";
import * as ui from "./ui.js";
import * as juice from "./juice.js";
import * as webrunner from "./webrunner.js";
import * as mundo from "./mundo.js";
import { iniciarCursor, atualizarCursor } from "./cursor.js";
import { iniciarTeclado, alternarTeclado, acoplarTeclado } from "./teclado.js";

const A = {
  save: null,
  conteudo: null,
  bridge: null,
  corrompido: false,
  brutoCorrompido: null,
  rodando: false,
  vivo: false, // já passou da tela de boas-vindas?
  tela: { nome: "boasvindas" },
  sessao: novaSessao(),
  atoTab: null, // tab de Ato ativa na taskbar (Dojo OS); null = seguir o progresso
  labTab: null, // tab de trilha do Laboratório; null = seguir o progresso
  billyFala: null, // microfala pendente do Billy (sobrevive à troca de exercício)
};

// ---------------------------------------------------------------------------
// microfalas do Billy — ele NÃO dá aula (isso é do Cato): só apoia, uma linha.
// Nunca entrega a resposta; aponta para onde olhar. Sem emoji.
// ---------------------------------------------------------------------------
const FALAS_BILLY = {
  acerto: [
    "Passou. E saiu da sua cabeça — guarda esse jeito de resolver.",
    "Verde. Repara que você leu o teste antes de mexer no código; é isso mesmo.",
    "Funcionou. Bom trabalho.",
    "É isso. Cada um desses vai te custar menos tempo que o anterior.",
  ],
  falha3: [
    "Erro é informação. Compara o esperado com o obtido — a diferença conta a história.",
    "Três tentativas é normal. Volta no enunciado antes de mudar mais uma linha.",
    "Calma, tá perto. Lê a primeira linha vermelha devagar, comigo.",
  ],
  dica: [
    "Pedir dica é estratégia, não desistência.",
    "A dica aponta o caminho; o passo continua sendo seu.",
    "Lê a dica e volta pro teu código antes de mudar qualquer coisa.",
  ],
  pular: [
    "Tudo bem pular. Ela volta na revisão e aí você pega.",
    "Deixa essa descansar — a gente volta nela.",
  ],
};
let billyVez = 0;

// só ENFILEIRA a fala; quem pinta é pintarBilly() — depois do render, quando a
// ação redesenha a tela (dica, pular), ou na hora, quando não redesenha (rodar).
function falarBilly(chave) {
  const linhas = FALAS_BILLY[chave];
  if (!linhas) return;
  A.billyFala = linhas[billyVez++ % linhas.length];
}

function pintarBilly() {
  const el = document.getElementById("billy-fala");
  if (!el) return;
  if (!A.billyFala) {
    el.classList.add("oculto");
    el.textContent = "";
    return;
  }
  el.textContent = A.billyFala;
  el.classList.remove("oculto");
  A.billyFala = null; // consumida: não persegue o aluno pelas telas seguintes
}

function novaSessao() {
  return {
    exAtual: null,
    dicaRevelada: 0,
    viuSolucao: false,
    falhasSeguidas: 0,
    resolvidoNaSessao: false,
    emRevisao: null, // {fila:[ids], idx, retorno}
    modoLivre: false,
    modoDan: false,
    danFeitos: [],
    fechamentos: [], // fila de telas pós-resolução
    tierFechamento: null,
  };
}

const root = () => document.getElementById("app");
const salvar = () => storage.salvar(A.save);

// ---------------------------------------------------------------------------
// boot
// ---------------------------------------------------------------------------
async function boot() {
  aplicarTema("auto");
  const { save, corrompido, bruto, novo } = storage.carregar();
  if (corrompido) {
    A.corrompido = true;
    A.brutoCorrompido = bruto;
    root().innerHTML = ui.telaCorrompido();
    document.getElementById("btn-reset-corrompido").onclick = () => {
      storage.resetar();
      location.reload();
    };
    document.getElementById("input-import-corrompido").onchange = async (e) => {
      try {
        await storage.importar(e.target.files[0]);
        location.reload();
      } catch (err) {
        alert("Não deu para importar: " + err.message);
      }
    };
    return;
  }
  A.save = save;
  aplicarTema(save.config.tema);
  aplicarMovimento(save.config);
  juice.configurarJuice(save.config);
  if (!window.gsap) document.documentElement.classList.add("sem-gsap");
  mundo.iniciarSuavidade(); // Lenis + GSAP ticker (a suavidade do site)
  iniciarCursor();          // cursor pixel do Dojo OS
  iniciarTeclado();         // teclado virtual (keycaps do pacote do dono)
  if (A.save.config.teclado !== false) alternarTeclado(true); // ligado por padrão
  // Som de clique global (uma fonte só — sem duplicar nos handlers).
  // data-som-proprio: botões que já tocam o próprio som (Começar, Testar
  // estímulos) ficam de fora, senão sobrepõem dois sons. Ativação por TECLADO
  // também fica de fora: o keydown já tocou "tecla" (detail === 0 num
  // MouseEvent = clique sintético de Enter/Espaço).
  document.addEventListener("click", (e) => {
    if (e.detail === 0) return;
    const b = e.target.closest("button, a, summary, [role=button]");
    if (!b || b.disabled) return;
    if (b.closest("#teclado-virtual") || b.hasAttribute("data-som-proprio")) return;
    juice.tocar("clique");
  }, true);
  try {
    A.conteudo = await carregarConteudo();
  } catch (e) {
    root().innerHTML = ui.telaErroFatal("conteúdo: " + e.message);
    return;
  }
  A.bridge = new PyBridge({
    aoMudarFase: (fase, msg) => aoMudarFasePython(fase, msg),
    aoProgressoPacote: (m) => setPkgStatus(traduzirProgresso(m)),
  });
  A.bridge.iniciar(); // começa a baixar o Python já em paralelo

  const node = A.conteudo.trilhaPorSlug.get(save.run_atual.nivel_atual);
  const recap = !novo && node ? `Último conceito: ${node.titulo}.` : "";
  root().innerHTML = ui.telaBoasVindas(novo, recap);
  animarBoasVindas();
  document.getElementById("btn-comecar").onclick = (ev) => {
    A.vivo = true;
    juice.acordarAudio(); // primeiro gesto do usuário: libera o áudio
    juice.tocar("inicio"); // prova imediata de que o som funciona
    juice.estourarEm(ev.currentTarget, 1.2);
    // A HOME/trilha é instantânea e NÃO precisa de Python. O Pyodide carrega em
    // background; se falhar, o erro só aparece ao tentar RODAR um exercício
    // Python (o Laboratório Web funciona sem Pyodide).
    irParaTrilha();
  };
  window.addEventListener("hashchange", aoMudarHash);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) {
      const btn = document.getElementById("btn-proximo");
      const el = document.activeElement;
      const interativo = el && (el === btn
        || ["BUTTON", "A", "SUMMARY", "INPUT", "SELECT", "TEXTAREA", "DETAILS"].includes(el.tagName)
        || el.id === "editor" || el.isContentEditable
        || (el.classList && el.classList.contains("glos")));
      // só avança com Enter quando o foco NÃO está num elemento interativo E
      // não há modal aberto (senão o jogo avançava POR BAIXO do modal de
      // configurações/solução, que continuava flutuando sobre a tela nova)
      const modalAberto = !!document.getElementById("modal-raiz");
      if (btn && !btn.classList.contains("oculto") && !interativo && !modalAberto) {
        e.preventDefault();
        btn.click();
      }
    }
  });
}

function aoMudarFasePython(fase, msg) {
  // A HOME/trilha não espera o Python (ele carrega em background), então não há
  // tela "carregando": o boot vai direto para boas-vindas. Aqui só reagimos na
  // tela de exercício PYTHON: habilita/desabilita o Rodar. Erro fatal do Pyodide
  // precisa ficar VISÍVEL aqui (antes ficava preso em "Preparando…" p/ sempre).
  // O Lab Web usa o MESMO id #btn-rodar mas NÃO depende de Pyodide — mexer nele
  // deixava "Rodar testes" cinza (e travado p/ sempre no caso 'erro').
  if (A.tela.nome !== "exercicio") return;
  const btn = document.getElementById("btn-rodar");
  if (btn) {
    btn.disabled = fase !== "pronto";
    if (fase === "erro") {
      setPkgStatus("O ambiente Python não carregou" + (msg ? ` (${msg})` : "") + " — recarregue a página.");
    } else {
      setPkgStatus(fase === "pronto" ? "" : fase === "reiniciando"
        ? "Reiniciando o ambiente Python…" : "Preparando o Python…");
    }
  }
}

function setPkgStatus(texto) {
  const el = document.getElementById("pkg-status");
  if (el) el.textContent = texto || "";
}

// O messageCallback do Pyodide é em inglês ("Loading pandas, ...") — traduz
// para PT-BR antes de exibir (nenhum texto de UI em inglês).
function traduzirProgresso(msg) {
  const s = String(msg || "");
  const m = s.match(/^(Loading|Loaded)\s+(.+)$/i);
  if (!m) return s;
  const pacotes = m[2].replace(/,\s*/g, ", ");
  return /^Loading/i.test(m[1])
    ? `Baixando ${pacotes}… (só na primeira vez)`
    : `Pronto: ${pacotes}`;
}

function aplicarMovimento(config) {
  if (config && config.reduzir === true) document.documentElement.setAttribute("data-reduz", "1");
  else document.documentElement.removeAttribute("data-reduz");
  mundo.atualizarSuavidade(); // liga/desliga o Lenis conforme a config
  atualizarCursor();          // reduzir animações devolve o cursor nativo
}

// entrada da tela de boas-vindas: cubos caem, headline sobe palavra a palavra
// com máscara (a assinatura do site), sub e CTA aparecem.
function animarBoasVindas() {
  const gsap = window.gsap;
  const reduz = document.documentElement.getAttribute("data-reduz") === "1";
  if (!gsap || reduz) {
    document.querySelectorAll(".palavra-inner").forEach((el) => (el.style.transform = "none"));
    document.querySelectorAll(".bv-sub, .bv-cta").forEach((el) => (el.style.opacity = "1"));
    return;
  }
  const tl = gsap.timeline({ delay: 0.15 });
  tl.from(".bv-cubos > span", { y: -70, opacity: 0, duration: 0.6, stagger: 0.12, ease: "back.out(1.6)" })
    .to(".palavra-inner", { y: 0, duration: 0.7, stagger: 0.06, ease: "power3.out" }, "-=0.25")
    .to(".bv-sub", { opacity: 1, duration: 0.6, ease: "power2.out" }, "-=0.35")
    .to(".bv-cta", { opacity: 1, duration: 0.6, ease: "power2.out" }, "-=0.4");
}

let _mqEscuro = null;
function aplicarTema(tema) {
  const pref = tema || "auto";
  document.documentElement.dataset.tema = pref;
  const escuro =
    pref === "escuro" ||
    (pref === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  if (escuro) document.documentElement.setAttribute("data-escuro", "1");
  else document.documentElement.removeAttribute("data-escuro");
  // no modo auto, reage a mudanças do sistema
  if (!_mqEscuro) {
    _mqEscuro = window.matchMedia("(prefers-color-scheme: dark)");
    _mqEscuro.addEventListener?.("change", () => {
      if ((A.save?.config?.tema || "auto") === "auto") aplicarTema("auto");
    });
  }
}

// ---------------------------------------------------------------------------
// roteamento
// ---------------------------------------------------------------------------
function aoMudarHash() {
  if (!A.vivo) return;
  const h = location.hash || "#/mapa";
  if (h.startsWith("#/ex/")) {
    const id = h.slice(5);
    const ex = A.conteudo.porId.get(id);
    if (ex) abrirExercicio(ex, {});
    else navegar("#/mapa");
  } else if (h === "#/livre") {
    A.tela = { nome: "livre" };
    render();
  } else if (h === "#/dan") {
    A.tela = { nome: "dan" };
    render();
  } else if (h === "#/preta") {
    A.tela = { nome: "preta" };
    render();
  } else if (h === "#/progresso") {
    A.tela = { nome: "progresso" };
    render();
  } else if (h === "#/web") {
    A.labTab = null; // ao entrar no lab, a trilha acompanha o progresso
    A.tela = { nome: "laboratorio" };
    render();
  } else if (h.startsWith("#/webex/")) {
    const ex = A.conteudo.porId.get(h.slice(8));
    if (ex) abrirExercicioWeb(ex);
    else navegar("#/web");
  } else {
    // ao ENTRAR na área de trabalho, a tab de Ato re-sincroniza com o
    // progresso (senão ela ficava presa no ato antigo depois de virar de ato,
    // mostrando um desktop só de níveis concluídos/bloqueados). Trocar de tab
    // manualmente continua mandando enquanto o usuário está no mapa.
    A.atoTab = null;
    A.tela = { nome: "mapa" };
    render();
  }
}

function navegar(hash) {
  if (location.hash === hash) aoMudarHash();
  else location.hash = hash;
}

// "Começar"/"Continuar" abrem a HOME: a trilha, onde o usuário vê o mapa e
// decide o próximo passo (o hero tem o botão "Continuar ›" para o exercício).
function irParaTrilha() {
  A.sessao = novaSessao();
  navegar("#/mapa");
}

function irParaProximo() {
  const ex = engine.proximoExercicio(A.save, A.conteudo);
  if (ex) {
    A.sessao = novaSessao();
    A.sessao.exAtual = ex;
    navegar("#/ex/" + ex.id);
  } else {
    navegar("#/mapa");
  }
}

// ---------------------------------------------------------------------------
// render central
// ---------------------------------------------------------------------------
// ato "natural" = o do primeiro nível ainda incompleto (segue o progresso)
function atoDoProgresso() {
  const tier = A.save.run_atual.tier;
  for (const n of A.conteudo.trilha) {
    if (!engine.nivelCompleto(A.save, A.conteudo, n.slug, tier)) return n.atoIdx;
  }
  return A.conteudo.manifest.atos.length - 1;
}

// Cenário de fundo por tela: cada ato e o laboratório podem ter a sua arte
// (assets/cena-ato1..4.png, assets/cena-lab.png). Se o arquivo não existir, a
// imagem falha ao carregar e o CSS mantém o papel de parede padrão — por isso
// pré-carregamos antes de trocar a variável.
function aplicarCena(nomeTela) {
  let arquivo = null;
  if (nomeTela === "laboratorio") arquivo = "cena-lab";
  else if (nomeTela === "mapa" && A.atoTab != null) arquivo = `cena-ato${A.atoTab + 1}`;
  else if ((nomeTela === "exercicio" || nomeTela === "fimNivel" || nomeTela === "fimAto")
    && A.sessao.exAtual) {
    const node = A.conteudo.trilhaPorSlug.get(A.sessao.exAtual.nivel);
    if (node) arquivo = `cena-ato${node.atoIdx + 1}`;
  }
  // caminho ABSOLUTO: uma url() dentro de custom property é resolvida contra o
  // arquivo CSS (viraria /css/assets/…), não contra o documento.
  const nome = arquivo && ui.CENAS.has(arquivo) ? arquivo : "wallpaper";
  document.documentElement.style.setProperty("--cena", `url("/assets/${nome}.png${ui.V}")`);
}

// trilha do lab que contém o próximo exercício não resolvido
function trilhaDoProgresso() {
  const trilhas = [...A.conteudo.webPorNivel.values()];
  for (let i = 0; i < trilhas.length; i++) {
    if (trilhas[i].some((ex) => !A.save.historico[ex.id]?.resolvido)) return i;
  }
  return 0;
}

// render({ manterScroll: true }) preserva a posição de rolagem do tubo — usado
// quando a tela é re-renderizada NO LUGAR (revelar dica), para a tela não
// teleportar ao topo e esconder justamente a dica recém-revelada.
function render(opts = {}) {
  mundo.destruirMundo(); // mata pin/ScrollTriggers/tweens da tela anterior
  const tuboAntes = document.getElementById("tv-scroll");
  const scrollAntes = opts.manterScroll && tuboAntes ? tuboAntes.scrollTop : 0;
  const nome = A.tela.nome;
  let corpo = "";
  if (nome === "mapa" && A.atoTab == null) A.atoTab = atoDoProgresso();
  if (nome === "laboratorio" && A.labTab == null) A.labTab = trilhaDoProgresso();
  if (nome === "mapa") corpo = ui.telaMapa(A);
  else if (nome === "exercicio") corpo = ui.telaExercicio(A);
  else if (nome === "exercicioWeb") corpo = ui.telaExercicioWeb(A);
  else if (nome === "laboratorio") corpo = ui.telaLaboratorio(A);
  else if (nome === "progresso") corpo = ui.telaProgresso(A);
  else if (nome === "fimNivel") corpo = ui.telaFimNivel(A, A.tela.slug, A.tela.revisoes);
  else if (nome === "fimAto") corpo = ui.telaFimAto(A, A.tela.atoId);
  else if (nome === "fimRun") corpo = ui.telaFimRun(A);
  else if (nome === "preta") corpo = ui.telaFaixaPreta(A);
  else if (nome === "livre") corpo = ui.telaLivre(A);
  else if (nome === "dan") corpo = ui.telaDan(A);
  root().innerHTML = ui.header(A) + `<main class="main main-${nome}">${corpo}</main>`;
  const tubo = document.getElementById("tv-scroll");
  if (scrollAntes) {
    if (tubo) tubo.scrollTop = scrollAntes;
  } else {
    mundo.rolarPara(0, { imediato: true });
    if (tubo) tubo.scrollTop = 0;
  }
  ligarHeader();
  if (nome === "mapa") ligarMapa();
  else if (nome === "exercicio") ligarExercicio();
  else if (nome === "exercicioWeb") ligarExercicioWeb();
  else if (nome === "laboratorio") ligarLaboratorio();
  else if (nome === "progresso") { const b = document.getElementById("btn-config"); if (b) b.onclick = abrirConfig; }
  else if (nome === "fimNivel") ligarFimNivel();
  else if (nome === "fimAto") ligarFimAto();
  else if (nome === "fimRun") ligarFimRun();
  else if (nome === "preta") ligarPreta();
  else if (nome === "livre") ligarLivre();
  else if (nome === "dan") ligarDan();
  ui.ligarGlossario();  // flip dos balões de glossário perto das bordas
  // teclado virtual: nos exercícios ele ACOPLA no slot logo abaixo da caixa
  // de código; nas demais telas volta a flutuar. Sempre via referência do
  // módulo — o innerHTML acima DESTRÓI o nó se ele estava dentro do #app.
  acoplarTeclado(document.getElementById("vk-slot"));
  aplicarCena(nome);    // cenário da tela (por ato / lab), com fallback
  mundo.revelarTela();  // reveals com stagger (elementos .reveal da tela)
}

function atualizarHeader() {
  const hdr = document.querySelector("header.hdr");
  if (hdr) {
    hdr.outerHTML = ui.header(A);
    ligarHeader();
  }
}

function ligarHeader() {
  const btn = document.getElementById("btn-config");
  if (btn) btn.onclick = abrirConfig;
  // tabs de Ato na taskbar (só existem na área de trabalho)
  document.querySelectorAll("[data-ato-tab]").forEach((el) => {
    el.onclick = () => {
      A.atoTab = Number(el.dataset.atoTab);
      render();
    };
  });
  document.querySelectorAll("[data-lab-tab]").forEach((el) => {
    el.onclick = () => {
      A.labTab = Number(el.dataset.labTab);
      render();
    };
  });
  const tec = document.getElementById("btn-teclado");
  if (tec) {
    tec.onclick = () => {
      const aberto = alternarTeclado();
      tec.classList.toggle("ativo", aberto);
      A.save.config.teclado = aberto;
      salvar();
    };
  }
}

// relógio da taskbar: HH:MM real com dois-pontos piscando (steps)
function textoRelogio() {
  const h = new Date().toTimeString().slice(0, 5);
  return `${h.slice(0, 2)}<i class="pisca">:</i>${h.slice(3)}`;
}
setInterval(() => {
  const el = document.getElementById("tb-relogio");
  if (el) el.innerHTML = textoRelogio();
}, 20000);

// ---------------------------------------------------------------------------
// mapa
// ---------------------------------------------------------------------------
function ligarMapa() {
  const btnCont = document.getElementById("btn-continuar");
  if (btnCont) btnCont.onclick = irParaProximo;
  document.querySelectorAll(".no[data-slug]").forEach((el) => {
    el.onclick = () => {
      juice.estourarEm(el.querySelector(".no-icone") || el, 0.5);
      abrirNivel(el.dataset.slug);
    };
  });
  const prog = document.getElementById("btn-progresso");
  if (prog) prog.onclick = () => navegar("#/progresso");
  const lab = document.getElementById("btn-laboratorio");
  if (lab) lab.onclick = () => navegar("#/web");
  const dan = document.getElementById("btn-modo-dan");
  if (dan) dan.onclick = () => navegar("#/dan");
  const livre = document.getElementById("btn-modo-livre");
  if (livre) livre.onclick = () => navegar("#/livre");
  const cert = document.getElementById("btn-certificado");
  if (cert) cert.onclick = () => ui.abrirCertificado(A);
  // Dojo OS (r6): o mapa é uma área de trabalho estática — sem mundo pinado.
}

function abrirNivel(slug) {
  const tier = A.save.run_atual.tier;
  const exs = exerciciosDe(A.conteudo, slug, tier);
  const pendente = exs.find((e) => !A.save.historico[e.id]?.resolvido);
  if (pendente) { abrirExercicio(pendente, {}); }
  else if (exs.length) {
    // nível já concluído: rejogar volta à TRILHA, não ao catálogo do Modo Livre
    abrirExercicio(exs[0], { modoLivre: true });
    A.sessao.retornoHash = "#/mapa";
  }
}

// ---------------------------------------------------------------------------
// exercício
// ---------------------------------------------------------------------------
function abrirExercicio(ex, { modoLivre = false, modoDan = false, revisao = null }) {
  const manterRevisao = revisao || null;
  const manterDanFeitos = modoDan ? A.sessao.danFeitos : [];
  A.sessao = novaSessao();
  A.sessao.exAtual = ex;
  A.sessao.abertoEm = Date.now();
  A.sessao.modoLivre = modoLivre || (!revisao && !!A.save.historico[ex.id]?.resolvido);
  A.sessao.modoDan = modoDan;
  A.sessao.danFeitos = manterDanFeitos;
  A.sessao.emRevisao = manterRevisao;
  A.save.run_atual.exercicio_atual = ex.id;
  if (!A.sessao.modoLivre && !modoDan && !manterRevisao) {
    A.save.run_atual.nivel_atual = ex.nivel;
  }
  salvar();
  A.tela = { nome: "exercicio" };
  if (location.hash !== "#/ex/" + ex.id) {
    // pushState (não replaceState): muda a URL SEM re-entrar pelo hashchange,
    // mas EMPILHA no histórico — com replaceState a entrada do mapa era
    // sobrescrita e o "Voltar" do navegador não saía do exercício.
    history.pushState(null, "", "#/ex/" + ex.id);
  }
  render();
  // pacotes lazy já podem começar a baixar
  if (ex.pacotes?.length && A.bridge.fase === "pronto") {
    setPkgStatus(`Baixando ${ex.pacotes.join(", ")}…`);
    A.bridge.garantirPacotes(ex.pacotes).then(() => setPkgStatus("")).catch(() => {});
  }
}

function ligarExercicio() {
  const ex = A.sessao.exAtual;
  const editor = document.getElementById("editor");
  const gutter = document.getElementById("editor-gutter");
  ui.ligarEditor(editor, gutter, aoRodar);
  // autosave: antes o código só era salvo ao Rodar, então um F5 no meio da
  // digitação jogava fora tudo desde a última execução.
  let tSalvar = null;
  editor.addEventListener("input", () => {
    if (tSalvar) clearTimeout(tSalvar);
    tSalvar = setTimeout(() => {
      engine.registrarCodigo(A.save, ex.id, editor.value);
      salvar();
    }, 800);
  });
  document.getElementById("btn-rodar").onclick = aoRodar;
  document.getElementById("btn-rodar").disabled = A.bridge.fase !== "pronto";
  // se o Pyodide JÁ falhou antes desta tela existir, nenhum evento de fase vem
  // mais: mostra o erro agora em vez de "Preparando…" eterno.
  if (A.bridge.fase === "erro") {
    setPkgStatus("O ambiente Python não carregou — recarregue a página (o Lab Web funciona sem ele).");
  } else if (A.bridge.fase !== "pronto") {
    setPkgStatus("Preparando o Python…");
  }
  document.getElementById("btn-restaurar").onclick = () => {
    editor.value = ex.starter_code;
    editor.dispatchEvent(new Event("input"));
  };
  document.getElementById("btn-proximo").onclick = aoProximo;
  for (let i = 1; i <= 3; i++) {
    const b = document.getElementById("btn-dica-" + i);
    if (b) b.onclick = () => revelarDica(i);
  }
  document.getElementById("btn-solucao").onclick = pedirSolucao;
  document.getElementById("btn-pular").onclick = aoPular;
  document.querySelectorAll(".side-nivel").forEach((el) => {
    el.onclick = () => abrirNivel(el.dataset.slug);
  });
  pintarBilly();
  editor.focus();
}

async function aoRodar() {
  if (A.rodando || A.bridge.fase !== "pronto") return;
  juice.acordarAudio(); // dentro do gesto do usuário (política de autoplay)
  const ex = A.sessao.exAtual;
  const editor = document.getElementById("editor");
  const codigo = editor.value;
  A.rodando = true;
  const btn = document.getElementById("btn-rodar");
  const spinnerTimer = setTimeout(() => btn.classList.add("rodando"), 400);
  engine.registrarTentativa(A.save, ex.id, codigo);
  salvar();
  try {
    if (ex.pacotes?.length) {
      setPkgStatus(`Baixando ${ex.pacotes.join(", ")}…`);
      await A.bridge.garantirPacotes(ex.pacotes);
      setPkgStatus("");
    }
    const resultado = await A.bridge.executar({
      codigo,
      testes_visiveis: ex.testes_visiveis,
      testes_ocultos: ex.testes_ocultos,
      mocks: ex.mocks || [],
      arquivos: ex.arquivos || {},
      timeout_s: ex.timeout_s || (ex.pacotes?.length ? 15 : 5),
    });
    tratarResultado(resultado, codigo);
  } catch (e) {
    // falha ao preparar pacotes (offline/CDN) — nunca engolir em silêncio
    setPkgStatus("");
    const msg = e && e.message ? e.message : String(e);
    tratarResultado(A.bridge._resultadoFatal("não consegui preparar o ambiente: " + msg), codigo);
  } finally {
    clearTimeout(spinnerTimer);
    btn.classList.remove("rodando");
    A.rodando = false;
  }
}

function tratarResultado(resultado, codigo) {
  const ex = A.sessao.exAtual;
  const painel = document.getElementById("resultados");
  let xpGanho = 0;
  let estrelasNovas = [];
  let houveOk = false;

  if (resultado.status === "ok" && !A.sessao.resolvidoNaSessao) {
    A.sessao.resolvidoNaSessao = true;
    houveOk = true;
    const opts = {
      dicaMax: A.sessao.dicaRevelada,
      viuSolucao: A.sessao.viuSolucao,
    };
    if (A.sessao.emRevisao) {
      const evRev = engine.resolverExercicio(A.save, A.conteudo, ex, { ...opts, emRevisao: true });
      estrelasNovas = evRev.estrelasNovas || [];
      const sucesso = A.sessao.dicaRevelada === 0 && !A.sessao.viuSolucao
        && A.sessao.falhasSeguidas < 3;
      const evR = engine.resolverRevisaoItem(A.save, A.conteudo, ex, {
        sucesso, dicaMax: A.sessao.dicaRevelada, viuSolucao: A.sessao.viuSolucao,
      });
      xpGanho = evR.xpGanho;
    } else if (A.sessao.modoLivre || A.sessao.modoDan) {
      // rejogada: sem XP; primeira vez em modo livre ainda conta
      const ev = engine.resolverExercicio(A.save, A.conteudo, ex, opts);
      xpGanho = ev.xpGanho;
      estrelasNovas = ev.estrelasNovas || [];
      if (A.sessao.modoDan && !A.sessao.danFeitos.includes(ex.id)) {
        A.sessao.danFeitos.push(ex.id);
      }
    } else {
      const ev = engine.resolverExercicio(A.save, A.conteudo, ex, opts);
      xpGanho = ev.xpGanho;
      estrelasNovas = ev.estrelasNovas || [];
      enfileirarFechamentos(ev, ex);
      if (engine.faixa(A.save, A.conteudo) === "preta"
          && engine.boss5T3Vencido(A.save, A.conteudo) && ex.nivel === "boss5") {
        A.sessao.fechamentos.push({ nome: "preta" });
      }
    }
    engine.registrarCodigo(A.save, ex.id, codigo);
    salvar();
    atualizarHeader();
    const streakEl = document.getElementById("hdr-streak");
    if (streakEl) {
      streakEl.classList.add("pulso");
      setTimeout(() => streakEl.classList.remove("pulso"), 300);
    }
    const btnProx = document.getElementById("btn-proximo");
    btnProx.classList.remove("oculto");
    btnProx.focus();
    falarBilly("acerto");
    pintarBilly();
  } else if (resultado.status === "falha_teste") {
    A.sessao.falhasSeguidas += 1;
    if (A.sessao.falhasSeguidas >= 3) {
      falarBilly("falha3");
      pintarBilly();
    }
    if (A.sessao.falhasSeguidas >= 3 && A.sessao.dicaRevelada < 1) {
      const b = document.getElementById("btn-dica-1");
      if (b) {
        b.classList.add("realce");
        setTimeout(() => b.classList.remove("realce"), 1200);
      }
    }
  } else if (resultado.status === "erro_sintaxe" && resultado.erro?.linha) {
    ui.irParaLinha(document.getElementById("editor"), resultado.erro.linha);
  }

  painel.innerHTML = ui.painelResultado(resultado, ex, xpGanho);

  // ---- juice + best-time ----
  if (houveOk) {
    const tempo = registrarTempoSolve(ex);
    juice.tocar(tempo && tempo.novoRecorde ? "recorde" : "sucesso");
    const check = painel.querySelector(".check-svg") || document.getElementById("btn-rodar");
    juice.estourarEm(check, tempo && tempo.novoRecorde ? 1.4 : 1);
    mostrarTempo(painel, tempo);
    if (tempo && tempo.novoRecorde && tempo.anterior != null) mostrarToastRecorde(tempo);
    if (estrelasNovas.length) {
      setTimeout(() => {
        juice.tocar("estrela");
        juice.estourarEm(document.getElementById("hdr-xp"), 0.6);
      }, 320);
    }
  } else if (resultado.status === "erro_sintaxe" || resultado.status === "erro_execucao") {
    juice.tocar("erro");
  }
}

// mede e grava o tempo de resolução; devolve {novoRecorde, anterior, atual}
function registrarTempoSolve(ex) {
  if (!A.sessao.abertoEm) return null;
  const ms = Date.now() - A.sessao.abertoEm;
  if (ms < 400 || ms > 30 * 60 * 1000) return null; // ignora ruído absurdo
  const info = engine.registrarTempo(A.save, ex.id, ms);
  const hoje = new Date().toISOString().slice(0, 10);
  engine.marcarDiaPraticado(A.save, hoje);
  salvar();
  return info;
}

function mostrarTempo(painel, tempo) {
  if (!tempo) return;
  const h = A.save.historico[A.sessao.exAtual.id];
  const tempos = (h && h.tempos) || [];
  const barras = tempos.slice(-6).map((t) => {
    const max = Math.max(...tempos.map((x) => x.t), 1);
    const alt = Math.max(4, Math.round((t.t / max) * 26));
    const best = t.t === h.pb_tempo;
    return `<i style="height:${alt}px" class="${best ? "best" : ""}"></i>`;
  }).join("");
  let comp = "";
  if (tempo.anterior != null) {
    const d = tempo.anterior - tempo.atual;
    comp = d > 0
      ? `<span class="tempo-melhora">▼ ${ui.fmtTempo(d)} mais rápido que seu recorde!</span>`
      : `<span class="tempo-comp">recorde: ${ui.fmtTempo(h.pb_tempo)}</span>`;
  } else {
    comp = `<span class="tempo-comp">seu primeiro tempo aqui</span>`;
  }
  const div = document.createElement("div");
  div.className = "tempo-caixa";
  div.innerHTML = `<span class="tempo-num">${ui.fmtTempo(tempo.atual)}</span> ${comp}
    ${barras ? `<span class="spark">${barras}</span>` : ""}`;
  painel.appendChild(div);
}

function mostrarToastRecorde(tempo) {
  const t = document.createElement("div");
  t.className = "toast-recorde";
  t.textContent = `Novo recorde! ${ui.fmtTempo(tempo.atual)}`;
  document.body.appendChild(t);
  if (window.gsap) {
    window.gsap.fromTo(t, { x: 40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.4, ease: "back.out(1.6)" });
    window.gsap.to(t, { x: 40, opacity: 0, delay: 2.4, duration: 0.4, onComplete: () => t.remove() });
  } else {
    setTimeout(() => t.remove(), 2800);
  }
}

function revelarDica(n) {
  A.sessao.dicaRevelada = Math.max(A.sessao.dicaRevelada, n);
  falarBilly("dica"); // pintada pelo render logo abaixo
  // re-renderiza só a área de dicas mantendo o resto da tela
  const area = document.getElementById("dicas-area");
  const painel = document.getElementById("resultados").innerHTML;
  const editorVal = document.getElementById("editor").value;
  render({ manterScroll: true }); // não teleporta p/ o topo: a dica está aqui embaixo
  document.getElementById("editor").value = editorVal;
  document.getElementById("editor").dispatchEvent(new Event("input"));
  document.getElementById("resultados").innerHTML = painel;
  if (A.sessao.resolvidoNaSessao) {
    document.getElementById("btn-proximo").classList.remove("oculto");
  }
}

function pedirSolucao() {
  const ex = A.sessao.exAtual;
  mostrarModal(ui.modalSolucao(ex), () => {
    document.getElementById("btn-modal-cancelar").onclick = fecharModal;
    document.getElementById("btn-modal-confirmar").onclick = () => {
      fecharModal();
      A.sessao.viuSolucao = true;
      if (!A.sessao.resolvidoNaSessao) {
        A.sessao.resolvidoNaSessao = true;
        if (A.sessao.emRevisao) {
          engine.resolverRevisaoItem(A.save, A.conteudo, ex, {
            sucesso: false, dicaMax: A.sessao.dicaRevelada, viuSolucao: true,
          });
        } else {
          const ev = engine.resolverExercicio(A.save, A.conteudo, ex, {
            dicaMax: A.sessao.dicaRevelada, viuSolucao: true,
          });
          enfileirarFechamentos(ev, ex);
        }
        salvar();
        atualizarHeader();
      }
      mostrarModal(ui.modalSolucaoCorpo(ex), () => {
        document.getElementById("btn-modal-fechar").onclick = () => {
          fecharModal();
          const btnProx = document.getElementById("btn-proximo");
          if (btnProx) {
            btnProx.classList.remove("oculto");
            btnProx.focus();
          }
        };
      });
    };
  });
}

function aoPular() {
  const ex = A.sessao.exAtual;
  falarBilly("pular"); // aparece já no próximo exercício
  if (A.sessao.emRevisao) {
    engine.resolverRevisaoItem(A.save, A.conteudo, ex, { sucesso: false });
    salvar();
    avancarRevisao();
    return;
  }
  const ev = engine.pularExercicio(A.save, A.conteudo, ex);
  enfileirarFechamentos(ev, ex);
  salvar();
  atualizarHeader();
  aoProximo();
}

function aoProximo() {
  if (A.sessao.emRevisao) {
    avancarRevisao();
    return;
  }
  if (A.sessao.modoDan) {
    if (A.sessao.danFeitos.length >= 3) {
      A.save.dan.vencidos += 1;
      A.sessao.danFeitos = [];
      salvar();
    }
    navegar("#/dan");
    return;
  }
  if (A.sessao.modoLivre) {
    navegar(A.sessao.retornoHash || "#/livre");
    return;
  }
  if (A.sessao.fechamentos.length) {
    const f = A.sessao.fechamentos.shift();
    mostrarFechamento(f);
    return;
  }
  irParaProximo();
}

// ---------------------------------------------------------------------------
// fechamentos e revisão
// ---------------------------------------------------------------------------
// enfileira as telas de fechamento (nível/ato/run) a partir do evento do engine
function enfileirarFechamentos(ev, ex) {
  A.sessao.tierFechamento = ex.tier;
  if (ev.fimNivel) A.sessao.fechamentos.push({ nome: "fimNivel", slug: ev.fimNivel });
  if (ev.fimAto) A.sessao.fechamentos.push({ nome: "fimAto", atoId: ev.fimAto });
  if (ev.fimRun) A.sessao.fechamentos.push({ nome: "fimRun" });
}

function mostrarFechamento(f) {
  if (f.nome === "fimNivel") {
    const node = A.conteudo.trilhaPorSlug.get(f.slug);
    const revisoes = engine.revisoesDevidas(A.save, A.conteudo, {
      tipo: "fim-nivel", pos: node.pos,
    });
    A.tela = { nome: "fimNivel", slug: f.slug, revisoes };
    juice.tocar("nivel");
  } else if (f.nome === "fimAto") {
    A.tela = { nome: "fimAto", atoId: f.atoId };
    juice.tocar("nivel");
    juice.celebrar();
  } else if (f.nome === "fimRun") {
    A.tela = { nome: "fimRun" };
    juice.tocar("recorde");
    juice.celebrar();
  } else if (f.nome === "preta") {
    A.tela = { nome: "preta" };
    juice.tocar("recorde");
    juice.celebrar();
  }
  render();
}

function ligarFimNivel() {
  mundo.cerimoniaCubos(document.getElementById("cer-cubos"),
    ["var(--verde)", "var(--laranja)", "var(--amarelo)"]);
  const revisoes = A.tela.revisoes || [];
  document.getElementById("btn-fim-continuar").onclick = aoProximo;
  const btnRev = document.getElementById("btn-fim-revisar");
  if (btnRev) {
    btnRev.onclick = () => iniciarRevisao(revisoes.map((r) => r.exercicio_id));
  }
  document.getElementById("btn-fim-parar").onclick = () => {
    document.getElementById("msg-parar").classList.remove("oculto");
  };
  const barra = document.getElementById("barra-fim");
  if (barra) requestAnimationFrame(() => (barra.style.width = "100%"));
}

function ligarFimAto() {
  mundo.cerimoniaCubos(document.getElementById("cer-cubos"),
    ["var(--amarelo)", "var(--verde)", "var(--laranja)", "var(--amarelo)"]);
  document.getElementById("btn-fim-ato").onclick = () => {
    const revisoes = engine.revisoesDevidas(A.save, A.conteudo, {
      tipo: "fim-ato",
      atoIdx: A.conteudo.manifest.atos.findIndex((a) => a.id === A.tela.atoId),
    });
    if (revisoes.length) iniciarRevisao(revisoes.map((r) => r.exercicio_id));
    else aoProximo();
  };
}

function ligarFimRun() {
  const btnRun = document.getElementById("btn-comecar-run");
  if (btnRun) {
    btnRun.onclick = () => {
      const novoTier = engine.tierDesbloqueado(A.save, A.conteudo);
      A.save.runs_completas = Math.max(A.save.runs_completas, A.save.run_atual.numero);
      A.save.run_atual = {
        numero: novoTier, tier: novoTier,
        nivel_atual: "variaveis", exercicio_atual: null,
      };
      salvar();
      const revisoes = engine.revisoesDevidas(A.save, A.conteudo, {
        tipo: "inicio-run", run: novoTier,
      });
      if (revisoes.length) iniciarRevisao(revisoes.map((r) => r.exercicio_id));
      else irParaProximo();
    };
  }
  document.getElementById("btn-run-mapa").onclick = () => {
    A.save.runs_completas = Math.max(A.save.runs_completas, A.save.run_atual.numero);
    const novoTier = engine.tierDesbloqueado(A.save, A.conteudo);
    if (novoTier > A.save.run_atual.tier) {
      A.save.run_atual = {
        numero: novoTier, tier: novoTier,
        nivel_atual: "variaveis", exercicio_atual: null,
      };
    }
    salvar();
    navegar("#/mapa");
  };
}

function ligarPreta() {
  document.getElementById("btn-certificado").onclick = () => ui.abrirCertificado(A);
  document.getElementById("btn-modo-dan").onclick = () => navegar("#/dan");
  document.getElementById("btn-modo-livre").onclick = () => navegar("#/livre");
  document.getElementById("btn-preta-mapa").onclick = () => navegar("#/mapa");
}

function iniciarRevisao(ids) {
  const fila = ids.filter((id) => A.conteudo.porId.has(id));
  if (!fila.length) {
    aoProximo();
    return;
  }
  const retorno = A.sessao.fechamentos.slice();
  const primeira = A.conteudo.porId.get(fila[0]);
  const item = A.save.revisao.find((r) => r.exercicio_id === fila[0]);
  abrirExercicio(primeira, {
    revisao: { fila, idx: 0, retorno, caixaAtual: item?.caixa },
  });
  A.sessao.fechamentos = retorno;
}

function avancarRevisao() {
  const rev = A.sessao.emRevisao;
  if (!rev) return;
  rev.idx += 1;
  if (rev.idx < rev.fila.length) {
    const ex = A.conteudo.porId.get(rev.fila[rev.idx]);
    const item = A.save.revisao.find((r) => r.exercicio_id === ex.id);
    const fechamentos = A.sessao.fechamentos;
    abrirExercicio(ex, {
      revisao: { ...rev, caixaAtual: item?.caixa },
    });
    A.sessao.fechamentos = fechamentos;
  } else {
    const fechamentos = A.sessao.fechamentos;
    A.sessao = novaSessao();
    A.sessao.fechamentos = fechamentos;
    aoProximo();
  }
}

// ---------------------------------------------------------------------------
// modo livre / dan
// ---------------------------------------------------------------------------
function ligarLivre() {
  document.querySelectorAll(".livre-ex[data-exid]").forEach((el) => {
    el.onclick = () => {
      const ex = A.conteudo.porId.get(el.dataset.exid);
      if (ex) abrirExercicio(ex, { modoLivre: true });
    };
  });
}

function ligarDan() {
  document.querySelectorAll(".nivel[data-exid]").forEach((el) => {
    el.onclick = () => {
      const ex = A.conteudo.porId.get(el.dataset.exid);
      if (ex) abrirExercicio(ex, { modoDan: true });
    };
  });
}

// ---------------------------------------------------------------------------
// Laboratório Web
// ---------------------------------------------------------------------------
function ligarLaboratorio() {
  document.querySelectorAll(".nivel[data-webid]").forEach((el) => {
    el.onclick = () => {
      const ex = A.conteudo.porId.get(el.dataset.webid);
      if (ex) abrirExercicioWeb(ex);
    };
  });
}

function abrirExercicioWeb(ex) {
  A.sessao = novaSessao();
  A.sessao.exAtual = ex;
  A.sessao.abertoEm = Date.now();
  A.sessao.web = true;
  A.tela = { nome: "exercicioWeb" };
  if (location.hash !== "#/webex/" + ex.id) {
    history.pushState(null, "", "#/webex/" + ex.id); // idem: dá "Voltar" ao navegador
  }
  render();
}

function arquivosWebAtuais() {
  const ex = A.sessao.exAtual;
  const editaveis = ex.editaveis || ["js"];
  const arqs = {};
  for (const t of ["html", "css", "js"]) {
    if (editaveis.includes(t)) {
      const el = document.getElementById("web-ed-" + t);
      arqs[t] = el ? el.value : (ex["web_" + t] || "");
    } else {
      arqs[t] = ex["web_" + t] || "";
    }
  }
  return arqs;
}

function atualizarPreviewWeb() {
  const iframe = document.getElementById("web-preview");
  if (iframe) webrunner.renderizarPreview(iframe, arquivosWebAtuais());
}

function salvarCodigoWeb() {
  const ex = A.sessao.exAtual;
  const h = A.save.historico[ex.id] || (A.save.historico[ex.id] = {
    tentativas: 0, resolvido: false, dicas_usadas: 0, solucao_vista: false,
    pulado: false, xp_ganho: 0, xp_zerado: false, web_codigo: null,
  });
  const arqs = {};
  for (const t of ex.editaveis || ["js"]) {
    const el = document.getElementById("web-ed-" + t);
    if (el) arqs[t] = storage.truncarCodigo(el.value);
  }
  h.web_codigo = arqs;
  salvar();
}

function ligarExercicioWeb() {
  const ex = A.sessao.exAtual;
  let tPrev = null;
  const agendarPreview = () => {
    if (tPrev) clearTimeout(tPrev);
    tPrev = setTimeout(atualizarPreviewWeb, 250);
  };
  let tSalvarWeb = null;
  document.querySelectorAll(".web-editor").forEach((ed) => {
    ui.ligarEditor(ed, null, aoRodarWeb);
    ed.addEventListener("input", agendarPreview);
    // autosave (mesmo motivo da tela Python: F5 não pode comer o código)
    ed.addEventListener("input", () => {
      if (tSalvarWeb) clearTimeout(tSalvarWeb);
      tSalvarWeb = setTimeout(salvarCodigoWeb, 800);
    });
  });
  document.querySelectorAll("[data-restaurar]").forEach((b) => {
    b.onclick = () => {
      const t = b.dataset.restaurar;
      const el = document.getElementById("web-ed-" + t);
      if (el) { el.value = ex["web_" + t] || ""; el.dispatchEvent(new Event("input")); }
    };
  });
  document.getElementById("btn-rodar").onclick = aoRodarWeb;
  document.getElementById("btn-proximo").onclick = aoProximoWeb;
  for (let i = 1; i <= 3; i++) {
    const b = document.getElementById("btn-dica-" + i);
    if (b) b.onclick = () => revelarDicaWeb(i);
  }
  document.getElementById("btn-solucao").onclick = pedirSolucaoWeb;
  document.getElementById("btn-pular").onclick = aoPularWeb;
  atualizarPreviewWeb();
  pintarBilly();
  // foca o 1º editor (como na tela Python): sem isso o teclado virtual não
  // tinha alvo e a primeira tecla clicada não inseria nada.
  const primeiro = document.querySelector(".web-editor");
  if (primeiro) primeiro.focus();
}

async function aoRodarWeb() {
  if (A.rodando) return;
  juice.acordarAudio();
  A.rodando = true;
  const ex = A.sessao.exAtual;
  const btn = document.getElementById("btn-rodar");
  btn.classList.add("rodando");
  engine.registrarTentativa(A.save, ex.id, JSON.stringify(arquivosWebAtuais()));
  salvarCodigoWeb();
  try {
    const resultado = await webrunner.rodarTestesWeb(arquivosWebAtuais(), ex.testes_web);
    tratarResultadoWeb(resultado);
  } finally {
    btn.classList.remove("rodando");
    A.rodando = false;
  }
}

function tratarResultadoWeb(resultado) {
  const ex = A.sessao.exAtual;
  const painel = document.getElementById("resultados");
  let xpGanho = 0;
  let estrelasNovas = [];
  let houveOk = false;
  if (resultado.status === "ok" && !A.sessao.resolvidoNaSessao) {
    A.sessao.resolvidoNaSessao = true;
    houveOk = true;
    const ev = engine.resolverWeb(A.save, ex, {
      dicaMax: A.sessao.dicaRevelada, viuSolucao: A.sessao.viuSolucao,
    });
    xpGanho = ev.xpGanho;
    estrelasNovas = ev.estrelasNovas || [];
    salvar();
    atualizarHeader();
    const streakEl = document.getElementById("hdr-streak");
    if (streakEl) { streakEl.classList.add("pulso"); setTimeout(() => streakEl.classList.remove("pulso"), 300); }
    const btnProx = document.getElementById("btn-proximo");
    btnProx.classList.remove("oculto");
    btnProx.focus();
    falarBilly("acerto");
    pintarBilly();
  } else if (resultado.status === "falha_teste") {
    A.sessao.falhasSeguidas += 1;
    if (A.sessao.falhasSeguidas >= 3) {
      falarBilly("falha3");
      pintarBilly();
    }
  }
  painel.innerHTML = ui.painelResultadoWeb(resultado, xpGanho);
  if (houveOk) {
    const tempo = registrarTempoSolve(ex);
    juice.tocar(tempo && tempo.novoRecorde ? "recorde" : "sucesso");
    juice.estourarEm(painel.querySelector(".check-svg") || document.getElementById("btn-rodar"), 1.2);
    mostrarTempo(painel, tempo);
    if (tempo && tempo.novoRecorde && tempo.anterior != null) mostrarToastRecorde(tempo);
    if (estrelasNovas.length) setTimeout(() => juice.tocar("estrela"), 320);
  } else if (resultado.status === "erro") {
    juice.tocar("erro");
  }
}

function revelarDicaWeb(n) {
  A.sessao.dicaRevelada = Math.max(A.sessao.dicaRevelada, n);
  falarBilly("dica"); // pintada pelo render logo abaixo
  const arqs = arquivosWebAtuais();
  const painel = document.getElementById("resultados").innerHTML;
  render({ manterScroll: true }); // idem Python: a dica está onde ele já estava
  // restaura o que o aluno tinha digitado
  for (const t of A.sessao.exAtual.editaveis || ["js"]) {
    const el = document.getElementById("web-ed-" + t);
    if (el && arqs[t] != null) el.value = arqs[t];
  }
  atualizarPreviewWeb();
  document.getElementById("resultados").innerHTML = painel;
  if (A.sessao.resolvidoNaSessao) document.getElementById("btn-proximo").classList.remove("oculto");
}

function pedirSolucaoWeb() {
  const ex = A.sessao.exAtual;
  mostrarModal(ui.modalSolucao(ex), () => {
    document.getElementById("btn-modal-cancelar").onclick = fecharModal;
    document.getElementById("btn-modal-confirmar").onclick = () => {
      fecharModal();
      A.sessao.viuSolucao = true;
      // preenche os editores com a solução e marca resolvido
      for (const t of ex.editaveis || ["js"]) {
        const sol = ex["solucao_" + t] != null ? ex["solucao_" + t] : ex["web_" + t];
        const el = document.getElementById("web-ed-" + t);
        if (el) el.value = sol || "";
      }
      atualizarPreviewWeb();
      if (!A.sessao.resolvidoNaSessao) {
        A.sessao.resolvidoNaSessao = true;
        engine.resolverWeb(A.save, ex, { dicaMax: A.sessao.dicaRevelada, viuSolucao: true });
        salvar();
        atualizarHeader();
      }
      const codigoComentado = (ex.editaveis || ["js"]).map((t) => {
        const sol = ex["solucao_" + t] != null ? ex["solucao_" + t] : ex["web_" + t];
        return `/* ${t.toUpperCase()} */\n${sol || ""}`;
      }).join("\n\n");
      const exFake = { titulo: ex.titulo, solucao_referencia: codigoComentado };
      mostrarModal(ui.modalSolucaoCorpo(exFake), () => {
        document.getElementById("btn-modal-fechar").onclick = () => {
          fecharModal();
          const b = document.getElementById("btn-proximo");
          if (b) { b.classList.remove("oculto"); b.focus(); }
        };
      });
    };
  });
}

function aoPularWeb() {
  falarBilly("pular"); // aparece já no próximo exercício
  engine.pularWeb(A.save, A.sessao.exAtual);
  salvar();
  aoProximoWeb();
}

function aoProximoWeb() {
  const lista = A.conteudo.webLab;
  const idx = lista.findIndex((e) => e.id === A.sessao.exAtual.id);
  const prox = lista.slice(idx + 1).find((e) => !A.save.historico[e.id]?.resolvido)
    || lista.find((e) => !A.save.historico[e.id]?.resolvido);
  if (prox) abrirExercicioWeb(prox);
  else navegar("#/web");
}

// ---------------------------------------------------------------------------
// config
// ---------------------------------------------------------------------------
function abrirConfig() {
  mostrarModal(ui.modalConfig(A), () => {
    document.getElementById("btn-modal-fechar").onclick = fecharModal;
    document.getElementById("sel-tema").onchange = (e) => {
      A.save.config.tema = e.target.value;
      aplicarTema(e.target.value);
      salvar();
    };
    document.getElementById("chk-som").onchange = (e) => {
      A.save.config.som = e.target.checked;
      juice.configurarJuice(A.save.config);
      salvar();
      if (e.target.checked) juice.tocar("clique");
    };
    document.getElementById("chk-part").onchange = (e) => {
      A.save.config.particulas = e.target.checked;
      juice.configurarJuice(A.save.config);
      salvar();
      if (e.target.checked) juice.estourarEm(document.querySelector(".modal"), 0.8);
    };
    document.getElementById("chk-reduz").onchange = (e) => {
      A.save.config.reduzir = e.target.checked;
      aplicarMovimento(A.save.config);
      juice.configurarJuice(A.save.config);
      salvar();
    };
    document.getElementById("btn-testar-estimulos").onclick = (ev) => {
      juice.acordarAudio();
      juice.tocar("recorde");
      juice.estourarEm(ev.currentTarget, 1.6);
      setTimeout(() => juice.celebrar(), 250);
    };
    document.getElementById("btn-exportar").onclick = () => storage.exportar(A.save);
    document.getElementById("input-importar").onchange = async (e) => {
      try {
        await storage.importar(e.target.files[0]);
        location.reload();
      } catch (err) {
        alert("Não deu para importar: " + err.message);
      }
    };
    document.getElementById("btn-resetar").onclick = () => {
      if (confirm("Zerar TODO o progresso? Isso não pode ser desfeito (exporte antes, se quiser).")) {
        storage.resetar();
        location.reload();
      }
    };
  });
}

let _focoAnteriorModal = null;
let _modalKeydown = null;

// elementos focáveis visíveis dentro do modal (exclui file inputs escondidos)
function focaveisModal(raiz) {
  return Array.from(raiz.querySelectorAll(
    'button, select, textarea, input:not([type=file]), a[href], [tabindex]:not([tabindex="-1"])'
  )).filter((el) => el.offsetParent !== null);
}

function mostrarModal(html, ligar) {
  const jaAberto = !!document.getElementById("modal-raiz");
  fecharModal();
  // só memoriza o foco de origem no PRIMEIRO modal da pilha (modais aninhados
  // como "ver solução" não devem sobrescrever o foco a restaurar)
  if (!jaAberto) _focoAnteriorModal = document.activeElement;
  const div = document.createElement("div");
  div.id = "modal-raiz";
  div.innerHTML = html;
  document.body.appendChild(div);
  ligar();
  // gestão de foco (aria-modal exige): foca o 1º controle, prende Tab, Esc fecha
  const dialogo = div.querySelector(".modal") || div;
  const focaveis = focaveisModal(div);
  (focaveis[0] || dialogo).focus?.();
  _modalKeydown = (e) => {
    if (e.key === "Escape") { e.preventDefault(); fecharModal(); return; }
    if (e.key !== "Tab") return;
    const els = focaveisModal(div);
    if (!els.length) return;
    const primeiro = els[0], ultimo = els[els.length - 1];
    if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
  };
  document.addEventListener("keydown", _modalKeydown, true);
}

function fecharModal() {
  if (_modalKeydown) {
    document.removeEventListener("keydown", _modalKeydown, true);
    _modalKeydown = null;
  }
  document.getElementById("modal-raiz")?.remove();
  // devolve o foco a quem abriu (só quando a pilha de modais esvazia)
  if (_focoAnteriorModal && _focoAnteriorModal.focus) {
    try { _focoAnteriorModal.focus(); } catch { /* ok */ }
    _focoAnteriorModal = null;
  }
}

boot();
