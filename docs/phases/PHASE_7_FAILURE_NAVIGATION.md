# Phase

`[ + ]` Phase 7: Failure Navigation

# Goal

Help users move from execution failures to relevant source locations and output context.

# Scope

- Identify navigable failure signals from execution output where reliable.
- Link failures to feature files, steps, or related source locations when metadata permits.
- Preserve raw output for cases that cannot be classified.
- Establish the first safe layer for step-level failure targeting before full per-step execution visualization exists.
- Render assertion details as structured expected / actual values when they can be parsed safely.
- Use Background step metadata and Scenario Outline example-row metadata when they improve failed-target accuracy.

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
- Assertion details are exposed as structured fields when output provides expected and actual values.
- Unclassified failures still show raw Maven output.
- Navigation does not require editing project files.
- Existing execution behavior remains unchanged.
- Step-level failure mapping is attempted only when the output signal is specific enough to trust.

# Rollback Impact

Rollback removes failure links while preserving execution and output visibility.

# Cross-Phase Checks

- Depends on discovery and observability metadata.
- Must not block Allure integration from owning report-specific navigation.
- Must not assume workspace root is Maven execution root.
- Must not require first-run configuration or project-specific mappings.
- Must leave room for a later execution session model that can expose per-step state in a panel.

# Future Compatibility

Failure navigation should support richer diagnostics, Allure report links, TreeView failed-run summaries, and multi-module source mapping.

It should also be able to rank and expose:

- failed feature-step locations
- related step-definition methods
- relevant project-owned stack frames
- assertion summaries when stack traces provide them

## Recorded Progress

- `[ + ]` scenario-line fallback navigation exists
- `[ + ]` step-level feature URI mapping exists where output provides reliable file and line context
- `[ + ]` framework-noise filtering is in place for Java stack references
- `[ + ]` `surefire-reports` content is now part of failure analysis
- `[ + ]` structured result sources now feed failed-step targets before feature fallback when available
- future work should extend this completed foundation into richer step-definition and assertion-aware detail rendering without reopening canonical execution behavior
- P1 support: Background-aware step lists should improve setup failure targeting once discovery provides inherited steps.
- P2: assertion detail rendering should become visible in execution detail views as `Expected` and `Actual`, not only raw output text.

# Completion Status

Completed
