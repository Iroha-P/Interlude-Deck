import json
import sys
from urllib import error, request


COMMANDS = {"start", "pause", "resume", "end"}
PORT = 39473


def main() -> int:
    command = sys.argv[1] if len(sys.argv) > 1 else ""
    if command not in COMMANDS:
        print("Usage: python scripts/task_control.py <start|pause|resume|end>")
        return 2

    url = f"http://127.0.0.1:{PORT}/task/{command}"
    req = request.Request(url, method="POST")

    try:
        with request.urlopen(req, timeout=3) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except error.URLError as exc:
        print(f"Could not reach Shanka control server: {exc}")
        return 1

    print(json.dumps(payload, ensure_ascii=False))
    return 0 if payload.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
