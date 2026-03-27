import { accessSync, constants, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

import type {
  BackendCheckResultDocument,
  BackendConfiguration,
  BackendHealthProbe,
  BackendKind,
  RunSnapshot,
  WorkerRole,
} from './types.js';

const DEFAULT_SUPPORTED_BACKENDS: Record<WorkerRole, BackendKind[]> = {
  planner: ['openclaw', 'codex-cli', 'claude-code'],
  implementer: ['openclaw', 'codex-cli', 'claude-code'],
  recovery: ['openclaw', 'codex-cli', 'claude-code'],
  verifier: ['openclaw', 'codex-cli', 'claude-code'],
  watchdog: ['openclaw', 'laizy-watchdog'],
};

const backendCheckCache = new Map<string, BackendCheckResultDocument>();

function defaultBackendKindForRole(role: WorkerRole): BackendKind {
  return role === 'watchdog' ? 'laizy-watchdog' : 'openclaw';
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createDefaultBackendConfiguration(): BackendConfiguration {
  return {
    planner: {
      role: 'planner',
      backend: defaultBackendKindForRole('planner'),
      supportedBackends: DEFAULT_SUPPORTED_BACKENDS.planner,
      preferredRuntime: 'subagent',
    },
    implementer: {
      role: 'implementer',
      backend: defaultBackendKindForRole('implementer'),
      supportedBackends: DEFAULT_SUPPORTED_BACKENDS.implementer,
      preferredRuntime: 'subagent',
    },
    recovery: {
      role: 'recovery',
      backend: defaultBackendKindForRole('recovery'),
      supportedBackends: DEFAULT_SUPPORTED_BACKENDS.recovery,
      preferredRuntime: 'subagent',
    },
    verifier: {
      role: 'verifier',
      backend: defaultBackendKindForRole('verifier'),
      supportedBackends: DEFAULT_SUPPORTED_BACKENDS.verifier,
      preferredRuntime: 'subagent',
    },
    watchdog: {
      role: 'watchdog',
      backend: defaultBackendKindForRole('watchdog'),
      supportedBackends: DEFAULT_SUPPORTED_BACKENDS.watchdog,
      preferredRuntime: 'subagent',
    },
  };
}

export function resolveBackendConfiguration(snapshot: RunSnapshot): BackendConfiguration {
  return snapshot.backends ?? createDefaultBackendConfiguration();
}

function createProbe(name: BackendHealthProbe['name'], status: BackendHealthProbe['status'], detail: string, command: string | null) {
  return {
    name,
    status,
    detail,
    command,
    checkedAt: new Date().toISOString(),
  } satisfies BackendHealthProbe;
}

function execProbe(
  name: BackendHealthProbe['name'],
  detail: string,
  command: string,
  args: string[] = [],
  options: { timeoutMs?: number; useShell?: boolean } = {},
): BackendHealthProbe {
  const timeoutMs = Number(options.timeoutMs ?? 5000);
  const timeoutSeconds = Math.max(1, Math.ceil(timeoutMs / 1000));
  const result = spawnSync('/usr/bin/timeout', [
    '--signal=TERM',
    '--kill-after=1s',
    `${timeoutSeconds}s`,
    command,
    ...args,
  ], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
    shell: options.useShell ?? false,
  });
  const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();

  if (result.error) {
    const errorCode = 'code' in result.error && typeof result.error.code === 'string'
      ? result.error.code
      : null;
    const timeoutDetail = errorCode === 'ETIMEDOUT'
      ? ` Timed out after ${timeoutMs}ms.`
      : '';
    const errorDetail = `${detail}${timeoutDetail} ${result.error.message}`.trim();
    return createProbe(name, 'failed', output ? `${errorDetail} Output: ${output}` : errorDetail, [command, ...args].join(' '));
  }

  if (result.signal) {
    const signalDetail = `${detail} Probe exited via signal ${result.signal}${result.status === null ? ` after ${timeoutMs}ms timeout or forced termination.` : '.'}`;
    return createProbe(name, 'failed', output ? `${signalDetail} Output: ${output}` : signalDetail, [command, ...args].join(' '));
  }

  if (result.status === 124) {
    const timeoutDetail = `${detail} Timed out after ${timeoutMs}ms.`;
    return createProbe(name, 'failed', output ? `${timeoutDetail} Output: ${output}` : timeoutDetail, [command, ...args].join(' '));
  }

  return createProbe(
    name,
    result.status === 0 ? 'passed' : 'failed',
    output ? `${detail} Output: ${output}` : detail,
    [command, ...args].join(' '),
  );
}

function readablePathProbe(name: BackendHealthProbe['name'], detail: string, targetPath: string | null, command: string | null): BackendHealthProbe {
  if (!targetPath) {
    return createProbe(name, 'failed', `${detail} Missing required path.`, command);
  }

  try {
    accessSync(targetPath, constants.R_OK);
    return createProbe(name, 'passed', `${detail} Path is readable: ${targetPath}`, command);
  } catch (error) {
    return createProbe(
      name,
      'failed',
      `${detail} ${error instanceof Error ? error.message : String(error)}`,
      command,
    );
  }
}

function createOpenClawProbes(snapshot: RunSnapshot): BackendHealthProbe[] {
  return [
    execProbe('installation', 'Verified the openclaw CLI is installed.', '/usr/bin/env', ['bash', '-lc', 'command -v openclaw'], { timeoutMs: 1000 }),
    execProbe('invocation', 'Verified the openclaw CLI responds to help output.', 'openclaw', ['help'], { timeoutMs: 1500 }),
    execProbe(
      'liveness',
      'Verified the OpenClaw gateway status command responds on this machine.',
      'openclaw',
      ['gateway', 'status'],
      { timeoutMs: 1000 },
    ),
  ];
}

function createCodexCliProbes(): BackendHealthProbe[] {
  return [
    execProbe('installation', 'Verified the codex CLI is installed.', '/usr/bin/env', ['bash', '-lc', 'command -v codex'], { timeoutMs: 1000 }),
    execProbe('invocation', 'Verified the codex CLI responds to general help output.', 'codex', ['--help'], { timeoutMs: 1500 }),
    execProbe('liveness', 'Verified the codex exec entrypoint is callable.', 'codex', ['exec', '--help'], { timeoutMs: 1000 }),
  ];
}

function createClaudeCodeProbes(): BackendHealthProbe[] {
  return [
    execProbe('installation', 'Verified the claude CLI is installed.', '/usr/bin/env', ['bash', '-lc', 'command -v claude'], { timeoutMs: 1000 }),
    execProbe('invocation', 'Verified the claude CLI responds to help output.', 'claude', ['--help'], { timeoutMs: 1500 }),
    execProbe('liveness', 'Verified the claude CLI can answer a lightweight version call.', 'claude', ['--version'], { timeoutMs: 1000 }),
  ];
}

function createLaizyWatchdogProbes(snapshot: RunSnapshot): BackendHealthProbe[] {
  return [
    execProbe('installation', 'Verified the laizy CLI is installed.', '/usr/bin/env', ['bash', '-lc', 'command -v laizy'], { timeoutMs: 1000 }),
    execProbe('invocation', 'Verified the laizy CLI responds to help output.', 'laizy', ['help'], { timeoutMs: 1500 }),
    readablePathProbe(
      'liveness',
      'Verified the watchdog can resolve the active run snapshot path.',
      snapshot.snapshotPath ?? null,
      snapshot.snapshotPath ? `test -r ${JSON.stringify(snapshot.snapshotPath)}` : null,
    ),
  ];
}

function createBackendProbes(snapshot: RunSnapshot, backend: BackendKind): BackendHealthProbe[] {
  if (backend === 'openclaw') {
    return createOpenClawProbes(snapshot);
  }

  if (backend === 'codex-cli') {
    return createCodexCliProbes();
  }

  if (backend === 'claude-code') {
    return createClaudeCodeProbes();
  }

  return createLaizyWatchdogProbes(snapshot);
}

export function createBackendCheckResult(
  snapshot: RunSnapshot,
  role: WorkerRole,
  options: { outputPath?: string } = {},
): BackendCheckResultDocument {
  const configuration = resolveBackendConfiguration(snapshot)[role];
  const cacheKey = JSON.stringify({
    runId: snapshot.runId,
    role,
    backend: configuration.backend,
    snapshotPath: snapshot.snapshotPath ?? null,
    updatedAt: snapshot.updatedAt,
  });
  const cached = backendCheckCache.get(cacheKey);

  if (cached) {
    const cachedDocument = clone(cached);
    cachedDocument.outputPath = options.outputPath ?? null;
    return cachedDocument;
  }

  const probes = createBackendProbes(snapshot, configuration.backend);
  const overallStatus = probes.every((probe) => probe.status === 'passed' || probe.status === 'not-applicable')
    ? 'healthy'
    : probes.some((probe) => probe.status === 'failed')
      ? 'unhealthy'
      : 'unknown';

  const document = {
    schemaVersion: 1,
    kind: 'backend.check-result',
    generatedAt: new Date().toISOString(),
    runId: snapshot.runId,
    repoPath: snapshot.repoPath,
    planPath: snapshot.planPath,
    snapshotPath: snapshot.snapshotPath ?? null,
    eventLogPath: snapshot.eventLogPath ?? null,
    worker: {
      role,
      label: snapshot.workers[role],
    },
    backend: configuration,
    overallStatus,
    probes,
    outputPath: options.outputPath ?? null,
  } satisfies BackendCheckResultDocument;

  backendCheckCache.set(cacheKey, clone({ ...document, outputPath: null }));
  return document;
}

export function writeBackendCheckResult(outputPath: string, document: BackendCheckResultDocument): string {
  const resolvedOutputPath = path.resolve(outputPath);
  mkdirSync(path.dirname(resolvedOutputPath), { recursive: true });
  writeFileSync(resolvedOutputPath, JSON.stringify(document, null, 2) + '\n', 'utf8');
  return resolvedOutputPath;
}
