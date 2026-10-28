# -*- coding: utf-8 -*-
"""Mocks determinísticos de IA do Python AI Dojo — fonte ÚNICA.

Este arquivo roda IGUAL no Pyodide (navegador) e no tools/verify.py (CPython).
Regras inegociáveis:
  - Python puro: nenhum `import js`, nenhum `pyodide`.
  - Determinismo absoluto: proibido `hash()` builtin, `random` sem seed e
    relógio real — só `hashlib` e o relógio VIRTUAL deste módulo.

API pública (usada pelo runner e pelos testes via `_mocks`):
  instalar(nomes)            -- registra módulos fake em sys.modules
                                (nomes ⊆ {"requests", "openai", "anthropic"})
  desinstalar()              -- remove/restaura sys.modules
  instalar_relogio()         -- patcheia time.sleep/monotonic/time/perf_counter
                                para o relógio virtual (o runner SEMPRE chama)
  desinstalar_relogio()      -- restaura o módulo time
  reset_estado()             -- zera relógio, roteiros e histórico (entre testes)
  relogio() -> float         -- segundos virtuais decorridos
  avancar_relogio(s)         -- avança o relógio virtual
  historico_http             -- lista de chamadas HTTP feitas (dicts)
  roteirizar_falhas(caminho, respostas, retry_after=1)
                             -- força status por chamada numa rota; cada item é
                                um status int (429/500/401/400...), 200 = passa
                                normal, ou "loop" (/modelos devolve a MESMA
                                página com o MESMO cursor — testa anti-loop)
  roteirizar_erros_llm(eventos)
                             -- eventos por chamada de LLM: None = normal,
                                "rate_limit" = levanta RateLimitError,
                                "args_invalidos" = tool_call com JSON quebrado,
                                "multi_blocos" = resposta Anthropic em 2 blocos,
                                "vetor_zero" = embeddings.create devolve vetor
                                de norma zero (testa cosseno blindado)
                                (aliases en: "invalid_args", "multi_block",
                                "zero_vector")
  embed_texto(texto, dim=16) -- embedding determinístico (mesmo dos clientes)
  definir_idioma(lang)       -- "pt" (padrão) | "en": idioma das ROTAS, CAMPOS,
                                DADOS e MENSAGENS dos mocks (o runner chama a
                                partir de payload["lang"]). As tabelas abaixo são
                                as do "pt"; as do "en" estão em _IDIOMAS["en"]
                                (rotas /users /products /secret /error500
                                /models, campos error/data/page/name/price...,
                                LLM em inglês, tools add/weather/search_docs).
                                A API pública (_mocks.*, chaves de
                                historico_http) é a MESMA nos dois idiomas;
                                o en ganha ALIASES: http_history, clock,
                                advance_clock, script_failures,
                                script_llm_errors, embed_text, client.calls,
                                os eventos invalid_args/multi_block/zero_vector e, nos
                                registros http, method/path/clock.

=====================================================================
TABELA DE ROTAS DO `requests` FAKE (exercícios SÓ usam estas rotas)
=====================================================================
GET  https://api.dojo.dev/status            -> 200 {"status": "ok"}
GET  https://api.dojo.dev/usuarios?pagina=N -> 200 paginado:
       pág 1: Ana(dados), Bruno(infra) · pág 2: Carla(dados), Davi(ml)
       pág 3: Elisa(infra); total_paginas: 3; N>3 -> {"dados": [], ...};
       N<1 ou não-numérico -> 400; sem `pagina` -> assume 1
GET  https://api.dojo.dev/produtos/<id>     -> id 1-3 -> 200 (nome, preco);
       outro -> 404 {"erro": "produto não encontrado"}
GET  https://api.dojo.dev/segredo           -> exige header
       Authorization: Bearer tk_dojo_001 -> 200 {"segredo": "o dojo é o caminho"};
       sem/errado -> 401 {"erro": "não autorizado"}
GET  https://api.dojo.dev/erro500           -> 500, corpo "erro interno" (NÃO-JSON)
GET  https://api.dojo.dev/timeout           -> levanta requests.exceptions.Timeout
POST https://api.dojo.dev/echo              -> 200 {"recebido": <json>, "metodo": "POST"}
POST https://api.dojo.dev/login             -> json {"usuario","senha"};
       senha "dojo123" -> 200 {"token": "tk_dojo_001"}; senão 401
GET  https://api.dojo.dev/modelos?cursor=C  -> paginado por cursor:
       sem cursor -> m1 mock-4-mini(mock-4, 0.15), m2 mock-4(mock-4, 2.5),
                     proximo_cursor "c2"
       c2 -> m3 mock-claude-haiku(mock-claude, 0.25), m4 mock-claude(mock-claude, 3.0),
             proximo_cursor "c3"
       c3 -> m5 mock-embed(embed, 0.02), proximo_cursor null
       cursor inválido -> 400
qualquer outro host -> requests.exceptions.ConnectionError
Versões async: `await requests.aget(...)` / `await requests.apost(...)`.
Status forçados por roteirizar_falhas: 429 tem header Retry-After; 500 tem
corpo NÃO-JSON "erro interno"; 401/400 têm corpo JSON {"erro": ...}.

=====================================================================
TABELA DE RESPOSTAS DO LLM MOCK (_responder) — exercícios SÓ usam estas
=====================================================================
(última mensagem `user`, casefold)
  contém "capital do brasil"      -> "Brasília"
  contém "capital da frança"      -> "Paris"
  contém "2 + 2" ou "2+2"         -> "4"
  palavra "olá"/"ola"/"oi"        -> "Olá! Como posso ajudar?"
  contém "python"                 -> "Python é uma linguagem de programação."
  senão                           -> "Você disse: {texto original}"
Efeito do system (NÃO se aplica no modo RAG):
  contém "pirata"                 -> prefixo "Arrr! "
  contém "maiúsculas"/"maiusculas"-> resposta em .upper()
Truncamento: tokens ≈ PALAVRAS no mock; se a resposta tem mais palavras que
max_tokens -> corta e finish_reason="length" / stop_reason="max_tokens".
Modo RAG: se a mensagem contém "[1]" E "pergunta:" (casefold), o mock extrai
os contextos numerados `[n] texto` e a pergunta após "pergunta:", pontua cada
contexto por sobreposição de palavras (sem stopwords) e devolve SEMPRE:
  ```json
  {"resposta": <resposta>, "fontes": [n1, n2, ...]}
  ```
fontes = até 3 contextos com sobreposição > 0, ordenados por (-score, n);
sem contexto relevante -> {"resposta": "não sei", "fontes": []}.
resposta = tabela de palavras-chave sobre a pergunta, senão as 12 primeiras
palavras do melhor contexto.
Continuação de ferramenta: se a última mensagem tem role "tool", responde
"O resultado é {conteúdo}."

=====================================================================
TABELA DE FERRAMENTAS (tool_calls) — com `tools=`, última mensagem user:
=====================================================================
  todo padrão "some A e B" / "some A com B" / "A + B" (inteiros), havendo
    tool "somar"        -> tool_call somar {"a": A, "b": B} (um por padrão)
  "clima em <cidade>", havendo tool "clima"
                        -> tool_call clima {"cidade": "<Cidade>"}
  "busque sobre X" / "busca sobre X", havendo tool "buscar_docs"
                        -> tool_call buscar_docs {"consulta": "X"}
  sem padrão casando    -> resposta de texto normal (sem tool_call)
message.content = None e finish_reason = "tool_calls" quando há tool_calls.
"""
from __future__ import annotations

