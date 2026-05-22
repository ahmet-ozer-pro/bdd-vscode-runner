# BDD VSCode Runner

BDD VSCode Runner is a VS Code extension for running Java + Maven + Cucumber BDD scenarios while preserving canonical Maven execution.

It does not replace Maven, Cucumber, Appium, Playwright, Allure, hooks, or CI. It acts as an orchestration, developer-experience, and observability layer on top of existing project behavior.

## Current Capabilities

- Run the current `Scenario` or `Scenario Outline` through canonical Maven feature-line execution
- Run the current `.feature` file as a whole Maven+Cucumber feature target
- Run all feature files in the current folder (`BDD Runner: Run Feature Folder`)
- Select multiple feature files via Quick Pick and run them together (`BDD Runner: Run Selected Features`)
- Run all scenarios matching a tag via Quick Pick (`BDD Runner: Run by Tag`)
- Debug the current scenario using a real Java launch configuration (`BDD Runner: Debug Scenario`)
- Resolve the nearest valid Maven execution root instead of assuming the VS Code workspace root
- Auto-detect `mvnw` / `mvnw.cmd`; fall back to `mvn` only when no wrapper exists
- Surface `BDD Run Scenario`, `BDD Run Feature`, `⚙ Config`, and example-row CodeLens actions in `.feature` files
- Reflect last-run status (✓ / ✗ / ⊘ / ▶) in CodeLens
- Editor right-click context menu for `.feature` files
- Prevent overlapping runs and support active-run cancellation
- Show real-time duration counter in the status bar during a run
- Maintain a shared execution session model with discovered steps, hooks, examples, durations, and failure targets
- Show recent runs in a dedicated `BDD Runner` activity-bar panel with feature -> scenario grouping
- Filter panel sessions by pass/fail status with toolbar buttons
- Update running step state from streamed NDJSON events (stdout regex fallback)
- Provide failure navigation to the best available feature or source location
- Correlate failed steps with step-definition Java methods, assertion values, and related project frames
- Open item-specific execution detail Webview views with IntelliJ-style status badges, colored step rows, and assertion blocks
- Rerun failed scenario sessions from the execution panel, including failed `Scenario Outline` example rows
- Tag and folder run sessions visible in the execution panel alongside scenario sessions

## Execution Panel

The `BDD Runner` activity-bar view is the beginning of an IntelliJ-like run surface in VS Code.

Today it shows:

- recent scenario runs
- rerun actions for the recorded session and its failed target
- examples, hooks, steps, and failure targets from the shared execution session model
- live step-state updates during running executions
- item-specific execution detail views with relevant output excerpts
- failed-step details with assertion summaries, step-definition references, and related project-frame context
- failure targets when available
- a direct link to the output channel

This panel reuses the same canonical execution path as Command Palette and CodeLens.

## Constraints

- Canonical Maven execution must remain unchanged
- `.feature` files must not be modified
- First-run configuration must not be required for common Maven + Cucumber layouts
- IntelliJ, Maven, Cucumber, Appium, Playwright, Allure, and CI workflows must remain valid

## Development

```bash
npm run compile
npm run lint
npm test
```

`npm test` runs the unit test suite. Integration-style extension host tests can be added later through `npm run test:integration`.

## Documentation

- [Project Vision](docs/PROJECT_VISION.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Engineering Principles](docs/ENGINEERING_PRINCIPLES.md)
- [Roadmap](docs/roadmap/ROADMAP.md)
- [Execution Experience Plan](docs/roadmap/EXECUTION_EXPERIENCE_PLAN.md)
- [IntelliJ Parity Priority Roadmap](docs/roadmap/INTELLIJ_PARITY_PRIORITY_ROADMAP.md)
