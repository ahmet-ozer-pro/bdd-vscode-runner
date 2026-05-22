import { CorrelatedStackFrame, extractFailureDetails } from './failureDetails';
import {
  ExecutionSession,
  ExecutionSessionExampleRow,
  ExecutionSessionHook,
  ExecutionSessionStep,
} from './executionSession';

export type ExecutionDetailSelection =
  | { kind: 'session' }
  | { kind: 'example'; example: ExecutionSessionExampleRow }
  | { kind: 'hook'; hook: ExecutionSessionHook }
  | { kind: 'step'; step: ExecutionSessionStep };

export interface ExecutionDetailDocument {
  title: string;
  content: string;
}

export function buildExecutionDetailDocument(
  session: ExecutionSession,
  selection: ExecutionDetailSelection
): ExecutionDetailDocument {
  const descriptor = describeSelection(session, selection);
  const failureDetails = session.status === 'failed'
    ? extractFailureDetails(session.outputText, session.workspaceRoot, session.executionRoot)
    : undefined;
  const relevantOutput = extractRelevantOutput(
    session.outputText,
    descriptor.searchTokens,
    selection,
    failureDetails
  );

  const lines = [
    descriptor.title,
    '='.repeat(descriptor.title.length),
    `Scenario       : ${session.scenarioName}`,
    `Keyword        : ${session.keyword}`,
    `Status         : ${session.status}`,
    `Started        : ${formatSessionDateTime(session.startedAt)}`,
    `Feature        : ${session.featurePath}`,
    `Scenario Line  : ${session.scenarioLineOneBased}`,
    `Execution Root : ${session.executionRoot}`,
    `POM            : ${session.pomPath ?? 'N/A'}`,
  ];

  if (session.structuredResultSource) {
    lines.push(`Structured Src : ${session.structuredResultSource}`);
  }

  if (descriptor.detailLines.length > 0) {
    lines.push('');
    lines.push('Selection');
    lines.push('---------');
    lines.push(...descriptor.detailLines);
  }

  const failureDetailLines = buildFailureDetailLines(failureDetails);
  if (failureDetailLines.length > 0) {
    lines.push('');
    lines.push('Failure Details');
    lines.push('---------------');
    lines.push(...failureDetailLines);
  }

  const assertionLines = buildAssertionDetailLines(failureDetails, selection);
  if (assertionLines.length > 0) {
    lines.push('');
    lines.push(...assertionLines);
  }

  lines.push('');
  lines.push('Relevant Output');
  lines.push('---------------');
  lines.push(...relevantOutput);

  return {
    title: descriptor.title,
    content: lines.join('\n'),
  };
}

function describeSelection(
  session: ExecutionSession,
  selection: ExecutionDetailSelection
): {
  title: string;
  detailLines: string[];
  searchTokens: string[];
} {
  switch (selection.kind) {
    case 'session':
      return {
        title: `BDD Runner Session - ${session.scenarioName}`,
        detailLines: [
          `Item           : Session Overview`,
          ...(session.durationMs !== undefined ? [`Duration       : ${(session.durationMs / 1000).toFixed(2)}s`] : []),
          `Examples       : ${session.examples.length}`,
          `Before Hooks   : ${session.beforeHooks.length}`,
          `Steps          : ${session.steps.length}`,
          `After Hooks    : ${session.afterHooks.length}`,
          `Failure Targets: ${session.failureTargets.length}`,
        ],
        searchTokens: [session.scenarioName, ...session.failureTargets.map((target) => target.label)],
      };
    case 'example':
      return {
        title: `BDD Runner Example - ${selection.example.values.join(' | ')}`,
        detailLines: [
          `Item           : Example Row`,
          `Values         : ${selection.example.values.join(' | ')}`,
          `Status         : ${selection.example.status}`,
          `Line           : ${selection.example.line + 1}`,
        ],
        searchTokens: [...selection.example.values, session.scenarioName],
      };
    case 'hook':
      return {
        title: `BDD Runner ${capitalize(selection.hook.kind)} Hook - ${selection.hook.text}`,
        detailLines: [
          `Item           : ${capitalize(selection.hook.kind)} Hook`,
          `Status         : ${selection.hook.status}`,
          ...(selection.hook.durationMs !== undefined
            ? [`Duration       : ${(selection.hook.durationMs / 1000).toFixed(2)}s`]
            : []),
          `Hook           : ${selection.hook.text}`,
        ],
        searchTokens: buildHookSearchTokens(selection.hook),
      };
    case 'step':
      return {
        title: `BDD Runner Step - ${selection.step.rawText}`,
        detailLines: [
          `Item           : Step`,
          `Status         : ${selection.step.status}`,
          ...(selection.step.durationMs !== undefined
            ? [`Duration       : ${(selection.step.durationMs / 1000).toFixed(2)}s`]
            : []),
          `Line           : ${selection.step.line + 1}`,
          `Step           : ${selection.step.rawText}`,
        ],
        searchTokens: [selection.step.rawText, selection.step.text, session.scenarioName],
      };
  }
}

function buildAssertionDetailLines(
  details: ReturnType<typeof extractFailureDetails> | undefined,
  selection: ExecutionDetailSelection
): string[] {
  if (selection.kind !== 'step' || !details || (details.expected === undefined && details.actual === undefined)) {
    return [];
  }

  return [
    '--- Assertion --------------------------------',
    `Expected : ${details.expected ?? 'N/A'}`,
    `Actual   : ${details.actual ?? 'N/A'}`,
    '---------------------------------------------',
  ];
}

