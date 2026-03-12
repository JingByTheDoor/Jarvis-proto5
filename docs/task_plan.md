# Task Plan

## Current Focus

- Phase 5: guarded commands + basic memory search

## Scope

- Add `shell_command_guarded` as an audited escape hatch when no typed tool exists.
- Add previous run/task search and minimal local notes lookup.
- Improve resume-previous-task continuity without introducing Tier 2 or Tier 3 dependencies.
- Keep typed-tool precedence, approval gating, and local-first determinism intact while broadening the operator loop.

## Explicit Deferrals

- Routing sophistication beyond the v1 local-first profile remains deferred.
- Advanced routing, optional systems, Tier 2 memory, and Tier 3 analytics remain deferred until the first golden workflow is measurably faster than the DIY stack.
- Optional adapters and deeper memory tiers remain deferred until the first golden workflow is measurably faster than the DIY stack.

## Completed Phases

- `Phase 0A`: complete
- `Phase 0`: complete
- `Phase 1`: complete
- `Phase 2`: complete
- `Phase 3`: complete
- `Phase 4`: complete

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
