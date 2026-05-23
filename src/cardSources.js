export function selectCardsByMode({ vocabulary = [], tech = [] }, mode = "vocab") {
  if (mode === "tech") {
    return tech;
  }

  if (mode === "mixed") {
    return interleave(vocabulary, tech);
  }

  return vocabulary;
}

export function interleave(first = [], second = []) {
  const result = [];
  const maxLength = Math.max(first.length, second.length);

  for (let index = 0; index < maxLength; index += 1) {
    if (first[index]) {
      result.push(first[index]);
    }
    if (second[index]) {
      result.push(second[index]);
    }
  }

  return result;
}
