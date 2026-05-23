const { contextBridge, ipcRenderer } = require("electron");
const fs = require("fs");
const path = require("node:path");

contextBridge.exposeInMainWorld("shanka", {
  loadCards: async () => {
    const filePath = path.join(__dirname, "..", "data", "vocabulary.json");
    const raw = await fs.promises.readFile(filePath, "utf8");
    return JSON.parse(raw);
  },
  loadCardSources: async () => {
    const vocabularyPath = path.join(__dirname, "..", "data", "vocabulary.json");
    const techPath = path.join(__dirname, "..", "data", "tech_cards.json");
    const [vocabularyRaw, techRaw] = await Promise.all([
      fs.promises.readFile(vocabularyPath, "utf8"),
      fs.promises.readFile(techPath, "utf8")
    ]);

    return {
      vocabulary: JSON.parse(vocabularyRaw),
      tech: JSON.parse(techRaw)
    };
  },
  openDouyinReward: () => ipcRenderer.invoke("open-douyin-reward"),
  getSettings: () => ipcRenderer.invoke("get-settings"),
  saveSettings: (settings) => ipcRenderer.invoke("save-settings", settings),
  focusLearningWindow: () => ipcRenderer.invoke("focus-learning-window"),
  hideLearningWindow: () => ipcRenderer.invoke("hide-learning-window"),
  getTheme: () => ipcRenderer.invoke("get-theme"),
  getDetectorStatus: () => ipcRenderer.invoke("get-detector-status"),
  onThemeChanged: (callback) => {
    ipcRenderer.on("theme-changed", (_event, theme) => callback(theme));
  },
  onDetectorStatus: (callback) => {
    ipcRenderer.on("detector-status", (_event, status) => callback(status));
  },
  onSettingsChanged: (callback) => {
    ipcRenderer.on("settings-changed", (_event, settings) => callback(settings));
  },
  onTaskCommand: (callback) => {
    ipcRenderer.on("task-command", (_event, command) => callback(command));
  }
});
