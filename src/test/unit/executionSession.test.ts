import test from 'node:test';
import * as assert from 'node:assert/strict';
import {
  buildExecutionSession,
  buildFolderExecutionSession,
  buildTagExecutionSession,
  ExecutionSessionStore,
  formatExecutionSessionSummary,
} from '../../core/executionSession';
import { FailureNavigationTarget } from '../../core/failureNavigation';
import { ScenarioMetadata } from '../../core/scenarioDiscovery';

const scenario: ScenarioMetadata = {
  name: 'Search document by stored number',
  line: 15,
  keyword: 'Scenario Outline',
  tags: ['@mobile'],
  featureName: 'Extension Smoke Test Document Search',
  exampleBlockCount: 1,
  exampleRowCount: 1,
  examples: [
    {
      line: 27,
      values: ['ios2', 'validUser2'],
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

const context = {
  workspaceRoot: '/workspace',
  executionRoot: '/workspace',
  pomPath: '/workspace/pom.xml',
  featurePath: 'src/test/resources/features/mobile/test.feature',
  scenarioName: scenario.name,
  scenarioLineOneBased: 16,
  displayCommand: 'mvn test -Dcucumber.features=src/test/resources/features/mobile/test.feature:16 -e',
} as const;

test('buildExecutionSession marks all discovered steps passed when the scenario passes', () => {
  const session = buildExecutionSession(context, scenario, 'passed', [], '', undefined, 0, 1200);

  assert.deepEqual(
    session.steps.map((step) => step.status),
    ['passed', 'passed', 'passed']
  );
  assert.equal(session.status, 'passed');
});

test('buildExecutionSession projects a failed feature step onto discovered scenario steps', () => {
  const failureTargets: FailureNavigationTarget[] = [
    {
      filePath: '/workspace/src/test/resources/features/mobile/test.feature',
      lineZeroBased: 24,
      label: 'I should be logged in -> test.feature:25',
      source: 'step',
    },
  ];

  const session = buildExecutionSession(context, scenario, 'failed', failureTargets, '', undefined, 1, 1300);

  assert.deepEqual(
    session.steps.map((step) => ({ text: step.text, status: step.status })),
    [
      { text: 'API user context is "<context>"', status: 'passed' },
      { text: 'click on alternative Belgenet URL option', status: 'passed' },
      { text: 'I should be logged in', status: 'failed' },
    ]
  );
});

test('buildExecutionSession extracts a failed step line from output file-uri mapping', () => {
  const session = buildExecutionSession(
    context,
    scenario,
    'failed',
    [],
    'at *.I should be logged in(file:///workspace/src/test/resources/features/mobile/test.feature:25)',
    undefined,
    1,
    1300
  );

  assert.deepEqual(
    session.steps.map((step) => step.status),
    ['passed', 'passed', 'failed']
  );
});

test('buildExecutionSession infers live running progress from streamed step output', () => {
  const session = buildExecutionSession(
    context,
    scenario,
    'running',
    [],
    [
      'Given API user context is "ios2"',
      'When click on alternative Belgenet URL option',
    ].join('\n'),
    undefined,
    undefined,
    undefined
  );

  assert.deepEqual(
    session.steps.map((step) => step.status),
    ['passed', 'pending', 'pending']
  );
});

test('buildExecutionSession marks the current running step failed when failure markers appear in live output', () => {
  const session = buildExecutionSession(
    context,
    scenario,
    'running',
    [],
    [
      'Given API user context is "ios2"',
      'When click on alternative Belgenet URL option',
      'Then I should be logged in',
      'org.opentest4j.AssertionFailedError: User should be logged in ==> expected: <true> but was: <false>',
      'Step failed',
    ].join('\n'),
    undefined,
    undefined,
    undefined
  );

  assert.deepEqual(
    session.steps.map((step) => step.status),
    ['passed', 'passed', 'failed']
  );
});

test('ExecutionSessionStore stores the latest built session', () => {
  const store = new ExecutionSessionStore();
  const session = buildExecutionSession(context, scenario, 'passed', [], '', undefined, 0, 1000);

  store.setLatest(session);

  assert.equal(store.getLatest()?.scenarioName, scenario.name);
  assert.equal(store.getLatest()?.steps.length, 3);
  assert.equal(store.getSessions().length, 1);
});

test('ExecutionSessionStore keeps recent execution sessions in newest-first order', () => {
  const store = new ExecutionSessionStore();
  const first = buildExecutionSession(
    { ...context, startedAt: 100 },
    scenario,
    'passed',
    [],
    '',
    undefined,
    0,
    1000
  );
  const second = buildExecutionSession(
    { ...context, scenarioName: 'Search document by stored number again', startedAt: 200 },
    { ...scenario, name: 'Search document by stored number again' },
    'failed',
    [],
    '',
    undefined,
    1,
    1200
  );

  store.setLatest(first);
  store.setLatest(second);

  assert.deepEqual(
    store.getSessions().map((session) => session.runId),
    [second.runId, first.runId]
  );
});

test('ExecutionSessionStore returns status for a matching feature path and line', () => {
  const store = new ExecutionSessionStore();
  const session = buildExecutionSession(
    {
      ...context,
      featureAbsolutePath: '/workspace/src/test/resources/features/mobile/test.feature',
      startedAt: 100,
    },
    scenario,
    'passed',
    [],
    '',
    undefined,
    0,
    1000
  );

  store.setLatest(session);

  assert.equal(
    store.getStatusForLocation('/workspace/src/test/resources/features/mobile/test.feature', 16),
    'passed'
  );
  assert.equal(store.getStatusForLocation('/workspace/other.feature', 16), undefined);
});

test('ExecutionSessionStore returns the newest status for the same feature path and line', () => {
  const store = new ExecutionSessionStore();
  const featureAbsolutePath = '/workspace/src/test/resources/features/mobile/test.feature';
  const first = buildExecutionSession(
    {
      ...context,
      featureAbsolutePath,
      startedAt: 100,
    },
    scenario,
    'failed',
    [],
    '',
    undefined,
    1,
    1000
  );
  const second = buildExecutionSession(
    {
      ...context,
      featureAbsolutePath,
      startedAt: 200,
    },
    scenario,
    'passed',
    [],
    '',
    undefined,
    0,
    1000
  );

  store.setLatest(first);
  store.setLatest(second);

  assert.equal(store.getStatusForLocation(featureAbsolutePath, 16), 'passed');
});

test('buildTagExecutionSession builds a session with tag label and no steps', () => {
  const tagContext = {
    workspaceRoot: '/workspace',
    executionRoot: '/workspace',
    pomPath: '/workspace/pom.xml',
    featurePath: '',
    scenarioName: 'Tag: @smoke',
    scenarioLineOneBased: 1,
    displayCommand: 'mvn test -Dcucumber.filter.tags=@smoke -e',
    startedAt: 100,
  };

  const session = buildTagExecutionSession(tagContext, '@smoke', 'passed', [], 'output text', 0, 1500);

  assert.equal(session.scenarioName, 'Tag: @smoke');
  assert.equal(session.status, 'passed');
  assert.equal(session.featurePath, '');
  assert.equal(session.featureAbsolutePath, undefined);
  assert.deepEqual(session.steps, []);
  assert.deepEqual(session.examples, []);
  assert.equal(session.exitCode, 0);
  assert.equal(session.durationMs, 1500);
});

test('buildFolderExecutionSession builds a session with folder label and no steps', () => {
  const folderContext = {
    workspaceRoot: '/workspace',
    executionRoot: '/workspace',
    pomPath: '/workspace/pom.xml',
    featurePath: 'src/test/resources/features/mobile',
    scenarioName: 'Folder: mobile',
    scenarioLineOneBased: 1,
    displayCommand: 'mvn test -Dcucumber.features=src/test/resources/features/mobile -e',
    startedAt: 200,
  };

  const session = buildFolderExecutionSession(
    folderContext,
    'mobile',
    'failed',
    [],
    'output text',
    1,
    2000
  );

  assert.equal(session.scenarioName, 'Folder: mobile');
  assert.equal(session.status, 'failed');
  assert.equal(session.featurePath, 'src/test/resources/features/mobile');
  assert.equal(session.featureAbsolutePath, undefined);
  assert.deepEqual(session.steps, []);
  assert.equal(session.exitCode, 1);
  assert.equal(session.durationMs, 2000);
});

test('ExecutionSessionStore.clear removes all sessions and notifies listeners', () => {
  const store = new ExecutionSessionStore();
  const events: string[] = [];
  const unsub = store.subscribe(() => events.push('notify'));

  store.setLatest(
    buildExecutionSession({ ...context, startedAt: 100 }, scenario, 'passed', [], '', undefined, 0, 1000)
  );
  store.clear();

  assert.equal(store.getLatest(), undefined);
  assert.equal(store.getSessions().length, 0);
  assert.ok(events.length >= 2);

  unsub();
});

test('ExecutionSessionStore.subscribe unsubscribe stops notifications', () => {
  const store = new ExecutionSessionStore();
  const events: string[] = [];
  const unsub = store.subscribe(() => events.push('notify'));

  store.setLatest(
    buildExecutionSession({ ...context, startedAt: 100 }, scenario, 'passed', [], '', undefined, 0, 1000)
  );
  unsub();
  store.setLatest(
    buildExecutionSession({ ...context, startedAt: 200 }, scenario, 'failed', [], '', undefined, 1, 1000)
  );

  assert.equal(events.length, 1);
});

test('formatExecutionSessionSummary renders a structured step list', () => {
  const session = buildExecutionSession(context, scenario, 'failed', [], '', undefined, 1, 1200);
  const lines = formatExecutionSessionSummary(session);

  assert.equal(lines[0], 'Execution Session');
  assert.equal(lines[1], 'Scenario Outline: Search document by stored number');
  assert.equal(lines[2], 'Status           : failed');
  assert.equal(lines[3], 'Examples:');
  assert.equal(lines[4], '- [pending] ios2 | validUser2');
});

test('buildExecutionSession prefers structured execution results when available', () => {
  const session = buildExecutionSession(
    context,
    scenario,
    'failed',
    [],
    '',
    {
      source: 'cucumber-json',
      scenarioName: scenario.name,
      steps: [
        {
          keyword: 'Before',
          text: 'Before hook',
          rawText: 'Before hook',
          status: 'passed',
          durationMs: 30,
          kind: 'before',
        },
        {
          keyword: 'Given',
          text: 'API user context is "<context>"',
          rawText: 'Given API user context is "<context>"',
          status: 'passed',
          durationMs: 120,
          lineZeroBased: 16,
          kind: 'step',
        },
        {
          keyword: 'When',
          text: 'click on alternative Belgenet URL option',
          rawText: 'When click on alternative Belgenet URL option',
          status: 'passed',
          durationMs: 320,
          lineZeroBased: 19,
          kind: 'step',
        },
        {
          keyword: 'Then',
          text: 'I should be logged in',
          rawText: 'Then I should be logged in',
          status: 'failed',
          durationMs: 900,
          lineZeroBased: 24,
          kind: 'step',
        },
        {
          keyword: 'After',
          text: 'After hook',
          rawText: 'After hook',
          status: 'passed',
          durationMs: 40,
          kind: 'after',
        },
      ],
    },
    1,
    1200
  );

  assert.equal(session.structuredResultSource, 'cucumber-json');
  assert.deepEqual(
    session.steps.map((step) => ({ status: step.status, durationMs: step.durationMs })),
    [
      { status: 'passed', durationMs: 120 },
      { status: 'passed', durationMs: 320 },
      { status: 'failed', durationMs: 900 },
    ]
  );
  assert.equal(session.beforeHooks.length, 1);
  assert.equal(session.afterHooks.length, 1);
  assert.equal(session.examples[0]?.status, 'failed');
});
