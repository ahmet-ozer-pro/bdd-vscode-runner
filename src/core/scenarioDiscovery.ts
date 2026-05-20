export interface FeatureDiscoveryResult {
  featureName?: string;
  featureLine?: number;
  scenarios: ScenarioMetadata[];
}

export interface ScenarioMetadata {
  name: string;
  line: number;
  keyword: 'Scenario' | 'Scenario Outline';
  tags: string[];
  featureName?: string;
  exampleBlockCount: number;
  exampleRowCount: number;
}

interface PendingExamples {
  rowsStarted: boolean;
  dataRowCount: number;
}

const FEATURE_LINE_PATTERN = /^Feature:\s+(.+)$/;
const SCENARIO_LINE_PATTERN = /^(Scenario|Scenario Outline):\s+(.+)$/;
const EXAMPLES_LINE_PATTERN = /^Examples(?::.*)?$/;

export function discoverFeatureDocument(
  getLineText: (line: number) => string,
  lineCount: number
): FeatureDiscoveryResult {
  const scenarios: ScenarioMetadata[] = [];
  let featureName: string | undefined;
  let featureLine: number | undefined;
  let pendingTags: string[] = [];
  let currentScenario: ScenarioMetadata | undefined;
  let pendingExamples: PendingExamples | undefined;

  for (let line = 0; line < lineCount; line++) {
    const trimmedText = getLineText(line).trim();

    if (trimmedText.length === 0 || trimmedText.startsWith('#')) {
      continue;
    }

    const featureMatch = trimmedText.match(FEATURE_LINE_PATTERN);
    if (featureMatch) {
      featureName = featureMatch[1].trim();
      featureLine = line;
      pendingTags = [];
      continue;
    }

    if (trimmedText.startsWith('@')) {
      pendingTags.push(...parseTagLine(trimmedText));
      continue;
    }

    const scenarioMatch = trimmedText.match(SCENARIO_LINE_PATTERN);
    if (scenarioMatch) {
      currentScenario = {
        name: scenarioMatch[2].trim(),
        line,
        keyword: scenarioMatch[1] as ScenarioMetadata['keyword'],
        tags: pendingTags,
        featureName,
        exampleBlockCount: 0,
        exampleRowCount: 0,
      };
      scenarios.push(currentScenario);
      pendingTags = [];
      pendingExamples = undefined;
      continue;
    }

    if (currentScenario && currentScenario.keyword === 'Scenario Outline' && EXAMPLES_LINE_PATTERN.test(trimmedText)) {
      currentScenario.exampleBlockCount += 1;
      pendingExamples = {
        rowsStarted: false,
        dataRowCount: 0,
      };
      continue;
    }

    if (currentScenario && pendingExamples && trimmedText.startsWith('|')) {
      if (pendingExamples.rowsStarted) {
        pendingExamples.dataRowCount += 1;
        currentScenario.exampleRowCount += 1;
      } else {
        pendingExamples.rowsStarted = true;
      }
      continue;
    }

    if (pendingExamples) {
      pendingExamples = undefined;
    }

    if (isStepLikeLine(trimmedText) || trimmedText.startsWith('Background:')) {
      pendingTags = [];
    }
  }

  return {
    featureName,
    featureLine,
    scenarios,
  };
}

export function findNearestScenarioMetadata(
  scenarios: ScenarioMetadata[],
  fromLineZeroBased: number
): ScenarioMetadata | undefined {
  for (let index = scenarios.length - 1; index >= 0; index--) {
    const scenario = scenarios[index];
    if (scenario.line <= fromLineZeroBased) {
      return scenario;
    }
  }

  return undefined;
}

export function findNearestScenarioLine(
  getLineText: (line: number) => string,
  fromLineZeroBased: number
): number | undefined {
  let lineCount = fromLineZeroBased + 1;

  while (true) {
    try {
      getLineText(lineCount);
      lineCount += 1;
    } catch {
      break;
    }
  }

  const discovery = discoverFeatureDocument(getLineText, lineCount);
  return findNearestScenarioMetadata(discovery.scenarios, fromLineZeroBased)?.line;
}

export function isScenarioLine(text: string): boolean {
  return SCENARIO_LINE_PATTERN.test(text);
}

function parseTagLine(text: string): string[] {
  return text
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => /^@\S+$/.test(part));
}

function isStepLikeLine(text: string): boolean {
  return /^(Given|When|Then|And|But|\*)\b/.test(text);
}
