import test from "node:test";
import assert from "node:assert/strict";

import {
  answerCurrentCard,
  applyTaskCommand,
  createSession,
  endTask,
  finishReward,
  pauseTask,
  resumeTask,
  startReward,
  startTask
} from "./session.js";

test("applies external task commands for detector integration", () => {
  let session = createSession({ unlockAfter: 3, rewardSeconds: 30 });

  session = applyTaskCommand(session, "start");
  assert.equal(session.taskStatus, "active");

  session = answerCurrentCard(session, "known");
  session = applyTaskCommand(session, "pause");
  assert.equal(session.taskStatus, "paused");
  assert.equal(session.completedInRound, 1);

  session = applyTaskCommand(session, "resume");
  assert.equal(session.taskStatus, "active");
  assert.equal(session.completedInRound, 1);

  session = applyTaskCommand(session, "end");
  assert.equal(session.taskStatus, "idle");
  assert.equal(session.completedInRound, 0);
});

test("rejects unknown external task commands", () => {
  const session = createSession({ unlockAfter: 3, rewardSeconds: 30 });

  assert.throws(() => applyTaskCommand(session, "dance"), /Unknown task command/);
});

test("starts idle and only answers cards after a task starts", () => {
  let session = createSession({ unlockAfter: 3, rewardSeconds: 30 });

  assert.equal(session.taskStatus, "idle");
  assert.throws(() => answerCurrentCard(session, "known"), /Task is not active/);

  session = startTask(session);

  assert.equal(session.taskStatus, "active");
  assert.equal(answerCurrentCard(session, "known").completedInRound, 1);
});

test("pauses and resumes an active task without losing round progress", () => {
  let session = createSession({ unlockAfter: 3, rewardSeconds: 30 });

  session = startTask(session);
  session = answerCurrentCard(session, "known");
  session = pauseTask(session);

  assert.equal(session.taskStatus, "paused");
  assert.equal(session.completedInRound, 1);
  assert.throws(() => answerCurrentCard(session, "known"), /Task is not active/);

  session = resumeTask(session);

  assert.equal(session.taskStatus, "active");
  assert.equal(session.completedInRound, 1);
});

test("ending a task resets learning progress and reward state", () => {
  let session = createSession({ unlockAfter: 1, rewardSeconds: 30 });

  session = startTask(session);
  session = answerCurrentCard(session, "known");
  session = startReward(session);
  session = endTask(session);

  assert.equal(session.taskStatus, "idle");
  assert.equal(session.mode, "learning");
  assert.equal(session.completedInRound, 0);
  assert.equal(session.canOpenReward, false);
  assert.equal(session.rewardRemainingSeconds, 0);
});

test("locks reward until the configured number of words are completed", () => {
  let session = createSession({ unlockAfter: 3, rewardSeconds: 30 });

  session = startTask(session);

  assert.equal(session.canOpenReward, false);

  session = answerCurrentCard(session, "known");
  session = answerCurrentCard(session, "known");
  assert.equal(session.completedInRound, 2);
  assert.equal(session.canOpenReward, false);

  session = answerCurrentCard(session, "known");
  assert.equal(session.completedInRound, 3);
  assert.equal(session.canOpenReward, true);
});

test("starts a timed reward only after learning cards are completed", () => {
  let session = createSession({ unlockAfter: 2, rewardSeconds: 30 });

  session = startTask(session);

  assert.throws(() => startReward(session), /Reward is locked/);

  session = answerCurrentCard(session, "known");
  session = answerCurrentCard(session, "known");
  session = startReward(session);

  assert.equal(session.mode, "reward");
  assert.equal(session.rewardRemainingSeconds, 30);
  assert.equal(session.canOpenReward, false);
});

test("returning from reward resets the learning round", () => {
  let session = createSession({ unlockAfter: 1, rewardSeconds: 30 });

  session = startTask(session);

  session = answerCurrentCard(session, "known");
  session = startReward(session);
  session = finishReward(session);

  assert.equal(session.mode, "learning");
  assert.equal(session.completedInRound, 0);
  assert.equal(session.rewardRemainingSeconds, 0);
  assert.equal(session.canOpenReward, false);
});
