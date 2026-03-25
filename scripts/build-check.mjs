import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  createImplementerContract,
  createPlannerIntent,
  selectNextActionableMilestone,
  writeContractDocument,
} from '../src/core/contracts.mjs';
import {
  eventLogPathForSnapshot,
  initializeRunArtifacts,
  loadRunEvents,
  transitionMilestone,
} from '../src/core/events.mjs';
import { loadImplementationPlan, summarizePlan } from '../src/core/plan.mjs';
import { createRunState } from '../src/core/run-state.mjs';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function runNodeCheck(target) {
  const result = spawnSync(process.execPath, ['--check', target], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `node --check failed for ${target}`);
  }
}

runNodeCheck('src/index.mjs');
runNodeCheck('src/core/plan.mjs');
runNodeCheck('src/core/run-state.mjs');
runNodeCheck('src/core/events.mjs');
runNodeCheck('src/core/contracts.mjs');

const plan = loadImplementationPlan('IMPLEMENTATION_PLAN.md');
const summary = summarizePlan(plan.milestones);
const nextMilestoneId = summary.next?.id;
assert(summary.total >= 4, 'expected at least four milestones in IMPLEMENTATION_PLAN.md');
assert(nextMilestoneId === 'L4', 'expected next incomplete milestone to be L4 after planner-contract milestone');

const tempDir = mkdtempSync(path.join(os.tmpdir(), 'laizy-build-'));
const snapshotPath = path.join(tempDir, 'run.json');

const runState = createRunState({
  runId: 'build-check',
  goal: 'Verify event-log-backed run state',
  repoPath: process.cwd(),
  planPath: plan.path,
  milestones: plan.milestones,
});

const initialized = initializeRunArtifacts(snapshotPath, runState);
assert(initialized.snapshot.currentMilestoneId === nextMilestoneId, `expected initialized run to point at ${nextMilestoneId}`);
assert(initialized.snapshot.status === 'planned', 'expected initialized run status to be planned');
assert(initialized.snapshot.eventCount === 1, 'expected one initialization event');
assert(
  (initialized.snapshot.milestones.find((milestone) => milestone.id === nextMilestoneId)?.details.length ?? 0) >= 1,
  'expected active milestone details to be captured from the implementation plan',
);

const selected = selectNextActionableMilestone(initialized.snapshot);
assert(selected?.id === nextMilestoneId, `expected actionable milestone selection to return ${nextMilestoneId}`);

const plannerIntent = createPlannerIntent(initialized.snapshot, selected);
assert(plannerIntent.kind === 'planner.intent', 'expected planner intent document kind');
assert(plannerIntent.scope.milestoneCount === 1, 'expected planner intent to enforce single-milestone scope');
assert((plannerIntent.selectedMilestone?.details.length ?? 0) >= 1, 'expected planner intent to include milestone details');

const implementerContract = createImplementerContract(initialized.snapshot, selected);
assert(implementerContract.kind === 'implementer.contract', 'expected implementer contract document kind');
assert(implementerContract.milestone?.id === nextMilestoneId, `expected implementer contract to target ${nextMilestoneId}`);

const contractPath = writeContractDocument(path.join(tempDir, 'contracts', 'implementer.json'), implementerContract);
const persistedContract = JSON.parse(readFileSync(contractPath, 'utf8'));
assert(persistedContract.milestone?.id === nextMilestoneId, `expected persisted contract to target ${nextMilestoneId}`);

transitionMilestone(snapshotPath, {
  milestoneId: nextMilestoneId,
  status: 'implementing',
  note: 'worker picked up milestone',
});
transitionMilestone(snapshotPath, {
  milestoneId: nextMilestoneId,
  status: 'verifying',
  note: 'verification started',
});
const completed = transitionMilestone(snapshotPath, {
  milestoneId: nextMilestoneId,
  status: 'completed',
  note: 'verification passed',
});

assert(completed.snapshot.currentMilestoneId === 'L5', 'expected completed milestone to advance current pointer to L5');
assert(completed.snapshot.status === 'planned', 'expected run to return to planned after a milestone completes');
assert(completed.snapshot.eventCount === 4, 'expected three transitions plus initialization in event log');

const persisted = JSON.parse(readFileSync(snapshotPath, 'utf8'));
assert(persisted.currentMilestoneId === 'L5', 'expected persisted snapshot to point at L5');
assert(persisted.milestones.find((milestone) => milestone.id === nextMilestoneId)?.status === 'completed', 'expected persisted active milestone status to be completed');

const events = loadRunEvents(eventLogPathForSnapshot(snapshotPath));
assert(events.length === 4, 'expected event log to contain four events');

rmSync(tempDir, { recursive: true, force: true });
console.log('build-check: ok');
