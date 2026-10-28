@echo off
chcp 65001 >nul
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo Python 3.12+ nao encontrado no PATH. Instale em https://python.org e rode de novo.
  pause
  exit /b 1
)
echo Iniciando o Python AI Dojo em http://localhost:8321 ...
python -X utf8 tools\serve.py
