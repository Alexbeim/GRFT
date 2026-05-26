#!/usr/bin/env python3
"""
Recorder dev server. Serves the GRFT+ folder over HTTP + accepts trace JSON
posts straight from the iPad — so you don't have to AirDrop the export.

Endpoints:
    GET  *               static file serving (recorder, fonts, etc.)
    POST /save-traces    body = full grft-traced-paths.json
                         writes to ~/.claude/skills/graffiti-text-animator/
                         assets/grft-traced-paths.json
                         (keeps a timestamped backup of the previous file)
"""
import datetime
import http.server
import json
import os
import shutil
import sys
from pathlib import Path
from urllib.parse import urlparse

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8767
SKILL_TARGET = Path.home() / '.claude' / 'skills' / 'graffiti-text-animator' / 'assets' / 'grft-traced-paths.json'


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        # Allow the iPad → Mac upload regardless of origin/port quirks.
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.end_headers()

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        if path != '/save-traces':
            self.send_error(404)
            return
        length = int(self.headers.get('Content-Length') or 0)
        if length <= 0 or length > 50_000_000:   # 50 MB sanity cap
            self.send_error(400, f'bad size {length}')
            return
        body = self.rfile.read(length)
        # Sanity: must parse as JSON
        try:
            data = json.loads(body)
            n_letters = len(data.get('letters', {}))
        except Exception as e:
            self.send_error(400, f'not valid JSON: {e}')
            return

        SKILL_TARGET.parent.mkdir(parents=True, exist_ok=True)
        # Back up the previous file alongside, dated
        if SKILL_TARGET.exists():
            ts = datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
            backup = SKILL_TARGET.with_suffix(f'.json.bak-{ts}')
            shutil.copy2(SKILL_TARGET, backup)
            print(f'[backup] {backup.name}', flush=True)
        SKILL_TARGET.write_bytes(body)
        print(f'[save-traces] {len(body)} bytes, {n_letters} letters → {SKILL_TARGET}', flush=True)

        resp = json.dumps({
            'ok': True,
            'path': str(SKILL_TARGET),
            'letters': n_letters,
            'bytes': len(body),
        }).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(resp)))
        self.end_headers()
        self.wfile.write(resp)


if __name__ == '__main__':
    addr = ('0.0.0.0', PORT)
    with http.server.ThreadingHTTPServer(addr, Handler) as httpd:
        print(f'Recorder server on http://0.0.0.0:{PORT}', flush=True)
        print(f'  Recorder : http://localhost:{PORT}/proto-letter-recorder.html', flush=True)
        print(f'  Upload   : POST http://localhost:{PORT}/save-traces', flush=True)
        print(f'  Writes to: {SKILL_TARGET}', flush=True)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\nShutting down.', flush=True)
