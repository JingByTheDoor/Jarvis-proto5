import { describe, expect, it } from "vitest";

import { executeGuardedShell } from "../../src/core/tools/guarded-shell-tool";
import { createTempRepo } from "../support/temp-repo";

describe("guarded shell tool", () => {
  it("produces a structured receipt for guarded shell execution", () => {
    const repo = createTempRepo({
      "README.md": "hello\n"
    });

    try {
      const result = executeGuardedShell({
        command_text: 'Write-Output "hello from shell"',
        working_directory: repo.root,
        environment_policy: "inherit_process",
        timeout_ms: 15000
      });

      expect(result.ok).toBe(true);
      expect(result.structured_data).toEqual(
        expect.objectContaining({
          command_text: 'Write-Output "hello from shell"',
          working_directory: repo.root,
          environment_policy: "inherit_process",
          exit_code: 0
        })
      );
      expect(result.redacted_output).toEqual(
        expect.objectContaining({
          stdout: expect.stringContaining("hello from shell")
        })
      );
      expect(result.observed_effects[0]?.family).toBe("raw_shell_readonly");
    } finally {
      repo.cleanup();
    }
  });
});
