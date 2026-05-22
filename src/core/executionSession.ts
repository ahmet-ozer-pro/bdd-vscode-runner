import { FailureNavigationTarget } from './failureNavigation';
import { ExecutionContext, ExecutionStatus } from './observability';
import { LiveStepStatus, StructuredExecutionScenarioResult } from './resultIngestion';
import { ScenarioExampleRowMetadata, ScenarioMetadata, ScenarioStepMetadata } from './scenarioDiscovery';

export type ExecutionStepStatus = 'pending' | 'passed' | 'failed' | 'skipped';

export interface ExecutionSessionStep {
  keyword: ScenarioStepMetadata['keyword'];
  text: string;
  rawText: string;
  line: number;
  status: ExecutionStepStatus;
  durationMs?: number;
}

export interface ExecutionSessionHook {
  kind: 'before' | 'after';
  text: string;
  status: ExecutionStepStatus;
  durationMs?: number;
}

export interface ExecutionSessionExampleRow {
  line: number;
  values: string[];
  status: ExecutionStepStatus;
}

/**
 * Normalized execution session shown across runner UI surfaces.
 */
export interface ExecutionSession {
  runId: string;
  startedAt: number;
  featureName?: string;
  workspaceRoot: string;
  executionRoot: string;
  pomPath?: string;
  displayCommand: string;
  featurePath: string;
  featureAbsolutePath?: string;
  outputText: string;
  scenarioName: string;
  scenarioLineOneBased: number;
  keyword: ScenarioMetadata['keyword'];
  status: ExecutionStatus;
  exitCode?: number;
  durationMs?: number;
  examples: ExecutionSessionExampleRow[];
  beforeHooks: ExecutionSessionHook[];
  steps: ExecutionSessionStep[];
  afterHooks: ExecutionSessionHook[];
  failureTargets: FailureNavigationTarget[];
  structuredResultSource?: StructuredExecutionScenarioResult['source'];
}

export class ExecutionSessionStore {
  private readonly sessions: ExecutionSession[] = [];
  private latestSession?: ExecutionSession;
  private readonly listeners = new Set<(session: ExecutionSession | undefined) => void>();

  setLatest(session: ExecutionSession): ExecutionSession {
    const existingIndex = this.sessions.findIndex((candidate) => candidate.runId === session.runId);
    if (existingIndex >= 0) {
      this.sessions.splice(existingIndex, 1);
    }
    this.sessions.unshift(session);
    if (this.sessions.length > 10) {
      this.sessions.length = 10;
    }
    this.latestSession = session;
    this.emit();
    return session;
  }

  getLatest(): ExecutionSession | undefined {
    return this.latestSession;
  }

  getSessions(): ExecutionSession[] {
    return [...this.sessions];
  }

  getStatusForLocation(featureAbsolutePath: string, lineOneBased: number): ExecutionStatus | undefined {
    return this.sessions.find((session) =>
      session.scenarioLineOneBased === lineOneBased &&
      session.featureAbsolutePath === featureAbsolutePath
    )?.status;
  }

  clear(): void {
    this.sessions.length = 0;
    this.latestSession = undefined;
    this.emit();
  }

  subscribe(listener: (session: ExecutionSession | undefined) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.latestSession);
    }
  }
}

/**
 * Builds a normalized execution session from run context and discovered scenario metadata.
 * @param context Execution context captured when the run started.
 * @param scenario Discovered scenario metadata.
 * @param status Current or final execution status.
 * @param failureTargets Failure targets inferred for this run.
 * @param analysisText Output text used for status and failure projection.
 * @param structuredResult Optional structured Cucumber or Surefire result.
 * @param exitCode Optional process exit code.
 * @param durationMs Optional execution duration in milliseconds.
 * @returns Normalized execution session.
 */
export function buildExecutionSession(
  context: ExecutionContext,
  scenario: ScenarioMetadata,
  status: ExecutionStatus,
  failureTargets: FailureNavigationTarget[],
  analysisText: string,
  structuredResult?: StructuredExecutionScenarioResult,
  exitCode?: number,
  durationMs?: number,
  liveStepStatuses?: Map<string, LiveStepStatus>
): ExecutionSession {
  const failedStepLine = findFailedStepLine(scenario, failureTargets, analysisText);
  const steps = projectStepStatuses(
    scenario.steps,
    status,
    analysisText,
    failedStepLine,
    structuredResult,
    liveStepStatuses
  );
  const examples = projectExampleStatuses(scenario.examples, status, steps);
  const { beforeHooks, afterHooks } = projectHookStatuses(structuredResult);

  return {
    runId: String(context.startedAt ?? Date.now()),
    startedAt: context.startedAt ?? Date.now(),
    featureName: scenario.featureName,
    workspaceRoot: context.workspaceRoot,
    executionRoot: context.executionRoot,
    pomPath: context.pomPath,
    displayCommand: context.displayCommand,
    featurePath: context.featurePath,
    featureAbsolutePath: context.featureAbsolutePath,
    outputText: analysisText,
    scenarioName: scenario.name,
    scenarioLineOneBased: context.scenarioLineOneBased,
    keyword: scenario.keyword,
    status,
    exitCode,
    durationMs,
    examples,
    beforeHooks,
    steps,
    afterHooks,
    failureTargets,
    structuredResultSource: structuredResult?.source,
  };
}

