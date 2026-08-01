import os
import socket
import subprocess
import sys
import time
from pathlib import Path

import pytest


@pytest.fixture(scope="session")
def live_server_url():
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    sock.close()
    env = os.environ.copy()
    env["INNER_SIGNAL_MEDIA_ROOT"] = str(
        (Path(__file__).parent / "fixtures" / "media").resolve()
    )
    process = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "app.main:app",
            "--host",
            "127.0.0.1",
            "--port",
            str(port),
        ],
        env=env,
    )
    url = f"http://127.0.0.1:{port}"
    for _ in range(40):
        try:
            import urllib.request
            urllib.request.urlopen(f"{url}/api/health", timeout=0.2)
            break
        except Exception:
            time.sleep(0.1)
    yield url
    process.terminate()
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=5)
