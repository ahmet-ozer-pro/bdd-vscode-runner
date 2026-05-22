import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { buildFeatureCodeLensItem, buildScenarioCodeLensItems } from './core/codeLens';
import { buildExecutionDetailDocument, ExecutionDetailSelection } from './core/executionDetails';
import { ExecutionPanelProvider } from './core/executionPanel';
import { buildFailureDetailTargets, extractFailureDetails } from './core/failureDetails';
import {
  buildFolderExecutionSession,
  buildExecutionSession,
  ExecutionSession,
  ExecutionSessionStore,
  buildTagExecutionSession,
  formatExecutionSessionSummary,
} from './core/executionSession';
import {
  collectFailureAnalysisText,
  createScenarioFailureTarget,
  extractFailureNavigationTargets,
  FailureNavigationTarget,
  normalizeFailureTargets,
} from './core/failureNavigation';
import { buildCucumberFeatureArg, resolveMavenExecutable, resolveMavenExecutionRoot } from './core/mavenExecution';
import { ExecutionContext, ExecutionHistory, ExecutionRecord, formatExecutionSummary, getStatusBarText } from './core/observability';
import { ProcessRunResult, ProcessRunnerCoordinator } from './core/processRunner';
import {
  buildStructuredFailureTargets,
  collectStructuredExecutionResult,
  parseLiveNdjsonStepStatuses,
} from './core/resultIngestion';
import {
  discoverFeatureDocument,
  findNearestScenarioMetadata,
  ScenarioMetadata,
} from './core/scenarioDiscovery';

const COMMAND_RUN_CURRENT_SCENARIO = 'bdd-vscode-runner.runCurrentScenario';
const COMMAND_DEBUG_CURRENT_SCENARIO = 'bdd-vscode-runner.debugCurrentScenario';
const COMMAND_RUN_CURRENT_FEATURE = 'bdd-vscode-runner.runCurrentFeature';
const COMMAND_RUN_SELECTED_FEATURES = 'bdd-vscode-runner.runSelectedFeatures';
const COMMAND_RUN_FEATURE_FOLDER = 'bdd-vscode-runner.runFeatureFolder';
const COMMAND_RUN_BY_TAG = 'bdd-vscode-runner.runByTag';
const COMMAND_CANCEL_RUN = 'bdd-vscode-runner.cancelRun';
const COMMAND_SHOW_OUTPUT = 'bdd-vscode-runner.showOutput';
const COMMAND_OPEN_LAST_FAILURE_LOCATION = 'bdd-vscode-runner.openLastFailureLocation';
const COMMAND_SHOW_EXECUTION_ITEM_DETAILS = 'bdd-vscode-runner.showExecutionItemDetails';
const COMMAND_RERUN_SESSION = 'bdd-vscode-runner.rerunSession';
const COMMAND_RERUN_FAILED_SESSION = 'bdd-vscode-runner.rerunFailedSession';
const COMMAND_FILTER_ALL = 'bdd-vscode-runner.filterAll';
const COMMAND_FILTER_FAILED = 'bdd-vscode-runner.filterFailed';
const COMMAND_FILTER_PASSED = 'bdd-vscode-runner.filterPassed';

let runtime: ExtensionRuntime | undefined;

interface RunnerConfiguration {
  mavenExecutable: string;
  testClassName: string;
  enableNdjsonPlugin: boolean;
}

interface MavenRunParams {
  document?: vscode.TextDocument;
  executionRoot: string;
  cucumberFeatureArg: string;
  tagFilter?: string;
  featureAbsolutePathOverride?: string;
  displayLabel: string;
  runTitle?: string;
  runNoun?: string;
  runningNoun?: string;
  targetAbsolutePath?: string;
  scenarioMetadata?: ScenarioMetadata;
  scenarioLineOneBased?: number;
  configuration: RunnerConfiguration;
  workspaceRoot: string;
  pomPath?: string;
  fallbackLineZeroBased: number;
}

interface RunScenarioCommandArgs {
  uri?: vscode.Uri;
  line?: number;
  scenarioName?: string;
  kind?: 'run' | 'debug';
}

interface RunFeatureCommandArgs {
  uri?: vscode.Uri;
}

interface ShowExecutionItemDetailsArgs {
  session: ExecutionSession;
  selection: ExecutionDetailSelection;
}

interface RerunSessionCommandArgs {
  session?: ExecutionSession;
}

export function activate(context: vscode.ExtensionContext) {
  runtime = new ExtensionRuntime(context);

  const runCurrentScenarioCommand = vscode.commands.registerCommand(
    COMMAND_RUN_CURRENT_SCENARIO,
    async (args?: RunScenarioCommandArgs) => {
      await runCurrentScenario(args);
    }
  );
  const runCurrentFeatureCommand = vscode.commands.registerCommand(
    COMMAND_RUN_CURRENT_FEATURE,
    async (args?: RunFeatureCommandArgs) => {
      await runCurrentFeature(args);
    }
  );
  const runSelectedFeaturesCommand = vscode.commands.registerCommand(
    COMMAND_RUN_SELECTED_FEATURES,
    async () => {
      await runSelectedFeatures();
    }
  );
  const debugCurrentScenarioCommand = vscode.commands.registerCommand(
    COMMAND_DEBUG_CURRENT_SCENARIO,
    async (args?: RunScenarioCommandArgs) => {
      await runCurrentScenarioWithDebug(args);
    }
  );
  const runFeatureFolderCommand = vscode.commands.registerCommand(COMMAND_RUN_FEATURE_FOLDER, async () => {
    await runFeatureFolder();
  });
  const runByTagCommand = vscode.commands.registerCommand(COMMAND_RUN_BY_TAG, async () => {
    await runByTag();
  });
  const cancelRunCommand = vscode.commands.registerCommand(COMMAND_CANCEL_RUN, async () => {
    await cancelActiveRun();
  });
  const showOutputCommand = vscode.commands.registerCommand(COMMAND_SHOW_OUTPUT, () => {
    runtime!.outputChannel.show(true);
  });
  const openLastFailureLocationCommand = vscode.commands.registerCommand(COMMAND_OPEN_LAST_FAILURE_LOCATION, async () => {
    await openLastFailureLocation();
  });
  const showExecutionItemDetailsCommand = vscode.commands.registerCommand(
    COMMAND_SHOW_EXECUTION_ITEM_DETAILS,
    async (args?: ShowExecutionItemDetailsArgs) => {
      await showExecutionItemDetails(args);
    }
  );
  const rerunSessionCommand = vscode.commands.registerCommand(
    COMMAND_RERUN_SESSION,
    async (args?: RerunSessionCommandArgs) => {
      await rerunSession(args);
    }
  );
  const rerunFailedSessionCommand = vscode.commands.registerCommand(
    COMMAND_RERUN_FAILED_SESSION,
    async (args?: RerunSessionCommandArgs) => {
      await rerunFailedSession(args);
    }
  );
  const filterAllCommand = vscode.commands.registerCommand(COMMAND_FILTER_ALL, () => {
    runtime!.executionPanelProvider.setFilter('all');
  });
  const filterFailedCommand = vscode.commands.registerCommand(COMMAND_FILTER_FAILED, () => {
    runtime!.executionPanelProvider.setFilter('failed');
  });
  const filterPassedCommand = vscode.commands.registerCommand(COMMAND_FILTER_PASSED, () => {
    runtime!.executionPanelProvider.setFilter('passed');
  });
  const onDidChangeCodeLensesEmitter = new vscode.EventEmitter<void>();
  const codeLensProvider = vscode.languages.registerCodeLensProvider(
    [{ scheme: 'file', pattern: '**/*.feature' }],
    {
      onDidChangeCodeLenses: onDidChangeCodeLensesEmitter.event,
      provideCodeLenses(document) {
        return provideScenarioCodeLenses(document);
      },
    }
  );
  const codeLensRefreshSubscription = runtime!.executionSessionStore.subscribe(() => {
    onDidChangeCodeLensesEmitter.fire();
  });
  const executionPanel = vscode.window.registerTreeDataProvider(
    'bdd-vscode-runner.executionPanel',
    runtime!.executionPanelProvider
  );
  const configurationChangeSubscription = vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration('bdd-vscode-runner')) {
      runtime!.configuration = readRunnerConfiguration();
    }
  });

  context.subscriptions.push(
    runCurrentScenarioCommand,
    runCurrentFeatureCommand,
    runSelectedFeaturesCommand,
    debugCurrentScenarioCommand,
    runFeatureFolderCommand,
    runByTagCommand,
    cancelRunCommand,
    showOutputCommand,
    openLastFailureLocationCommand,
    showExecutionItemDetailsCommand,
    rerunSessionCommand,
    rerunFailedSessionCommand,
    filterAllCommand,
    filterFailedCommand,
    filterPassedCommand,
    codeLensProvider,
    new vscode.Disposable(codeLensRefreshSubscription),
    onDidChangeCodeLensesEmitter,
    executionPanel,
    configurationChangeSubscription,
    runtime!.executionPanelProvider,
    runtime!.executionDetailWebview,
    runtime!.outputChannel,
    runtime!.statusBarItem,
    runtime!.failureDiagnostics
  );

  console.log('BDD VSCode Runner is active.');
}

