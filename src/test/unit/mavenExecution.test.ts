import test from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  buildCucumberFeatureArg,
  findNearestMavenExecutionRoot,
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

test('buildCucumberFeatureArg returns a feature path relative to the execution root', () => {
  const executionRoot = '/workspace/service-a';
  const featurePath = '/workspace/service-a/src/test/resources/features/auth.feature';

  assert.equal(
    buildCucumberFeatureArg(executionRoot, featurePath, 12),
    'src/test/resources/features/auth.feature:12'
  );
});

test('buildCucumberFeatureArg rejects feature paths outside the execution root', () => {
  assert.throws(
    () => buildCucumberFeatureArg('/workspace/service-a', '/workspace/service-b/auth.feature', 7),
    /Feature path is not located under the Maven execution root\./
  );
});
