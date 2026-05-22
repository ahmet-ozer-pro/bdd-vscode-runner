import test from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildExecutionDetailDocument } from '../../core/executionDetails';
import { ExecutionSession } from '../../core/executionSession';

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
    '14:21:28.969 [main] INFO com.turksat.testplatform.bdd.hooks.TestHooks -- Scenario : Search document by stored number with different contexts',
    '14:21:28.969 [main] INFO com.turksat.testplatform.bdd.hooks.TestHooks -- API test environment ready',
    'Given API user context is "<context>"',
    'And I click login button',
    'Then I should be logged in',
    'org.opentest4j.AssertionFailedError: User should be logged in ==> expected: <true> but was: <false>',
    'at com.turksat.testplatform.bdd.steps.common.LoginSteps.shouldBeLoggedIn(LoginSteps.java:135)',
  ].join('\n'),
  scenarioName: 'Search document by stored number with different contexts',
  scenarioLineOneBased: 16,
  keyword: 'Scenario Outline',
  status: 'failed',
  exitCode: 1,
  durationMs: 120000,
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
      text: 'com.turksat.testplatform.bdd.hooks.TestHooks.setupApiTest(io.cucumber.java.Scenario)',
      status: 'passed',
      durationMs: 405000,
    },
  ],
  steps: [
    {
      keyword: 'Given',
      text: 'API user context is "<context>"',
      rawText: 'Given API user context is "<context>"',
      line: 16,
      status: 'passed',
      durationMs: 10,
    },
    {
      keyword: 'Then',
      text: 'I should be logged in',
      rawText: 'Then I should be logged in',
      line: 24,
      status: 'failed',
      durationMs: 82180,
    },
  ],
  afterHooks: [],
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

test('buildExecutionDetailDocument renders step-specific detail and relevant output', () => {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bdd-execution-details-'));
  const stepsPath = path.join(
    workspaceRoot,
    'src',
    'test',
    'java',
    'com',
    'turksat',
    'testplatform',
    'bdd',
    'steps',
    'common',
    'LoginSteps.java'
  );
  fs.mkdirSync(path.dirname(stepsPath), { recursive: true });
  fs.writeFileSync(stepsPath, 'class LoginSteps {}');

  const correlatedSession: ExecutionSession = {
    ...session,
    workspaceRoot,
    executionRoot: workspaceRoot,
    pomPath: path.join(workspaceRoot, 'pom.xml'),
  };

  const detail = buildExecutionDetailDocument(correlatedSession, {
    kind: 'step',
    step: correlatedSession.steps[1],
  });

  assert.equal(detail.title, 'BDD Runner Step - Then I should be logged in');
  assert.match(detail.content, /Selection/);
  assert.match(detail.content, /Step\s+: Then I should be logged in/);
  assert.match(detail.content, /Started/);
  assert.match(detail.content, /Relevant Output/);
  assert.match(detail.content, /Then I should be logged in/);
  assert.match(detail.content, /AssertionFailedError/);
  assert.match(detail.content, /Step Definition/);
  assert.match(detail.content, /LoginSteps\.shouldBeLoggedIn/);
  assert.match(detail.content, /Expected\s+: true/);
  assert.match(detail.content, /Actual\s+: false/);
});

test('buildExecutionDetailDocument renders assertion values in a dedicated block', () => {
  const detail = buildExecutionDetailDocument(session, {
    kind: 'step',
    step: session.steps[1],
  });

  assert.match(detail.content, /--- Assertion/);
  assert.match(detail.content, /Expected : true/);
  assert.match(detail.content, /Actual\s+: false/);
});

test('buildExecutionDetailDocument renders hook-specific detail and hook output excerpt', () => {
  const detail = buildExecutionDetailDocument(session, {
    kind: 'hook',
    hook: session.beforeHooks[0],
  });

  assert.equal(
    detail.title,
    'BDD Runner Before Hook - com.turksat.testplatform.bdd.hooks.TestHooks.setupApiTest(io.cucumber.java.Scenario)'
  );
  assert.match(detail.content, /Before Hook/);
  assert.match(detail.content, /setupApiTest/);
  assert.match(detail.content, /TestHooks/);
});

test('buildExecutionDetailDocument falls back gracefully when no direct output match exists', () => {
  const detail = buildExecutionDetailDocument(session, {
    kind: 'example',
    example: {
      line: 30,
      values: ['android', 'ghost-user'],
      status: 'failed',
    },
  });

  assert.match(detail.content, /No direct output match was found|Relevant Output/);
});
