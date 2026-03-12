import { describe, expect, it } from "vitest";

import {
  assertToolSideEffectFamily,
  assertWorkspaceScope,
  validateNormalizedToolArgs
} from "../../src/core/compile/compile-guards";
import { WORKSPACE_ROOT } from "../fixtures";

describe("compile guard contracts", () => {
  it("rejects unknown args for typed tools", () => {
    expect(() =>
      validateNormalizedToolArgs("read_text_file", {
        path: WORKSPACE_ROOT,
        extra_flag: true
      })
    ).toThrow();
  });

  it("rejects side-effect families that do not match the registered tool", () => {
    expect(() => assertToolSideEffectFamily("read_text_file", "workspace_write")).toThrow(
      "does not allow side-effect family"
    );
  });

  it("rejects workspace scopes outside the approved root set", () => {
    expect(() =>
      assertWorkspaceScope(WORKSPACE_ROOT, ["D:\\Another-Workspace"])
    ).toThrow("Workspace scope does not include");
  });
});