function buildHookSearchTokens(hook: ExecutionSessionHook): string[] {
  const methodMatch = hook.text.match(/([A-Za-z_][A-Za-z0-9_]*)\(/);
  const classMatch = hook.text.match(/([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)\(/);

  const tokens = [
    hook.text,
    classMatch?.[1],
    classMatch?.[2],
    methodMatch?.[1],
    capitalize(hook.kind),
    'hook',
  ];

  return tokens.filter((token): token is string => Boolean(token));
}

function extractRelevantOutput(
  outputText: string,
  searchTokens: string[],
  selection: ExecutionDetailSelection,
  failureDetails?: ReturnType<typeof extractFailureDetails>
): string[] {
  const lines = outputText.split(/\r?\n/);
  if (lines.length === 0 || (lines.length === 1 && lines[0] === '')) {
    return ['No execution output was captured for this run.'];
  }

  const failureFocusedExcerpt = extractFailureFocusedOutput(lines, selection, failureDetails);
  if (failureFocusedExcerpt) {
    return failureFocusedExcerpt;
  }

  const normalizedTokens = Array.from(
    new Set(
      searchTokens
        .map((token) => token.trim())
        .filter((token) => token.length >= 3)
    )
  );

  const anchorIndex = findBestAnchorIndex(lines, normalizedTokens);
  if (anchorIndex === undefined) {
    const fallbackExcerpt = lines.slice(0, Math.min(30, lines.length));
    return [
      'No direct output match was found for this item. Showing the beginning of the run output instead.',
      '',
      ...fallbackExcerpt,
      ...(lines.length > fallbackExcerpt.length ? ['...', '(truncated)'] : []),
    ];
  }

  const start = Math.max(0, anchorIndex - 8);
  const end = Math.min(lines.length, anchorIndex + 20);
  const excerpt = lines.slice(start, end);

  return [
    ...(start > 0 ? ['...'] : []),
    ...excerpt,
    ...(end < lines.length ? ['...', '(truncated)'] : []),
  ];
}

function findBestAnchorIndex(lines: string[], tokens: string[]): number | undefined {
  if (tokens.length === 0) {
    return undefined;
  }

  let bestMatch: { index: number; score: number } | undefined;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lowerLine = line.toLowerCase();

    for (const token of tokens) {
      const normalizedToken = token.toLowerCase();
      if (!lowerLine.includes(normalizedToken)) {
        continue;
      }

      const score = normalizedToken.length;
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { index, score };
      }
    }
  }

  return bestMatch?.index;
}

function extractFailureFocusedOutput(
  lines: string[],
  selection: ExecutionDetailSelection,
  failureDetails?: ReturnType<typeof extractFailureDetails>
): string[] | undefined {
  if (selection.kind !== 'step' || selection.step.status !== 'failed') {
    return undefined;
  }

  const priorityMatchers = [
    failureDetails?.stepDefinition
      ? `${failureDetails.stepDefinition.qualifiedClassName}.${failureDetails.stepDefinition.methodName}`
      : undefined,
    failureDetails?.exceptionType,
    'Step failed',
    'Expected',
    'Actual',
    selection.step.rawText,
  ].filter((value): value is string => Boolean(value));

  const anchorIndex = findBestAnchorIndex(lines, priorityMatchers);
  if (anchorIndex === undefined) {
    return undefined;
  }

  const start = Math.max(0, anchorIndex - 6);
  const end = Math.min(lines.length, anchorIndex + 18);
  const excerpt = lines.slice(start, end);

  return [
    ...(start > 0 ? ['...'] : []),
    ...excerpt,
    ...(end < lines.length ? ['...', '(truncated)'] : []),
  ];
}

function capitalize(value: string): string {
  if (!value) {
    return value;
  }

  return `${value[0].toUpperCase()}${value.slice(1)}`;
}

function buildFailureDetailLines(
  details: ReturnType<typeof extractFailureDetails> | undefined
): string[] {
  if (!details) {
    return [];
  }

  const lines: string[] = [];

  if (details.exceptionType) {
    lines.push(`Exception      : ${details.exceptionType}`);
  }

  if (details.message) {
    lines.push(`Message        : ${details.message}`);
  }

  if (details.expected !== undefined) {
    lines.push(`Expected       : ${details.expected}`);
  }

  if (details.actual !== undefined) {
    lines.push(`Actual         : ${details.actual}`);
  }

  if (details.stepDefinition) {
    lines.push(`Step Definition: ${formatFrame(details.stepDefinition)}`);
  }

  if (details.relatedProjectFrames.length > 0) {
    lines.push('Related Frames :');
    for (const frame of details.relatedProjectFrames.slice(0, 5)) {
      lines.push(`- ${formatFrame(frame)}`);
    }
  }

  return lines;
}

function formatFrame(frame: CorrelatedStackFrame): string {
  const location = frame.filePath
    ? frame.lineOneBased
      ? `${frame.filePath}:${frame.lineOneBased}`
      : `${frame.filePath}`
    : frame.lineOneBased
      ? `${frame.fileName}:${frame.lineOneBased}`
      : frame.fileName;

  return `${frame.qualifiedClassName}.${frame.methodName} (${location})`;
}

function formatSessionDateTime(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(timestamp));
}
