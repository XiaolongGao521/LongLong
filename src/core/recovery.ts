import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { createImplementerContract } from './contracts.js';
import { evaluateRunHealth } from './health.js';

import type { HealthReport, RecoveryPlan, RunSnapshot, WorkerLabel } from './types.js';

function getMilestone(snapshot: RunSnapshot, milestoneId: string | null) {
  if (!milestoneId) {
    return null;
  }

  return snapshot.milestones.find((candidate) => candidate.id === milestoneId) ?? null;
}

function createRecoveryPath(plan: {
  recommendation: HealthReport['recoveryRecommendation'];
  activeMilestone: RunSnapshot['milestones'][number] | null;
  shouldResume: boolean;
}): RecoveryPlan['recoveryPath'] {
  const { recommendation, activeMilestone, shouldResume } = plan;
  const targetMilestone = activeMilestone
    ? {
        id: activeMilestone.id,
        title: activeMilestone.title,
        status: activeMilestone.status,
      }
    : null;

  if (recommendation.action === 'escalate-blocked') {
    return {
      mode: 'blocked-escalation',
      summary: targetMilestone
        ? `Escalate blocked milestone ${targetMilestone.id} only.`
        : 'Escalate the blocked run state without widening scope.',
      scope: recommendation.scope,
      targetMilestone,
      steps: targetMilestone
        ? [
            `Why this was chosen: ${recommendation.reason}`,
            `Scope boundary: ${recommendation.scope.note}`,
            `Inspect blocked milestone ${targetMilestone.id} (${targetMilestone.title}) only.`,
            'Preserve the blocked reason and request bounded repair or escalation for that same milestone.',
            'Do not restart the implementer or advance to later milestones until the blocked state is resolved.',
          ]
        : [
            `Why this was chosen: ${recommendation.reason}`,
            `Scope boundary: ${recommendation.scope.note}`,
            'Inspect the blocked run state.',
            'Request bounded repair or escalation without inventing a new milestone target.',
          ],
    };
  }

  if (shouldResume && targetMilestone) {
    return {
      mode: 'resume-active-milestone',
      summary: `Resume active milestone ${targetMilestone.id} without widening scope.`,
      scope: recommendation.scope,
      targetMilestone,
      steps: [
        `Why this was chosen: ${recommendation.reason}`,
        `Scope boundary: ${recommendation.scope.note}`,
        `Resume milestone ${targetMilestone.id} (${targetMilestone.title}) only.`,
        'Reuse the active milestone as the recovery boundary instead of selecting a later milestone.',
        'Continue from the current repo state and verify before completion.',
      ],
    };
  }

  return {
    mode: 'none',
    summary: 'No recovery path needs to run.',
    scope: recommendation.scope,
    targetMilestone,
    steps: [
      `Why this was chosen: ${recommendation.reason}`,
      `Scope boundary: ${recommendation.scope.note}`,
      'No recovery action is required for the current run state.',
    ],
  };
}

export function createRecoveryPlan(snapshot: RunSnapshot, healthReport: HealthReport = evaluateRunHealth(snapshot)): RecoveryPlan {
  const recommendation = healthReport.recoveryRecommendation;
  const activeMilestone = getMilestone(snapshot, recommendation.milestoneId ?? snapshot.currentMilestoneId);
  const shouldResume = (recommendation.action === 'restart-implementer' || recommendation.action === 'rehand-off')
    && Boolean(activeMilestone)
    && activeMilestone?.status !== 'completed';
  const recoveryPath = createRecoveryPath({
    recommendation,
    activeMilestone,
    shouldResume,
  });

  return {
    schemaVersion: 1,
    kind: 'recovery.plan',
    generatedAt: new Date().toISOString(),
    runId: snapshot.runId,
    basedOnHealthReport: {
      checkedAt: healthReport.checkedAt,
      overallStatus: healthReport.overallStatus,
      action: recommendation.action,
      summary: recommendation.summary,
      reason: recommendation.reason,
    },
    action: recommendation.action,
    worker: recommendation.worker,
    milestoneId: recommendation.milestoneId,
    reason: recommendation.reason,
    severity: recommendation.severity,
    activeMilestone: activeMilestone
      ? {
          id: activeMilestone.id,
          title: activeMilestone.title,
          status: activeMilestone.status,
        }
      : null,
    scope: recommendation.scope,
    recommendationBasis: {
      trigger: recommendation.trigger,
      summary: recommendation.summary,
      evidence: recommendation.evidence,
    },
    recoveryPath,
    resumeContract: shouldResume && activeMilestone
      ? createImplementerContract(snapshot, activeMilestone)
      : null,
    escalation: recommendation.action === 'escalate-blocked'
      ? {
          targetWorker: snapshot.workers.recovery,
          targetMilestoneId: recommendation.milestoneId,
          mode: 'blocked-escalation',
        }
      : null,
  };
}

export function createRecoveryActionRecord({
  action,
  reason,
  worker,
  milestoneId,
  note,
  source,
}: {
  action: string;
  reason: string;
  worker: WorkerLabel;
  milestoneId?: string | null;
  note?: string;
  source?: string;
}) {
  return {
    action,
    reason,
    worker,
    milestoneId: milestoneId ?? null,
    note: note ?? null,
    source: source ?? 'manual',
  };
}

export function writeRecoveryPlan(outputPath: string, document: RecoveryPlan): string {
  const resolvedOutputPath = path.resolve(outputPath);
  mkdirSync(path.dirname(resolvedOutputPath), { recursive: true });
  writeFileSync(resolvedOutputPath, JSON.stringify(document, null, 2) + '\n', 'utf8');
  return resolvedOutputPath;
}
