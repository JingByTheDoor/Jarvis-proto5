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