export function deactivate() {
  runtime = undefined;
}

function readRunnerConfiguration(): RunnerConfiguration {
  const configuration = vscode.workspace.getConfiguration('bdd-vscode-runner');
  return {
    mavenExecutable: configuration.get<string>('mavenExecutable', ''),
    testClassName: configuration.get<string>('testClassName', 'RunCucumberTest'),
    enableNdjsonPlugin: configuration.get<boolean>('enableNdjsonPlugin', true),
  };
}

class ExtensionRuntime {
  readonly outputChannel: vscode.OutputChannel;
  readonly statusBarItem: vscode.StatusBarItem;
  readonly failureDiagnostics: vscode.DiagnosticCollection;
  readonly processRunner: ProcessRunnerCoordinator;
  readonly executionHistory: ExecutionHistory;
  readonly executionSessionStore: ExecutionSessionStore;
  readonly executionPanelProvider: ExecutionPanelProvider;
  readonly executionDetailWebview: ExecutionDetailWebviewManager;
  lastFailureTargets: FailureNavigationTarget[] = [];
  configuration: RunnerConfiguration;

  constructor(context: vscode.ExtensionContext) {
    this.configuration = readRunnerConfiguration();
    this.outputChannel = vscode.window.createOutputChannel('BDD Runner');
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.failureDiagnostics = vscode.languages.createDiagnosticCollection('bdd-runner');
    this.statusBarItem.command = COMMAND_SHOW_OUTPUT;
    this.statusBarItem.text = 'BDD Runner: Idle';
    this.statusBarItem.show();
    this.processRunner = new ProcessRunnerCoordinator();
    this.executionHistory = new ExecutionHistory();
    this.executionSessionStore = new ExecutionSessionStore();
    this.executionPanelProvider = new ExecutionPanelProvider(this.executionSessionStore);
    this.executionDetailWebview = new ExecutionDetailWebviewManager(context.extensionUri);
  }
}

class ExecutionDetailWebviewManager implements vscode.Disposable {
  private panel?: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;

  constructor(extensionUri: vscode.Uri) {
    this.extensionUri = extensionUri;
  }

  show(session: ExecutionSession, selection: ExecutionDetailSelection): void {
    const detail = buildExecutionDetailDocument(session, selection);
    const html = buildDetailWebviewHtml(detail.title, detail.content, session, selection);

    if (this.panel) {
      this.panel.title = detail.title;
      this.panel.webview.html = html;
      this.panel.reveal(vscode.ViewColumn.Beside, true);
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'bdd-runner-detail',
      detail.title,
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      { enableScripts: false, retainContextWhenHidden: true }
    );
    this.panel.webview.html = html;
    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });
  }

  dispose(): void {
    this.panel?.dispose();
  }
}

async function runCurrentScenario(args?: RunScenarioCommandArgs): Promise<void> {
  if (args?.kind === 'debug') {
    await runCurrentScenarioWithDebug(args);
    return;
  }

  const target = await resolveScenarioExecutionTarget(args);

  if (!target) {
    return;
  }

  await runScenarioAtLine(target.document, target.targetLine, target.scenario, runtime!.configuration);
}

async function runCurrentScenarioWithDebug(args?: RunScenarioCommandArgs): Promise<void> {
  const target = await resolveScenarioExecutionTarget(args);
  if (!target) {
    return;
  }

  const workspaceFolder = vscode.workspace.getWorkspaceFolder(target.document.uri);
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('BDD Runner: Could not resolve workspace folder for debug.');
    return;
  }

  const workspaceRoot = workspaceFolder.uri.fsPath;
  const absoluteFeaturePath = target.document.uri.fsPath;
  const executionResolution = resolveMavenExecutionRoot(absoluteFeaturePath, workspaceRoot);
  const executionRoot = executionResolution.executionRoot;

  if (!executionRoot) {
    showMissingMavenExecutionRoot(workspaceRoot, absoluteFeaturePath, executionResolution.searchedDirectories);
    return;
  }

  const scenarioLineOneBased = target.targetLine + 1;
  const cucumberFeatureArg = buildCucumberFeatureArg(executionRoot, absoluteFeaturePath, scenarioLineOneBased);
  const mavenExecutable = resolveMavenExecutable(executionRoot, runtime!.configuration.mavenExecutable);
  const testClassName = runtime!.configuration.testClassName;

  const debugConfig: vscode.DebugConfiguration = {
    type: 'java',
    name: `BDD Debug: ${target.scenario.name}`,
    request: 'launch',
    mainClass: testClassName,
    args: [],
    vmArgs: [
      `-Dcucumber.features=${cucumberFeatureArg}`,
      `-Dtest=${testClassName}`,
    ].join(' '),
    cwd: executionRoot,
    projectName: '',
    env: {
      BDD_RUNNER_MAVEN_EXECUTABLE: mavenExecutable,
    },
  };

  const started = await vscode.debug.startDebugging(workspaceFolder, debugConfig);

  if (!started) {
    vscode.window.showErrorMessage(
      'BDD Runner: Could not start debug session. Make sure the Java debugger extension (vscjava.vscode-java-debug) is installed.'
    );
  }
}

