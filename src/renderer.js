import {
  answerCurrentCard,
  applyTaskCommand,
  createSession,
  endTask,
  finishReward,
  pauseTask,
  resumeTask,
  startReward,
  startTask,
  tickReward
} from "./session.js";
import { isNextFeedGesture, nextFeedbackClass } from "./feedController.js";
import { selectCardsByMode } from "./cardSources.js";
import { normalizeSettings } from "./settings.js";

const elements = {
  unlockAfter: document.querySelector("#unlockAfter"),
  rewardSeconds: document.querySelector("#rewardSeconds"),
  card: document.querySelector("#card"),
  progressText: document.querySelector("#progressText"),
  statusText: document.querySelector("#statusText"),
  word: document.querySelector("#word"),
  phonetic: document.querySelector("#phonetic"),
  answerPanel: document.querySelector("#answerPanel"),
  meaning: document.querySelector("#meaning"),
  example: document.querySelector("#example"),
  flipButton: document.querySelector("#flipButton"),
  knownButton: document.querySelector("#knownButton"),
  fuzzyButton: document.querySelector("#fuzzyButton"),
  rewardHint: document.querySelector("#rewardHint"),
  rewardButton: document.querySelector("#rewardButton"),
  countdownPanel: document.querySelector("#countdownPanel"),
  countdownText: document.querySelector("#countdownText"),
  taskHint: document.querySelector("#taskHint"),
  startTaskButton: document.querySelector("#startTaskButton"),
  pauseTaskButton: document.querySelector("#pauseTaskButton"),
  resumeTaskButton: document.querySelector("#resumeTaskButton"),
  endTaskButton: document.querySelector("#endTaskButton")
  ,
  detectorDot: document.querySelector("#detectorDot"),
  detectorText: document.querySelector("#detectorText"),
  settingsButton: document.querySelector("#settingsButton"),
  settingsSheet: document.querySelector("#settingsSheet"),
  closeSettingsButton: document.querySelector("#closeSettingsButton"),
  rewardUrl: document.querySelector("#rewardUrl"),
  contentMode: document.querySelector("#contentMode"),
  sheetUnlockAfter: document.querySelector("#sheetUnlockAfter"),
  sheetRewardSeconds: document.querySelector("#sheetRewardSeconds"),
  settingsError: document.querySelector("#settingsError"),
  saveSettingsButton: document.querySelector("#saveSettingsButton")
};

let cards = [];
let cardSources = { vocabulary: [], tech: [] };
let session = createSession();
let settings = normalizeSettings();
let isFlipped = false;
let rewardTimer = null;
let feedbackTimer = null;

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
}

function syncSettingsControls() {
  elements.unlockAfter.value = String(settings.unlockAfter);
  elements.rewardSeconds.value = String(settings.rewardSeconds);
  elements.sheetUnlockAfter.value = String(settings.unlockAfter);
  elements.sheetRewardSeconds.value = String(settings.rewardSeconds);
  elements.rewardUrl.value = settings.rewardUrl;
  elements.contentMode.value = settings.contentMode;
}

function setSettingsError(message = "") {
  elements.settingsError.hidden = !message;
  elements.settingsError.textContent = message;
}

function renderDetectorStatus(status) {
  elements.detectorDot.dataset.state = status.connected ? (status.busy ? "busy" : "idle") : "offline";
  if (!status.connected) {
    elements.detectorText.textContent = status.message || "等待 Codex 检测器连接";
    return;
  }

  const score = status.score.toFixed(2);
  elements.detectorText.textContent = status.busy
    ? `Codex 运行中，匹配 ${score}`
    : `Codex 空闲，匹配 ${score}`;
}

function currentCard() {
  return cards[session.cardIndex % cards.length];
}