import asyncio
import copy
import hashlib
import json as _json
import math
import re
import sys
import time as _time_mod
import types
from urllib.parse import parse_qsl, quote, urlencode, urlsplit

# ---------------------------------------------------------------------------
# Relógio virtual
# ---------------------------------------------------------------------------
_relogio_virtual = 0.0
_BASE_TIME = 1735689600.0      # 2025-01-01T00:00:00Z, fixo
_BASE_MONOTONIC = 1000.0
_relogio_originais: dict[str, object] = {}

historico_http: list[dict] = []
_roteiros: dict[str, list] = {}
_retry_after: dict[str, int] = {}
_erros_llm: list = []

# ---------------------------------------------------------------------------
# Idioma dos mocks. "pt" reproduz byte a byte o comportamento monolíngue.
# ---------------------------------------------------------------------------
IDIOMA = "pt"

_IDIOMAS = {
    "pt": {
        # rotas e parâmetros
        "r_status": "/status", "r_usuarios": "/usuarios", "r_produtos": "/produtos/",
        "r_segredo": "/segredo", "r_erro500": "/erro500", "r_timeout": "/timeout",
        "r_echo": "/echo", "r_login": "/login", "r_modelos": "/modelos",
        "p_pagina": "pagina",
        # campos
        "f_erro": "erro", "f_dados": "dados", "f_pagina": "pagina",
        "f_total_paginas": "total_paginas", "f_segredo": "segredo",
        "f_recebido": "recebido", "f_metodo": "metodo", "f_senha": "senha",
        "f_modelos": "modelos", "f_proximo_cursor": "proximo_cursor",
        "f_resposta": "resposta", "f_fontes": "fontes",
        # valores
        "v_rate_limit": "rate limit excedido", "v_erro_interno": "erro interno",
        "v_nao_autorizado": "não autorizado", "v_requisicao_invalida": "requisição inválida",
        "v_erro_status": "erro {status}", "v_cursor_invalido": "cursor inválido",
        "v_pagina_invalida": "página inválida", "v_produto_404": "produto não encontrado",
        "v_segredo": "o dojo é o caminho", "v_credenciais": "credenciais inválidas",
        "v_rota_404": "rota não encontrada",
        # mensagens de exceção
        "e_conexao": ("Não foi possível conectar a {host} — "
                      "no Dojo, só a API mockada https://api.dojo.dev existe."),
        "e_timeout": "A requisição excedeu o tempo limite (mock).",
        "e_json": "O corpo da resposta não é JSON válido: {trecho}",
        "e_http": "{status} Erro para a url: {url}",
        "e_rate_limit": "Erro 429: limite de requisições excedido (mock). Tente de novo.",
        # LLM
        "llm_capital_br": "capital do brasil", "llm_capital_fr": "capital da frança",
        "llm_saudacoes": {"olá", "ola", "oi"}, "llm_ola": "Olá! Como posso ajudar?",
        "llm_python": "Python é uma linguagem de programação.",
        "llm_disse": "Você disse: {texto}", "llm_resultado": "O resultado é {conteudo}.",
        "llm_pirata": ("pirata",), "llm_maiusculas": ("maiúsculas", "maiusculas"),
        "rag_pergunta": "pergunta:", "rag_nao_sei": "não sei",
        # tools
        "t_somar": "somar", "t_somar_re": r"some\s+(-?\d+)\s+(?:e|com)\s+(-?\d+)",
        "t_clima": "clima", "t_clima_re": r"clima em ([\wà-ú]+)", "t_clima_arg": "cidade",
        "t_buscar": "buscar_docs", "t_buscar_re": r"busq?u?e?a?\s+sobre\s+(.+)",
        "t_buscar_arg": "consulta",
    },
    "en": {
        "r_status": "/status", "r_usuarios": "/users", "r_produtos": "/products/",
        "r_segredo": "/secret", "r_erro500": "/error500", "r_timeout": "/timeout",
        "r_echo": "/echo", "r_login": "/login", "r_modelos": "/models",
        "p_pagina": "page",
        "f_erro": "error", "f_dados": "data", "f_pagina": "page",
        "f_total_paginas": "total_pages", "f_segredo": "secret",
        "f_recebido": "received", "f_metodo": "method", "f_senha": "password",
        "f_modelos": "models", "f_proximo_cursor": "next_cursor",
        "f_resposta": "answer", "f_fontes": "sources",
        "v_rate_limit": "rate limit exceeded", "v_erro_interno": "internal error",
        "v_nao_autorizado": "unauthorized", "v_requisicao_invalida": "bad request",
        "v_erro_status": "error {status}", "v_cursor_invalido": "invalid cursor",
        "v_pagina_invalida": "invalid page", "v_produto_404": "product not found",
        "v_segredo": "the dojo is the way", "v_credenciais": "invalid credentials",
        "v_rota_404": "route not found",
        "e_conexao": ("Couldn't connect to {host} — "
                      "in the Dojo, only the mocked API https://api.dojo.dev exists."),
        "e_timeout": "The request exceeded the time limit (mock).",
        "e_json": "The response body is not valid JSON: {trecho}",
        "e_http": "{status} Error for url: {url}",
        "e_rate_limit": "Error 429: request limit exceeded (mock). Try again.",
        "llm_capital_br": "capital of brazil", "llm_capital_fr": "capital of france",
        "llm_saudacoes": {"hello", "hi", "hey"}, "llm_ola": "Hello! How can I help?",
        "llm_python": "Python is a programming language.",
        "llm_disse": "You said: {texto}", "llm_resultado": "The result is {conteudo}.",
        "llm_pirata": ("pirate",), "llm_maiusculas": ("uppercase", "all caps"),
        "rag_pergunta": "question:", "rag_nao_sei": "I don't know",
        "t_somar": "add", "t_somar_re": r"add\s+(-?\d+)\s+(?:and|to)\s+(-?\d+)",
        "t_clima": "weather", "t_clima_re": r"weather in ([\wà-ú]+)", "t_clima_arg": "city",
        "t_buscar": "search_docs", "t_buscar_re": r"search\s+(?:for|about)\s+(.+)",
        "t_buscar_arg": "query",
    },
}


