import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface TempRepo {
  readonly root: string;
  readonly cleanup: () => void;
  readonly writeRelativeFile: (relativePath: string, contents: string) => string;
  readonly readRelativeFile: (relativePath: string) => string;
  readonly runGit: (args: readonly string[]) => string;
}

export function createTempRepo(initialFiles: Record<string, string>): TempRepo {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "jarvis-phase2-"));

  const writeRelativeFile = (relativePath: string, contents: string): string => {
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, contents, "utf8");
    return absolutePath;
  };

  const runGit = (args: readonly string[]): string =>
    execFileSync("git", ["-C", root, ...args], {
      encoding: "utf8",
      windowsHide: true
    }).trim();

  runGit(["init"]);
  runGit(["config", "user.email", "jarvis@example.com"]);
  runGit(["config", "user.name", "Jarvis Tests"]);

  for (const [relativePath, contents] of Object.entries(initialFiles)) {
    writeRelativeFile(relativePath, contents);
  }

  runGit(["add", "."]);
  runGit(["commit", "-m", "Initial fixture"]);

  return {
    root,
    cleanup: () => {
      fs.rmSync(root, { recursive: true, force: true });
    },
    writeRelativeFile,
    readRelativeFile: (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8"),
    runGit
  };
}