function render() {
  const card = currentCard();
  const isActive = session.taskStatus === "active";
  const isPaused = session.taskStatus === "paused";
  const isIdle = session.taskStatus === "idle";
  const locked = !isActive || session.mode === "reward";

  elements.progressText.textContent = `${session.completedInRound} / ${session.unlockAfter}`;
  elements.statusText.textContent = isIdle
    ? "未开始"
    : isPaused
      ? "已暂停"
      : session.mode === "reward"
        ? "奖励中"
        : "学习中";
  elements.word.textContent = card?.word ?? "No cards";
  elements.phonetic.textContent = card?.phonetic ?? "";
  elements.meaning.textContent = card?.meaning ?? "";
  elements.example.textContent = card?.example ?? "";
  elements.answerPanel.hidden = !isFlipped;

  elements.flipButton.disabled = locked;
  elements.knownButton.disabled = locked;
  elements.fuzzyButton.disabled = locked;
  elements.rewardButton.disabled = !session.canOpenReward || locked;
  elements.card.dataset.unlocked = session.canOpenReward ? "true" : "false";

  elements.rewardHint.textContent = session.canOpenReward
    ? `奖励已解锁。打开后计时 ${settings.rewardSeconds} 秒，到点拉回学习窗口。`
    : isIdle
      ? "开始等待任务后才会计入学习进度。"
      : isPaused
        ? "任务暂停中，继续后可以接着本轮进度。"
        : `还差 ${Math.max(0, session.unlockAfter - session.completedInRound)} 个词解锁奖励。`;

  elements.countdownPanel.hidden = session.mode !== "reward";
  elements.countdownText.textContent = String(session.rewardRemainingSeconds);

  elements.taskHint.textContent = isIdle
    ? "开始后才会进入背词和奖励循环。"
    : isPaused
      ? "当前进度已保留，可以继续或结束。"
      : "背够本轮词数后会解锁抖音奖励。";

  elements.startTaskButton.hidden = !isIdle;
  elements.pauseTaskButton.hidden = isPaused || isIdle;
  elements.resumeTaskButton.hidden = !isPaused;
  elements.startTaskButton.disabled = !isIdle;
  elements.pauseTaskButton.disabled = !isActive || session.mode === "reward";
  elements.resumeTaskButton.disabled = !isPaused;
  elements.endTaskButton.disabled = isIdle;
}

function resetForNextCard(result) {
  session = answerCurrentCard(session, result);
  isFlipped = false;
  showFeedback(result);
  render();
}

function showFeedback(result) {
  clearTimeout(feedbackTimer);
  elements.card.classList.remove("feedback-known", "feedback-fuzzy");
  void elements.card.offsetWidth;
  elements.card.classList.add(nextFeedbackClass(result));
  feedbackTimer = setTimeout(() => {
    elements.card.classList.remove("feedback-known", "feedback-fuzzy");
  }, 360);
}

function configureUnlockAfter() {
  updateSettings({ unlockAfter: Number(elements.unlockAfter.value) });
}

function configureRewardSeconds() {
  updateSettings({ rewardSeconds: Number(elements.rewardSeconds.value) });
}

async function updateSettings(partial) {
  settings = normalizeSettings({ ...settings, ...partial });
  syncSettingsControls();
  await window.shanka.saveSettings(settings);
  session = createSession({
    unlockAfter: settings.unlockAfter,
    rewardSeconds: settings.rewardSeconds,
    cardIndex: session.cardIndex
  });
  isFlipped = false;
  render();
}

async function saveSettingsFromSheet() {
  const rawSettings = {
    contentMode: elements.contentMode.value,
    unlockAfter: Number(elements.sheetUnlockAfter.value),
    rewardSeconds: Number(elements.sheetRewardSeconds.value),
    rewardUrl: elements.rewardUrl.value.trim()
  };
  const nextSettings = normalizeSettings(rawSettings);

  if (nextSettings.rewardUrl !== rawSettings.rewardUrl) {
    setSettingsError("请输入 http 或 https 开头的奖励链接。");
    return;
  }

  setSettingsError();
  await updateSettings(nextSettings);
  cards = selectCardsByMode(cardSources, settings.contentMode);
  session = createSession({
    unlockAfter: settings.unlockAfter,
    rewardSeconds: settings.rewardSeconds,
    cardIndex: 0
  });
  elements.settingsSheet.hidden = true;
  render();
}

