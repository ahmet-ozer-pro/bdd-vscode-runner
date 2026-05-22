import test from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  buildStructuredFailureTargets,
  collectStructuredExecutionResult,
  parseLiveNdjsonStepStatuses,
} from '../../core/resultIngestion';
import { ScenarioMetadata } from '../../core/scenarioDiscovery';

const scenario: ScenarioMetadata = {
  name: 'Search document by stored number with different contexts',
  line: 15,
  keyword: 'Scenario Outline',
  tags: ['@mobile'],
  featureName: 'Extension Smoke Test Document Search',
  exampleBlockCount: 1,
  exampleRowCount: 1,
  examples: [
    {
      line: 27,
      values: ['ios2', 'validUser5'],
    },
  ],
  steps: [
    {
      keyword: 'Given',
      text: 'API user context is "<context>"',
      rawText: 'Given API user context is "<context>"',
      line: 16,
    },
    {
      keyword: 'When',
      text: 'click on alternative Belgenet URL option',
      rawText: 'When click on alternative Belgenet URL option',
      line: 19,
    },
    {
      keyword: 'Then',
      text: 'I should be logged in',
      rawText: 'Then I should be logged in',
      line: 24,
    },
  ],
};

test('collectStructuredExecutionResult reads matching cucumber json artifacts', () => {
  const executionRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bdd-result-ingestion-'));
  const featurePath = path.join(executionRoot, 'src', 'test', 'resources', 'features', 'mobile', 'test.feature');
  const reportPath = path.join(executionRoot, 'target', 'cucumber', 'cucumber-report.json');

  fs.mkdirSync(path.dirname(featurePath), { recursive: true });
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(featurePath, 'Feature: Smoke');
  fs.writeFileSync(
    reportPath,
    JSON.stringify([
      {
        uri: featurePath,
        elements: [
          {
            keyword: 'Scenario Outline',
            name: scenario.name,
            line: 16,
            before: [
              {
                match: { location: 'com.example.Hooks.beforeScenario()' },
                result: { status: 'passed', duration: 20000000 },
              },
            ],
            steps: [
              {
                keyword: 'Given',
                name: 'API user context is "<context>"',
                line: 17,
                result: { status: 'passed', duration: 150000000 },
              },
              {
                keyword: 'When',
                name: 'click on alternative Belgenet URL option',
                line: 20,
                result: { status: 'passed', duration: 420000000 },
              },
              {
                keyword: 'Then',
                name: 'I should be logged in',
                line: 25,
                result: { status: 'failed', duration: 900000000 },
              },
            ],
            after: [
              {
                match: { location: 'com.example.Hooks.afterScenario()' },
                result: { status: 'passed', duration: 30000000 },
              },
            ],
          },
        ],
      },
    ])
  );

  const result = collectStructuredExecutionResult(executionRoot, featurePath, scenario);

  assert.equal(result?.source, 'cucumber-json');
  assert.deepEqual(
    result?.steps.map((step) => ({
      text: step.text,
      kind: step.kind,
      status: step.status,
      durationMs: step.durationMs,
      line: step.lineZeroBased,
    })),
    [
      {
        text: 'com.example.Hooks.beforeScenario()',
        kind: 'before',
        status: 'passed',
        durationMs: 20,
        line: undefined,
      },
      {
        text: 'API user context is "<context>"',
        kind: 'step',
        status: 'passed',
        durationMs: 150,
        line: 16,
      },
      {
        text: 'click on alternative Belgenet URL option',
        kind: 'step',
        status: 'passed',
        durationMs: 420,
        line: 19,
      },
      {
        text: 'I should be logged in',
        kind: 'step',
        status: 'failed',
        durationMs: 900,
        line: 24,
      },
      {
        text: 'com.example.Hooks.afterScenario()',
        kind: 'after',
        status: 'passed',
        durationMs: 30,
        line: undefined,
      },
    ]
  );
});

test('collectStructuredExecutionResult falls back to surefire text when structured cucumber artifacts are absent', () => {
  const executionRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bdd-result-ingestion-'));
  const featurePath = path.join(executionRoot, 'src', 'test', 'resources', 'features', 'mobile', 'test.feature');
  const reportPath = path.join(executionRoot, 'target', 'surefire-reports', 'SmokeTest.txt');

  fs.mkdirSync(path.dirname(featurePath), { recursive: true });
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(featurePath, 'Feature: Smoke');
  fs.writeFileSync(
    reportPath,
    [
      scenario.name,
      'Given API user context is "<context>"',
      'When click on alternative Belgenet URL option',
      'Then I should be logged in',
      'org.opentest4j.AssertionFailedError: boom',
    ].join('\n')
  );

  const result = collectStructuredExecutionResult(executionRoot, featurePath, scenario);

  assert.equal(result?.source, 'surefire-text');
  assert.deepEqual(
    result?.steps.map((step) => ({ text: step.text, status: step.status, line: step.lineZeroBased })),
    [
      {
        text: 'I should be logged in',
        status: 'failed',
        line: 24,
      },
    ]
  );
});

