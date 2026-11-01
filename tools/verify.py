# -*- coding: utf-8 -*-
"""Harness de verificação do Python AI Dojo (CPython 3.12).

Uso:
    python -m venv .venv-verify        (ou: uv venv --python 3.12 .venv-verify)
    .venv-verify\\Scripts\\python -m pip install -r tools\\requirements-verify.txt
    .venv-verify\\Scripts\\python -X utf8 tools\\verify.py [--id ID] [--ato ATO] [--nivel SLUG] [--lang pt|en]

Idioma: --lang pt (padrão) lê content/*.json; --lang en lê content/en/*.json
(mesma estrutura — ver tools/i18n_check.py) e roda o runner/mocks em inglês
(payload["lang"]). O PT continua byte-idêntico ao verify monolíngue.

O que faz:
  1. Carrega content/manifest.json + todos os content/*.json declarados.
  2. Valida o schema de cada exercício (campos, ids únicos, 3 dicas, >=2 testes
     ocultos, explicacao_md no 1º exercício de cada nível+tier, vocabulários,
     XP correto por tier/tipo, conceitos sem referência adiantada na trilha).
  3. Varre proibições de conteúdo (hash(), random, threading/subprocess/...,
     asyncio.run, open() sem encoding).
  4. Executa a solucao_referencia de cada exercício com o MESMO runner do jogo
     (py/runner.py + py/mocks_ia.py) — critério: status == "ok".
  5. Anti-trivialidade: roda o starter_code; se ele passar em tudo, FALHA.
     Porta de mutação (tools/mutantes.py): cada resposta errada nomeada precisa
     reprovar em "falha_teste", cada alternativa correta precisa passar, e a
     comparação do runner precisa dar o resultado da tabela.
  6. Watchdog: cada execução num processo filho com timeout; timeout mata o
     pool e recria (sem SIGALRM — não existe no Windows). PYTHONHASHSEED=0.
  7. Relatório: uma linha por exercício, sumário por nível/tier, gates de
     contagem (>=12 por nível, >=3 por tier; bosses >=3 etapas por tier).
     Exit code 0 SOMENTE com 100% verde (e gates, quando sem filtro).
"""
from __future__ import annotations

import argparse
import concurrent.futures
import contextlib
import json
import os
import re
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mutantes as M  # noqa: E402

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT = os.path.join(RAIZ, "content")
LANG = "pt"  # trocado por --lang; vai no payload do runner
IDIOMAS = ("pt", "en")


def pasta_conteudo(lang):
    """content/ para pt; content/en/ para en (mesmos nomes de arquivo)."""
    return os.path.join(RAIZ, "content", "en") if lang == "en" else os.path.join(RAIZ, "content")
TIMEOUT_EXTERNO = 20  # >= timeout_s de qualquer exercício (max 15) + folga

XP_BASE = {1: 10, 2: 15, 3: 25}
RE_ID = re.compile(r"^(ato[1-4])-([a-z0-9]+)-t([123])-(\d{2})$")

PROIBICOES = [
    (re.compile(r"(?<![\w.])hash\("), "usa hash() builtin (não-determinístico entre ambientes)"),
    (re.compile(r"\bimport\s+random\b|\bfrom\s+random\b"), "usa random (banido no conteúdo)"),
    (re.compile(r"\b(?:import|from)\s+(threading|subprocess|multiprocessing|socket)\b"),
     "usa módulo banido (threading/subprocess/multiprocessing/socket)"),
    (re.compile(r"asyncio\.run\("), "usa asyncio.run() (use _rodar(...) nos testes)"),
]


# ---------------------------------------------------------------------------
# Worker do pool (top-level: exigência do spawn no Windows)
# ---------------------------------------------------------------------------
def _worker_executar(payload_json: str) -> str:
    caminho_py = os.path.join(RAIZ, "py")
    if caminho_py not in sys.path:
        sys.path.insert(0, caminho_py)
    import runner  # noqa: PLC0415 - import tardio proposital (processo filho)
    return runner.executar_json(payload_json)


