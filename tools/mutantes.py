# -*- coding: utf-8 -*-
"""Respostas erradas nomeadas: a porta de mutação do tools/verify.py.

Passar a solução de referência não prova que os testes reprovam uma resposta
errada. Cada entrada aqui reescreve a solução de referência de um jeito plausível
e errado, e o verify exige que o resultado seja "falha_teste". Uma reescrita que
não muda o código, ou que quebra na execução-base, também reprova: o mutante
precisa continuar valendo quando o conteúdo mudar.

ALTERNATIVAS é o inverso: respostas certas, escritas de outro jeito, que precisam
continuar passando. É o que impede um teste apertado de reprovar quem acertou.

Formato: {id: [(nome, reescritas), ...]}. `reescritas` é uma lista de
(regex, substituição), a mesma nos dois idiomas, ou {"pt": [...], "en": [...]}
quando os nomes não cabem numa regex só.
"""

MOCK_4 = [(r'model="mock-4"', 'model="gpt-qualquer"')]
MOCK_CLAUDE = [(r'model="mock-claude"', 'model="gpt-qualquer"')]
TOPK = r'(\w+) = np\.argsort\(-np\.array\((\w+)\), kind="stable"\)'
SEM_PARADA = [(r"\n\s*if i \+ \w+ >= len\(\w+\):\n\s*break", "")]
SEM_FLOAT = lambda alvo: [(r"float\((" + alvo + r")\)", r"\1")]  # noqa: E731

_RAG = [
    ("k ignorado: todos os chunks no prompt", [(r"\[:k\]", "")]),
    ("sem recuperar: ordem do índice", [(TOPK, r"\1 = list(range(len(\2)))")]),
    ("sem recuperar e k ignorado", [(TOPK, r"\1 = list(range(len(\2)))"), (r"\[:k\]", "")]),
    ("ranking crescente", [(r"np\.argsort\(-np\.array", "np.argsort(np.array")]),
]
_CHUNKS = [
    ("sem parar na última palavra", SEM_PARADA),
    ("só para depois de passar da última palavra", [(r"(if i \+ \w+) >= (len)", r"\1 > \2")]),
    ("passo tamanho + overlap", [(r"= (\w+) - overlap", r"= \1 + overlap")]),
    ("janela vai até o fim do texto", [(r"\[i:i \+ \w+\]", "[i:]")]),
    ("janela com i - tamanho", [(r"\[i:i \+ (\w+)\]", r"[i:i - \1]")]),
]
_ZERA_ACUMULO = r'(\.join\(\w+\)\)\n\s+\w+ = \[\]\n\s+\w+) = 0'
_ROUND_SCORE = ("score arredondado em 2 casas", [(r'"score": scores\[i\]', '"score": round(scores[i], 2)')])
_THRESHOLD_ESTRITO = ("score igual ao threshold fica de fora", [(r"\[i\] < (\w+):", r"[i] <= \1:")])

