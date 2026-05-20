# Phase

`[ + ]` Phase 3: Execution Root Discovery

# Goal

Resolve the correct Maven execution root for a scenario or project context without assuming the VS Code workspace root.

# Scope

- Detect Maven project roots using `pom.xml` relationships.
- Support nested modules and monorepo-friendly layouts.
- Provide root metadata that execution features can reuse.

# Non-Goals

- Replacing Maven reactor behavior.
- Requiring users to manually configure roots for ordinary layouts.
- Encoding organization-specific directory conventions.

# Architectural Constraints

- VS Code workspace root must not be assumed to be Maven execution root.
- Canonical Maven execution must be preserved.
- Existing IntelliJ, Maven, Cucumber, Appium, Playwright, Allure, and CI behavior must remain valid.
- Execution root logic must be reusable by all execution entry points.

# Dependencies

- Phase 1 canonical execution.
- Phase 2 scenario file location metadata.
- Maven `pom.xml` structure in the workspace.

# Risks

- Incorrect root selection could run the wrong module.
- Multi-module projects may require careful parent-child resolution.
- Monorepos may contain unrelated Maven projects.

# Acceptance Criteria

- Execution roots are inferred from Maven structure, not workspace assumptions.
- Scenario execution can target the appropriate Maven context.
- Ambiguous cases are surfaced clearly.
- Existing zero-config behavior remains available for common projects.

# Rollback Impact

Rollback returns execution to earlier root behavior and may reduce support for monorepos or nested modules.

# Cross-Phase Checks

- Depends on Phase 1 execution and Phase 2 scenario locations.
- Must not break single-module Maven projects.
- Must not block CodeLens, Debug Scenario, TreeView, or future runners from sharing root resolution.
- Must not modify project files or require first-run configuration.

# Future Compatibility

Root discovery should support enterprise workspace policies, multi-root workspaces, module grouping, and future execution panels.

# Completion Status

Completed
