// Runner de exercícios web interativos (HTML/CSS/JS).
// - Compõe um documento a partir dos arquivos do aluno.
// - Preview ao vivo num <iframe sandbox>.
// - Verificação: roda asserts que enxergam o DOM/JS da página (doc, win),
//   com o mesmo _verificar pedagógico do runner Python.
//
// Modelo de segurança: o código da página pode vir de um save IMPORTADO (entrada
// não confiável), então preview e testes rodam em iframes sandbox SEM
// allow-same-origin -> origem opaca: o código do iframe não alcança o DOM, o
// localStorage nem o JS do jogo. Os testes rodam DENTRO do iframe (harness
// injetado no srcdoc) e conversam com o pai só por postMessage:
//   iframe -> pai  {dojo:"ready"}                       (página carregou)
//   pai -> iframe  {dojo:"run", id, codigo}             (roda 1 teste)
//   iframe -> pai  {dojo:"result", id, passou, ...}     (resultado)
// O pai só aceita mensagens cujo event.source é o contentWindow do iframe
// que ele mesmo criou. Um CSP <meta> no srcdoc corta rede/recursos externos.

import { t, idioma } from "./i18n.js";

// id da caixa de erro injetada na página: o CSS dos exercícios pode estilizá-la
// (#__dojo_erro no conteúdo pt, #__dojo_error no conteúdo en).
const idCaixaErro = () => (idioma() === "en" ? "__dojo_error" : "__dojo_erro");

const CSP_IFRAME =
  "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; " +
  "img-src data: blob:; font-src data:; media-src data: blob:; base-uri 'none'";

// Harness de testes que roda DENTRO do iframe de teste (origem opaca).
// Espelha o _verificar pedagógico do runner Python (versão JS).
// Textos (prefixo de erro, elemento ausente) vêm do idioma atual, como JSON.
const harnessJs = () => `(function(){
  var ERRO_JS=${JSON.stringify(t("web.erroJs"))},NAO_ACHOU=${JSON.stringify(t("web.naoEncontrado"))};
  function repr(x){
    if(typeof x==="string")return JSON.stringify(x);
    if(x===null)return "null";
    if(x===undefined)return "undefined";
    try{return JSON.stringify(x);}catch(e){return String(x);}
  }
  function iguais(a,b){
    if(typeof a==="number"&&typeof b==="number")return Math.abs(a-b)<1e-9||a===b;
    if(Array.isArray(a)&&Array.isArray(b))return a.length===b.length&&a.every(function(x,i){return iguais(x,b[i]);});
    if(a&&b&&typeof a==="object"&&typeof b==="object"){
      var ka=Object.keys(a),kb=Object.keys(b);
      return ka.length===kb.length&&ka.every(function(k){return iguais(a[k],b[k]);});
    }
    return a===b;
  }
  function FalhaWeb(esperado,obtido){this.esperado=esperado;this.obtido=obtido;}
  var pai=window.parent;
  window.addEventListener("message",function(ev){
    if(ev.source!==pai)return;
    var m=ev.data;
    if(!m||m.dojo!=="run"||typeof m.codigo!=="string")return;
    var doc=document,win=window;
    var caixa=document.getElementById(${JSON.stringify(idCaixaErro())});
    var res={dojo:"result",id:m.id,passou:false,esperado:null,obtido:null,mensagem:null,
      erroPagina:(caixa&&caixa.textContent.indexOf(ERRO_JS)===0)?caixa.textContent:null};
    var _verificar=function(obtido,esperado){if(!iguais(obtido,esperado))throw new FalhaWeb(repr(esperado),repr(obtido));};
    var _clicar=function(sel){var el=doc.querySelector(sel);if(!el)throw new Error(NAO_ACHOU+sel);el.click();};
    var _texto=function(sel){var el=doc.querySelector(sel);return el?el.textContent.trim():null;};
    var _esperar=function(){return new Promise(function(r){setTimeout(r,0);});};
    Promise.resolve().then(function(){
      // _check/_click/_text/_wait: aliases en dos MESMOS helpers
      var fn=new Function("doc","win","_verificar","_clicar","_texto","_esperar",
        "_check","_click","_text","_wait",
        "return (async () => { "+m.codigo+" })();");
      return fn(doc,win,_verificar,_clicar,_texto,_esperar,_verificar,_clicar,_texto,_esperar);
    }).then(function(){res.passou=true;},function(e){
      if(e instanceof FalhaWeb){res.esperado=e.esperado;res.obtido=e.obtido;}
      else res.mensagem=String(e&&e.message?e.message:e);
    }).then(function(){pai.postMessage(res,"*");});
  });
  window.addEventListener("load",function(){setTimeout(function(){pai.postMessage({dojo:"ready"},"*");},0);});
})();`;

