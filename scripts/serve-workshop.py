"""Serve the local workshop without reusing stale source or catalog responses."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class WorkshopHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    handler = partial(WorkshopHandler, directory=str(root))
    with ThreadingHTTPServer(("127.0.0.1", 8765), handler) as server:
        print("GoL workshop: http://127.0.0.1:8765/web/", flush=True)
        server.serve_forever()