async function runCurrentFeature(args?: RunFeatureCommandArgs): Promise<void> {
  const document = await resolveFeatureExecutionDocument(args);

  if (!document) {
    return;
  }

  await runFeatureDocument(document, runtime!.configuration);
}

async function runSelectedFeatures(): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('BDD Runner: Could not resolve workspace folder.');
    return;
  }

  const workspaceRoot = workspaceFolder.uri.fsPath;
  const featureUris = await vscode.workspace.findFiles(
    new vscode.RelativePattern(workspaceFolder, '**/*.feature'),
    '**/{node_modules,target,out}/**'
  );

  if (featureUris.length === 0) {
    vscode.window.showInformationMessage('BDD Runner: No feature files found in workspace.');
    return;
  }

  const executionResolution = resolveMavenExecutionRoot(
    featureUris[0].fsPath,
    workspaceRoot
  );
  const executionRoot = executionResolution.executionRoot;

  if (!executionRoot) {
    showMissingMavenExecutionRoot(workspaceRoot, featureUris[0].fsPath, executionResolution.searchedDirectories);
    return;
  }

  const items: vscode.QuickPickItem[] = featureUris
    .map((uri) => ({
      label: path.relative(executionRoot, uri.fsPath),
      description: path.relative(workspaceRoot, uri.fsPath),
      detail: uri.fsPath,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select feature files to run (multi-select with Space)',
    canPickMany: true,
  });

  if (!selected || selected.length === 0) {
    return;
  }

  const cucumberFeatureArg = selected
    .map((item) => item.label)
    .join(',');

  const displayLabel = selected.length === 1
    ? path.basename(selected[0].label)
    : `${selected.length} features`;

  await runMavenExecution({
    document: undefined,
    executionRoot,
    cucumberFeatureArg,
    displayLabel,
    runTitle: 'Run Selected Features',
    runNoun: 'Feature selection',
    runningNoun: 'feature selection',
    targetAbsolutePath: executionRoot,
    scenarioLineOneBased: 1,
    configuration: runtime!.configuration,
    workspaceRoot,
    pomPath: executionResolution.pomPath,
    fallbackLineZeroBased: 0,
  });
}

async function runFeatureFolder(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('BDD Runner: No active editor found.');
    return;
  }

  const document = editor.document;
  const folderPath = path.dirname(document.uri.fsPath);
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('BDD Runner: Could not resolve workspace folder.');
    return;
  }

  const workspaceRoot = workspaceFolder.uri.fsPath;
  const executionResolution = resolveMavenExecutionRoot(document.uri.fsPath, workspaceRoot);
  const executionRoot = executionResolution.executionRoot;
  if (!executionRoot) {
    showMissingMavenExecutionRoot(workspaceRoot, folderPath, executionResolution.searchedDirectories);
    return;
  }

  let cucumberFeatureArg: string;
  try {
    cucumberFeatureArg = buildCucumberFeatureArg(executionRoot, folderPath);
  } catch {
    const relativeFolderPath = path.relative(executionRoot, folderPath);
    if (
      relativeFolderPath.length === 0 ||
      relativeFolderPath.startsWith('..') ||
      path.isAbsolute(relativeFolderPath)
    ) {
      vscode.window.showErrorMessage('BDD Runner: Feature folder is not under the Maven execution root.');
      return;
    }
    cucumberFeatureArg = relativeFolderPath;
  }

  await runMavenExecution({
    document,
    executionRoot,
    cucumberFeatureArg,
    displayLabel: path.basename(folderPath),
    runTitle: 'Run Feature Folder',
    runNoun: 'Feature folder',
    runningNoun: 'feature folder',
    targetAbsolutePath: folderPath,
    scenarioLineOneBased: 1,
    configuration: runtime!.configuration,
    workspaceRoot,
    pomPath: executionResolution.pomPath,
    fallbackLineZeroBased: 0,
  });
}

async function runByTag(): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('BDD Runner: Could not resolve workspace folder.');
    return;
  }

  const workspaceRoot = workspaceFolder.uri.fsPath;
  const featureUris = await vscode.workspace.findFiles(
    new vscode.RelativePattern(workspaceFolder, '**/*.feature'),
    '**/{node_modules,target,out}/**'
  );
  const tags = new Set<string>();

  for (const uri of featureUris) {
    let document: vscode.TextDocument;
    try {
      document = await vscode.workspace.openTextDocument(uri);
    } catch {
      continue;
    }
    const discovery = discoverFeatureDocument(
      (line) => document.lineAt(line).text,
      document.lineCount
    );
    for (const scenario of discovery.scenarios) {
      for (const tag of scenario.tags) {
        tags.add(tag);
      }
    }
  }

  const selectedTag = await vscode.window.showQuickPick([...tags].sort(), {
    placeHolder: 'Select a Cucumber tag to run',
  });
  if (!selectedTag) {
    return;
  }

  const executionResolution = resolveMavenExecutionRoot(
    path.join(workspaceRoot, '__bdd-runner-tag-target__.feature'),
    workspaceRoot
  );
  const executionRoot = executionResolution.executionRoot;
  if (!executionRoot) {
    showMissingMavenExecutionRoot(workspaceRoot, workspaceRoot, executionResolution.searchedDirectories);
    return;
  }

  await runMavenExecution({
    document: undefined,
    executionRoot,
    cucumberFeatureArg: '',
    tagFilter: selectedTag,
    featureAbsolutePathOverride: '',
    displayLabel: selectedTag,
    runTitle: 'Run by Tag',
    runNoun: 'Tag',
    runningNoun: 'tag',
    configuration: runtime!.configuration,
    workspaceRoot,
    pomPath: executionResolution.pomPath,
    fallbackLineZeroBased: 0,
  });
}

async function showExecutionItemDetails(args?: ShowExecutionItemDetailsArgs): Promise<void> {
  if (!args?.session || !args.selection) {
    vscode.window.showInformationMessage('BDD Runner: No execution item details are available yet.');
    return;
  }
  runtime!.executionDetailWebview.show(args.session, args.selection);
}

async function rerunSession(args?: RerunSessionCommandArgs): Promise<void> {
  const session = args?.session ?? runtime!.executionSessionStore.getLatest();
  if (!session) {
    vscode.window.showInformationMessage('BDD Runner: No execution session is available to rerun.');
    return;
  }

  await rerunExecutionSession(session);
}

async function rerunFailedSession(args?: RerunSessionCommandArgs): Promise<void> {
  const session = args?.session ?? runtime!.executionSessionStore.getSessions().find((candidate) => candidate.status === 'failed');
  if (!session) {
    vscode.window.showInformationMessage('BDD Runner: No failed execution session is available to rerun.');
    return;
  }

  if (session.status !== 'failed') {
    vscode.window.showInformationMessage('BDD Runner: The selected session did not fail, so there is nothing to rerun as failed.');
    return;
  }

  const failedExample = session.examples.find((example) => example.status === 'failed');
  if (session.keyword === 'Scenario Outline' && failedExample && session.featureAbsolutePath) {
    await runCurrentScenario({
      uri: vscode.Uri.file(session.featureAbsolutePath),
      line: failedExample.line,
      scenarioName: session.scenarioName,
    });
    return;
  }

  await rerunExecutionSession(session);
}

