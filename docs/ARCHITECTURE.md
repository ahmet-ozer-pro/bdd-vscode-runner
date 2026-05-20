# Architecture

BDD VSCode Runner is organized around discovery, execution orchestration, and feedback surfaces. The extension should keep domain logic reusable so that multiple VS Code entry points can share the same behavior.

## Core Responsibilities

- Discover feature files, scenarios, tags, and likely execution context.
- Resolve the correct Maven execution root without assuming the VS Code workspace root is correct.
- Build canonical Maven commands without replacing Maven behavior.
- Stream and classify process output for developer feedback.
- Connect execution actions to Command Palette, CodeLens, Debug Scenario, TreeView, and future runners.
- Present user-facing actions, progress, and failures in a clear and consistent way across VS Code surfaces.

## Architectural Invariants

- Canonical Maven execution must be preserved.
- VS Code workspace root must not be assumed to be Maven execution root.
- The extension must not modify `.feature` files.
- The extension must not require first-run configuration.
- Existing IntelliJ, Maven, Cucumber, Appium, Playwright, Allure, and CI behavior must remain valid.
- Execution logic should be reusable by Command Palette, CodeLens, Debug Scenario, TreeView, and future runners.
- User-facing behavior should be predictable, discoverable, and consistent across extension entry points.

## Boundaries

The extension owns orchestration and developer experience inside VS Code. Maven owns build and test execution. Cucumber owns scenario semantics. Appium, Playwright, and other frameworks own their runtime behavior. Allure owns report generation and report semantics.

## User Experience Contract

The extension should reduce friction without hiding the real execution model. It should show what it is running, where it is running, and what the user can do next when discovery or execution cannot proceed safely.

## Evolution Model

Architecture should evolve phase by phase. Each phase must protect prior behavior, avoid blocking later phases, and keep implementation details generic enough for multi-module and monorepo support.
