import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { ReviewerOutput, RunSnapshot, SnapshotMilestone, VerificationStatus } from './types.js';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function findMilestone(snapshot: RunSnapshot, milestoneId: string): SnapshotMilestone {
  const milestone = snapshot.milestones.find((candidate) => candidate.id === milestoneId);

  if (!milestone) {
    throw new Error(`Unknown milestone: ${milestoneId}`);
  }

  return milestone;
}

export function createVerificationCommand(
  snapshot: RunSnapshot,
  options: { milestoneId?: string; command?: string; stage?: string } = {},
) {
  const milestone = findMilestone(snapshot, options.milestoneId ?? snapshot.currentMilestoneId!);

  return {
    schemaVersion: 1,
    kind: 'verification.command',
    generatedAt: new Date().toISOString(),
    runId: snapshot.runId,
    repoPath: snapshot.repoPath,
    planPath: snapshot.planPath,
    worker: snapshot.workers.verifier,
    milestone: {
      id: milestone.id,
      title: milestone.title,
      status: milestone.status,
      lineNumber: milestone.lineNumber,
      details: clone(milestone.details ?? []),
    },
    command: options.command ?? 'npm run build',
    stage: options.stage ?? 'post-implementation',
    instructions: [
      'Run the verification command exactly as written unless explicitly overridden.',
      'Record the verification result before milestone completion is declared.',
      'Do not mark the milestone completed unless verification status is passed.',
    ],
  };
}

export function createReviewerOutput(
  snapshot: RunSnapshot,
  options: { milestoneId?: string; verdict?: string; summary?: string; findings?: string[]; nextAction?: string } = {},
): ReviewerOutput {
  const milestone = findMilestone(snapshot, options.milestoneId ?? snapshot.currentMilestoneId!);

  return {
    schemaVersion: 1,
    kind: 'reviewer.output',
    generatedAt: new Date().toISOString(),
    runId: snapshot.runId,
    worker: snapshot.workers.verifier,
    milestone: {
      id: milestone.id,
      title: milestone.title,
      status: milestone.status,
    },
    verdict: options.verdict ?? 'needs-review',
    summary: options.summary ?? '',
    findings: clone(options.findings ?? []),
    nextAction: options.nextAction ?? 'address-findings',
  };
}

export function createVerificationResultRecord({
  milestoneId,
  command,
  status,
  outputPath,
  summary,
  reviewerOutput,
}: {
  milestoneId: string;
  command: string;
  status: VerificationStatus;
  outputPath?: string;
  summary?: string;
  reviewerOutput?: ReviewerOutput | null;
}) {
  return {
    milestoneId,
    command,
    status,
    outputPath: outputPath ?? null,
    summary: summary ?? null,
    reviewerOutput: reviewerOutput ?? null,
  };
}

export function writeVerificationDocument(outputPath: string, document: object): string {
  const resolvedOutputPath = path.resolve(outputPath);
  mkdirSync(path.dirname(resolvedOutputPath), { recursive: true });
  writeFileSync(resolvedOutputPath, JSON.stringify(document, null, 2) + '\n', 'utf8');
  return resolvedOutputPath;
}