export function comporDocumento({ html, css, js }, { harness = false } = {}) {
  // injeta o CSS no <head> e o JS no fim do <body>. Se o html já é um
  // documento completo, envolvemos mesmo assim de forma tolerante.
  const corpo = html || "";
  // Base com o TEMA DO JOGO — "entardecer dourado" (direção Neon Bruma):
  // céu pêssego→âmbar com halos radiais difusos, tinta quente, rim light
  // claro fino no lugar de contorno, sombras tintadas suaves (nunca preto
  // chapado nem offset duro). Só seletores de elemento (especificidade
  // mínima): o CSS do exercício sempre pode sobrescrever.
  return `<!doctype html><html lang="${idioma() === "en" ? "en" : "pt-BR"}"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${CSP_IFRAME}">
<style>
:root{color-scheme:light}
/* céu do entardecer: gradiente vertical pêssego→âmbar + dois halos difusos
   (sol fora de quadro no alto à direita, calor refletido embaixo à esquerda) */
body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;margin:18px;color:#4a3b2a;
  line-height:1.55;
  background:
    radial-gradient(620px 340px at 82% -14%, rgba(255,199,118,0.30), transparent 65%),
    radial-gradient(460px 280px at 6% 110%, rgba(242,152,112,0.16), transparent 70%),
    linear-gradient(180deg,#fdf4e4 0%,#f9e9cf 55%,#f4dfc2 100%)}
/* tinta quente com um leve halo dourado atrás (brilho difuso, nunca linha) */
h1,h2,h3{color:#4a3324;letter-spacing:-0.02em;font-weight:800;
  text-shadow:0 0 26px rgba(255,199,118,0.45)}
/* botão = tecla mecânica: gradiente quente, rim light claro em cima, sombra
   difusa tintada; :active afunda 2px e a sombra encolhe junto (press bom) */
button{font:inherit;font-weight:700;padding:9px 18px;cursor:pointer;color:#43260a;
  border:1px solid rgba(255,232,200,0.85);border-radius:3px;
  background:linear-gradient(175deg,#ffd08a 0%,#f5a952 60%,#e8983f 100%);
  box-shadow:0 10px 22px -8px rgba(198,116,42,0.55),0 3px 7px rgba(198,116,42,0.28),
    inset 0 1px 0 rgba(255,248,236,0.8),inset 0 -2px 0 rgba(176,100,36,0.35);
  transition:transform 110ms ease,box-shadow 110ms ease,filter 110ms ease}
button:hover{filter:brightness(1.05)}
button:active{transform:translateY(2px);
  box-shadow:0 4px 10px -5px rgba(198,116,42,0.5),0 1px 3px rgba(198,116,42,0.25),
    inset 0 1px 0 rgba(255,248,236,0.6),inset 0 2px 4px rgba(176,100,36,0.25)}
/* campos = vidro leitoso; foco com glow difuso e anel suave */
input,select,textarea{font:inherit;padding:8px 12px;color:#4a3b2a;
  border:1px solid rgba(214,166,108,0.6);border-radius:3px;
  background:rgba(255,252,246,0.72);
  box-shadow:inset 0 1px 2px rgba(176,124,64,0.08);
  transition:box-shadow 130ms ease}
input:focus,select:focus,textarea:focus{outline:2px solid rgba(255,178,94,0.5);outline-offset:2px;
  border-color:rgba(240,160,80,0.8);
  box-shadow:0 0 0 5px rgba(255,199,118,0.18),0 0 20px rgba(255,178,94,0.3),
    inset 0 1px 2px rgba(176,124,64,0.06)}
/* tabela limpa: cabeçalho discreto, linhas com traço tintado fino */
table{border-collapse:collapse}
th,td{padding:8px 12px;border-bottom:1px solid rgba(214,178,128,0.55);text-align:left}
th{color:#8a6f4e;font-size:12.5px;text-transform:uppercase;letter-spacing:0.05em;font-weight:700}
/* listas com marcador losango dourado (só ul; ol mantém números) */
ul{padding-left:24px}
ul>li::marker{content:"◆  ";color:#e0973f;font-size:0.72em}
a{color:#c06a1e;text-decoration-color:rgba(224,151,63,0.5);text-underline-offset:2px}
code,pre{font-family:ui-monospace,Consolas,monospace;background:rgba(255,250,240,0.8);border-radius:3px}
code{padding:1px 5px}
pre{padding:10px 12px;border:1px solid rgba(214,178,128,0.4);overflow:auto}
hr{border:0;height:1px;background:linear-gradient(90deg,transparent,rgba(214,166,108,0.7),transparent)}
::selection{background:rgba(255,199,118,0.5)}
${(css || "").replace(/<\/style/gi, "<\\/style")}
</style></head><body>
<script>
// caça-erros: um <pre id=__dojo_erro> (en: __dojo_error) identificável (não o
// 1º <pre> qualquer) que também pega erros de SINTAXE/globais que o try/catch
// abaixo não alcança.
function __dojoErro(msg){
  var b=document.getElementById(${JSON.stringify(idCaixaErro())});
  if(!b){b=document.createElement("pre");b.id=${JSON.stringify(idCaixaErro())};b.style.color="#c0392b";b.style.whiteSpace="pre-wrap";document.body.appendChild(b);}
  b.textContent=${JSON.stringify(t("web.erroJs"))}+msg;
}
window.addEventListener("error",function(ev){__dojoErro((ev.error&&ev.error.message)||ev.message||"erro");});
${harness ? harnessJs() : ""}
<\/script>
${corpo}
<script>
try{
${(js || "").replace(/<\/script/gi, "<\\/script")}
}catch(e){
  __dojoErro(e&&e.message?e.message:String(e));
}
<\/script>
</body></html>`;
}

