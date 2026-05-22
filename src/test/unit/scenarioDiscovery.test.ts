import test from 'node:test';
import * as assert from 'node:assert/strict';
import {
  discoverFeatureDocument,
  findNearestScenarioLine,
  findNearestScenarioMetadata,
  isScenarioLine,
} from '../../core/scenarioDiscovery';

function lines(text: string): string[] {
  return text.trim().split('\n');
}

function getLineReader(sourceLines: string[]): (line: number) => string {
  return (line: number) => {
    if (line < 0 || line >= sourceLines.length) {
      throw new RangeError(`Line ${line} is out of bounds.`);
    }

    return sourceLines[line];
  };
}

test('discoverFeatureDocument extracts feature metadata, tags, and examples', () => {
  const sourceLines = lines(`
Feature: Checkout

  @smoke @payments
  Scenario: Successful payment
    Given the user is on the checkout page

  @outline
  Scenario Outline: Card validation
    When the user pays with <card>
    Then the payment is rejected

    Examples:
      | card |
      | bad  |
      | lost |
`);

  const discovery = discoverFeatureDocument(getLineReader(sourceLines), sourceLines.length);

  assert.equal(discovery.featureName, 'Checkout');
  assert.equal(discovery.featureLine, 0);
  assert.equal(discovery.scenarios.length, 2);
  assert.deepEqual(discovery.scenarios[0], {
    name: 'Successful payment',
    line: 3,
    keyword: 'Scenario',
    tags: ['@smoke', '@payments'],
    featureName: 'Checkout',
    exampleBlockCount: 0,
    exampleRowCount: 0,
    examples: [],
    steps: [
      {
        keyword: 'Given',
        text: 'the user is on the checkout page',
        rawText: 'Given the user is on the checkout page',
        line: 4,
      },
    ],
  });
  assert.deepEqual(discovery.scenarios[1], {
    name: 'Card validation',
    line: 7,
    keyword: 'Scenario Outline',
    tags: ['@outline'],
    featureName: 'Checkout',
    exampleBlockCount: 1,
    exampleRowCount: 2,
    examples: [
      {
        line: 13,
        values: ['bad'],
      },
      {
        line: 14,
        values: ['lost'],
      },
    ],
    steps: [
      {
        keyword: 'When',
        text: 'the user pays with <card>',
        rawText: 'When the user pays with <card>',
        line: 8,
      },
      {
        keyword: 'Then',
        text: 'the payment is rejected',
        rawText: 'Then the payment is rejected',
        line: 9,
      },
    ],
  });
});

test('findNearestScenarioMetadata returns the scenario at or above the cursor line', () => {
  const sourceLines = lines(`
Feature: Orders

  Scenario: First
    Given one

  Scenario: Second
    Given two
`);

  const discovery = discoverFeatureDocument(getLineReader(sourceLines), sourceLines.length);

  assert.equal(findNearestScenarioMetadata(discovery.scenarios, 3)?.name, 'First');
  assert.equal(findNearestScenarioMetadata(discovery.scenarios, 6)?.name, 'Second');
  assert.equal(findNearestScenarioMetadata(discovery.scenarios, 0), undefined);
});

test('findNearestScenarioLine returns the zero-based scenario line at or above cursor', () => {
  const sourceLines = lines(`
Feature: Orders

  Scenario: First
    Given one

  Scenario: Second
    Given two
`);

  const reader = getLineReader(sourceLines);

  assert.equal(findNearestScenarioLine(reader, 3), 2);
  assert.equal(findNearestScenarioLine(reader, 6), 5);
  assert.equal(findNearestScenarioLine(reader, 0), undefined);
});

test('discoverFeatureDocument does not carry tags across unrelated lines', () => {
  const sourceLines = lines(`
Feature: Search

  @fast
  Background:
    Given shared state

  Scenario: Actual scenario
    Given something
`);

  const discovery = discoverFeatureDocument(getLineReader(sourceLines), sourceLines.length);

  assert.deepEqual(discovery.scenarios[0]?.tags, []);
});

test('discoverFeatureDocument prepends background steps to each scenario', () => {
  const sourceLines = lines(`
Feature: Shared setup

  Background:
    Given a signed in user
    And a clean account

  Scenario: First flow
    When the user opens the dashboard
    Then the dashboard is visible

  Scenario: Second flow
    When the user opens settings
    Then settings are visible
`);

  const discovery = discoverFeatureDocument(getLineReader(sourceLines), sourceLines.length);

  assert.deepEqual(
    discovery.backgroundSteps.map((step) => step.rawText),
    ['Given a signed in user', 'And a clean account']
  );
  assert.deepEqual(
    discovery.scenarios[0].steps.map((step) => step.rawText),
    [
      'Given a signed in user',
      'And a clean account',
      'When the user opens the dashboard',
      'Then the dashboard is visible',
    ]
  );
  assert.deepEqual(
    discovery.scenarios[1].steps.map((step) => step.rawText),
    [
      'Given a signed in user',
      'And a clean account',
      'When the user opens settings',
      'Then settings are visible',
    ]
  );
});

test('isScenarioLine recognizes scenario headers only', () => {
  assert.equal(isScenarioLine('Scenario: Basic flow'), true);
  assert.equal(isScenarioLine('Scenario Outline: Outline flow'), true);
  assert.equal(isScenarioLine('Scenarios:'), false);
  assert.equal(isScenarioLine('Given a step'), false);
});
