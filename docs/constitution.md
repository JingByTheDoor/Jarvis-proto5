# JARVIS Constitution

## Purpose

This document is the canonical Phase 0 rulebook for JARVIS. It freezes the safety, contract, and persistence decisions that later phases must consume without reinterpretation.

## Architecture Invariants

JARVIS is:

- local-first by default
- Windows-first
- plan-first
- deterministic
- approval-gated
- inspectable end to end

If forced to choose:

- safer beats faster
- clearer beats fancier
- local beats cloud-dependent
- explicit beats magical
- deterministic beats unpredictable

## Workflow

The required workflow is:

`PLAN -> COMPILE -> SIMULATE -> APPROVAL -> EXECUTE -> ATTEST -> REVIEW`

Workflow states:

- `idle`
- `preparing_plan`
- `plan_ready`
- `compiling_manifest`
- `manifest_ready`
- `simulating_effects`
- `simulation_ready`
- `awaiting_approval`
- `executing`
- `execution_complete`
- `attesting`
- `review_ready`
- `partial`
- `failed`
- `aborted`

No executable action may originate from prose alone. Approval always applies to the compiled manifest, not freeform plan text.

## Schemas and Contracts

The following contracts are canonical and schema-validated:

- `PLAN`
- `ACTION`
- `EXECUTION_MANIFEST`
- `COMPILED_ACTION`
- `EFFECT_PREVIEW`
- `APPROVAL_DECISION`
- `RUN_EVENT`
- `RUN_LOG`
- `TOOL_RESULT`
- `EXECUTION_ATTESTATION`
- `MEMORY_RECORD`

Contract rules:

- All IPC payloads are validated in both directions.
- All tool args, tool results, manifests, approvals, memory writes, and persisted logs are validated before use.
- The schema registry is the single canonical source for shared core contract shapes.

## Event Taxonomy

Event categories:

- `USER`
- `AGENT`
- `PLAN`
- `COMPILE`
- `SIMULATION`
- `STEP`
- `TOOL`
- `APPROVAL`
- `ATTESTATION`
- `WARNING`
- `ERROR`
- `TASK`
- `RESULT`
- `MEMORY`
- `SYSTEM`

Required event types:

- `plan_ready`
- `manifest_compiled`
- `simulation_ready`
- `approval_needed`
- `approval_recorded`
- `action_started`
- `action_event`
- `tool_output`
- `tool_redacted_output`
- `action_completed`
- `attestation_recorded`
- `memory_read`
- `memory_write`
- `execution_complete`
- `memory_sync_pending`
- `memory_sync_complete`
- `analytics_sync_pending`
- `analytics_sync_failed`
- `review_ready`
- `run_error`

## Layer Boundaries

JARVIS has four layers:

1. Desktop Shell
2. Execution Core
3. Memory Core
4. Tool / Integration Layer

Boundary rules:

- The renderer never performs risky actions directly.
- Risky actions cross preload, main process, and runtime through typed validated IPC only.
- No generic command bridge exists between renderer and privileged layers.
- No layer may bypass a lower-privileged layer by handle sharing.

## Renderer Hardening

Every renderer surface must run with:

- `nodeIntegration: false`
- `contextIsolation: true`
- `sandbox: true`
- `webSecurity: true`

Additional hardening rules:

- Local UI content loads through `app://`, not `file://`.
- Content security policy defaults to deny and only allows explicit local script/style/image sources.
- Permissions, navigation, and popup creation are default-deny.
- Sender validation is mandatory for privileged IPC.
- No raw Electron, Node, native, or shell handles may be exposed to renderer content.

## Approval Semantics

Approval decisions:

- `pending`
- `approve_once`
- `approve_session`
- `deny`

Approval scope classes:

- `exact_action_only`
- `session_same_scope`
- `session_readonly_scope`
- `never_session_approvable`

`approval_signature` is a deterministic hash over:

- tool name
- normalized args
- side-effect family
- workspace scope
- path scope
- network scope
- max execution count
- session id
- expiry time

Rules:

