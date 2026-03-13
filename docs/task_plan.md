# Task Plan

## Current Focus

- Phase 6 Slice H: add guided operator evidence capture so real planner-assisted golden-workflow journeys can count cleanly toward the proof gate.

## Scope

- Persist local workflow-proof records for the golden workflow under encrypted local storage.
- Track task-to-preview latency, approval-to-first-result latency, execute-to-first-result latency, and operator steps/clicks.
- Track cold start to usable composer, preview-to-approval latency, and repeat-task speed with context reuse in the same local proof records.
- Track whether resume-from-recall is being used and whether resumed journeys reach `review_ready`.
- Surface proof-gate summary data, criterion evidence windows, a conservative local gate verdict, and a consolidated typed proof report in the UI without broadening routing, memory tiers, or optional providers.
- Add one optional local planner adapter that can normalize natural-language tasks into the existing supported v1 typed routes while leaving deterministic compile, simulation, approval, execution, attestation, and review in control.
- Surface planner/provider health, null-adapter behavior, and session-local provider/model selection in Connections, Settings, and the Command Center.
- Add typed per-run delete/export controls for persisted run review data and make retention plus sensitive-session defaults explicit in Settings.
- Add a guided evidence-capture mode that tags real planner-assisted golden-workflow journeys and keeps background measurements out of the gate by default.
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

## Phase 6 Slice B Notes

- The proof gate now evaluates local evidence into `collecting_evidence`, `blocked`, or `candidate_ready` instead of leaving the operator to infer readiness manually.
- Assumption: `candidate_ready` requires at least 3 recent golden edit journeys, 1 resumed `review_ready` journey, and 6 qualifying samples for trend checks; recent medians must stay at or below 4 workflow steps and 5 operator clicks.
- Advanced routing, durable memory, challenger logic, and optional providers remain blocked until the local gate reaches `candidate_ready` with real operator journeys.

## Phase 6 Slice C Notes

- The proof gate now tracks the remaining required speed gates from the master sheet: cold start to usable composer, preview-to-approval latency, and repeat-task speed with context reuse.
- Assumption: cold start to usable composer is measured from the main-process startup timestamp to the first renderer composer-ready timestamp, and repeat-task speed is currently evaluated by comparing resumed task-to-preview latency against the overall golden-workflow median.
- Broader routing, memory, challenger, and optional-provider work remain blocked until these speed gates are populated by real local journeys instead of fixtures.

## Phase 6 Slice D Notes

- Proof-gate criteria now carry typed sample counts, required counts, success counts, recent/previous medians, and threshold medians so blocked readiness can be inspected numerically.
- The Settings proof section now acts as a local evidence board rather than a prose-only verdict, which keeps the proof gate legible while broader expansion remains blocked.
- No routing, memory-tier, challenger, or optional-provider broadening is allowed until these inspectable criteria are satisfied by real local journeys.

## Phase 6 Slice E Notes

- Proof review now has a consolidated typed local report that summarizes summary metrics, gate criteria, blocking reasons, recent journeys, and assumption notes in deterministic order.
- Assumption: the proof report remains non-persistent by default so review tooling does not introduce a new plaintext storage path outside the encrypted proof store.
- No advanced routing, durable memory, challenger, or optional-provider work is allowed until real local journeys satisfy the underlying proof criteria, regardless of report availability.

## Phase 6 Slice F Notes

- A narrow local planner adapter now exists only to normalize natural-language task intake into the already-supported v1 routes; it does not authorize tools, approval, routing policy, or execution policy on its own.
- Assumption: a loopback-only local model adapter is allowed before broader optional-provider expansion because it remains optional, null-adapter-safe, and strictly bounded to planner assistance for the first golden workflow.
- Settings now exposes session-local planner provider/model selection, while Connections and the Command Center surface provider health and planner fallback state without making the planner mandatory for the base workflow.

## Phase 6 Slice G Notes

- Tasks & Projects now exposes typed per-run export and delete controls so persisted review state can be staged for export or removed without broadening routing or execution authority.
- Run exports are sanitized and staged under encrypted-at-rest local storage before any later out-of-app export path is considered; no plaintext export cache is introduced in this slice.
- Settings now shows the default retention TTLs plus sensitive-session defaults explicitly, which keeps local review-data posture inspectable while the proof gate is still open.

## Phase 6 Slice H Notes

- The Command Center now supports guided operator evidence capture so the next real planner-assisted golden edit journey can be armed, labeled, and tracked step by step.
- Workflow-proof storage still keeps background measurements locally, but the proof gate now evaluates guided captures only; this keeps noisy incidental runs from inflating or corrupting gate evidence.
- Guided capture favors natural-language planner-assisted journeys on the golden edit route, which makes the proof gate better aligned with the product-value question from the master sheet.
