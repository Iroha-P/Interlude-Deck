<div align="center">

# Interlude Deck

> Turn AI waiting time into a tiny loop of learning, cleanup, and reward.

**A short-video-style microlearning companion for Codex Desktop on Windows.**
<br>
It appears while your AI agent is working, helps you finish a few lightweight cards, unlocks a timed reward, and disappears the moment Codex needs you back.
<br><br>

<a href="https://github.com/Iroha-P/Shanka">
  <img src="https://img.shields.io/badge/status-MVP-FF9500?style=flat-square" alt="MVP">
</a>
<a href="LICENSE">
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License: MIT">
</a>
<img src="https://img.shields.io/badge/platform-Windows-lightgrey?style=flat-square" alt="Windows">
<img src="https://img.shields.io/badge/Electron-35-47848F?style=flat-square" alt="Electron">
<img src="https://img.shields.io/badge/Python-3.8+-3776AB?style=flat-square" alt="Python">

<a href="#features">Features</a> ·
<a href="#screenshots">Screenshots</a> ·
<a href="#ui-guide">UI Guide</a> ·
<a href="#how-it-works">How It Works</a> ·
<a href="#usage">Usage</a> ·
<a href="#project-structure">Project Structure</a>

</div>

> **Windows-only MVP.** Interlude Deck watches Codex Desktop as an external companion app. It does not modify Codex internals; instead, it uses lightweight window detection and a local control bridge to show or hide the learning deck at the right time.

---

## Why Interlude Deck

AI coding agents often leave you with 30 seconds to 3 minutes of awkward downtime. That gap is too short for deep work, but long enough to drift into an endless feed.

Interlude Deck turns that gap into a controlled interlude:

- review a few vocabulary or technical cards
- unlock a short timed reward
- return to Codex automatically when the agent finishes

The goal is not to be strict productivity software. It is a softer replacement for unconscious scrolling: fast, tactile, low-friction, and easy to leave.

## Features

- **Codex-aware overlay**: shows when Codex is detected as busy, hides when the busy state ends
- **Always-on-top phone deck**: a compact, vertical feed inspired by short-video apps
- **Microlearning cards**: vocabulary cards, technical cards, or mixed mode
- **Reward gating**: finish N cards to unlock a timed reward link
- **Douyin reward mode**: opens the reward page for 15, 30, or 60 seconds, then returns to the learning deck
- **Focus return**: when Codex is ready, Interlude Deck hides and brings Codex back to the foreground
- **Theme bridge**: accepts light or dark theme hints from the watcher
- **Local settings**: reward URL, card mode, unlock count, and reward duration are saved locally
- **External control API**: other scripts can start, pause, resume, end, place, or theme the deck
- **First-run template capture**: capture the Codex Stop/loading region for local busy-state detection

## Screenshots

### Phone Feed

<img src="docs/images/01-phone-feed.png" width="360" alt="Interlude Deck phone feed" />

### Reward Unlocked

<img src="docs/images/02-reward-unlocked.png" width="360" alt="Interlude Deck reward unlocked" />

### Settings Sheet

<img src="docs/images/03-settings-sheet.png" width="360" alt="Interlude Deck settings sheet" />

## UI Guide

Interlude Deck is designed as a small phone-shaped layer beside Codex, so it feels like a contained feed rather than a full desktop app.

### Feed State

The main screen shows one card at a time. Use the mouse wheel, `ArrowDown`, or `j` to move to the next card. Press `Space` or click the card to flip between question and answer.

| Element | Description |
|---------|-------------|
| Top status bar | Codex connection, busy state, and detector score |
| Mode tabs | Vocabulary, tech cards, or mixed card flow |
| Unlock counter | Shows how many cards remain before the reward unlocks |
| Card body | Front/back learning content |
| Action rail | Flip, pass, keep learning, and reward actions |

### Reward State

After the configured number of cards is completed, the reward button becomes available. By default it opens `https://www.douyin.com` in your browser for a timed break.

When the timer ends, Interlude Deck returns to the learning window. If Codex finishes earlier, the watcher hides Interlude Deck and restores Codex focus.

### Settings State

The settings sheet controls:

- reward URL
- content mode
- unlock threshold: 2, 3, or 5 cards
- reward duration: 15, 30, or 60 seconds

Settings are stored in Electron user data, so they survive restarts.

## How It Works

```text
Codex Desktop window
        |
        | screenshot template detection
        v
Python watcher
        |
        | localhost control bridge
        v
Electron overlay window
        |
        | reward / focus / hide commands
        v
Browser + Codex foreground
```

1. The Python watcher finds the Codex window.
2. It compares a captured Stop/loading template against the current Codex screenshot.
3. When the template is visible, Interlude Deck receives `/task/start` and appears near Codex.
4. When the template disappears, Interlude Deck receives `/task/end`, hides, and Codex is brought back to the foreground.
5. The Electron window manages cards, settings, reward timing, and the short-video-style interaction loop.

## Requirements

