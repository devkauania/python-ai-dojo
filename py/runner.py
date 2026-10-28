# -*- coding: utf-8 -*-
"""Runner de testes canônico do Python AI Dojo — fonte ÚNICA.

Roda IGUAL no Pyodide (via js/pyworker.js) e no CPython (via tools/verify.py).
Python puro: nenhum `import js`, nenhum `pyodide`.

Entry point único: executar_json(payload_json) -> resultado_json

payload = {
  "codigo": str,                 # código do aluno
  "testes_visiveis": [Teste],    # Teste = {"nome", "codigo", "entradas"?}
  "testes_ocultos": [Teste],
  "mocks": ["requests"|"openai"|"anthropic", ...],
  "arquivos": {"nome.txt": "conteúdo"},   # fixtures no sandbox
  "timeout_s": int,              # informativo; quem interrompe é o ambiente
  "lang": "pt"|"en"              # opcional (padrão "pt"): idioma das mensagens
}                                #   didáticas e dos dados dos mocks

resultado = {
  "status": "ok"|"falha_teste"|"erro_sintaxe"|"erro_execucao"|"timeout",
  "stdout": str,
  "erro": {"tipo","linha","mensagem_didatica","mensagem_original"} | null,
  "testes": [{"nome","oculto","passou","esperado","obtido","diff","mensagem"}]
}

Regras de execução:
- O código do aluno compila como "aluno.py"; tracebacks apontam a linha certa.
- Execução-base única; MAS se QUALQUER teste tiver "entradas", a execução-base
  é pulada e cada teste re-executa o código do aluno do zero (input() alimentado
  pela lista; o prompt do input NÃO é ecoado no stdout).
- Sem "entradas", input() levanta erro didático.
- Todos os testes rodam (não para no primeiro que falha).
- Timeout: o ambiente injeta KeyboardInterrupt (SIGINT) ou mata o processo;
  KeyboardInterrupt aqui vira status "timeout".
- Helpers visíveis SÓ nos testes: _verificar, _stdout, _mocks, _rodar, _lang
  (aliases en: _check = _verificar, _run = _rodar).
- Idioma: payload["lang"] ("pt" padrão | "en") vira LANG aqui e no mocks_ia;
  com "pt" TODA mensagem é byte-idêntica à versão monolíngue (verify pt 273/273).
"""
from __future__ import annotations

import asyncio
import contextlib
import difflib
import io
import json
import math
import os
import re
import selectors
import shutil
import sys
import tempfile
import traceback

import mocks_ia

_CAP_STDOUT = 10_000
_CAP_REPR = 300

# ---------------------------------------------------------------------------
# Idioma das mensagens mostradas ao aluno (o worker e o verify passam no payload)
# ---------------------------------------------------------------------------
LANG = "pt"

