import test from 'node:test';
import * as assert from 'node:assert/strict';
import { buildScenarioCodeLensItems } from '../../core/codeLens';
import { ScenarioMetadata } from '../../core/scenarioDiscovery';

test('buildScenarioCodeLensItems creates one Run Scenario lens per discovered scenario', () => {
  const scenarios: ScenarioMetadata[] = [
    {
      name: 'Login succeeds',
      line: 4,
      keyword: 'Scenario',
      tags: ['@smoke'],
      featureName: 'Auth',
      exampleBlockCount: 0,
      exampleRowCount: 0,
    },
    {
      name: 'Login matrix',
      line: 12,
      keyword: 'Scenario Outline',
      tags: ['@outline'],
      featureName: 'Auth',
      exampleBlockCount: 1,
      exampleRowCount: 2,
    },
  ];

  assert.deepEqual(buildScenarioCodeLensItems(scenarios), [
    {
      line: 4,
      title: 'BDD Run Scenario',
      scenarioName: 'Login succeeds',
    },
    {
      line: 12,
      title: 'BDD Run Scenario',
      scenarioName: 'Login matrix',
    },
  ]);
});
