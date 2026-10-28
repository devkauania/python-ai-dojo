# Publicar o Dojo para os amigos jogarem

Não existe "compilar": o jogo é um site **estático** (HTML + CSS + JS + JSON).
O Python roda no navegador de quem joga (Pyodide, baixado de um CDN no primeiro
acesso) e o progresso fica no `localStorage` de cada um — **sem servidor, sem
banco, sem conta**. Qualquer host de site estático serve.

## Opção recomendada: Vercel (grátis)

O repositório já traz `vercel.json` (headers) e `.vercelignore` (corta ~29 MB de
fontes de arte). O deploy fica com **~13 MB**.

### Pelo site (mais simples)
1. Suba este projeto para um repositório no GitHub.
2. Entre em https://vercel.com com a conta do GitHub → **Add New… → Project**.
3. Escolha o repositório e clique **Deploy**. Não mude nada:
   - Framework Preset: **Other**
   - Build Command: **vazio**
   - Output Directory: **vazio** (a raiz já é o site)
4. Pronto — a Vercel devolve uma URL tipo `python-ai-dojo.vercel.app`. Mande
   para os amigos.

### Pelo terminal
```bash
npm i -g vercel
```
Depois, dentro da pasta do jogo:
```bash
vercel --prod
```

## Alternativas equivalentes

| Host | Observação |
|---|---|
| **Cloudflare Pages** | igual à Vercel; headers vão num arquivo `_headers` |
| **Netlify** | idem, headers em `_headers` ou `netlify.toml` |
| **GitHub Pages** | funciona, mas **não** deixa configurar os headers COOP/COEP (veja abaixo — o jogo roda mesmo assim) |

## O que os headers do `vercel.json` fazem

- **COOP/COEP**: ligam o `crossOriginIsolated`, que dá acesso ao
  `SharedArrayBuffer`. Com ele, um loop infinito escrito pelo aluno é
  interrompido com `KeyboardInterrupt` (elegante). **Sem eles o jogo funciona
  igual** — só cai no caminho degradado: o ambiente Python é reiniciado.
  *(Testado: num servidor estático puro, sem nenhum header, o jogo abre, roda
  Python de verdade e o Lab Web funciona.)*
- **Segurança**: `Content-Security-Policy` (scripts só do próprio site e do
  Pyodide fixado no jsDelivr, `wasm-unsafe-eval` para o WebAssembly, nada de
  ser embutido em iframe de terceiros), `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy` e `Permissions-Policy`.
  O `tools/serve.py` lê essa MESMA lista do `vercel.json`, então uma violação
  de CSP aparece no console local antes de ir ao ar. Em outro host (Cloudflare,
  Netlify), copie esses headers para o `_headers`.
- **Cache**: `index.html` sempre fresco (ele carrega o import map versionado) e
  todo o resto com cache eterno, já que cada arquivo é versionado por `?v=N`.

> **Ao publicar uma atualização**, lembre de bumpar o `?v=N` (index.html +
> `js/pybridge.js` + `css/styles.css`), senão os amigos continuam vendo a versão
> antiga em cache.

## Avise os amigos

- **Primeiro acesso precisa de internet** e leva alguns segundos: o Python
  (~10 MB) é baixado do CDN uma única vez, depois fica em cache.
- Funciona em Chrome, Edge e Firefox atuais, no computador. Em celular abre,
  mas o jogo é feito para teclado.
- O progresso é **local** em cada navegador. Dá para exportar/importar o save
  em *Start → Configurações*.
