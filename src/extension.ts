import * as vscode from 'vscode';
import * as path from 'path';
import { buildScenarioCodeLensItems } from './core/codeLens';
import { buildCucumberFeatureArg, resolveMavenExecutionRoot } from './core/mavenExecution';
import { ProcessRunnerCoordinator } from './core/processRunner';
import {
  discoverFeatureDocument,
  findNearestScenarioMetadata,
} from './core/scenarioDiscovery';

const COMMAND_RUN_CURRENT_SCENARIO = 'bdd-vscode-runner.runCurrentScenario';
const COMMAND_CANCEL_RUN = 'bdd-vscode-runner.cancelRun';

let outputChannel: vscode.OutputChannel;
let processRunner: ProcessRunnerCoordinator;

interface RunScenarioCommandArgs {
  uri?: vscode.Uri;
  line?: number;
  scenarioName?: string;
}

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('BDD Runner');
  processRunner = new ProcessRunnerCoordinator();

  const runCurrentScenarioCommand = vscode.commands.registerCommand(
    COMMAND_RUN_CURRENT_SCENARIO,
    async (args?: RunScenarioCommandArgs) => {
      await runCurrentScenario(args);
    }
  );
  const cancelRunCommand = vscode.commands.registerCommand(COMMAND_CANCEL_RUN, async () => {
    await cancelActiveRun();
  });
  const codeLensProvider = vscode.languages.registerCodeLensProvider(
    [{ scheme: 'file', pattern: '**/*.feature' }],
    {
      provideCodeLenses(document) {
        return provideScenarioCodeLenses(document);
      },
    }
  );

  context.subscriptions.push(runCurrentScenarioCommand, cancelRunCommand, codeLensProvider, outputChannel);

  console.log('BDD VSCode Runner is active.');
}

export function deactivate() {}

async function runCurrentScenario(args?: RunScenarioCommandArgs): Promise<void> {
  const target = await resolveScenarioExecutionTarget(args);

  if (!target) {
    return;
  }

  await runScenarioAtLine(target.document, target.scenarioLine, target.scenarioName);
}