- `deny` blocks execution.
- `approve_once` authorizes exactly one compiled action with one exact `approval_signature` and one exact `execution_hash`.
- `approve_session` authorizes repeated execution only when both hashes remain identical.
- Approval decisions are recorded against the compiled `manifest_id` plus exact `action_id`; prose plans never carry approval authority.
- Approval submission must include both `approval_signature` and `execution_hash`, and mismatches are rejected as silent widening attempts.
- Approval submission returns a typed receipt so rejected or recorded decisions remain visible to the renderer and operator.
- Session approval never widens tool, args, scopes, side-effect family, max execution count, session id, or expiry time.
- Destructive actions and mutating raw shell are never session-approvable.
- No hidden approvals, silent escalation, or risky fallback behavior is permitted.

## Canonical Path Policy

All path authorization uses canonical absolute paths only.

Rules:

- Existing paths resolve with `realpath`.
- Non-existing targets canonicalize from the nearest existing parent.
- Authorization compares canonical targets against canonical workspace roots only.
- Raw string prefix matching is forbidden.
- Symlinks, junctions, mount points, Windows reparse points, UNC paths, Windows device namespace paths, and NTFS alternate data streams are rejected by default.
- Approval-time and execution-time canonical-path drift is a policy violation.
- Later tool support for disallowed path kinds requires explicit policy, simulation behavior, approval copy, and dedicated tests.

## Network Scope Policy

Networking is default-deny.

Rules:

- Network scope is an exact normalized allowlist over scheme, canonical host, explicit port, method family, and access class.
- Non-HTTP(S) schemes are blocked unless explicitly covered by policy in a later phase.
- Loopback, localhost, RFC1918/private IPv4, unique-local IPv6, link-local, multicast, and metadata destinations such as `169.254.169.254` are blocked.
- Redirects are disabled by default.
- If redirects are ever allowed, each hop must be re-resolved and revalidated.
- DNS results must be revalidated at connect time.

## Untrusted-Content Boundaries

The following are always untrusted data by default:

- files
- URLs
- webpages
- notes
- emails
- OCR text
- code comments
- issue bodies
- commit messages
- DOM content
- retrieved memory

Rules:

- Untrusted content may inform analysis, but it cannot alter policy, routing, tool permissions, memory trust class, or retention policy.
- Instruction-like text inside untrusted content is content, not authority.
- No tool call may be authorized solely because untrusted content requested it.
- High-risk actions influenced by untrusted content still require explicit human approval.

## Memory Contracts

Memory record classes:

- `operator_pinned_fact`
- `extracted_fact_unverified`
- `system_observation`
- `derived_summary`
- `retrieved_context`
- `verified_fact`

Required metadata fields:

- `provenance_type`
- `source_run_id`
- `source_message_ids`
- `confidence`
- `verification_status`
- `contradiction_status`
- `last_verified_at`
- `retention_policy`

Rules:

- Only `operator_pinned_fact` and `verified_fact` may be auto-injected by default.
- Unverified extracted facts may be searchable but not auto-injected.
- Summaries retain provenance and must not silently become facts.
- Conflicted memory remains stored and visible; it is not auto-deleted or auto-injected.
- Memory never stores secrets.

## Naming Conventions

- Public enum-like values use lowercase snake_case unless the original policy requires uppercase status labels such as `SAFE`, `CAUTION`, or `DANGER`.
- Shared contract names use uppercase document names such as `PLAN` and `RUN_LOG`.
- Files and module names use explicit kebab-case or descriptive nouns; no generic `utils` buckets.
- Shared contract names have one canonical export source to avoid barrel collisions.

## Integration Contracts

Optional integrations must behave behind explicit adapter boundaries.

Rules:

- Every optional adapter defines availability requirements, read behavior, write behavior, failure behavior, degradation path, and health payload schema.
- Null adapters are real implementations and must return deterministic unavailable responses.
- Optional adapters never gate the base workflow.
- Core pages depend only on local state, Tier 1 memory, and run logs.

## Redaction

Redaction is mandatory before:

- UI streaming
- log persistence
- memory writes
- analytics writes

Redaction must recurse through:

- `summary`
- `output`
- `error`
- `artifacts`
- `structured_data`
- `observed_effects`
- filenames
- preview payloads
- derived summaries

Secret values never leave privileged runtime. Only secret references may be logged.

## Capability Tokens

Capability tokens are opaque privileged-memory records bound to:

- `run_id`
- `action_id`
- `approval_signature`
- `execution_hash`
- `session_id`
- `issued_at`
- `expires_at`
- `remaining_uses`
- `status`