test('collectStructuredExecutionResult reads matching cucumber ndjson artifacts', () => {
  const executionRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bdd-result-ingestion-'));
  const featurePath = path.join(
    executionRoot,
    'src',
    'test',
    'resources',
    'features',
    'mobile',
    'test.feature'
  );
  const reportPath = path.join(executionRoot, 'target', 'cucumber-messages.ndjson');

  fs.mkdirSync(path.dirname(featurePath), { recursive: true });
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(featurePath, 'Feature: Smoke');

  const pickleId = 'pickle-1';
  const testCaseId = 'tc-1';
  const stepId1 = 'step-1';
  const stepId2 = 'step-2';

  const lines = [
    JSON.stringify({ pickle: { id: pickleId, uri: featurePath, name: scenario.name } }),
    JSON.stringify({
      testCase: {
        id: testCaseId,
        pickleId,
        testSteps: [
          { id: stepId1, pickleStep: { text: 'API user context is "<context>"' } },
          { id: stepId2, pickleStep: { text: 'I should be logged in' } },
        ],
      },
    }),
    JSON.stringify({
      testCase: {
        id: testCaseId,
        pickleId,
        testSteps: [
          { id: stepId1, pickleStep: { text: 'API user context is "<context>"' } },
          { id: stepId2, pickleStep: { text: 'I should be logged in' } },
        ],
      },
      testStepFinished: {
        testStepId: stepId1,
        testStepResult: { status: 'PASSED', duration: 100000000 },
      },
    }),
    JSON.stringify({
      testCase: {
        id: testCaseId,
        pickleId,
        testSteps: [
          { id: stepId1, pickleStep: { text: 'API user context is "<context>"' } },
          { id: stepId2, pickleStep: { text: 'I should be logged in' } },
        ],
      },
      testStepFinished: {
        testStepId: stepId2,
        testStepResult: { status: 'FAILED', duration: 500000000 },
      },
    }),
  ];
  fs.writeFileSync(reportPath, lines.join('\n'));

  const result = collectStructuredExecutionResult(executionRoot, featurePath, scenario);

  assert.equal(result?.source, 'cucumber-ndjson');
  assert.ok(result?.steps.some((step) => step.text === 'API user context is "<context>"' && step.status === 'passed'));
  assert.ok(result?.steps.some((step) => step.text === 'I should be logged in' && step.status === 'failed'));
});

test('buildStructuredFailureTargets creates step-level feature targets from structured results', () => {
  const targets = buildStructuredFailureTargets(
    {
      source: 'cucumber-json',
      scenarioName: scenario.name,
      steps: [
        {
          text: 'API user context is "<context>"',
          rawText: 'Given API user context is "<context>"',
          status: 'passed',
          lineZeroBased: 16,
        },
        {
          text: 'I should be logged in',
          rawText: 'Then I should be logged in',
          status: 'failed',
          lineZeroBased: 24,
        },
      ],
    },
    '/workspace/src/test/resources/features/mobile/test.feature'
  );

  assert.deepEqual(targets, [
    {
      filePath: '/workspace/src/test/resources/features/mobile/test.feature',
      lineZeroBased: 24,
      label: 'Then I should be logged in -> test.feature:25',
      source: 'step',
    },
  ]);
});

test('parseLiveNdjsonStepStatuses extracts step statuses from streamed NDJSON', () => {
  const liveScenario: ScenarioMetadata = {
    name: 'Live step test',
    line: 5,
    keyword: 'Scenario',
    tags: [],
    featureName: 'Live',
    exampleBlockCount: 0,
    exampleRowCount: 0,
    examples: [],
    steps: [
      { keyword: 'Given', text: 'user is logged in', rawText: 'Given user is logged in', line: 6 },
      { keyword: 'When', text: 'user clicks submit', rawText: 'When user clicks submit', line: 7 },
      { keyword: 'Then', text: 'result is shown', rawText: 'Then result is shown', line: 8 },
    ],
  };

  const ndjsonLines = [
    JSON.stringify({ testStepFinished: { pickleStep: { text: 'user is logged in' }, testStepResult: { status: 'PASSED', duration: 100000000 } } }),
    JSON.stringify({ testStepFinished: { pickleStep: { text: 'user clicks submit' }, testStepResult: { status: 'FAILED', duration: 200000000 } } }),
    'not json at all',
    '{}',
  ];

  const statuses = parseLiveNdjsonStepStatuses(ndjsonLines.join('\n'), liveScenario);

  assert.equal(statuses.size, 2);
  assert.equal(statuses.get('user is logged in')?.status, 'passed');
  assert.equal(statuses.get('user is logged in')?.durationMs, 100);
  assert.equal(statuses.get('user clicks submit')?.status, 'failed');
  assert.equal(statuses.get('user clicks submit')?.durationMs, 200);
  assert.equal(statuses.get('result is shown'), undefined);
});

test('parseLiveNdjsonStepStatuses ignores steps not in scenario', () => {
  const liveScenario: ScenarioMetadata = {
    name: 'Narrow test',
    line: 1,
    keyword: 'Scenario',
    tags: [],
    featureName: 'Narrow',
    exampleBlockCount: 0,
    exampleRowCount: 0,
    examples: [],
    steps: [
      { keyword: 'Given', text: 'known step', rawText: 'Given known step', line: 2 },
    ],
  };

  const ndjson = JSON.stringify({
    testStepFinished: {
      pickleStep: { text: 'unknown step' },
      testStepResult: { status: 'PASSED', duration: 50000000 },
    },
  });

  const statuses = parseLiveNdjsonStepStatuses(ndjson, liveScenario);
  assert.equal(statuses.size, 0);
});
