# Phase

Phase 7: Failure Navigation

# Goal

Help users move from execution failures to relevant source locations and output context.

# Scope

- Identify navigable failure signals from execution output where reliable.
- Link failures to feature files, steps, or related source locations when metadata permits.
- Preserve raw output for cases that cannot be classified.

# Non-Goals

- Changing failure semantics.
- Replacing Maven, Cucumber, Allure, or CI reports.
- Guaranteeing navigation for every framework-specific error.

# Architectural Constraints

- Canonical Maven execution must be preserved.
- Extension must not modify `.feature` files.
- Failure navigation must be based on observed output and discovered metadata.
- Existing IntelliJ, Maven, Cucumber, Appium, Playwright, Allure, and CI behavior must remain valid.

# Dependencies

- Phase 2 scenario discovery.
- Phase 5 process architecture.
- Phase 6 observability.

# Risks

- Stack traces and Cucumber output vary by version and plugin.
- Incorrect navigation may send users to misleading locations.
- Framework-specific failures may not map cleanly to feature files.

# Acceptance Criteria

- Reliable failures provide useful navigation targets.
- Unclassified failures still show raw Maven output.
- Navigation does not require editing project files.
- Existing execution behavior remains unchanged.

# Rollback Impact

Rollback removes failure links while preserving execution and output visibility.

# Cross-Phase Checks

- Depends on discovery and observability metadata.
- Must not block Allure integration from owning report-specific navigation.
- Must not assume workspace root is Maven execution root.
- Must not require first-run configuration or project-specific mappings.

# Future Compatibility

Failure navigation should support richer diagnostics, Allure report links, TreeView failed-run summaries, and multi-module source mapping.

# Completion Status

Planned