class Pool:
    """ProcessPoolExecutor(1) com kill+recria em timeout."""

    def __init__(self):
        self._pool = None

    def _garantir(self):
        if self._pool is None:
            self._pool = concurrent.futures.ProcessPoolExecutor(max_workers=1)

    def executar(self, payload_json: str, timeout_s: int):
        self._garantir()
        futuro = self._pool.submit(_worker_executar, payload_json)
        try:
            return futuro.result(timeout=timeout_s)
        except concurrent.futures.TimeoutError:
            self.matar()
            return json.dumps({"status": "timeout", "stdout": "", "erro": None,
                               "testes": [], "_watchdog": True})

    def matar(self):
        if self._pool is None:
            return
        for proc in list(getattr(self._pool, "_processes", {}).values()):
            with contextlib.suppress(Exception):
                proc.terminate()
        with contextlib.suppress(Exception):
            self._pool.shutdown(wait=False, cancel_futures=True)
        self._pool = None


# ---------------------------------------------------------------------------
# Carga de conteúdo
# ---------------------------------------------------------------------------
def carregar_json(caminho):
    # utf-8-sig: tolera BOM acidental (ex.: arquivo salvo pelo PowerShell);
    # os arquivos do repositório permanecem UTF-8 SEM BOM.
    with open(caminho, encoding="utf-8-sig") as f:
        return json.load(f)


def carregar_tudo(filtro_ato=None):
    manifest = carregar_json(os.path.join(CONTENT, "manifest.json"))
    arquivos = []
    for ato in manifest["atos"]:
        arquivos.append((ato["id"], ato["arquivo"]))
    arquivos.append(("bosses", manifest["bosses_arquivo"]))

    exercicios = []  # (arquivo, indice_no_arquivo, exercicio)
    faltando = []
    for ato_id, nome_arq in arquivos:
        caminho = os.path.join(CONTENT, nome_arq)
        if not os.path.exists(caminho):
            faltando.append(nome_arq)
            continue
        dados = carregar_json(caminho)
        for i, ex in enumerate(dados.get("exercicios", [])):
            exercicios.append((nome_arq, i, ex))
    return manifest, exercicios, faltando


def indice_trilha(manifest):
    """slug do nível -> (posição na trilha, tipo, ato_id, conceitos do nível)."""
    trilha = {}
    pos = 0
    primeiro_ensino = {}  # conceito -> posição em que é ensinado pela 1ª vez
    for ato in manifest["atos"]:
        for nivel in ato["niveis"]:
            trilha[nivel["slug"]] = (pos, nivel["tipo"], ato["id"], nivel["conceitos"])
            for c in nivel["conceitos"]:
                primeiro_ensino.setdefault(c, pos)
            pos += 1
    return trilha, primeiro_ensino


