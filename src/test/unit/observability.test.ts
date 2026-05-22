import test from 'node:test';
import * as assert from 'node:assert/strict';
import { ExecutionHistory, formatExecutionSummary, getStatusBarText } from '../../core/observability';

test('ExecutionHistory stores the latest running and completed record', () => {
  const history = new ExecutionHistory();
  const started = history.start(
    {
      workspaceRoot: '/workspace',
      executionRoot: '/workspace/service-a',
      pomPath: '/workspace/service-a/pom.xml',
      featurePath: 'src/test/resources/features/auth.feature',
      scenarioName: 'Login succeeds',
      scenarioLineOneBased: 8,
      displayCommand: 'mvn test -Dcucumber.features=src/test/resources/features/auth.feature:8 -e',
    },
    100
  );

  assert.equal(started.status, 'running');
  assert.equal(getStatusBarText(history.getLatest()), 'BDD Runner: Running Login succeeds');

  const finished = history.finish('passed', 0, 3200);

  assert.equal(finished?.status, 'passed');
  assert.equal(finished?.exitCode, 0);
  assert.equal(finished?.durationMs, 3200);
  assert.equal(getStatusBarText(history.getLatest()), 'BDD Runner: Passed Login succeeds');
});

test('formatExecutionSummary creates structured summary lines', () => {
  const lines = formatExecutionSummary({
    workspaceRoot: '/workspace',
    executionRoot: '/workspace/service-a',
    pomPath: '/workspace/service-a/pom.xml',
    featurePath: 'src/test/resources/features/auth.feature',
    scenarioName: 'Login succeeds',
    scenarioLineOneBased: 8,
    displayCommand: 'mvn test -Dcucumber.features=src/test/resources/features/auth.feature:8 -e',
    startedAt: 100,
    durationMs: 3200,
    exitCode: 0,
    status: 'passed',
  });

  assert.deepEqual(lines, [
    'Execution Summary',
    'Status    : passed',
    'Scenario  : Login succeeds',
    'Line      : 8',
    'Feature   : src/test/resources/features/auth.feature',
    'Execution : /workspace/service-a',
    'POM       : /workspace/service-a/pom.xml',
    'Command   : mvn test -Dcucumber.features=src/test/resources/features/auth.feature:8 -e',
    'Exit Code : 0',
    'Duration  : 3.20s',
  ]);
});
