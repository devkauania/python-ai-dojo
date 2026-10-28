# -*- coding: utf-8 -*-
"""Verifica um FRAGMENTO de conteúdo (arquivo {"exercicios": [...]}) sem
precisar mesclar no banco — usado pelos agentes autores durante a produção.

Uso (a partir da raiz do projeto):
    .venv-verify/Scripts/python.exe -X utf8 tools/verify_fragment.py content/_frag-http.json

Roda as MESMAS validações de schema e execução do verify.py (menos os gates
de contagem global e a deduplicação entre arquivos, que acontecem na mescla).
Exit 0 somente com 100% verde.
"""
from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import verify as V  # noqa: E402


def main():
    if len(sys.argv) != 2:
        print("uso: verify_fragment.py <caminho-do-fragmento.json>")
        sys.exit(2)
    caminho = sys.argv[1]

    os.environ["PYTHONHASHSEED"] = "0"
    os.environ["PYTHONUTF8"] = "1"

    try:
        dados = V.carregar_json(caminho)
    except (OSError, json.JSONDecodeError) as e:
        print(f"[FALHA] não consegui ler {caminho}: {e}")
        sys.exit(1)

    exercicios = [(os.path.basename(caminho), i, ex)
                  for i, ex in enumerate(dados.get("exercicios", []))]
    if not exercicios:
        print("[FALHA] fragmento sem exercícios")
        sys.exit(1)

    manifest = V.carregar_json(os.path.join(V.CONTENT, "manifest.json"))
    print(f"Verificando {len(exercicios)} exercício(s) do fragmento...")

    erros_schema = V.validar_schema(manifest, exercicios)
    for e in erros_schema:
        print(f"[FALHA] {e}")

    ok, falhas_exec = V.executar_exercicios(exercicios)

    total_falhas = len(erros_schema) + falhas_exec
    print(f"\n{ok} verde(s), {total_falhas} falha(s), {len(exercicios)} exercício(s).")
    if total_falhas == 0:
        print("FRAGMENTO: 100% VERDE")
        sys.exit(0)
    print("FRAGMENTO: FALHOU")
    sys.exit(1)


if __name__ == "__main__":
    main()