# ---------------------------------------------------------------------------
# Validação de schema
# ---------------------------------------------------------------------------
def validar_schema(manifest, exercicios):
    erros = []
    trilha, primeiro_ensino = indice_trilha(manifest)
    vocab = set(primeiro_ensino)
    pacotes_ok = set(manifest["pacotes_permitidos"])
    mocks_ok = set(manifest["mocks_permitidos"])
    ids_vistos = {}
    primeiro_de = set()  # (nivel, tier) já vistos — o 1º exige explicacao_md

    def err(ex_id, msg):
        erros.append(f"[SCHEMA] {ex_id} — {msg}")

    for nome_arq, _i, ex in exercicios:
        ex_id = ex.get("id", f"<sem id em {nome_arq}>")

        obrigatorios = ["id", "nivel", "tier", "conceitos", "titulo", "enunciado_md",
                        "starter_code", "solucao_referencia", "testes_visiveis",
                        "testes_ocultos", "dicas", "xp", "pacotes", "mocks"]
        for campo in obrigatorios:
            if campo not in ex:
                err(ex_id, f"campo obrigatório ausente: {campo}")
        if "explicacao_md" not in ex:
            err(ex_id, "campo explicacao_md ausente (use null quando não for o 1º)")
        if any(c not in ex for c in obrigatorios):
            continue

        m = RE_ID.match(ex_id)
        if not m:
            err(ex_id, "id fora do formato {ato}-{nivel}-t{tier}-{nn}")
        else:
            if m.group(2) != ex["nivel"]:
                err(ex_id, f"id diz nível '{m.group(2)}' mas campo nivel é '{ex['nivel']}'")
            if int(m.group(3)) != ex["tier"]:
                err(ex_id, "tier do id difere do campo tier")
        if ex_id in ids_vistos:
            err(ex_id, f"id duplicado (também em {ids_vistos[ex_id]})")
        ids_vistos[ex_id] = nome_arq

        if ex["nivel"] not in trilha:
            err(ex_id, f"nível '{ex['nivel']}' não existe no manifest")
            continue
        pos_nivel, tipo, ato_id, conceitos_nivel = trilha[ex["nivel"]]
        if m and m.group(1) != ato_id:
            err(ex_id, f"id diz {m.group(1)} mas o nível '{ex['nivel']}' é do {ato_id}")

        if ex["tier"] not in (1, 2, 3):
            err(ex_id, f"tier inválido: {ex['tier']}")
            continue

        if not isinstance(ex["conceitos"], list) or not ex["conceitos"]:
            err(ex_id, "conceitos deve ser lista não-vazia")
        else:
            for c in ex["conceitos"]:
                if c not in vocab:
                    err(ex_id, f"conceito fora do vocabulário: '{c}'")
                elif primeiro_ensino[c] > pos_nivel:
                    err(ex_id, f"conceito '{c}' ainda não foi ensinado neste ponto da trilha")
            if tipo == "nivel" and not set(ex["conceitos"]) & set(conceitos_nivel):
                err(ex_id, "nenhum conceito do próprio nível está nas tags")

        if not (isinstance(ex["dicas"], list) and len(ex["dicas"]) == 3
                and all(isinstance(d, str) and d.strip() for d in ex["dicas"])):
            err(ex_id, "dicas deve ter EXATAMENTE 3 strings não-vazias")

        if not (isinstance(ex["testes_visiveis"], list) and len(ex["testes_visiveis"]) >= 1):
            err(ex_id, "testes_visiveis deve ter >= 1 teste")
        if not (isinstance(ex["testes_ocultos"], list) and len(ex["testes_ocultos"]) >= 2):
            err(ex_id, "testes_ocultos deve ter >= 2 testes")
        for t in list(ex.get("testes_visiveis", [])) + list(ex.get("testes_ocultos", [])):
            if not (isinstance(t, dict) and isinstance(t.get("nome"), str)
                    and isinstance(t.get("codigo"), str) and t["codigo"].strip()):
                err(ex_id, "teste sem nome/codigo válidos")
            elif "entradas" in t and not (isinstance(t["entradas"], list)
                                          and all(isinstance(e, str) for e in t["entradas"])):
                err(ex_id, f"teste '{t.get('nome')}': entradas deve ser lista de strings")

        base = XP_BASE[ex["tier"]]
        xp_certo = base * (3 if tipo == "boss" else 5 if tipo == "boss_final" else 1)
        if ex["xp"] != xp_certo:
            err(ex_id, f"xp deve ser {xp_certo} (tier {ex['tier']}, tipo {tipo}), veio {ex['xp']}")

        if not set(ex["pacotes"]) <= pacotes_ok:
            err(ex_id, f"pacotes fora do permitido: {ex['pacotes']}")
        if not set(ex["mocks"]) <= mocks_ok:
            err(ex_id, f"mocks fora do permitido: {ex['mocks']}")

        timeout_s = ex.get("timeout_s", 15 if ex["pacotes"] else 5)
        if not (isinstance(timeout_s, int) and 1 <= timeout_s <= 15):
            err(ex_id, f"timeout_s inválido: {timeout_s}")

        if "arquivos" in ex and not (isinstance(ex["arquivos"], dict)
                                     and all(isinstance(v, str) for v in ex["arquivos"].values())):
            err(ex_id, "arquivos deve ser dict nome->conteúdo (strings)")

        chave = (ex["nivel"], ex["tier"])
        if chave not in primeiro_de:
            primeiro_de.add(chave)
            if not (isinstance(ex.get("explicacao_md"), str) and ex["explicacao_md"].strip()):
                err(ex_id, "1º exercício do nível+tier precisa de explicacao_md não-nula")

        # proibições de conteúdo
        campos_codigo = [("starter_code", ex["starter_code"]),
                         ("solucao_referencia", ex["solucao_referencia"])]
        campos_codigo += [(f"teste '{t.get('nome')}'", t.get("codigo", ""))
                          for t in list(ex.get("testes_visiveis", []))
                          + list(ex.get("testes_ocultos", []))]
        for onde, texto in campos_codigo:
            for padrao, motivo in PROIBICOES:
                if padrao.search(texto or ""):
                    err(ex_id, f"{onde}: {motivo}")
        for onde in ("starter_code", "solucao_referencia"):
            texto = ex[onde] or ""
            if re.search(r"(?<![\w.])open\(", texto) and "encoding=" not in texto \
                    and not re.search(r"open\([^)]*['\"][rwa]b", texto):
                err(ex_id, f"{onde}: open() sem encoding='utf-8'")

    return erros


