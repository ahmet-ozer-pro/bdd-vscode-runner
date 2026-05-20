# Phase

`[ + ]` Phase 4: CodeLens

# Goal

Provide in-editor actions for discovered Cucumber scenarios while reusing shared discovery and execution logic.

# Scope

- Show relevant CodeLens actions above scenarios or feature sections.
- Connect actions to canonical Maven execution.
- Keep CodeLens behavior generic across supported layouts.

# Non-Goals

- Creating a separate execution path for CodeLens.
- Modifying `.feature` files.
- Replacing Cucumber plugin behavior or IDE semantics.

# Architectural Constraints

- CodeLens must reuse execution logic shared with Command Palette and future runners.
- Canonical Maven execution must be preserved.
- Extension must not require first-run configuration.
- Existing IntelliJ and CI workflows must remain valid.

# Dependencies

- Phase 1 canonical execution.
- Phase 2 scenario discovery.
- Phase 3 execution root discovery where root ambiguity matters.

# Risks

- CodeLens actions may become noisy in large feature files.
- Scenario targeting may be incorrect if metadata is incomplete.
- UI behavior could accidentally fork execution semantics.

# Acceptance Criteria

- CodeLens actions appear for discovered scenarios where supported.
- Actions invoke shared execution orchestration.
- Existing Command Palette execution remains valid.
- `.feature` files are never changed.

# Rollback Impact

Rollback removes in-editor actions while preserving discovery and command-based execution.

# Cross-Phase Checks

- Depends on Phase 2 discovery and should use Phase 3 root resolution when available.
- Must not block TreeView or Debug Scenario from using the same execution core.
- Must not assume workspace root as Maven root.
- Must not change Maven, Cucumber, or framework behavior.

# Future Compatibility

CodeLens should support future debug actions, observability links, and failure navigation without owning execution logic.

# Completion Status

Completed