MUTANTES = {
    # -------------------------------------------------------- boss final
    "ato4-boss5-t1-01": _CHUNKS,
    "ato4-boss5-t2-01": _CHUNKS,
    "ato4-boss5-t3-01": _CHUNKS,
    "ato4-boss5-t1-02": _RAG + [("modelo errado", MOCK_4)],
    "ato4-boss5-t2-02": _RAG + [("modelo OpenAI errado", MOCK_4), ("modelo Anthropic errado", MOCK_CLAUDE)],
    "ato4-boss5-t3-02": _RAG,
    "ato4-boss5-t3-03": [
        ("booleano vale como fonte", [(r"\n\s*if isinstance\(n, bool\):\n\s*continue", "")]),
        ("JSON que não é objeto quebra", [(r"\n\s*if not isinstance\(\w+, dict\):\n\s*return [^\n]*", "")]),
        ("fonte 0 é aceita", [(r"1 <= n <= k", "0 <= n <= k")]),
        ("fontes null quebra", [(r"\n    if isinstance\(\w+, list\):", "\n    if True:")]),
        ("resposta numérica passa", [(r"\n    if not isinstance\(\w+, str\):\n        \w+ = \"\"", "")]),
    ],
    # -------------------------------------------------------- cosseno e top-k
    "ato3-numpy-t3-01": [
        ("divisão inteira no cosseno", [(r"np\.dot\(a, b\) / \(", "np.dot(a, b) // (")]),
        ("não converte para float", SEM_FLOAT(r"np\.dot\(a, b\) / \(\w+ \* \w+\)")),
    ],
    "ato3-numpy-t2-04": [
        ("divisão inteira no cosseno", [(r"np\.dot\(v, (\w+)\) / \(", r"np.dot(v, \1) // (")]),
        ("produto escalar sem dividir pelas normas", [(r"np\.dot\(v, (\w+)\) / \(np\.linalg\.norm\(v\) \* \w+\)", r"np.dot(v, \1)")]),
    ],
    "ato3-numpy-t2-02": [
        ("denominador soma as normas", [(r"np\.linalg\.norm\(a\) \* np\.linalg\.norm\(b\)", "np.linalg.norm(a) + np.linalg.norm(b)")]),
        ("divisão inteira no cosseno", [(r"np\.dot\(a, b\) / \(", "np.dot(a, b) // (")]),
    ],
    "ato3-numpy-t3-03": [
        ("sem a guarda de k <= 0", [(r"    if k <= 0:\n        return \[\]\n", "")]),
        ("k = 1 devolve vazio", [(r"if k <= 0:", "if k <= 1:")]),
    ],
    "ato3-numpy-t1-03": [("não converte para float", SEM_FLOAT(r"np\.dot\(v, w\)"))],
    "ato3-numpy-t1-04": [
        ("não converte para float", SEM_FLOAT(r"np\.linalg\.norm\(v\)")),
        ("norma arredondada em 2 casas", [(r"return float\((.+)\)", r"return round(float(\1), 2)")]),
    ],
    "ato3-numpy-t1-06": [
        ("não converte a soma para float", SEM_FLOAT(r"np\.sum\(\w+\)")),
        ("soma arredondada em 2 casas", [(r"return float\(np\.sum\((\w+)\)\)", r"return round(float(np.sum(\1)), 2)")]),
        ("média arredondada em 2 casas", [(r"return float\(np\.mean\((\w+)\)\)", r"return round(float(np.mean(\1)), 2)")]),
    ],
    "ato3-numpy-t2-01": [("não converte para float", SEM_FLOAT(r"np\.dot\(a, b\) / \(.+\)"))],
    # -------------------------------------------------------- busca semântica
    "ato4-embeddings-t3-03": [
        ("não ordena pelo score", [(r"\n\s*\w+\.sort\(key=lambda p: -p\[1\]\)", "")]),
        ("similaridade igual ao limiar conta como duplicata", [(r"\)\) > (\w+):", r")) >= \1:")]),
    ],
    "ato4-embeddings-t3-01": [
        ("não corta em k", [(r"\[:k\]", "")]),
        ("score igual ao limiar fica de fora", [(r"p\[1\] >= ", "p[1] > ")]),
        ("score arredondado em 2 casas", [(r"float\(np\.dot\(embed\(t\), q\)\)", "round(float(np.dot(embed(t), q)), 2)")]),
    ],
    "ato4-embeddings-t1-02": [("não converte para float", SEM_FLOAT(r"np\.dot\(embed\(a\), embed\(b\)\)"))],
    "ato4-embeddings-t2-03": [("não converte para float", SEM_FLOAT(r"scores\[i\]"))],
    "ato4-embeddings-t1-03": [("empate devolve o segundo", [(r"sa >= sb", "sa > sb")])],
    "ato4-embeddings-t1-04": [
        ("compara a primeira palavra, sem embedding",
         [(r"return float\(np\.dot\(embed\(a\), embed\(b\)\)\) >= \w+", "return a.split()[0] == b.split()[0]")]),
        ("só o exemplo do enunciado dá False", {
            "pt": [(r"return float\(np\.dot\(embed\(a\), embed\(b\)\)\) >= \w+", "return (a, b) != ('gato preto', 'banco de dados')")],
            "en": [(r"return float\(np\.dot\(embed\(a\), embed\(b\)\)\) >= \w+", "return (a, b) != ('black cat', 'database')")],
        }),
    ],
    "ato4-embeddings-t2-04": [
        ("altera a lista recebida", [(r"return (\w+), (\w+) \+ \[(\w+)\]", r"\2.append(\3)\n    return \1, \2")]),
    ],
    # -------------------------------------------------------- boss 1 a 4
    "ato1-boss1-t3-02": [("não corta no top 3", [(r"\)\[:3\]", ")")])],
    "ato4-chunking-t3-02": [
        ("sem conferir se há pedaço anterior", [(r"len\(chunks\) > 1 and ", "")]),
        ("só junta com 3 pedaços ou mais", [(r"len\(chunks\) > 1", "len(chunks) > 2")]),
    ],
    "ato2-boss2-t3-02": [
        ("parse sem proteção",
         [(r"    try:\n        (\w+) = json\.loads\((\w+)\)\n    except json\.JSONDecodeError:\n        raise [^\n]*\n", r"    \1 = json.loads(\2)\n")]),
        ("não confere o campo de valor", [(r'    if "(?:valor|value)" not in \w+:\n        raise [^\n]*\n', "")]),
    ],
    "ato3-boss3-t3-01": [
        ("sem dedupe por id", [(r"if m\[.id.\] not in \w+:", "if True:")]),
        ("não registra os ids vistos", [(r"\n\s*\w+\.add\(m\[.id.\]\)", "")]),
    ],
    "ato4-boss4-t3-02": [("guarda o chunk descartado no lugar do primeiro", [(r"(\w+)\.append\(c\)", r"\1.append(chunks[-1])")])],
    "ato4-boss4-t1-03": [_ROUND_SCORE],
    "ato4-boss4-t2-03": [_THRESHOLD_ESTRITO, _ROUND_SCORE],
    "ato4-boss4-t3-03": [
        _THRESHOLD_ESTRITO, _ROUND_SCORE,
        ("k ignorado", [(r"if len\(\w+\) >= k:", "if False:")]),
        ("devolve k + 1", [(r"if len\((\w+)\) >= k:", r"if len(\1) > k:")]),
    ],
    "ato4-chunking-t3-03": [
        ("o acúmulo recomeça em 1 depois da gigante", [(_ZERA_ACUMULO, r"\1 = 1")]),
        ("o acúmulo recomeça em -1 depois da gigante", [(_ZERA_ACUMULO, r"\1 = -1")]),
    ],
    # -------------------------------------------------------- fronteiras do enunciado
    "ato1-variaveis-t2-01": [
        ("500 tokens vira prompt grande", [(r"tokens > 500 and", "tokens >= 500 and")]),
        ("501 tokens ainda é prompt pequeno", [(r"tokens <= 500", "tokens <= 501")]),
    ],
    "ato1-variaveis-t2-03": [
        ("zero fora da faixa", [(r"t < 0 or t > 2", "t <= 0 or t > 2")]),
        ("faixa até 3", [(r"t < 0 or t > 2", "t < 0 or t > 3")]),
    ],
    "ato1-texto-t3-02": [("n = 1 devolve vazio", [(r"if n <= 0:", "if n <= 1:")])],
    "ato1-texto-t2-02": [
        ("sobrescreve a lista recebida", {
            "pt": [(r"return limpas", "linhas[:] = limpas\n    return linhas")],
            "en": [(r"return cleaned", "lines[:] = cleaned\n    return lines")],
        }),
    ],
    "ato3-pandas-t2-03": [
        ("custo no limite estoura", [(r'\] > (\w*(?:custo|cost)\w*)\)', r'] >= \1)')]),
        ("latência no limite estoura", [(r'\] > (\w*(?:lat)\w*)\)', r'] >= \1)')]),
    ],
    "ato3-pandas-t2-02": [("devolve array, não lista", [(r"\.tolist\(\)", ".values")])],
    "ato3-pandas-t3-02": [("devolve array, não lista", [(r"\.tolist\(\)", ".values")])],
    # -------------------------------------------------------- modelo e max_tokens do enunciado
    "ato4-llm-t1-01": [("modelo errado", MOCK_4)],
    "ato4-llm-t1-02": [("modelo errado", MOCK_CLAUDE), ("max_tokens errado", [(r"max_tokens=256", "max_tokens=99")])],
    "ato4-llm-t1-04": [("modelo errado", MOCK_4)],
    "ato4-llm-t1-05": [("modelo errado", MOCK_CLAUDE), ("max_tokens errado", [(r"max_tokens=256", "max_tokens=99")])],
    "ato4-llm-t1-06": [("modelo errado", MOCK_4)],
    "ato4-llm-t2-01": [("modelo errado", MOCK_4)],
    "ato4-llm-t2-02": [("max_tokens errado", [(r"max_tokens=1024", "max_tokens=9")])],
    "ato4-llm-t2-03": [("modelo errado", MOCK_CLAUDE), ("max_tokens errado", [(r"max_tokens=256", "max_tokens=99")])],
    "ato4-llm-t2-05": [("modelo errado", MOCK_4)],
    "ato4-llm-t3-01": [("modelo errado", MOCK_4)],
    "ato4-llm-t3-02": [("modelo errado", MOCK_CLAUDE), ("max_tokens errado", [(r"max_tokens=1024", "max_tokens=9")])],
    "ato4-llm-t3-03": [("modelo errado", MOCK_4)],
    "ato4-estruturada-t2-03": [
        ("tool só com o nome", {
            "pt": [(r"(?s)tools = \[\{.*?\n    \}\]", 'tools = [{"function": {"name": "somar"}}]')],
            "en": [(r"(?s)tools = \[\{.*?\n    \}\]", 'tools = [{"function": {"name": "add"}}]')],
        }),
    ],
    # -------------------------------------------------------- int devolvido como float
    "ato4-chunking-t1-01": [("conta como float", [(r"return len\((.+)\)", r"return float(len(\1))")])],
}