# ---------------------------------------------------------------------------
# Gates de contagem (só na verificação completa, sem filtros)
# ---------------------------------------------------------------------------
def validar_contagem(manifest, exercicios, faltando):
    erros = []
    if faltando:
        for f in faltando:
            erros.append(f"[CONTAGEM] arquivo de conteúdo ausente: {f}")
    por_nivel_tier = defaultdict(int)
    for _arq, _i, ex in exercicios:
        if "nivel" in ex and "tier" in ex:
            por_nivel_tier[(ex["nivel"], ex["tier"])] += 1
    total_niveis = 0
    for ato in manifest["atos"]:
        for nivel in ato["niveis"]:
            slug, tipo = nivel["slug"], nivel["tipo"]
            contagens = [por_nivel_tier[(slug, t)] for t in (1, 2, 3)]
            if tipo == "nivel":
                total_niveis += sum(contagens)
                if sum(contagens) < 12:
                    erros.append(f"[CONTAGEM] nível '{slug}': {sum(contagens)} exercícios (< 12)")
                for t, c in zip((1, 2, 3), contagens):
                    if c < 3:
                        erros.append(f"[CONTAGEM] nível '{slug}' tier {t}: {c} exercícios (< 3)")
            else:
                for t, c in zip((1, 2, 3), contagens):
                    if c < 3:
                        erros.append(f"[CONTAGEM] boss '{slug}' tier {t}: {c} etapas (< 3)")
    if total_niveis < 216:
        erros.append(f"[CONTAGEM] total de exercícios de nível: {total_niveis} (< 216)")
    return erros


# ---------------------------------------------------------------------------
# Execução
# ---------------------------------------------------------------------------
def montar_payload(ex, codigo):
    return json.dumps({
        "codigo": codigo,
        "testes_visiveis": ex["testes_visiveis"],
        "testes_ocultos": ex["testes_ocultos"],
        "mocks": ex["mocks"],
        "arquivos": ex.get("arquivos", {}),
        "timeout_s": ex.get("timeout_s", 15 if ex["pacotes"] else 5),
        "lang": LANG,
    }, ensure_ascii=False)


def motivo_falha(resultado):
    if resultado.get("_watchdog"):
        return "watchdog: excedeu o tempo do verify (processo morto)"
    status = resultado.get("status")
    if status == "erro_sintaxe":
        e = resultado.get("erro") or {}
        return f"erro de sintaxe na linha {e.get('linha')}: {e.get('mensagem_original')}"
    if status == "erro_execucao":
        e = resultado.get("erro") or {}
        return f"erro na execução (linha {e.get('linha')}): {e.get('mensagem_original')}"
    if status == "timeout":
        return "timeout"
    for t in resultado.get("testes", []):
        if not t.get("passou"):
            detalhe = t.get("mensagem") or (
                f"esperado {t.get('esperado')}, obtido {t.get('obtido')}"
            )
            oculto = " (oculto)" if t.get("oculto") else ""
            return f"teste '{t.get('nome')}'{oculto}: {detalhe}"
    return f"status inesperado: {status}"