def definir_idioma(lang: str) -> None:
    """Idioma dos mocks: "pt" (padrão) ou "en". Desconhecido -> "pt"."""
    global IDIOMA
    IDIOMA = lang if lang in _IDIOMAS else "pt"


def _L(chave: str):
    return _IDIOMAS[IDIOMA][chave]


def relogio() -> float:
    """Segundos VIRTUAIS decorridos desde o início da execução."""
    return _relogio_virtual


def avancar_relogio(segundos: float) -> None:
    global _relogio_virtual
    if segundos > 0:
        _relogio_virtual += float(segundos)


def _sleep_virtual(segundos):
    if segundos < 0:
        raise ValueError("sleep length must be non-negative")
    avancar_relogio(segundos)


def _monotonic_virtual():
    return _BASE_MONOTONIC + _relogio_virtual


def _time_virtual():
    return _BASE_TIME + _relogio_virtual


def instalar_relogio() -> None:
    """Patcheia time.sleep/monotonic/time/perf_counter para o relógio virtual."""
    if _relogio_originais:
        return
    _relogio_originais["sleep"] = _time_mod.sleep
    _relogio_originais["monotonic"] = _time_mod.monotonic
    _relogio_originais["time"] = _time_mod.time
    _relogio_originais["perf_counter"] = _time_mod.perf_counter
    _time_mod.sleep = _sleep_virtual
    _time_mod.monotonic = _monotonic_virtual
    _time_mod.time = _time_virtual
    _time_mod.perf_counter = _monotonic_virtual


def desinstalar_relogio() -> None:
    if not _relogio_originais:
        return
    _time_mod.sleep = _relogio_originais["sleep"]
    _time_mod.monotonic = _relogio_originais["monotonic"]
    _time_mod.time = _relogio_originais["time"]
    _time_mod.perf_counter = _relogio_originais["perf_counter"]
    _relogio_originais.clear()


def reset_estado() -> None:
    """Zera relógio virtual, roteiros de falha e históricos (entre testes)."""
    global _relogio_virtual, _erros_llm
    _relogio_virtual = 0.0
    _roteiros.clear()
    _retry_after.clear()
    _erros_llm = []
    historico_http.clear()


def roteirizar_falhas(caminho: str, respostas: list, retry_after: int = 1) -> None:
    """Força respostas numa rota, na ordem. 200 = comportamento normal."""
    _roteiros[caminho] = list(respostas)
    _retry_after[caminho] = retry_after


# nomes en dos eventos (conteúdo en) -> nome canônico pt usado internamente
_ALIASES_EVENTOS_LLM = {"invalid_args": "args_invalidos", "multi_block": "multi_blocos",
                        "zero_vector": "vetor_zero"}


def roteirizar_erros_llm(eventos: list) -> None:
    """Roteiriza eventos por chamada de LLM (compartilhado openai/anthropic).

    Aceita os nomes pt ("args_invalidos", "multi_blocos", "vetor_zero") e os
    aliases en ("invalid_args", "multi_block", "zero_vector")."""
    global _erros_llm
    _erros_llm = [_ALIASES_EVENTOS_LLM.get(e, e) if isinstance(e, str) else e
                  for e in eventos]


