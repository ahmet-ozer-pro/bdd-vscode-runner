import * as vscode from 'vscode';
import { ExecutionDetailSelection } from './executionDetails';
import {
  ExecutionSession,
  ExecutionSessionExampleRow,
  ExecutionSessionHook,
  ExecutionSessionStep,
  ExecutionSessionStore,
} from './executionSession';
import { FailureNavigationTarget } from './failureNavigation';
import { buildExecutionPanelSnapshot, ExecutionPanelSnapshot } from './executionPanelModel';

const COMMAND_SHOW_OUTPUT = 'bdd-vscode-runner.showOutput';
const COMMAND_SHOW_EXECUTION_ITEM_DETAILS = 'bdd-vscode-runner.showExecutionItemDetails';
const COMMAND_RERUN_SESSION = 'bdd-vscode-runner.rerunSession';
const COMMAND_RERUN_FAILED_SESSION = 'bdd-vscode-runner.rerunFailedSession';

type ExecutionPanelNode =
  | FeatureGroupNode
  | SessionNode
  | GroupNode
  | ActionNode
  | ExampleNode
  | HookNode
  | StepNode
  | FailureGroupNode
  | FailureTargetNode
  | FilterEmptyNode
  | EmptyNode
  | OutputNode;

interface FeatureGroupNode {
  kind: 'feature-group';
  featureName: string;
  sessions: ExecutionSession[];
}

interface SessionNode {
  kind: 'session';
  session: ExecutionSession;
}

interface GroupNode {
  kind: 'group';
  group: 'actions' | 'examples' | 'before-hooks' | 'steps' | 'after-hooks';
  session: ExecutionSession;
}

interface ActionNode {
  kind: 'action';
  action: 'rerun-session' | 'rerun-failed' | 'show-output';
  session: ExecutionSession;
}

interface ExampleNode {
  kind: 'example';
  session: ExecutionSession;
  example: ExecutionSessionExampleRow;
}

interface HookNode {
  kind: 'hook';
  session: ExecutionSession;
  hook: ExecutionSessionHook;
}

interface StepNode {
  kind: 'step';
  session: ExecutionSession;
  step: ExecutionSessionStep;
}

interface FailureGroupNode {
  kind: 'failure-group';
  session: ExecutionSession;
}

interface FailureTargetNode {
  kind: 'failure-target';
  target: FailureNavigationTarget;
}

interface FilterEmptyNode {
  kind: 'filter-empty';
  filter: 'failed' | 'passed';
}

interface OutputNode {
  kind: 'output';
}

interface EmptyNode {
  kind: 'empty';
}

export class ExecutionPanelProvider implements vscode.TreeDataProvider<ExecutionPanelNode>, vscode.Disposable {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<ExecutionPanelNode | undefined | null | void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;
  private readonly unsubscribe: () => void;
  private filter: 'all' | 'failed' | 'passed' = 'all';

  constructor(private readonly sessionStore: ExecutionSessionStore) {
    this.unsubscribe = this.sessionStore.subscribe(() => {
      this.refresh();
    });
  }

  dispose(): void {
    this.unsubscribe();
    this.onDidChangeTreeDataEmitter.dispose();
  }

  refresh(): void {
    this.onDidChangeTreeDataEmitter.fire();
  }

  setFilter(filter: 'all' | 'failed' | 'passed'): void {
    this.filter = filter;
    this.refresh();
  }

  getFilter(): 'all' | 'failed' | 'passed' {
    return this.filter;
  }

  getTreeItem(element: ExecutionPanelNode): vscode.TreeItem {
    switch (element.kind) {
      case 'feature-group':
        return buildFeatureGroupTreeItem(element.featureName, element.sessions);
      case 'session':
        return buildSessionTreeItem(element.session);
      case 'group':
        return buildGroupTreeItem(element.group, element.session);
      case 'action':
        return buildActionTreeItem(element.action, element.session);
      case 'example':
        return buildExampleTreeItem(element.session, element.example);
      case 'hook':
        return buildHookTreeItem(element.session, element.hook);
      case 'step':
        return buildStepTreeItem(element.session, element.step);
      case 'failure-group':
        return buildFailureGroupTreeItem(element.session.failureTargets.length);
      case 'failure-target':
        return buildFailureTargetTreeItem(element.target);
      case 'filter-empty':
        return buildFilterEmptyTreeItem(element.filter);
      case 'empty':
        return buildEmptyTreeItem();
      case 'output':
        return buildOutputTreeItem();
    }
  }