def aplicar_reescritas(fonte, reescritas):
    """Aplica as reescritas de um mutante. Retorna None se alguma não mudou nada."""
    if isinstance(reescritas, dict):
        reescritas = reescritas[LANG]
    for padrao, troca in reescritas:
        novo = re.sub(padrao, troca, fonte)
        if novo == fonte:
            return None
        fonte = novo
    return fonte


def conferir_mutantes(pool, ex, timeout_ext):
    """Porta de mutação de um exercício. Retorna (lista de falhas, mortos, vivos-ok)."""
    falhas = []
    ex_id = ex["id"]
    mortos = 0
    for nome, reescritas in M.MUTANTES.get(ex_id, ()):
        fonte = aplicar_reescritas(ex["solucao_referencia"], reescritas)
        if fonte is None:
            falhas.append(f"mutante '{nome}' não se aplica mais à solução")
            continue
        r = json.loads(pool.executar(montar_payload(ex, fonte), timeout_ext))
        if r.get("status") == "ok":
            falhas.append(f"mutante '{nome}' passou em todos os testes")
        elif r.get("status") != "falha_teste":
            falhas.append(f"mutante '{nome}' não chegou aos testes: {motivo_falha(r)}")
        else:
            mortos += 1
    aceitas = 0
    for nome, reescritas in M.ALTERNATIVAS.get(ex_id, ()):
        fonte = aplicar_reescritas(ex["solucao_referencia"], reescritas)
        if fonte is None:
            falhas.append(f"alternativa '{nome}' não se aplica mais à solução")
            continue
        r = json.loads(pool.executar(montar_payload(ex, fonte), timeout_ext))
        if r.get("status") != "ok":
            falhas.append(f"alternativa correta '{nome}' reprovou: {motivo_falha(r)}")
        else:
            aceitas += 1
    return falhas, mortos, aceitas


def validar_comparacao():
    """A comparação do runner, direto na tabela de tools/mutantes.py."""
    caminho_py = os.path.join(RAIZ, "py")
    if caminho_py not in sys.path:
        sys.path.insert(0, caminho_py)
    import runner  # noqa: PLC0415

    class SempreIgual:
        def __eq__(self, _outro):
            return True

        __hash__ = None

    erros = []
    casos = list(M.COMPARACAO) + [(SempreIgual(), e, False) for e in ([1], 1, 1.5, "a", {"a": 1}, None)]
    try:
        import numpy as np  # noqa: PLC0415
    except ImportError:
        np = None
    if np is not None:
        casos += [(np.int64(3), 3, True), (np.float64(3.0), 3, False), (np.float64(0.5), 0.5, True),
                  (np.array([1, 2]), [1, 2], True), (np.array([1.0, 2.0]), [1, 2], False)]
    for obtido, esperado, igual in casos:
        if runner._iguais(obtido, esperado) != igual:
            erros.append(f"[COMPARACAO] _iguais({obtido!r}, {esperado!r}) deveria ser {igual}")
    return erros


