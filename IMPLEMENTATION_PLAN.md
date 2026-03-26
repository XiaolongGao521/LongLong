# IMPLEMENTATION_PLAN.md

Goal: make Laizy publishable on npm and add Apache-2.0 licensing, using the Laizy-native supervisor/planner flow rather than manual milestone authoring.

## Execution rules
- This plan is the authoritative execution queue for the npm-publishable + Apache-2.0 slice.
- Advance one highest-priority incomplete milestone at a time.
- After each completed milestone: update this file, verify with `/usr/bin/node scripts/build-check.mjs`, commit exactly once, and push immediately.
- Keep scope narrow and compatibility-safe; prefer publishable-package wiring over broad product changes.
- The compiled CLI entrypoint is `dist/src/index.js`; use `start-run` and `supervisor-tick` to drive the run.
- Treat `npm pack --dry-run` plus `/usr/bin/node scripts/build-check.mjs` as the packaging-readiness gates for this slice.

### [x] P1 - Add npm-ready package metadata and Apache-2.0 licensing
- Added publish-ready `package.json` metadata: Apache-2.0 license, repository/homepage/bugs links, explicit CLI/package entrypoints, and an explicit minimal `files` publish surface.
- Added the Apache-2.0 `LICENSE` file and aligned `README.md` wording around the published `laizy` CLI entrypoint and package identity.
- Limited the intended published artifact to compiled runtime assets plus required package docs (`dist/`, `README.md`, `LICENSE`).
- Verification checkpoint passed: `/usr/bin/node scripts/build-check.mjs`

### [x] P2 - Make the package packable from a clean checkout
- Added a minimal `prepack` compile step so `npm pack --dry-run` can rebuild `dist/` even when generated output is absent from git.
- Validated the tarball surface after removing `dist/`: the package included the compiled CLI/runtime entrypoint and excluded repo-internal state/noise, shipping only the intended files.
- Kept the change set narrow and compatible with the existing local workflow by reusing the existing TypeScript compile command rather than broader packaging changes.
- Verification checkpoint passed: `/usr/bin/node scripts/build-check.mjs`

### [x] P3 - Refresh README/publish docs and finish package verification
- Updated `README.md` with npm install/usage guidance, package publish/readiness expectations, and the Apache-2.0 notice for the packaged `laizy` CLI.
- Recorded the final package-readiness checks in-repo: `/usr/bin/node scripts/build-check.mjs` passed and `/usr/bin/npm pack --dry-run` produced the expected tarball containing only the intended runtime/docs files.
- Final verification note: the packaged CLI is publish-ready with `prepack` rebuilding `dist/` and the publish surface constrained to `dist/`, `README.md`, and `LICENSE`.
- Verification checkpoint passed: `/usr/bin/node scripts/build-check.mjs`
