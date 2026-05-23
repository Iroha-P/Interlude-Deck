# User Guide

This guide is the shortest path from zero to a working Shanka MVP.

## 1. Install

Run:

```bash
npm install
python -m pip install -r requirements.txt
```

Or double-click:

```text
scripts/install.cmd
```

## 2. Capture Codex Busy Template

1. Open Codex Desktop.
2. Start a task so the Stop/loading indicator is visible.
3. Run:

```bash
npm run capture:codex
```

Or double-click:

```text
scripts/capture_codex_template.cmd
```

Select the Stop/loading area in the screenshot and press Enter.
If you do not select a region, the full Codex window is saved as a fallback template. It is less accurate than a small region, but useful for first-run setup.

## 3. Start Shanka

Run:

```bash
npm run codex:mode
```

Or double-click:

```text
scripts/start_codex_mode.cmd
```

## 4. Check Health

Run:

```bash
npm run doctor
```

Or double-click:

```text
scripts/doctor.cmd
```

## 5. In-App Controls

- Use the `...` button to open settings.
- Choose vocabulary, tech cards, or mixed mode.
- Set unlock threshold: 2, 3, or 5 cards.
- Set reward duration: 15, 30, or 60 seconds.
- Set reward URL.
- Use mouse wheel down, `ArrowDown`, or `j` to advance the feed.
- Press `Space` or click the card to flip it.

## 6. Reset Busy Template

Delete files matching:

```text
data/detector/busy*.png
```

Then run `npm run capture:codex` again.
