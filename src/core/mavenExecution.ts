import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Maven execution root resolution details.
 */
export interface MavenExecutionResolution {
  executionRoot?: string;
  pomPath?: string;
  searchedDirectories: string[];
}

/**
 * Resolves the nearest Maven execution root for a feature path.
 * @param absoluteFeaturePath Absolute feature or target path used as the search origin.
 * @param workspaceRoot Absolute VS Code workspace root.
 * @returns Maven root, pom path, and searched directories.
 */
export function resolveMavenExecutionRoot(
  absoluteFeaturePath: string,
  workspaceRoot: string
): MavenExecutionResolution {
  const resolvedFeaturePath = path.resolve(absoluteFeaturePath);
  const resolvedWorkspaceRoot = path.resolve(workspaceRoot);
  const searchedDirectories: string[] = [];
  let currentDirectory = path.dirname(resolvedFeaturePath);

  if (!isWithinRoot(currentDirectory, resolvedWorkspaceRoot)) {
    return { searchedDirectories };
  }

  while (true) {
    searchedDirectories.push(currentDirectory);

    const pomPath = path.join(currentDirectory, 'pom.xml');
    if (fs.existsSync(pomPath)) {
      return {
        executionRoot: currentDirectory,
        pomPath,
        searchedDirectories,
      };
    }

    if (currentDirectory === resolvedWorkspaceRoot) {
      return { searchedDirectories };
    }

    const parentDirectory = path.dirname(currentDirectory);

    if (parentDirectory === currentDirectory || !isWithinRoot(parentDirectory, resolvedWorkspaceRoot)) {
      return { searchedDirectories };
    }

    currentDirectory = parentDirectory;
  }
}

/**
 * Finds the nearest Maven execution root for a feature path.
 * @param absoluteFeaturePath Absolute feature or target path used as the search origin.
 * @param workspaceRoot Absolute VS Code workspace root.
 * @returns Maven execution root when a pom.xml is found.
 */
export function findNearestMavenExecutionRoot(
  absoluteFeaturePath: string,
  workspaceRoot: string
): string | undefined {
  return resolveMavenExecutionRoot(absoluteFeaturePath, workspaceRoot).executionRoot;
}

/**
 * Resolves the Maven executable to invoke.
 * @param executionRoot Resolved Maven execution root.
 * @param configuredExecutable Optional user-configured Maven executable.
 * @returns Configured executable, project wrapper, or Maven command fallback.
 */
export function resolveMavenExecutable(executionRoot: string, configuredExecutable: string): string {
  if (configuredExecutable.trim().length > 0) {
    return configuredExecutable;
  }

  if (process.platform === 'win32') {
    const windowsWrapperPath = path.join(executionRoot, 'mvnw.cmd');
    if (fs.existsSync(windowsWrapperPath)) {
      return windowsWrapperPath;
    }

    return 'mvn.cmd';
  }

  const unixWrapperPath = path.join(executionRoot, 'mvnw');
  if (fs.existsSync(unixWrapperPath)) {
    return unixWrapperPath;
  }

  const windowsWrapperPath = path.join(executionRoot, 'mvnw.cmd');
  if (fs.existsSync(windowsWrapperPath)) {
    return windowsWrapperPath;
  }

  return 'mvn';
}

/**
 * Builds a Cucumber feature argument relative to the Maven execution root.
 * @param executionRoot Resolved Maven execution root.
 * @param absoluteFeaturePath Absolute feature file or folder path.
 * @param scenarioLineOneBased Optional one-based scenario or example line.
 * @returns Relative Cucumber feature argument.
 */
export function buildCucumberFeatureArg(
  executionRoot: string,
  absoluteFeaturePath: string,
  scenarioLineOneBased?: number
): string {
  const relativeFeaturePath = path.relative(executionRoot, absoluteFeaturePath);

  if (
    relativeFeaturePath.startsWith('..') ||
    path.isAbsolute(relativeFeaturePath) ||
    relativeFeaturePath.length === 0
  ) {
    throw new Error('Feature path is not located under the Maven execution root.');
  }

  if (scenarioLineOneBased === undefined) {
    return relativeFeaturePath;
  }

  return `${relativeFeaturePath}:${scenarioLineOneBased}`;
}

function isWithinRoot(targetPath: string, rootPath: string): boolean {
  const relativePath = path.relative(rootPath, targetPath);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}