- **Windows 10/11**
- **Node.js 18+**
- **Python 3.8+**
- **Codex Desktop**
- Python packages from `requirements.txt`

## Usage

### Option 1: Quick Start

```powershell
git clone https://github.com/Iroha-P/Shanka.git
cd Shanka
npm install
python -m pip install -r requirements.txt
```

If Electron download is slow in your region, install with a mirror:

```powershell
$env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'
npm install
```

### Option 2: Windows Scripts

Double-click these scripts in order:

```text
scripts/install.cmd
scripts/capture_codex_template.cmd
scripts/start_codex_mode.cmd
```

Use `scripts/doctor.cmd` when you want to check the local setup.

## First-Run Setup

### 1. Capture Codex Busy Template

Open Codex Desktop, start a task, and make sure the Stop/loading indicator is visible.

Then run:

```powershell
npm run capture:codex
```

Select a stable Stop/loading region and press `Enter`.

If you do not select a region, Interlude Deck saves the full Codex window as a fallback template. A small region is more accurate, but the fallback is useful for first-run setup.

### 2. Start Codex Mode

```powershell
npm run codex:mode
```

Interlude Deck starts its Electron window, launches the watcher, and begins reacting to Codex busy states.

### 3. Check Health

```powershell
npm run doctor
```

The doctor checks Python modules, captured templates, Codex windows, and the local Electron control server.

## Commands

```powershell
npm start              # Start the Electron deck only
npm run capture:codex  # Capture Codex busy/loading template
npm run codex:mode     # Start Electron + Codex watcher
npm run watch:codex    # Start only the watcher
npm run doctor         # Check local setup
npm test               # Run JS and Python tests
```

## Local Control API

Electron listens on `127.0.0.1:39473`.

```powershell
curl -X POST http://127.0.0.1:39473/task/start
curl -X POST http://127.0.0.1:39473/task/pause
curl -X POST http://127.0.0.1:39473/task/resume
curl -X POST http://127.0.0.1:39473/task/end
```

Python helper:

```powershell
python scripts/task_control.py start
python scripts/task_control.py end
```

Other endpoints:

```text
GET  /health
POST /window/place
POST /theme
POST /detector/status
```

## Project Structure

```text
Shanka/
├─ data/
│  ├─ vocabulary.json              # Vocabulary card source
│  ├─ tech_cards.json              # Technical card source
│  └─ detector/                    # Local Codex busy templates
├─ docs/
│  ├─ images/                      # README screenshots
│  ├─ MVP.md                       # MVP delivery notes
│  └─ USER_GUIDE.md                # Step-by-step user guide
├─ scripts/
│  ├─ capture_codex_template.py    # First-run Codex template capture
│  ├─ codex_watch.py               # Codex window detector and controller
│  ├─ run_codex_mode.py            # Electron + watcher launcher
│  ├─ doctor.py                    # Local diagnostics
│  └─ task_control.py              # Manual control helper
├─ src/
│  ├─ main.js                      # Electron main process and local API
│  ├─ preload.cjs                  # Safe renderer bridge
│  ├─ renderer.js                  # UI interactions
│  ├─ styles.css                   # Phone deck visual system
│  └─ *.test.js                    # Node test suite
└─ tests/
   └─ test_codex_watch.py          # Python watcher tests
```

## Troubleshooting

### The template capture window says "No crop selected"

Run the capture again and drag a small box around the Codex Stop/loading area. If you press cancel, the script saves a full-window fallback template.

### The deck does not appear when Codex is busy

Run:

```powershell
npm run doctor
```

Then recapture the busy template:

```powershell
npm run capture:codex
```

### The reward page does not close automatically

The MVP opens reward links in the external browser. Interlude Deck controls the reward timer and returns focus to the deck, but it does not close the browser tab. Future versions can add an embedded or controlled browser mode.

## Roadmap

- import custom word lists
- spaced repetition scheduling
- digital declutter mode for Downloads and bookmarks
- mindfulness mode for eye breaks and breathing
- richer Codex state detection
- packaged Windows release
- optional embedded reward browser

## License

MIT

---

## Report a Bug via Your Code Agent

Copy this prompt into your coding agent to generate a structured issue:

<details>
<summary>Click to expand</summary>

I'm having an issue with Interlude Deck (https://github.com/Iroha-P/Shanka).

Please help me file a GitHub issue. Do the following:

1. Collect my environment info:
   - Run `systeminfo | findstr /B /C:"OS Name" /C:"OS Version"` to get Windows version
   - Run `node --version` to get Node.js version
   - Run `python --version` to get Python version
   - Run `npm run doctor` from the project folder
   - Check whether Codex Desktop is running

2. Ask me to describe:
   - What I expected to happen
   - What actually happened
   - Steps to reproduce

3. Create the issue on GitHub using `gh issue create` with this format:
   - Title: concise summary
   - Body sections: **Environment**, **Description**, **Steps to Reproduce**, **Expected vs Actual Behavior**
   - Add label `bug` if applicable

Repository: Iroha-P/Shanka

</details>
