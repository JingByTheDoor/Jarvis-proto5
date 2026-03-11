import { createHash } from "node:crypto";

import type {
  CompiledAction,
  NetworkScope,
  PathScope,
  WorkspaceScope
} from "../schemas";
import type { SideEffectFamily } from "../../shared/constants";

export interface ApprovalHashInput {
  readonly tool_name: string;
  readonly normalized_args: Record<string, unknown>;
  readonly side_effect_family: SideEffectFamily;
  readonly workspace_scope: WorkspaceScope;
  readonly path_scope: PathScope;
  readonly network_scope: NetworkScope;
  readonly max_execution_count: number;
  readonly session_id: string;
  readonly expires_at: string;
}

export interface ExecutionHashInput {
  readonly tool_name: string;
  readonly normalized_args: Record<string, unknown>;
  readonly workspace_scope: WorkspaceScope;
  readonly path_scope: PathScope;
  readonly network_scope: NetworkScope;
  readonly expected_side_effects: CompiledAction["expected_side_effects"];
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  return `{${entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
    .join(",")}}`;
}

function sha256(input: unknown): string {
  return createHash("sha256").update(stableStringify(input)).digest("hex");
}

export function createApprovalSignature(input: ApprovalHashInput): string {
  return sha256(input);
}

export function createExecutionHash(input: ExecutionHashInput): string {
  return sha256(input);
}