async function runScenarioAtLine(
  document: vscode.TextDocument,
  scenarioLineZeroBased: number,
  scenarioName: string
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
  const scenarioLineOneBased = scenarioLineZeroBased + 1;

  if (!executionRoot) {
    outputChannel.clear();
    outputChannel.show(true);
    outputChannel.appendLine('='.repeat(90));
    outputChannel.appendLine('BDD Runner: Maven execution root not found');
    outputChannel.appendLine('='.repeat(90));
    outputChannel.appendLine(`Workspace : ${workspaceRoot}`);
    outputChannel.appendLine(`Feature   : ${absoluteFeaturePath}`);
    outputChannel.appendLine('Searched  :');
    for (const directory of executionResolution.searchedDirectories) {
      outputChannel.appendLine(`- ${directory}`);
    }
    outputChannel.appendLine('='.repeat(90));

    vscode.window.showErrorMessage(
      'BDD Runner: Could not find a Maven execution root. No pom.xml was found between the feature file and the workspace folder.'
    );
    return;
  }

  const relativeFeaturePath = path.relative(executionRoot, absoluteFeaturePath);
  const cucumberFeatureArg = buildCucumberFeatureArg(
    executionRoot,
    absoluteFeaturePath,
    scenarioLineOneBased
  );
  const args = ['test', `-Dcucumber.features=${cucumberFeatureArg}`, '-e'];

  outputChannel.clear();
  outputChannel.show(true);

  outputChannel.appendLine('='.repeat(90));
  outputChannel.appendLine('BDD Runner: Run Current Scenario');
  outputChannel.appendLine('='.repeat(90));
  outputChannel.appendLine(`Workspace : ${workspaceRoot}`);
  outputChannel.appendLine(`Execution : ${executionRoot}`);
  outputChannel.appendLine(`POM       : ${executionResolution.pomPath}`);
  outputChannel.appendLine(`Feature   : ${relativeFeaturePath}`);
  outputChannel.appendLine(`Line      : ${scenarioLineOneBased}`);
  outputChannel.appendLine(`Scenario  : ${scenarioName}`);
  outputChannel.appendLine(`Command   : mvn ${args.join(' ')}`);
  outputChannel.appendLine(`Cancel    : command palette -> BDD Runner: Cancel Active Run`);
  outputChannel.appendLine('='.repeat(90));
  outputChannel.appendLine('');

  const startedAt = Date.now();

  vscode.window.setStatusBarMessage('BDD Runner: scenario running...', 3000);

  const processStart = processRunner.start(
    {
      executable: 'mvn',
      args,
      cwd: executionRoot,
      env: process.env,
      displayCommand: `mvn ${args.join(' ')}`,
    },
    {
      onStart: (request) => {
        outputChannel.appendLine(`[EXEC] ${request.displayCommand}`);
        outputChannel.appendLine('');
      },
      onStdout: (chunk) => {
        outputChannel.append(chunk);
      },
      onStderr: (chunk) => {
        outputChannel.append(chunk);
      },
      onError: (error) => {
        outputChannel.appendLine('');
        outputChannel.appendLine(`[ERROR] Failed to start Maven: ${error.message}`);
      },
    }
  );

  if (!processStart.started) {
    vscode.window.showWarningMessage('BDD Runner: Another scenario run is already active.');
    outputChannel.appendLine('[WARN] Another scenario run is already active.');
    return;
  }

  const runResult = await processStart.run.completed;

  const durationSeconds = ((Date.now() - startedAt) / 1000).toFixed(2);

  outputChannel.appendLine('');
  outputChannel.appendLine('='.repeat(90));
  outputChannel.appendLine(
    `BDD Runner finished with exit code ${runResult.exitCode} in ${durationSeconds}s`
  );
  if (runResult.cancelled) {
    outputChannel.appendLine('BDD Runner run was cancelled.');
  }
  outputChannel.appendLine('='.repeat(90));

  if (runResult.cancelled) {
    vscode.window.showWarningMessage(`BDD Runner: Scenario run cancelled after ${durationSeconds}s.`);
  } else if (runResult.exitCode === 0) {
    vscode.window.showInformationMessage(`BDD Runner: Scenario passed in ${durationSeconds}s.`);
  } else {
    vscode.window.showErrorMessage('BDD Runner: Scenario failed. See "BDD Runner" output.');
  }
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

  return buildScenarioCodeLensItems(discovery.scenarios).map((item) => {
    const range = new vscode.Range(item.line, 0, item.line, 0);

    return new vscode.CodeLens(range, {
      title: item.title,
      command: COMMAND_RUN_CURRENT_SCENARIO,
      arguments: [
        {
          uri: document.uri,
          line: item.line,
          scenarioName: item.scenarioName,
        } satisfies RunScenarioCommandArgs,
      ],
    });
  });
}

async function resolveScenarioExecutionTarget(
  args?: RunScenarioCommandArgs
): Promise<{ document: vscode.TextDocument; scenarioLine: number; scenarioName: string } | undefined> {
  if (args?.uri && args.line !== undefined) {
    const document = await vscode.workspace.openTextDocument(args.uri);

    if (!isFeatureFile(document)) {
      vscode.window.showErrorMessage('BDD Runner: Target file is not a .feature file.');
      return undefined;
    }

    return {
      document,
      scenarioLine: args.line,
      scenarioName: args.scenarioName ?? document.lineAt(args.line).text.trim(),
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
    scenarioLine: scenario.line,
    scenarioName: scenario.name,
  };
}

async function cancelActiveRun(): Promise<void> {
  const cancelled = processRunner.cancelActiveRun();

  if (!cancelled) {
    vscode.window.showInformationMessage('BDD Runner: No active run to cancel.');
    return;
  }

  outputChannel.appendLine('[INFO] Cancellation requested for active Maven run.');
  vscode.window.showInformationMessage('BDD Runner: Cancellation requested.');
}

function quoteShellArg(value: string): string {
  if (/^[a-zA-Z0-9_./:=@-]+$/.test(value)) {
    return value;
  }

  return `'${value.replace(/'/g, `'\\''`)}'`;
}