async function rerunExecutionSession(session: ExecutionSession): Promise<void> {
  if (!session.featureAbsolutePath) {
    vscode.window.showErrorMessage('BDD Runner: The selected session does not have a feature file path to rerun.');
    return;
  }

  await runCurrentScenario({
    uri: vscode.Uri.file(session.featureAbsolutePath),
    line: session.scenarioLineOneBased - 1,
    scenarioName: session.scenarioName,
  });
}

async function runScenarioAtLine(
  document: vscode.TextDocument,
  targetLineZeroBased: number,
  scenarioMetadata: NonNullable<ReturnType<typeof findNearestScenarioMetadata>>,
  configuration: RunnerConfiguration
): Promise<void> {
  const absoluteFeaturePath = document.uri.fsPath;
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);

  if (!workspaceFolder) {
    vscode.window.showErrorMessage('BDD Runner: Could not resolve workspace folder.');
    return;
  }

  const workspaceRoot = workspaceFolder.uri.fsPath;
  const executionResolution = resolveMavenExecutionRoot(absoluteFeaturePath, workspaceRoot);
  const executionRoot = executionResolution.executionRoot;
  const scenarioLineOneBased = targetLineZeroBased + 1;

  if (!executionRoot) {
    showMissingMavenExecutionRoot(workspaceRoot, absoluteFeaturePath, executionResolution.searchedDirectories);
    return;
  }

  await runMavenExecution({
    document,
    executionRoot,
    cucumberFeatureArg: buildCucumberFeatureArg(executionRoot, absoluteFeaturePath, scenarioLineOneBased),
    displayLabel: scenarioMetadata.name,
    scenarioMetadata,
    scenarioLineOneBased,
    configuration,
    workspaceRoot,
    pomPath: executionResolution.pomPath,
    fallbackLineZeroBased: targetLineZeroBased,
  });
}

async function runFeatureDocument(document: vscode.TextDocument, configuration: RunnerConfiguration): Promise<void> {
  const discovery = discoverFeatureDocument(
    (line) => document.lineAt(line).text,
    document.lineCount
  );
  const absoluteFeaturePath = document.uri.fsPath;
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);

  if (!workspaceFolder) {
    vscode.window.showErrorMessage('BDD Runner: Could not resolve workspace folder.');
    return;
  }

  const workspaceRoot = workspaceFolder.uri.fsPath;
  const executionResolution = resolveMavenExecutionRoot(absoluteFeaturePath, workspaceRoot);
  const executionRoot = executionResolution.executionRoot;
  const featureLineOneBased = (discovery.featureLine ?? 0) + 1;
  const featureName = discovery.featureName ?? path.basename(absoluteFeaturePath);

  if (!executionRoot) {
    showMissingMavenExecutionRoot(workspaceRoot, absoluteFeaturePath, executionResolution.searchedDirectories);
    return;
  }

  await runMavenExecution({
    document,
    executionRoot,
    cucumberFeatureArg: buildCucumberFeatureArg(executionRoot, absoluteFeaturePath),
    displayLabel: featureName,
    scenarioLineOneBased: featureLineOneBased,
    configuration,
    workspaceRoot,
    pomPath: executionResolution.pomPath,
    fallbackLineZeroBased: discovery.featureLine ?? 0,
  });
}

async function runMavenExecution(params: MavenRunParams): Promise<void> {
  const absoluteFeaturePath = params.featureAbsolutePathOverride ?? params.targetAbsolutePath ?? params.document?.uri.fsPath ?? '';
  const relativeFeaturePath = params.tagFilter || absoluteFeaturePath.length === 0
    ? ''
    : path.relative(params.executionRoot, absoluteFeaturePath);
  const runNoun = params.runNoun ?? (params.scenarioMetadata ? 'Scenario' : 'Feature');
  const runningNoun = params.runningNoun ?? (params.scenarioMetadata ? 'scenario' : 'feature');
  const args = buildMavenArgs(params);
  const executable = resolveMavenExecutable(params.executionRoot, params.configuration.mavenExecutable);
  const displayCommand = `${executable} ${args.join(' ')}`;

  runtime!.outputChannel.clear();
  runtime!.outputChannel.show(true);
  logExecutionHeader(params, displayCommand, relativeFeaturePath);

  const startedAt = Date.now();
  const context = buildExecutionContext(params, displayCommand, relativeFeaturePath, startedAt);
  const runningRecord = runtime!.executionHistory.start(context, startedAt);
  updateStatusBar(runningRecord);
  clearFailureNavigation();

  let outputBuffer = '';
  const refreshRunningSession = createRunningSessionRefresher(params, context, () => outputBuffer);
  refreshRunningSession();
  vscode.window.setStatusBarMessage(`BDD Runner: ${runningNoun} running ${params.displayLabel}...`, 3000);
  const processStart = startMavenProcess(params, executable, args, displayCommand, refreshRunningSession, (chunk) => {
    outputBuffer += chunk;
  });

  if (!processStart.started) {
    vscode.window.showWarningMessage(`BDD Runner: Another ${runningNoun} run is already active.`);
    runtime!.outputChannel.appendLine(`[WARN] Another ${runningNoun} run is already active.`);
    return;
  }

  const durationTimer = setInterval(() => {
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    runtime!.statusBarItem.text = `BDD Runner: Running... ${elapsed}s`;
  }, 500);
  const runResult = await processStart.run.completed;
  clearInterval(durationTimer);
  const finishedStatus = getFinishedStatus(runResult);
  const finishedRecord = runtime!.executionHistory.finish(
    finishedStatus,
    runResult.exitCode,
    Date.now() - startedAt
  );

  if (finishedRecord) {
    updateStatusBar(finishedRecord);
  }

  await handleRunResult(params, runResult, context, outputBuffer, startedAt, finishedRecord);
}

function createRunningSessionRefresher(
  params: MavenRunParams,
  context: ExecutionContext,
  getOutputBuffer: () => string
): () => void {
  return () => {
    if (!params.scenarioMetadata) {
      return;
    }

    const outputBuffer = getOutputBuffer();
    let liveStepStatuses:
      | Map<string, import('./core/resultIngestion').LiveStepStatus>
      | undefined;

    if (params.configuration.enableNdjsonPlugin && !params.tagFilter) {
      liveStepStatuses = parseLiveNdjsonStepStatuses(outputBuffer, params.scenarioMetadata);
    }

    runtime!.executionSessionStore.setLatest(
      buildExecutionSession(
        context,
        params.scenarioMetadata,
        'running',
        [],
        outputBuffer,
        undefined,
        undefined,
        undefined,
        liveStepStatuses
      )
    );
  };
}

function startMavenProcess(
  params: MavenRunParams,
  executable: string,
  args: string[],
  displayCommand: string,
  refreshRunningSession: () => void,
  appendOutput: (chunk: string) => void
) {
  return runtime!.processRunner.start(
    {
      executable,
      args,
      cwd: params.executionRoot,
      env: process.env,
      displayCommand,
    },
    {
      onStart: (request) => {
        runtime!.outputChannel.appendLine(`[EXEC] ${request.displayCommand}`);
        runtime!.outputChannel.appendLine('');
      },
      onStdout: (chunk) => {
        appendOutput(chunk);
        runtime!.outputChannel.append(chunk);
        refreshRunningSession();
      },
      onStderr: (chunk) => {
        appendOutput(chunk);
        runtime!.outputChannel.append(chunk);
        refreshRunningSession();
      },
      onError: (error) => {
        runtime!.outputChannel.appendLine('');
        runtime!.outputChannel.appendLine(`[ERROR] Failed to start Maven: ${error.message}`);
      },
    }
  );
}