export function buildTagExecutionSession(
  context: ExecutionContext,
  tagFilter: string,
  status: ExecutionStatus,
  failureTargets: FailureNavigationTarget[],
  outputText: string,
  exitCode?: number,
  durationMs?: number
): ExecutionSession {
  return {
    runId: String(context.startedAt ?? Date.now()),
    startedAt: context.startedAt ?? Date.now(),
    workspaceRoot: context.workspaceRoot,
    executionRoot: context.executionRoot,
    pomPath: context.pomPath,
    displayCommand: context.displayCommand,
    featurePath: '',
    featureAbsolutePath: undefined,
    outputText,
    scenarioName: `Tag: ${tagFilter}`,
    scenarioLineOneBased: 1,
    keyword: 'Scenario',
    status,
    exitCode,
    durationMs,
    examples: [],
    beforeHooks: [],
    steps: [],
    afterHooks: [],
    failureTargets,
    structuredResultSource: undefined,
  };
}

export function buildFolderExecutionSession(
  context: ExecutionContext,
  folderLabel: string,
  status: ExecutionStatus,
  failureTargets: FailureNavigationTarget[],
  outputText: string,
  exitCode?: number,
  durationMs?: number
): ExecutionSession {
  return {
    runId: String(context.startedAt ?? Date.now()),
    startedAt: context.startedAt ?? Date.now(),
    workspaceRoot: context.workspaceRoot,
    executionRoot: context.executionRoot,
    pomPath: context.pomPath,
    displayCommand: context.displayCommand,
    featurePath: context.featurePath,
    featureAbsolutePath: undefined,
    outputText,
    scenarioName: `Folder: ${folderLabel}`,
    scenarioLineOneBased: 1,
    keyword: 'Scenario',
    status,
    exitCode,
    durationMs,
    examples: [],
    beforeHooks: [],
    steps: [],
    afterHooks: [],
    failureTargets,
    structuredResultSource: undefined,
  };
}

/**
 * Formats an execution session as human-readable summary lines.
 * @param session Execution session to summarize.
 * @returns Summary lines for output or diagnostics.
 */
export function formatExecutionSessionSummary(session: ExecutionSession): string[] {
  const lines = [
    'Execution Session',
    `${session.keyword.padEnd(16)}: ${session.scenarioName}`,
    `Status           : ${session.status}`,
  ];

  if (session.structuredResultSource) {
    lines.push(`Structured Source: ${session.structuredResultSource}`);
  }

  if (session.examples.length > 0) {
    lines.push('Examples:');
    for (const example of session.examples) {
      lines.push(`- [${example.status}] ${example.values.join(' | ')}`);
    }
  }

  if (session.beforeHooks.length > 0) {
    lines.push('Before Hooks:');
    for (const hook of session.beforeHooks) {
      const durationSuffix = hook.durationMs !== undefined ? ` (${(hook.durationMs / 1000).toFixed(2)}s)` : '';
      lines.push(`- [${hook.status}] ${hook.text}${durationSuffix}`);
    }
  }

  if (session.steps.length === 0) {
    lines.push('Steps            : No discovered steps');
    return lines;
  }

  lines.push('Steps:');
  for (const step of session.steps) {
    const durationSuffix = step.durationMs !== undefined
      ? ` (${(step.durationMs / 1000).toFixed(2)}s)`
      : '';
    lines.push(`- [${step.status}] ${step.rawText}${durationSuffix}`);
  }

  if (session.afterHooks.length > 0) {
    lines.push('After Hooks:');
    for (const hook of session.afterHooks) {
      const durationSuffix = hook.durationMs !== undefined ? ` (${(hook.durationMs / 1000).toFixed(2)}s)` : '';
      lines.push(`- [${hook.status}] ${hook.text}${durationSuffix}`);
    }
  }

  return lines;
}

