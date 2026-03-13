import { describe, expect, it } from "vitest";

import {
  routeTaskIntent,
  shouldAttemptPlannerNormalization
} from "../../src/core/planning/task-routing";

describe("task routing", () => {
  it("classifies explicit guarded shell commands as CAUTION by default", () => {
    const route = routeTaskIntent('run command "Get-ChildItem -Name ." in D:\\Jarvis-proto5 repo\\Jarvis-proto5');

    expect(route.task_type).toBe("guarded_command");
    expect(route.chosen_route).toBe("local_guarded_shell");
    expect(route.risk_class).toBe("CAUTION");
  });

  it("classifies mutating guarded shell commands as DANGER", () => {
    const route = routeTaskIntent(
      'run command "Set-Content -Path notes.txt -Value \\"jarvis\\"" in D:\\Jarvis-proto5 repo\\Jarvis-proto5'
    );

    expect(route.task_type).toBe("guarded_command");
    expect(route.chosen_route).toBe("local_guarded_shell");
    expect(route.risk_class).toBe("DANGER");
  });

  it("does not bypass a sufficient typed git path with raw shell", () => {
    const route = routeTaskIntent(
      'run command "git status" in D:\\Jarvis-proto5 repo\\Jarvis-proto5'
    );

    expect(route.chosen_route).toBe("local_read_tools");
    expect(route.task_type).toBe("repo_inspection");
  });

  it("stops shell commands with network tokens at manual confirmation", () => {
    const route = routeTaskIntent(
      'run command "Invoke-WebRequest https://example.com" in D:\\Jarvis-proto5 repo\\Jarvis-proto5'
    );

    expect(route.chosen_route).toBe("manual_confirmation_required");
    expect(route.risk_class).toBe("DANGER");
  });

  it("allows planner normalization for unsupported natural-language edits", () => {
    expect(
      shouldAttemptPlannerNormalization(
        "Update the README heading to JARVIS and show me the exact diff first."
      )
    ).toBe(true);
  });

  it("does not ask the planner to down-route obviously dangerous intents", () => {
    expect(shouldAttemptPlannerNormalization("Delete the repo and redeploy it")).toBe(false);
  });
});
