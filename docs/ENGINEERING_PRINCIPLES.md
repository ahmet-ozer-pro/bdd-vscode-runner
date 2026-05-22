# Engineering Principles

## Preserve Existing Toolchains

The extension must amplify existing Java Maven Cucumber workflows, not redefine them. Maven commands, framework hooks, test lifecycle behavior, reports, and CI expectations must remain valid.

## Zero-Config First

Common projects should work without setup. Configuration may exist for advanced cases, but first-run behavior should infer safe defaults from standard Maven and Cucumber layouts.

Maven Wrapper projects are part of the common path. A repository-local `mvnw` or `mvnw.cmd` should be preferred automatically when available, with global `mvn` as a fallback and minimal optional settings only as an escape hatch.

## User-Friendly by Design

The extension should make common actions obvious and low-friction. Commands, CodeLens actions, TreeView entries, status messages, and errors should use clear language, avoid project-specific jargon, and guide users toward the next useful action without hiding the underlying Maven behavior.

## Generic by Default

Avoid project-specific names, paths, tags, profiles, or framework assumptions. Features should be useful across teams, repositories, monorepos, and multi-module layouts.

## Reusable Execution Core

Execution behavior should not be tied to one UI surface. Command Palette, CodeLens, Debug Scenario, TreeView, and future runners should share the same execution model.

Scenario, feature, tag, folder, and Scenario Outline example-row targets should flow through shared orchestration so executable resolution, configuration, process handling, result ingestion, and session updates remain consistent.

## Fail Transparently

When the extension cannot infer something safely, it should explain the issue and preserve the user's ability to run Maven manually. It must not silently change test behavior to make execution appear successful.

## Respect Developer Flow

The extension should avoid noisy prompts, surprising file changes, and modal interruptions unless user action is required. Feedback should be visible, actionable, and proportional to the severity of the situation.

## Verify Through VS Code

After each completed phase or any significant implementation change, the extension should be exercised through VS Code Run and Debug against a representative sample project when possible. This smoke test is used to confirm that extension behavior still works in a realistic developer flow, not only in isolated unit or integration checks.

## Documentation-Gated Phases

Each phase should state goals, scope, constraints, dependencies, risks, acceptance criteria, rollback impact, and cross-phase checks before implementation changes are made.