_MSG = {
    "pt": {
        "sem_repr": "<{tipo} sem repr>",
        "cortado": "… (cortado)",
        "diff_esperado": "esperado",
        "diff_obtido": "obtido",
        "unbound": ("Você usou uma variável local antes de dar um valor a ela — "
                    "atribua antes de usar, ou repense o escopo da função."),
        "name": ("Você usou o nome '{nome}' que ainda não foi definido — confira a "
                 "grafia ou se esqueceu de criar essa variável/função antes de usar."),
        "attr": ("Valores do tipo '{tipo}' não têm o atributo/método "
                 "'{attr}' — confira a grafia e o tipo da variável."),
        "attr_generico": "Esse objeto não tem o atributo/método pedido — confira a grafia e o tipo.",
        "tipos_misturados": ("Você misturou tipos numa operação (ex.: texto + número). "
                             "Converta antes com str(), int() ou float()."),
        "subscript": "Esse valor não aceita indexação com [ ] — confira o tipo da variável.",
        "callable": "Você usou parênteses em algo que não é uma função.",
        "missing_arg": "A função foi chamada sem um argumento obrigatório — confira a assinatura.",
        "kwarg": "A função recebeu um argumento nomeado que ela não aceita — confira o nome.",
        "type_generico": "Os tipos usados não combinam com essa operação — veja a mensagem original.",
        "index": ("Você tentou acessar uma posição que não existe na sequência — "
                  "lembre que os índices começam em 0 e o último é len(x) - 1."),
        "key": ("A chave {msg} não existe nesse dicionário — confira a grafia "
                "ou use .get() para ter um valor padrão."),
        "zero": ("Divisão por zero — garanta que o divisor nunca seja 0 "
                 "(cuidado com médias de listas vazias)."),
        "int_literal": "int() recebeu um texto que não representa um número inteiro válido.",
        "float_literal": "float() recebeu um texto que não representa um número válido.",
        "value_generico": "Um valor com tipo certo mas conteúdo inválido foi usado — veja a mensagem original.",
        "import": ("Esse módulo não está disponível no Dojo. Existem: biblioteca padrão, "
                   "numpy, pandas e os mocks (requests, openai, anthropic) quando o "
                   "exercício os ativa."),
        "recursion": ("Recursão infinita — sua função chama a si mesma sem nunca alcançar "
                      "a condição de parada."),
        "stop": ("next() foi chamado num iterador já esgotado — generators só podem "
                 "ser percorridos uma vez."),
        "file": ("Arquivo não encontrado — use exatamente os arquivos que o exercício "
                 "fornece e caminhos relativos."),
        "generico": "Ocorreu um erro do tipo {tipo} — veja a mensagem original.",
        "input_proibido": ("Este exercício não usa input() — trabalhe com os argumentos da função "
                           "e o valor de retorno."),
        "input_esgotado": ("Seu código chamou input() mais vezes do que o teste forneceu "
                           "entradas — confira quantas leituras o enunciado pede."),
        "sem_io": "I/O de rede/arquivo real não existe no sandbox do Dojo.",
        "assert": "A condição verificada não é verdadeira.",
        "erro_no_teste": "O teste provocou um erro no seu código — {didatica} ({tipo}: {exc})",
        "indentacao": ("A indentação está errada nessa linha — em Python os "
                       "blocos são definidos por 4 espaços consistentes."),
        "sintaxe": ("O Python não conseguiu nem começar a rodar: há um erro "
                    "de escrita nessa linha (parêntese, aspas ou dois-pontos "
                    "faltando são os suspeitos de sempre)."),
        "timeout": ("Seu código passou do tempo limite — quase sempre "
                    "é um loop que nunca termina (while sem condição "
                    "de saída ou contador que não anda)."),
        "timeout_original": "KeyboardInterrupt (interrompido pelo Dojo)",
    },
    "en": {
        "sem_repr": "<{tipo} without repr>",
        "cortado": "… (truncated)",
        "diff_esperado": "expected",
        "diff_obtido": "got",
        "unbound": ("You used a local variable before giving it a value — "
                    "assign it before using it, or rethink the function's scope."),
        "name": ("You used the name '{nome}', which hasn't been defined yet — check the "
                 "spelling, or whether you forgot to create that variable/function first."),
        "attr": ("Values of type '{tipo}' don't have the attribute/method "
                 "'{attr}' — check the spelling and the variable's type."),
        "attr_generico": "This object doesn't have the requested attribute/method — check the spelling and the type.",
        "tipos_misturados": ("You mixed types in one operation (e.g. text + number). "
                             "Convert first with str(), int() or float()."),
        "subscript": "This value can't be indexed with [ ] — check the variable's type.",
        "callable": "You used parentheses on something that isn't a function.",
        "missing_arg": "The function was called without a required argument — check its signature.",
        "kwarg": "The function got a keyword argument it doesn't accept — check the name.",
        "type_generico": "The types used don't fit this operation — see the original message.",
        "index": ("You tried to access a position that doesn't exist in the sequence — "
                  "remember indexes start at 0 and the last one is len(x) - 1."),
        "key": ("The key {msg} doesn't exist in this dictionary — check the spelling "
                "or use .get() to get a default value."),
        "zero": ("Division by zero — make sure the divisor is never 0 "
                 "(watch out for averages of empty lists)."),
        "int_literal": "int() got a text that isn't a valid whole number.",
        "float_literal": "float() got a text that isn't a valid number.",
        "value_generico": "A value of the right type but invalid content was used — see the original message.",
        "import": ("That module isn't available in the Dojo. You have: the standard library, "
                   "numpy, pandas and the mocks (requests, openai, anthropic) when the "
                   "exercise turns them on."),
        "recursion": ("Infinite recursion — your function calls itself without ever reaching "
                      "the stopping condition."),
        "stop": ("next() was called on an iterator that is already exhausted — generators can "
                 "only be walked through once."),
        "file": ("File not found — use exactly the files the exercise provides, "
                 "with relative paths."),
        "generico": "An error of type {tipo} happened — see the original message.",
        "input_proibido": ("This exercise doesn't use input() — work with the function's arguments "
                           "and its return value."),
        "input_esgotado": ("Your code called input() more times than the test provided "
                           "inputs — check how many reads the task asks for."),
        "sem_io": "Real network/file I/O doesn't exist in the Dojo sandbox.",
        "assert": "The checked condition is not true.",
        "erro_no_teste": "The test triggered an error in your code — {didatica} ({tipo}: {exc})",
        "indentacao": ("The indentation is wrong on this line — in Python, "
                       "blocks are defined by consistent 4-space indents."),
        "sintaxe": ("Python couldn't even start running: there is a typo "
                    "on this line (a missing parenthesis, quote or colon "
                    "are the usual suspects)."),
        "timeout": ("Your code went over the time limit — it is almost always "
                    "a loop that never ends (a while with no exit "
                    "condition, or a counter that never moves)."),
        "timeout_original": "KeyboardInterrupt (stopped by the Dojo)",
    },
}


