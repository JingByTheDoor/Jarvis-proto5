import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  DefaultCanonicalPathPolicy,
  type PathInspector,
  type PathKind
} from "../../src/core/capabilities/canonical-path-policy";

class FakePathInspector implements PathInspector {
  public constructor(
    private readonly existingPaths: readonly string[],
    private readonly kinds: Record<string, PathKind> = {}
  ) {}

  public exists = (targetPath: string): boolean =>
    this.existingPaths.includes(this.normalize(targetPath));

  public realpath = (targetPath: string): string => this.normalize(targetPath);

  public dirname = (targetPath: string): string => path.win32.dirname(this.normalize(targetPath));

  public normalize = (targetPath: string): string => path.win32.normalize(targetPath);

  public resolve = (...segments: string[]): string => path.win32.resolve(...segments);

  public relative = (from: string, to: string): string =>
    path.win32.relative(this.normalize(from), this.normalize(to));

  public isAbsolute = (targetPath: string): boolean => path.win32.isAbsolute(targetPath);

  public inspectKind = (targetPath: string): PathKind =>
    this.kinds[this.normalize(targetPath)] ?? "regular";
}

describe("canonical path policy", () => {
  const workspaceRoot = "D:\\workspace";
  const docsDir = "D:\\workspace\\docs";
  const filePath = "D:\\workspace\\docs\\file.txt";

  it("authorizes paths inside the canonical workspace root", () => {
    const policy = new DefaultCanonicalPathPolicy(
      new FakePathInspector([workspaceRoot, docsDir, filePath])
    );

    const result = policy.authorizePath(filePath, [workspaceRoot]);

    expect(result.canonicalWorkspaceRoot).toBe(workspaceRoot);
    expect(result.canonicalPath).toBe(filePath);
    expect(result.existed).toBe(true);
  });

  it("canonicalizes a non-existing target from the nearest existing parent", () => {
    const policy = new DefaultCanonicalPathPolicy(
      new FakePathInspector([workspaceRoot, docsDir])
    );

    const result = policy.authorizePath("D:\\workspace\\docs\\new.txt", [workspaceRoot]);

    expect(result.nearestExistingParent).toBe(docsDir);
    expect(result.canonicalPath).toBe("D:\\workspace\\docs\\new.txt");
    expect(result.existed).toBe(false);
  });

  it("rejects raw-prefix escapes outside the workspace root", () => {
    const policy = new DefaultCanonicalPathPolicy(
      new FakePathInspector([workspaceRoot, "D:\\workspace-other", "D:\\workspace-other\\file.txt"])
    );

    expect(() =>
      policy.authorizePath("D:\\workspace-other\\file.txt", [workspaceRoot])
    ).toThrow(/workspace roots/i);
  });

  it("rejects approval-time versus execution-time drift", () => {
    const policy = new DefaultCanonicalPathPolicy(
      new FakePathInspector([workspaceRoot, docsDir, filePath, "D:\\workspace\\docs\\renamed.txt"])
    );

    const approved = policy.authorizePath(filePath, [workspaceRoot]);
    const executionTime = policy.authorizePath("D:\\workspace\\docs\\renamed.txt", [workspaceRoot]);

    expect(() => policy.assertNoDrift(approved, executionTime)).toThrow(/drift/i);
  });

  it("rejects disallowed path kinds synthetically", () => {
    const cases: Array<{ requestedPath: string; kind?: PathKind }> = [
      { requestedPath: "\\\\server\\share\\file.txt" },
      { requestedPath: "\\\\?\\C:\\workspace\\file.txt" },
      { requestedPath: "D:\\workspace\\file.txt:secret" },
      {
        requestedPath: "D:\\workspace\\junction.txt",
        kind: "junction"
      },
      {
        requestedPath: "D:\\workspace\\symlink.txt",
        kind: "symlink"
      },
      {
        requestedPath: "D:\\workspace\\reparse.txt",
        kind: "reparse_point"
      }
    ];

    for (const entry of cases) {
      const existing = [workspaceRoot, entry.requestedPath].filter((value) =>
        !value.startsWith("\\\\server")
      );

      const policy = new DefaultCanonicalPathPolicy(
        new FakePathInspector(
          existing,
          entry.kind ? { [path.win32.normalize(entry.requestedPath)]: entry.kind } : {}
        )
      );

      expect(() => policy.authorizePath(entry.requestedPath, [workspaceRoot])).toThrow();
    }
  });
});

