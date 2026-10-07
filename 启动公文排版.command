#!/bin/zsh
set -eu
cd "$(dirname "$0")"
if [[ ! -d .venv ]]; then
  python3 -m venv .venv
fi
.venv/bin/python -m pip install -q -r requirements.txt

URL="http://127.0.0.1:8766"
if lsof -nP -iTCP:8766 -sTCP:LISTEN >/dev/null 2>&1; then
  open "$URL"
  echo "公文排版已经在运行：$URL"
  exit 0
fi

.venv/bin/python -u app.py &
APP_PID=$!
trap 'kill "$APP_PID" 2>/dev/null || true' EXIT INT TERM

for _ in {1..40}; do
  if curl --noproxy '*' -fsS "$URL/" >/dev/null 2>&1; then
    open "$URL"
    echo "公文排版已启动：$URL"
    wait "$APP_PID"
    exit 0
  fi
  sleep 0.1
done

echo "启动失败：本地网页没有在预期时间内响应。"
exit 1
