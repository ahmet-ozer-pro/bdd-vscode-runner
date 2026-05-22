import * as fs from 'node:fs';
import * as path from 'node:path';
import { FailureNavigationTarget } from './failureNavigation';
import { ScenarioMetadata } from './scenarioDiscovery';

export interface StructuredExecutionStepResult {
  keyword?: string;
  text: string;
  rawText: string;
  status: 'passed' | 'failed' | 'skipped' | 'pending';
  durationMs?: number;
  lineZeroBased?: number;
  kind?: 'step' | 'before' | 'after';
}

export interface StructuredExecutionScenarioResult {
  source: 'cucumber-json' | 'cucumber-ndjson' | 'surefire-text';
  scenarioName: string;
  steps: StructuredExecutionStepResult[];
}

export interface LiveStepStatus {
  stepText: string;
  status: 'passed' | 'failed' | 'skipped' | 'pending';
  durationMs?: number;
}

/**
 * Collects structured execution results for a scenario from known report artifacts.
 * @param executionRoot Resolved Maven execution root.
 * @param featureAbsolutePath Absolute feature file path for matching artifacts.
 * @param scenario Discovered scenario metadata to match.
 * @returns Structured scenario result when an artifact can be matched.
 */
export function collectStructuredExecutionResult(
  executionRoot: string,
  featureAbsolutePath: string,
  scenario: ScenarioMetadata
): StructuredExecutionScenarioResult | undefined {
  const artifacts = discoverStructuredResultArtifacts(executionRoot);

  for (const artifactPath of artifacts.cucumberJsonPaths) {
    const result = parseCucumberJsonArtifact(artifactPath, featureAbsolutePath, scenario);
    if (result) {
      return result;
    }
  }

  for (const artifactPath of artifacts.cucumberNdjsonPaths) {
    const result = parseCucumberNdjsonArtifact(artifactPath, featureAbsolutePath, scenario);
    if (result) {
      return result;
    }
  }

  for (const artifactPath of artifacts.surefireTextPaths) {
    const result = parseSurefireTextArtifact(artifactPath, scenario);
    if (result) {
      return result;
    }
  }

  return undefined;
}

/**
 * Builds failure navigation targets from structured step results.
 * @param structuredResult Structured scenario result to inspect.
 * @param featureAbsolutePath Absolute feature file path for step targets.
 * @returns Failure navigation targets for failed steps.
 */
export function buildStructuredFailureTargets(
  structuredResult: StructuredExecutionScenarioResult | undefined,
  featureAbsolutePath: string
): FailureNavigationTarget[] {
  if (!structuredResult) {
    return [];
  }

  return structuredResult.steps
    .filter((step) => step.status === 'failed' && step.lineZeroBased !== undefined)
    .map((step) => ({
      filePath: featureAbsolutePath,
      lineZeroBased: step.lineZeroBased!,
      label: `${step.rawText} -> ${path.basename(featureAbsolutePath)}:${step.lineZeroBased! + 1}`,
      source: 'step' as const,
    }));
}

/**
 * Parses streamed NDJSON output for live step statuses.
 * Processes only testStepFinished envelopes; ignores unknown lines silently.
 * @param ndjsonText Accumulated stdout text so far.
 * @param scenario Discovered scenario metadata for step text matching.
 * @returns Live step statuses indexed by step text (normalized lowercase).
 */
export function parseLiveNdjsonStepStatuses(
  ndjsonText: string,
  scenario: ScenarioMetadata
): Map<string, LiveStepStatus> {
  const results = new Map<string, LiveStepStatus>();
  const lines = ndjsonText.split(/\r?\n/);
  const stepTextLookup = new Map(
    scenario.steps.map((step) => [step.text.toLowerCase(), step])
  );

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    let record: unknown;
    try {
      record = JSON.parse(line);
    } catch {
      continue;
    }

    if (!record || typeof record !== 'object') {
      continue;
    }

    const envelope = record as Record<string, unknown>;
    const testStepFinished = envelope.testStepFinished && typeof envelope.testStepFinished === 'object'
      ? envelope.testStepFinished as Record<string, unknown>
      : undefined;

    if (!testStepFinished) {
      continue;
    }

    const result = testStepFinished.testStepResult && typeof testStepFinished.testStepResult === 'object'
      ? testStepFinished.testStepResult as Record<string, unknown>
      : undefined;

    if (!result) {
      continue;
    }

    const pickleStep = testStepFinished.pickleStep && typeof testStepFinished.pickleStep === 'object'
      ? testStepFinished.pickleStep as Record<string, unknown>
      : undefined;

    const rawText = typeof pickleStep?.text === 'string' ? pickleStep.text.trim() : undefined;
    if (!rawText) {
      continue;
    }

    const key = rawText.toLowerCase();
    if (!stepTextLookup.has(key)) {
      continue;
    }

    const rawStatus = typeof result.status === 'string' ? result.status.toLowerCase() : '';
    const status: LiveStepStatus['status'] =
      rawStatus === 'passed' || rawStatus === 'pass' ? 'passed' :
      rawStatus === 'failed' || rawStatus === 'failure' ? 'failed' :
      rawStatus === 'skipped' || rawStatus === 'pending' || rawStatus === 'undefined' ? 'skipped' :
      'pending';

    const durationMs = typeof result.duration === 'number' ? result.duration / 1_000_000 : undefined;

    results.set(key, { stepText: rawText, status, durationMs });
  }

  return results;
}

