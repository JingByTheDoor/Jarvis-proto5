# Task Plan

## Current Focus

- Phase 6 Slice A: local proof-gate measurement for the golden workflow.

## Scope

- Persist local workflow-proof records for the golden workflow under encrypted local storage.
- Track task-to-preview latency, approval-to-first-result latency, execute-to-first-result latency, and operator steps/clicks.
- Track whether resume-from-recall is being used and whether resumed journeys reach `review_ready`.
- Surface proof-gate summary data in the UI without broadening routing, memory tiers, or optional providers.
- Keep advanced routing, durable memory, challenger logic, and optional adapters blocked behind the proof gate from the master sheet.

## Explicit Deferrals

- Advanced routing remains deferred until the Phase 6 proof gate is satisfied.
- Tier 1 durable memory hardening, Tier 2 semantic memory, Tier 3 analytics, challenger logic, and optional adapters remain deferred until the first golden workflow is measurably faster than the DIY stack.
- Quota expansion, decompression controls, and backpressure broadening remain deferred until the optional-systems phase opens.

## Completed Phases

- `Phase 0A`: complete
- `Phase 0`: complete
- `Phase 1`: complete
- `Phase 2`: complete
- `Phase 3`: complete
- `Phase 4`: complete
- `Phase 5`: complete

## Phase 1 Closure Notes

- Electron now boots through a hardened `app://jarvis` shell with default-deny permissions, navigation, and popup behavior.
- The preload bridge is narrow, typed, schema-validated, and sender-validated.
- The React dashboard frame now exposes the required Phase 1 Command Center regions plus scaffold pages for Tasks & Projects, Second Brain, Connections, and Settings.

## Phase 2 Closure Notes

- The task composer now routes into a real Phase 2 preview compiler and reaches `manifest_ready` for the supported v1 slice.
- Typed repo/file tools now cover `list_directory`, `read_text_file`, `write_text_file`, `diff_file`, `git_status`, and `git_diff`.
- Each supported plan step now compiles into typed `COMPILED_ACTION` records with deterministic hashes and canonical path scope.
- The Command Center now shows the lean route explanation, plan summary, manifest summary, compiled action inspection, and exact diff preview for typed file edits.
- Requests outside the narrow typed slice now stop at manual confirmation instead of silently broadening routing.

## Phase 3 Closure Notes

- Deterministic risk classification now runs from compiled actions plus effect previews, not from prose plan text.
- Tier A exact `EFFECT_PREVIEW` generation now exists for the current typed repo/file tool slice.
- Approval decisions now validate against registered compiled manifests and reject silent widening on signature, execution hash, session, expiry, or execution-count drift.
- The Command Center now shows simulation summary, effect previews, exact approval scope, and typed approval receipts before execution opens.
- Session approvals are reusable only when `approval_signature` and `execution_hash` remain identical; destructive and mutating raw-shell actions remain non-session-approvable.

## Phase 4 Closure Notes

- Approved compiled actions now execute only through the privileged runtime, and non-trivial actions require a fresh single-use capability token before side effects can occur.
- Structured `RUN_EVENT` streaming, encrypted run-log persistence under `.tmp/runs`, and narrow typed-tool attestation now exist for the first golden workflow.
- Review surfaces now show live activity, run results, artifact visibility, attestation outcomes, and persisted run history with approval/attestation counts.
- Execution no longer implies persistence success: when run-log persistence fails, the execution result and attestation remain visible but the workflow falls back to `execution_complete` instead of falsely claiming `review_ready`.

## Phase 5 Closure Notes

- `shell_command_guarded` now exists as an audited local escape hatch with typed-tool precedence, explicit approval gating, structured receipts, and exact attestation against the compiled command.
- Previous-task recall now searches local run history plus operator notes, preserves provenance/trust labels, redacts searchable content, and exposes resume-task entry points in the UI.
- The Command Center, Tasks & Projects, and Second Brain now make the execution path, guarded-shell posture, local recall results, and resume flow legible without introducing Tier 2 or Tier 3 dependencies.

## Phase 6 Slice A Notes

- Workflow-proof records now persist locally with encrypted-at-rest storage so the current golden workflow can be measured before broader expansion.
- The app now tracks task-to-preview latency, approval-to-first-result latency, execute-to-first-result latency, operator steps/clicks, and resume usage for local proof only.
- Settings now shows the current proof-gate summary and recent local proof samples, while advanced routing and optional systems remain deferred.
