/**
 * Discovered metadata for one Cucumber feature document.
 */
export interface FeatureDiscoveryResult {
  featureName?: string;
  featureLine?: number;
  backgroundSteps: ScenarioStepMetadata[];
  scenarios: ScenarioMetadata[];
}

/**
 * Discovered metadata for one Scenario or Scenario Outline.
 */
export interface ScenarioMetadata {
  name: string;
  line: number;
  keyword: 'Scenario' | 'Scenario Outline';
  tags: string[];
  featureName?: string;
  exampleBlockCount: number;
  exampleRowCount: number;
  examples: ScenarioExampleRowMetadata[];
  steps: ScenarioStepMetadata[];
}

/**
 * Discovered metadata for one executable Gherkin step line.
 */
export interface ScenarioStepMetadata {
  keyword: 'Given' | 'When' | 'Then' | 'And' | 'But' | '*';
  text: string;
  rawText: string;
  line: number;
}

/**
 * Discovered metadata for one Scenario Outline example row.
 */
export interface ScenarioExampleRowMetadata {
  line: number;
  values: string[];
}

interface PendingExamples {
  rowsStarted: boolean;
  dataRowCount: number;
  headerValues?: string[];
}

const FEATURE_LINE_PATTERN = /^Feature:\s+(.+)$/;
const SCENARIO_LINE_PATTERN = /^(Scenario|Scenario Outline):\s+(.+)$/;
const EXAMPLES_LINE_PATTERN = /^Examples(?::.*)?$/;

/**
 * Discovers feature, scenario, tag, example, background, and step metadata from a feature document.
 * @param getLineText Function that returns text for a zero-based line number.
 * @param lineCount Number of lines in the feature document.
 * @returns Parsed feature metadata.
 */
export function discoverFeatureDocument(
  getLineText: (line: number) => string,
  lineCount: number
): FeatureDiscoveryResult {
  const scenarios: ScenarioMetadata[] = [];
  const backgroundSteps: ScenarioStepMetadata[] = [];
  let featureName: string | undefined;
  let featureLine: number | undefined;
  let pendingTags: string[] = [];
  let currentScenario: ScenarioMetadata | undefined;
  let pendingExamples: PendingExamples | undefined;
  let collectingBackground = false;

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
        examples: [],
        steps: [...backgroundSteps],
      };
      scenarios.push(currentScenario);
      pendingTags = [];
      pendingExamples = undefined;
      collectingBackground = false;
      continue;
    }

    if (trimmedText.startsWith('Background:')) {
      pendingTags = [];
      pendingExamples = undefined;
      currentScenario = undefined;
      collectingBackground = true;
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
        currentScenario.examples.push({
          line,
          values: parseExampleRow(trimmedText),
        });
      } else {
        pendingExamples.rowsStarted = true;
        pendingExamples.headerValues = parseExampleRow(trimmedText);
      }
      continue;
    }

    if (pendingExamples) {
      pendingExamples = undefined;
    }

    const step = parseStepLine(trimmedText, line);
    if (step) {
      if (collectingBackground) {
        backgroundSteps.push(step);
      } else if (currentScenario) {
        currentScenario.steps.push(step);
      }
    }

    if (isStepLikeLine(trimmedText) || trimmedText.startsWith('Background:')) {
      pendingTags = [];
    }
  }

  return {
    featureName,
    featureLine,
    backgroundSteps,
    scenarios,
  };
}

/**
 * Finds the nearest scenario at or above a zero-based line.
 * @param scenarios Discovered scenarios ordered by document position.
 * @param fromLineZeroBased Zero-based source line to search from.
 * @returns Matching scenario metadata when available.
 */
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

/**
 * Finds the nearest scenario line at or above a zero-based line.
 * @param getLineText Function that returns text for a zero-based line number.
 * @param fromLineZeroBased Zero-based source line to search from.
 * @returns Zero-based scenario line when available.
 */
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

/**
 * Checks whether text is a Scenario or Scenario Outline header.
 * @param text Line text to inspect.
 * @returns True when the line is a scenario header.
 */
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

function parseStepLine(text: string, line: number): ScenarioStepMetadata | undefined {
  const stepMatch = text.match(/^(Given|When|Then|And|But|\*)\s+(.+)$/);
  if (!stepMatch) {
    return undefined;
  }

  return {
    keyword: stepMatch[1] as ScenarioStepMetadata['keyword'],
    text: stepMatch[2].trim(),
    rawText: text.trim(),
    line,
  };
}

function parseExampleRow(text: string): string[] {
  return text
    .split('|')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}
