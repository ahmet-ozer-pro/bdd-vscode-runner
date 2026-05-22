export type ExecutionStatus = 'idle' | 'running' | 'passed' | 'failed' | 'cancelled';

export interface ExecutionContext {
  workspaceRoot: string;
  executionRoot: string;
  pomPath?: string;
  featurePath: string;
  featureAbsolutePath?: string;
  scenarioName: string;
  scenarioLineOneBased: number;
  displayCommand: string;
  startedAt?: number;
}

export interface ExecutionRecord extends ExecutionContext {
  startedAt: number;
  durationMs?: number;
  exitCode?: number;
  status: ExecutionStatus;
}

export class ExecutionHistory {
  private latestRecord?: ExecutionRecord;

  start(context: ExecutionContext, startedAt: number): ExecutionRecord {
    const record: ExecutionRecord = {
      ...context,
      startedAt,
      status: 'running',
    };
    this.latestRecord = record;
    return record;
  }

  finish(status: ExecutionStatus, exitCode: number | undefined, durationMs: number): ExecutionRecord | undefined {
    if (!this.latestRecord) {
      return undefined;
    }

    this.latestRecord = {
      ...this.latestRecord,
      status,
      exitCode,
      durationMs,
    };

    return this.latestRecord;
  }

  getLatest(): ExecutionRecord | undefined {
    return this.latestRecord;
  }
}

export function getStatusBarText(record: ExecutionRecord | undefined): string {
  if (!record) {
    return 'BDD Runner: Idle';
  }

  switch (record.status) {
    case 'running':
      return `BDD Runner: Running ${record.scenarioName}`;
    case 'passed':
      return `BDD Runner: Passed ${record.scenarioName}`;
    case 'failed':
      return `BDD Runner: Failed ${record.scenarioName}`;
    case 'cancelled':
      return `BDD Runner: Cancelled ${record.scenarioName}`;
    default:
      return 'BDD Runner: Idle';
  }
}

export function formatExecutionSummary(record: ExecutionRecord): string[] {
  const lines = [
    'Execution Summary',
    `Status    : ${record.status}`,
    `Scenario  : ${record.scenarioName}`,
    `Line      : ${record.scenarioLineOneBased}`,
    `Feature   : ${record.featurePath}`,
    `Execution : ${record.executionRoot}`,
    `POM       : ${record.pomPath ?? 'N/A'}`,
    `Command   : ${record.displayCommand}`,
  ];

  if (record.exitCode !== undefined) {
    lines.push(`Exit Code : ${record.exitCode}`);
  }

  if (record.durationMs !== undefined) {
    lines.push(`Duration  : ${(record.durationMs / 1000).toFixed(2)}s`);
  }

  return lines;
}
