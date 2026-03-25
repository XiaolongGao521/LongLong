Goal: replace the remaining manual supervisor/orchestrator glue with thin Laizy-native CLI wrappers that deterministically read durable run state and emit the next machine-readable action documents.

## Execution rules
- This plan is the authoritative execution queue for the supervisor-wrapper slice.
- Advance one highest-priority incomplete milestone at a time.
- After each completed milestone: update this file, verify with `/usr/bin/node scripts/build-check.mjs`, commit exactly once, and push immediately.
- Keep scope narrow and compatibility-safe; prefer wrappers around existing primitives over new orchestration subsystems.
- The compiled CLI entrypoint is `dist/src/index.js`; operator docs should teach that path, not source files.

### [x] W3 - Add a deterministic supervisor tick wrapper
- Added a top-level `supervisor-tick` CLI command that rebuilds durable run state from the snapshot, evaluates health, and emits one machine-readable supervisor decision bundle.
- The bundle classifies the next deterministic action as continue, verify, recover, or closeout, then writes the corresponding bounded documents and OpenClaw adapters alongside a stable manifest.
- Reused existing implementer, recovery, verification, and OpenClaw primitives instead of introducing a new orchestration subsystem; the wrapper is packaging and decision glue over the current compiled CLI flow.
- Added explicit closeout guidance with a machine-readable watchdog disable cron adapter so operators no longer need to compose shutdown guidance by hand.
- Verification checkpoint: `/usr/bin/node scripts/build-check.mjs`
- Discovery: the health model treats a freshly planned run as `rehand-off`, so the supervisor layer must special-case planned bootstrap continuation instead of blindly mapping every non-`none` recommendation to recovery.
- Discovery: covering the wrapper in `build-check` needs state-specific assertions for continue, recover, verify, and closeout so decision drift is caught before operators see inconsistent next-action bundles.

### [x] W4 - Refresh README for supervisor-driven continuation and closeout
- Updated `README.md` so the primary operator flow is `start-run` once for bootstrap, then `supervisor-tick` for deterministic continuation, recovery handoff, verification, and closeout.
- Documented the supervisor decision bundle as the source of truth for next-action selection, including the continue/recover/verify/closeout classifications and the emitted handoff/adapter artifacts.
- Kept the lower-level CLI commands documented as building blocks while explicitly demoting them below the wrapper-driven path.
- Verification checkpoint: `/usr/bin/node scripts/build-check.mjs`
- Discovery: the README needed to explain not just the wrapper command itself, but the operator contract that supervisors should consume emitted manifests instead of reconstructing next steps in freeform chat.
