import * as fs from 'node:fs';
import * as path from 'node:path';
import type { FailureNavigationTarget } from './failureNavigation';

export interface CorrelatedStackFrame {
  qualifiedClassName: string;
  methodName: string;
  fileName: string;
  lineOneBased?: number;
  filePath?: string;
}

export interface FailureDetails {
  exceptionType?: string;
  message?: string;
  expected?: string;
  actual?: string;
  stepDefinition?: CorrelatedStackFrame;
  relatedProjectFrames: CorrelatedStackFrame[];
}

export function extractFailureDetails(
  outputText: string,
  workspaceRoot: string,
  executionRoot: string
): FailureDetails {
  const inlineAssertion = extractInlineAssertion(outputText);
  const blockAssertion = extractExpectedActualBlock(outputText);
  const stackFrames = extractProjectFrames(outputText, workspaceRoot, executionRoot);
  const logFrames = extractProjectLogFrames(outputText, workspaceRoot, executionRoot);
  const relatedProjectFrames = mergeCorrelatedFrames(stackFrames, logFrames);

  return {
    exceptionType: inlineAssertion?.exceptionType,
    message: inlineAssertion?.message,
    expected: inlineAssertion?.expected ?? blockAssertion?.expected,
    actual: inlineAssertion?.actual ?? blockAssertion?.actual,
    stepDefinition: relatedProjectFrames.find(isStepDefinitionFrame),
    relatedProjectFrames,
  };
}

export function buildFailureDetailTargets(details: FailureDetails | undefined): FailureNavigationTarget[] {
  if (!details) {
    return [];
  }

  const prioritizedFrames = [
    ...(details.stepDefinition ? [details.stepDefinition] : []),
    ...details.relatedProjectFrames,
  ];
  const seen = new Set<string>();
  const targets: FailureNavigationTarget[] = [];

  for (const frame of prioritizedFrames) {
    if (!frame.filePath || !frame.lineOneBased || frame.lineOneBased < 1) {
      continue;
    }

    const key = `${frame.filePath}:${frame.lineOneBased}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    targets.push({
      filePath: frame.filePath,
      lineZeroBased: frame.lineOneBased - 1,
      label: `${frame.qualifiedClassName}.${frame.methodName} -> ${path.basename(frame.filePath)}:${frame.lineOneBased}`,
      source: 'java',
    });
  }

  return targets;
}

function mergeCorrelatedFrames(
  primaryFrames: CorrelatedStackFrame[],
  secondaryFrames: CorrelatedStackFrame[]
): CorrelatedStackFrame[] {
  const merged: CorrelatedStackFrame[] = [];
  const seen = new Set<string>();

  for (const frame of [...primaryFrames, ...secondaryFrames].sort(compareFrames)) {
    const key = frame.filePath
      ? `${frame.filePath}:${frame.lineOneBased ?? 0}:${frame.qualifiedClassName}.${frame.methodName}`
      : `${frame.qualifiedClassName}.${frame.methodName}:${frame.lineOneBased ?? 0}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(frame);
  }

  return merged;
}

function extractInlineAssertion(outputText: string): {
  exceptionType?: string;
  message?: string;
  expected?: string;
  actual?: string;
} | undefined {
  const match = outputText.match(
    /^\s*([A-Za-z0-9_.\$]+(?:Error|Exception)):\s+(.+)$/m
  );
  if (!match) {
    return undefined;
  }

  const exceptionType = match[1];
  const fullMessage = match[2].trim();
  const expectationMatch = fullMessage.match(/expected:\s*<([^>]+)>\s*but was:\s*<([^>]+)>/i);

  return {
    exceptionType,
    message: fullMessage,
    expected: expectationMatch?.[1]?.trim(),
    actual: expectationMatch?.[2]?.trim(),
  };
}

function extractExpectedActualBlock(outputText: string): {
  expected?: string;
  actual?: string;
} | undefined {
  const expectedMatch = outputText.match(/^\s*Expected\s*:\s*(.+)\s*$/mi);
  const actualMatch = outputText.match(/^\s*Actual\s*:\s*(.+)\s*$/mi);

  if (!expectedMatch && !actualMatch) {
    return undefined;
  }

  return {
    expected: expectedMatch?.[1]?.trim(),
    actual: actualMatch?.[1]?.trim(),
  };
}

