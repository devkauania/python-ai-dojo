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
                                "multi_blocos" = resposta Anthropic em 2 blocos
  embed_texto(texto, dim=16) -- embedding determinístico (mesmo dos clientes)

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


def roteirizar_erros_llm(eventos: list) -> None:
    """Roteiriza eventos por chamada de LLM (compartilhado openai/anthropic)."""
    global _erros_llm
    _erros_llm = list(eventos)


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


def _palavras_conteudo(texto: str) -> set[str]:
    return {p for p in re.findall(r"\w+", texto.casefold()) if p not in _STOPWORDS}


def _resposta_tabela(t: str):
    """Tabela fixa de palavras-chave. t já vem em casefold."""
    if "capital do brasil" in t:
        return "Brasília"
    if "capital da frança" in t:
        return "Paris"
    if "2 + 2" in t or "2+2" in t:
        return "4"
    tokens = set(re.findall(r"\w+", t))
    if tokens & {"olá", "ola", "oi"}:
        return "Olá! Como posso ajudar?"
    if "python" in t:
        return "Python é uma linguagem de programação."
    return None


def _modo_rag(conteudo: str):
    """Se a mensagem tem contextos numerados + 'pergunta:', responde JSON cercado."""
    t = conteudo.casefold()
    if "[1]" not in conteudo or "pergunta:" not in t:
        return None
    contextos = {}
    for m in re.finditer(r"^\s*\[(\d+)\]\s*(.+)$", conteudo, re.MULTILINE):
        contextos[int(m.group(1))] = m.group(2).strip()
    pos = t.rfind("pergunta:")
    pergunta = conteudo[pos + len("pergunta:"):].strip()
    palavras_pergunta = _palavras_conteudo(pergunta)
    pontuados = []
    for n, texto in contextos.items():
        score = len(palavras_pergunta & _palavras_conteudo(texto))
        if score > 0:
            pontuados.append((-score, n))
    pontuados.sort()
    fontes = [n for _, n in pontuados[:3]]
    if not fontes:
        corpo = {"resposta": "não sei", "fontes": []}
    else:
        resposta = _resposta_tabela(pergunta.casefold())
        if resposta is None:
            melhores = contextos[fontes[0]].split()
            resposta = " ".join(melhores[:12])
        corpo = {"resposta": resposta, "fontes": fontes}
    return "```json\n" + _json.dumps(corpo, ensure_ascii=False) + "\n```"


