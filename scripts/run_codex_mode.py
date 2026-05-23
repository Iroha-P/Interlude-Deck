import subprocess
import sys
import time
from pathlib import Path
from urllib import error, request

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.codex_watch import DEFAULT_TEMPLATE_DIR, has_busy_templates


CONTROL_URL = "http://127.0.0.1:39473/health"


def control_server_ready() -> bool:
    try:
        with request.urlopen(CONTROL_URL, timeout=1) as response:
            return response.status == 200
    except error.URLError:
        return False


def wait_for_control_server(timeout_seconds: float = 10) -> bool:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        if control_server_ready():
            return True
        time.sleep(0.3)
    return False


def main() -> int:
    electron_process = None

    if not has_busy_templates(DEFAULT_TEMPLATE_DIR):
        print("No Codex busy template found. Starting template capture first.")
        print("Put Codex into a running state, then select the Stop/loading indicator.")
        capture = subprocess.run(["python", "scripts/capture_codex_template.py", "busy"], shell=False)
        if capture.returncode != 0 or not has_busy_templates(DEFAULT_TEMPLATE_DIR):
            print("Template capture did not complete. Run `npm run capture:codex` and try again.")
            return capture.returncode or 2

    if not control_server_ready():
        electron_process = subprocess.Popen(["npm.cmd", "start"], shell=False)

    if not wait_for_control_server():
        print("Shanka Electron control server did not start.")
        if electron_process:
            electron_process.terminate()
        return 1

    print("Shanka is running. Starting Codex watcher...")
    watcher = subprocess.Popen(["python", "scripts/codex_watch.py"], shell=False)

    try:
        return watcher.wait()
    except KeyboardInterrupt:
        watcher.terminate()
        if electron_process:
            electron_process.terminate()
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