def _proximo_erro_llm():
    if _erros_llm:
        return _erros_llm.pop(0)
    return None


# ---------------------------------------------------------------------------
# Embeddings determinísticos (bag-of-words hasheado, dim 16, norma L2 = 1.0)
# ---------------------------------------------------------------------------
def embed_texto(texto: str, dim: int = 16) -> list[float]:
    tokens = re.findall(r"\w+", texto.casefold())
    if not tokens:
        return [1.0] + [0.0] * (dim - 1)
    vec = [0.0] * dim
    for t in tokens:
        h = hashlib.sha256(t.encode("utf-8")).digest()
        for i in range(dim):
            vec[i] += (h[i] - 127.5) / 127.5
    n = math.sqrt(sum(x * x for x in vec))
    if n == 0.0:
        return [1.0] + [0.0] * (dim - 1)
    return [x / n for x in vec]


# ---------------------------------------------------------------------------
# Aliases em inglês da API pública (conteúdo en). São os MESMOS objetos:
# http_history É historico_http (reset_estado faz .clear(), nunca reatribui).
# ---------------------------------------------------------------------------
http_history = historico_http
clock = relogio
advance_clock = avancar_relogio
script_failures = roteirizar_falhas
script_llm_errors = roteirizar_erros_llm
embed_text = embed_texto


def _sha8(obj) -> str:
    bruto = _json.dumps(obj, ensure_ascii=False, sort_keys=True, default=str)
    return hashlib.sha1(bruto.encode("utf-8")).hexdigest()[:8]


def _contar_palavras(texto) -> int:
    if not isinstance(texto, str):
        return 0
    return len(texto.split())


# ---------------------------------------------------------------------------
# Cérebro compartilhado dos LLMs mock
# ---------------------------------------------------------------------------
_STOPWORDS = {
    "o", "a", "os", "as", "um", "uma", "uns", "umas", "de", "do", "da", "dos",
    "das", "em", "no", "na", "nos", "nas", "que", "qual", "quais", "como",
    "para", "pra", "por", "com", "e", "ou", "é", "são", "foi", "ser", "se",
    "ao", "à", "às", "aos", "não", "sim", "mais", "menos", "sobre", "entre",
    "este", "esta", "isto", "esse", "essa", "isso", "me", "diga", "responda",
    "pergunta", "resposta", "contexto", "segundo", "base", "seu", "sua", "há",
}


_STOPWORDS_EN = {
    "the", "a", "an", "of", "in", "on", "at", "to", "for", "from", "by", "with",
    "and", "or", "is", "are", "was", "were", "be", "it", "its", "this", "that",
    "these", "those", "what", "which", "who", "how", "do", "does", "did", "not",
    "yes", "more", "less", "about", "between", "me", "tell", "answer", "question",
    "context", "according", "based", "your", "there", "as",
}


def _palavras_conteudo(texto: str) -> set[str]:
    stop = _STOPWORDS_EN if IDIOMA == "en" else _STOPWORDS
    return {p for p in re.findall(r"\w+", texto.casefold()) if p not in stop}


def _resposta_tabela(t: str):
    """Tabela fixa de palavras-chave. t já vem em casefold."""
    if _L("llm_capital_br") in t:
        return "Brasília"
    if _L("llm_capital_fr") in t:
        return "Paris"
    if "2 + 2" in t or "2+2" in t:
        return "4"
    tokens = set(re.findall(r"\w+", t))
    if tokens & _L("llm_saudacoes"):
        return _L("llm_ola")
    if "python" in t:
        return _L("llm_python")
    return None


def _modo_rag(conteudo: str):
    """Se a mensagem tem contextos numerados + 'pergunta:', responde JSON cercado."""
    t = conteudo.casefold()
    marca = _L("rag_pergunta")
    if "[1]" not in conteudo or marca not in t:
        return None
    contextos = {}
    for m in re.finditer(r"^\s*\[(\d+)\]\s*(.+)$", conteudo, re.MULTILINE):
        contextos[int(m.group(1))] = m.group(2).strip()
    pos = t.rfind(marca)
    pergunta = conteudo[pos + len(marca):].strip()
    palavras_pergunta = _palavras_conteudo(pergunta)
    pontuados = []
    for n, texto in contextos.items():
        score = len(palavras_pergunta & _palavras_conteudo(texto))
        if score > 0:
            pontuados.append((-score, n))
    pontuados.sort()
    fontes = [n for _, n in pontuados[:3]]
    if not fontes:
        corpo = {_L("f_resposta"): _L("rag_nao_sei"), _L("f_fontes"): []}
    else:
        resposta = _resposta_tabela(pergunta.casefold())
        if resposta is None:
            melhores = contextos[fontes[0]].split()
            resposta = " ".join(melhores[:12])
        corpo = {_L("f_resposta"): resposta, _L("f_fontes"): fontes}
    return "```json\n" + _json.dumps(corpo, ensure_ascii=False) + "\n```"


def _responder(mensagens: list, system) -> tuple[str, bool]:
    """Resposta determinística. Retorna (texto, truncado_flag=False aqui)."""
    ultima_user = ""
    for m in mensagens:
        if isinstance(m, dict) and m.get("role") == "user" and isinstance(m.get("content"), str):
            ultima_user = m["content"]
    # continuação de ferramenta: a conversa termina num resultado de tool
    if mensagens and isinstance(mensagens[-1], dict) and mensagens[-1].get("role") == "tool":
        return _L("llm_resultado").format(
            conteudo=str(mensagens[-1].get('content', '')).strip()), False

    rag = _modo_rag(ultima_user)
    if rag is not None:
        return rag, False

    t = ultima_user.casefold()
    resposta = _resposta_tabela(t)
    if resposta is None:
        resposta = _L("llm_disse").format(texto=ultima_user)

    s = (system or "").casefold()
    if any(p in s for p in _L("llm_pirata")):
        resposta = "Arrr! " + resposta
    if any(p in s for p in _L("llm_maiusculas")):
        resposta = resposta.upper()
    return resposta, False


