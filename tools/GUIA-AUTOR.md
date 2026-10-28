# Guia do Autor de Exercícios — Python AI Dojo

Você escreve um FRAGMENTO de conteúdo: `content/_frag-<slug>.json`, no formato
`{"exercicios": [Exercicio, ...]}`. Tudo em **português brasileiro**. O fragmento
só é aceito quando `tools/verify_fragment.py` termina **100% VERDE**.

## Antes de escrever (obrigatório)

1. Leia `content/ato1-fundamentos.json` INTEIRO — é o calibrador de qualidade
   (nível "texto", 14 exercícios). Replique tom, tamanho e nível de detalhe.
2. Se seu nível usa mocks (`requests`/`openai`/`anthropic`), leia a docstring de
   `py/mocks_ia.py` — as tabelas de rotas, respostas do LLM e ferramentas.
   **Exercícios SÓ podem usar o que está nas tabelas.**
3. Consulte `content/manifest.json` para os conceitos do seu nível.

## Schema do Exercicio (todos os campos, nesta ordem)

| Campo | Regra |
|---|---|
| `id` | `"{ato}-{nivel}-t{tier}-{nn}"`, nn de "01" em diante (ex.: `ato3-http-t1-01`) |
| `nivel` | slug do seu nível (igual ao manifest) |
| `tier` | 1, 2 ou 3 |
| `conceitos` | ≥1, do vocabulário do manifest; use os do SEU nível (pode incluir conceitos de níveis ANTERIORES na trilha; nunca posteriores) |
| `titulo` | curto, evocativo, PT-BR |
| `explicacao_md` | OBRIGATÓRIA (não-nula) no 1º exercício de cada tier; `null` nos demais. Máx ~150 palavras + 1 exemplo de código |
| `enunciado_md` | ≤150 palavras, com exemplo de entrada/saída; especifica EXATAMENTE os nomes exigidos |
| `starter_code` | T1: passos numerados em comentários; T2: só assinatura; T3: assinatura + contrato de erros/bordas no docstring/comentário. NUNCA pode passar nos testes |
| `solucao_referencia` | passa em 100% dos testes |
| `testes_visiveis` | ≥1 |
| `testes_ocultos` | ≥2, com entradas DIFERENTES das visíveis (anti-hardcode) |
| `dicas` | EXATAMENTE 3: (1) conceito sem código, grátis; (2) direção/nome da função, −50% XP; (3) quase-solução com 1-2 lacunas, XP=0 |
| `xp` | tier 1/2/3 → 10/15/25; etapa de boss ×3 (30/45/75); boss5 ×5 (50/75/125) |
| `pacotes` | `[]`, `["numpy"]` ou `["pandas"]` — só quando o exercício importa de verdade |
| `mocks` | ⊆ `["requests","openai","anthropic"]` |
| `arquivos` | (opcional) fixtures `{"nome.ext": "conteúdo"}` gravadas no sandbox |
| `timeout_s` | 5; use 15 se `pacotes` não-vazio |

**Schema de Teste:** `{"nome": str, "codigo": str}` (+ `"entradas": [str]` só para
scripts com input() — EVITE; prefira funções). O `nome` aparece para o jogador:
curto, descritivo, e nos ocultos não pode entregar a resposta.

## O ambiente dos testes

- O código do teste roda num namespace que enxerga os globais do aluno, MAIS:
  - `_verificar(obtido, esperado)` — comparação com tolerância de float
    (1e-6), diff automático para strings multilinha, arrays numpy convertidos.
    Use SEMPRE que possível (gera o painel esperado/obtido).
  - `assert cond, "mensagem em PT-BR"` — para checagens de tipo/propriedade.
  - `_stdout` — o que o código do aluno imprimiu (string).
  - `_mocks` — o módulo de mocks: `_mocks.roteirizar_falhas(rota, [429, 200], retry_after=2)`,
    `_mocks.roteirizar_erros_llm(['rate_limit', None])` (eventos: `rate_limit`,
    `args_invalidos`, `multi_blocos`, `vetor_zero` = embedding de norma zero), `_mocks.relogio()`
    (segundos virtuais — `time.sleep` e `asyncio.sleep` avançam esse relógio sem
    esperar de verdade), `_mocks.historico_http` (lista de chamadas),
    `_mocks.embed_texto(texto)` (o mesmo embedding dos clientes).
  - `_rodar(coro)` — roda corrotina até o fim (event loop com relógio virtual).
    Ex.: `_verificar(_rodar(minha_func()), esperado)`. NUNCA use `asyncio.run`.
