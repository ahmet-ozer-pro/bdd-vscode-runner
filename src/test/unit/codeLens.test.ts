import test from 'node:test';
import * as assert from 'node:assert/strict';
import { buildFeatureCodeLensItem, buildScenarioCodeLensItems } from '../../core/codeLens';
import { FeatureDiscoveryResult, ScenarioMetadata } from '../../core/scenarioDiscovery';

test('buildScenarioCodeLensItems creates Run and Config lenses per discovered scenario', () => {
  const scenarios: ScenarioMetadata[] = [
    {
      name: 'Login succeeds',
      line: 4,
      keyword: 'Scenario',
      tags: ['@smoke'],
      featureName: 'Auth',
      exampleBlockCount: 0,
      exampleRowCount: 0,
      examples: [],
      steps: [],
    },
    {
      name: 'Login matrix',
      line: 12,
      keyword: 'Scenario Outline',
      tags: ['@outline'],
      featureName: 'Auth',
      exampleBlockCount: 1,
      exampleRowCount: 2,
      examples: [],
      steps: [],
    },
  ];

  assert.deepEqual(buildScenarioCodeLensItems(scenarios), [
    {
      line: 4,
      title: '▶ Run',
      scenarioName: 'Login succeeds',
      kind: 'run',
    },
    {
      line: 4,
      title: '⚙ Config',
      scenarioName: 'Login succeeds',
      kind: 'debug',
    },
    {
      line: 12,
      title: '▶ Run',
      scenarioName: 'Login matrix',
      kind: 'run',
    },
    {
      line: 12,
      title: '⚙ Config',
      scenarioName: 'Login matrix',
      kind: 'debug',
    },
  ]);
});

test('buildScenarioCodeLensItems creates six CodeLens items for three scenarios', () => {
  const scenarios: ScenarioMetadata[] = Array.from({ length: 3 }, (_, index) => ({
    name: `Scenario ${index + 1}`,
    line: index * 4,
    keyword: 'Scenario',
    tags: [],
    featureName: 'Auth',
    exampleBlockCount: 0,
    exampleRowCount: 0,
    examples: [],
    steps: [],
  }));

  assert.equal(buildScenarioCodeLensItems(scenarios).length, 6);
});

test('buildScenarioCodeLensItems prefixes scenario titles with last run status', () => {
  const scenarios: ScenarioMetadata[] = [
    {
      name: 'Login succeeds',
      line: 4,
      keyword: 'Scenario',
      tags: [],
      featureName: 'Auth',
      exampleBlockCount: 0,
      exampleRowCount: 0,
      examples: [],
      steps: [],
    },
    {
      name: 'Login fails',
      line: 8,
      keyword: 'Scenario',
      tags: [],
      featureName: 'Auth',
      exampleBlockCount: 0,
      exampleRowCount: 0,
      examples: [],
      steps: [],
    },
    {
      name: 'Login cancelled',
      line: 12,
      keyword: 'Scenario',
      tags: [],
      featureName: 'Auth',
      exampleBlockCount: 0,
      exampleRowCount: 0,
      examples: [],
      steps: [],
    },
  ];

  const statuses = new Map([
    [5, 'passed' as const],
    [9, 'failed' as const],
    [13, 'cancelled' as const],
  ]);

  assert.deepEqual(buildScenarioCodeLensItems(scenarios, (line) => statuses.get(line)), [
    {
      line: 4,
      title: '✓ Run',
      scenarioName: 'Login succeeds',
      kind: 'run',
    },
    {
      line: 4,
      title: '⚙ Config',
      scenarioName: 'Login succeeds',
      kind: 'debug',
    },
    {
      line: 8,
      title: '✗ Run',
      scenarioName: 'Login fails',
      kind: 'run',
    },
    {
      line: 8,
      title: '⚙ Config',
      scenarioName: 'Login fails',
      kind: 'debug',
    },
    {
      line: 12,
      title: '⊘ Run',
      scenarioName: 'Login cancelled',
      kind: 'run',
    },
    {
      line: 12,
      title: '⚙ Config',
      scenarioName: 'Login cancelled',
      kind: 'debug',
    },
  ]);
});

test('buildScenarioCodeLensItems creates example CodeLens items for Scenario Outline rows', () => {
  const scenarios: ScenarioMetadata[] = [
    {
      name: 'Login matrix',
      line: 12,
      keyword: 'Scenario Outline',
      tags: ['@outline'],
      featureName: 'Auth',
      exampleBlockCount: 1,
      exampleRowCount: 2,
      examples: [
        {
          line: 18,
          values: ['valid'],
        },
        {
          line: 19,
          values: ['invalid'],
        },
      ],
      steps: [],
    },
  ];

  assert.deepEqual(buildScenarioCodeLensItems(scenarios), [
    {
      line: 12,
      title: '▶ Run',
      scenarioName: 'Login matrix',
      kind: 'run',
    },
    {
      line: 12,
      title: '⚙ Config',
      scenarioName: 'Login matrix',
      kind: 'debug',
    },
    {
      line: 18,
      title: '▶ Example #1',
      scenarioName: 'Login matrix',
      kind: 'run',
    },
    {
      line: 19,
      title: '▶ Example #2',
      scenarioName: 'Login matrix',
      kind: 'run',
    },
  ]);
});

test('buildFeatureCodeLensItem creates a Run Feature lens for the discovered feature line', () => {
  const discovery: FeatureDiscoveryResult = {
    featureName: 'Auth',
    featureLine: 1,
    backgroundSteps: [],
    scenarios: [],
  };

  assert.deepEqual(buildFeatureCodeLensItem(discovery), {
    line: 1,
    title: 'BDD Run Feature',
    featureName: 'Auth',
  });
});
