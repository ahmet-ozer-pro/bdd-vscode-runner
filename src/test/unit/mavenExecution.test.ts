import test from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  buildCucumberFeatureArg,
  findNearestMavenExecutionRoot,
  resolveMavenExecutable,
  resolveMavenExecutionRoot,
} from '../../core/mavenExecution';

function createTempWorkspace(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bdd-runner-'));
}

test('findNearestMavenExecutionRoot resolves workspace pom for standard layouts', () => {
  const workspaceRoot = createTempWorkspace();
  const featureDirectory = path.join(workspaceRoot, 'src', 'test', 'resources', 'features');
  const featurePath = path.join(featureDirectory, 'login.feature');

  fs.mkdirSync(featureDirectory, { recursive: true });
  fs.writeFileSync(path.join(workspaceRoot, 'pom.xml'), '<project />');
  fs.writeFileSync(featurePath, 'Feature: Login');

  assert.equal(findNearestMavenExecutionRoot(featurePath, workspaceRoot), workspaceRoot);
});

test('findNearestMavenExecutionRoot prefers the nearest pom for nested modules', () => {
  const workspaceRoot = createTempWorkspace();
  const moduleRoot = path.join(workspaceRoot, 'apps', 'payments');
  const featureDirectory = path.join(moduleRoot, 'src', 'test', 'resources', 'features');
  const featurePath = path.join(featureDirectory, 'checkout.feature');

  fs.mkdirSync(featureDirectory, { recursive: true });
  fs.writeFileSync(path.join(workspaceRoot, 'pom.xml'), '<project />');
  fs.writeFileSync(path.join(moduleRoot, 'pom.xml'), '<project />');
  fs.writeFileSync(featurePath, 'Feature: Checkout');

  assert.equal(findNearestMavenExecutionRoot(featurePath, workspaceRoot), moduleRoot);
});

test('findNearestMavenExecutionRoot returns undefined when no pom exists in the path to workspace root', () => {
  const workspaceRoot = createTempWorkspace();
  const featureDirectory = path.join(workspaceRoot, 'features');
  const featurePath = path.join(featureDirectory, 'orphan.feature');

  fs.mkdirSync(featureDirectory, { recursive: true });
  fs.writeFileSync(featurePath, 'Feature: Orphan');

  assert.equal(findNearestMavenExecutionRoot(featurePath, workspaceRoot), undefined);
});

test('resolveMavenExecutionRoot returns search metadata for diagnostics', () => {
  const workspaceRoot = createTempWorkspace();
  const moduleRoot = path.join(workspaceRoot, 'services', 'billing');
  const featureDirectory = path.join(moduleRoot, 'src', 'test', 'resources', 'features');
  const featurePath = path.join(featureDirectory, 'invoice.feature');

  fs.mkdirSync(featureDirectory, { recursive: true });
  fs.writeFileSync(path.join(moduleRoot, 'pom.xml'), '<project />');
  fs.writeFileSync(featurePath, 'Feature: Invoicing');

  const resolution = resolveMavenExecutionRoot(featurePath, workspaceRoot);

  assert.equal(resolution.executionRoot, moduleRoot);
  assert.equal(resolution.pomPath, path.join(moduleRoot, 'pom.xml'));
  assert.deepEqual(resolution.searchedDirectories, [featureDirectory, path.join(moduleRoot, 'src', 'test', 'resources'), path.join(moduleRoot, 'src', 'test'), path.join(moduleRoot, 'src'), moduleRoot]);
});

test('resolveMavenExecutionRoot returns searched directories when resolution fails', () => {
  const workspaceRoot = createTempWorkspace();
  const featureDirectory = path.join(workspaceRoot, 'apps', 'unknown', 'features');
  const featurePath = path.join(featureDirectory, 'missing.feature');

  fs.mkdirSync(featureDirectory, { recursive: true });
  fs.writeFileSync(featurePath, 'Feature: Missing root');

  const resolution = resolveMavenExecutionRoot(featurePath, workspaceRoot);

  assert.equal(resolution.executionRoot, undefined);
  assert.equal(resolution.pomPath, undefined);
  assert.deepEqual(resolution.searchedDirectories, [
    featureDirectory,
    path.join(workspaceRoot, 'apps', 'unknown'),
    path.join(workspaceRoot, 'apps'),
    workspaceRoot,
  ]);
});

test('resolveMavenExecutable returns configured executable when provided', () => {
  const executionRoot = createTempWorkspace();

  assert.equal(resolveMavenExecutable(executionRoot, '/opt/maven/bin/mvn'), '/opt/maven/bin/mvn');
});

test('resolveMavenExecutable returns mvnw when present', () => {
  const executionRoot = createTempWorkspace();
  const wrapperPath = path.join(executionRoot, 'mvnw');

  fs.writeFileSync(wrapperPath, '');

  assert.equal(resolveMavenExecutable(executionRoot, ''), wrapperPath);
});

test('resolveMavenExecutable returns mvnw.cmd when mvnw is absent and mvnw.cmd is present', () => {
  const executionRoot = createTempWorkspace();
  const wrapperPath = path.join(executionRoot, 'mvnw.cmd');

  fs.writeFileSync(wrapperPath, '');

  assert.equal(resolveMavenExecutable(executionRoot, ''), wrapperPath);
});

test('resolveMavenExecutable returns mvnw.cmd on Windows when present', () => {
  const executionRoot = createTempWorkspace();
  const wrapperPath = path.join(executionRoot, 'mvnw.cmd');
  fs.writeFileSync(wrapperPath, '');

  const result = resolveMavenExecutable(executionRoot, '');
  assert.equal(result, wrapperPath);
});

test('resolveMavenExecutable prefers mvnw over mvnw.cmd when both present', () => {
  const executionRoot = createTempWorkspace();
  fs.writeFileSync(path.join(executionRoot, 'mvnw'), '');
  fs.writeFileSync(path.join(executionRoot, 'mvnw.cmd'), '');

  const result = resolveMavenExecutable(executionRoot, '');
  assert.equal(result, path.join(executionRoot, 'mvnw'));
});

test('resolveMavenExecutable returns mvn when no Maven wrapper exists', () => {
  const executionRoot = createTempWorkspace();

  assert.equal(resolveMavenExecutable(executionRoot, ''), 'mvn');
});

test('buildCucumberFeatureArg returns a feature path relative to the execution root', () => {
  const executionRoot = '/workspace/service-a';
  const featurePath = '/workspace/service-a/src/test/resources/features/auth.feature';

  assert.equal(
    buildCucumberFeatureArg(executionRoot, featurePath, 12),
    'src/test/resources/features/auth.feature:12'
  );
});

test('buildCucumberFeatureArg returns relative path without line for folder-style arg', () => {
  const executionRoot = '/workspace/service-a';
  const folderPath = '/workspace/service-a/src/test/resources/features/mobile';

  assert.equal(
    buildCucumberFeatureArg(executionRoot, folderPath),
    'src/test/resources/features/mobile'
  );
});

test('buildCucumberFeatureArg rejects path equal to execution root', () => {
  assert.throws(
    () => buildCucumberFeatureArg('/workspace', '/workspace'),
    /Feature path is not located under the Maven execution root\./
  );
});

test('buildCucumberFeatureArg rejects feature paths outside the execution root', () => {
  assert.throws(
    () => buildCucumberFeatureArg('/workspace/service-a', '/workspace/service-b/auth.feature', 7),
    /Feature path is not located under the Maven execution root\./
  );
});
