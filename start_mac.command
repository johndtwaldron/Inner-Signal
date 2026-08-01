#!/bin/zsh
set -e

app_root="${0:A:h}"
cd "$app_root"

if [[ ! -x ".venv/bin/python" ]]; then
  python3 -m venv .venv
  .venv/bin/pip install -r requirements-dev.txt
fi

open "http://127.0.0.1:8000"
echo "Inner Signal is also available to trusted devices on your Wi-Fi network."
lan_ip="$(ipconfig getifaddr en0 2>/dev/null || true)"
if [[ -n "$lan_ip" ]]; then
  echo "On this network, open: http://$lan_ip:8000"
fi
exec .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
