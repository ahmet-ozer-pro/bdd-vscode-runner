import { FeatureDiscoveryResult, ScenarioMetadata } from './scenarioDiscovery';
import { ExecutionStatus } from './observability';

export interface ScenarioCodeLensItem {
  line: number;
  title: string;
  scenarioName: string;
  kind: 'run' | 'debug';
}

export interface FeatureCodeLensItem {
  line: number;
  title: string;
  featureName?: string;
}

export function buildScenarioCodeLensItems(
  scenarios: ScenarioMetadata[],
  getStatus?: (line: number) => ExecutionStatus | undefined
): ScenarioCodeLensItem[] {
  return scenarios.flatMap((scenario) => {
    const items: ScenarioCodeLensItem[] = [
      {
        line: scenario.line,
        title: `${getStatusPrefix(getStatus?.(scenario.line + 1))} Run`,
        scenarioName: scenario.name,
        kind: 'run',
      },
      {
        line: scenario.line,
        title: '⚙ Config',
        scenarioName: scenario.name,
        kind: 'debug',
      },
    ];

    if (scenario.keyword === 'Scenario Outline' && scenario.examples.length > 0) {
      items.push(
        ...scenario.examples.map((example, index) => ({
          line: example.line,
          title: `${getStatusPrefix(getStatus?.(example.line + 1))} Example #${index + 1}`,
          scenarioName: scenario.name,
          kind: 'run' as const,
        }))
      );
    }

    return items;
  });
}

function getStatusPrefix(status: ExecutionStatus | undefined): string {
  if (status === 'passed') {
    return '✓';
  }

  if (status === 'failed') {
    return '✗';
  }

  if (status === 'cancelled') {
    return '⊘';
  }

  return '▶';
}

export function buildFeatureCodeLensItem(discovery: FeatureDiscoveryResult): FeatureCodeLensItem | undefined {
  if (discovery.featureLine === undefined) {
    return undefined;
  }

  return {
    line: discovery.featureLine,
    title: 'BDD Run Feature',
    featureName: discovery.featureName,
  };
}
