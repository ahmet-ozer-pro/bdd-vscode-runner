import test from 'node:test';
import * as assert from 'node:assert/strict';
import { buildExecutionPanelSnapshot } from '../../core/executionPanelModel';
import { ExecutionSession } from '../../core/executionSession';

test('buildExecutionPanelSnapshot returns idle roots when no session exists', () => {
  const snapshot = buildExecutionPanelSnapshot(undefined);

  assert.deepEqual(snapshot.rootKinds, ['empty', 'output']);
  assert.equal(snapshot.sessionCount, 0);
  assert.deepEqual(snapshot.sessionGroupKinds, []);
});

test('buildExecutionPanelSnapshot includes examples, hooks, steps, and failure groups for a rich session', () => {
  const session: ExecutionSession = {
    runId: 'run-1',
    startedAt: Date.UTC(2026, 4, 21, 10, 38, 20),
    featureName: 'Extension Smoke Test Document Search',
    workspaceRoot: '/workspace',
    executionRoot: '/workspace',
    pomPath: '/workspace/pom.xml',
    displayCommand: 'mvn test -Dcucumber.features=src/test/resources/features/mobile/test.feature:16 -e',
    featurePath: 'src/test/resources/features/mobile/test.feature',
    featureAbsolutePath: '/workspace/src/test/resources/features/mobile/test.feature',
    outputText: [
      'INFO TestHooks -- Scenario started',
      'Given API user context is "ios2"',
      'Then I should be logged in',
    ].join('\n'),
    scenarioName: 'Search document by stored number with different contexts',
    scenarioLineOneBased: 16,
    keyword: 'Scenario Outline',
    status: 'failed',
    exitCode: 1,
    durationMs: 126000,
    examples: [
      {
        line: 27,
        values: ['ios2', 'validUser5'],
        status: 'failed',
      },
    ],
    beforeHooks: [
      {
        kind: 'before',
        text: 'Before hook',
        status: 'passed',
        durationMs: 20,
      },
    ],
    steps: [
      {
        keyword: 'Given',
        text: 'API user context is "<context>"',
        rawText: 'Given API user context is "<context>"',
        line: 16,
        status: 'passed',
        durationMs: 100,
      },
      {
        keyword: 'Then',
        text: 'I should be logged in',
        rawText: 'Then I should be logged in',
        line: 24,
        status: 'failed',
        durationMs: 82000,
      },
    ],
    afterHooks: [
      {
        kind: 'after',
        text: 'After hook',
        status: 'passed',
        durationMs: 30,
      },
    ],
    failureTargets: [
      {
        filePath: '/workspace/src/test/resources/features/mobile/test.feature',
        lineZeroBased: 24,
        label: 'Then I should be logged in -> test.feature:25',
        source: 'step',
      },
    ],
    structuredResultSource: 'cucumber-json',
  };

  const snapshot = buildExecutionPanelSnapshot(session);

  assert.deepEqual(snapshot.rootKinds, ['session', 'output']);
  assert.equal(snapshot.sessionCount, 1);
  assert.deepEqual(snapshot.sessionGroupKinds, ['examples', 'before-hooks', 'steps', 'after-hooks']);
  assert.deepEqual(snapshot.failureTargetLabels, ['Then I should be logged in -> test.feature:25']);
});

test('buildExecutionPanelSnapshot supports multiple sessions in root history', () => {
  const baseSession: ExecutionSession = {
    runId: 'run-1',
    startedAt: Date.UTC(2026, 4, 21, 10, 38, 20),
    workspaceRoot: '/workspace',
    executionRoot: '/workspace',
    pomPath: '/workspace/pom.xml',
    displayCommand: 'mvn test -Dcucumber.features=src/test/resources/features/mobile/test.feature:16 -e',
    featurePath: 'src/test/resources/features/mobile/test.feature',
    featureAbsolutePath: '/workspace/src/test/resources/features/mobile/test.feature',
    outputText: 'Then I should be logged in',
    scenarioName: 'Latest run',
    scenarioLineOneBased: 16,
    keyword: 'Scenario',
    status: 'failed',
    examples: [],
    beforeHooks: [],
    steps: [],
    afterHooks: [],
    failureTargets: [],
  };

  const olderSession: ExecutionSession = {
    ...baseSession,
    runId: 'run-0',
    scenarioName: 'Older run',
    status: 'passed',
  };

  const snapshot = buildExecutionPanelSnapshot([baseSession, olderSession]);

  assert.deepEqual(snapshot.rootKinds, ['session', 'session', 'output']);
  assert.equal(snapshot.sessionCount, 2);
});