def validar_mocks():
    """O contrato dos mocks e do runner que os exercícios não cobrem um a um."""
    caminho_py = os.path.join(RAIZ, "py")
    if caminho_py not in sys.path:
        sys.path.insert(0, caminho_py)
    import mocks_ia  # noqa: PLC0415
    import runner  # noqa: PLC0415

    erros = []

    def checa(condicao, texto):
        if not condicao:
            erros.append(f"[MOCKS] {texto}")

    mocks_ia.definir_idioma("pt")
    mocks_ia.instalar(["requests", "openai", "anthropic"])
    try:
        import anthropic  # noqa: PLC0415
        import openai  # noqa: PLC0415
        import requests  # noqa: PLC0415

        # cabeçalhos sem diferença de caixa, nos dois sentidos
        mocks_ia.roteirizar_falhas("/status", [429], retry_after=7)
        h = requests.get("https://api.dojo.dev/status").headers
        checa(h["retry-after"] == "7" and h.get("RETRY-AFTER") == "7" and "retry-AFTER" in h,
              "Retry-After deve valer em qualquer caixa")
        checa(requests.get("https://api.dojo.dev/segredo",
                           headers={"authorization": "Bearer tk_dojo_001"}).status_code == 200,
              "Authorization em minúsculas deve autenticar")
        s = requests.Session()
        s.headers["AUTHORIZATION"] = "Bearer tk_dojo_001"
        checa(s.get("https://api.dojo.dev/segredo").status_code == 200,
              "headers da Session valem em qualquer caixa")

        # hierarquia real dos erros: 400 é erro de API, mas não é rate limit
        for mod in (openai, anthropic):
            checa(issubclass(mod.BadRequestError, mod.APIStatusError)
                  and issubclass(mod.RateLimitError, mod.APIStatusError)
                  and not issubclass(mod.BadRequestError, mod.RateLimitError),
                  f"{mod.__name__}: hierarquia de erros difere do SDK real")

        # content em blocos, spy em texto, with_options e model_dump
        cli = openai.OpenAI()
        blocos = [{"type": "text", "text": "qual a capital do brasil?"}]
        r = cli.with_options(timeout=5).chat.completions.create(
            model="mock-4", messages=[{"role": "user", "content": blocos}])
        checa(r.choices[0].message.content == "Brasília", "content em blocos: OpenAI não leu o texto")
        checa(cli.chamadas[-1]["messages"][0]["content"] == "qual a capital do brasil?",
              "o spy guarda o content como texto")
        checa(r.model_dump()["choices"][0]["message"]["content"] == "Brasília"
              and json.loads(r.model_dump_json())["model"] == "mock-4",
              "model_dump e model_dump_json devem espelhar o objeto")
        ac = anthropic.Anthropic()
        r = ac.with_options(max_retries=0).messages.create(
            model="mock-claude", max_tokens=9, system=[{"type": "text", "text": "fale como pirata"}],
            messages=[{"role": "user", "content": blocos}])
        checa(r.content[0].text == "Arrr! Brasília", "content e system em blocos: Anthropic não leu o texto")

        # bad_request: 400 sem retry, nos dois clientes
        mocks_ia.reset_estado()
        mocks_ia.roteirizar_erros_llm(["bad_request", "bad_request"])
        for chamada, tipo in ((lambda: cli.chat.completions.create(model="m", messages=[]), openai.BadRequestError),
                              (lambda: ac.messages.create(model="m", max_tokens=1, messages=[]), anthropic.BadRequestError)):
            try:
                chamada()
                checa(False, "evento bad_request deveria levantar")
            except tipo:
                pass

        # roteiros de paginação
        mocks_ia.reset_estado()
        mocks_ia.roteirizar_paginas(4)
        corpo = requests.get("https://api.dojo.dev/usuarios", params={"pagina": 4}).json()
        checa(corpo["total_paginas"] == 4 and len(corpo["dados"]) == 1, "roteirizar_paginas(4): falta a página 4")
        mocks_ia.reset_estado()
        mocks_ia.roteirizar_paginas(2)
        corpo = requests.get("https://api.dojo.dev/usuarios", params={"pagina": 3}).json()
        checa(corpo["total_paginas"] == 2 and corpo["dados"] == [], "roteirizar_paginas(2): página 3 deveria vir vazia")
        mocks_ia.reset_estado()
        checa(requests.get("https://api.dojo.dev/usuarios").json()["total_paginas"] == 3,
              "reset_estado deve voltar às 3 páginas")
        mocks_ia.roteirizar_falhas("/modelos", ["avanca", "avanca"])
        c1 = requests.get("https://api.dojo.dev/modelos").json()
        c2 = requests.get("https://api.dojo.dev/modelos", params={"cursor": c1["proximo_cursor"]}).json()
        checa(c1["proximo_cursor"] and c1["proximo_cursor"] != c2["proximo_cursor"]
              and c1["modelos"][0]["id"] != c2["modelos"][0]["id"],
              "'avanca' deve devolver página e cursor novos a cada chamada")

        # pico de chamadas async: em sequência é 1, em paralelo é o total
        import asyncio  # noqa: PLC0415

        async def em_sequencia():
            for _ in range(3):
                await requests.aget("https://api.dojo.dev/status")

        async def em_paralelo():
            await asyncio.gather(*[requests.aget("https://api.dojo.dev/status") for _ in range(3)])

        mocks_ia.reset_estado()
        runner._rodar(em_sequencia())
        checa(mocks_ia.pico_paralelo() == 1, f"em sequência o pico é 1, veio {mocks_ia.pico_paralelo()}")
        mocks_ia.reset_estado()
        checa(mocks_ia.pico_paralelo() == 0, "reset_estado zera o pico")
        runner._rodar(em_paralelo())
        checa(mocks_ia.pico_paralelo() == 3, f"em paralelo o pico é 3, veio {mocks_ia.pico_paralelo()}")
    finally:
        mocks_ia.desinstalar()

    # os aliases en apontam para os mesmos objetos
    checa(mocks_ia.peak_parallel is mocks_ia.pico_paralelo and mocks_ia.script_pages is mocks_ia.roteirizar_paginas,
          "faltam os aliases en dos helpers novos")

    # teste que usa np/pd/OpenAI não depende do nome que o aluno importou
    payload = json.dumps({"codigo": "import numpy\nimport pandas\nimport openai\nf = 1\n", "mocks": ["openai"], "testes_visiveis": [
        {"nome": "np", "codigo": "assert np.array([1]).sum() == 1"},
        {"nome": "pd", "codigo": "assert len(pd.DataFrame({'a': [1]})) == 1"},
        {"nome": "OpenAI", "codigo": "assert (lambda: OpenAI())().chamadas == []"},
    ]})
    r = json.loads(runner.executar_json(payload))
    checa(r["status"] == "ok", f"testes não devem emprestar imports do aluno: {r['testes']}")
    payload = json.dumps({"codigo": "np = 'meu'\nf = lambda: np\n", "testes_visiveis": [
        {"nome": "np", "codigo": "assert np.array([1]).sum() == 1 and f() == 'meu'"},
    ]})
    r = json.loads(runner.executar_json(payload))
    checa(r["status"] == "ok", f"o nome do aluno continua dele, o do teste é o módulo: {r['testes']}")
    return erros


