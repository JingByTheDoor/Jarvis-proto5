import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { EncryptedWorkflowProofStore } from "../../src/core/proof/workflow-proof-store";
import type { EncryptedAtRestProvider } from "../../src/core/persistence/encrypted-at-rest";
import { validWorkflowProofRecord } from "../fixtures";
import { createTempRepo } from "../support/temp-repo";

class TestEncryptedAtRestProvider implements EncryptedAtRestProvider {
  writeEncryptedJson<T>(filePath: string, _purpose: any, value: T): any {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
    return {
      version: 1,
      format: "jarvis.encrypted-file",
      algorithm: "aes-256-gcm",
      key_id: "test-key",
      purpose: "cache_entry",
      iv: "iv",
      ciphertext: "ciphertext",
      tag: "tag",
      created_at: validWorkflowProofRecord.updated_at
    };
  }

  readEncryptedJson<T>(filePath: string): T {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  }

  loadOrCreateContentKey(): any {
    throw new Error("Not used in test provider.");
  }
}

describe("workflow proof store", () => {
  it("persists encrypted proof records and summarizes the golden workflow locally", () => {
    const repo = createTempRepo({
      "package.json": JSON.stringify({ name: "phase-6-proof-store", version: "1.0.0" }, null, 2)
    });

    try {
      const workflowProofStore = new EncryptedWorkflowProofStore(new TestEncryptedAtRestProvider());

      workflowProofStore.upsertRecord(repo.root, {
        ...validWorkflowProofRecord,
        workspace_root: repo.root,
        journey_id: "journey-golden-1",
        updated_at: "2026-03-11T19:00:00.000Z"
      });
      workflowProofStore.upsertRecord(repo.root, {
        ...validWorkflowProofRecord,
        workspace_root: repo.root,
        journey_id: "journey-golden-2",
        first_result_at: null,
        approval_to_first_result_ms: null,
        execute_to_first_result_ms: null,
        workflow_state: "failed",
        resume_used: false,
        resumed_from_recall_id: null,
        updated_at: "2026-03-11T19:05:00.000Z"
      });
      workflowProofStore.upsertRecord(repo.root, {
        ...validWorkflowProofRecord,
        workspace_root: repo.root,
        journey_id: "journey-inspect-1",
        journey_kind: "inspection_only",
        route_kind: "local_read_tools",
        task_type: "repo_inspection",
        risk_class: "SAFE",
        approval_required: false,
        approval_recorded_at: null,
        execute_requested_at: null,
        first_result_at: null,
        approval_to_first_result_ms: null,
        execute_to_first_result_ms: null,
        workflow_state: "simulation_ready",
        updated_at: "2026-03-11T19:10:00.000Z"
      });

      const persistedPath = path.join(repo.root, ".tmp", "cache", "workflow-proof.json");
      const summarySnapshot = workflowProofStore.getSummary(repo.root, 5);

      expect(fs.existsSync(persistedPath)).toBe(true);
      expect(summarySnapshot.summary.golden_workflow_attempts).toBe(2);
      expect(summarySnapshot.summary.golden_workflow_review_ready).toBe(1);
      expect(summarySnapshot.summary.golden_workflow_stability_rate).toBe(0.5);
      expect(summarySnapshot.summary.median_cold_start_to_composer_ms).toBe(500);
      expect(summarySnapshot.summary.median_preview_to_approval_ms).toBe(2000);
      expect(summarySnapshot.summary.median_repeat_task_to_preview_ms).toBe(1000);
      expect(summarySnapshot.summary.resume_journeys).toBe(2);
      expect(summarySnapshot.gate_status.overall_status).toBe("collecting_evidence");
      expect(summarySnapshot.recent_journeys[0]?.journey_id).toBe("journey-inspect-1");
    } finally {
      repo.cleanup();
    }
  });
});
