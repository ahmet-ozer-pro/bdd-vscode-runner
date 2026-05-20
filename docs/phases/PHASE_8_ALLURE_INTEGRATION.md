# Phase

Phase 8: Allure Integration

# Goal

Integrate with existing Allure report outputs without replacing Allure or changing report generation semantics.

# Scope

- Detect existing Allure result or report locations where safely inferable.
- Provide links or commands that improve report access from VS Code.
- Respect project-owned Allure configuration.

# Non-Goals

- Generating custom replacement reports.
- Modifying Allure configuration.
- Requiring Allure for core execution.

# Architectural Constraints

- Allure behavior must remain project-owned.
- Canonical Maven execution must be preserved.
- Existing CI and IntelliJ workflows must remain valid.
- Integration must remain optional and generic.

# Dependencies

- Phase 5 process architecture.
- Phase 6 observability.
- Phase 7 failure navigation where report links can complement failures.

# Risks

- Allure paths differ by project and plugin configuration.
- Report generation may happen outside VS Code or CI only.
- Incorrect assumptions could create broken links.

# Acceptance Criteria

- Existing Allure artifacts can be surfaced when safely detected.
- Core execution works when Allure is absent.
- No Allure configuration files are modified.
- Report access does not change Maven or CI behavior.

# Rollback Impact

Rollback removes Allure conveniences while preserving Maven execution and project reporting behavior.

# Cross-Phase Checks

- Depends on execution and observability data.
- Must not block TreeView execution summaries or enterprise reporting features.
- Must not require Allure for first-run execution.
- Must not replace project-owned Allure behavior.

# Future Compatibility

Allure integration should support configurable report discovery, remote report links, CI artifact links, and enterprise policies without becoming mandatory.

# Completion Status

Planned