function getFinishedStatus(runResult: ProcessRunResult): ExecutionRecord['status'] {
  return runResult.cancelled
    ? 'cancelled'
    : runResult.exitCode === 0
      ? 'passed'
      : 'failed';
}

function buildMavenArgs(params: MavenRunParams): string[] {
  return [
    'test',
    `-Dtest=${params.configuration.testClassName}`,
    params.tagFilter
      ? `-Dcucumber.filter.tags=${params.tagFilter}`
      : `-Dcucumber.features=${params.cucumberFeatureArg}`,
    ...buildOptionalCucumberPluginArgs(params),
    '-e',
  ];
}

function logExecutionHeader(params: MavenRunParams, displayCommand: string, relativeFeaturePath: string): void {
  const isScenarioRun = params.scenarioMetadata !== undefined;
  const runTitle = params.runTitle ?? (isScenarioRun ? 'Run Current Scenario' : 'Run Current Feature');

  runtime!.outputChannel.appendLine('='.repeat(90));
  runtime!.outputChannel.appendLine(`BDD Runner: ${runTitle}`);
  runtime!.outputChannel.appendLine('='.repeat(90));
  runtime!.outputChannel.appendLine(`Workspace : ${params.workspaceRoot}`);
  runtime!.outputChannel.appendLine(`Execution : ${params.executionRoot}`);
  runtime!.outputChannel.appendLine(`POM       : ${params.pomPath}`);
  if (params.tagFilter) {
    runtime!.outputChannel.appendLine(`Tag       : ${params.tagFilter}`);
  } else {
    runtime!.outputChannel.appendLine(`Feature   : ${relativeFeaturePath}`);
  }
  if (params.scenarioMetadata) {
    runtime!.outputChannel.appendLine(`Line      : ${params.scenarioLineOneBased}`);
    runtime!.outputChannel.appendLine(`Scenario  : ${params.displayLabel}`);
  } else if (!params.tagFilter) {
    runtime!.outputChannel.appendLine(`Feature Nm: ${params.displayLabel}`);
  }
  runtime!.outputChannel.appendLine(`Command   : ${displayCommand}`);
  runtime!.outputChannel.appendLine(`Cancel    : command palette -> BDD Runner: Cancel Active Run`);
  runtime!.outputChannel.appendLine('='.repeat(90));
  runtime!.outputChannel.appendLine('');
}

function buildExecutionContext(
  params: MavenRunParams,
  displayCommand: string,
  relativeFeaturePath: string,
  startedAt: number
): ExecutionContext {
  return {
    workspaceRoot: params.workspaceRoot,
    executionRoot: params.executionRoot,
    pomPath: params.pomPath,
    featurePath: params.tagFilter ? '' : relativeFeaturePath,
    featureAbsolutePath: params.document?.uri.fsPath ?? params.featureAbsolutePathOverride ?? params.targetAbsolutePath ?? '',
    scenarioName: params.tagFilter
      ? `Tag: ${params.tagFilter}`
      : params.scenarioMetadata
        ? params.displayLabel
        : `Feature: ${params.displayLabel}`,
    scenarioLineOneBased: params.scenarioLineOneBased ?? 1,
    displayCommand,
    startedAt,
  };
}

async function handleRunResult(
  params: MavenRunParams,
  runResult: ProcessRunResult,
  context: ExecutionContext,
  outputBuffer: string,
  startedAt: number,
  finishedRecord: ExecutionRecord | undefined
): Promise<void> {
  const durationMs = Date.now() - startedAt;
  const durationSeconds = (durationMs / 1000).toFixed(2);
  const finishedStatus = runResult.cancelled
    ? 'cancelled'
    : runResult.exitCode === 0
      ? 'passed'
      : 'failed';
  const runNoun = params.runNoun ?? (params.scenarioMetadata ? 'Scenario' : 'Feature');
  const runningNoun = params.runningNoun ?? (params.scenarioMetadata ? 'scenario' : 'feature');
  const fallbackAbsolutePath = params.document?.uri.fsPath ?? params.featureAbsolutePathOverride ?? params.targetAbsolutePath ?? '';

  runtime!.outputChannel.appendLine('');
  runtime!.outputChannel.appendLine('='.repeat(90));
  runtime!.outputChannel.appendLine(
    `BDD Runner finished with exit code ${runResult.exitCode} in ${durationSeconds}s`
  );
  if (runResult.cancelled) {
    runtime!.outputChannel.appendLine(`BDD Runner ${runningNoun} run was cancelled.`);
  }
  runtime!.outputChannel.appendLine('='.repeat(90));
  if (finishedRecord) {
    runtime!.outputChannel.appendLine('');
    runtime!.outputChannel.appendLine('-'.repeat(90));
    for (const line of formatExecutionSummary(finishedRecord)) {
      runtime!.outputChannel.appendLine(line);
    }
    runtime!.outputChannel.appendLine('-'.repeat(90));
  }

  const failureAnalysisText = collectFailureAnalysisText(outputBuffer, params.executionRoot);
  const structuredResult = params.scenarioMetadata && !params.tagFilter
    ? collectStructuredExecutionResult(params.executionRoot, fallbackAbsolutePath, params.scenarioMetadata)
    : undefined;

  if (runResult.cancelled) {
    vscode.window.showWarningMessage(`BDD Runner: ${runNoun} run cancelled after ${durationSeconds}s.`);
  } else if (runResult.exitCode === 0) {
    vscode.window.showInformationMessage(`BDD Runner: ${runNoun} passed in ${durationSeconds}s.`);
  } else if (params.scenarioMetadata) {
    const failureDetails = extractFailureDetails(failureAnalysisText, params.workspaceRoot, params.executionRoot);
    const structuredFailureTargets = buildStructuredFailureTargets(structuredResult, fallbackAbsolutePath);
    const correlatedJavaTargets = buildFailureDetailTargets(failureDetails);
    const inferredFailureTargets = extractFailureNavigationTargets(
      failureAnalysisText,
      params.workspaceRoot,
      params.executionRoot
    );
    const hasStructuredFailureTargets = updateFailureNavigation(
      normalizeFailureTargets(
        mergeFailureTargets(structuredFailureTargets, correlatedJavaTargets, inferredFailureTargets)
      ),
      createScenarioFailureTarget(fallbackAbsolutePath, params.fallbackLineZeroBased, params.displayLabel),
      `BDD Runner failure for ${params.displayLabel}`
    );

    if (!hasStructuredFailureTargets) {
      vscode.window.showErrorMessage('BDD Runner: Scenario failed. See "BDD Runner" output.');
    }
  } else if (params.tagFilter) {
    const inferredFailureTargets = extractFailureNavigationTargets(
      failureAnalysisText,
      params.workspaceRoot,
      params.executionRoot
    );

    if (inferredFailureTargets.length > 0) {
      updateFailureNavigation(
        normalizeFailureTargets(inferredFailureTargets),
        inferredFailureTargets[0],
        `BDD Runner tag failure for ${params.tagFilter}`
      );
    } else {
      vscode.window.showErrorMessage('BDD Runner: Tag run failed. See "BDD Runner" output.');
    }
  } else {
    const inferredFailureTargets = extractFailureNavigationTargets(
      failureAnalysisText,
      params.workspaceRoot,
      params.executionRoot
    );
    const hasFailureTargets = updateFailureNavigation(
      normalizeFailureTargets(inferredFailureTargets),
      createScenarioFailureTarget(fallbackAbsolutePath, params.fallbackLineZeroBased, params.displayLabel),
      `BDD Runner feature failure for ${params.displayLabel}`
    );

    if (!hasFailureTargets) {
      vscode.window.showErrorMessage('BDD Runner: Feature failed. See "BDD Runner" output.');
    }
  }

  if (!params.scenarioMetadata) {
    const inferredFailureTargets = extractFailureNavigationTargets(
      failureAnalysisText,
      params.workspaceRoot,
      params.executionRoot
    );
    const nonScenarioSession = params.tagFilter
      ? buildTagExecutionSession(
          context,
          params.tagFilter,
          finishedStatus,
          inferredFailureTargets,
          failureAnalysisText,
          runResult.exitCode,
          durationMs
        )
      : buildFolderExecutionSession(
          context,
          params.displayLabel,
          finishedStatus,
          inferredFailureTargets,
          failureAnalysisText,
          runResult.exitCode,
          durationMs
        );
    runtime!.executionSessionStore.setLatest(nonScenarioSession);
    return;
  }

  const session = runtime!.executionSessionStore.setLatest(
    buildExecutionSession(
      context,
      params.scenarioMetadata,
      finishedStatus,
      runtime!.lastFailureTargets,
      failureAnalysisText,
      structuredResult,
      runResult.exitCode,
      durationMs
    )
  );

  runtime!.outputChannel.appendLine('');
  runtime!.outputChannel.appendLine('-'.repeat(90));
  for (const line of formatExecutionSessionSummary(session)) {
    runtime!.outputChannel.appendLine(line);
  }
  runtime!.outputChannel.appendLine('-'.repeat(90));
}

