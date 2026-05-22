# Phase

`[ + ]` Phase 4: CodeLens

# Goal

Provide in-editor actions for discovered Cucumber scenarios while reusing shared discovery and execution logic.

# Scope

- Show relevant CodeLens actions above scenarios or feature sections.
- Connect actions to canonical Maven execution.
- Keep CodeLens behavior generic across supported layouts.
- Expose Scenario Outline example-row run actions when discovery can map example rows safely.
- Reflect last-run status from the shared execution session store when available.

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

- CodeLens actions appear for discovered scenarios and supported feature-level entry points where supported.
- Scenario Outline example rows can receive distinct run actions once row metadata is available.
- Last-run status can be displayed without CodeLens owning execution state.
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

It should also support:

- last-run status markers for passed and failed scenarios
- separate Run and Debug affordances if they remain backed by the shared execution core
- tag-aware or example-row-aware run targets without duplicating Maven command construction

## Recorded Progress

- `[ + ]` CodeLens actions appear for discovered `Scenario` and `Scenario Outline` lines
- `[ + ]` Scenario Outline example rows have individually runnable CodeLens actions
- `[ + ]` Last-run status prefix (✓ / ✗ / ⊘ / ▶) reflects shared session store state
- `[ + ]` Run / Config (debug placeholder) split exists on each scenario lens
- `[ + ]` Feature-level run entry point exists via a dedicated feature CodeLens
- `[ + ]` Editor sağ tık context menüsünden Run Scenario, Run Feature, Run Feature Folder komutları erişilebilir

## Remaining Gaps

- P3: real debug launch configuration flow (placeholder shows "coming soon")
- P3: multi-feature file selection for a combined run

# Completion Status

Completed