function extractProjectFrames(
  outputText: string,
  workspaceRoot: string,
  executionRoot: string
): CorrelatedStackFrame[] {
  const frames: CorrelatedStackFrame[] = [];
  const seen = new Set<string>();
  const framePattern =
    /at\s+((?:[A-Za-z_][A-Za-z0-9_]*\.)+[A-Za-z_][A-Za-z0-9_\$]*)\.([A-Za-z_][A-Za-z0-9_\$]*)\(([^):]+\.(?:java|kt|groovy)):(\d+)\)/g;

  for (const match of outputText.matchAll(framePattern)) {
    const qualifiedClassName = match[1];
    const methodName = match[2];
    const fileName = match[3];
    const lineOneBased = Number(match[4]);
    if (lineOneBased < 1) {
      continue;
    }

    const filePath = resolveProjectPath(fileName, workspaceRoot, executionRoot, qualifiedClassName);
    if (!filePath) {
      continue;
    }

    const key = `${filePath}:${lineOneBased}:${qualifiedClassName}.${methodName}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    frames.push({
      qualifiedClassName,
      methodName,
      fileName: path.basename(filePath),
      lineOneBased,
      filePath,
    });
  }

  return frames.sort(compareFrames);
}

function extractProjectLogFrames(
  outputText: string,
  workspaceRoot: string,
  executionRoot: string
): CorrelatedStackFrame[] {
  const lines = outputText.split(/\r?\n/);
  const anchorIndex = findFailureAnchorIndex(lines);
  const start = Math.max(0, anchorIndex - 12);
  const end = Math.min(lines.length, anchorIndex + 2);
  const frames: CorrelatedStackFrame[] = [];
  const seen = new Set<string>();
  const logPattern = /\b((?:[A-Za-z_][A-Za-z0-9_]*\.)+[A-Za-z_][A-Za-z0-9_\$]*)\b\s+--/g;

  for (let index = start; index < end; index += 1) {
    const line = lines[index];
    for (const match of line.matchAll(logPattern)) {
      const qualifiedClassName = match[1];
      const logMessage = line.split('--').slice(1).join('--').trim();
      const simpleClassName = `${qualifiedClassName.split('.').pop()}.java`;
      const filePath = resolveProjectPath(simpleClassName, workspaceRoot, executionRoot, qualifiedClassName);
      if (!filePath) {
        continue;
      }
      const inferredLineOneBased = inferLogSourceLine(filePath, logMessage);
      const inferredMethodName = inferEnclosingMethodName(filePath, inferredLineOneBased) ?? 'log';

      const key = `${filePath}:${qualifiedClassName}:${inferredLineOneBased ?? 0}:${inferredMethodName}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      frames.push({
        qualifiedClassName,
        methodName: inferredMethodName,
        fileName: path.basename(filePath),
        lineOneBased: inferredLineOneBased,
        filePath,
      });
    }
  }

  return frames.sort(compareFrames);
}

function inferLogSourceLine(filePath: string, logMessage: string): number | undefined {
  if (!logMessage) {
    return undefined;
  }

  const content = safeReadFile(filePath);
  if (!content) {
    return undefined;
  }

  const lines = content.split(/\r?\n/);
  const messageSegments = extractSearchableLogSegments(logMessage);
  if (messageSegments.length === 0) {
    return undefined;
  }

  let bestMatch: { lineOneBased: number; score: number } | undefined;

  for (let index = 0; index < lines.length; index += 1) {
    const normalizedLine = normalizeSearchText(lines[index]);
    let score = 0;

    for (const segment of messageSegments) {
      if (normalizedLine.includes(segment)) {
        score += segment.length;
      }
    }

    if (score <= 0) {
      continue;
    }

    if (!bestMatch || score > bestMatch.score) {
      bestMatch = {
        lineOneBased: index + 1,
        score,
      };
    }
  }

  return bestMatch?.lineOneBased;
}

