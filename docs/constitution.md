# JARVIS Constitution

## Purpose

This document is the canonical Phase 0 rulebook for JARVIS. It freezes the safety and contract decisions that later phases must consume without reinterpretation.

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
- Session approval never widens tool, args, scopes, side-effect family, max execution count, session id, or expiry time.
- Destructive actions and mutating raw shell are never session-approvable.

## Canonical Path Policy

All path authorization uses canonical absolute paths only.

Rules:

- Existing paths resolve with `realpath`.
- Non-existing targets canonicalize from the nearest existing parent.
- Authorization compares canonical targets against canonical workspace roots only.
- Raw string prefix matching is forbidden.
- Symlinks, junctions, mount points, Windows reparse points, UNC paths, Windows device namespace paths, and NTFS alternate data streams are rejected by default.
- Approval-time and execution-time canonical-path drift is a policy violation.

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

Tokens are single-use by default, never persisted to renderer state or logs, and must be revoked on expiry, session end, manual lock, crash recovery, and restart.

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

Persisted secrets, sensitive settings, run logs, memory stores, caches, and export staging areas must be encrypted at rest where platform support exists. Phase 0A defines the requirement but does not yet implement platform-backed verification.

## Docs Update Protocol

- `docs/constitution.md` is canonical.
- `docs/task_plan.md` tracks current phase status and blockers.
- `docs/progress.md` records what changed, what was tested, and the current state.
- `docs/findings.md` records durable lessons and explicit assumptions.
- Architecture, schema, or policy changes must update this document before the phase is claimed complete.

