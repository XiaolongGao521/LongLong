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

### [ ] W4 - Refresh README for supervisor-driven continuation and closeout
- Update `README.md` so the recommended operator flow shows `start-run` for bootstrap and `supervisor-tick` for deterministic continuation, recovery handoff, and closeout.
- Document the supervisor tick bundle/artifacts and how they replace the remaining manual chat reasoning around next action selection.
- Keep the lower-level commands documented as building blocks for adapters and tests, while making the wrapper flow the primary path.
- Verification checkpoint: `/usr/bin/node scripts/build-check.mjs`
