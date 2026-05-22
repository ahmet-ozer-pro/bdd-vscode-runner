# Phase

`[ + ]` Phase 2: Scenario Discovery

# Goal

Discover Cucumber features, scenarios, scenario outlines, examples, tags, and file locations in a generic way.

# Scope

- Read `.feature` files without modifying them.
- Identify scenario metadata needed by future execution and navigation features.
- Support common Maven Cucumber layouts while allowing broader layout support over time.
- Capture Background steps so every scenario session can show inherited setup steps.
- Capture Scenario Outline example rows as addressable run targets when line metadata is available.

# Non-Goals

- Running scenarios directly from discovery.
- Rewriting `.feature` files.
- Assuming a single repository layout.
- Replacing Cucumber parsing semantics.

# Architectural Constraints

- Extension must not modify `.feature` files.
- Extension must not require first-run configuration.
- Canonical Maven execution from Phase 1 must remain preserved.
- Discovery results should be reusable by CodeLens, Debug Scenario, TreeView, and future runners.

# Dependencies

- Phase 1 canonical execution contract.
- Access to workspace files.
- Stable mapping between discovered scenarios and document locations.

# Risks

- Naive parsing may misread tags, outlines, comments, or localized keywords.
- Discovery may become tied to one Maven layout.
- Large workspaces may expose performance issues.

# Acceptance Criteria

- Features and scenarios are discovered without project-specific assumptions.
- Background steps are represented separately and can be attached to scenario step lists.
- Scenario Outline examples expose stable row numbers and line numbers for per-example execution.
- `.feature` files remain unchanged.
- Discovery produces stable enough metadata for future UI surfaces.
- Existing execution behavior remains intact.

# Rollback Impact

Rollback removes scenario discovery capabilities while preserving canonical Maven execution.

# Cross-Phase Checks

- Depends on Phase 1 execution remaining canonical.
- Must not block Phase 3 from resolving Maven execution roots independently.
- Must not break existing Command Palette execution.
- Must preserve the invariant that VS Code workspace root is not necessarily Maven execution root.
- Must not require configuration before first use.
- After significant discovery changes, a Run and Debug smoke test should be attempted against a representative sample project to confirm discovery still supports real execution flow.

# Future Compatibility

Discovery should be suitable for CodeLens, TreeView grouping, failure navigation, scenario-specific execution, and multi-module workspace support.

It should also support tag-based execution, Background-aware failure navigation, and Scenario Outline example-row reruns without requiring panel-specific parsing.

## Recorded Parity Gaps

- P1: Background steps must appear in each scenario's step list so setup failures can be shown and navigated correctly.
- P1: Scenario Outline example rows should become first-class targets for CodeLens, rerun failed, and panel tree behavior.
- P2: parsed tag metadata should feed a future Quick Pick tag execution command.

# Completion Status

Completed
