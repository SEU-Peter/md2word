#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Local Markdown-to-Word interface."""

from __future__ import annotations

import html
import re
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, quote, urlparse

from gongwen import document_from_markdown

ROOT = Path(__file__).parent
EXAMPLE = (ROOT / "templates" / "example.md").read_text(encoding="utf-8")
PAGE_TEMPLATE = (ROOT / "templates" / "page.html").read_text(encoding="utf-8")


def page(message: str = "", source: str = EXAMPLE) -> bytes:
    notice = (
        '<p class="notice" role="alert">{}</p>'.format(html.escape(message))
        if message else ""
    )
    return (
        PAGE_TEMPLATE.replace("__NOTICE__", notice)
        .replace("__SOURCE__", html.escape(source))
        .replace("__STATIC_SCRIPT__", "")
        .encode("utf-8")
    )


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args: object) -> None:
        print("[gongwen-md] " + fmt % args)

    def do_GET(self) -> None:
        if urlparse(self.path).path != "/":
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        body = page()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self) -> None:
        if urlparse(self.path).path != "/generate":
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        size = int(self.headers.get("Content-Length", "0"))
        values = parse_qs(self.rfile.read(size).decode("utf-8"), keep_blank_values=True)
        markdown = values.get("markdown", [""])[0]
        try:
            title, data = document_from_markdown(markdown)
        except ValueError as error:
            body = page(str(error), markdown)
            self.send_response(HTTPStatus.BAD_REQUEST)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        safe = re.sub(r'[\\/:*?"<>|]+', "_", title).strip() or "公文"
        self.send_response(HTTPStatus.OK)
        self.send_header(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
        self.send_header(
            "Content-Disposition", "attachment; filename*=UTF-8''{}.docx".format(quote(safe))
        )
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", 8766), Handler)
    print("已启动：http://127.0.0.1:8766")
    server.serve_forever()
