# Laizy metrics plan

Laizy should measure whether the repo control loop is behaving well, not whether the product can generate impressive autonomy claims.

The useful metrics are the ones that tell an operator whether milestone-based delivery is healthy, inspectable, and recoverable.

## Principles

- prefer a small set of operational metrics over vanity dashboards
- derive metrics from durable run artifacts where possible
- keep milestone completion tied to verification evidence
- track recovery because interruptions are normal, not exceptional

## Core metrics

### 1. Milestone throughput

Questions answered:

- How many milestones completed in a run?
- How long does a milestone spend in each lifecycle state?

Suggested measures:

- milestone count per run
- median time from `planned` to `completed`
- time spent in `implementing`
- time spent in `verifying`

Primary sources:

- `state/runs/*.events.jsonl`
- derived snapshot milestone timestamps

### 2. Verification discipline

Questions answered:

- Are milestones actually being verified before completion?
- How often does verification fail or need retry?

Suggested measures:

- percent of completed milestones with a passed verification record
- failed verification count per run
- average verification retries per milestone
- percent of milestones completed on first verification pass

Primary sources:

- verification records in the run snapshot
- reviewer-output documents under `state/verification/`
- supervisor decisions and bundles when checking whether Stage 4 kept the retry path bounded to the active milestone

Stage 4 verification-flow hardening should remain inspectable from artifacts alone. In practice, that means an operator should be able to confirm all of the following without replaying chat history:

- the active milestone entered `verifying`
- the verification command that was run
- whether the latest verification verdict passed or failed
- whether reviewer guidance says to `complete-milestone` or retry the same milestone
- that completion only happened after a passed verification result was recorded

### 3. Recovery and watchdog health

Questions answered:

- How often does the loop stall?
- Does recovery get the run moving again?

Suggested measures:

- recovery-plan count per run
- recovery-action count per run
- mean time from stall detection to resumed progress
- percent of recoveries that return the milestone to normal completion

Primary sources:

- health reports
- recovery plans
- recovery-action events
- subsequent milestone transitions

### 4. Plan quality

Questions answered:

- Are milestones small enough and actionable enough?
- Is the plan feeding the supervisor cleanly?

Suggested measures:

- percent of runs that start in `actionable` vs `needs-plan`
- average milestone detail count
- blocked milestone count per run
- replan decision count per run

Primary sources:

- snapshots
- supervisor decisions
- planner request and planner intent artifacts

### 5. Backend readiness

Questions answered:

- Are configured worker backends healthy before handoff?
- Which failures are environmental versus workflow related?
- Does the operator-facing validation story match the emitted handoff/runtime guidance?

Suggested measures:

- backend preflight pass rate by worker role
- most common failed probe type: installation, invocation, liveness
- average time spent blocked on backend setup
- percent of healthy runs where `check-backends` and emitted adapters both recommend proceeding to the same bounded handoff

Primary sources:

- backend-check artifacts
- supervisor bundles that gate on backend health
- operator-facing docs and emitted adapter guidance when confirming the same preflight outcome is described in both places

Stage 5 backend/operator ergonomics should remain inspectable from repo artifacts and docs alone. In practice, that means an operator should be able to confirm all of the following without reconstructing chat history:

- `laizy check-backends` exposes a concise handoff summary before worker execution
- the README/operator docs describe the same repo-native control loop as the emitted backend adapters
- backend failures stay attributable to concrete probe results instead of vague runtime errors
- a healthy backend result still points the operator at the same bounded milestone handoff rather than a broader workflow jump

## Milestone scorecard for a run

A practical run summary can stay small:

- run id
- total milestones
- completed milestones
- verification pass rate
- recovery count
- blocked count
- backend preflight failures
- current or final run status

That is enough to tell whether the loop is working without creating a separate analytics product.

## What not to optimize for

Avoid treating these as success metrics:

- number of spawned workers
- prompt length
- raw token volume
- broad claims about autonomy
- session count without outcome context

Those numbers can go up while the actual delivery loop gets worse.

## Instrumentation approach

Near-term instrumentation should reuse the artifacts Laizy already writes.

### Phase 1

- document the desired metrics
- do manual inspection from snapshots and event logs
- avoid schema churn just to support dashboards

### Phase 2

- add a small summarizer command or script that reads run artifacts and outputs a machine-readable scorecard
- keep the scorecard derived rather than adding duplicate source-of-truth files

### Phase 3

- if needed, add stable aggregate reporting for repeated operator review
- continue treating run artifacts as the canonical inputs

## Success definition

Laizy is succeeding when an operator can answer these questions quickly from the repo:

- what happened in this run?
- what milestone is active?
- was the milestone verified?
- did recovery happen?
- is the configured backend healthy?
- what should happen next?

If the metrics help answer those questions, they are good metrics.
