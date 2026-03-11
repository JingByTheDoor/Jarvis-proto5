# Task Plan

## Current Focus

- Phase 2: typed repo/file tools + simple compile

## Scope

- Implement the task-intake state machine for the first safe repo/edit workflow.
- Compile plan steps into typed manifest actions only.
- Add the first typed file/repo tools and exact diff preview support.
- Keep v1 routing local-first and require manual confirmation outside the typed slice.

## Explicit Deferrals

- Risk simulation, approval engine expansion, and capability-token-gated execution remain deferred to later phases.
- Routing sophistication beyond the v1 local-first profile remains deferred.
- Optional adapters and deeper memory tiers remain deferred until the first golden workflow is measurably faster than the DIY stack.

## Completed Phases

- `Phase 0A`: complete
- `Phase 0`: complete
- `Phase 1`: complete

## Phase 1 Closure Notes

- Electron now boots through a hardened `app://jarvis` shell with default-deny permissions, navigation, and popup behavior.
- The preload bridge is narrow, typed, schema-validated, and sender-validated.
- The React dashboard frame now exposes the required Phase 1 Command Center regions plus scaffold pages for Tasks & Projects, Second Brain, Connections, and Settings.

## Next Phase 2 Gates

- Task composer state machine from `idle` through `manifest_ready`.
- Typed repo/file tools for `list_directory`, `read_text_file`, `write_text_file`, `diff_file`, `git_status`, and `git_diff`.
- Compile each plan step into typed `COMPILED_ACTION` records with deterministic hashes.
- Exact diff preview and manifest inspection in the dashboard for the first real repo/edit workflow.