function buildOptionalCucumberPluginArgs(params: MavenRunParams): string[] {
  if (params.tagFilter || !params.scenarioMetadata || !params.configuration.enableNdjsonPlugin) {
    return [];
  }

  const ndjsonPath = path.join(params.executionRoot, 'target', 'cucumber-messages.ndjson');
  if (fs.existsSync(ndjsonPath)) {
    return [];
  }

  return ['-Dcucumber.plugin=message:target/cucumber-messages.ndjson'];
}

function showMissingMavenExecutionRoot(
  workspaceRoot: string,
  absoluteFeaturePath: string,
  searchedDirectories: string[]
): void {
  runtime!.outputChannel.clear();
  runtime!.outputChannel.show(true);
  runtime!.outputChannel.appendLine('='.repeat(90));
  runtime!.outputChannel.appendLine('BDD Runner: Maven execution root not found');
  runtime!.outputChannel.appendLine('='.repeat(90));
  runtime!.outputChannel.appendLine(`Workspace : ${workspaceRoot}`);
  runtime!.outputChannel.appendLine(`Feature   : ${absoluteFeaturePath}`);
  runtime!.outputChannel.appendLine('Searched  :');
  for (const directory of searchedDirectories) {
    runtime!.outputChannel.appendLine(`- ${directory}`);
  }
  runtime!.outputChannel.appendLine('='.repeat(90));

  vscode.window.showErrorMessage(
    'BDD Runner: Could not find a Maven execution root. No pom.xml was found between the feature file and the workspace folder.'
  );
}

function isFeatureFile(document: vscode.TextDocument): boolean {
  return document.uri.fsPath.endsWith('.feature');
}

function provideScenarioCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
  if (!isFeatureFile(document)) {
    return [];
  }

  const discovery = discoverFeatureDocument(
    (line) => document.lineAt(line).text,
    document.lineCount
  );
  const lenses: vscode.CodeLens[] = [];
  const featureLens = buildFeatureCodeLensItem(discovery);

  if (featureLens) {
    lenses.push(
      new vscode.CodeLens(new vscode.Range(featureLens.line, 0, featureLens.line, 0), {
        title: featureLens.title,
        command: COMMAND_RUN_CURRENT_FEATURE,
        arguments: [
          {
            uri: document.uri,
          } satisfies RunFeatureCommandArgs,
        ],
      })
    );
  }

  lenses.push(...buildScenarioCodeLensItems(
    discovery.scenarios,
    (lineOneBased) => runtime!.executionSessionStore.getStatusForLocation(document.uri.fsPath, lineOneBased)
  ).map((item) => {
    const range = new vscode.Range(item.line, 0, item.line, 0);

    return new vscode.CodeLens(range, {
      title: item.title,
      command: item.kind === 'debug'
        ? COMMAND_DEBUG_CURRENT_SCENARIO
        : COMMAND_RUN_CURRENT_SCENARIO,
      arguments: [
        {
          uri: document.uri,
          line: item.line,
          scenarioName: item.scenarioName,
          kind: item.kind,
        } satisfies RunScenarioCommandArgs,
      ],
    });
  }));

  return lenses;
}

async function resolveScenarioExecutionTarget(
  args?: RunScenarioCommandArgs
): Promise<{ document: vscode.TextDocument; targetLine: number; scenario: NonNullable<ReturnType<typeof findNearestScenarioMetadata>> } | undefined> {
  if (args?.uri && args.line !== undefined) {
    const document = await vscode.workspace.openTextDocument(args.uri);

    if (!isFeatureFile(document)) {
      vscode.window.showErrorMessage('BDD Runner: Target file is not a .feature file.');
      return undefined;
    }

    const discovery = discoverFeatureDocument(
      (line) => document.lineAt(line).text,
      document.lineCount
    );
    const scenario = findNearestScenarioMetadata(discovery.scenarios, args.line);
    if (!scenario) {
      vscode.window.showErrorMessage('BDD Runner: No Scenario or Scenario Outline found above target line.');
      return undefined;
    }

    return {
      document,
      targetLine: args.line,
      scenario,
    };
  }

  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    vscode.window.showErrorMessage('BDD Runner: No active editor found.');
    return undefined;
  }

  const document = editor.document;

  if (!isFeatureFile(document)) {
    vscode.window.showErrorMessage('BDD Runner: Active file is not a .feature file.');
    return undefined;
  }

  const discovery = discoverFeatureDocument(
    (line) => document.lineAt(line).text,
    document.lineCount
  );
  const scenario = findNearestScenarioMetadata(discovery.scenarios, editor.selection.active.line);

  if (!scenario) {
    vscode.window.showErrorMessage('BDD Runner: No Scenario or Scenario Outline found above cursor.');
    return undefined;
  }

  return {
    document,
    targetLine: scenario.line,
    scenario,
  };
}