def _truncar(texto: str, max_tokens) -> tuple[str, bool]:
    if max_tokens is None:
        return texto, False
    palavras = texto.split()
    if len(palavras) <= max_tokens:
        return texto, False
    return " ".join(palavras[:max_tokens]), True


def _detectar_tool_calls(mensagens: list, tools) -> list | None:
    """Regras determinísticas da tabela de ferramentas. Retorna lista de
    (nome, args_dict) ou None."""
    if not tools:
        return None
    nomes = set()
    for t in tools:
        try:
            nomes.add(t["function"]["name"])
        except (TypeError, KeyError):
            continue
    ultima_user = ""
    for m in mensagens:
        if isinstance(m, dict) and m.get("role") == "user" and isinstance(m.get("content"), str):
            ultima_user = m["content"]
    if mensagens and isinstance(mensagens[-1], dict) and mensagens[-1].get("role") == "tool":
        return None  # segunda rodada: responde texto
    t = ultima_user.casefold()
    chamadas = []
    somar, clima, buscar = _L("t_somar"), _L("t_clima"), _L("t_buscar")
    if somar in nomes:
        for m in re.finditer(_L("t_somar_re"), t):
            chamadas.append((somar, {"a": int(m.group(1)), "b": int(m.group(2))}))
        if not chamadas:
            for m in re.finditer(r"(-?\d+)\s*\+\s*(-?\d+)", t):
                chamadas.append((somar, {"a": int(m.group(1)), "b": int(m.group(2))}))
    if clima in nomes and not chamadas:
        m = re.search(_L("t_clima_re"), t)
        if m:
            chamadas.append((clima, {_L("t_clima_arg"): m.group(1).capitalize()}))
    if buscar in nomes and not chamadas:
        m = re.search(_L("t_buscar_re"), t)
        if m:
            chamadas.append((buscar, {_L("t_buscar_arg"): m.group(1).strip().rstrip("?.!")}))
    return chamadas or None


# ---------------------------------------------------------------------------
# Objetos de resposta com acesso por ponto (fiéis às libs reais)
# ---------------------------------------------------------------------------
class _Obj:
    """Objeto simples com atributos por ponto e repr legível."""

    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)

    def __repr__(self):
        campos = ", ".join(f"{k}={v!r}" for k, v in self.__dict__.items())
        return f"{type(self).__name__}({campos})"

    def __eq__(self, outro):
        return isinstance(outro, _Obj) and self.__dict__ == outro.__dict__


# ---------------------------------------------------------------------------
# Módulo fake `requests`
# ---------------------------------------------------------------------------
_USUARIOS_PAGINAS = {
    1: [{"id": 1, "nome": "Ana", "time": "dados"}, {"id": 2, "nome": "Bruno", "time": "infra"}],
    2: [{"id": 3, "nome": "Carla", "time": "dados"}, {"id": 4, "nome": "Davi", "time": "ml"}],
    3: [{"id": 5, "nome": "Elisa", "time": "infra"}],
}

_PRODUTOS = {
    1: {"id": 1, "nome": "Teclado Mecânico", "preco": 350.0},
    2: {"id": 2, "nome": "Monitor 27 polegadas", "preco": 1450.0},
    3: {"id": 3, "nome": "Webcam HD", "preco": 280.0},
}

# versões em inglês dos dados (mesmos ids, preços e cursores)
_USUARIOS_PAGINAS_EN = {
    1: [{"id": 1, "name": "Ana", "team": "data"}, {"id": 2, "name": "Bruno", "team": "infra"}],
    2: [{"id": 3, "name": "Carla", "team": "data"}, {"id": 4, "name": "Davi", "team": "ml"}],
    3: [{"id": 5, "name": "Elisa", "team": "infra"}],
}

_PRODUTOS_EN = {
    1: {"id": 1, "name": "Mechanical Keyboard", "price": 350.0},
    2: {"id": 2, "name": "27-inch Monitor", "price": 1450.0},
    3: {"id": 3, "name": "HD Webcam", "price": 280.0},
}

_MODELOS_PAGINAS_EN = {
    None: {"models": [
        {"id": "m1", "name": "mock-4-mini", "family": "mock-4", "cost_per_1k": 0.15},
        {"id": "m2", "name": "mock-4", "family": "mock-4", "cost_per_1k": 2.5},
    ], "next_cursor": "c2"},
    "c2": {"models": [
        {"id": "m3", "name": "mock-claude-haiku", "family": "mock-claude", "cost_per_1k": 0.25},
        {"id": "m4", "name": "mock-claude", "family": "mock-claude", "cost_per_1k": 3.0},
    ], "next_cursor": "c3"},
    "c3": {"models": [
        {"id": "m5", "name": "mock-embed", "family": "embed", "cost_per_1k": 0.02},
    ], "next_cursor": None},
}


def _dados(nome):
    """Tabela de dados do idioma atual (pt = as originais)."""
    if IDIOMA == "en":
        return {"usuarios": _USUARIOS_PAGINAS_EN, "produtos": _PRODUTOS_EN,
                "modelos": _MODELOS_PAGINAS_EN}[nome]
    return {"usuarios": _USUARIOS_PAGINAS, "produtos": _PRODUTOS,
            "modelos": _MODELOS_PAGINAS}[nome]