def executar_exercicios(exercicios):
    """Roda solução (deve passar) + starter (deve falhar) + porta de mutação de
    cada exercício. Retorna (ok, falhas). Compartilhado com tools/verify_fragment.py."""
    pool = Pool()
    falhas_exec = 0
    ok = 0
    mortos_total = 0
    aceitas_total = 0
    try:
        for _arq, _i, ex in exercicios:
            ex_id = ex.get("id", "?")
            campos = ("starter_code", "solucao_referencia", "testes_visiveis",
                      "testes_ocultos", "mocks", "pacotes", "tier", "nivel")
            if any(c not in ex for c in campos):
                continue  # já reportado no schema
            timeout_ext = max(TIMEOUT_EXTERNO, ex.get("timeout_s", 5) + 5)

            resultado = json.loads(pool.executar(montar_payload(ex, ex["solucao_referencia"]),
                                                 timeout_ext))
            if resultado.get("status") != "ok":
                falhas_exec += 1
                print(f"[FALHA] {ex_id} — solução: {motivo_falha(resultado)}")
                continue

            resultado_starter = json.loads(
                pool.executar(montar_payload(ex, ex["starter_code"]), timeout_ext))
            if resultado_starter.get("status") == "ok":
                falhas_exec += 1
                print(f"[FALHA] {ex_id} — starter já resolve os testes (anti-trivialidade)")
                continue

            falhas_mut, mortos, aceitas = conferir_mutantes(pool, ex, timeout_ext)
            mortos_total += mortos
            aceitas_total += aceitas
            if falhas_mut:
                falhas_exec += 1
                for f in falhas_mut:
                    print(f"[FALHA] {ex_id} — {f}")
                continue

            ok += 1
            print(f"[OK] {ex_id}")
    finally:
        pool.matar()
    print(f"\nPorta de mutação: {mortos_total} resposta(s) errada(s) reprovada(s), "
          f"{aceitas_total} alternativa(s) correta(s) aceita(s).")
    return ok, falhas_exec