async function resolveFeatureExecutionDocument(args?: RunFeatureCommandArgs): Promise<vscode.TextDocument | undefined> {
  if (args?.uri) {
    const document = await vscode.workspace.openTextDocument(args.uri);

    if (!isFeatureFile(document)) {
      vscode.window.showErrorMessage('BDD Runner: Target file is not a .feature file.');
      return undefined;
    }

    return document;
  }

  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    vscode.window.showErrorMessage('BDD Runner: No active editor found.');
    return undefined;
  }

  if (!isFeatureFile(editor.document)) {
    vscode.window.showErrorMessage('BDD Runner: Active file is not a .feature file.');
    return undefined;
  }

  return editor.document;
}

async function cancelActiveRun(): Promise<void> {
  const cancelled = runtime!.processRunner.cancelActiveRun();

  if (!cancelled) {
    vscode.window.showInformationMessage('BDD Runner: No active run to cancel.');
    return;
  }

  runtime!.outputChannel.appendLine('[INFO] Cancellation requested for active Maven run.');
  vscode.window.showInformationMessage('BDD Runner: Cancellation requested.');
}

async function openLastFailureLocation(): Promise<void> {
  const target = runtime!.lastFailureTargets[0];

  if (!target) {
    vscode.window.showInformationMessage('BDD Runner: No failure location is available yet.');
    return;
  }

  await openFailureTarget(target);
  runtime!.outputChannel.appendLine(`[INFO] Opened last failure target: ${target.label} (${target.source})`);
  vscode.window.showInformationMessage(`BDD Runner: Opened failure location for ${target.label}.`);
}

function updateStatusBar(record: ExecutionRecord | undefined): void {
  runtime!.statusBarItem.text = getStatusBarText(record);
  runtime!.statusBarItem.tooltip = record
    ? formatExecutionSummary(record).join('\n')
    : 'BDD Runner: No execution recorded yet.';
}

function updateFailureNavigation(
  targets: FailureNavigationTarget[],
  fallbackTarget: FailureNavigationTarget,
  message: string
): boolean {
  runtime!.lastFailureTargets = targets.length > 0 ? targets : [fallbackTarget];

  const diagnosticMap = new Map<string, vscode.Diagnostic[]>();
  for (const target of runtime!.lastFailureTargets) {
    const range = new vscode.Range(target.lineZeroBased, 0, target.lineZeroBased, 0);
    const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Error);
    diagnostic.source = `BDD Runner (${target.source})`;
    const key = vscode.Uri.file(target.filePath).toString();
    const existing = diagnosticMap.get(key) ?? [];
    existing.push(diagnostic);
    diagnosticMap.set(key, existing);
  }

  runtime!.failureDiagnostics.clear();
  for (const [uriString, diagnostics] of diagnosticMap) {
    runtime!.failureDiagnostics.set(vscode.Uri.parse(uriString), diagnostics);
  }

  const primaryTarget = runtime!.lastFailureTargets[0];
  runtime!.outputChannel.appendLine('');
  runtime!.outputChannel.appendLine('-'.repeat(90));
  runtime!.outputChannel.appendLine('Failure Targets');
  for (const target of runtime!.lastFailureTargets) {
    runtime!.outputChannel.appendLine(
      `${target.source.padEnd(8)} : ${target.label} -> ${target.filePath}:${target.lineZeroBased + 1}`
    );
  }
  runtime!.outputChannel.appendLine('-'.repeat(90));

  const failureMessage =
    primaryTarget.source === 'scenario'
      ? 'BDD Runner: Failure location fallback is available at the scenario line.'
      : 'BDD Runner: Failure location is available.';

  void vscode.window
    .showErrorMessage(failureMessage, 'Open Failure Location', 'Show Output')
    .then(async (selection) => {
      if (selection === 'Open Failure Location') {
        await openFailureTarget(primaryTarget);
      } else if (selection === 'Show Output') {
        runtime!.outputChannel.show(true);
      }
    });

  return primaryTarget.source !== 'scenario';
}

function clearFailureNavigation(): void {
  runtime!.lastFailureTargets = [];
  runtime!.failureDiagnostics.clear();
}

async function openFailureTarget(target: FailureNavigationTarget): Promise<void> {
  try {
    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(target.filePath));
    const editor = await vscode.window.showTextDocument(document, { preview: false });
    const position = new vscode.Position(target.lineZeroBased, 0);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
  } catch {
    vscode.window.showErrorMessage(`BDD Runner: Could not open file ${target.filePath}.`);
  }
}