function findFailedStepLine(
  scenario: ScenarioMetadata,
  failureTargets: FailureNavigationTarget[],
  analysisText: string
): number | undefined {
  const stepTarget = failureTargets.find((target) => target.source === 'step');
  if (stepTarget) {
    const matchedStep = scenario.steps.find((step) => step.line === stepTarget.lineZeroBased);
    if (matchedStep) {
      return matchedStep.line;
    }
  }

  const outputStepLine = findFailedStepLineFromOutput(analysisText);
  if (outputStepLine !== undefined) {
    const zeroBasedLine = outputStepLine - 1;
    const matchedStep = scenario.steps.find((step) => step.line === zeroBasedLine);
    if (matchedStep) {
      return matchedStep.line;
    }
  }

  const outputFeatureTarget = failureTargets.find((target) =>
    target.filePath.endsWith('.feature') &&
    scenario.steps.some((step) => step.line === target.lineZeroBased)
  );
  return outputFeatureTarget?.lineZeroBased;
}

function findFailedStepLineFromOutput(analysisText: string): number | undefined {
  const uriMatch = analysisText.match(/\*\.([^(]+)\(file:\/\/\/[^):]+:(\d+)\)/);
  if (uriMatch) {
    return Number(uriMatch[2]);
  }

  const lines = analysisText.split(/\r?\n/);
  let lastStepLineText: string | undefined;

  for (const rawLine of lines) {
    const trimmedLine = rawLine.trim();
    if (/^(Given|When|Then|And|But|\*)\b/.test(trimmedLine)) {
      lastStepLineText = trimmedLine;
      continue;
    }

    if (lastStepLineText && /(AssertionFailedError|Step failed|expected:|but was:)/i.test(trimmedLine)) {
      const stepLineMatch = lastStepLineText.match(/:(\d+)$/);
      if (stepLineMatch) {
        return Number(stepLineMatch[1]);
      }
    }
  }

  return undefined;
}

function projectStepStatuses(
  steps: ScenarioStepMetadata[],
  status: ExecutionStatus,
  analysisText: string,
  failedStepLine?: number,
  structuredResult?: StructuredExecutionScenarioResult,
  liveStepStatuses?: Map<string, LiveStepStatus>
): ExecutionSessionStep[] {
  if (steps.length === 0) {
    return [];
  }

  const structuredProjection = projectStructuredSteps(steps, structuredResult);
  if (structuredProjection) {
    return structuredProjection;
  }

  if (status === 'running') {
    if (liveStepStatuses && liveStepStatuses.size > 0) {
      return projectLiveNdjsonSteps(steps, liveStepStatuses);
    }
    return projectRunningSteps(steps, analysisText);
  }

  if (status === 'passed') {
    return steps.map((step) => ({
      ...step,
      status: 'passed',
    }));
  }

  if (status === 'failed' && failedStepLine !== undefined) {
    let failureReached = false;

    return steps.map((step) => {
      if (step.line === failedStepLine) {
        failureReached = true;
        return {
          ...step,
          status: 'failed',
        };
      }

      if (!failureReached) {
        return {
          ...step,
          status: 'passed',
        };
      }

      return {
        ...step,
        status: 'skipped',
      };
    });
  }

  return steps.map((step) => ({
    ...step,
    status: 'pending',
  }));
}

function projectLiveNdjsonSteps(
  steps: ScenarioStepMetadata[],
  liveStatuses: Map<string, LiveStepStatus>
): ExecutionSessionStep[] {
  let failureReached = false;

  return steps.map((step) => {
    if (failureReached) {
      return { ...step, status: 'skipped' as const };
    }

    const live = liveStatuses.get(step.text.toLowerCase());
    if (!live) {
      return { ...step, status: 'pending' as const };
    }

    if (live.status === 'failed') {
      failureReached = true;
    }

    return {
      ...step,
      status: live.status,
      durationMs: live.durationMs,
    };
  });
}

function projectRunningSteps(
  steps: ScenarioStepMetadata[],
  analysisText: string
): ExecutionSessionStep[] {
  const lines = analysisText.split(/\r?\n/);
  const matchedLineIndexes: Array<number | undefined> = [];
  let cursor = 0;

  for (const step of steps) {
    let matchedIndex: number | undefined;
    for (let lineIndex = cursor; lineIndex < lines.length; lineIndex += 1) {
      if (matchesRunningStepLine(lines[lineIndex], step)) {
        matchedIndex = lineIndex;
        cursor = lineIndex + 1;
        break;
      }
    }
    matchedLineIndexes.push(matchedIndex);
  }

  const lastMatchedStepIndex = findLastMatchedStepIndex(matchedLineIndexes);
  if (lastMatchedStepIndex === undefined) {
    return steps.map((step) => ({
      ...step,
      status: 'pending',
    }));
  }

  const lastMatchedLineIndex = matchedLineIndexes[lastMatchedStepIndex]!;
  const trailingOutput = lines.slice(lastMatchedLineIndex).join('\n');
  const failedCurrentStep = /(AssertionFailedError|Step failed|TEST FAILURE|Scenario '.+' failed|\bStatus:\s*FAILED\b)/i
    .test(trailingOutput);

  return steps.map((step, index) => {
    if (index < lastMatchedStepIndex) {
      return {
        ...step,
        status: 'passed' as const,
      };
    }

    if (index === lastMatchedStepIndex) {
      return {
        ...step,
        status: failedCurrentStep ? 'failed' : 'pending',
      };
    }

    return {
      ...step,
      status: 'pending' as const,
    };
  });
}