_MODELOS_PAGINAS = {
    None: {"modelos": [
        {"id": "m1", "nome": "mock-4-mini", "familia": "mock-4", "custo_por_1k": 0.15},
        {"id": "m2", "nome": "mock-4", "familia": "mock-4", "custo_por_1k": 2.5},
    ], "proximo_cursor": "c2"},
    "c2": {"modelos": [
        {"id": "m3", "nome": "mock-claude-haiku", "familia": "mock-claude", "custo_por_1k": 0.25},
        {"id": "m4", "nome": "mock-claude", "familia": "mock-claude", "custo_por_1k": 3.0},
    ], "proximo_cursor": "c3"},
    "c3": {"modelos": [
        {"id": "m5", "nome": "mock-embed", "familia": "embed", "custo_por_1k": 0.02},
    ], "proximo_cursor": None},
}


def _fabricar_requests() -> types.ModuleType:
    mod = types.ModuleType("requests")
    exc = types.ModuleType("requests.exceptions")

    class RequestException(IOError):
        pass

    class ConnectionError(RequestException):  # noqa: A001 - fiel à lib real
        pass

    class HTTPError(RequestException):
        def __init__(self, mensagem, response=None):
            super().__init__(mensagem)
            self.response = response

    class Timeout(RequestException):
        pass

    class JSONDecodeError(RequestException, ValueError):
        pass

    exc.RequestException = RequestException
    exc.ConnectionError = ConnectionError
    exc.HTTPError = HTTPError
    exc.Timeout = Timeout
    exc.JSONDecodeError = JSONDecodeError

    class Response:
        def __init__(self, status_code, corpo, url, headers=None):
            self.status_code = status_code
            self.url = url
            self.headers = headers or {}
            if isinstance(corpo, str):
                self.text = corpo
                self._json = None
            else:
                self._json = corpo
                self.text = _json.dumps(corpo, ensure_ascii=False)

        @property
        def ok(self):
            return self.status_code < 400

        def json(self):
            if self._json is not None:
                return self._json
            try:
                return _json.loads(self.text)
            except ValueError:
                raise JSONDecodeError(
                    _L("e_json").format(trecho=repr(self.text[:80]))
                ) from None

        def raise_for_status(self):
            if self.status_code >= 400:
                raise HTTPError(
                    _L("e_http").format(status=self.status_code, url=self.url), response=self
                )

        def __repr__(self):
            return f"<Response [{self.status_code}]>"

    def _montar_url(url, params):
        partes = urlsplit(url)
        query = dict(parse_qsl(partes.query))
        if params:
            for k, v in params.items():
                query[str(k)] = str(v)
        final = f"{partes.scheme}://{partes.netloc}{partes.path}"
        if query:
            final += "?" + urlencode(query, quote_via=quote)
        return final, partes, query

    def _resposta_roteirizada(caminho, url):
        """Consome o roteiro de falhas da rota, se houver. None = seguir normal."""
        roteiro = _roteiros.get(caminho)
        if not roteiro:
            return None
        item = roteiro.pop(0)
        if item == 200 or item is None:
            return None
        if item == "loop":
            return "loop"
        status = int(item)
        if status == 429:
            ra = _retry_after.get(caminho, 1)
            return Response(429, {_L("f_erro"): _L("v_rate_limit")}, url,
                            headers={"Retry-After": str(ra)})
        if status == 500:
            return Response(500, _L("v_erro_interno"), url)
        if status == 401:
            return Response(401, {_L("f_erro"): _L("v_nao_autorizado")}, url)
        if status == 400:
            return Response(400, {_L("f_erro"): _L("v_requisicao_invalida")}, url)
        return Response(status, {_L("f_erro"): _L("v_erro_status").format(status=status)}, url)

    def _rotear(metodo, url, params=None, json_body=None, headers=None):
        url_final, partes, query = _montar_url(url, params)
        caminho = partes.path
        registro = {
            "metodo": metodo, "url": url_final, "caminho": caminho,
            "params": dict(query), "json": json_body, "headers": dict(headers or {}),
            "relogio": relogio(),
        }
        if IDIOMA == "en":
            # chaves em inglês para o conteúdo en (as pt continuam valendo)
            registro.update(method=metodo, path=caminho, clock=registro["relogio"])
        historico_http.append(registro)
        if partes.netloc != "api.dojo.dev":
            raise ConnectionError(_L("e_conexao").format(host=repr(partes.netloc or url)))
        if caminho == _L("r_timeout"):
            raise Timeout(_L("e_timeout"))

        forcada = _resposta_roteirizada(caminho, url_final)
        if forcada == "loop":
            if caminho == _L("r_modelos"):
                cursor = query.get("cursor")
                pagina = _dados("modelos").get(cursor if cursor else None)
                if pagina is None:
                    return Response(400, {_L("f_erro"): _L("v_cursor_invalido")}, url_final)
                corpo = dict(pagina)
                corpo[_L("f_proximo_cursor")] = cursor  # mesma página, mesmo cursor: loop!
                return Response(200, corpo, url_final)
            forcada = None
        if forcada is not None:
            return forcada

        erro = _L("f_erro")
        if metodo == "GET" and caminho == _L("r_status"):
            return Response(200, {"status": "ok"}, url_final)

        if metodo == "GET" and caminho == _L("r_usuarios"):
            bruto = query.get(_L("p_pagina"), "1")
            try:
                n = int(bruto)
            except ValueError:
                return Response(400, {erro: _L("v_pagina_invalida")}, url_final)
            if n < 1:
                return Response(400, {erro: _L("v_pagina_invalida")}, url_final)
            dados = _dados("usuarios").get(n, [])
            return Response(200, {_L("f_dados"): dados, _L("f_pagina"): n,
                                  _L("f_total_paginas"): 3}, url_final)

        if metodo == "GET" and caminho.startswith(_L("r_produtos")):
            bruto = caminho[len(_L("r_produtos")):]
            try:
                pid = int(bruto)
            except ValueError:
                pid = -1
            produto = _dados("produtos").get(pid)
            if produto is None:
                return Response(404, {erro: _L("v_produto_404")}, url_final)
            return Response(200, produto, url_final)

        if metodo == "GET" and caminho == _L("r_segredo"):
            auth = (headers or {}).get("Authorization", "")
            if auth == "Bearer tk_dojo_001":
                return Response(200, {_L("f_segredo"): _L("v_segredo")}, url_final)
            return Response(401, {erro: _L("v_nao_autorizado")}, url_final)

        if metodo == "GET" and caminho == _L("r_erro500"):
            return Response(500, _L("v_erro_interno"), url_final)

        if metodo == "POST" and caminho == _L("r_echo"):
            # deepcopy: devolver o MESMO objeto deixaria `return dados` passar
            # sem nunca ler a resposta (cobertura de json-parse, rodada 2).
            return Response(200, {_L("f_recebido"): copy.deepcopy(json_body),
                                  _L("f_metodo"): "POST"}, url_final)

        if metodo == "POST" and caminho == _L("r_login"):
            corpo = json_body or {}
            if isinstance(corpo, dict) and corpo.get(_L("f_senha")) == "dojo123":
                return Response(200, {"token": "tk_dojo_001"}, url_final)
            return Response(401, {erro: _L("v_credenciais")}, url_final)

        if metodo == "GET" and caminho == _L("r_modelos"):
            cursor = query.get("cursor")
            pagina = _dados("modelos").get(cursor if cursor else None)
            if pagina is None:
                return Response(400, {erro: _L("v_cursor_invalido")}, url_final)
            return Response(200, dict(pagina), url_final)

        return Response(404, {erro: _L("v_rota_404")}, url_final)

    def get(url, params=None, headers=None, timeout=None):
        return _rotear("GET", url, params=params, headers=headers)

    def post(url, json=None, data=None, headers=None, timeout=None):
        corpo = json if json is not None else data
        return _rotear("POST", url, json_body=corpo, headers=headers)

    async def aget(url, params=None, headers=None, timeout=None):
        await asyncio.sleep(0)
        return get(url, params=params, headers=headers, timeout=timeout)

    async def apost(url, json=None, data=None, headers=None, timeout=None):
        await asyncio.sleep(0)
        return post(url, json=json, data=data, headers=headers, timeout=timeout)

    mod.get = get
    mod.post = post
    mod.aget = aget
    mod.apost = apost
    mod.Response = Response
    mod.exceptions = exc
    mod.RequestException = RequestException
    mod.ConnectionError = ConnectionError
    mod.HTTPError = HTTPError
    mod.Timeout = Timeout
    mod.JSONDecodeError = JSONDecodeError
    return mod