# Da auditoria dos testes ocultos: cada um destes passava em tudo antes de existir
# um dado que o separasse da resposta certa.
_MEDIANA = [("mediana no lugar da média", [(r"\.mean\(\)", ".median()")])]
_SEQUENCIAL = ("await um por vez, sem gather", [(r"await asyncio\.gather\(\*\[(.+?)\]\)", r"[await \1]")])
_NAO_ZERA = ("não recomeça a conta depois de fechar o chunk", [(r"(\[s\]\n)\s+\w+ = t\n", r"\1")])
_LISTA_INDICE = ("lista no lugar da tupla", [(r"return np\.array\((\w+), dtype=float\), (\w+)", r"return [np.array(\1, dtype=float), \2]")])
_SPLIT_ESPACO = ("split(' ') quebra com espaço duplo, tab e linha", [(r"\.split\(\)", ".split(' ')")])
_SEM_ESTAVEL = ("sem kind='stable'", [(r', kind="stable"', "")])
_MATCH = (".match só acha no começo do texto", [(r"re\.search\(", "re.match(")])
_STRIP_ESPACO = ("strip(' ') deixa tab e quebra de linha", [(r"\.strip\(\)", ".strip(' ')")])
_LIMITE_PAGINAS = [
    ("uma página a menos que o limite", [(r"range\((\w+)\)", r"range(\1 - 1)")]),
    ("uma página a mais que o limite", [(r"range\((\w+)\)", r"range(\1 + 1)")]),
    ("teto padrão de 9 páginas", [(r"=10\)", "=9)")]),
    ("teto padrão de 11 páginas", [(r"=10\)", "=11)")]),
]