def _responder(mensagens: list, system) -> tuple[str, bool]:
    """Resposta determinística. Retorna (texto, truncado_flag=False aqui)."""
    ultima_user = ""
    for m in mensagens:
        if isinstance(m, dict) and m.get("role") == "user" and isinstance(m.get("content"), str):
            ultima_user = m["content"]
    # continuação de ferramenta: a conversa termina num resultado de tool
    if mensagens and isinstance(mensagens[-1], dict) and mensagens[-1].get("role") == "tool":
        return f"O resultado é {str(mensagens[-1].get('content', '')).strip()}.", False

    rag = _modo_rag(ultima_user)
    if rag is not None:
        return rag, False

    t = ultima_user.casefold()
    resposta = _resposta_tabela(t)
    if resposta is None:
        resposta = f"Você disse: {ultima_user}"

    s = (system or "").casefold()
    if "pirata" in s:
        resposta = "Arrr! " + resposta
    if "maiúsculas" in s or "maiusculas" in s:
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
    if "somar" in nomes:
        for m in re.finditer(r"some\s+(-?\d+)\s+(?:e|com)\s+(-?\d+)", t):
            chamadas.append(("somar", {"a": int(m.group(1)), "b": int(m.group(2))}))
        if not chamadas:
            for m in re.finditer(r"(-?\d+)\s*\+\s*(-?\d+)", t):
                chamadas.append(("somar", {"a": int(m.group(1)), "b": int(m.group(2))}))
    if "clima" in nomes and not chamadas:
        m = re.search(r"clima em ([\wà-ú]+)", t)
        if m:
            chamadas.append(("clima", {"cidade": m.group(1).capitalize()}))
    if "buscar_docs" in nomes and not chamadas:
        m = re.search(r"busq?u?e?a?\s+sobre\s+(.+)", t)
        if m:
            chamadas.append(("buscar_docs", {"consulta": m.group(1).strip().rstrip("?.!")}))
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
                    f"O corpo da resposta não é JSON válido: {self.text[:80]!r}"
                ) from None

        def raise_for_status(self):
            if self.status_code >= 400:
                raise HTTPError(
                    f"{self.status_code} Erro para a url: {self.url}", response=self
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
            return Response(429, {"erro": "rate limit excedido"}, url,
                            headers={"Retry-After": str(ra)})
        if status == 500:
            return Response(500, "erro interno", url)
        if status == 401:
            return Response(401, {"erro": "não autorizado"}, url)
        if status == 400:
            return Response(400, {"erro": "requisição inválida"}, url)
        return Response(status, {"erro": f"erro {status}"}, url)

    def _rotear(metodo, url, params=None, json_body=None, headers=None):
        url_final, partes, query = _montar_url(url, params)
        caminho = partes.path
        historico_http.append({
            "metodo": metodo, "url": url_final, "caminho": caminho,
            "params": dict(query), "json": json_body, "headers": dict(headers or {}),
            "relogio": relogio(),
        })
        if partes.netloc != "api.dojo.dev":
            raise ConnectionError(
                f"Não foi possível conectar a {partes.netloc or url!r} — "
                "no Dojo, só a API mockada https://api.dojo.dev existe."
            )
        if caminho == "/timeout":
            raise Timeout("A requisição excedeu o tempo limite (mock).")

        forcada = _resposta_roteirizada(caminho, url_final)
        if forcada == "loop":
            if caminho == "/modelos":
                cursor = query.get("cursor")
                pagina = _MODELOS_PAGINAS.get(cursor if cursor else None)
                if pagina is None:
                    return Response(400, {"erro": "cursor inválido"}, url_final)
                corpo = dict(pagina)
                corpo["proximo_cursor"] = cursor  # mesma página, mesmo cursor: loop!
                return Response(200, corpo, url_final)
            forcada = None
        if forcada is not None:
            return forcada

        if metodo == "GET" and caminho == "/status":
            return Response(200, {"status": "ok"}, url_final)

        if metodo == "GET" and caminho == "/usuarios":
            bruto = query.get("pagina", "1")
            try:
                n = int(bruto)
            except ValueError:
                return Response(400, {"erro": "página inválida"}, url_final)
            if n < 1:
                return Response(400, {"erro": "página inválida"}, url_final)
            dados = _USUARIOS_PAGINAS.get(n, [])
            return Response(200, {"dados": dados, "pagina": n, "total_paginas": 3}, url_final)

        if metodo == "GET" and caminho.startswith("/produtos/"):
            bruto = caminho[len("/produtos/"):]
            try:
                pid = int(bruto)
            except ValueError:
                pid = -1
            produto = _PRODUTOS.get(pid)
            if produto is None:
                return Response(404, {"erro": "produto não encontrado"}, url_final)
            return Response(200, produto, url_final)

        if metodo == "GET" and caminho == "/segredo":
            auth = (headers or {}).get("Authorization", "")
            if auth == "Bearer tk_dojo_001":
                return Response(200, {"segredo": "o dojo é o caminho"}, url_final)
            return Response(401, {"erro": "não autorizado"}, url_final)

        if metodo == "GET" and caminho == "/erro500":
            return Response(500, "erro interno", url_final)

        if metodo == "POST" and caminho == "/echo":
            # deepcopy: devolver o MESMO objeto deixaria `return dados` passar
            # sem nunca ler a resposta (cobertura de json-parse, rodada 2).
            return Response(200, {"recebido": copy.deepcopy(json_body), "metodo": "POST"}, url_final)

        if metodo == "POST" and caminho == "/login":
            corpo = json_body or {}
            if isinstance(corpo, dict) and corpo.get("senha") == "dojo123":
                return Response(200, {"token": "tk_dojo_001"}, url_final)
            return Response(401, {"erro": "credenciais inválidas"}, url_final)

        if metodo == "GET" and caminho == "/modelos":
            cursor = query.get("cursor")
            pagina = _MODELOS_PAGINAS.get(cursor if cursor else None)
            if pagina is None:
                return Response(400, {"erro": "cursor inválido"}, url_final)
            return Response(200, dict(pagina), url_final)

        return Response(404, {"erro": "rota não encontrada"}, url_final)

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
                raise RateLimitError(
                    "Erro 429: limite de requisições excedido (mock). Tente de novo."
                )

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
                raise RateLimitError(
                    "Erro 429: limite de requisições excedido (mock). Tente de novo."
                )
            textos = [input] if isinstance(input, str) else list(input)
            data = [_Obj(embedding=embed_texto(t), index=i, object="embedding")
                    for i, t in enumerate(textos)]
            total = sum(_contar_palavras(t) for t in textos)
            usage = _Obj(prompt_tokens=total, total_tokens=total)
            return _Obj(object="list", model=model, data=data, usage=usage)

    class OpenAI:
        def __init__(self, api_key=None, base_url=None, **kwargs):
            self.api_key = api_key
            self.chamadas = []  # spy: kwargs de TODA chamada (mesmo as que falham)
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
                raise RateLimitError(
                    "Erro 429: limite de requisições excedido (mock). Tente de novo."
                )

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