function mergeFailureTargets(
  ...targetGroups: FailureNavigationTarget[][]
): FailureNavigationTarget[] {
  const merged: FailureNavigationTarget[] = [];
  const seen = new Set<string>();

  for (const target of targetGroups.flat()) {
    const key = `${target.filePath}:${target.lineZeroBased}:${target.source}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(target);
  }

  return merged;
}

function buildDetailWebviewHtml(
  title: string,
  content: string,
  session: ExecutionSession,
  selection: ExecutionDetailSelection
): string {
  const failureDetails = session.status === 'failed'
    ? extractFailureDetails(session.outputText, session.workspaceRoot, session.executionRoot)
    : undefined;
  const escapedTitle = escapeHtml(title);
  const escapedScenarioName = escapeHtml(session.scenarioName);
  const statusBadge = buildStatusBadge(session.status);
  const metaRows = [
    ['Feature', session.featurePath || 'N/A'],
    ['Line', String(session.scenarioLineOneBased)],
    ['Execution Root', session.executionRoot],
    ['POM', session.pomPath ?? 'N/A'],
    ['Started', new Date(session.startedAt).toLocaleString()],
    ...(session.durationMs !== undefined ? [['Duration', `${(session.durationMs / 1000).toFixed(2)}s`]] : []),
    ...(session.structuredResultSource ? [['Structured Source', session.structuredResultSource]] : []),
  ];
  const selectionRows = buildSelectionRows(selection);
  const showStepList = selection.kind === 'session' || selection.kind === 'step';
  const assertionBlock = selection.kind === 'step' &&
    selection.step.status === 'failed' &&
    (failureDetails?.expected !== undefined || failureDetails?.actual !== undefined)
    ? `
      <div style="
        margin: 12px 0; padding: 10px 12px;
        border: 1px solid var(--bdd-red);
        border-radius: 4px;
        background: rgba(244,67,54,0.06);
        font-family: var(--bdd-font); font-size: 12px;
      ">
        <div style="color:var(--bdd-red);font-weight:bold;margin-bottom:6px">Assertion Failure</div>
        <div><span style="color:var(--bdd-gray)">Expected:</span> ${escapeHtml(failureDetails?.expected ?? 'N/A')}</div>
        <div><span style="color:var(--bdd-gray)">Actual  :</span> ${escapeHtml(failureDetails?.actual ?? 'N/A')}</div>
      </div>
    `
    : '';
  const failureTargets = session.failureTargets.length > 0
    ? `
      <details open>
        <summary style="background: var(--vscode-sideBarSectionHeader-background, #2d2d2d); padding: 4px 8px; font-size: 11px; font-weight: bold; text-transform: uppercase; cursor: pointer;">Failure Targets</summary>
        <div style="padding: 8px 0 0 0;">
          ${session.failureTargets.map((target) => `
            <div style="padding:3px 0; font-size:12px; font-family:var(--bdd-font)">
              ${buildFailureSourceLabel(target.source)} ${escapeHtml(target.label)}
            </div>
          `).join('')}
        </div>
      </details>
    `
    : '';
  const relevantOutput = extractRelevantOutputSection(content);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapedTitle}</title>
  <style>
    :root {
      --bdd-green:   #4CAF50;
      --bdd-red:     #F44336;
      --bdd-blue:    #2196F3;
      --bdd-orange:  #FF9800;
      --bdd-gray:    #9E9E9E;
      --bdd-surface: var(--vscode-editor-background);
      --bdd-border:  var(--vscode-panel-border, #444);
      --bdd-fg:      var(--vscode-editor-foreground);
      --bdd-font:    var(--vscode-editor-font-family, monospace);
    }
    body {
      font-family: var(--vscode-font-family, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      background: var(--bdd-surface);
      color: var(--bdd-fg);
      margin: 0;
      padding: 16px;
    }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
    table { width: 100%; border-collapse: separate; border-spacing: 0 4px; font-size: 12px; margin-bottom: 16px; }
    td:first-child { width: 140px; color: var(--bdd-gray); vertical-align: top; }
    td:last-child { font-family: var(--bdd-font); word-break: break-all; }
  </style>
</head>
<body>
  <div style="margin-bottom:16px">
    <h2 style="margin:0 0 6px 0; font-size:15px">${escapedTitle}</h2>
    <div>${statusBadge} &nbsp; <span style="color:var(--bdd-gray);font-size:12px">${escapedScenarioName}</span></div>
  </div>
  <table>
    ${metaRows.map(([key, value]) => `
      <tr>
        <td>${escapeHtml(key)}</td>
        <td>${escapeHtml(value)}</td>
      </tr>
    `).join('')}
  </table>
  <details open>
    <summary style="background: var(--vscode-sideBarSectionHeader-background, #2d2d2d); padding: 4px 8px; font-size: 11px; font-weight: bold; text-transform: uppercase; cursor: pointer;">Selection</summary>
    <div style="padding: 8px 0 0 0;">
      <table>
        ${selectionRows.map(([key, value]) => `
          <tr>
            <td>${escapeHtml(key)}</td>
            <td>${escapeHtml(value)}</td>
          </tr>
        `).join('')}
      </table>
    </div>
  </details>
  ${showStepList ? `
    <div style="margin: 16px 0;">
      ${session.steps.map((step) => buildStepHtml(step)).join('')}
    </div>
  ` : ''}
  ${assertionBlock}
  ${failureTargets}
  <details>
    <summary style="background: var(--vscode-sideBarSectionHeader-background, #2d2d2d); padding: 4px 8px; font-size: 11px; font-weight: bold; text-transform: uppercase; cursor: pointer;">RAW OUTPUT</summary>
    <pre style="
      font-family: var(--bdd-font); font-size: 11px;
      background: var(--vscode-textBlockQuote-background, #1e1e1e);
      padding: 10px; border-radius: 4px;
      white-space: pre-wrap; word-break: break-all;
      max-height: 400px; overflow-y: auto;
    ">${escapeHtml(relevantOutput)}</pre>
  </details>
</body>
</html>`;
}

function buildStatusBadge(status: string): string {
  const background = status === 'passed'
    ? 'var(--bdd-green)'
    : status === 'failed'
      ? 'var(--bdd-red)'
      : status === 'running'
        ? 'var(--bdd-blue)'
        : status === 'cancelled'
          ? 'var(--bdd-gray)'
          : 'var(--bdd-orange)';
  const animation = status === 'running' ? 'animation: pulse 1.2s infinite;' : '';

  return `<span style="border-radius: 12px; padding: 2px 10px; font-size: 11px; font-weight: bold; color: #fff; background: ${background}; ${animation}">${escapeHtml(status)}</span>`;
}

function buildSelectionRows(selection: ExecutionDetailSelection): Array<[string, string]> {
  switch (selection.kind) {
    case 'session':
      return [['Type', 'Session Overview']];
    case 'example':
      return [
        ['Type', 'Example Row'],
        ['Values', selection.example.values.join(' | ')],
        ['Status', selection.example.status],
        ['Line', String(selection.example.line + 1)],
      ];
    case 'hook':
      return [
        ['Type', `${selection.hook.kind} hook`],
        ['Status', selection.hook.status],
        ['Hook', selection.hook.text],
        ...(selection.hook.durationMs !== undefined
          ? [['Duration', `${(selection.hook.durationMs / 1000).toFixed(2)}s`] as [string, string]]
          : []),
      ];
    case 'step':
      return [
        ['Type', 'Step'],
        ['Status', selection.step.status],
        ['Line', String(selection.step.line + 1)],
        ['Step', selection.step.rawText],
        ...(selection.step.durationMs !== undefined
          ? [['Duration', `${(selection.step.durationMs / 1000).toFixed(2)}s`] as [string, string]]
          : []),
      ];
  }
}

function buildStepHtml(step: ExecutionSession['steps'][number]): string {
  const borderColor = step.status === 'passed'
    ? 'var(--bdd-green)'
    : step.status === 'failed'
      ? 'var(--bdd-red)'
      : 'var(--bdd-gray)';
  const background = step.status === 'failed' ? 'rgba(244,67,54,0.08)' : 'transparent';
  const icon = step.status === 'passed'
    ? '<span style="color:var(--bdd-green)">✓</span>'
    : step.status === 'failed'
      ? '<span style="color:var(--bdd-red)">✗</span>'
      : step.status === 'pending'
        ? '<span style="color:var(--bdd-gray)">○</span>'
        : step.status === 'skipped'
          ? '<span style="color:var(--bdd-gray)">○</span>'
          : '<span style="color:var(--bdd-blue);animation:pulse 1.2s infinite">●</span>';
  const durationSpan = step.durationMs !== undefined
    ? `<span style="color:var(--bdd-gray); margin-left: 8px;">${escapeHtml(`${(step.durationMs / 1000).toFixed(2)}s`)}</span>`
    : '';

  return `
    <div style="
      padding: 4px 8px; margin: 2px 0;
      border-left: 3px solid ${borderColor};
      background: ${background};
      font-family: var(--bdd-font); font-size: 12px;
    ">
      ${icon} ${escapeHtml(step.rawText)}
      ${durationSpan}
    </div>
  `;
}

function buildFailureSourceLabel(source: FailureNavigationTarget['source']): string {
  if (source === 'step') {
    return '<span style="background:var(--bdd-red);color:#fff;border-radius:4px;padding:1px 6px;font-size:10px">step</span>';
  }

  if (source === 'java') {
    return '<span style="background:var(--bdd-orange);color:#fff;border-radius:4px;padding:1px 6px;font-size:10px">java</span>';
  }

  return `<span style="background:var(--bdd-gray);color:#fff;border-radius:4px;padding:1px 6px;font-size:10px">${escapeHtml(source)}</span>`;
}

function extractRelevantOutputSection(content: string): string {
  const marker = 'Relevant Output\n---------------\n';
  const markerIndex = content.indexOf(marker);
  if (markerIndex < 0) {
    return content;
  }

  return content.slice(markerIndex + marker.length).trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