def _largo(excecao, nome="except Exception pega o que não devia"):
    return (nome, [(r"except " + excecao, "except Exception")])


_ASSISTANT = ("recusa o papel assistant", [(r'"assistant"', '"assistantX"')])
_BASE_400 = [
    (f"except da classe base {b} repete o erro 400", [(r"from openai import RateLimitError", f"from openai import {b} as RateLimitError")])
    for b in ("APIError", "APIStatusError", "OpenAIError")
]
_TODO_5XX = ("repete em todo 5xx", [(r"if resp\.status_code != 500:", "if resp.status_code < 500:")])
_TODO_5XX_E_429 = ("repete em todo 5xx", [(r"if resp\.status_code not in \(429, 500\):",
                                           "if resp.status_code != 429 and resp.status_code < 500:")])

_MAIS = {
    # média de verdade: até 2 valores por grupo, média e mediana dão o mesmo
    "ato3-pandas-t3-01": _MEDIANA,
    "ato3-boss3-t1-03": _MEDIANA,
    "ato3-boss3-t2-03": _MEDIANA,
    "ato3-boss3-t3-03": _MEDIANA,
    # paralelo de verdade
    "ato3-assincrono-t2-01": [("await um por vez, sem gather",
                               [(r"await asyncio\.gather\((\w+)\(1\), \w+\(2\), \w+\(3\)\)", r"[await \1(1), await \1(2), await \1(3)]")])],
    "ato3-assincrono-t2-02": [_SEQUENCIAL],
    "ato3-assincrono-t2-03": [_SEQUENCIAL],
    "ato3-assincrono-t3-01": [("for com try/except, sem gather", [(
        r"(\w+) = await asyncio\.gather\(\s*\*\[(\w+)\((\w+)\) for (\w+) in (\w+)\], return_exceptions=True\s*\)",
        r"\1 = []\n    for \4 in \5:\n        try:\n            \1.append(await \2(\3))\n        except Exception as e:\n            \1.append(e)",
    )])],
    "ato3-boss3-t2-01": [_SEQUENCIAL],
    "ato4-boss5-t3-01": [_SEQUENCIAL, _SPLIT_ESPACO],
    # contas
    "ato3-pandas-t3-02": [("divisão inteira no custo", [(r"/ 1000", "// 1000")])],
    "ato3-numpy-t3-02": [("cosseno sem a norma da consulta", [(r"(\w+) \* np\.linalg\.norm\(q\)", r"\1")])],
    # teto de páginas
    "ato3-http-t3-03": _LIMITE_PAGINAS,
    "ato3-boss3-t3-01": _LIMITE_PAGINAS + [
        ("sem o RuntimeError do limite", [(r'\n    raise RuntimeError\(f"(?:limite|hit the limit)[^\n]*', "\n    return None")]),
    ],
    # chunks
    "ato4-chunking-t2-04": [_NAO_ZERA],
    "ato4-chunking-t3-03": [_NAO_ZERA],
    "ato4-chunking-t3-02": [_SPLIT_ESPACO],
    "ato4-boss4-t3-02": [
        ("linhas da matriz desalinhadas dos metadados", [(r"(\w+)\.append\(v\)", r"\1.insert(0, v)")]),
        ("cosseno igual ao limiar descartado", [(r"\) > (\w+):", r") >= \1:")]),
    ],
    # retry só em rate limit
    "ato4-llm-t3-01": [("retry em qualquer erro", [(r"except RateLimitError as", "except Exception as")])] + _BASE_400,
    "ato4-boss5-t3-02": [
        ("retry em qualquer erro", [(r'type\(e\)\.__name__ == "RateLimitError" and ', "")]),
        ("resposta em minúsculas", [(r"return resp\.choices\[0\]\.message\.content", "return resp.choices[0].message.content.lower()")]),
        ("uma chamada a menos que max_tentativas", [(r"(\w+ < \w+) - 1:", r"\1 - 2:")]),
        ("uma chamada a mais que max_tentativas", [(r"range\((\w+)\)", r"range(\1 + 1)"), (r"(\w+ < \w+) - 1:", r"\1:")]),
    ],
    # exceção certa: outra exceção precisa propagar
    "ato2-excecoes-t1-01": [_largo("ValueError")],
    "ato2-excecoes-t1-02": [_largo("KeyError")],
    "ato2-excecoes-t1-05": [_largo("ZeroDivisionError")],
    "ato2-excecoes-t2-02": [_largo("ValueError")],
    "ato2-arquivos-t3-01": [_largo("FileNotFoundError")],
    "ato4-estruturada-t3-01": [_largo("ValueError")],
    "ato2-boss2-t1-02": [_largo(r"json\.JSONDecodeError")],
    "ato2-boss2-t2-02": [_largo(r"json\.JSONDecodeError")],
    "ato2-boss2-t3-02": [_largo(r"json\.JSONDecodeError")],
    # empates
    "ato3-numpy-t3-03": [_SEM_ESTAVEL],
    "ato4-embeddings-t3-02": [_SEM_ESTAVEL],
    "ato4-boss4-t1-03": [_SEM_ESTAVEL],
    # papéis válidos
    "ato2-comprehensions-t2-04": [
        _ASSISTANT,
        ("strip(' ') deixa passar tab e quebra de linha", [(r'\["content"\]\.strip\(\)', '["content"].strip(" ")')]),
    ],
    "ato4-llm-t3-03": [_ASSISTANT],
    # total de páginas lido da resposta
    "ato3-http-t2-01": [("3 páginas fixas no código", {
        "pt": [(r"(?s)    nomes = \[\].*", "    nomes = []\n    for p in (1, 2, 3):\n        corpo = requests.get('https://api.dojo.dev/usuarios', params={'pagina': p}).json()\n        for u in corpo['dados']:\n            nomes.append(u['nome'])\n    return nomes\n")],
        "en": [(r"(?s)    names = \[\].*", "    names = []\n    for p in (1, 2, 3):\n        body = requests.get('https://api.dojo.dev/users', params={'page': p}).json()\n        for u in body['data']:\n            names.append(u['name'])\n    return names\n")],
    })],
    # tupla pedida no enunciado
    "ato4-llm-t2-01": [("lista no lugar da tupla", [(r"return (\w+), (\w+)\s*$", r"return [\1, \2]")])],
    "ato4-boss4-t1-02": [_LISTA_INDICE],
    "ato4-boss4-t2-02": [_LISTA_INDICE],
    "ato4-boss5-t1-01": [_LISTA_INDICE, _SPLIT_ESPACO],
    "ato4-embeddings-t2-02": [("lista no lugar da tupla", [(r"return (\w+), list\((\w+)\)", r"return [\1, list(\2)]")])],
    # palavras separadas por qualquer espaço em branco
    "ato1-boss1-t1-02": [_SPLIT_ESPACO],
    "ato1-boss1-t2-01": [_SPLIT_ESPACO],
    "ato1-boss1-t3-01": [_SPLIT_ESPACO],
    "ato4-boss4-t1-01": [_SPLIT_ESPACO],
    "ato4-boss4-t2-01": [_SPLIT_ESPACO],
    "ato4-boss5-t2-01": [_SPLIT_ESPACO],
    # regex
    "ato2-regex-t3-02": [("um dígito só antes do ponto", [(r"\\d\+\\\.", r"\\d\\.")])],
    "ato2-regex-t1-05": [("\\w* casa mock- sozinho", [(r"\\w\+", r"\\w*")])],
    "ato2-regex-t2-01": [("\\d* casa nota vazia", [(r"\\d\+", r"\\d*")])],
    "ato2-regex-t2-02": [
        ("\\w* aceita chave vazia", [(r"\(\\w\+\)", r"(\\w*)")]),
        ("\\S* aceita valor vazio", [(r"\(\\S\+\)", r"(\\S*)")]),
    ],
    "ato2-regex-t2-04": [("\\w* casa veredito vazio", [(r"\(\\w\+\)", r"(\\w*)")])],
    "ato4-boss5-t2-03": [_MATCH],
    "ato4-boss5-t3-03": [_MATCH],
    "ato4-estruturada-t3-03": [_MATCH],
    # strip sem argumento
    "ato2-comprehensions-t2-01": [("strip(' ') deixa tab e quebra de linha", [(r"p\.strip\(\)\.lower", "p.strip(' ').lower")])],
    "ato1-texto-t3-03": [_STRIP_ESPACO],
    "ato2-excecoes-t2-01": [_STRIP_ESPACO],
    # fronteira
    "ato2-classes-t3-02": [("max_tokens = 1 é recusado", [(r"self\.max_tokens <= 0", "self.max_tokens <= 1")])],
    # a stopword é pulada, não encerra o prompt
    "ato1-boss1-t3-02": [("break na stopword larga o resto do prompt", [(r"(if \w+ in stop:\n\s+)continue", r"\1break")])],
    # o exemplo mostra array([2., 4., 6.])
    "ato3-numpy-t1-02": [("array de int, não de float", [(r", dtype=float", "")])],
    # retry: só o 500 (e o 429, onde o enunciado diz) volta; 503 e companhia retornam na hora
    "ato3-resiliencia-t1-01": [_TODO_5XX],
    "ato3-resiliencia-t1-02": [_TODO_5XX],
    "ato3-resiliencia-t1-03": [("repete em todo 5xx", [(r"while resp\.status_code == 500", "while resp.status_code >= 500")])],
    "ato3-resiliencia-t1-04": [("todo 5xx é recuperável", [(r"return status in \(429, 500\)", "return status == 429 or status >= 500")])],
    "ato3-resiliencia-t1-05": [_TODO_5XX],
    "ato3-resiliencia-t2-01": [_TODO_5XX],
    "ato3-resiliencia-t2-03": [_TODO_5XX],
    "ato3-resiliencia-t2-04": [
        _TODO_5XX_E_429,
        ("429 dorme o maior entre Retry-After e o backoff", [(
            r'time\.sleep\(int\(resp\.headers\["Retry-After"\]\)\)(\n\s+else:\n\s+time\.sleep\((base \* \(2 \*\* \w+\))\))',
            r'time.sleep(max(int(resp.headers["Retry-After"]), \2))\1',
        )]),
    ],
    "ato3-resiliencia-t3-01": [_TODO_5XX_E_429],
    "ato3-resiliencia-t3-03": [
        _TODO_5XX_E_429,
        ("429 dorme o maior entre Retry-After e a fórmula", [(
            r"(\n(\s+)(\w+) = base \* \(2 \*\* (\w+)\) \+ 0\.1 \* \4)",
            r'\1\n\2if resp.status_code == 429:\n\2    \3 = max(\3, int(resp.headers["Retry-After"]))',
        )]),
    ],
}
# Sem entrada de except largo: ato2-arquivos-t3-03, ato2-boss2-t3-01 e ato3-http-t3-01.
# O try só envolve json.loads (ou resp.json) de um texto, e dali só sai erro de JSON.
# Nenhum dado do exercício separa os dois: o mutante é equivalente, e o único caso
# que os distingue, recursão funda, faz o except largo se sair melhor.
for _id, _novos in _MAIS.items():
    MUTANTES[_id] = list(MUTANTES.get(_id, ())) + _novos