def _m(chave, **kw):
    texto = _MSG.get(LANG, _MSG["pt"]).get(chave) or _MSG["pt"][chave]
    return texto.format(**kw) if kw else texto


def _definir_idioma(lang):
    global LANG
    LANG = lang if lang in _MSG else "pt"
    mocks_ia.definir_idioma(LANG)


# ---------------------------------------------------------------------------
# Comparação pedagógica
# ---------------------------------------------------------------------------
class _FalhaVerificacao(Exception):
    def __init__(self, esperado, obtido, diff=None, rotulo=None):
        super().__init__("verificação falhou")
        self.esperado = esperado
        self.obtido = obtido
        self.diff = diff
        self.rotulo = rotulo


def _despir(x):
    """Converte tipos numpy (arrays e escalares) para tipos Python puros."""
    modulo = type(x).__module__
    if modulo and modulo.split(".")[0] == "numpy":
        if hasattr(x, "tolist"):
            return x.tolist()
        if hasattr(x, "item"):
            return x.item()
    return x


def _iguais(a, b) -> bool:
    a, b = _despir(a), _despir(b)
    if isinstance(a, bool) or isinstance(b, bool):
        return isinstance(a, bool) and isinstance(b, bool) and a == b
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return math.isclose(a, b, rel_tol=1e-6, abs_tol=1e-9)
    if isinstance(a, str) or isinstance(b, str):
        return a == b
    if isinstance(a, (list, tuple)) and isinstance(b, (list, tuple)):
        if isinstance(a, tuple) != isinstance(b, tuple):
            return False
        if len(a) != len(b):
            return False
        return all(_iguais(x, y) for x, y in zip(a, b))
    if isinstance(a, dict) and isinstance(b, dict):
        if set(a.keys()) != set(b.keys()):
            return False
        return all(_iguais(a[k], b[k]) for k in a)
    if isinstance(a, (set, frozenset)) and isinstance(b, (set, frozenset)):
        return a == b
    return a == b


def _repr_curto(x) -> str:
    try:
        r = repr(_despir(x))
    except Exception:
        r = _m("sem_repr", tipo=type(x).__name__)
    if len(r) > _CAP_REPR:
        r = r[:_CAP_REPR] + _m("cortado")
    return r