function findLastMatchedStepIndex(matchedLineIndexes: Array<number | undefined>): number | undefined {
  for (let index = matchedLineIndexes.length - 1; index >= 0; index -= 1) {
    if (matchedLineIndexes[index] !== undefined) {
      return index;
    }
  }

  return undefined;
}

function matchesRunningStepLine(line: string, step: ScenarioStepMetadata): boolean {
  const normalizedLine = line.trim().replace(/\s+#.*$/, '');
  if (!normalizedLine) {
    return false;
  }

  const exactCandidates = [
    step.rawText,
    `${step.keyword} ${step.text}`,
  ].map((candidate) => normalizeStepText(candidate));

  const normalizedCurrentLine = normalizeStepText(normalizedLine);
  if (exactCandidates.includes(normalizedCurrentLine)) {
    return true;
  }

  const stepPattern = buildPlaceholderAwareStepPattern(step.rawText);
  return stepPattern.test(normalizedLine);
}

function buildPlaceholderAwareStepPattern(rawStepText: string): RegExp {
  const placeholderToken = '__BDD_PLACEHOLDER__';
  const placeholderMarked = rawStepText.replace(/<[^>]+>/g, placeholderToken);
  const escaped = escapeRegex(placeholderMarked);
  const placeholderAware = escaped.replace(new RegExp(placeholderToken, 'g'), '.+?');
  return new RegExp(`^${placeholderAware}$`, 'i');
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function projectStructuredSteps(
  steps: ScenarioStepMetadata[],
  structuredResult?: StructuredExecutionScenarioResult
): ExecutionSessionStep[] | undefined {
  if (!structuredResult || structuredResult.steps.length === 0) {
    return undefined;
  }

  const projected = steps.map((step) => {
    const result = findStructuredStepResult(step, structuredResult);
    if (!result) {
      return {
        ...step,
        status: 'pending' as const,
      };
    }

    return {
      ...step,
      status: result.status,
      durationMs: result.durationMs,
    };
  });

  const hasResolvedStatus = projected.some((step) => step.status !== 'pending');
  return hasResolvedStatus ? projected : undefined;
}

function findStructuredStepResult(
  step: ScenarioStepMetadata,
  structuredResult: StructuredExecutionScenarioResult
): StructuredExecutionScenarioResult['steps'][number] | undefined {
  return structuredResult.steps.find((candidate) => {
    if (candidate.lineZeroBased !== undefined) {
      return candidate.lineZeroBased === step.line;
    }

    return normalizeStepText(candidate.text) === normalizeStepText(step.text);
  });
}

function normalizeStepText(text: string): string {
  return text.trim().toLowerCase();
}

function projectHookStatuses(
  structuredResult?: StructuredExecutionScenarioResult
): { beforeHooks: ExecutionSessionHook[]; afterHooks: ExecutionSessionHook[] } {
  if (!structuredResult) {
    return { beforeHooks: [], afterHooks: [] };
  }

  const beforeHooks = structuredResult.steps
    .filter((step) => step.kind === 'before')
    .map((step) => ({
      kind: 'before' as const,
      text: step.rawText,
      status: step.status,
      durationMs: step.durationMs,
    }));
  const afterHooks = structuredResult.steps
    .filter((step) => step.kind === 'after')
    .map((step) => ({
      kind: 'after' as const,
      text: step.rawText,
      status: step.status,
      durationMs: step.durationMs,
    }));

  return { beforeHooks, afterHooks };
}

function projectExampleStatuses(
  examples: ScenarioExampleRowMetadata[],
  status: ExecutionStatus,
  steps: ExecutionSessionStep[]
): ExecutionSessionExampleRow[] {
  if (examples.length === 0) {
    return [];
  }

  let exampleStatus: ExecutionStepStatus = 'pending';
  if (status === 'passed') {
    exampleStatus = 'passed';
  } else if (status === 'failed') {
    exampleStatus = steps.some((step) => step.status === 'failed') ? 'failed' : 'pending';
  } else if (status === 'cancelled') {
    exampleStatus = 'skipped';
  }

  return examples.map((example) => ({
    line: example.line,
    values: example.values,
    status: exampleStatus,
  }));
}
