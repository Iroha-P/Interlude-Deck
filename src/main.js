import { app, BrowserWindow, globalShortcut, ipcMain, nativeTheme, screen, shell } from "electron";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { computeOverlayBounds } from "./windowPlacement.js";
import { normalizeDetectorStatus } from "./detectorStatus.js";
import { defaultSettings, normalizeSettings } from "./settings.js";
import { normalizeTheme } from "./theme.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let controlServer;
let themeOverride = process.env.SHANKA_THEME === "light" ? "light" : "dark";
let detectorStatus = normalizeDetectorStatus();
let settings = defaultSettings();
const controlPort = Number(process.env.SHANKA_CONTROL_PORT ?? 39473);
const validCommands = new Set(["start", "pause", "resume", "end"]);
const validThemes = new Set(["dark", "light"]);

function focusLearningWindow() {
  if (!mainWindow) {
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.setAlwaysOnTop(true, "screen-saver");
  mainWindow.focus();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 430,
    height: 760,
    minWidth: 330,
    minHeight: 640,
    alwaysOnTop: true,
    title: "Interlude Deck",
    backgroundColor: "#0f0f10",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));
  focusLearningWindow();
}

function settingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function loadSettings() {
  try {
    const raw = fs.readFileSync(settingsPath(), "utf8");
    settings = normalizeSettings(JSON.parse(raw));
  } catch {
    settings = defaultSettings();
  }

  return settings;
}

function saveSettings(nextSettings) {
  settings = normalizeSettings({ ...settings, ...nextSettings });
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2), "utf8");
  mainWindow?.webContents.send("settings-changed", settings);
  return settings;
}

function currentTheme() {
  return normalizeTheme(themeOverride ?? nativeTheme.shouldUseDarkColors);
}

function broadcastTheme() {
  mainWindow?.webContents.send("theme-changed", currentTheme());
}

function setThemeOverride(theme) {
  if (!validThemes.has(theme)) {
    return false;
  }

  themeOverride = theme;
  broadcastTheme();
  return true;
}

function setDetectorStatus(status) {
  detectorStatus = normalizeDetectorStatus(status);
  mainWindow?.webContents.send("detector-status", detectorStatus);
  if (detectorStatus.busy) {
    sendTaskCommand("start");
  }
  return detectorStatus;
}

function sendTaskCommand(command) {
  if (!validCommands.has(command)) {
    return false;
  }

  if (command === "start" || command === "resume") {
    focusLearningWindow();
  }

  mainWindow?.webContents.send("task-command", command);
  return true;
}

function placeNearTarget(target) {
  if (!mainWindow) {
    return false;
  }

  const display = screen.getDisplayMatching({
    x: target.x,
    y: target.y,
    width: target.width,
    height: target.height
  });
  const screenBounds = display.workArea;
  const normalizedTarget = {
    x: target.x - screenBounds.x,
    y: target.y - screenBounds.y,
    width: target.width,
    height: target.height
  };
  const bounds = computeOverlayBounds({
    target: normalizedTarget,
    overlay: { width: 360, height: 720 },
    screen: { width: screenBounds.width, height: screenBounds.height }
  });

  mainWindow.setBounds({
    x: screenBounds.x + bounds.x,
    y: screenBounds.y + bounds.y,
    width: bounds.width,
    height: bounds.height
  });
  return true;
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    let failed = false;
    request.on("data", (chunk) => {
      if (failed) {
        return;
      }
      body += chunk;
      if (body.length > 8192) {
        failed = true;
        reject(new Error("Request body too large"));
        request.destroy();
      }
    });
    request.on("error", reject);
    request.on("end", () => {
      if (failed) {
        return;
      }
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function startControlServer() {
  controlServer = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
      const match = url.pathname.match(/^\/task\/(start|pause|resume|end)$/);

      if (request.method === "GET" && url.pathname === "/health") {
        response.writeHead(200, { "content-type": "application/json", "connection": "close" });
        response.end(JSON.stringify({ ok: true, port: controlPort }));
        return;
      }

      if (request.method === "POST" && url.pathname === "/window/place") {
        try {
          const body = await readJsonBody(request);
          const ok = placeNearTarget(body);
          response.writeHead(ok ? 200 : 400, { "content-type": "application/json", "connection": "close" });
          response.end(JSON.stringify({ ok }));
        } catch (error) {
          response.writeHead(400, { "content-type": "application/json", "connection": "close" });
          response.end(JSON.stringify({ ok: false, error: error.message }));
        }
        return;
      }

      if (request.method === "POST" && url.pathname === "/theme") {
        try {
          const body = await readJsonBody(request);
          const ok = setThemeOverride(body.theme);
          response.writeHead(ok ? 200 : 400, { "content-type": "application/json", "connection": "close" });
          response.end(JSON.stringify({ ok, theme: currentTheme() }));
        } catch (error) {
          response.writeHead(400, { "content-type": "application/json", "connection": "close" });
          response.end(JSON.stringify({ ok: false, error: error.message }));
        }
        return;
      }

      if (request.method === "POST" && url.pathname === "/detector/status") {
        try {
          const body = await readJsonBody(request);
          const status = setDetectorStatus(body);
          response.writeHead(200, { "content-type": "application/json", "connection": "close" });
          response.end(JSON.stringify({ ok: true, status }));
        } catch (error) {
          response.writeHead(400, { "content-type": "application/json", "connection": "close" });
          response.end(JSON.stringify({ ok: false, error: error.message }));
        }
        return;
      }

      if (request.method !== "POST" || !match) {
        response.writeHead(404, { "content-type": "application/json", "connection": "close" });
        response.end(JSON.stringify({ ok: false, error: "Not found" }));
        return;
      }

      const command = match[1];
      const ok = sendTaskCommand(command);
      response.writeHead(ok ? 200 : 400, { "content-type": "application/json", "connection": "close" });
      response.end(JSON.stringify({ ok, command }));
    } catch (error) {
      response.writeHead(500, { "content-type": "application/json", "connection": "close" });
      response.end(JSON.stringify({ ok: false, error: error.message }));
    }
  });

  controlServer.listen(controlPort, "127.0.0.1");
}

app.whenReady().then(() => {
  loadSettings();
  createWindow();
  startControlServer();
  globalShortcut.register("CommandOrControl+Shift+S", focusLearningWindow);
  nativeTheme.on("updated", broadcastTheme);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("will-quit", () => {
  controlServer?.close();
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.handle("open-douyin-reward", async () => {
  await shell.openExternal(settings.rewardUrl);
  return { ok: true };
});

ipcMain.handle("focus-learning-window", () => {
  focusLearningWindow();
  return { ok: true };
});

ipcMain.handle("hide-learning-window", () => {
  if (mainWindow) {
    mainWindow.hide();
  }

  return { ok: true };
});

ipcMain.handle("get-theme", () => currentTheme());

ipcMain.handle("get-detector-status", () => detectorStatus);

ipcMain.handle("get-settings", () => settings);

ipcMain.handle("save-settings", (_event, nextSettings) => saveSettings(nextSettings));