def _verificar(obtido, esperado, rotulo=None):
    """Comparação com tolerância de float (1e-6) e diff para strings longas."""
    if _iguais(obtido, esperado):
        return
    diff = None
    if isinstance(obtido, str) and isinstance(esperado, str) and (
        "\n" in obtido or "\n" in esperado
    ):
        diff = "\n".join(difflib.unified_diff(
            esperado.splitlines(), obtido.splitlines(),
            fromfile=_m("diff_esperado"), tofile=_m("diff_obtido"), lineterm="",
        ))[:2000]
    raise _FalhaVerificacao(_repr_curto(esperado), _repr_curto(obtido), diff, rotulo)


# ---------------------------------------------------------------------------
# Tradução pedagógica de erros
# ---------------------------------------------------------------------------
def _traduzir(exc: BaseException) -> str:
    msg = str(exc)
    if isinstance(exc, UnboundLocalError):
        return _m("unbound")
    if isinstance(exc, NameError):
        m = re.search(r"name '([^']+)' is not defined", msg)
        nome = m.group(1) if m else "?"
        return _m("name", nome=nome)
    if isinstance(exc, AttributeError):
        m = re.search(r"'([^']+)' object has no attribute '([^']+)'", msg)
        if m:
            return _m("attr", tipo=m.group(1), attr=m.group(2))
        return _m("attr_generico")
    if isinstance(exc, TypeError):
        if "can only concatenate str" in msg or "unsupported operand type" in msg:
            return _m("tipos_misturados")
        if "not subscriptable" in msg:
            return _m("subscript")
        if "not callable" in msg:
            return _m("callable")
        if "missing" in msg and "argument" in msg:
            return _m("missing_arg")
        if "unexpected keyword argument" in msg:
            return _m("kwarg")
        return _m("type_generico")
    if isinstance(exc, IndexError):
        return _m("index")
    if isinstance(exc, KeyError):
        return _m("key", msg=msg)
    if isinstance(exc, ZeroDivisionError):
        return _m("zero")
    if isinstance(exc, ValueError):
        if "invalid literal for int()" in msg:
            return _m("int_literal")
        if "could not convert string to float" in msg:
            return _m("float_literal")
        return _m("value_generico")
    if isinstance(exc, (ImportError, ModuleNotFoundError)):
        return _m("import")
    if isinstance(exc, RecursionError):
        return _m("recursion")
    if isinstance(exc, StopIteration):
        return _m("stop")
    if isinstance(exc, FileNotFoundError):
        return _m("file")
    if isinstance(exc, RuntimeError):
        return msg  # nossos próprios erros didáticos (input etc.)
    return _m("generico", tipo=type(exc).__name__)


def _linha_do_aluno(exc: BaseException):
    linha = None
    for frame in traceback.extract_tb(exc.__traceback__):
        if frame.filename == "aluno.py":
            linha = frame.lineno
    return linha


def _erro_execucao(exc: BaseException) -> dict:
    return {
        "tipo": type(exc).__name__,
        "linha": _linha_do_aluno(exc),
        "mensagem_didatica": _traduzir(exc),
        "mensagem_original": f"{type(exc).__name__}: {exc}",
    }


# ---------------------------------------------------------------------------
# input() controlado
# ---------------------------------------------------------------------------
def _input_proibido(prompt=""):
    raise RuntimeError(_m("input_proibido"))


def _fabricar_input(entradas):
    fila = list(entradas)

    def _input(prompt=""):
        if not fila:
            raise RuntimeError(_m("input_esgotado"))
        return fila.pop(0)

    return _input


# ---------------------------------------------------------------------------
# Loop de eventos com relógio VIRTUAL (async instantâneo e determinístico)
# ---------------------------------------------------------------------------
class _SeletorVirtual(selectors.BaseSelector):
    """Sem I/O real; 'esperar' avança o relógio virtual — sleeps são instantâneos."""

    def __init__(self):
        self._mapa = {}

    def register(self, fileobj, events, data=None):
        raise RuntimeError(_m("sem_io"))

    def unregister(self, fileobj):
        raise RuntimeError(_m("sem_io"))

    def select(self, timeout=None):
        if timeout:
            mocks_ia.avancar_relogio(timeout)
        return []

    def get_map(self):
        return self._mapa

    def close(self):
        pass