interface StructuredArtifactDiscoveryResult {
  cucumberJsonPaths: string[];
  cucumberNdjsonPaths: string[];
  surefireTextPaths: string[];
}

function discoverStructuredResultArtifacts(executionRoot: string): StructuredArtifactDiscoveryResult {
  const targetRoot = path.join(executionRoot, 'target');
  if (!fs.existsSync(targetRoot)) {
    return {
      cucumberJsonPaths: [],
      cucumberNdjsonPaths: [],
      surefireTextPaths: [],
    };
  }

  const files = walkFiles(targetRoot, 0);
  const cucumberJsonPaths = files.filter((filePath) =>
    filePath.endsWith('.json') &&
    filePath.toLowerCase().includes('cucumber')
  );
  const cucumberNdjsonPaths = files.filter((filePath) =>
    (filePath.endsWith('.ndjson') || filePath.endsWith('.messages')) &&
    filePath.toLowerCase().includes('cucumber')
  );
  const surefireTextPaths = files.filter((filePath) =>
    filePath.includes(`${path.sep}surefire-reports${path.sep}`) &&
    filePath.endsWith('.txt')
  );

  return {
    cucumberJsonPaths,
    cucumberNdjsonPaths,
    surefireTextPaths,
  };
}

function walkFiles(root: string, depth: number): string[] {
  if (!fs.existsSync(root) || depth > 6) {
    return [];
  }

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(entryPath, depth + 1));
      continue;
    }

    if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

function parseCucumberJsonArtifact(
  artifactPath: string,
  featureAbsolutePath: string,
  scenario: ScenarioMetadata
): StructuredExecutionScenarioResult | undefined {
  let content: string;
  try {
    content = fs.readFileSync(artifactPath, 'utf8').trim();
  } catch {
    return undefined;
  }
  if (!content) {
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return undefined;
  }

  const features = Array.isArray(parsed) ? parsed : [parsed];
  const featurePathBasename = path.basename(featureAbsolutePath);

  for (const feature of features) {
    if (!feature || typeof feature !== 'object') {
      continue;
    }

    const featureObject = feature as Record<string, unknown>;
    const uri = typeof featureObject.uri === 'string' ? featureObject.uri : undefined;
    const id = typeof featureObject.id === 'string' ? featureObject.id : undefined;
    if (uri && !normalizeArtifactUri(uri).endsWith(featurePathBasename) && !(id?.includes(scenario.name.toLowerCase()) ?? false)) {
      continue;
    }

    const elements = Array.isArray(featureObject.elements) ? featureObject.elements : [];
    for (const element of elements) {
      if (!element || typeof element !== 'object') {
        continue;
      }

      const elementObject = element as Record<string, unknown>;
      const elementName = typeof elementObject.name === 'string' ? elementObject.name : undefined;
      const elementKeyword = typeof elementObject.keyword === 'string' ? elementObject.keyword : undefined;
      const elementLine = typeof elementObject.line === 'number' ? elementObject.line : undefined;

      if (!scenarioMatchesCandidateScenario(scenario, elementName, elementKeyword, elementLine)) {
        continue;
      }

      const beforeHooks = Array.isArray(elementObject.before) ? elementObject.before : [];
      const steps = Array.isArray(elementObject.steps) ? elementObject.steps : [];
      const afterHooks = Array.isArray(elementObject.after) ? elementObject.after : [];
      return {
        source: 'cucumber-json',
        scenarioName: elementName ?? scenario.name,
        steps: [
          ...beforeHooks
            .map((hook) => parseCucumberJsonHook(hook, 'Before')),
          ...steps
            .map(parseCucumberJsonStep),
          ...afterHooks
            .map((hook) => parseCucumberJsonHook(hook, 'After')),
        ]
          .filter((step): step is StructuredExecutionStepResult => step !== undefined),
      };
    }
  }

  return undefined;
}

