import test from 'node:test';
import * as assert from 'node:assert/strict';
import {
  discoverFeatureDocument,
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
  });
  assert.deepEqual(discovery.scenarios[1], {
    name: 'Card validation',
    line: 7,
    keyword: 'Scenario Outline',
    tags: ['@outline'],
    featureName: 'Checkout',
    exampleBlockCount: 1,
    exampleRowCount: 2,
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

test('isScenarioLine recognizes scenario headers only', () => {
  assert.equal(isScenarioLine('Scenario: Basic flow'), true);
  assert.equal(isScenarioLine('Scenario Outline: Outline flow'), true);
  assert.equal(isScenarioLine('Scenarios:'), false);
  assert.equal(isScenarioLine('Given a step'), false);
});
