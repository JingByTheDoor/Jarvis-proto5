interface DiffLine {
  readonly type: "context" | "added" | "removed";
  readonly value: string;
}

function splitLines(text: string): string[] {
  if (text.length === 0) {
    return [];
  }

  return text.replace(/\r\n/g, "\n").split("\n");
}

function createLcsTable(beforeLines: readonly string[], afterLines: readonly string[]): number[][] {
  const table = Array.from({ length: beforeLines.length + 1 }, () =>
    Array.from<number>({ length: afterLines.length + 1 }).fill(0)
  );

  for (let beforeIndex = beforeLines.length - 1; beforeIndex >= 0; beforeIndex -= 1) {
    for (let afterIndex = afterLines.length - 1; afterIndex >= 0; afterIndex -= 1) {
      table[beforeIndex][afterIndex] =
        beforeLines[beforeIndex] === afterLines[afterIndex]
          ? table[beforeIndex + 1][afterIndex + 1] + 1
          : Math.max(table[beforeIndex + 1][afterIndex], table[beforeIndex][afterIndex + 1]);
    }
  }

  return table;
}

function computeDiffLines(beforeText: string, afterText: string): DiffLine[] {
  const beforeLines = splitLines(beforeText);
  const afterLines = splitLines(afterText);
  const table = createLcsTable(beforeLines, afterLines);
  const diffLines: DiffLine[] = [];

  let beforeIndex = 0;
  let afterIndex = 0;

  while (beforeIndex < beforeLines.length && afterIndex < afterLines.length) {
    if (beforeLines[beforeIndex] === afterLines[afterIndex]) {
      diffLines.push({
        type: "context",
        value: beforeLines[beforeIndex]
      });
      beforeIndex += 1;
      afterIndex += 1;
      continue;
    }

    if (table[beforeIndex + 1][afterIndex] >= table[beforeIndex][afterIndex + 1]) {
      diffLines.push({
        type: "removed",
        value: beforeLines[beforeIndex]
      });
      beforeIndex += 1;
      continue;
    }

    diffLines.push({
      type: "added",
      value: afterLines[afterIndex]
    });
    afterIndex += 1;
  }

  while (beforeIndex < beforeLines.length) {
    diffLines.push({
      type: "removed",
      value: beforeLines[beforeIndex]
    });
    beforeIndex += 1;
  }

  while (afterIndex < afterLines.length) {
    diffLines.push({
      type: "added",
      value: afterLines[afterIndex]
    });
    afterIndex += 1;
  }

  return diffLines;
}

export function createUnifiedDiff(filePath: string, beforeText: string, afterText: string): string {
  const beforeLines = splitLines(beforeText);
  const afterLines = splitLines(afterText);
  const diffLines = computeDiffLines(beforeText, afterText);
  const renderedLines = diffLines.map((line) => {
    switch (line.type) {
      case "added":
        return `+${line.value}`;
      case "removed":
        return `-${line.value}`;
      case "context":
      default:
        return ` ${line.value}`;
    }
  });

  return [
    `--- ${filePath}`,
    `+++ ${filePath}`,
    `@@ -1,${beforeLines.length} +1,${afterLines.length} @@`,
    ...renderedLines
  ].join("\n");
}
