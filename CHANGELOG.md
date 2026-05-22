# Change Log

All notable changes to the "bdd-vscode-runner" extension will be documented in this file.

## [Unreleased]

### Added

- Zero-config Maven Wrapper auto-detect (`mvnw` / `mvnw.cmd`)
- Minimal optional configuration: `mavenExecutable`, `testClassName`, `enableNdjsonPlugin`
- Shared `runMavenExecution` orchestration path for scenario, feature, tag, and folder runs
- Background steps attached to each scenario session
- Scenario Outline example-row CodeLens with individual run actions
- Last-run status prefix (✓ / ✗ / ⊘ / ▶) in CodeLens
- Tag-based execution via Quick Pick (`BDD Runner: Run by Tag`)
- Folder-based execution (`BDD Runner: Run Feature Folder`)
- Multi-feature selection via Quick Pick (`BDD Runner: Run Selected Features`)
- Debug scenario command wired to real Java launch configuration (`BDD Runner: Debug Scenario`)
- Execution detail Webview Panel with IntelliJ-style HTML: status badges, colored step rows, assertion block, labeled failure targets
- Pass/fail filter toolbar buttons in the execution panel
- Feature -> scenario tree grouping in the execution panel
- Tag and folder sessions stored in `ExecutionSessionStore` and visible in the panel
- Real-time duration counter in the status bar during a run
- Editor right-click context menu for `.feature` files: Run Scenario, Run Feature, Run Feature Folder
- Live step status from streamed NDJSON events (stdout regex retained as fallback)
- `spawnProcess` synchronous throw handling: failed handle resolves instead of hanging
- `onDidChangeConfiguration` listener for live configuration reload
- Safe fallback error messages for `openTextDocument` / `showTextDocument` failures

### Architecture

- `ExtensionRuntime` controller class encapsulates all extension state
- `runMavenExecution` decomposed into `buildMavenArgs`, `logExecutionHeader`, `buildExecutionContext`, `handleRunResult`
- `ExecutionDetailWebviewManager` replaces `ExecutionDetailContentProvider`
- `parseLiveNdjsonStepStatuses` feeds `projectLiveNdjsonSteps` as the preferred live step source
- Test coverage: 74 unit tests