function inferEnclosingMethodName(filePath: string, lineOneBased: number | undefined): string | undefined {
  if (!lineOneBased) {
    return undefined;
  }

  const content = safeReadFile(filePath);
  if (!content) {
    return undefined;
  }

  const lines = content.split(/\r?\n/);
  for (let index = Math.min(lineOneBased - 1, lines.length - 1); index >= 0; index -= 1) {
    const match = lines[index].match(
      /^\s*(?:public|protected|private|static|final|synchronized|native|abstract|\s)+[\w<>\[\], ?]+\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/
    );
    if (match) {
      return match[1];
    }
  }

  return undefined;
}

function extractSearchableLogSegments(logMessage: string): string[] {
  const normalizedMessage = normalizeSearchText(logMessage);
  const rawSegments = normalizedMessage
    .split(/[:,]/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length >= 8);

  const expandedSegments = rawSegments.flatMap((segment) => {
    const withoutTrailingValues = segment.replace(/\b(true|false|null|\d+)\b/g, '').trim();
    const candidates = [segment, withoutTrailingValues]
      .map((candidate) => candidate.replace(/\s+/g, ' ').trim())
      .filter((candidate) => candidate.length >= 8);
    return candidates;
  });

  return Array.from(new Set(expandedSegments));
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/["'`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function safeReadFile(filePath: string): string | undefined {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return undefined;
  }
}

function findFailureAnchorIndex(lines: string[]): number {
  for (let index = 0; index < lines.length; index += 1) {
    if (/(AssertionFailedError|Step failed|expected:|Actual\s*:|Expected\s*:)/i.test(lines[index])) {
      return index;
    }
  }

  return lines.length - 1;
}

function resolveProjectPath(
  fileName: string,
  workspaceRoot: string,
  executionRoot: string,
  qualifiedClassName: string
): string | undefined {
  const normalized = fileName.replace(/\\/g, path.sep);

  const executionRelative = path.resolve(executionRoot, normalized);
  if (isProjectFile(executionRelative, workspaceRoot, executionRoot)) {
    return executionRelative;
  }

  const workspaceRelative = path.resolve(workspaceRoot, normalized);
  if (isProjectFile(workspaceRelative, workspaceRoot, executionRoot)) {
    return workspaceRelative;
  }

  return resolveByBasename(path.basename(normalized), [workspaceRoot, executionRoot], qualifiedClassName);
}

function isProjectFile(candidatePath: string, workspaceRoot: string, executionRoot: string): boolean {
  if (!fs.existsSync(candidatePath)) {
    return false;
  }

  const resolvedCandidate = path.resolve(candidatePath);
  return isWithinRoot(resolvedCandidate, path.resolve(workspaceRoot)) ||
    isWithinRoot(resolvedCandidate, path.resolve(executionRoot));
}

function resolveByBasename(
  basename: string,
  roots: string[],
  qualifiedClassName: string
): string | undefined {
  const matches = new Set<string>();

  for (const root of roots) {
    for (const match of findFilesByBasename(root, basename, 0)) {
      matches.add(match);
    }
  }

  if (matches.size === 1) {
    return [...matches][0];
  }

  if (matches.size > 1) {
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

function isWithinRoot(targetPath: string, rootPath: string): boolean {
  const relativePath = path.relative(rootPath, targetPath);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

function isStepDefinitionFrame(frame: CorrelatedStackFrame): boolean {
  const lowerFileName = frame.fileName.toLowerCase();
  const lowerClassName = frame.qualifiedClassName.toLowerCase();

  return lowerFileName.endsWith('steps.java') ||
    lowerFileName.endsWith('step.java') ||
    lowerClassName.includes('.steps.');
}

function compareFrames(left: CorrelatedStackFrame, right: CorrelatedStackFrame): number {
  return getFramePriority(left) - getFramePriority(right);
}

function getFramePriority(frame: CorrelatedStackFrame): number {
  const lowerFileName = frame.fileName.toLowerCase();
  const lowerClassName = frame.qualifiedClassName.toLowerCase();

  if (lowerFileName.endsWith('steps.java') || lowerFileName.endsWith('step.java') || lowerClassName.includes('.steps.')) {
    return 0;
  }

  if (lowerFileName.includes('page') || lowerFileName.includes('adapter') || lowerFileName.includes('service')) {
    return 5;
  }

  if (lowerFileName.includes('hook')) {
    return 10;
  }

  return frame.lineOneBased ? 15 : 20;
}