class _LoopVirtual(asyncio.SelectorEventLoop):
    # Sem self-pipe: somos single-thread e socketpair não existe no Emscripten.
    def _make_self_pipe(self):
        self._ssock = None
        self._csock = None
        self._internal_fds = 0

    def _close_self_pipe(self):
        pass

    def _write_to_self(self):
        pass

    def time(self):
        return 1000.0 + mocks_ia.relogio()


def _rodar(coro):
    """Roda uma corrotina até o fim, com relógio virtual (asyncio.sleep não
    espera de verdade: avança o relógio do mock). Uso nos testes:
    _verificar(_rodar(minha_func_async()), esperado)

    No Pyodide o WebLoop já está "rodando" no worker, então
    run_until_complete levantaria "Cannot run the event loop while another
    loop is running". Limpamos temporariamente o running-loop em volta do
    nosso loop virtual e restauramos depois. No CPython (verify) não há loop
    rodando, então é um no-op."""
    loop = _LoopVirtual(_SeletorVirtual())
    loop_anterior = asyncio.events._get_running_loop()
    asyncio.events._set_running_loop(None)
    try:
        return loop.run_until_complete(coro)
    finally:
        asyncio.events._set_running_loop(loop_anterior)
        with contextlib.suppress(Exception):
            loop.close()


# ---------------------------------------------------------------------------
# Pipeline principal
# ---------------------------------------------------------------------------
def _executar_codigo(codigo_compilado, ns, saida):
    with contextlib.redirect_stdout(saida), contextlib.redirect_stderr(saida):
        exec(codigo_compilado, ns)


def _rodar_teste(teste, ns_base, codigo_compilado, stdout_base, resultado_testes,
                 oculto, modo_entradas):
    nome = teste.get("nome", "teste")
    entrada_teste = {"nome": nome, "oculto": oculto, "passou": False,
                     "esperado": None, "obtido": None, "diff": None, "mensagem": None}
    mocks_ia.reset_estado()
    saida_local = io.StringIO()
    try:
        if modo_entradas:
            # re-executa o código do aluno do zero para este teste
            ns = {"__name__": "__main__"}
            entradas = teste.get("entradas")
            ns["input"] = _fabricar_input(entradas) if entradas else _input_proibido
            _executar_codigo(codigo_compilado, ns, saida_local)
            stdout_teste = saida_local.getvalue()[:_CAP_STDOUT]
        else:
            ns = dict(ns_base)
            stdout_teste = stdout_base
        ns["_verificar"] = _verificar
        ns["_stdout"] = stdout_teste
        ns["_mocks"] = mocks_ia
        ns["_rodar"] = _rodar
        ns["_lang"] = LANG
        # aliases em inglês (conteúdo en): os MESMOS objetos
        ns["_check"] = _verificar
        ns["_run"] = _rodar
        codigo_teste = compile(teste.get("codigo", ""), f"<teste: {nome}>", "exec")
        with contextlib.redirect_stdout(saida_local), contextlib.redirect_stderr(saida_local):
            exec(codigo_teste, ns)
        entrada_teste["passou"] = True
    except KeyboardInterrupt:
        raise
    except _FalhaVerificacao as f:
        entrada_teste["esperado"] = f.esperado
        entrada_teste["obtido"] = f.obtido
        entrada_teste["diff"] = f.diff
        entrada_teste["mensagem"] = f.rotulo
    except AssertionError as e:
        entrada_teste["mensagem"] = str(e) or _m("assert")
    except BaseException as e:  # noqa: BLE001 - erro do código do aluno num teste
        entrada_teste["mensagem"] = _m("erro_no_teste", didatica=_traduzir(e),
                                       tipo=type(e).__name__, exc=e)
    resultado_testes.append(entrada_teste)