function clearRewardTimer() {
  if (rewardTimer) {
    clearInterval(rewardTimer);
    rewardTimer = null;
  }
}

function finishRewardAndReturn() {
  clearRewardTimer();
  session = finishReward(session);
  window.shanka.focusLearningWindow();
  render();
}

async function openReward() {
  session = startReward(session);
  render();
  await window.shanka.openDouyinReward();

  rewardTimer = setInterval(() => {
    session = tickReward(session);
    render();

    if (session.rewardRemainingSeconds <= 0) {
      finishRewardAndReturn();
    }
  }, 1000);
}

elements.flipButton.addEventListener("click", () => {
  isFlipped = !isFlipped;
  render();
});

elements.card.addEventListener("click", () => {
  if (session.mode === "learning") {
    isFlipped = !isFlipped;
    render();
  }
});

elements.knownButton.addEventListener("click", () => resetForNextCard("known"));
elements.fuzzyButton.addEventListener("click", () => resetForNextCard("fuzzy"));
elements.rewardButton.addEventListener("click", openReward);
elements.unlockAfter.addEventListener("change", configureUnlockAfter);
elements.rewardSeconds.addEventListener("change", configureRewardSeconds);
elements.settingsButton.addEventListener("click", () => {
  syncSettingsControls();
  setSettingsError();
  elements.settingsSheet.hidden = false;
});
elements.closeSettingsButton.addEventListener("click", () => {
  elements.settingsSheet.hidden = true;
});
elements.saveSettingsButton.addEventListener("click", saveSettingsFromSheet);
elements.startTaskButton.addEventListener("click", () => {
  session = startTask(session);
  render();
});
elements.pauseTaskButton.addEventListener("click", () => {
  session = pauseTask(session);
  render();
});
elements.resumeTaskButton.addEventListener("click", () => {
  session = resumeTask(session);
  render();
});
elements.endTaskButton.addEventListener("click", () => {
  clearRewardTimer();
  session = endTask(session);
  isFlipped = false;
  render();
  window.shanka.hideLearningWindow();
});

window.shanka.onTaskCommand((command) => {
  clearRewardTimer();
  session = applyTaskCommand(session, command);
  isFlipped = false;
  render();

  if (command === "end") {
    window.shanka.hideLearningWindow();
  }
});

window.addEventListener("keydown", (event) => {
  if (event.code === "Space" && session.taskStatus === "active") {
    event.preventDefault();
    isFlipped = !isFlipped;
    render();
    return;
  }

  if (session.taskStatus === "active" && session.mode === "learning" && isNextFeedGesture({ key: event.key })) {
    event.preventDefault();
    resetForNextCard(isFlipped ? "known" : "fuzzy");
  }
});

elements.card.addEventListener(
  "wheel",
  (event) => {
    if (session.taskStatus === "active" && session.mode === "learning" && isNextFeedGesture({ deltaY: event.deltaY })) {
      event.preventDefault();
      resetForNextCard(isFlipped ? "known" : "fuzzy");
    }
  },
  { passive: false }
);

applyTheme(await window.shanka.getTheme());
window.shanka.onThemeChanged(applyTheme);
renderDetectorStatus(await window.shanka.getDetectorStatus());
window.shanka.onDetectorStatus(renderDetectorStatus);
window.shanka.onSettingsChanged((nextSettings) => {
  settings = normalizeSettings(nextSettings);
  syncSettingsControls();
});

settings = normalizeSettings(await window.shanka.getSettings());
syncSettingsControls();
cardSources = await window.shanka.loadCardSources();
cards = selectCardsByMode(cardSources, settings.contentMode);
session = createSession({ unlockAfter: settings.unlockAfter, rewardSeconds: settings.rewardSeconds });
render();
