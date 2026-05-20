# Phase

`[ + ]` Phase 1: Canonical Execution

# Goal

Establish Maven as the canonical execution path for running BDD scenarios from VS Code.

# Scope

- Invoke Maven rather than replacing it.
- Preserve project build and test lifecycle behavior.
- Provide the foundation for future execution entry points.

# Non-Goals

- Replacing Maven, Cucumber, Appium, Playwright, Allure, hooks, or framework runners.
- Adding scenario discovery beyond what is required for canonical execution.
- Introducing project-specific execution rules.

# Architectural Constraints

- Canonical Maven execution must be preserved.
- Existing IntelliJ, Maven, Cucumber, Appium, Playwright, Allure, and CI behavior must remain valid.
- Execution logic should be reusable by Command Palette, CodeLens, Debug Scenario, TreeView, and future runners.

# Dependencies

- Java Maven project structure.
- Maven available in the user's environment or project wrapper strategy.
- Existing project test framework configuration.

# Risks

- Incorrect command construction could diverge from terminal Maven behavior.
- Hardcoded paths could break monorepos and multi-module projects.
- Early coupling to one UI surface could make later phases harder.

# Acceptance Criteria

- Execution is delegated to Maven.
- The extension does not alter test framework behavior.
- Existing external workflows remain compatible.
- Execution behavior can be reused by future surfaces.

# Rollback Impact

Rollback removes VS Code-triggered execution while leaving Maven, project files, and CI behavior unchanged.

# Cross-Phase Checks

- Phase 2 must be able to attach scenario discovery to this execution foundation.
- Phase 3 must be able to improve root discovery without changing the canonical execution contract.
- Future CodeLens, Debug Scenario, and TreeView flows must not require separate execution logic.
- No `.feature` files or project build files are modified.
- After major execution changes, a Run and Debug smoke test should be attempted against a representative sample Maven Cucumber project.

# Future Compatibility

The execution model should support later root discovery, scenario targeting, output parsing, Allure links, and multiple VS Code invocation surfaces.

# Completion Status

Completed
