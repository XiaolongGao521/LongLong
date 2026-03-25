Goal: replace the remaining manual supervisor/orchestrator glue with a thin Laizy-native wrapper that boots a deterministic run from the compiled CLI.

## Execution rules
- This plan is the authoritative execution queue for the supervisor-wrapper slice.
- Advance one highest-priority incomplete milestone at a time.
- After each completed milestone: update this file, verify with `/usr/bin/node scripts/build-check.mjs`, commit exactly once, and push immediately.
- Keep scope narrow and compatibility-safe; prefer wrappers around existing primitives over new orchestration subsystems.
- The compiled CLI entrypoint is `dist/src/index.js`; operator docs should teach that path, not source files.

### [x] W1 - Add a top-level run bootstrap wrapper
- Added a `start-run` CLI command that composes run initialization, planner intent emission, implementer contract emission, and initial OpenClaw bootstrap adapter emission in one deterministic step.
- The wrapper writes a bootstrap bundle alongside the snapshot, including the snapshot/event log plus planner/implementer/watchdog bootstrap documents for the active run.
- Added a machine-readable `run.bootstrap` manifest so an external supervisor can consume one stable document instead of manually chaining several Laizy subcommands.
- Kept the implementation thin by reusing existing run-state, contract, and OpenClaw adapter primitives rather than introducing a new orchestration layer.
- Verification checkpoint: `/usr/bin/node scripts/build-check.mjs`
- Discovery: the repo verification script should not encode an old plan-shape assumption like “at least four milestones,” because a narrower authoritative plan is still valid and should stay buildable.
- Discovery: validating the wrapper by invoking the compiled CLI from build-check catches wiring drift that pure module-level assertions would miss.

### [ ] W2 - Refresh README for the wrapper-driven CLI flow
- Update `README.md` so the primary usage path is the compiled CLI under `dist/src/index.js`.
- Document the new top-level bootstrap command, the artifacts it writes, and how it reduces manual supervisor glue.
- Keep lower-level subcommands documented as building blocks, but make the wrapper flow the practical getting-started path.
- Verification checkpoint: `/usr/bin/node scripts/build-check.mjs`