_NORMA = "(np.linalg.norm(embed(t)) * np.linalg.norm(q))"
BLOCOS = [(r'"content": ([^}\n]+)\}', r'"content": [{"type": "text", "text": \1}]}')]
SEM_APELIDO_PD = [(r"import pandas as pd", "import pandas"), (r"\bpd\.", "pandas.")]
SEM_APELIDO_NP = [(r"import numpy as np", "import numpy"), (r"\bnp\.", "numpy.")]
RETRY_AFTER_MINUSCULO = [(r'"Retry-After"', '"retry-after"')]

ALTERNATIVAS = {
    # API real que o mock precisa cobrir
    "ato3-http-t2-01": [
        ("requests.Session().get", [(r"requests\.get\(", "requests.Session().get(")]),
        ("requests.request('GET', ...)", [(r"requests\.get\(", "requests.request('GET', ")]),
        ("com timeout e verify", [(r'\)\n(\s+)(\w+) = resp\.json\(\)', r', timeout=5, verify=True)\n\1\2 = resp.json()')]),
    ],
    "ato4-llm-t3-01": [
        ("importa os nomes reais do SDK", [(r"from openai import RateLimitError",
                                            "from openai import RateLimitError, APIError, APIStatusError, OpenAIError, APIConnectionError")]),
        ("retenta também a queda de conexão", [(r"except RateLimitError as", "except (RateLimitError, __import__('openai').APIConnectionError) as")]),
    ],
    # os testes novos não podem exigir um único jeito de escrever
    "ato4-boss5-t3-02": [("ranking com sorted", [(TOPK, r"\1 = sorted(range(len(\2)), key=lambda j: -\2[j])")])],
    "ato4-boss5-t3-03": [
        ("type(n) is int no lugar do filtro de bool",
         [(r"if isinstance\(n, bool\):\n\s*continue\n\s*if isinstance\(n, int\) and", "if type(n) is int and")]),
    ],
    "ato3-numpy-t3-03": [
        ("ranking com sorted", [(r'\w+ = np\.argsort\(.*\n\s*return \[int\(i\) for i in \w+\[:k\]\]',
                                 "return sorted(range(len(scores)), key=lambda j: -scores[j])[:k]")]),
    ],
    "ato4-embeddings-t3-01": [
        ("cosseno dividindo pelas normas", [(r"float\(np\.dot\(embed\(t\), q\)\)", "float(np.dot(embed(t), q) / " + _NORMA + ")")]),
    ],
    "ato4-embeddings-t3-03": [
        ("cosseno dividindo pelas normas", [
            (r"float\(np\.dot\(embed\(t\), q\)\)", "float(np.dot(embed(t), q) / " + _NORMA + ")"),
            (r"float\(np\.dot\(v, embed\((\w+)\)\)\)", r"float(np.dot(v, embed(\1)) / (np.linalg.norm(v) * np.linalg.norm(embed(\1))))"),
        ]),
    ],
    "ato3-pandas-t2-02": [("subclasse de list", [(r"return \((.+)\)\.tolist\(\)", "class L(list):\n        pass\n    return L((\\1).tolist())")])],
    # content em blocos: o formato real das duas APIs, com o texto igual
    "ato4-llm-t1-01": [("argumentos reais a mais", [(r'model="mock-4",', 'model="mock-4", temperature=0.2, top_p=1, seed=1,')]),
                       ("content em blocos", BLOCOS),
                       ("client.with_options(...)", [(r"client\.chat", "client.with_options(timeout=5, max_retries=0).chat")])],
    "ato4-llm-t2-03": [("content em blocos", BLOCOS)],
    "ato4-boss5-t2-02": [("ranking com sorted", [(TOPK, r"\1 = sorted(range(len(\2)), key=lambda j: -\2[j])")]),
                         ("content em blocos", BLOCOS)],
    # import de outro jeito: os testes não podem depender do nome que o aluno escolheu
    "ato3-pandas-t1-01": [("import pandas, sem o apelido", SEM_APELIDO_PD)],
    "ato3-numpy-t1-02": [("import numpy, sem o apelido", SEM_APELIDO_NP)],
    "ato4-boss4-t1-03": [("import numpy, sem o apelido", SEM_APELIDO_NP)],
    "ato4-boss5-t1-02": [("ranking com sorted", [(TOPK, r"\1 = sorted(range(len(\2)), key=lambda j: -\2[j])")]),
                         ("import openai, sem o from", [(r"from openai import OpenAI", "import openai"), (r"\bOpenAI\(\)", "openai.OpenAI()")])],
    # cabeçalho HTTP não diferencia maiúsculas no requests real
    "ato3-resiliencia-t2-02": [("headers em minúsculas", RETRY_AFTER_MINUSCULO)],
    "ato3-resiliencia-t2-04": [("headers em minúsculas", RETRY_AFTER_MINUSCULO)],
    "ato3-boss3-t2-02": [("headers em minúsculas", RETRY_AFTER_MINUSCULO)],
    "ato3-boss3-t3-01": [("headers em minúsculas", RETRY_AFTER_MINUSCULO)],
    "ato3-boss3-t3-02": [("headers em minúsculas", RETRY_AFTER_MINUSCULO)],
    "ato4-boss4-t1-02": [("data[0].model_dump()", [(r"resp\.data\[0\]\.embedding", 'resp.data[0].model_dump()["embedding"]')])],
    # paralelo de outro jeito: quem dispara junto continua aprovado
    "ato3-assincrono-t2-02": [
        ("create_task + await em ordem", [(r"await asyncio\.gather\(\*\[(\w+\(\w+\)) for (\w+) in (\w+)\]\)", r"[await t for t in [asyncio.ensure_future(\1) for \2 in \3]]")]),
    ],
}

