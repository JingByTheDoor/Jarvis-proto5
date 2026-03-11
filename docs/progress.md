# Progress

## 2026-03-11

- what changed: Bootstrapped the Phase 0A workspace, added the canonical docs, defined the schema registry, shared enums, approval hashing, canonical-path policy, network-scope policy, untrusted-content guard, redaction pipeline, capability-token contract types, IPC contract map, and the full contract-level test suite for this slice.
- why it changed: The repo was greenfield, and the master sheet requires a frozen safety spine before shell, runtime, or UI work can safely proceed.
- files touched: `package.json`, `package-lock.json`, `tsconfig.json`, `vitest.config.ts`, `src/index.ts`, `src/shared/*`, `src/core/schemas/*`, `src/core/approval/hashes.ts`, `src/core/capabilities/*`, `src/core/planning/untrusted-content.ts`, `src/core/redaction/redactor.ts`, `tests/**/*`, `docs/constitution.md`, `docs/task_plan.md`, `docs/progress.md`, `docs/findings.md`
- what was tested: `npm run typecheck`; `npm test` with schema contract tests, IPC boundary tests, approval signature tests, redaction tests, renderer hardening config tests, canonical path tests, network scope / SSRF tests, and untrusted-content boundary tests.
- current status: Phase 0A is complete and verified. Phase 0 remains open because encrypted-at-rest implementation and verification are still deferred.
- next step: Implement the platform-backed encrypted-at-rest layer and its verification tests so Phase 0 can close before Phase 1 begins.

## 2026-03-11 Phase 0 Completion

- what changed: Added the Windows DPAPI-backed encrypted-at-rest provider, exported the new persistence contract surface, expanded prompt-injection coverage across all named untrusted source classes, and completed the constitution updates required to freeze persistence, quota, renderer-hardening, and crash-cleanup policy.
- why it changed: The master sheet does not allow Phase 0 to close until encrypted-at-rest verification passes and the remaining named hardening expectations are explicit in the canonical docs.
- files touched: `src/core/persistence/encrypted-at-rest.ts`, `src/index.ts`, `tests/persistence/encrypted-at-rest.test.ts`, `tests/policies/prompt-injection-boundary.test.ts`, `docs/constitution.md`, `docs/task_plan.md`, `docs/progress.md`, `docs/findings.md`
- what was tested: `npm run typecheck`; `npm test` covering 52 passing tests across schema contracts, IPC boundaries, approval signature equality/inequality, redaction, renderer hardening config, canonical path enforcement, network scope / SSRF policy, prompt-injection boundaries, untrusted-content boundaries, and encrypted-at-rest verification for logs, memory stores, caches, sensitive settings, and export staging.
- current status: Phase 0 is complete and verified on Windows. The repo is ready to start Phase 1.
- next step: Build the thin Electron shell with a hardened preload bridge and the minimum Command Center frame required by Phase 1.

## 2026-03-11 Phase 1 Completion

- what changed: Added the Electron main-process shell, `app://jarvis` protocol registration, default-deny session and navigation guards, the narrow typed preload bridge, the React/Vite dashboard frame, the Command Center skeleton, and scaffold pages for Tasks & Projects, Second Brain, Connections, and Settings. Also split the desktop API contract into a renderer-safe shared module so the browser bundle does not depend on preload/runtime code.
- why it changed: The Phase 1 sheet requires a real hardened shell before any risky capability can be exposed, and it requires the primary UI surfaces to exist where the first golden workflow will later land.
- files touched: `package.json`, `package-lock.json`, `tsconfig.json`, `vitest.config.ts`, `vite.config.ts`, `index.html`, `src/main/*`, `src/preload/*`, `src/renderer/*`, `src/shared/desktop-api.ts`, `src/shared/index.ts`, `src/shared/ipc.ts`, `tests/main/*`, `tests/preload/*`, `tests/renderer/*`, `docs/task_plan.md`, `docs/progress.md`, `docs/findings.md`
- what was tested: `npm run typecheck`; `npm test` with 61 passing tests; `npm run build`; `npm run smoke:electron`. The new coverage includes sender validation, default-deny permission/navigation/popup behavior, preload schema validation, renderer shell smoke tests, and a real Electron startup smoke pass.
- current status: Phase 1 is complete and verified. The app boots, the shell is hardened, the preload bridge is typed, and the default UI path is in place without exposing risky capability.
- next step: Start Phase 2 by wiring task intake, typed repo/file tools, compile-time manifest generation, and exact diff preview for the first real repo/edit workflow.