  getChildren(element?: ExecutionPanelNode): Thenable<ExecutionPanelNode[]> {
    const sessions = this.sessionStore.getSessions();
    if (!element) {
      const filtered = this.filter === 'all'
        ? sessions
        : sessions.filter((session) => session.status === this.filter);
      if (filtered.length === 0) {
        if (this.filter !== 'all') {
          return Promise.resolve([
            { kind: 'filter-empty', filter: this.filter } satisfies FilterEmptyNode,
            { kind: 'output' },
          ]);
        }
        return Promise.resolve([{ kind: 'empty' }, { kind: 'output' }]);
      }

      const groups = groupSessionsByFeature(filtered);
      if (groups.length === 1) {
        return Promise.resolve([
          ...filtered.map((session) => ({ kind: 'session', session } satisfies SessionNode)),
          { kind: 'output' },
        ]);
      }

      return Promise.resolve([
        ...groups,
        { kind: 'output' },
      ]);
    }

    if (element.kind === 'feature-group') {
      return Promise.resolve(
        element.sessions.map((session) => ({ kind: 'session', session } satisfies SessionNode))
      );
    }

    if (element.kind === 'session') {
      const groups: ExecutionPanelNode[] = [];
      groups.push({ kind: 'group', group: 'actions', session: element.session });
      if (element.session.examples.length > 0) {
        groups.push({ kind: 'group', group: 'examples', session: element.session });
      }
      if (element.session.beforeHooks.length > 0) {
        groups.push({ kind: 'group', group: 'before-hooks', session: element.session });
      }
      if (element.session.steps.length > 0) {
        groups.push({ kind: 'group', group: 'steps', session: element.session });
      }
      if (element.session.afterHooks.length > 0) {
        groups.push({ kind: 'group', group: 'after-hooks', session: element.session });
      }
      if (element.session.failureTargets.length > 0) {
        groups.push({ kind: 'failure-group', session: element.session });
      }
      return Promise.resolve(groups);
    }

    if (element.kind === 'group') {
      switch (element.group) {
        case 'actions': {
          const actions: ExecutionPanelNode[] = [
            {
              kind: 'action',
              action: 'rerun-session',
              session: element.session,
            },
          ];
          if (element.session.status === 'failed') {
            actions.push({
              kind: 'action',
              action: 'rerun-failed',
              session: element.session,
            });
          }
          actions.push({
            kind: 'action',
            action: 'show-output',
            session: element.session,
          });
          return Promise.resolve(actions);
        }
        case 'examples':
          return Promise.resolve(
            element.session.examples.map((example) => ({
              kind: 'example',
              session: element.session,
              example,
            }))
          );
        case 'before-hooks':
          return Promise.resolve(
            element.session.beforeHooks.map((hook) => ({
              kind: 'hook',
              session: element.session,
              hook,
            }))
          );
        case 'steps':
          return Promise.resolve(
            element.session.steps.map((step) => ({
              kind: 'step',
              session: element.session,
              step,
            }))
          );
        case 'after-hooks':
          return Promise.resolve(
            element.session.afterHooks.map((hook) => ({
              kind: 'hook',
              session: element.session,
              hook,
            }))
          );
      }
    }

    if (element.kind === 'failure-group') {
      return Promise.resolve(
        element.session.failureTargets.map((target) => ({
          kind: 'failure-target',
          target,
        }))
      );
    }

    return Promise.resolve([]);
  }
}

export { buildExecutionPanelSnapshot };
export type { ExecutionPanelSnapshot };

function groupSessionsByFeature(sessions: ExecutionSession[]): FeatureGroupNode[] {
  const groups = new Map<string, ExecutionSession[]>();

  for (const session of sessions) {
    const key = session.featureName ?? session.featurePath ?? session.scenarioName;
    const existing = groups.get(key) ?? [];
    existing.push(session);
    groups.set(key, existing);
  }

  return [...groups.entries()].map(([featureName, groupSessions]) => ({
    kind: 'feature-group' as const,
    featureName,
    sessions: groupSessions,
  }));
}

function buildSessionTreeItem(session: ExecutionSession): vscode.TreeItem {
  const item = new vscode.TreeItem(
    `${session.keyword}: ${session.scenarioName}`,
    session.steps.length > 0 || session.examples.length > 0 || session.beforeHooks.length > 0 || session.afterHooks.length > 0
      ? vscode.TreeItemCollapsibleState.Expanded
      : vscode.TreeItemCollapsibleState.None
  );
  item.description = [
    formatSessionTimestamp(session.startedAt),
    session.status,
    formatSessionDuration(session.durationMs),
    formatSessionStepSummary(session),
  ].filter((part) => part.length > 0).join(' · ');
  item.tooltip = [
    `${session.keyword}: ${session.scenarioName}`,
    `Status: ${session.status}`,
    `Started: ${formatSessionDateTime(session.startedAt)}`,
    `Feature: ${session.featurePath}`,
    `Line: ${session.scenarioLineOneBased}`,
    ...(session.durationMs !== undefined ? [`Duration: ${(session.durationMs / 1000).toFixed(2)}s`] : []),
  ].join('\n');
  item.iconPath = getStatusIcon(session.status);
  item.contextValue = session.status === 'failed'
    ? 'session-failed'
    : session.status === 'running'
      ? 'session-running'
      : 'session';
  item.command = buildExecutionDetailsCommand(session, { kind: 'session' });
  return item;
}

