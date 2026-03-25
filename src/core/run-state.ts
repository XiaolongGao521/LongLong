import type { MilestonePlanEntry, RunSnapshot, WorkerRole } from './types.js';

export function createRunState({
  runId,
  goal,
  repoPath,
  planPath,
  milestones,
  workerLabels = {},
}: {
  runId: string;
  goal: string;
  repoPath: string;
  planPath: string;
  milestones: MilestonePlanEntry[];
  workerLabels?: Partial<Record<WorkerRole, RunSnapshot['workers'][WorkerRole]>>;
}): RunSnapshot {
  const now = new Date().toISOString();
  const current = milestones.find((milestone) => !milestone.completed) ?? null;

  return {
    schemaVersion: 1,
    runId,
    goal,
    repoPath,
    planPath,
    status: current ? 'planned' : 'completed',
    createdAt: now,
    updatedAt: now,
    currentMilestoneId: current?.id ?? null,
    workers: {
      planner: workerLabels.planner ?? 'laizy-planner',
      implementer: workerLabels.implementer ?? 'laizy-implementer',
      watchdog: workerLabels.watchdog ?? 'laizy-watchdog',
      recovery: workerLabels.recovery ?? 'laizy-recovery',
      verifier: workerLabels.verifier ?? 'laizy-verifier',
    },
    workerHeartbeats: {
      'laizy-planner': null,
      'laizy-implementer': null,
      'laizy-watchdog': null,
      'laizy-recovery': null,
      'laizy-verifier': null,
      ...(workerLabels.planner && workerLabels.planner !== 'laizy-planner' ? { [workerLabels.planner]: null } : {}),
      ...(workerLabels.implementer && workerLabels.implementer !== 'laizy-implementer' ? { [workerLabels.implementer]: null } : {}),
      ...(workerLabels.watchdog && workerLabels.watchdog !== 'laizy-watchdog' ? { [workerLabels.watchdog]: null } : {}),
      ...(workerLabels.recovery && workerLabels.recovery !== 'laizy-recovery' ? { [workerLabels.recovery]: null } : {}),
      ...(workerLabels.verifier && workerLabels.verifier !== 'laizy-verifier' ? { [workerLabels.verifier]: null } : {}),
    } as RunSnapshot['workerHeartbeats'],
    milestones: milestones.map((milestone) => ({
      id: milestone.id,
      title: milestone.title,
      status: milestone.completed ? 'completed' : 'planned',
      lineNumber: milestone.lineNumber,
      details: [...(milestone.details ?? [])],
      updatedAt: now,
      lastNote: null,
    })),
    recovery: [],
    verification: [],
  };
}
