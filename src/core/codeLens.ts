import { ScenarioMetadata } from './scenarioDiscovery';

export interface ScenarioCodeLensItem {
  line: number;
  title: string;
  scenarioName: string;
}

export function buildScenarioCodeLensItems(scenarios: ScenarioMetadata[]): ScenarioCodeLensItem[] {
  return scenarios.map((scenario) => ({
    line: scenario.line,
    title: 'BDD Run Scenario',
    scenarioName: scenario.name,
  }));
}