# ---------------------------------------------------------------------------
# Módulo fake `openai`
# ---------------------------------------------------------------------------
def _fabricar_openai() -> types.ModuleType:
    mod = types.ModuleType("openai")

    class OpenAIError(Exception):
        pass

    class RateLimitError(OpenAIError):
        pass

    class APIConnectionError(OpenAIError):
        pass

    class BadRequestError(OpenAIError):
        pass

    class _Completions:
        def __init__(self, client):
            self._client = client

        def create(self, *, model, messages, temperature=None, max_tokens=None,
                   tools=None, tool_choice=None, **kwargs):
            registro = {"api": "chat.completions.create", "model": model,
                        "messages": [dict(m) if isinstance(m, dict) else m for m in messages],
                        "temperature": temperature, "max_tokens": max_tokens,
                        "tools": tools, "tool_choice": tool_choice}
            registro.update(kwargs)
            self._client.chamadas.append(registro)

            evento = _proximo_erro_llm()
            if evento == "rate_limit":
                raise RateLimitError(_L("e_rate_limit"))

            prompt_tokens = sum(_contar_palavras(m.get("content")) for m in messages
                                if isinstance(m, dict))
            cid = "chatcmpl-mock-" + _sha8(registro["messages"])

            deteccao = _detectar_tool_calls(messages, tools)
            if deteccao:
                tool_calls = []
                for i, (nome, args) in enumerate(deteccao):
                    args_str = _json.dumps(args, ensure_ascii=False)
                    if evento == "args_invalidos" and i == 0:
                        args_str = args_str[: max(len(args_str) // 2, 1)]
                    tool_calls.append(_Obj(
                        id=f"call-mock-{i + 1}", type="function",
                        function=_Obj(name=nome, arguments=args_str),
                    ))
                mensagem = _Obj(role="assistant", content=None, tool_calls=tool_calls)
                escolha = _Obj(index=0, message=mensagem, finish_reason="tool_calls")
                usage = _Obj(prompt_tokens=prompt_tokens, completion_tokens=0,
                             total_tokens=prompt_tokens)
                return _Obj(id=cid, model=model, object="chat.completion",
                            created=1735689600, choices=[escolha], usage=usage)

            texto, _ = _responder(messages, None)
            texto, truncou = _truncar(texto, max_tokens)
            completion_tokens = _contar_palavras(texto)
            mensagem = _Obj(role="assistant", content=texto, tool_calls=None)
            escolha = _Obj(index=0, message=mensagem,
                           finish_reason="length" if truncou else "stop")
            usage = _Obj(prompt_tokens=prompt_tokens,
                         completion_tokens=completion_tokens,
                         total_tokens=prompt_tokens + completion_tokens)
            return _Obj(id=cid, model=model, object="chat.completion",
                        created=1735689600, choices=[escolha], usage=usage)

    class _Chat:
        def __init__(self, client):
            self.completions = _Completions(client)

    class _EmbeddingsAPI:
        def __init__(self, client):
            self._client = client

        def create(self, *, model, input, **kwargs):
            registro = {"api": "embeddings.create", "model": model, "input": input}
            registro.update(kwargs)
            self._client.chamadas.append(registro)
            evento = _proximo_erro_llm()
            if evento == "rate_limit":
                raise RateLimitError(_L("e_rate_limit"))
            textos = [input] if isinstance(input, str) else list(input)
            if evento == "vetor_zero":  # norma zero: testa o cosseno blindado
                data = [_Obj(embedding=[0.0] * 16, index=i, object="embedding")
                        for i, _t in enumerate(textos)]
            else:
                data = [_Obj(embedding=embed_texto(t), index=i, object="embedding")
                        for i, t in enumerate(textos)]
            total = sum(_contar_palavras(t) for t in textos)
            usage = _Obj(prompt_tokens=total, total_tokens=total)
            return _Obj(object="list", model=model, data=data, usage=usage)

    class OpenAI:
        def __init__(self, api_key=None, base_url=None, **kwargs):
            self.api_key = api_key
            self.chamadas = []  # spy: kwargs de TODA chamada (mesmo as que falham)
            self.calls = self.chamadas  # alias en (MESMA lista)
            self.chat = _Chat(self)
            self.embeddings = _EmbeddingsAPI(self)

    mod.OpenAI = OpenAI
    mod.OpenAIError = OpenAIError
    mod.RateLimitError = RateLimitError
    mod.APIConnectionError = APIConnectionError
    mod.BadRequestError = BadRequestError
    return mod


# ---------------------------------------------------------------------------
# Módulo fake `anthropic`
# ---------------------------------------------------------------------------
def _fabricar_anthropic() -> types.ModuleType:
    mod = types.ModuleType("anthropic")

    class AnthropicError(Exception):
        pass

    class APIError(AnthropicError):
        pass

    class RateLimitError(AnthropicError):
        pass

    class _Messages:
        def __init__(self, client):
            self._client = client

        def create(self, *, model, max_tokens, messages, system=None,
                   temperature=None, **kwargs):
            # max_tokens é keyword-only SEM default: ausência gera TypeError,
            # fiel à API real da Anthropic.
            registro = {"api": "messages.create", "model": model,
                        "max_tokens": max_tokens,
                        "messages": [dict(m) if isinstance(m, dict) else m for m in messages],
                        "system": system, "temperature": temperature}
            registro.update(kwargs)
            self._client.chamadas.append(registro)

            evento = _proximo_erro_llm()
            if evento == "rate_limit":
                raise RateLimitError(_L("e_rate_limit"))

            texto, _ = _responder(messages, system)
            texto, truncou = _truncar(texto, max_tokens)
            input_tokens = sum(_contar_palavras(m.get("content")) for m in messages
                               if isinstance(m, dict)) + _contar_palavras(system or "")
            output_tokens = _contar_palavras(texto)

            if evento == "multi_blocos" and " " in texto:
                palavras = texto.split()
                meio = max(len(palavras) // 2, 1)
                blocos = [_Obj(type="text", text=" ".join(palavras[:meio]) + " "),
                          _Obj(type="text", text=" ".join(palavras[meio:]))]
            else:
                blocos = [_Obj(type="text", text=texto)]

            return _Obj(
                id="msg-mock-" + _sha8(registro["messages"]),
                type="message", role="assistant", model=model,
                stop_reason="max_tokens" if truncou else "end_turn",
                content=blocos,
                usage=_Obj(input_tokens=input_tokens, output_tokens=output_tokens),
            )

    class Anthropic:
        def __init__(self, api_key=None, **kwargs):
            self.api_key = api_key
            self.chamadas = []  # spy: kwargs de TODA chamada (mesmo as que falham)
            self.calls = self.chamadas  # alias en (MESMA lista)
            self.messages = _Messages(self)

    mod.Anthropic = Anthropic
    mod.AnthropicError = AnthropicError
    mod.APIError = APIError
    mod.RateLimitError = RateLimitError
    return mod


# ---------------------------------------------------------------------------
# instalar / desinstalar
# ---------------------------------------------------------------------------
_FABRICAS = {
    "requests": _fabricar_requests,
    "openai": _fabricar_openai,
    "anthropic": _fabricar_anthropic,
}
_originais_sys_modules: dict[str, object] = {}
_instalados: list[str] = []


def instalar(nomes: list[str]) -> None:
    """Registra os módulos fake pedidos em sys.modules. Idempotente."""
    desinstalar()
    reset_estado()
    for nome in nomes or []:
        if nome not in _FABRICAS:
            raise ValueError(f"mock desconhecido: {nome!r}")
        mod = _FABRICAS[nome]()
        for chave in (nome,) + (("requests.exceptions",) if nome == "requests" else ()):
            _originais_sys_modules[chave] = sys.modules.get(chave)
        sys.modules[nome] = mod
        if nome == "requests":
            sys.modules["requests.exceptions"] = mod.exceptions
        _instalados.append(nome)


def desinstalar() -> None:
    """Remove os fakes e restaura o que existia antes em sys.modules."""
    for chave, original in _originais_sys_modules.items():
        if original is None:
            sys.modules.pop(chave, None)
        else:
            sys.modules[chave] = original
    _originais_sys_modules.clear()
    _instalados.clear()