def executar_json(payload_json: str) -> str:
    payload = json.loads(payload_json)
    _definir_idioma(payload.get("lang") or "pt")
    codigo = (payload.get("codigo") or "").replace("\r\n", "\n").replace("\r", "\n")
    visiveis = payload.get("testes_visiveis") or []
    ocultos = payload.get("testes_ocultos") or []
    mocks = payload.get("mocks") or []
    arquivos = payload.get("arquivos") or {}

    resultado = {"status": "ok", "stdout": "", "erro": None, "testes": []}
    cwd_original = os.getcwd()
    sandbox = None
    try:
        # (1) setup: sandbox + fixtures + mocks + relógio virtual
        sandbox = tempfile.mkdtemp(prefix="dojo_sandbox_")
        os.chdir(sandbox)
        for nome_arq, conteudo in arquivos.items():
            destino = os.path.join(sandbox, nome_arq)
            pasta = os.path.dirname(destino)
            if pasta:
                os.makedirs(pasta, exist_ok=True)
            with open(destino, "w", encoding="utf-8", newline="") as f:
                f.write(conteudo)
        mocks_ia.instalar(mocks)
        mocks_ia.instalar_relogio()

        # (2) compilação
        try:
            codigo_compilado = compile(codigo, "aluno.py", "exec")
        except SyntaxError as e:
            if isinstance(e, IndentationError):
                didatica = _m("indentacao")
            else:
                didatica = _m("sintaxe")
            resultado["status"] = "erro_sintaxe"
            resultado["erro"] = {
                "tipo": type(e).__name__,
                "linha": e.lineno,
                "offset": e.offset,
                "trecho": (e.text or "").rstrip("\n"),
                "mensagem_didatica": didatica,
                "mensagem_original": f"{type(e).__name__}: {e.msg}",
            }
            return json.dumps(resultado, ensure_ascii=False)

        # (3) execução-base (pulada se o exercício usa "entradas")
        todos_testes = list(visiveis) + list(ocultos)
        modo_entradas = any(t.get("entradas") for t in todos_testes)
        ns_base = {"__name__": "__main__", "input": _input_proibido}
        stdout_base = ""
        if not modo_entradas:
            saida = io.StringIO()
            try:
                _executar_codigo(codigo_compilado, ns_base, saida)
            except KeyboardInterrupt:
                raise
            except BaseException as e:  # noqa: BLE001 - erro do aluno
                resultado["status"] = "erro_execucao"
                resultado["stdout"] = saida.getvalue()[:_CAP_STDOUT]
                resultado["erro"] = _erro_execucao(e)
                return json.dumps(resultado, ensure_ascii=False)
            stdout_base = saida.getvalue()[:_CAP_STDOUT]
        resultado["stdout"] = stdout_base

        # (4) testes: visíveis primeiro, depois ocultos; roda TODOS
        for teste in visiveis:
            _rodar_teste(teste, ns_base, codigo_compilado, stdout_base,
                         resultado["testes"], False, modo_entradas)
        for teste in ocultos:
            _rodar_teste(teste, ns_base, codigo_compilado, stdout_base,
                         resultado["testes"], True, modo_entradas)

        if modo_entradas and resultado["testes"]:
            # sem execução-base: mostra o stdout implícito do 1º teste? Não —
            # cada teste tem o seu; o campo global fica vazio de propósito.
            resultado["stdout"] = ""

        if any(not t["passou"] for t in resultado["testes"]):
            resultado["status"] = "falha_teste"
        return json.dumps(resultado, ensure_ascii=False)

    except KeyboardInterrupt:
        resultado["status"] = "timeout"
        resultado["erro"] = {
            "tipo": "Timeout",
            "linha": None,
            "mensagem_didatica": _m("timeout"),
            "mensagem_original": _m("timeout_original"),
        }
        return json.dumps(resultado, ensure_ascii=False)
    finally:
        mocks_ia.desinstalar()
        mocks_ia.desinstalar_relogio()
        with contextlib.suppress(Exception):
            os.chdir(cwd_original)
        if sandbox:
            shutil.rmtree(sandbox, ignore_errors=True)
