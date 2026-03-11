import fs from "node:fs";
import path from "node:path";

export type PathKind =
  | "regular"
  | "symlink"
  | "junction"
  | "mount_point"
  | "reparse_point"
  | "unc"
  | "device_namespace"
  | "ntfs_ads";

export interface PathInspector {
  readonly exists: (targetPath: string) => boolean;
  readonly realpath: (targetPath: string) => string;
  readonly dirname: (targetPath: string) => string;
  readonly normalize: (targetPath: string) => string;
  readonly resolve: (...segments: string[]) => string;
  readonly relative: (from: string, to: string) => string;
  readonly isAbsolute: (targetPath: string) => boolean;
  readonly inspectKind: (targetPath: string) => PathKind;
}

export interface CanonicalPathResolution {
  readonly requestedPath: string;
  readonly canonicalPath: string;
  readonly canonicalWorkspaceRoot: string;
  readonly nearestExistingParent: string;
  readonly existed: boolean;
}

export interface CanonicalPathPolicy {
  readonly authorizePath: (
    requestedPath: string,
    workspaceRoots: readonly string[]
  ) => CanonicalPathResolution;
  readonly assertNoDrift: (
    approved: CanonicalPathResolution,
    executionTime: CanonicalPathResolution
  ) => void;
}

function classifyPathString(targetPath: string): PathKind | null {
  const normalized = targetPath.replace(/\//g, "\\");

  if (normalized.startsWith("\\\\?\\") || normalized.startsWith("\\\\.\\")) {
    return "device_namespace";
  }

  if (normalized.startsWith("\\\\")) {
    return "unc";
  }

  const hasDrive = /^[a-zA-Z]:/.test(normalized);
  if (hasDrive && normalized.slice(2).includes(":")) {
    return "ntfs_ads";
  }

  return null;
}

function ensureAllowedExistingPath(
  inspector: PathInspector,
  targetPath: string
): void {
  const kindFromString = classifyPathString(targetPath);
  if (kindFromString) {
    throw new Error(`Rejected path kind: ${kindFromString}`);
  }

  if (!inspector.exists(targetPath)) {
    return;
  }

  const kind = inspector.inspectKind(targetPath);
  if (kind !== "regular") {
    throw new Error(`Rejected path kind: ${kind}`);
  }
}

function isWithinWorkspaceRoot(
  inspector: PathInspector,
  workspaceRoot: string,
  candidatePath: string
): boolean {
  const relativePath = inspector.relative(workspaceRoot, candidatePath);
  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !path.win32.isAbsolute(relativePath))
  );
}

function createDefaultInspector(): PathInspector {
  return {
    exists: (targetPath) => fs.existsSync(targetPath),
    realpath: (targetPath) => fs.realpathSync.native(targetPath),
    dirname: (targetPath) => path.win32.dirname(targetPath),
    normalize: (targetPath) => path.win32.normalize(targetPath),
    resolve: (...segments) => path.win32.resolve(...segments),
    relative: (from, to) => path.win32.relative(from, to),
    isAbsolute: (targetPath) => path.win32.isAbsolute(targetPath),
    inspectKind: (targetPath) => {
      const kindFromString = classifyPathString(targetPath);
      if (kindFromString) {
        return kindFromString;
      }

      const stats = fs.lstatSync(targetPath);
      if (stats.isSymbolicLink()) {
        return "symlink";
      }

      return "regular";
    }
  };
}

export class DefaultCanonicalPathPolicy implements CanonicalPathPolicy {
  public constructor(private readonly inspector: PathInspector = createDefaultInspector()) {}

  public authorizePath(
    requestedPath: string,
    workspaceRoots: readonly string[]
  ): CanonicalPathResolution {
    if (!this.inspector.isAbsolute(requestedPath)) {
      throw new Error("Path must be absolute");
    }

    const canonicalWorkspaceRoots = workspaceRoots.map((root) => {
      if (!this.inspector.isAbsolute(root)) {
        throw new Error("Workspace root must be absolute");
      }

      ensureAllowedExistingPath(this.inspector, root);
      if (!this.inspector.exists(root)) {
        throw new Error("Workspace root must exist");
      }

      return this.inspector.normalize(this.inspector.realpath(root));
    });

    let currentPath = this.inspector.normalize(requestedPath);
    const trailingSegments: string[] = [];

    while (!this.inspector.exists(currentPath)) {
      const parentPath = this.inspector.dirname(currentPath);
      if (parentPath === currentPath) {
        throw new Error("Could not locate an existing parent path");
      }

      trailingSegments.unshift(path.win32.basename(currentPath));
      currentPath = parentPath;
    }

    ensureAllowedExistingPath(this.inspector, currentPath);

    const canonicalParent = this.inspector.normalize(this.inspector.realpath(currentPath));
    const canonicalPath = this.inspector.normalize(
      this.inspector.resolve(canonicalParent, ...trailingSegments)
    );

    const canonicalWorkspaceRoot = canonicalWorkspaceRoots.find((root) =>
      isWithinWorkspaceRoot(this.inspector, root, canonicalPath)
    );

    if (!canonicalWorkspaceRoot) {
      throw new Error("Path escapes approved workspace roots");
    }

    return {
      requestedPath,
      canonicalPath,
      canonicalWorkspaceRoot,
      nearestExistingParent: canonicalParent,
      existed: trailingSegments.length === 0
    };
  }

  public assertNoDrift(
    approved: CanonicalPathResolution,
    executionTime: CanonicalPathResolution
  ): void {
    if (
      approved.canonicalPath !== executionTime.canonicalPath ||
      approved.canonicalWorkspaceRoot !== executionTime.canonicalWorkspaceRoot
    ) {
      throw new Error("Canonical path drift detected");
    }
  }
}