// Atualiza o iframe de preview (debounce fica no chamador).
export function renderizarPreview(iframe, arquivos) {
  iframe.srcdoc = comporDocumento(arquivos);
}

// ---------------------------------------------------------------------------
// execução dos testes num iframe FRESCO (sem vazamento de estado), origem opaca
// ---------------------------------------------------------------------------
const TEMPO_PRONTO_MS = 3000;  // espera o {dojo:"ready"}; depois roda mesmo assim
const TEMPO_TESTE_MS = 10000;  // um teste que nunca responde vira falha, não trava

function criarIframeTeste(arquivos) {
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    // allow-forms: exercícios de formulário precisam disparar o evento submit.
    // SEM allow-same-origin: o código do aluno/save não toca o jogo.
    iframe.setAttribute("sandbox", "allow-scripts allow-forms");
    iframe.setAttribute("aria-hidden", "true");
    iframe.tabIndex = -1;
    iframe.style.cssText = "position:absolute;width:800px;height:600px;left:-9999px;top:-9999px;border:0";
    let feito = false;
    let timer = null;
    const ouvir = (ev) => {
      if (ev.source === iframe.contentWindow && ev.data && ev.data.dojo === "ready") fim();
    };
    function fim() {
      if (feito) return;
      feito = true;
      clearTimeout(timer);
      window.removeEventListener("message", ouvir);
      resolve(iframe);
    }
    window.addEventListener("message", ouvir);
    timer = setTimeout(fim, TEMPO_PRONTO_MS);
    document.body.appendChild(iframe);
    iframe.srcdoc = comporDocumento(arquivos, { harness: true });
  });
}

const curto = (x) => (typeof x === "string" ? x.slice(0, 2000) : null);

function rodarUmTeste(iframe, codigo) {
  return new Promise((resolve) => {
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    let timer = null;
    const ouvir = (ev) => {
      if (ev.source !== iframe.contentWindow) return;
      const d = ev.data;
      if (!d || d.dojo !== "result" || d.id !== id) return;
      fim({
        passou: d.passou === true,
        esperado: curto(d.esperado),
        obtido: curto(d.obtido),
        mensagem: curto(d.mensagem),
        erroPagina: curto(d.erroPagina),
      });
    };
    function fim(r) {
      clearTimeout(timer);
      window.removeEventListener("message", ouvir);
      resolve(r);
    }
    window.addEventListener("message", ouvir);
    timer = setTimeout(() => fim({
      passou: false, esperado: null, obtido: null,
      mensagem: t("web.semResposta"),
      erroPagina: null,
    }), TEMPO_TESTE_MS);
    // origem opaca: o único targetOrigin possível é "*"; do lado de lá o
    // harness confere event.source === parent.
    iframe.contentWindow.postMessage({ dojo: "run", id, codigo: String(codigo || "") }, "*");
  });
}

export async function rodarTestesWeb(arquivos, testes) {
  const resultados = [];
  let erroPagina = null;
  try {
    // Cada teste roda num iframe FRESCO — isolamento total (cliques de um teste
    // não vazam para o outro), igual ao runner Python (namespace por teste).
    for (const t of testes || []) {
      const iframe = await criarIframeTeste(arquivos);
      try {
        const r = await rodarUmTeste(iframe, t.codigo);
        if (r.erroPagina) erroPagina = r.erroPagina;
        resultados.push({
          nome: t.nome, passou: r.passou, esperado: r.esperado,
          obtido: r.obtido, mensagem: r.mensagem,
        });
      } finally {
        iframe.remove();
      }
    }
    return {
      status: resultados.length && resultados.every((r) => r.passou) ? "ok" : "falha_teste",
      erroPagina,
      testes: resultados,
    };
  } catch (e) {
    return { status: "erro", erroPagina: String(e), testes: resultados };
  }
}
