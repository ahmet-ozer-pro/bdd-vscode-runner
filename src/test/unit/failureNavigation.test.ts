import test from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  collectFailureAnalysisText,
  createScenarioFailureTarget,
  extractFailureNavigationTargets,
  normalizeFailureTargets,
} from '../../core/failureNavigation';

test('extractFailureNavigationTargets finds absolute and relative file references', () => {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bdd-failure-nav-'));
  const featurePath = path.join(workspaceRoot, 'src', 'test', 'resources', 'features', 'auth', 'login.feature');
  const stepsPath = path.join(workspaceRoot, 'src', 'test', 'java', 'com', 'example', 'AuthSteps.java');

  fs.mkdirSync(path.dirname(featurePath), { recursive: true });
  fs.mkdirSync(path.dirname(stepsPath), { recursive: true });
  fs.writeFileSync(featurePath, 'Feature: Login');
  fs.writeFileSync(stepsPath, 'class AuthSteps {}');

  const targets = extractFailureNavigationTargets(
    [
      `at ${featurePath}:12`,
      '[ERROR] src/test/java/com/example/AuthSteps.java:48 some message',
    ].join('\n'),
    workspaceRoot,
    workspaceRoot
  );

  assert.deepEqual(
    targets.map((target) => ({
      path: target.filePath,
      line: target.lineZeroBased,
      label: target.label,
      source: target.source,
    })),
    [
      {
        path: stepsPath,
        line: 47,
        label: 'AuthSteps.java:48',
        source: 'output',
      },
      {
        path: featurePath,
        line: 11,
        label: 'login.feature:12',
        source: 'output',
      },
    ]
  );
});

test('extractFailureNavigationTargets prefers step-level feature targets from file URIs', () => {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bdd-failure-nav-'));
  const featurePath = path.join(workspaceRoot, 'src', 'test', 'resources', 'features', 'mobile', '001_login.feature');
  const stepsPath = path.join(workspaceRoot, 'LoginSteps.java');

  fs.mkdirSync(path.dirname(featurePath), { recursive: true });
  fs.writeFileSync(featurePath, 'Feature: Login');
  fs.writeFileSync(stepsPath, 'class LoginSteps {}');

  const targets = extractFailureNavigationTargets(
    [
      'Then error message is displayed',
      `at *.error message is displayed(file://${featurePath}:45)`,
      'at com.example.LoginSteps.errorMessageIsDisplayed(LoginSteps.java:147)',
    ].join('\n'),
    workspaceRoot,
    workspaceRoot
  );

  assert.deepEqual(
    targets.map((target) => ({
      path: target.filePath,
      line: target.lineZeroBased,
      label: target.label,
      source: target.source,
    })),
    [
      {
        path: featurePath,
        line: 44,
        label: 'error message is displayed -> 001_login.feature:45',
        source: 'step',
      },
      {
        path: stepsPath,
        line: 146,
        label: 'LoginSteps.java:147',
        source: 'output',
      },
    ]
  );
});

test('extractFailureNavigationTargets resolves basename-only project java files and prioritizes them before feature fallback', () => {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bdd-failure-nav-'));
  const featurePath = path.join(workspaceRoot, 'src', 'test', 'resources', 'features', 'mobile', 'test.feature');
  const stepPath = path.join(
    workspaceRoot,
    'src',
    'test',
    'java',
    'com',
    'example',
    'steps',
    'LoginSteps.java'
  );
  const pagePath = path.join(
    workspaceRoot,
    'src',
    'test',
    'java',
    'com',
    'example',
    'pages',
    'LoginPage.java'
  );

  fs.mkdirSync(path.dirname(featurePath), { recursive: true });
  fs.mkdirSync(path.dirname(stepPath), { recursive: true });
  fs.mkdirSync(path.dirname(pagePath), { recursive: true });
  fs.writeFileSync(featurePath, 'Feature: Smoke');
  fs.writeFileSync(stepPath, 'class LoginSteps {}');
  fs.writeFileSync(pagePath, 'class LoginPage {}');

  const targets = extractFailureNavigationTargets(
    [
      `at ${featurePath}:28`,
      'at com.example.steps.LoginSteps.errorMessageIsDisplayed(LoginSteps.java:147)',
      'at com.example.pages.LoginPage.assertError(LoginPage.java:63)',
    ].join('\n'),
    workspaceRoot,
    workspaceRoot
  );

  assert.deepEqual(
    targets.map((target) => ({
      path: target.filePath,
      line: target.lineZeroBased,
      label: target.label,
      source: target.source,
    })),
    [
      {
        path: stepPath,
        line: 146,
        label: 'LoginSteps.java:147',
        source: 'output',
      },
      {
        path: pagePath,
        line: 62,
        label: 'LoginPage.java:63',
        source: 'output',
      },
      {
        path: featurePath,
        line: 27,
        label: 'test.feature:28',
        source: 'output',
      },
    ]
  );
});