_TASKGROUP = ("TaskGroup no lugar de gather", [(
    r"(\w+) = await asyncio\.gather\(\*\[(.+?)( for .+?)\]\)",
    r"async with asyncio.TaskGroup() as tg:\n        _ts = [tg.create_task(\2)\3]\n    \1 = [t.result() for t in _ts]",
)])
_WHILE_PAGINAS = ("while com contador no lugar de range", [(
    r"for _ in range\((\w+)\):", r"_lidas = 0\n    while _lidas < \1:\n        _lidas += 1",
)])
_AGG_MEDIA = ("agg('mean') no lugar de .mean()", [(r"\.mean\(\)", '.agg("mean")')])
_MERGESORT = ("kind='mergesort' também é estável", [(r'kind="stable"', 'kind="mergesort"')])

_ALT_MAIS = {
    "ato3-boss3-t2-01": [_TASKGROUP],
    "ato4-boss5-t3-01": [_TASKGROUP],
    "ato3-http-t3-03": [_WHILE_PAGINAS],
    "ato3-boss3-t3-01": [_WHILE_PAGINAS],
    "ato3-pandas-t3-01": [_AGG_MEDIA],
    "ato3-boss3-t1-03": [_AGG_MEDIA],
    "ato3-boss3-t2-03": [_AGG_MEDIA],
    "ato3-boss3-t3-03": [_AGG_MEDIA],
    "ato3-numpy-t3-02": [("norma da consulta com sqrt", [(r"np\.linalg\.norm\(q\)", "np.sqrt(np.dot(q, q))")])],
    "ato3-numpy-t3-03": [_MERGESORT],
    "ato4-embeddings-t3-02": [_MERGESORT],
    "ato4-boss4-t1-03": [_MERGESORT],
    "ato2-regex-t3-02": [("[0-9]+ no lugar de \\d+", [(r"\\d\+\\\.", r"[0-9]+\\.")])],
    "ato4-estruturada-t3-01": [("client.with_options(...)", [(r"(\w+)\.chat\.completions\.create\(", r"\1.with_options(timeout=5).chat.completions.create(")])],
    "ato3-numpy-t1-02": [("asarray com float64", [(r"np\.array\((\w), dtype=float\)", r"np.asarray(\1, dtype=np.float64)")])],
}
for _id, _novos in _ALT_MAIS.items():
    ALTERNATIVAS[_id] = list(ALTERNATIVAS.get(_id, ())) + _novos

# (obtido, esperado, igual?) — a comparação do runner, sem depender de exercício.
COMPARACAO = [
    (3, 3, True),
    (3.0, 3, False),
    (3, 3.0, True),
    (1000001, 1000000, False),
    (999999, 1000000, False),
    (1.0000001, 1.0, True),
    (1.01, 1.0, False),
    (True, 1, False),
    (1, True, False),
    ([1.0], [1], False),
    ({"a": 1.0}, {"a": 1}, False),
    ((1, 2.5), (1, 2.5), True),
    ([1, 2], (1, 2), False),
    ("a", "a", True),
    (None, None, True),
    (0, None, False),
]
