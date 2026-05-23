import argparse
from pathlib import Path

import cv2
import numpy as np
import win32gui
from PIL import ImageGrab

from codex_watch import DEFAULT_TEMPLATE_DIR, find_codex_windows


def main() -> int:
    parser = argparse.ArgumentParser(description="Capture a Codex screenshot/template for busy-state matching.")
    parser.add_argument("name", nargs="?", default="busy", help="template name prefix, for example: busy")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_TEMPLATE_DIR)
    parser.add_argument("--full-window", action="store_true", help="save the full Codex window instead of an interactive crop")
    args = parser.parse_args()

    windows = find_codex_windows()
    if not windows:
        print("No Codex window found.")
        return 1

    rect = windows[0]["rect"]
    image = ImageGrab.grab(bbox=rect)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    output = args.output_dir / f"{args.name}.png"

    if args.full_window:
        image.save(output)
        print(output)
        return 0

    bgr = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
    roi = cv2.selectROI("Select Codex busy indicator, then press Enter", bgr, showCrosshair=True)
    cv2.destroyAllWindows()
    x, y, width, height = roi
    if width <= 0 or height <= 0:
        image.save(output)
        print("No crop selected. Saved the full Codex window as a fallback template.")
        print(output)
        return 0

    crop = image.crop((x, y, x + width, y + height))
    crop.save(output)
    print(output)
    win32gui.SetForegroundWindow(windows[0]["hwnd"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
