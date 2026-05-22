import { ExecutionSession } from './executionSession';

export interface ExecutionPanelSnapshot {
  rootKinds: string[];
  sessionCount: number;
  sessionGroupKinds: string[];
  failureTargetLabels: string[];
}

export function buildExecutionPanelSnapshot(
  sessionOrSessions: ExecutionSession | ExecutionSession[] | undefined
): ExecutionPanelSnapshot {
  const sessions = Array.isArray(sessionOrSessions)
    ? sessionOrSessions
    : sessionOrSessions
      ? [sessionOrSessions]
      : [];

  if (sessions.length === 0) {
    return {
      rootKinds: ['empty', 'output'],
      sessionCount: 0,
      sessionGroupKinds: [],
      failureTargetLabels: [],
    };
  }

  const session = sessions[0];
  const sessionGroupKinds: string[] = [];
  if (session.examples.length > 0) {
    sessionGroupKinds.push('examples');
  }
  if (session.beforeHooks.length > 0) {
    sessionGroupKinds.push('before-hooks');
  }
  if (session.steps.length > 0) {
    sessionGroupKinds.push('steps');
  }
  if (session.afterHooks.length > 0) {
    sessionGroupKinds.push('after-hooks');
  }

  return {
    rootKinds: [
      ...sessions.map(() => 'session'),
      'output',
    ],
    sessionCount: sessions.length,
    sessionGroupKinds,
    failureTargetLabels: session.failureTargets.map((target) => target.label),
  };
}
