# Phase

`[ + ]` Phase 6: Observability

# Goal

Improve visibility into Maven and Cucumber execution from VS Code without changing test semantics.

# Scope

- Surface execution status, command context, duration, and relevant output.
- Classify common failure and progress signals where safe.
- Provide data useful to failure navigation and reporting integrations.
- Support live step status updates from safe stdout signals while preferring structured result data when available.

# Non-Goals

- Rewriting framework output.
- Hiding Maven failures.
- Replacing Allure or CI reporting.

# Architectural Constraints

- Canonical Maven execution must be preserved.
- Observability must not change Maven, Cucumber, Appium, Playwright, Allure, hooks, or CI behavior.
- Extension must remain an orchestration and feedback layer.
- Observability data should be reusable by future UI surfaces.

# Dependencies

- Phase 5 process architecture.
- Stable execution context from earlier phases.
- Access to process output and lifecycle events.

# Risks

- Over-classification may mislead users.
- Output parsing may be framework-version sensitive.
- Large output streams may affect performance.

# Acceptance Criteria

- Users can see what command ran and where it ran.
- Execution status and key output are available in VS Code.
- Live step state can update during a run when signals are trustworthy, while uncertain signals remain pending or raw output.
- Observability does not mask or reinterpret failures as success.
- Existing workflows remain valid outside VS Code.

# Rollback Impact

Rollback reduces VS Code feedback while leaving execution behavior unchanged.

# Cross-Phase Checks

- Depends on Phase 5 process lifecycle data.
- Must not block Phase 7 failure navigation or Phase 8 Allure integration.
- Must not assume a specific test framework beyond Maven Cucumber context.
- Must not modify project files or require first-run configuration.

# Future Compatibility

Observability should support failure navigation, run history, TreeView summaries, Allure links, and future diagnostics.

It should evolve toward structured Cucumber JSON or message-style sources for step status, using terminal parsing as a fallback rather than the only source of truth.

## Recorded Parity Gaps

- P1: live step coloring is partially available, but stronger IntelliJ-like confidence depends on more durable step-status signals.
- P2: assertion-adjacent output should remain easy for failure detail rendering to consume.

# Completion Status

Completed
