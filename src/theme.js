export function normalizeTheme(shouldUseDarkColors) {
  if (shouldUseDarkColors === "dark" || shouldUseDarkColors === "light") {
    return shouldUseDarkColors;
  }

  return shouldUseDarkColors ? "dark" : "light";
}
