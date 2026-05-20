# Project Vision

BDD VSCode Runner is a VS Code extension for Java, Maven, and Cucumber BDD projects. Its purpose is to make scenario discovery, execution, feedback, and navigation more accessible in VS Code while preserving the execution model teams already trust.

The extension is an orchestration, developer experience, and observability layer. It must not replace Maven, Cucumber, Appium, Playwright, Allure, hooks, test frameworks, IDE workflows, or CI/CD pipelines.

## Product Goals

- Run BDD scenarios through canonical Maven execution.
- Support a zero-config first run for common Java Maven Cucumber projects.
- Keep IntelliJ IDEA, Maven CLI, Cucumber runners, Appium, Playwright, Allure, and CI/CD behavior valid.
- Support real-world Maven layouts, monorepos, and multi-module projects over time.
- Provide reusable execution logic for Command Palette, CodeLens, Debug Scenario, TreeView, and future entry points.
- Improve developer feedback without requiring project-specific conventions.
- Provide a user-friendly VS Code experience with clear actions, safe defaults, understandable errors, and minimal workflow interruption.

## Non-Goals

- Replacing Maven or generating an alternative test execution engine.
- Replacing Cucumber, Appium, Playwright, Allure, hooks, or existing automation frameworks.
- Modifying `.feature` files.
- Requiring first-run configuration for ordinary supported projects.
- Encoding organization-specific or repository-specific assumptions.
- Making VS Code workspace root equivalent to Maven execution root.

## Success Criteria

- A user can run supported scenarios from VS Code using the same Maven behavior expected from the terminal.
- A first-time user can understand available actions and failure states without reading project-specific setup notes.
- The extension remains generic across Java Maven Cucumber projects.
- Existing CI/CD and IntelliJ workflows remain compatible.
- Failure output becomes easier to inspect without changing test semantics.
- Architecture decisions keep future discovery, observability, and enterprise features possible.