- O estado dos mocks (relógio, roteiros, histórico) é RESETADO antes de cada
  teste. Clients de LLM criados na execução-base acumulam `.chamadas` entre
  testes — teste que inspeciona `.chamadas` deve criar o PRÓPRIO client:
  `c = OpenAI()` dentro do teste, passando-o para a função do aluno.
- Cada teste roda numa CÓPIA do namespace; todos os testes rodam sempre.
- Conteúdo em inglês (`content/en/`) usa os ALIASES em inglês dos mesmos
  objetos: `_check`/`_run`, `_mocks.http_history`, `_mocks.clock()`,
  `_mocks.script_failures`, `_mocks.script_llm_errors`, `_mocks.embed_text`,
  `client.calls`, chaves `method`/`path`/`clock` nos registros http, eventos
  `"invalid_args"`/`"multi_block"`/`"zero_vector"` em `script_llm_errors` e, no Lab Web,
  `_click`/`_text`/`_wait` e a caixa de erro `#__dojo_error`. Tabela completa
  em `docs/I18N.md`.

## Proibições (o verify rejeita)

- `hash(` builtin, `import random`, `threading`/`subprocess`/`multiprocessing`/`socket`,
  `asyncio.run(`.
- `open(` sem `encoding="utf-8"` (starter e solução).
- Nunca comparar `repr`/`print` de DataFrame — use `.to_dict()`, `.tolist()`,
  `.shape`, `_verificar` sobre valores.
- Nenhuma rede real; nenhuma dependência de ordem de `set`; nada de relógio real.
- Exercício placeholder, teste trivial que o starter já passa, dica fora da escala.

## Rubrica de tiers (o delta específico do seu nível está no seu prompt)

- **T1**: sintaxe guiada, UM conceito por exercício, starter com passos
  numerados, dados pequenos e limpos, poucos testes todos visíveis + 2 ocultos.
- **T2**: sem guia, contexto REAL de IA (prompts, logs, respostas de API,
  custo/latência), combina 2+ conceitos, casos-limite anunciados no enunciado.
- **T3**: dados sujos (vazio, unicode, campos faltando, tipos errados),
  contratos de borda explícitos, pegadinhas clássicas do conceito, ocultos de borda.
- T2/T3 são jogados nas runs 2/3 — o jogador já viu TODOS os níveis; pode usar
  estruturas de níveis anteriores da trilha livremente (mas as TAGS `conceitos`
  respeitam a ordem da trilha).

## Tom

Técnico, direto, respeitoso. Sem sarcasmo, sem infantilizar, sem "!!!". Cada
enunciado conecta o exercício ao MUNDO REAL de IA em 1 frase quando natural.
Mensagens de assert em PT-BR e úteis.

## Como verificar (loop até verde)

```
cd <raiz-do-repo>
.venv-verify/Scripts/python.exe -X utf8 tools/verify_fragment.py content/_frag-<slug>.json
```

Conserte TODA falha e rode de novo até `FRAGMENTO: 100% VERDE`.

## Limites rígidos

- Escreva SOMENTE o seu `content/_frag-<slug>.json`. Não toque em NENHUM outro
  arquivo, nem em outros fragmentos.
- PROIBIDO: `git add/commit/push`, criar branches/worktrees, instalar pacotes.
- UTF-8 sem BOM (o Write padrão já faz isso).