function buildFeatureGroupTreeItem(featureName: string, sessions: ExecutionSession[]): vscode.TreeItem {
  const failedCount = sessions.filter((session) => session.status === 'failed').length;
  const passedCount = sessions.filter((session) => session.status === 'passed').length;
  const runningCount = sessions.filter((session) => session.status === 'running').length;

  const item = new vscode.TreeItem(
    featureName,
    vscode.TreeItemCollapsibleState.Expanded
  );
  item.description = runningCount > 0
    ? `running ${runningCount}`
    : failedCount > 0
      ? `✗ ${failedCount} failed`
      : `✓ ${passedCount} passed`;
  item.iconPath = runningCount > 0
    ? new vscode.ThemeIcon('sync~spin')
    : failedCount > 0
      ? new vscode.ThemeIcon('error')
      : new vscode.ThemeIcon('pass');
  item.tooltip = `Feature: ${featureName}\nSessions: ${sessions.length}`;
  item.contextValue = 'feature-group';
  return item;
}

function formatSessionDuration(durationMs: number | undefined): string {
  return durationMs !== undefined ? `(${(durationMs / 1000).toFixed(1)}s)` : '';
}

function formatSessionStepSummary(session: ExecutionSession): string {
  if (session.steps.length === 0) {
    return '';
  }

  const failedIndex = session.steps.findIndex((step) => step.status === 'failed');
  if (failedIndex >= 0) {
    return `✗ step ${failedIndex + 1}/${session.steps.length}`;
  }

  return `${session.steps.length} steps`;
}

function formatSessionTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(timestamp));
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

function buildGroupTreeItem(group: GroupNode['group'], session: ExecutionSession): vscode.TreeItem {
  switch (group) {
    case 'actions': {
      const item = new vscode.TreeItem('Actions', vscode.TreeItemCollapsibleState.Expanded);
      item.description = session.status === 'failed' ? 'rerun available' : 'available';
      item.iconPath = new vscode.ThemeIcon('run-all');
      return item;
    }
    case 'examples': {
      const item = new vscode.TreeItem('Examples', vscode.TreeItemCollapsibleState.Expanded);
      item.description = `${session.examples.length}`;
      item.iconPath = new vscode.ThemeIcon('list-selection');
      return item;
    }
    case 'before-hooks': {
      const item = new vscode.TreeItem('Before Hooks', vscode.TreeItemCollapsibleState.Expanded);
      item.description = `${session.beforeHooks.length}`;
      item.iconPath = new vscode.ThemeIcon('play-circle');
      return item;
    }
    case 'steps': {
      const item = new vscode.TreeItem('Steps', vscode.TreeItemCollapsibleState.Expanded);
      item.description = `${session.steps.length}`;
      item.iconPath = new vscode.ThemeIcon('list-tree');
      return item;
    }
    case 'after-hooks': {
      const item = new vscode.TreeItem('After Hooks', vscode.TreeItemCollapsibleState.Expanded);
      item.description = `${session.afterHooks.length}`;
      item.iconPath = new vscode.ThemeIcon('check-all');
      return item;
    }
  }
}

function buildActionTreeItem(action: ActionNode['action'], session: ExecutionSession): vscode.TreeItem {
  switch (action) {
    case 'rerun-session': {
      const item = new vscode.TreeItem('Rerun Scenario', vscode.TreeItemCollapsibleState.None);
      item.description = 'run again';
      item.tooltip = 'Run this scenario again using the original scenario target.';
      item.iconPath = new vscode.ThemeIcon('debug-rerun');
      item.command = {
        title: 'Rerun Scenario',
        command: COMMAND_RERUN_SESSION,
        arguments: [{ session }],
      };
      return item;
    }
    case 'rerun-failed': {
      const item = new vscode.TreeItem('Rerun Failed', vscode.TreeItemCollapsibleState.None);
      item.description = 'failed target';
      item.tooltip = 'Rerun only the failed target. For a failed Scenario Outline, this prefers the failed example row.';
      item.iconPath = new vscode.ThemeIcon('warning');
      item.command = {
        title: 'Rerun Failed',
        command: COMMAND_RERUN_FAILED_SESSION,
        arguments: [{ session }],
      };
      return item;
    }
    case 'show-output': {
      const item = new vscode.TreeItem('Show Output', vscode.TreeItemCollapsibleState.None);
      item.description = 'console';
      item.tooltip = 'Open the BDD Runner output channel.';
      item.iconPath = new vscode.ThemeIcon('output');
      item.command = {
        title: 'Show Output',
        command: COMMAND_SHOW_OUTPUT,
      };
      return item;
    }
  }
}

