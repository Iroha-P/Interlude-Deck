import argparse
import json
import time
from dataclasses import dataclass
from pathlib import Path
from urllib import request

import cv2
import numpy as np
import win32gui
import win32process
from PIL import ImageGrab


CONTROL_PORT = 39473
DEFAULT_TEMPLATE_DIR = Path("data/detector")


def detect_template_score(screenshot: np.ndarray, template: np.ndarray) -> float:
    if screenshot.shape[0] < template.shape[0] or screenshot.shape[1] < template.shape[1]:
        return 0.0

    result = cv2.matchTemplate(screenshot, template, cv2.TM_CCOEFF_NORMED)
    _min_val, max_val, _min_loc, _max_loc = cv2.minMaxLoc(result)
    return float(max_val)


@dataclass
class BusyState:
    required_samples: int = 2
    current: bool = False
    candidate: bool | None = None
    candidate_count: int = 0

    def update(self, observed: bool) -> bool | None:
        if observed == self.current:
            self.candidate = None
            self.candidate_count = 0
            return None

        if observed != self.candidate:
            self.candidate = observed
            self.candidate_count = 1
            return None

        self.candidate_count += 1
        if self.candidate_count >= self.required_samples:
            self.current = observed
            self.candidate = None
            self.candidate_count = 0
            return self.current

        return None


def post_json(path: str, payload: dict | None = None) -> dict:
    data = json.dumps(payload or {}).encode("utf-8")
    req = request.Request(
        f"http://127.0.0.1:{CONTROL_PORT}{path}",
        data=data,
        method="POST",
        headers={"content-type": "application/json"},
    )
    with request.urlopen(req, timeout=2) as response:
        return json.loads(response.read().decode("utf-8"))


def infer_theme_from_screenshot(screenshot: np.ndarray) -> str:
    height, width = screenshot.shape[:2]
    top = int(height * 0.15)
    bottom = int(height * 0.85)
    left = int(width * 0.15)
    right = int(width * 0.85)
    sample = screenshot[top:bottom, left:right]
    gray = cv2.cvtColor(sample, cv2.COLOR_BGR2GRAY)
    return "dark" if float(np.median(gray)) < 128 else "light"


def find_codex_windows() -> list[dict]:
    windows: list[dict] = []

    def collect(hwnd, _extra):
        if not win32gui.IsWindowVisible(hwnd):
            return

        title = win32gui.GetWindowText(hwnd)
        _thread_id, process_id = win32process.GetWindowThreadProcessId(hwnd)
        rect = win32gui.GetWindowRect(hwnd)
        width = rect[2] - rect[0]
        height = rect[3] - rect[1]

        if width < 300 or height < 200:
            return

        class_name = win32gui.GetClassName(hwnd)
        haystack = f"{title} {class_name}".lower()
        if "codex" not in haystack:
            return

        windows.append(
            {
                "hwnd": hwnd,
                "title": title,
                "process_id": process_id,
                "rect": rect,
                "area": width * height,
            }
        )

    win32gui.EnumWindows(collect, None)
    return sorted(windows, key=lambda item: item["area"], reverse=True)


def window_rect_payload(rect) -> dict:
    left, top, right, bottom = rect
    return {"x": left, "y": top, "width": right - left, "height": bottom - top}


def capture_window(rect) -> np.ndarray:
    image = ImageGrab.grab(bbox=rect)
    return cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)


def load_templates(template_dir: Path) -> list[np.ndarray]:
    paths = sorted(template_dir.glob("busy*.png"))
    templates = []
    for path in paths:
        image = cv2.imread(str(path), cv2.IMREAD_COLOR)
        if image is not None:
            templates.append(image)
    return templates


def has_busy_templates(template_dir: Path) -> bool:
    return any(template_dir.glob("busy*.png"))


def command_for_busy_state(is_busy_state: bool) -> str:
    return "start" if is_busy_state else "end"


def focus_codex_window(hwnd) -> bool:
    try:
        if win32gui.IsIconic(hwnd):
            win32gui.ShowWindow(hwnd, 9)
        win32gui.SetForegroundWindow(hwnd)
        return True
    except Exception as exc:
        print(f"Could not focus Codex window: {exc}")
        return False


def is_busy(screenshot: np.ndarray, templates: list[np.ndarray], threshold: float) -> tuple[bool, float]:
    if not templates:
        return False, 0.0

    scores = [detect_template_score(screenshot, template) for template in templates]
    best = max(scores, default=0.0)
    return best >= threshold, best


def run_watch(args) -> int:
    templates = load_templates(args.template_dir)
    if not templates:
        try:
            post_json("/detector/status", {"connected": False, "message": "No busy template"})
        except Exception:
            pass
        print(f"No busy templates found in {args.template_dir}.")
        print("Capture one with: python scripts/capture_codex_template.py busy")
        return 2

    state = BusyState(required_samples=args.stable_samples)
    last_theme: str | None = None
    print(f"Watching Codex with {len(templates)} template(s), threshold={args.threshold}")

    while True:
        windows = find_codex_windows()
        if not windows:
            post_json("/detector/status", {"connected": False, "message": "Codex window not found"})
            time.sleep(args.interval)
            continue

        window = windows[0]
        rect = window["rect"]
        screenshot = capture_window(rect)
        theme = infer_theme_from_screenshot(screenshot)
        if theme != last_theme:
            post_json("/theme", {"theme": theme})
            last_theme = theme

        observed_busy, score = is_busy(screenshot, templates, args.threshold)
        post_json("/detector/status", {"connected": True, "busy": observed_busy, "score": score})
        changed = state.update(observed_busy)

        if changed is not None:
            payload = window_rect_payload(rect)
            post_json("/window/place", payload)
            command = command_for_busy_state(changed)
            result = post_json(f"/task/{command}")
            if not changed:
                focus_codex_window(window["hwnd"])
            print(json.dumps({"busy": changed, "score": score, "result": result}, ensure_ascii=False))

        time.sleep(args.interval)


def main() -> int:
    parser = argparse.ArgumentParser(description="Watch Codex Desktop and control Shanka Waiting Deck.")
    parser.add_argument("--template-dir", type=Path, default=DEFAULT_TEMPLATE_DIR)
    parser.add_argument("--threshold", type=float, default=0.88)
    parser.add_argument("--interval", type=float, default=0.7)
    parser.add_argument("--stable-samples", type=int, default=2)
    args = parser.parse_args()
    return run_watch(args)


if __name__ == "__main__":
    raise SystemExit(main())