function parseCucumberJsonStep(step: unknown): StructuredExecutionStepResult | undefined {
  if (!step || typeof step !== 'object') {
    return undefined;
  }

  const stepObject = step as Record<string, unknown>;
  const keyword = typeof stepObject.keyword === 'string' ? stepObject.keyword.trim() : undefined;
  const text = typeof stepObject.name === 'string' ? stepObject.name.trim() : undefined;
  const line = typeof stepObject.line === 'number' ? stepObject.line : undefined;
  const result = stepObject.result && typeof stepObject.result === 'object'
    ? stepObject.result as Record<string, unknown>
    : undefined;
  const status = normalizeStructuredStatus(typeof result?.status === 'string' ? result.status : undefined);
  const durationMs = typeof result?.duration === 'number'
    ? normalizeDurationToMs(result.duration)
    : undefined;

  if (!keyword || !text) {
    return undefined;
  }

  return {
    keyword,
    text,
    rawText: `${keyword} ${text}`,
    status,
    durationMs,
    lineZeroBased: typeof line === 'number' ? line - 1 : undefined,
    kind: normalizeStructuredKind(keyword),
  };
}

function parseCucumberJsonHook(
  hook: unknown,
  keyword: 'Before' | 'After'
): StructuredExecutionStepResult | undefined {
  if (!hook || typeof hook !== 'object') {
    return undefined;
  }

  const hookObject = hook as Record<string, unknown>;
  const result = hookObject.result && typeof hookObject.result === 'object'
    ? hookObject.result as Record<string, unknown>
    : undefined;
  const match = hookObject.match && typeof hookObject.match === 'object'
    ? hookObject.match as Record<string, unknown>
    : undefined;
  const location = typeof match?.location === 'string' ? match.location : undefined;
  const line = typeof hookObject.line === 'number' ? hookObject.line : undefined;

  return {
    keyword,
    text: location ?? `${keyword} hook`,
    rawText: location ? `${keyword} ${location}` : `${keyword} hook`,
    status: normalizeStructuredStatus(typeof result?.status === 'string' ? result.status : undefined),
    durationMs: typeof result?.duration === 'number'
      ? normalizeDurationToMs(result.duration)
      : undefined,
    lineZeroBased: typeof line === 'number' ? line - 1 : undefined,
    kind: normalizeStructuredKind(keyword),
  };
}

function parseCucumberNdjsonArtifact(
  artifactPath: string,
  featureAbsolutePath: string,
  scenario: ScenarioMetadata
): StructuredExecutionScenarioResult | undefined {
  let content: string;
  try {
    content = fs.readFileSync(artifactPath, 'utf8').trim();
  } catch {
    return undefined;
  }
  if (!content) {
    return undefined;
  }

  const lines = content.split(/\r?\n/);
  const featureBasename = path.basename(featureAbsolutePath);
  const stepResults = new Map<string, StructuredExecutionStepResult>();
  let matchedScenario = false;

  for (const line of lines) {
    let record: unknown;
    try {
      record = JSON.parse(line);
    } catch {
      continue;
    }

    if (!record || typeof record !== 'object') {
      continue;
    }

    const envelope = record as Record<string, unknown>;
    const pickle = envelope.pickle && typeof envelope.pickle === 'object'
      ? envelope.pickle as Record<string, unknown>
      : undefined;
    const testStepFinished = envelope.testStepFinished && typeof envelope.testStepFinished === 'object'
      ? envelope.testStepFinished as Record<string, unknown>
      : undefined;
    const testCase = envelope.testCase && typeof envelope.testCase === 'object'
      ? envelope.testCase as Record<string, unknown>
      : undefined;

    if (pickle) {
      const uri = typeof pickle.uri === 'string' ? pickle.uri : undefined;
      const name = typeof pickle.name === 'string' ? pickle.name : undefined;
      if (uri && normalizeArtifactUri(uri).endsWith(featureBasename) && name === scenario.name) {
        matchedScenario = true;
      }
    }

    if (!matchedScenario || !testCase || !Array.isArray(testCase.testSteps)) {
      continue;
    }

    if (!testStepFinished) {
      continue;
    }

    const testStepId = typeof testStepFinished.testStepId === 'string' ? testStepFinished.testStepId : undefined;
    const result = testStepFinished.testStepResult && typeof testStepFinished.testStepResult === 'object'
      ? testStepFinished.testStepResult as Record<string, unknown>
      : undefined;
    if (!testStepId || !result) {
      continue;
    }

    const matchingStep = (testCase.testSteps as unknown[]).find((candidate) => {
      if (!candidate || typeof candidate !== 'object') {
        return false;
      }
      return (candidate as Record<string, unknown>).id === testStepId;
    }) as Record<string, unknown> | undefined;

    const pickleStep = matchingStep?.pickleStep && typeof matchingStep.pickleStep === 'object'
      ? matchingStep.pickleStep as Record<string, unknown>
      : undefined;
    const text = typeof pickleStep?.text === 'string' ? pickleStep.text.trim() : undefined;
    if (!text) {
      continue;
    }

    const key = text.toLowerCase();
    stepResults.set(key, {
      text,
      rawText: text,
      status: normalizeStructuredStatus(typeof result.status === 'string' ? result.status : undefined),
      durationMs: typeof result.duration === 'number' ? normalizeDurationToMs(result.duration) : undefined,
      kind: 'step',
    });
  }

  if (stepResults.size === 0) {
    return undefined;
  }

  const steps = scenario.steps
    .map((step): StructuredExecutionStepResult | undefined => {
      const result = stepResults.get(step.text.toLowerCase());
      if (!result) {
        return undefined;
      }

      return {
        keyword: step.keyword,
        text: step.text,
        rawText: step.rawText,
        status: result.status,
        durationMs: result.durationMs,
        lineZeroBased: step.line,
      };
    })
    .filter((step): step is StructuredExecutionStepResult => step !== undefined);

  if (steps.length === 0) {
    return undefined;
  }

  return {
    source: 'cucumber-ndjson',
    scenarioName: scenario.name,
    steps,
  };
}

