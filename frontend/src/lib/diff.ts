export interface DiffLine {
  type: "added" | "removed" | "unchanged";
  content: string;
}

export function computeDiff(
  oldText: string,
  newText: string
): DiffLine[] {
  if (!oldText && !newText) return [];
  if (!oldText) return newText.split("\n").map((line) => ({ type: "added", content: line }));
  if (!newText) return oldText.split("\n").map((line) => ({ type: "removed", content: line }));

  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const m = oldLines.length;
  const n = newLines.length;

  // LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to produce diff
  const result: DiffLine[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.unshift({ type: "unchanged", content: oldLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: "added", content: newLines[j - 1] });
      j--;
    } else {
      result.unshift({ type: "removed", content: oldLines[i - 1] });
      i--;
    }
  }

  return result;
}

export function computeJsonDiff(
  oldJson: unknown,
  newJson: unknown
): DiffLine[] {
  const oldStr = oldJson ? JSON.stringify(oldJson, null, 2) : "";
  const newStr = newJson ? JSON.stringify(newJson, null, 2) : "";
  return computeDiff(oldStr, newStr);
}
