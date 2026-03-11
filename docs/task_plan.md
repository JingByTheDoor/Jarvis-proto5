# Task Plan

## Current Focus

- Phase 0A: foundation contracts and policy spine

## Scope

- Bootstrap the TypeScript + Vitest + Zod workspace.
- Create the canonical docs structure.
- Define the core schemas, shared enums, policy modules, and IPC contract layer.
- Add contract-level tests for schemas, IPC, approval hashing, redaction, renderer hardening, canonical paths, network scope, and untrusted-content boundaries.

## Explicit Deferrals

- Electron boot and UI work remain deferred to Phase 1.
- Execution runtime, simulation runtime, and capability-token issuance remain deferred to later phases.
- Encrypted-at-rest implementation and verification remain open blockers for Phase 0 completion.

## Phase 0 Status

- `Phase 0A`: complete
- `Phase 0`: open

## Remaining Phase 0 Blockers

- Platform-backed encrypted-at-rest implementation and verification tests for logs, memory, caches, and sensitive settings.
- Any remaining named hardening cases not covered by the current contract-only slice.