def main():
    parser = argparse.ArgumentParser(description="Verificador do Python AI Dojo")
    parser.add_argument("--id", help="verifica só o exercício com este id")
    parser.add_argument("--ato", help="verifica só um ato (ex.: ato2) — bosses: 'bosses'")
    parser.add_argument("--nivel", help="verifica só um nível (slug, ex.: texto)")
    parser.add_argument("--lang", choices=IDIOMAS, default="pt",
                        help="idioma do conteúdo e do runner (padrão: pt)")
    args = parser.parse_args()
    global CONTENT, LANG
    LANG = args.lang
    CONTENT = pasta_conteudo(args.lang)
    if args.lang != "pt":
        print(f"Idioma: {args.lang} ({os.path.relpath(CONTENT, RAIZ)})")
    filtrado = bool(args.id or args.ato or args.nivel)

    os.environ["PYTHONHASHSEED"] = "0"
    os.environ["PYTHONUTF8"] = "1"

    manifest, exercicios, faltando = carregar_tudo()

    if args.id:
        exercicios = [(a, i, e) for a, i, e in exercicios if e.get("id") == args.id]
    if args.nivel:
        exercicios = [(a, i, e) for a, i, e in exercicios if e.get("nivel") == args.nivel]
    if args.ato:
        if args.ato == "bosses":
            exercicios = [(a, i, e) for a, i, e in exercicios if a == manifest["bosses_arquivo"]]
        else:
            trilha, _ = indice_trilha(manifest)
            exercicios = [(a, i, e) for a, i, e in exercicios
                          if trilha.get(e.get("nivel"), (None, None, None, None))[2] == args.ato]

    if not exercicios:
        print("Nenhum exercício encontrado com esse filtro.")
        sys.exit(1)

    print(f"Verificando {len(exercicios)} exercício(s)...")
    erros_schema = validar_schema(manifest, exercicios)
    for e in erros_schema:
        print(f"[FALHA] {e}")

    ok, falhas_exec = executar_exercicios(exercicios)

    erros_comparacao = validar_comparacao() + validar_mocks()
    for e in erros_comparacao:
        print(f"[FALHA] {e}")

    erros_contagem = [] if filtrado else validar_contagem(manifest, exercicios, faltando)
    for e in erros_contagem:
        print(f"[FALHA] {e}")

    # sumário por nível/tier
    por_nivel = defaultdict(lambda: [0, 0, 0])
    for _arq, _i, ex in exercicios:
        if "nivel" in ex and ex.get("tier") in (1, 2, 3):
            por_nivel[ex["nivel"]][ex["tier"] - 1] += 1
    print("\n--- contagem por nível (T1/T2/T3) ---")
    trilha, _ = indice_trilha(manifest)
    for slug in sorted(por_nivel, key=lambda s: trilha.get(s, (999,))[0]):
        c = por_nivel[slug]
        print(f"  {slug}: {c[0]}/{c[1]}/{c[2]} = {sum(c)}")

    total_falhas = len(erros_schema) + falhas_exec + len(erros_contagem) + len(erros_comparacao)
    print(f"\n{ok} verde(s), {total_falhas} falha(s), {len(exercicios)} exercício(s).")
    if total_falhas == 0:
        print("VERIFY: 100% VERDE")
        sys.exit(0)
    print("VERIFY: FALHOU")
    sys.exit(1)


if __name__ == "__main__":
    main()
