# Phase

`[ + ]` Phase 9: TreeView Execution Panel

# Goal

Provide a VS Code TreeView panel for discovering, grouping, running, and observing BDD scenarios.

This phase should converge toward IntelliJ-like runner comprehension while preserving a VS Code-native interaction model.

# Scope

- Present discovered features, scenarios, modules, and execution state.
- Trigger shared execution actions from the TreeView.
- Surface relevant observability and failure information.
- Support a panel MVP that can evolve toward step-by-step pass and fail visualization when execution session data is available.
- Move selected-node behavior toward IntelliJ-like detail rendering for steps, hooks, examples, and failure context.
- Prepare the panel to expose IntelliJ-parity signals such as step-definition methods, assertion summaries, and related project frames when correlation data becomes available.
- Represent Background steps, Scenario Outline example rows, tag-filtered runs, and whole-feature runs through the same session model as scenario runs.
- Preserve recent-run history as the foundation for future session comparison without making comparison required for the current phase.

# Non-Goals

- Creating TreeView-specific execution logic.
- Replacing feature files as the source of truth.
- Replacing Maven, Cucumber, Allure, or CI reports.
- Copying IntelliJ UI literally when a clearer VS Code-native interaction can provide the same or better outcome.

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
- A reusable execution session model for step-level state.

# Risks

- Large repositories may require efficient grouping and refresh behavior.
- Tree state may become stale if workspace files change.
- UI actions could diverge from CodeLens or Command Palette behavior.

# Acceptance Criteria

- TreeView reflects discovered scenarios and relevant grouping.
- Run actions use shared canonical execution logic.
- Execution status is visible without changing test behavior.
- Existing entry points continue to work.
- The first panel version can present richer details than the output channel without inventing a separate execution model.
- Background steps and example rows can appear as first-class run-tree items once discovery and session data provide them.
- Tag-based runs and feature-level runs can be represented without creating panel-only execution behavior.
- Selected step or hook nodes can evolve toward IntelliJ-like detail views by reusing shared session data, correlated stack frames, and parsed assertion details rather than inventing panel-specific parsing rules.
- The phase direction must keep room for IntelliJ-plus behavior where VS Code can reduce navigation friction or surface relevant code more directly than a raw run console.

# Rollback Impact

Rollback removes the TreeView panel while preserving command, discovery, and execution functionality.

# Cross-Phase Checks

- Depends on shared execution and discovery layers.
- Must not block enterprise feature controls or future runners.
- Must not assume workspace root as Maven execution root.
- Must not require first-run configuration for common projects.

# Future Compatibility

The TreeView should support filters, run history, module grouping, failure summaries, Allure links, and enterprise workspace conventions.

It should also support:

- step-definition aware failure details
- assertion-aware detail rendering with `expected` and `actual`
- related project-frame browsing for failed items
- richer source correlation that keeps feature-step and Java-source context together
- optional IntelliJ-plus actions such as fastest-relevant-source reveal, grouped failure reasoning, and lower-friction movement between feature, Java source, and output detail
- last-run status alignment with CodeLens and editor gutters
- feature-folder and multi-feature run representation
- future session comparison based on retained shared sessions

## Recorded Progress

- `[ + ]` a dedicated `BDD Runner` activity-bar container exists
- `[ + ]` the first `Execution` panel exists
- `[ + ]` the panel now shows recent-session data rather than only latest-session data
- `[ + ]` the panel now shows example rows, before hooks, after hooks, and grouped step execution state from the shared execution session model
- `[ + ]` selecting session, example, hook, or step nodes now opens item-specific execution detail views with related output excerpts
- `[ + ]` the panel now retains recent execution sessions, creating a first run-history layer instead of replacing the entire view with only the latest run
- `[ + ]` running sessions now update step state during live execution instead of waiting until the full process ends
- `[ + ]` failure targets now include explicit Java source entries such as step-definition methods
- `[ + ]` failed-step detail now includes assertion values, step-definition correlation, cleaner failure output anchoring, and richer project-frame context
- `[ + ]` visible `Rerun Scenario`, `Rerun Failed`, and `Show Output` panel actions now exist
- `[ + ]` `Rerun Failed` now prefers the failed outline example row where available instead of behaving only like a generic rerun
- `[ + ]` execution detail görünümü Webview Panel'e taşındı; IntelliJ benzeri HTML/CSS ile durum rozetleri, renkli adım satırları, assertion bloğu ve kaynak etiketli failure target'lar sunuluyor
- `[ + ]` tag ve folder koşumları `ExecutionSessionStore`'a session olarak yazılıyor ve panel'de görünüyor
- `[ + ]` koşum süresinde status bar'da gerçek zamanlı sayaç akıyor
- `[ + ]` pass/fail filter controls added to the panel; toolbar buttons allow isolating failed or passed sessions
- `[ + ]` feature -> scenario tree grouping implemented; multi-feature sessions group under feature nodes
- `[ + ]` debug mode implemented via `vscode.debug.startDebugging`; `⚙ Config` CodeLens triggers a real Java debug launch
- `[ + ]` multi-feature selection command added with multi-select Quick Pick
- `[ + ]` live step status now reads NDJSON stream events when the plugin is active; stdout regex retained as fallback
- next work: pass/fail filter controls, feature -> scenario tree grouping, richer tag/folder session nodes, debug mode implementation
- next work should expand the panel into a richer run tree with stronger feature-run handling, smarter rerun subsets, and stronger source-ranking cleanup
- the current target is not only richer panel structure, but also IntelliJ-level execution understanding with room for VS Code-specific workflow advantages
- remaining parity gaps: scope-aware tag/folder session node depth, session comparison view, deeper feature->scenario->example tree, Background step visibility in run tree

# Completion Status

Substantially Complete - core acceptance criteria met; remaining gaps are tag/folder node depth, session comparison, and deeper tree hierarchy.
