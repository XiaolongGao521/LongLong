import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { MilestonePlanEntry } from './types.js';

const MILESTONE_PATTERN = /^### \[( |x)\] ([^—-]+?)\s*[—-]\s*(.+)$/;

export function parseImplementationPlan(planText: string): MilestonePlanEntry[] {
  const milestones: MilestonePlanEntry[] = [];
  const lines = planText.split(/\r?\n/);
  let currentMilestone: MilestonePlanEntry | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const line = rawLine.trim();
    const match = line.match(MILESTONE_PATTERN);

    if (match) {
      const [, state, id, title] = match;
      currentMilestone = {
        id: id.trim(),
        title: title.trim(),
        completed: state === 'x',
        lineNumber: index + 1,
        details: [],
      };
      milestones.push(currentMilestone);
      continue;
    }

    if (!currentMilestone) {
      continue;
    }

    if (line.startsWith('### ')) {
      currentMilestone = null;
      continue;
    }

    if (!line || line.startsWith('Verification checkpoint:')) {
      continue;
    }

    if (line.startsWith('- ')) {
      currentMilestone.details.push(line.slice(2).trim());
    }
  }

  return milestones;
}

export function loadImplementationPlan(planPath: string) {
  const absolutePlanPath = path.resolve(planPath);
  const planText = readFileSync(absolutePlanPath, 'utf8');
  const milestones = parseImplementationPlan(planText);

  return {
    path: absolutePlanPath,
    milestones,
    raw: planText,
  };
}

export function getNextIncompleteMilestone(milestones: MilestonePlanEntry[]): MilestonePlanEntry | null {
  return milestones.find((milestone) => !milestone.completed) ?? null;
}

export function summarizePlan(milestones: MilestonePlanEntry[]) {
  const completed = milestones.filter((milestone) => milestone.completed).length;
  const pending = milestones.length - completed;

  return {
    total: milestones.length,
    completed,
    pending,
    next: getNextIncompleteMilestone(milestones),
  };
}