function buildExampleTreeItem(session: ExecutionSession, example: ExecutionSessionExampleRow): vscode.TreeItem {
  const item = new vscode.TreeItem(example.values.join(' | '), vscode.TreeItemCollapsibleState.None);
  item.description = example.status;
  item.tooltip = `Example row\nStatus: ${example.status}\nLine: ${example.line + 1}`;
  item.iconPath = getStatusIcon(example.status);
  item.command = buildExecutionDetailsCommand(session, { kind: 'example', example });
  return item;
}

function buildHookTreeItem(session: ExecutionSession, hook: ExecutionSessionHook): vscode.TreeItem {
  const item = new vscode.TreeItem(hook.text, vscode.TreeItemCollapsibleState.None);
  item.description = hook.status;
  item.tooltip = `${hook.kind}\nStatus: ${hook.status}`;
  item.iconPath = getStatusIcon(hook.status);
  item.command = buildExecutionDetailsCommand(session, { kind: 'hook', hook });
  return item;
}

function buildStepTreeItem(session: ExecutionSession, step: ExecutionSessionStep): vscode.TreeItem {
  const item = new vscode.TreeItem(
    `${step.keyword} ${step.text}`,
    vscode.TreeItemCollapsibleState.None
  );
  item.description = step.status;
  item.tooltip = `${step.rawText}\nStatus: ${step.status}\nLine: ${step.line + 1}`;
  item.iconPath = getStatusIcon(step.status);
  item.command = buildExecutionDetailsCommand(session, { kind: 'step', step });
  return item;
}

function buildFailureGroupTreeItem(count: number): vscode.TreeItem {
  const item = new vscode.TreeItem(
    `Failure Targets (${count})`,
    vscode.TreeItemCollapsibleState.Expanded
  );
  item.iconPath = new vscode.ThemeIcon('warning');
  item.description = count > 0 ? 'available' : 'none';
  return item;
}

function buildFailureTargetTreeItem(target: FailureNavigationTarget): vscode.TreeItem {
  const item = new vscode.TreeItem(target.label, vscode.TreeItemCollapsibleState.None);
  item.description = target.source;
  item.tooltip = `${target.filePath}:${target.lineZeroBased + 1}`;
  item.iconPath = new vscode.ThemeIcon(
    target.source === 'step'
      ? 'debug-line-by-line'
      : target.source === 'java'
        ? 'symbol-method'
        : 'go-to-file'
  );
  item.command = buildOpenFileCommand(target.filePath, target.lineZeroBased);
  return item;
}

function buildOutputTreeItem(): vscode.TreeItem {
  const item = new vscode.TreeItem('Show Output', vscode.TreeItemCollapsibleState.None);
  item.iconPath = new vscode.ThemeIcon('output');
  item.command = {
    title: 'Show Output',
    command: COMMAND_SHOW_OUTPUT,
  };
  return item;
}

function buildFilterEmptyTreeItem(filter: 'failed' | 'passed'): vscode.TreeItem {
  const item = new vscode.TreeItem(
    `No ${filter} sessions`,
    vscode.TreeItemCollapsibleState.None
  );
  item.iconPath = new vscode.ThemeIcon(filter === 'failed' ? 'error' : 'pass');
  item.description = 'filter active';
  return item;
}

function buildEmptyTreeItem(): vscode.TreeItem {
  const item = new vscode.TreeItem('No execution session yet', vscode.TreeItemCollapsibleState.None);
  item.iconPath = new vscode.ThemeIcon('history');
  item.description = 'idle';
  return item;
}

function getStatusIcon(status: string): vscode.ThemeIcon {
  switch (status) {
    case 'passed':
      return new vscode.ThemeIcon('pass');
    case 'failed':
      return new vscode.ThemeIcon('error');
    case 'running':
      return new vscode.ThemeIcon('sync~spin');
    case 'cancelled':
      return new vscode.ThemeIcon('circle-slash');
    case 'skipped':
      return new vscode.ThemeIcon('debug-pause');
    default:
      return new vscode.ThemeIcon('circle-large-outline');
  }
}

function buildOpenFileCommand(filePath: string, lineZeroBased: number): vscode.Command {
  return {
    title: 'Open Location',
    command: 'vscode.open',
    arguments: [
      vscode.Uri.file(filePath),
      { selection: new vscode.Range(lineZeroBased, 0, lineZeroBased, 0) },
    ],
  };
}

function buildExecutionDetailsCommand(session: ExecutionSession, selection: ExecutionDetailSelection): vscode.Command {
  return {
    title: 'Show Execution Details',
    command: COMMAND_SHOW_EXECUTION_ITEM_DETAILS,
    arguments: [{ session, selection }],
  };
}
