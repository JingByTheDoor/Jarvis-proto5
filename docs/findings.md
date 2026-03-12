# Findings

## 2026-03-11

- The workspace started as an empty Git repo with no tracked project files or prior build artifacts to preserve.
- Phase 0 needs a contract-first bootstrap; booting Electron first would violate the dependency order in the master sheet.
- Encrypted-at-rest is required by the sheet, but implementing and verifying it is intentionally deferred from this step and must remain an explicit blocker in `docs/task_plan.md`.
- Shared contract names should have a single canonical export source; `NetworkScopeRule` now comes from the schema layer to avoid barrel collisions between policy modules and schema modules.
- Windows DPAPI access through PowerShell requires `Add-Type -AssemblyName System.Security` before calling `ProtectedData`; without that assembly load, the provider is not available.
- Repeated DPAPI unwrap calls are slow enough to trip the default test timeout, so the per-install content key should be cached per provider instance after the first verified load.
- Tamper verification should mutate decoded ciphertext bytes and re-encode them, not rely on string replacement against base64 text that may not change the payload.
- Phase 0 encrypted-at-rest support is intentionally Windows-only for now; non-Windows keystore abstraction belongs to a later phase, not this closure patch.
- The desktop API contract should live in a shared renderer-safe module, not in preload implementation files; otherwise the renderer bundle can accidentally pull in Node-only schema/runtime code.
- Renderer shell tests need explicit DOM cleanup between cases because the Phase 1 shell intentionally duplicates some labels in the collapsed preview rail and the expandable detail rail.
- A dedicated `--smoke-test` Electron boot path is worth keeping because it verifies the real `app://jarvis` startup, preload path resolution, and shutdown path without needing full interactive testing.
- Phase 2 routing heuristics must treat dangerous verbs as manual-confirmation requests even if the prompt also mentions a repo; matching `repo` alone is too broad for a safe local-first default.
- Compile-time guard functions are worth keeping explicit because generic `COMPILED_ACTION` schemas cannot by themselves reject tool-specific unknown args or mismatched side-effect families.
- The first golden workflow can be meaningfully real before execution exists, as long as the repo inspection, exact diff preview, manifest compile, and dashboard inspection surfaces run against real local tools instead of mocks.
- Phase 3 risk must be derived after simulation, not inherited from the earlier route heuristic; the route can stay small while the simulated write still escalates to `DANGER`.
- Approved temp/output detection should be relative to workspace paths like `.tmp`, `dist`, `build`, `out`, or `output`; treating the OS temp directory itself as approved would silently under-classify risky repo overwrites in tests and in practice.
- The renderer inspection tests and DPAPI key-reuse test both need wider per-test timeouts now that the dashboard and persistence surfaces are doing more real work; the implementation stayed correct, but the default 5s ceiling became too tight.
- Approval submission cannot stay fire-and-forget once policy mismatches need to be visible; a typed request/response receipt is the smallest reliable way to surface rejected widening attempts in the renderer.
- Approval decisions need the exact `execution_hash` in addition to `approval_signature`; otherwise `approve_once` cannot prove it still targets the same compiled action.
- Approval TTLs must be enforced at submission time, not quietly extended by the registry; the correct fix for a failing approval test was to keep the decision inside the preview expiry window.
- Execution-hash and attestation consistency depend on canonical side-effect detail labels; using one string in compile and a different one in tool observations produces false attestation drift even when the file change is correct.
- The renderer-facing desktop API is a higher-level contract than Electron's raw `(event, payload)` listener shape; test stubs need to emit validated `RunEvent` objects directly or the Command Center event feed will fail on undefined `kind`.
- Phase 4 needs an explicit persistence-failure path: a run can execute and attest correctly while run-log persistence fails, and the UI must keep the result visible without falsely promoting the state to `review_ready`.
- Artifact visibility matters for reviewability even in the narrow slice; showing persisted run paths and artifact locations in the default review surfaces keeps the operator loop inspectable without adding a larger dashboard.
- Strict substring matching makes previous-task recall feel worse than it is; token-based matching is enough to recover useful runs like `safe run` where one token lives in the run id and the other in the run summary.
- Read-only guarded shell should remain `CAUTION`; low-confidence simulation should only auto-escalate to `DANGER` when write, delete, remote, or system effects are still possible.
- Empty temp repos need `git commit --allow-empty` in fixtures so guarded-shell and recall tests stay deterministic on machines without preexisting repo content.
- The current operator-note lookup intentionally scans local `notes/**` and `docs/**` `.md` / `.txt` files whose path indicates note-like content; this keeps recall useful without adding a persistent index or broad noisy search.
- Phase 5 duplicates some run identifiers across run-history and recall cards by design, so renderer assertions need to anchor on explicit copy or region scope instead of assuming global unique text.
- Local proof-gate metrics are best treated as first-party operational evidence, not as Tier 3 analytics; they should stay local, encrypted, and tightly scoped until optional analytics exists.
- Workflow-proof storage should avoid raw task text entirely; route, workflow state, timestamps, manifest/run ids, resume use, and step/click counts are enough to prove friction and stability without increasing secret risk.
- The first live `RUN_EVENT` is a better proxy for "first result" than the final execution response because it measures when the operator sees activity, not when the full run finishes.
- A recorded `deny` receipt must not unlock the Execute button; otherwise the UI would overstate workflow success and corrupt the proof-gate metrics.
