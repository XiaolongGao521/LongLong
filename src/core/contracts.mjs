import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function findMilestone(snapshot, milestoneId) {
  const milestone = snapshot.milestones.find((candidate) => candidate.id === milestoneId);

  if (!milestone) {
    throw new Error(`Unknown milestone: ${milestoneId}`);
  }

  return milestone;
}

export function selectNextActionableMilestone(snapshot) {
  if (snapshot.currentMilestoneId) {
    const current = findMilestone(snapshot, snapshot.currentMilestoneId);
    if (current.status !== 'completed') {
      return current;
    }
  }

  return snapshot.milestones.find((milestone) => milestone.status !== 'completed') ?? null;
}

export function createPlannerIntent(snapshot, milestone = selectNextActionableMilestone(snapshot)) {
  return {
    schemaVersion: 1,
    kind: 'planner.intent',
    generatedAt: new Date().toISOString(),
    runId: snapshot.runId,
    runStatus: snapshot.status,
    repoPath: snapshot.repoPath,
    planPath: snapshot.planPath,
    worker: snapshot.workers.planner,
    targetWorker: snapshot.workers.implementer,
    selectedMilestone: milestone
      ? {
          id: milestone.id,
          title: milestone.title,
          status: milestone.status,
          lineNumber: milestone.lineNumber,
          details: clone(milestone.details ?? []),
          lastNote: milestone.lastNote ?? null,
        }
      : null,
    scope: {
      mode: milestone ? 'single-milestone' : 'none',
      milestoneCount: milestone ? 1 : 0,
    },
    constraints: [
      'Execute only the selected milestone.',
      'Do not widen scope beyond the selected milestone contract.',
      'Verify the milestone before declaring it complete.',
    ],
  };
}

export function createImplementerContract(snapshot, milestone = selectNextActionableMilestone(snapshot)) {
  const plannerIntent = createPlannerIntent(snapshot, milestone);

  return {
    schemaVersion: 1,
    kind: 'implementer.contract',
    generatedAt: new Date().toISOString(),
    runId: snapshot.runId,
    repoPath: snapshot.repoPath,
    planPath: snapshot.planPath,
    snapshotPath: snapshot.snapshotPath ?? null,
    eventLogPath: snapshot.eventLogPath ?? null,
    worker: snapshot.workers.implementer,
    plannerIntent,
    milestone: plannerIntent.selectedMilestone,
    instructions: milestone
      ? [
          `Implement milestone ${milestone.id}: ${milestone.title}`,
          'Stay within the milestone details listed in this contract.',
          'Update run state through milestone transitions as work progresses.',
          'Run verification before marking the milestone completed.',
        ]
      : ['No actionable milestone remains.'],
  };
}

export function writeContractDocument(outputPath, document) {
  const resolvedOutputPath = path.resolve(outputPath);
  mkdirSync(path.dirname(resolvedOutputPath), { recursive: true });
  writeFileSync(resolvedOutputPath, JSON.stringify(document, null, 2) + '\n', 'utf8');
  return resolvedOutputPath;
}
