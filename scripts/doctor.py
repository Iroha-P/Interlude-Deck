import importlib.util
import json
import sys
from pathlib import Path
from urllib import error, request

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.codex_watch import DEFAULT_TEMPLATE_DIR, find_codex_windows, has_busy_templates


CONTROL_URL = "http://127.0.0.1:39473/health"
REQUIRED_MODULES = ["cv2", "numpy", "PIL", "win32gui", "win32process"]


def module_available(name: str) -> bool:
    return importlib.util.find_spec(name) is not None


def control_server_available() -> bool:
    try:
        with request.urlopen(CONTROL_URL, timeout=1) as response:
            return response.status == 200
    except error.URLError:
        return False


def collect_diagnostics() -> dict:
    modules = {name: module_available(name) for name in REQUIRED_MODULES}
    windows = find_codex_windows()
    return {
        "pythonModules": modules,
        "busyTemplate": has_busy_templates(DEFAULT_TEMPLATE_DIR),
        "codexWindows": len(windows),
        "controlServer": control_server_available(),
        "templateDir": str(DEFAULT_TEMPLATE_DIR),
    }


def all_ok(report: dict) -> bool:
    return (
        all(report["pythonModules"].values())
        and report["busyTemplate"]
        and report["codexWindows"] > 0
        and report["controlServer"]
    )


def main() -> int:
    report = collect_diagnostics()
    report["ok"] = all_ok(report)
    print(json.dumps(report, ensure_ascii=True, indent=2))

    if not report["busyTemplate"]:
        print("Next: run `npm run capture:codex` while Codex is busy.")
    if not report["controlServer"]:
        print("Next: run `npm start` or `npm run codex:mode`.")
    if report["codexWindows"] == 0:
        print("Next: open Codex Desktop.")

    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
