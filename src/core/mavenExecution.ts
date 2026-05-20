import * as fs from 'node:fs';
import * as path from 'node:path';

export interface MavenExecutionResolution {
  executionRoot?: string;
  pomPath?: string;
  searchedDirectories: string[];
}

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

export function findNearestMavenExecutionRoot(
  absoluteFeaturePath: string,
  workspaceRoot: string
): string | undefined {
  return resolveMavenExecutionRoot(absoluteFeaturePath, workspaceRoot).executionRoot;
}

export function buildCucumberFeatureArg(
  executionRoot: string,
  absoluteFeaturePath: string,
  scenarioLineOneBased: number
): string {
  const relativeFeaturePath = path.relative(executionRoot, absoluteFeaturePath);

  if (
    relativeFeaturePath.startsWith('..') ||
    path.isAbsolute(relativeFeaturePath) ||
    relativeFeaturePath.length === 0
  ) {
    throw new Error('Feature path is not located under the Maven execution root.');
  }

  return `${relativeFeaturePath}:${scenarioLineOneBased}`;
}

function isWithinRoot(targetPath: string, rootPath: string): boolean {
  const relativePath = path.relative(rootPath, targetPath);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}