test('extractFailureNavigationTargets uses qualified class names to disambiguate duplicate project java files', () => {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bdd-failure-nav-'));
  const featurePath = path.join(workspaceRoot, 'src', 'test', 'resources', 'features', 'mobile', 'test.feature');
  const mobileStepsPath = path.join(
    workspaceRoot,
    'src',
    'test',
    'java',
    'com',
    'example',
    'mobile',
    'steps',
    'LoginSteps.java'
  );
  const webStepsPath = path.join(
    workspaceRoot,
    'src',
    'test',
    'java',
    'com',
    'example',
    'web',
    'steps',
    'LoginSteps.java'
  );

  fs.mkdirSync(path.dirname(featurePath), { recursive: true });
  fs.mkdirSync(path.dirname(mobileStepsPath), { recursive: true });
  fs.mkdirSync(path.dirname(webStepsPath), { recursive: true });
  fs.writeFileSync(featurePath, 'Feature: Smoke');
  fs.writeFileSync(mobileStepsPath, 'class LoginSteps {}');
  fs.writeFileSync(webStepsPath, 'class LoginSteps {}');

  const targets = extractFailureNavigationTargets(
    [
      `at ${featurePath}:28`,
      'at com.example.mobile.steps.LoginSteps.errorMessageIsDisplayed(LoginSteps.java:147)',
    ].join('\n'),
    workspaceRoot,
    workspaceRoot
  );

  assert.deepEqual(
    targets.map((target) => ({
      path: target.filePath,
      line: target.lineZeroBased,
      label: target.label,
      source: target.source,
    })),
    [
      {
        path: mobileStepsPath,
        line: 146,
        label: 'LoginSteps.java:147',
        source: 'output',
      },
      {
        path: featurePath,
        line: 27,
        label: 'test.feature:28',
        source: 'output',
      },
    ]
  );
});

test('extractFailureNavigationTargets filters nonexistent framework files when workspace targets exist', () => {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bdd-failure-nav-'));
  const featurePath = path.join(workspaceRoot, 'src', 'test', 'resources', 'features', 'mobile', 'test.feature');

  fs.mkdirSync(path.dirname(featurePath), { recursive: true });
  fs.writeFileSync(featurePath, 'Feature: Smoke');

  const targets = extractFailureNavigationTargets(
    [
      `at ${featurePath}:28`,
      'at AssertionFailureBuilder.java:151',
      'at AssertTrue.java:63',
    ].join('\n'),
    workspaceRoot,
    workspaceRoot
  );

  assert.deepEqual(
    targets.map((target) => ({
      path: target.filePath,
      line: target.lineZeroBased,
      label: target.label,
      source: target.source,
    })),
    [
      {
        path: featurePath,
        line: 27,
        label: 'test.feature:28',
        source: 'output',
      },
    ]
  );
});

test('collectFailureAnalysisText includes surefire reports when console output is insufficient', () => {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bdd-failure-nav-'));
  const executionRoot = workspaceRoot;
  const reportsPath = path.join(executionRoot, 'target', 'surefire-reports');
  const featurePath = path.join(workspaceRoot, 'src', 'test', 'resources', 'features', 'mobile', 'test.feature');
  const stepPath = path.join(
    workspaceRoot,
    'src',
    'test',
    'java',
    'com',
    'example',
    'steps',
    'LoginSteps.java'
  );

  fs.mkdirSync(path.dirname(featurePath), { recursive: true });
  fs.mkdirSync(path.dirname(stepPath), { recursive: true });
  fs.mkdirSync(reportsPath, { recursive: true });
  fs.writeFileSync(featurePath, 'Feature: Smoke');
  fs.writeFileSync(stepPath, 'class LoginSteps {}');
  fs.writeFileSync(
    path.join(reportsPath, 'com.example.SmokeTest.txt'),
    'at com.example.steps.LoginSteps.errorMessageIsDisplayed(LoginSteps.java:147)'
  );

  const analysisText = collectFailureAnalysisText(`at ${featurePath}:28`, executionRoot);
  const targets = extractFailureNavigationTargets(analysisText, workspaceRoot, executionRoot);

  assert.deepEqual(
    targets.map((target) => ({
      path: target.filePath,
      line: target.lineZeroBased,
      label: target.label,
      source: target.source,
    })),
    [
      {
        path: stepPath,
        line: 146,
        label: 'LoginSteps.java:147',
        source: 'output',
      },
      {
        path: featurePath,
        line: 27,
        label: 'test.feature:28',
        source: 'output',
      },
    ]
  );
});

test('normalizeFailureTargets removes redundant feature output entries when a step target already exists', () => {
  const normalized = normalizeFailureTargets([
    {
      filePath: '/workspace/test.feature',
      lineZeroBased: 23,
      label: 'Then I should be logged in -> test.feature:24',
      source: 'step',
    },
    {
      filePath: '/workspace/LoginSteps.java',
      lineZeroBased: 134,
      label: 'LoginSteps.shouldBeLoggedIn -> LoginSteps.java:135',
      source: 'java',
    },
    {
      filePath: '/workspace/test.feature',
      lineZeroBased: 27,
      label: 'test.feature:28',
      source: 'output',
    },
    {
      filePath: '/workspace/test.feature',
      lineZeroBased: 15,
      label: 'test.feature:16',
      source: 'output',
    },
  ]);

  assert.deepEqual(
    normalized.map((target) => ({
      label: target.label,
      source: target.source,
    })),
    [
      {
        label: 'Then I should be logged in -> test.feature:24',
        source: 'step',
      },
      {
        label: 'LoginSteps.shouldBeLoggedIn -> LoginSteps.java:135',
        source: 'java',
      },
    ]
  );
});

test('createScenarioFailureTarget creates a fallback scenario target', () => {
  const target = createScenarioFailureTarget(
    '/workspace/app/src/test/resources/features/auth/login.feature',
    9,
    'Login fails'
  );

  assert.equal(target.filePath, '/workspace/app/src/test/resources/features/auth/login.feature');
  assert.equal(target.lineZeroBased, 9);
  assert.equal(target.label, 'Login fails');
  assert.equal(target.source, 'scenario');
});