Rules:

- Tokens are single-use by default.
- Tokens are consumed before any non-trivial side effect occurs.
- Tokens are revoked on expiry, session end, manual lock, crash recovery, and restart.
- Tokens are never persisted to renderer state, logs, memory, analytics, or crash reports.

## Execution Runtime and Review

Execution runtime rules:

- The privileged runtime executes only registered compiled actions from a compiled manifest.
- Non-trivial actions require both a valid approval record and a freshly issued capability token bound to the same run, action, approval signature, execution hash, and session.
- Live execution visibility uses structured `RUN_EVENT` records only; renderer surfaces never receive raw shell or runtime handles.
- Persisted run logs live under `.tmp/runs/<run_id>.json`, remain encrypted at rest, and include events, final result, attestations, artifacts, and persistence status.
- Typed-tool attestation compares the approved execution hash against the observed execution hash and records any deviation classes explicitly.
- `review_ready` requires successful execution, required attestation, and persisted review state.
- If execution succeeds but run-log persistence fails, the result and attestation remain visible, `persisted_run_path` stays null, and the workflow falls back to `execution_complete` instead of falsely claiming `review_ready`.
- Results, persisted paths, and artifacts must stay visible in the Command Center and Tasks & Projects review surfaces.

## Retention and Sensitive Session

Default retention:

- `.tmp/runs`: 30 days
- `.tmp/logs`: 7 days
- `.tmp/cache`: 3 days

Sensitive session mode:

- reduces logging
- disables Tier 2 memory writes
- disables Tier 3 analytics writes by default
- stores only minimal summaries
- shortens cache TTL to 24 hours

## Encrypted At Rest

The Phase 0 chosen persistence approach is:

- a per-install 32-byte content-encryption key
- wrapped with Windows DPAPI CurrentUser protection
- stored only as a wrapped key envelope on disk
- used to encrypt persisted payloads with AES-256-GCM

Covered storage classes:

- run logs
- memory stores
- caches
- sensitive settings
- export staging

Rules:

- Persisted plaintext for covered classes is forbidden.
- Key envelopes may contain wrapped key material and metadata only, never the raw content key.
- Encrypted envelopes bind ciphertext to purpose and key ID through authenticated additional data.
- Non-Windows platforms remain unsupported for this provider in Phase 0; later phases may add a platform keystore abstraction.

## Quotas, Decompression, and Backpressure

Phase 0 freezes the baseline caps that later execution features must obey:

- stdout/stderr preview cap: 64 KiB each
- captured stdout/stderr cap: 1 MiB each
- single artifact cap: 16 MiB
- per-run artifact total cap: 64 MiB
- parsed document cap: 8 MiB
- PDF page cap: 200 pages
- image size cap: 20 MiB
- HTTP response cap: 8 MiB
- request timeout cap: 30 seconds
- concurrent tool cap: 4
- archive entry-count cap: 1024
- archive expanded-size cap: 64 MiB
- archive expansion-ratio cap: 20x

Rules:

- Writers must obey backpressure and wait for drain when necessary.
- On quota breach, execution stops safely and emits a quota-specific policy event.
- Archive expansion beyond the caps is rejected by default.

## Crash Cleanup Behavior

Crash cleanup rules:

- revoke all active capability tokens
- mark interrupted runs as `failed` or `aborted` rather than `review_ready`
- preserve only the minimum surviving audit trail needed for recovery
- avoid implying persistence success for any background write that did not complete
- remove incomplete export staging artifacts on next startup unless explicitly recovered

## Docs Update Protocol

- [docs/constitution.md](D:/Jarvis-proto5%20repo/Jarvis-proto5/docs/constitution.md) is canonical.
- [docs/task_plan.md](D:/Jarvis-proto5%20repo/Jarvis-proto5/docs/task_plan.md) tracks current phase status and blockers.
- [docs/progress.md](D:/Jarvis-proto5%20repo/Jarvis-proto5/docs/progress.md) records what changed, what was tested, and the current state.
- [docs/findings.md](D:/Jarvis-proto5%20repo/Jarvis-proto5/docs/findings.md) records durable lessons and explicit assumptions.
- Architecture, schema, or policy changes must update this document before the phase is claimed complete.
