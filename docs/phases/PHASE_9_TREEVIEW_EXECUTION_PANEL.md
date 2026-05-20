# Phase

Phase 9: TreeView Execution Panel

# Goal

Provide a VS Code TreeView panel for discovering, grouping, running, and observing BDD scenarios.

# Scope

- Present discovered features, scenarios, modules, and execution state.
- Trigger shared execution actions from the TreeView.
- Surface relevant observability and failure information.

# Non-Goals

- Creating TreeView-specific execution logic.
- Replacing feature files as the source of truth.
- Replacing Maven, Cucumber, Allure, or CI reports.

# Architectural Constraints

- TreeView must reuse shared discovery, root resolution, process, and execution logic.
- Canonical Maven execution must be preserved.
- Extension must not modify `.feature` files.
- Existing IntelliJ and CI behavior must remain valid.

# Dependencies

- Phase 2 scenario discovery.
- Phase 3 execution root discovery.
- Phase 5 process architecture.
- Phase 6 observability.
- Phase 7 failure navigation where available.

# Risks

- Large repositories may require efficient grouping and refresh behavior.
- Tree state may become stale if workspace files change.
- UI actions could diverge from CodeLens or Command Palette behavior.

# Acceptance Criteria

- TreeView reflects discovered scenarios and relevant grouping.
- Run actions use shared canonical execution logic.
- Execution status is visible without changing test behavior.
- Existing entry points continue to work.

# Rollback Impact

Rollback removes the TreeView panel while preserving command, discovery, and execution functionality.

# Cross-Phase Checks

- Depends on shared execution and discovery layers.
- Must not block enterprise feature controls or future runners.
- Must not assume workspace root as Maven execution root.
- Must not require first-run configuration for common projects.

# Future Compatibility

The TreeView should support filters, run history, module grouping, failure summaries, Allure links, and enterprise workspace conventions.

# Completion Status

Planned
