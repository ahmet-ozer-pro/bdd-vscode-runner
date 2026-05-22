# IntelliJ Parity Priority Roadmap

This document records the IntelliJ parity gaps from the May 2026 priority review while preserving the product constraint that common projects must keep a zero-config first run.

The guiding question for each item is:

- what the user loses compared with the IntelliJ runner
- whether the gap can break zero-config execution
- how much implementation work is likely required

## Priority Codes

| Code | Meaning | Definition |
| --- | --- | --- |
| P0 | Blocker | Breaks zero-config first run or makes the basic runner unusable |
| P1 | High | Daily IntelliJ workflow capability whose absence significantly hurts the runner experience |
| P2 | Medium | Useful parity improvement where an acceptable workaround exists |
| P3 | Low | Visual comfort or advanced convenience; not required for core execution |

## Priority Summary

| Priority | # | Capability | Zero-config impact | Current status |
| --- | --- | --- | --- | --- |
| P0 | 1 | Maven Wrapper auto-detect (`mvnw` / `mvnw.cmd`) | Critical | Completed |
| P0 | 2 | Minimal configuration support (`mavenExecutable`, `testClassName`) | Critical | Completed |
| P1 | 3 | Last-run status in gutter / CodeLens | Related | Completed |
| P1 | 4 | Live step coloring as steps complete | None | **Completed** (NDJSON stream preferred; stdout regex as fallback) |
| P1 | 5 | Scenario Outline example-row execution | None | Completed |
| P1 | 6 | Background steps included in scenario step lists | None | Completed |
| P2 | 7 | Tag-based execution through Quick Pick | None | Completed |
| P2 | 8 | Assertion detail rendering with expected / actual | None | Completed |
| P2 | 9 | Merge `runScenarioAtLine` and `runFeatureDocument` execution paths | None | Completed |
| P2 | 10 | Windows Maven command handling (`mvn.cmd`, `shell: true`) | Related | Completed |
| P3 | 11 | Separate gutter Run and Debug actions | None | **Completed** (debug command and CodeLens wired to real launch config) |
| P3 | 12 | Multi-feature or feature-folder execution | None | **Completed** (folder run + multi-select Quick Pick both available) |
| P3 | 13 | Session history comparison panel | None | Partial (history exists, comparison missing) |

## Recommended Implementation Order

> **May 2026 update:** Items #1-#12 are now completed or substantially addressed. Remaining open work is #13 (session comparison view - history exists, comparison UI absent). Phase 9 is substantially complete; Phase 8 (Allure) and Phase 10 (Enterprise) are the next planned phases.

1. Maven Wrapper auto-detect
2. Minimal configuration support
3. Shared execution function for scenario and feature runs
4. Background step discovery
5. Scenario Outline example-row CodeLens execution
6. Last-run CodeLens status
7. Windows Maven command handling
8. Assertion detail rendering
9. Tag-based execution
10. Live step coloring beyond current stdout-based inference

This order protects the zero-config first run before adding higher-level runner polish. The shared execution refactor is intentionally early because Maven executable resolution, configuration, tag filters, and platform behavior should be implemented once and reused by every run target.

## Phase Ownership

| Item | Primary phase | Supporting docs |
| --- | --- | --- |
| #1 Maven Wrapper auto-detect | Phase 1: Canonical Execution | Phase 5, Architecture |
| #2 Minimal configuration support | Phase 1: Canonical Execution | Phase 10, Architecture |
| #3 Last-run CodeLens status | Phase 4: CodeLens | Phase 9, Execution Experience Plan |
| #4 Live step coloring | Phase 6: Observability | Phase 9, Execution Experience Plan |
| #5 Example-row execution | Phase 4: CodeLens | Phase 2, Phase 9 |
| #6 Background steps | Phase 2: Scenario Discovery | Phase 7, Phase 9 |
| #7 Tag-based execution | Phase 4: CodeLens / runner UX | Phase 1, Phase 9 |
| #8 Assertion detail | Phase 7: Failure Navigation | Phase 9, Execution Experience Plan |
| #9 Shared execution function | Phase 5: Process Architecture | Phase 1, Architecture |
| #10 Windows command handling | Phase 5: Process Architecture | Phase 1 |
| #11 Run and Debug gutter split | Phase 4: CodeLens | Phase 9 |
| #12 Multi-feature / folder execution | Phase 9: TreeView Execution Panel | Phase 10 |
| #13 Session comparison | Phase 9: TreeView Execution Panel | Phase 10 |

## P0 Details

### #1 Maven Wrapper Auto-Detect

Modern Java projects commonly rely on a repository-local Maven Wrapper. If the extension always invokes `mvn`, projects that do not have Maven installed globally fail before the runner can start.

Required behavior:

- resolve the Maven executable from the execution root
- prefer `mvnw` on Unix-like systems when present
- prefer `mvnw.cmd` on Windows when present
- fall back to `mvn` only when no wrapper is available
- keep the behavior automatic and prompt-free

### #2 Minimal Configuration Support

Zero-config remains the default, but users need an override path when repository conventions differ.

Minimum supported settings:

- `bdd-vscode-runner.mavenExecutable`: empty means auto-detect; non-empty overrides executable resolution
- `bdd-vscode-runner.testClassName`: defaults to `RunCucumberTest`

Configuration must not become mandatory for first use.

## P1 Details

### #3 Last-Run Status In Gutter / CodeLens

CodeLens should eventually reflect the last known result for a scenario target:

- neutral run action before a session exists
- passed marker after a successful run
- failed marker after a failed run

The status source should be the shared execution session store rather than a CodeLens-local cache.

### #4 Live Step Coloring

The current live step update path is partial because terminal output is not always stable enough for precise step status. The near-term path may continue parsing safe stdout signals, while the stronger path should prefer structured message-style artifacts when available.

### #5 Scenario Outline Example-Row Execution

Each example row should become individually runnable when discovery provides its line number. The execution target should use the example row line, not only the `Scenario Outline` declaration line.

### #6 Background Steps

Background steps should be attached to each scenario session before scenario-specific steps. This improves tree accuracy and prevents failures in shared setup from appearing disconnected from the scenario run.

## P2 Details

### #7 Tag-Based Execution

The extension already discovers tags. A future command should allow users to select a tag through Quick Pick and run with `cucumber.filter.tags` while preserving canonical Maven execution.

### #8 Assertion Detail

Failure details should render parsed assertion values as structured `Expected` and `Actual` fields where output provides them, instead of requiring raw stack-trace scanning.

### #9 Shared Scenario / Feature Execution

Scenario and feature execution should share one orchestration path so executable resolution, configuration, tag filtering, process handling, result ingestion, and session updates stay consistent.

### #10 Windows Command Handling

Windows execution should correctly handle `.cmd` Maven executables and process spawning behavior. Wrapper selection and process options must be platform-aware.

## P3 Details

### #11 Separate Run And Debug Gutter Actions

Separate actions can improve visual parity, but they should not introduce a second execution model or imply unsupported framework debugging semantics.

### #12 Multi-Feature Or Feature-Folder Execution

Folder and multi-feature runs are useful for larger suites, but tag-based execution is usually a stronger earlier workflow. This belongs after single-target execution and rerun behavior are reliable.

### #13 Session History Comparison

Recent run history exists, but a comparison view is still an advanced panel feature. It should build on the shared session model rather than storing panel-specific snapshots.
