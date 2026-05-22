# Phase

`[ + ]` Phase 5: Process Architecture

# Goal

Create a reliable process model for starting, tracking, canceling, and reporting Maven execution from VS Code.

# Scope

- Standardize process lifecycle handling.
- Support output streaming and cancellation.
- Provide a shared process layer for all execution entry points.
- Centralize process options and executable selection so scenario, feature, tag, and example-row runs behave consistently.
- Handle platform-specific Maven invocation details, including Windows `.cmd` execution.

# Non-Goals

- Replacing Maven process behavior.
- Rewriting framework output.
- Introducing non-Maven execution paths.

# Architectural Constraints

- Canonical Maven execution must be preserved.
- Process handling must be reusable by Command Palette, CodeLens, Debug Scenario, TreeView, and future runners.
- Existing CI and terminal workflows must remain valid.
- Extension behavior must stay generic.

# Dependencies

- Phase 1 canonical execution.
- Phase 3 execution root discovery.
- Existing VS Code process and terminal APIs.

# Risks

- Process cancellation may leave child processes running.
- Output buffering may hide important feedback.
- Parallel runs may create confusing state if not modeled clearly.

# Acceptance Criteria

- Maven process lifecycle is observable and controllable.
- Scenario and feature execution reuse one orchestration path for process setup and lifecycle handling.
- Windows Maven executable handling is explicit and covered by the shared process layer.
- Output is available for later observability phases.
- Cancellation behavior is documented and predictable.
- Multiple UI surfaces can use the same process layer.

# Rollback Impact

Rollback returns to earlier process handling and may reduce cancellation or tracking consistency.

# Cross-Phase Checks

- Depends on canonical execution and root resolution.
- Must not break CodeLens or Command Palette execution.
- Must not block future observability, failure navigation, Allure integration, or TreeView state.
- Must not require changes to Maven projects.

# Future Compatibility

The process model should support structured output classification, run history, TreeView status, debug flows, and enterprise execution policies.

It should also support Maven Wrapper resolution, optional executable overrides, tag-based runs, feature-level runs, and Scenario Outline example-row runs without each entry point rebuilding process behavior independently.

## Recorded Progress

- `[ + ]` `runScenarioAtLine` and `runFeatureDocument` share one `runMavenExecution` orchestration path
- `[ + ]` Tag execution uses the same `runMavenExecution` path; separate `runTagMavenExecution` removed
- `[ + ]` `runMavenExecution` decomposed into `buildMavenArgs`, `logExecutionHeader`, `buildExecutionContext`, `handleRunResult`
- `[ + ]` Windows `.cmd` executable and `shell: true` handling in place
- `[ + ]` Maven Wrapper auto-detect (`mvnw` / `mvnw.cmd`) in place
- `[ + ]` `spawnProcess` synchronous throw is now caught; failed handle resolves instead of hanging
- `[ + ]` `openTextDocument` / `showTextDocument` calls have safe fallback error messages

# Completion Status

Completed
