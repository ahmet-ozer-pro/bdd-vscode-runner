import test from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildFailureDetailTargets, extractFailureDetails } from '../../core/failureDetails';

test('extractFailureDetails parses assertion details and correlates project stack frames', () => {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bdd-failure-details-'));
  const executionRoot = workspaceRoot;
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
  const pagePath = path.join(
    workspaceRoot,
    'src',
    'test',
    'java',
    'com',
    'turksat',
    'testplatform',
    'pages',
    'mobile',
    'MobileLoginPage.java'
  );

  fs.mkdirSync(path.dirname(stepsPath), { recursive: true });
  fs.mkdirSync(path.dirname(pagePath), { recursive: true });
  fs.writeFileSync(stepsPath, 'class LoginSteps {}');
  fs.writeFileSync(
    pagePath,
    [
      'class MobileLoginPage {',
      '  public boolean isLoggedIn(boolean loginButtonVisible, boolean errorMessageVisible) {',
      '    logger.debug("Login button still visible: {}, Error message visible: {}", loginButtonVisible, errorMessageVisible);',
      '    return !loginButtonVisible && !errorMessageVisible;',
      '  }',
      '}',
    ].join('\n')
  );

  const details = extractFailureDetails(
    [
      'Then I should be logged in',
      'org.opentest4j.AssertionFailedError: User should be logged in ==> expected: <true> but was: <false>',
      'at org.junit.jupiter.api.Assertions.assertTrue(Assertions.java:214)',
      'at com.turksat.testplatform.pages.mobile.MobileLoginPage.isLoggedIn(MobileLoginPage.java:52)',
      'at com.turksat.testplatform.bdd.steps.common.LoginSteps.shouldBeLoggedIn(LoginSteps.java:135)',
      'Step failed',
      'Expected :true',
      'Actual   :false',
    ].join('\n'),
    workspaceRoot,
    executionRoot
  );

  assert.equal(details.exceptionType, 'org.opentest4j.AssertionFailedError');
  assert.match(details.message ?? '', /User should be logged in/);
  assert.equal(details.expected, 'true');
  assert.equal(details.actual, 'false');
  assert.equal(details.stepDefinition?.qualifiedClassName, 'com.turksat.testplatform.bdd.steps.common.LoginSteps');
  assert.equal(details.stepDefinition?.methodName, 'shouldBeLoggedIn');
  assert.equal(details.relatedProjectFrames[0]?.filePath, stepsPath);
  assert.equal(details.relatedProjectFrames[1]?.filePath, pagePath);

  const targets = buildFailureDetailTargets(details);
  assert.deepEqual(
    targets.map((target) => ({
      path: target.filePath,
      line: target.lineZeroBased,
      source: target.source,
      label: target.label,
    })),
    [
      {
        path: stepsPath,
        line: 134,
        source: 'java',
        label: 'com.turksat.testplatform.bdd.steps.common.LoginSteps.shouldBeLoggedIn -> LoginSteps.java:135',
      },
      {
        path: pagePath,
        line: 51,
        source: 'java',
        label: 'com.turksat.testplatform.pages.mobile.MobileLoginPage.isLoggedIn -> MobileLoginPage.java:52',
      },
    ]
  );
});

test('extractFailureDetails enriches related frames with nearby project log classes', () => {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bdd-failure-details-'));
  const executionRoot = workspaceRoot;
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
  const pagePath = path.join(
    workspaceRoot,
    'src',
    'test',
    'java',
    'com',
    'turksat',
    'testplatform',
    'pages',
    'mobile',
    'MobileLoginPage.java'
  );

  fs.mkdirSync(path.dirname(stepsPath), { recursive: true });
  fs.mkdirSync(path.dirname(pagePath), { recursive: true });
  fs.writeFileSync(stepsPath, 'class LoginSteps {}');
  fs.writeFileSync(
    pagePath,
    [
      'class MobileLoginPage {',
      '  public boolean isLoggedIn(boolean loginButtonVisible, boolean errorMessageVisible) {',
      '    logger.debug("Login button still visible: {}, Error message visible: {}", loginButtonVisible, errorMessageVisible);',
      '    return !loginButtonVisible && !errorMessageVisible;',
      '  }',
      '}',
    ].join('\n')
  );

  const details = extractFailureDetails(
    [
      '15:10:46.310 [main] DEBUG com.turksat.testplatform.pages.mobile.MobileLoginPage -- Login button still visible: true, Error message visible: false',
      'Then I should be logged in                                                                                                           # com.turksat.testplatform.bdd.steps.common.LoginSteps.shouldBeLoggedIn()',
      'org.opentest4j.AssertionFailedError: User should be logged in ==> expected: <true> but was: <false>',
      'at com.turksat.testplatform.bdd.steps.common.LoginSteps.shouldBeLoggedIn(LoginSteps.java:135)',
    ].join('\n'),
    workspaceRoot,
    executionRoot
  );

  assert.ok(
    details.relatedProjectFrames.some((frame) =>
      frame.qualifiedClassName === 'com.turksat.testplatform.pages.mobile.MobileLoginPage' &&
      frame.filePath === pagePath &&
      frame.lineOneBased === 3 &&
      frame.methodName === 'isLoggedIn'
    )
  );
});
