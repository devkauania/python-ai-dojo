"""Servidor local do Python AI Dojo.

Por que existe (em vez de abrir o index.html direto):
- Web Workers nao funcionam em file://
- SharedArrayBuffer (interrupcao de loop infinito) exige os headers COOP/COEP
- No Windows, o mimetypes le o registro e pode servir .js como text/plain,
  o que mata <script type="module"> -- por isso o extensions_map e FORCADO.
"""
import os
import sys
import threading
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORTA = 8321
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class DojoHandler(SimpleHTTPRequestHandler):
    # HTTP/1.1 com keep-alive: sem isso, o burst de ~26 requests do boot abre
    # dezenas de conexoes novas e o Chrome ocasionalmente fica com fetch
    # PENDURADO (visto ao vivo: 2-3 dos 7 JSONs de conteudo nunca completavam).
    protocol_version = "HTTP/1.1"
    extensions_map = {
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".mjs": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".wasm": "application/wasm",
        ".py": "text/x-python; charset=utf-8",
        ".svg": "image/svg+xml",
        ".txt": "text/plain; charset=utf-8",
        "": "application/octet-stream",
    }

    def end_headers(self):
        # COOP/COEP habilitam crossOriginIsolated -> SharedArrayBuffer -> SIGINT
        # no worker. `credentialless` dispensa CORP nos recursos do jsdelivr.
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "credentialless")
        # Caching: o index.html (ponto de entrada) e SEMPRE fresco -- ele carrega o
        # import map com os ?v= atuais. Todo o resto (js/css/conteudo/py) e
        # versionado por ?v=N (bump = URL nova = cache miss = busca fresca), entao e
        # CACHEAVEL com seguranca. Isso torna o reload robusto (servido do cache, sem
        # depender da rede a cada load) e permite jogar offline apos o 1o carregamento
        # -- antes o `no-store` obrigava rede em TODO reload e um reload offline/flaky
        # derrubava o jogo (bug relatado ao resetar o progresso).
        caminho = self.path.split("?", 1)[0]
        if caminho in ("/", "/index.html") or caminho.endswith(".html"):
            self.send_header("Cache-Control", "no-store, must-revalidate")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
        else:
            self.send_header("Cache-Control", "public, max-age=31536000, immutable")
        super().end_headers()

    def log_message(self, formato, *args):
        pass  # silencioso; erros reais aparecem via traceback


def abrir_navegador():
    webbrowser.open(f"http://localhost:{PORTA}/")


def main():
    abrir = "--sem-navegador" not in sys.argv
    os.chdir(RAIZ)
    try:
        servidor = ThreadingHTTPServer(("127.0.0.1", PORTA), DojoHandler)
    except OSError:
        print(f"A porta {PORTA} ja esta em uso -- o Dojo provavelmente ja esta rodando.")
        if abrir:
            print(f"Abrindo http://localhost:{PORTA}/ ...")
            abrir_navegador()
        sys.exit(0)
    if abrir:
        threading.Timer(0.5, abrir_navegador).start()
    print(f"Python AI Dojo rodando em http://localhost:{PORTA}/  (Ctrl+C para parar)")
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print("\nAte a proxima!")


if __name__ == "__main__":
    main()