test('buildExecutionPanelSnapshot filters to failed sessions only', () => {
  const makeSession = (runId: string, status: ExecutionSession['status']): ExecutionSession => ({
    runId,
    startedAt: 100,
    workspaceRoot: '/workspace',
    executionRoot: '/workspace',
    pomPath: '/workspace/pom.xml',
    displayCommand: 'mvn test',
    featurePath: 'test.feature',
    outputText: '',
    scenarioName: 'Test',
    scenarioLineOneBased: 1,
    keyword: 'Scenario',
    status,
    examples: [],
    beforeHooks: [],
    steps: [],
    afterHooks: [],
    failureTargets: [],
  });

  const sessions = [
    makeSession('run-1', 'failed'),
    makeSession('run-2', 'passed'),
    makeSession('run-3', 'failed'),
  ];

  const failedOnly = sessions.filter((session) => session.status === 'failed');
  const snapshot = buildExecutionPanelSnapshot(failedOnly);

  assert.equal(snapshot.sessionCount, 2);
  assert.deepEqual(snapshot.rootKinds, ['session', 'session', 'output']);
});

test('buildExecutionPanelSnapshot returns only output node when filtered list is empty', () => {
  const snapshot = buildExecutionPanelSnapshot([]);

  assert.deepEqual(snapshot.rootKinds, ['empty', 'output']);
  assert.equal(snapshot.sessionCount, 0);
});

test('buildExecutionPanelSnapshot groups multiple sessions under feature names', () => {
  const makeSession = (
    runId: string,
    featureName: string,
    status: ExecutionSession['status']
  ): ExecutionSession => ({
    runId,
    startedAt: 100,
    workspaceRoot: '/workspace',
    executionRoot: '/workspace',
    pomPath: '/workspace/pom.xml',
    displayCommand: 'mvn test',
    featurePath: 'test.feature',
    featureName,
    outputText: '',
    scenarioName: 'Test',
    scenarioLineOneBased: 1,
    keyword: 'Scenario' as const,
    status,
    examples: [],
    beforeHooks: [],
    steps: [],
    afterHooks: [],
    failureTargets: [],
  });

  const sessions = [
    makeSession('run-1', 'Login Feature', 'passed'),
    makeSession('run-2', 'Login Feature', 'failed'),
    makeSession('run-3', 'Search Feature', 'passed'),
  ];

  const snapshot = buildExecutionPanelSnapshot(sessions);
  assert.equal(snapshot.sessionCount, 3);
  assert.deepEqual(snapshot.rootKinds, ['session', 'session', 'session', 'output']);
});

test('buildExecutionPanelSnapshot single feature shows flat session list', () => {
  const makeSession = (runId: string): ExecutionSession => ({
    runId,
    startedAt: 100,
    workspaceRoot: '/workspace',
    executionRoot: '/workspace',
    pomPath: '/workspace/pom.xml',
    displayCommand: 'mvn test',
    featurePath: 'login.feature',
    featureName: 'Login Feature',
    outputText: '',
    scenarioName: 'Test',
    scenarioLineOneBased: 1,
    keyword: 'Scenario' as const,
    status: 'passed',
    examples: [],
    beforeHooks: [],
    steps: [],
    afterHooks: [],
    failureTargets: [],
  });

  const sessions = [makeSession('run-1'), makeSession('run-2')];
  const snapshot = buildExecutionPanelSnapshot(sessions);

  assert.equal(snapshot.sessionCount, 2);
  assert.deepEqual(snapshot.rootKinds, ['session', 'session', 'output']);
});
