import { z } from "zod";

import { ApprovalDecisionSchema, RunEventSchema, WorkflowStateSchema } from "../core/schemas";
import { workflowSequence } from "./constants";

export const TaskIntentRequestSchema = z
  .object({
    task: z.string().min(1),
    session_id: z.string().min(1),
    workspace_roots: z.array(z.string().min(1)).min(1),
    requested_at: z.string().datetime({ offset: true })
  })
  .strict();

export const TaskIntentResponseSchema = z
  .object({
    accepted: z.boolean(),
    workflow_state: WorkflowStateSchema,
    message: z.string().min(1)
  })
  .strict();

export const PolicySnapshotRequestSchema = z
  .object({
    session_id: z.string().min(1)
  })
  .strict();

export const PolicySnapshotResponseSchema = z
  .object({
    version: z.string().min(1),
    workflow: z.literal(workflowSequence),
    local_first: z.literal(true),
    approval_required_for_risky_actions: z.literal(true)
  })
  .strict();

export const RunEventEnvelopeSchema = z
  .object({
    channel: z.literal("run.event.push"),
    payload: RunEventSchema
  })
  .strict();

export const ipcContractMap = {
  "task.intent.submit": {
    direction: "renderer_to_main",
    payloadSchema: TaskIntentRequestSchema
  },
  "task.intent.response": {
    direction: "main_to_renderer",
    payloadSchema: TaskIntentResponseSchema
  },
  "approval.decision.submit": {
    direction: "renderer_to_main",
    payloadSchema: ApprovalDecisionSchema
  },
  "policy.snapshot.get": {
    direction: "renderer_to_main",
    payloadSchema: PolicySnapshotRequestSchema
  },
  "policy.snapshot.response": {
    direction: "main_to_renderer",
    payloadSchema: PolicySnapshotResponseSchema
  },
  "run.event.push": {
    direction: "main_to_renderer",
    payloadSchema: RunEventSchema
  }
} as const;

export type IpcChannel = keyof typeof ipcContractMap;

export const IpcEnvelopeSchema = z.discriminatedUnion("channel", [
  z.object({
    channel: z.literal("task.intent.submit"),
    payload: TaskIntentRequestSchema
  }),
  z.object({
    channel: z.literal("task.intent.response"),
    payload: TaskIntentResponseSchema
  }),
  z.object({
    channel: z.literal("approval.decision.submit"),
    payload: ApprovalDecisionSchema
  }),
  z.object({
    channel: z.literal("policy.snapshot.get"),
    payload: PolicySnapshotRequestSchema
  }),
  z.object({
    channel: z.literal("policy.snapshot.response"),
    payload: PolicySnapshotResponseSchema
  }),
  RunEventEnvelopeSchema
]);

export type IpcEnvelope = z.infer<typeof IpcEnvelopeSchema>;

export function parseIpcEnvelope(input: unknown): IpcEnvelope {
  return IpcEnvelopeSchema.parse(input);
}

