import test from "node:test";
import assert from "node:assert/strict";

import { normalizeTheme } from "./theme.js";

test("normalizes native dark theme state", () => {
  assert.equal(normalizeTheme(true), "dark");
  assert.equal(normalizeTheme(false), "light");
});

test("normalizes explicit theme values", () => {
  assert.equal(normalizeTheme("dark"), "dark");
  assert.equal(normalizeTheme("light"), "light");
  assert.equal(normalizeTheme("other"), "dark");
});
