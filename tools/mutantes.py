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

_NORMA = "(np.linalg.norm(embed(t)) * np.linalg.norm(q))"

ALTERNATIVAS = {
    # API real que o mock precisa cobrir
    "ato3-http-t2-01": [
        ("requests.Session().get", [(r"requests\.get\(", "requests.Session().get(")]),
        ("requests.request('GET', ...)", [(r"requests\.get\(", "requests.request('GET', ")]),
        ("com timeout e verify", [(r'\)\n(\s+)(\w+) = resp\.json\(\)', r', timeout=5, verify=True)\n\1\2 = resp.json()')]),
    ],
    "ato4-llm-t3-01": [
        ("except da classe base APIError", [(r"from openai import RateLimitError", "from openai import APIError as RateLimitError")]),
        ("except da classe base APIStatusError", [(r"from openai import RateLimitError", "from openai import APIStatusError as RateLimitError")]),
        ("except da classe base OpenAIError", [(r"from openai import RateLimitError", "from openai import OpenAIError as RateLimitError")]),
    ],
    "ato4-llm-t1-01": [("argumentos reais a mais", [(r'model="mock-4",', 'model="mock-4", temperature=0.2, top_p=1, seed=1,')])],
    # os testes novos não podem exigir um único jeito de escrever
    "ato4-boss5-t1-02": [("ranking com sorted", [(TOPK, r"\1 = sorted(range(len(\2)), key=lambda j: -\2[j])")])],
    "ato4-boss5-t2-02": [("ranking com sorted", [(TOPK, r"\1 = sorted(range(len(\2)), key=lambda j: -\2[j])")])],
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
}

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