function parseSurefireTextArtifact(
  artifactPath: string,
  scenario: ScenarioMetadata
): StructuredExecutionScenarioResult | undefined {
  let content: string;
  try {
    content = fs.readFileSync(artifactPath, 'utf8');
  } catch {
    return undefined;
  }
  if (!content.includes(scenario.name)) {
    return undefined;
  }

  const steps: StructuredExecutionStepResult[] = [];
  let lastMatchedScenarioStepIndex = -1;
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const trimmedLine = rawLine.trim();
    const matchingScenarioStepIndex = scenario.steps.findIndex((step) => step.rawText === trimmedLine);
    if (matchingScenarioStepIndex >= 0) {
      lastMatchedScenarioStepIndex = matchingScenarioStepIndex;
      continue;
    }

    if (lastMatchedScenarioStepIndex < 0) {
      continue;
    }

    if (/(AssertionFailedError|Step failed|expected:|but was:)/i.test(trimmedLine)) {
      const matchedStep = scenario.steps[lastMatchedScenarioStepIndex];
      steps.push({
        keyword: matchedStep.keyword,
        text: matchedStep.text,
        rawText: matchedStep.rawText,
        status: 'failed',
        lineZeroBased: matchedStep.line,
        kind: 'step',
      });
      break;
    }
  }

  if (steps.length === 0) {
    return undefined;
  }

  return {
    source: 'surefire-text',
    scenarioName: scenario.name,
    steps,
  };
}

function scenarioMatchesCandidateScenario(
  scenario: ScenarioMetadata,
  candidateName?: string,
  candidateKeyword?: string,
  candidateLine?: number
): boolean {
  if (candidateName === scenario.name) {
    return true;
  }

  if (
    candidateName &&
    candidateKeyword &&
    `${candidateKeyword}: ${candidateName}`.toLowerCase() === `${scenario.keyword}: ${scenario.name}`.toLowerCase()
  ) {
    return true;
  }

  return candidateLine === scenario.line + 1;
}

function normalizeStructuredStatus(rawStatus?: string): StructuredExecutionStepResult['status'] {
  switch ((rawStatus ?? '').toLowerCase()) {
    case 'passed':
    case 'pass':
      return 'passed';
    case 'failed':
    case 'failure':
      return 'failed';
    case 'skipped':
    case 'pending':
    case 'undefined':
      return 'skipped';
    default:
      return 'pending';
  }
}

function normalizeDurationToMs(rawDuration: number): number {
  if (rawDuration > 1_000_000) {
    return rawDuration / 1_000_000;
  }

  return rawDuration;
}

function normalizeArtifactUri(uri: string): string {
  return uri.replace(/^file:\/\//, '').replace(/\\/g, path.sep);
}

function normalizeStructuredKind(keyword?: string): StructuredExecutionStepResult['kind'] {
  switch ((keyword ?? '').trim().toLowerCase()) {
    case 'before':
      return 'before';
    case 'after':
      return 'after';
    default:
      return 'step';
  }
}
