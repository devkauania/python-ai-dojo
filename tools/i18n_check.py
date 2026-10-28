# -*- coding: utf-8 -*-
"""Checagem de i18n do Python AI Dojo (pt -> en).

Uso:
    python -X utf8 tools/i18n_check.py                # relatório completo
    python -X utf8 tools/i18n_check.py --arquivo ato2-dados-texto-robustez.json
    python -X utf8 tools/i18n_check.py --estrito      # sobras de PT também reprovam
    python -X utf8 tools/i18n_check.py --amostras 0   # só contagens

O que confere:
  1. ESTRUTURA (reprova, exit 1): cada content/<arq>.json tem um
     content/en/<arq>.json com o MESMO esqueleto:
       - manifest: tudo idêntico, exceto títulos (titulo do jogo, dos atos e dos
         níveis) e o mapa opcional "rotulos_conceitos" {tag: rótulo};
       - arquivos de exercícios: mesmas chaves de topo; "ato"/"trilha" idênticos;
         mesmos ids NA MESMA ORDEM; cada exercício com o MESMO conjunto de chaves;
         campos fixos idênticos (id, nivel, tier, xp, conceitos, pacotes, mocks,
         timeout_s, categoria, editaveis); 3 dicas; mesma quantidade de testes
         visíveis/ocultos/web; cada teste com as mesmas chaves e o mesmo número de
         "entradas"; mesma quantidade de "arquivos" (fixtures).
  2. DICIONÁRIOS DA INTERFACE (reprova): js/i18n.js tem as mesmas chaves em pt e
     en; js/glossario-en.js cobre todas as chaves de js/glossario.js.
  3. SOBRAS DE PORTUGUÊS (aviso; reprova só com --estrito): heurística por lista
     de palavras PT frequentes + letras ã/õ/ç nos campos traduzíveis do en, e
     campos ainda IDÊNTICOS ao pt (não traduzidos).

A execução (solução passa / starter falha) é do verify:
    .venv-verify\\Scripts\\python -X utf8 tools\\verify.py --lang en --ato ato1
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections import Counter

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PT_DIR = os.path.join(RAIZ, "content")
EN_DIR = os.path.join(RAIZ, "content", "en")

CAMPOS_FIXOS = ("id", "nivel", "tier", "xp", "conceitos", "pacotes", "mocks",
                "timeout_s", "categoria", "editaveis")
CAMPOS_TESTES = ("testes_visiveis", "testes_ocultos", "testes_web")
# campos traduzíveis em PROSA (sobras aqui são as mais visíveis ao aluno)
CAMPOS_PROSA = ("titulo", "enunciado_md", "explicacao_md")
# campos traduzíveis em CÓDIGO (identificadores, strings e comentários)
CAMPOS_CODIGO = ("starter_code", "solucao_referencia", "web_html", "web_css", "web_js",
                 "solucao_html", "solucao_css", "solucao_js")

# palavras PT frequentes que não são palavras inglesas comuns. Ficaram de FORA
# de propósito as grafias que também são inglês corrente ("do", "no", "use",
# "some", "todo"): no conteúdo en elas são quase sempre inglês e só geravam
# falso positivo; o pt ainda é pego pelas centenas de outras palavras da lista.
PALAVRAS_PT = set("""
não você vocês seu sua seus suas nosso nossa para pra com uma umas uns que quê
qual quais quando onde como porque porquê então também mas mais menos muito
muita pouco já ainda sempre nunca cada toda todos todas outro outra
isso isto esse essa este esta aquele aquela aqui ali lá
de da dos das na nos nas pelo pela pelos pelas ao aos à às num numa
em entre sobre sem até depois antes
é são está estão foi ser ter tem têm fazer faz pode deve precisa vai
função funções lista listas texto textos número números valor valores
dicionário chave chaves arquivo arquivos linha linhas código erro erros
exemplo exemplos resultado retorna retorne devolve devolva escreva crie
usa usando receba recebe imprima mostre conte calcule soma
verdadeiro falso nada vazio vazia nome nomes idade preço produto usuário
teste testes dica dicas enunciado resposta pergunta mensagem saída entrada
""".split())
PALAVRAS_PT -= {"do", "no", "use", "some", "todo"}
RE_PALAVRA = re.compile(r"[A-Za-zÀ-ÿ]+")
# trechos que NÃO são texto a traduzir e saem antes da busca por palavras PT:
# nomes fixos do contrato (API _mocks, helpers de teste, ids do runner, eventos
# dos mocks), URLs/e-mails/domínios, cores hex e unidades CSS ("1.2em").
RE_NAO_TRADUZIVEL = re.compile(
    r"\b(?:embed_texto|roteirizar_erros_llm|historico_http|multi_blocos|args_invalidos)\b"
    r"|\.chamadas\b|(?<![A-Za-z0-9])_texto\b|__dojo_erro\b"
    r"|\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+|\bhttps?://\S+|\b[\w-]+(?:\.[\w-]+)*\.(?:com|dev|org|net|io)\b"
    r"|#[0-9A-Fa-f]{3,8}\b|(?<=\d)em\b")
RE_PT_LETRA = re.compile(r"[ãõçÃÕÇ]")


def carregar(caminho):
    with open(caminho, encoding="utf-8-sig") as f:
        return json.load(f)


# ---------------------------------------------------------------------------
# 1. estrutura
# ---------------------------------------------------------------------------
def checar_manifest(pt, en, erros):
    def sem_titulos(m, raiz=True):
        m = json.loads(json.dumps(m))
        if raiz:
            m.pop("titulo", None)
            m.pop("rotulos_conceitos", None)
        for ato in m.get("atos", []):
            ato.pop("titulo", None)
            for nv in ato.get("niveis", []):
                nv.pop("titulo", None)
        return m
    if sem_titulos(pt) != sem_titulos(en):
        erros.append("manifest.json: difere do pt fora dos campos traduzíveis "
                     "(titulo / atos[].titulo / niveis[].titulo / rotulos_conceitos)")
    rot = en.get("rotulos_conceitos")
    if rot is not None:
        conceitos = {c for ato in pt["atos"] for nv in ato["niveis"] for c in nv["conceitos"]}
        if not isinstance(rot, dict):
            erros.append("manifest.json: rotulos_conceitos deve ser um objeto {tag: rótulo}")
        else:
            for k in rot:
                if k not in conceitos:
                    erros.append(f"manifest.json: rotulos_conceitos tem tag desconhecida {k!r}")


def checar_testes(ex_id, campo, tpt, ten, erros):
    if not isinstance(ten, list) or len(tpt) != len(ten):
        erros.append(f"{ex_id}: {campo} tem {len(ten) if isinstance(ten, list) else '?'} "
                     f"teste(s), o pt tem {len(tpt)}")
        return
    for i, (a, b) in enumerate(zip(tpt, ten)):
        if set(a) != set(b):
            erros.append(f"{ex_id}: {campo}[{i}] chaves {sorted(b)} != pt {sorted(a)}")
            continue
        if "entradas" in a and len(a["entradas"] or []) != len(b["entradas"] or []):
            erros.append(f"{ex_id}: {campo}[{i}] tem {len(b['entradas'] or [])} entradas, "
                         f"o pt tem {len(a['entradas'] or [])}")


def checar_exercicios(nome, pt, en, erros, avisos):
    if set(pt) != set(en):
        erros.append(f"{nome}: chaves de topo {sorted(en)} != pt {sorted(pt)}")
    for k in ("ato", "trilha"):
        if k in pt and pt.get(k) != en.get(k):
            erros.append(f"{nome}: '{k}' deve ser idêntico ao pt ({pt.get(k)!r})")
    expt, exen = pt.get("exercicios", []), en.get("exercicios", [])
    ids_pt = [e.get("id") for e in expt]
    ids_en = [e.get("id") for e in exen]
    if ids_pt != ids_en:
        falta = [i for i in ids_pt if i not in ids_en]
        sobra = [i for i in ids_en if i not in ids_pt]
        msg = f"{nome}: ids diferem do pt (mesmos ids, mesma ordem)"
        if falta:
            msg += f"; faltam {falta[:5]}"
        if sobra:
            msg += f"; sobram {sobra[:5]}"
        if not falta and not sobra:
            msg += "; ordem diferente"
        erros.append(msg)
        return
    for a, b in zip(expt, exen):
        ex_id = a.get("id")
        if set(a) != set(b):
            erros.append(f"{ex_id}: chaves {sorted(set(b) ^ set(a))} diferem do pt")
        for c in CAMPOS_FIXOS:
            if c in a and a[c] != b.get(c):
                erros.append(f"{ex_id}: '{c}' deve ser idêntico ao pt ({a[c]!r}, veio {b.get(c)!r})")
        if "dicas" in a and len(b.get("dicas") or []) != len(a["dicas"]):
            erros.append(f"{ex_id}: {len(b.get('dicas') or [])} dicas, o pt tem {len(a['dicas'])}")
        for c in CAMPOS_TESTES:
            if c in a:
                checar_testes(ex_id, c, a[c], b.get(c), erros)
        if "arquivos" in a:
            arq_en = b.get("arquivos") or {}
            if len(arq_en) != len(a["arquivos"]):
                erros.append(f"{ex_id}: {len(arq_en)} arquivo(s) de fixture, o pt tem {len(a['arquivos'])}")
            elif set(arq_en) != set(a["arquivos"]):
                avisos.append(f"{ex_id}: fixtures renomeadas {sorted(a['arquivos'])} -> {sorted(arq_en)} "
                              "(ok se starter/solução/testes/enunciado usam os nomes novos)")


# ---------------------------------------------------------------------------
# 2. dicionários da interface
# ---------------------------------------------------------------------------
def chaves_objeto_js(fonte, nome):
    m = re.search(r"const " + re.escape(nome) + r" = \{(.*?)\n\};", fonte, re.S)
    if not m:
        return None
    return set(re.findall(r'^\s*"([^"]+)":', m.group(1), re.M))


def checar_dicionarios(erros):
    i18n = open(os.path.join(RAIZ, "js", "i18n.js"), encoding="utf-8").read()
    pt, en = chaves_objeto_js(i18n, "pt"), chaves_objeto_js(i18n, "en")
    if pt is None or en is None:
        erros.append("js/i18n.js: não achei os objetos 'const pt = {' / 'const en = {'")
    else:
        for k in sorted(pt - en):
            erros.append(f"js/i18n.js: chave {k!r} existe em pt mas falta em en")
        for k in sorted(en - pt):
            erros.append(f"js/i18n.js: chave {k!r} existe em en mas falta em pt")
    g_pt = open(os.path.join(RAIZ, "js", "glossario.js"), encoding="utf-8").read()
    g_en = open(os.path.join(RAIZ, "js", "glossario-en.js"), encoding="utf-8").read()
    kp = chaves_objeto_js(g_pt, "GLOSSARIO")
    ke = chaves_objeto_js(g_en, "GLOSSARIO_EN")
    if kp is None or ke is None:
        erros.append("glossário: não achei GLOSSARIO / GLOSSARIO_EN")
    else:
        for k in sorted(kp - ke):
            erros.append(f"js/glossario-en.js: falta o termo {k!r} do glossário pt")
    return (len(pt or ()), len(en or ()), len(kp or ()), len(ke or ()))


# ---------------------------------------------------------------------------
# 3. sobras de português
# ---------------------------------------------------------------------------
def sobras(texto):
    if not isinstance(texto, str):
        return []
    achadas = []
    for p in RE_PALAVRA.findall(RE_NAO_TRADUZIVEL.sub(" ", texto)):
        if p.casefold() in PALAVRAS_PT or RE_PT_LETRA.search(p):
            achadas.append(p)
    return achadas


def textos_traduziveis(a, b):
    """(campo, texto_pt, texto_en, tipo) de um exercício."""
    for c in CAMPOS_PROSA:
        if c in b:
            yield c, a.get(c), b.get(c), "prosa"
    for i, (dp, de) in enumerate(zip(a.get("dicas") or [], b.get("dicas") or [])):
        yield f"dicas[{i}]", dp, de, "prosa"
    for c in CAMPOS_TESTES:
        for i, (tp, te) in enumerate(zip(a.get(c) or [], b.get(c) or [])):
            yield f"{c}[{i}].nome", tp.get("nome"), te.get("nome"), "prosa"
            yield f"{c}[{i}].codigo", tp.get("codigo"), te.get("codigo"), "codigo"
    for c in CAMPOS_CODIGO:
        if c in b:
            yield c, a.get(c), b.get(c), "codigo"
    for (np_, vp), (ne, ve) in zip(sorted((a.get("arquivos") or {}).items()),
                                   sorted((b.get("arquivos") or {}).items())):
        yield f"arquivos[{ne}]", vp, ve, "codigo"


def main():
    ap = argparse.ArgumentParser(description="Checagem de i18n (estrutura en == pt + sobras de PT)")
    ap.add_argument("--arquivo", help="só um arquivo de conteúdo (ex.: ato1-fundamentos.json)")
    ap.add_argument("--estrito", action="store_true", help="sobras de PT também reprovam")
    ap.add_argument("--amostras", type=int, default=3, help="exemplos de sobras por arquivo (padrão 3)")
    args = ap.parse_args()

    erros, avisos = [], []
    if not os.path.isdir(EN_DIR):
        print(f"[FALHA] pasta {os.path.relpath(EN_DIR, RAIZ)} não existe")
        sys.exit(1)

    n_pt, n_en, g_pt, g_en = checar_dicionarios(erros)
    print(f"interface: {n_pt} chaves pt / {n_en} chaves en · glossário: {g_pt} pt / {g_en} en")

    nomes = sorted(f for f in os.listdir(PT_DIR) if f.endswith(".json"))
    if args.arquivo:
        nomes = [n for n in nomes if n == args.arquivo]
        if not nomes:
            print(f"[FALHA] {args.arquivo} não existe em content/")
            sys.exit(1)
    for extra in sorted(f for f in os.listdir(EN_DIR) if f.endswith(".json")):
        if not os.path.exists(os.path.join(PT_DIR, extra)):
            erros.append(f"en/{extra}: não existe no pt (os nomes de arquivo são os mesmos)")

    total_sobras = 0
    print("\n--- sobras de português nos campos traduzíveis do en ---")
    print(f"{'arquivo':34} {'exerc.':>6} {'idênt.':>7} {'PT prosa':>9} {'PT código':>10}")
    for nome in nomes:
        cpt = os.path.join(PT_DIR, nome)
        cen = os.path.join(EN_DIR, nome)
        if not os.path.exists(cen):
            erros.append(f"en/{nome}: arquivo ausente")
            continue
        pt, en = carregar(cpt), carregar(cen)
        if nome == "manifest.json":
            checar_manifest(pt, en, erros)
            tit = [(a.get("titulo"), b.get("titulo")) for a, b in zip(pt["atos"], en["atos"])]
            tit += [(x.get("titulo"), y.get("titulo"))
                    for a, b in zip(pt["atos"], en["atos"])
                    for x, y in zip(a["niveis"], b["niveis"])]
            iguais = sum(1 for x, y in tit if x == y)
            s = sum(len(sobras(y)) for _x, y in tit)
            total_sobras += s
            print(f"{nome:34} {'-':>6} {iguais:>4}/{len(tit):<2} {s:>9} {'-':>10}")
            continue
        checar_exercicios(nome, pt, en, erros, avisos)
        prosa, codigo, identicos, campos = Counter(), Counter(), 0, 0
        exemplos = []
        for a, b in zip(pt.get("exercicios", []), en.get("exercicios", [])):
            for campo, tp, te, tipo in textos_traduziveis(a, b):
                if not isinstance(te, str) or not te.strip():
                    continue
                campos += 1
                if te == tp:
                    identicos += 1
                ach = sobras(te)
                if ach:
                    (prosa if tipo == "prosa" else codigo).update(ach)
                    if tipo == "prosa" and len(exemplos) < args.amostras:
                        exemplos.append(f"    {a.get('id')} {campo}: {', '.join(ach[:6])}")
        sp, sc = sum(prosa.values()), sum(codigo.values())
        total_sobras += sp + sc
        print(f"{nome:34} {len(en.get('exercicios', [])):>6} {identicos:>4}/{campos:<4} {sp:>7} {sc:>10}")
        for e in exemplos:
            print(e)
        if args.amostras and codigo:
            print("    código, mais frequentes: " +
                  ", ".join(f"{p}×{n}" for p, n in codigo.most_common(8)))

    for a in avisos:
        print(f"[AVISO] {a}")
    for e in erros:
        print(f"[FALHA] {e}")
    print(f"\nestrutura: {'OK' if not erros else f'{len(erros)} erro(s)'} · "
          f"sobras de PT: {total_sobras} palavra(s)")
    if erros:
        print("I18N: ESTRUTURA QUEBRADA")
        sys.exit(1)
    if args.estrito and total_sobras:
        print("I18N: SOBRAS DE PORTUGUÊS (--estrito)")
        sys.exit(1)
    print("I18N: ESTRUTURA OK" + (" (tradução incompleta)" if total_sobras else ""))
    sys.exit(0)


if __name__ == "__main__":
    main()
