import * as fs from 'fs';
import * as path from 'path';

export interface FailureNavigationTarget {
  filePath: string;
  lineZeroBased: number;
  label: string;
  source: 'output' | 'scenario' | 'step' | 'java';
}

export function collectFailureAnalysisText(
  outputText: string,
  executionRoot: string
): string {
  const sections = [outputText];
  const surefireReportsPath = path.join(executionRoot, 'target', 'surefire-reports');

  if (!fs.existsSync(surefireReportsPath)) {
    return sections.join('\n');
  }

  let reportFiles: string[];
  try {
    reportFiles = fs
      .readdirSync(surefireReportsPath, { withFileTypes: true })
      .filter((entry) => entry.isFile() && (entry.name.endsWith('.txt') || entry.name.endsWith('.xml')))
      .map((entry) => entry.name)
      .sort();
  } catch {
    reportFiles = [];
  }

  for (const reportFile of reportFiles) {
    const reportPath = path.join(surefireReportsPath, reportFile);
    let reportContent: string;
    try {
      reportContent = fs.readFileSync(reportPath, 'utf8');
    } catch {
      continue;
    }

    if (!reportContent.trim()) {
      continue;
    }

    sections.push(reportContent);
  }

  return sections.join('\n');
}

export function extractFailureNavigationTargets(
  outputText: string,
  workspaceRoot: string,
  executionRoot: string
): FailureNavigationTarget[] {
  const targets: FailureNavigationTarget[] = [];
  const seen = new Set<string>();
  const resolvedWorkspaceRoot = path.resolve(workspaceRoot);
  const resolvedExecutionRoot = path.resolve(executionRoot);
  const outputReferencePatterns = [
    {
      pattern: /\*\.([^(]+)\((file:\/\/\/[^):]+\.(?:feature|java|kt|groovy)|(?:\/|[A-Za-z]:\\)[^):]+\.(?:feature|java|kt|groovy)):(\d+)\)/g,
      source: 'step' as const,
      buildLabel: (match: RegExpMatchArray, resolvedPath: string, rawLine: number) =>
        `${match[1].trim()} -> ${path.basename(resolvedPath)}:${rawLine}`,
    },
    {
      pattern: /(?<![A-Za-z0-9_.-])((?:\/|[A-Za-z]:\\)[^\s():]+\.(?:feature|java|kt|groovy)):(\d+)/g,
      source: 'output' as const,
      buildLabel: (_match: RegExpMatchArray, resolvedPath: string, rawLine: number) =>
        `${path.basename(resolvedPath)}:${rawLine}`,
    },
    {
      pattern: /(?<![A-Za-z0-9_./\\-])([A-Za-z0-9_.-][A-Za-z0-9_./\\-]*\.(?:feature|java|kt|groovy)):(\d+)/g,
      source: 'output' as const,
      buildLabel: (_match: RegExpMatchArray, resolvedPath: string, rawLine: number) =>
        `${path.basename(resolvedPath)}:${rawLine}`,
    },
  ];

  for (const entry of outputReferencePatterns) {
    for (const match of outputText.matchAll(entry.pattern)) {
      const rawPath = entry.source === 'step' ? match[2] : match[1];
      const rawLine = Number(entry.source === 'step' ? match[3] : match[2]);
      const matchIndex = match.index ?? 0;
      const precedingText = outputText.slice(Math.max(0, matchIndex - 7), matchIndex);

      if (entry.source === 'output' && (rawPath.startsWith('file://') || precedingText === 'file://')) {
        continue;
      }

      if (entry.source === 'output' && (rawPath.startsWith('///') || rawPath.startsWith('//'))) {
        continue;
      }

      if (entry.pattern === outputReferencePatterns[2].pattern && path.isAbsolute(normalizeCandidatePath(rawPath))) {
        continue;
      }

      const resolvedPath = resolveCandidatePath(rawPath, workspaceRoot, executionRoot);

      if (!resolvedPath || rawLine < 1) {
        continue;
      }

      if (!fs.existsSync(resolvedPath)) {
        continue;
      }

      const key = `${resolvedPath}:${rawLine}`;
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      targets.push({
        filePath: resolvedPath,
        lineZeroBased: rawLine - 1,
        label: entry.buildLabel(match, resolvedPath, rawLine),
        source: entry.source,
      });
    }
  }

  for (const match of outputText.matchAll(/at\s+((?:[A-Za-z_][A-Za-z0-9_]*\.)+[A-Za-z_][A-Za-z0-9_]*)\.[^(]+\(([^):]+\.(?:java|kt|groovy)):(\d+)\)/g)) {
    const qualifiedClassName = match[1];
    const rawPath = match[2];
    const rawLine = Number(match[3]);

    if (rawLine < 1) {
      continue;
    }

    const resolvedPath = resolveCandidatePath(rawPath, workspaceRoot, executionRoot, qualifiedClassName);
    if (!resolvedPath || !fs.existsSync(resolvedPath)) {
      continue;
    }

    const key = `${resolvedPath}:${rawLine}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    targets.push({
      filePath: resolvedPath,
      lineZeroBased: rawLine - 1,
      label: `${path.basename(resolvedPath)}:${rawLine}`,
      source: 'output',
    });
  }

  const workspaceTargets = targets.filter((target) =>
    isWithinRoot(target.filePath, resolvedWorkspaceRoot) ||
    isWithinRoot(target.filePath, resolvedExecutionRoot)
  );

  const finalTargets = workspaceTargets.length > 0 ? workspaceTargets : targets;
  return normalizeFailureTargets(finalTargets);
}

export function normalizeFailureTargets(targets: FailureNavigationTarget[]): FailureNavigationTarget[] {
  const sortedTargets = [...targets].sort(compareFailureTargets);
  const stepFeatureFiles = new Set(
    sortedTargets
      .filter((target) => target.source === 'step' && target.filePath.endsWith('.feature'))
      .map((target) => path.resolve(target.filePath))
  );
  const normalized: FailureNavigationTarget[] = [];
  const seenLocations = new Set<string>();

  for (const target of sortedTargets) {
    const resolvedFilePath = path.resolve(target.filePath);
    const locationKey = `${resolvedFilePath}:${target.lineZeroBased}`;

    if (seenLocations.has(locationKey)) {
      continue;
    }

    if (
      target.source === 'output' &&
      target.filePath.endsWith('.feature') &&
      stepFeatureFiles.has(resolvedFilePath)
    ) {
      continue;
    }

    seenLocations.add(locationKey);
    normalized.push(target);
  }

  return normalized;
}

export function createScenarioFailureTarget(
  documentPath: string,
  scenarioLineZeroBased: number,
  scenarioName: string
): FailureNavigationTarget {
  return {
    filePath: documentPath,
    lineZeroBased: scenarioLineZeroBased,
    label: scenarioName,
    source: 'scenario',
  };
}

function resolveCandidatePath(
  rawPath: string,
  workspaceRoot: string,
  executionRoot: string,
  qualifiedClassName?: string
): string | undefined {
  const normalizedPath = normalizeCandidatePath(rawPath);

  if (path.isAbsolute(normalizedPath)) {
    return normalizedPath;
  }

  const executionRelative = path.resolve(executionRoot, normalizedPath);
  if (executionRelative.startsWith(path.resolve(executionRoot)) && fs.existsSync(executionRelative)) {
    return executionRelative;
  }

  const workspaceRelative = path.resolve(workspaceRoot, normalizedPath);
  if (workspaceRelative.startsWith(path.resolve(workspaceRoot)) && fs.existsSync(workspaceRelative)) {
    return workspaceRelative;
  }

  const basenameResolution = resolveByBasename(normalizedPath, [workspaceRoot, executionRoot], qualifiedClassName);
  if (basenameResolution) {
    return basenameResolution;
  }

  return undefined;
}

function normalizeCandidatePath(rawPath: string): string {
  const withoutUriPrefix = rawPath.startsWith('file://')
    ? rawPath.replace(/^file:\/\//, '')
    : rawPath;

  return withoutUriPrefix.replace(/\\/g, path.sep);
}

function isWithinRoot(targetPath: string, rootPath: string): boolean {
  const resolvedTargetPath = path.resolve(targetPath);
  const relativePath = path.relative(rootPath, resolvedTargetPath);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

function resolveByBasename(
  candidatePath: string,
  roots: string[],
  qualifiedClassName?: string
): string | undefined {
  if (candidatePath.includes(path.sep)) {
    return undefined;
  }

  const basename = path.basename(candidatePath);
  const matches = new Set<string>();

  for (const root of roots) {
    for (const match of findFilesByBasename(root, basename, 0)) {
      matches.add(match);
    }
  }

  if (matches.size === 1) {
    return [...matches][0];
  }

  if (matches.size > 1 && qualifiedClassName) {
    return resolveByQualifiedClassName([...matches], qualifiedClassName);
  }

  return undefined;
}

function resolveByQualifiedClassName(matches: string[], qualifiedClassName: string): string | undefined {
  const packageSegments = qualifiedClassName.split('.').slice(0, -1).map((segment) => segment.toLowerCase());

  const scoredMatches = matches
    .map((candidate) => ({
      candidate,
      score: scoreCandidateAgainstPackage(candidate, packageSegments),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  if (scoredMatches.length === 0) {
    return undefined;
  }

  if (scoredMatches.length === 1 || scoredMatches[0].score > scoredMatches[1].score) {
    return scoredMatches[0].candidate;
  }

  return undefined;
}

function scoreCandidateAgainstPackage(candidatePath: string, packageSegments: string[]): number {
  const candidateSegments = candidatePath
    .split(path.sep)
    .map((segment) => segment.toLowerCase());

  let score = 0;
  let candidateIndex = candidateSegments.length - 2;
  let packageIndex = packageSegments.length - 1;

  while (candidateIndex >= 0 && packageIndex >= 0) {
    if (candidateSegments[candidateIndex] === packageSegments[packageIndex]) {
      score += 1;
      packageIndex -= 1;
    }
    candidateIndex -= 1;
  }

  return score;
}

function findFilesByBasename(root: string, basename: string, depth: number): string[] {
  if (!fs.existsSync(root) || depth > 16) {
    return [];
  }

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const matches: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'out' || entry.name.startsWith('.')) {
        continue;
      }
      matches.push(...findFilesByBasename(entryPath, basename, depth + 1));
      continue;
    }

    if (entry.isFile() && entry.name === basename) {
      matches.push(entryPath);
    }
  }

  return matches;
}

function compareFailureTargets(
  left: FailureNavigationTarget,
  right: FailureNavigationTarget
): number {
  return getFailureTargetPriority(left) - getFailureTargetPriority(right);
}

function getFailureTargetPriority(target: FailureNavigationTarget): number {
  if (target.source === 'step') {
    return 0;
  }

  if (target.source === 'java') {
    return 5;
  }

  if (target.source === 'scenario') {
    return 30;
  }

  const fileName = path.basename(target.filePath).toLowerCase();

  if (fileName.endsWith('steps.java') || fileName.endsWith('step.java')) {
    return 5;
  }

  if (
    fileName.includes('page') ||
    fileName.includes('adapter') ||
    fileName.includes('service') ||
    fileName.includes('hook')
  ) {
    return 10;
  }

  if (fileName.endsWith('.java') || fileName.endsWith('.kt') || fileName.endsWith('.groovy')) {
    return 15;
  }

  if (fileName.endsWith('.feature')) {
    return 20;
  }

  return 25;
}
