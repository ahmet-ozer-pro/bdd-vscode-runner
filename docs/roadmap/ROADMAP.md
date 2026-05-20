# Roadmap

This roadmap defines the phase order for building BDD VSCode Runner as a production-grade orchestration and observability extension for Java Maven Cucumber projects.

## Phase Status

| Phase | Area | Status |
| --- | --- | --- |
| 1 | `[ + ]` Canonical Execution | Completed |
| 2 | `[ + ]` Scenario Discovery | Completed |
| 3 | `[ + ]` Execution Root Discovery | Completed |
| 4 | `[ + ]` CodeLens | Completed |
| 5 | `[ + ]` Process Architecture | In Progress |
| 6 | Observability | Planned |
| 7 | Failure Navigation | Planned |
| 8 | Allure Integration | Planned |
| 9 | TreeView Execution Panel | Planned |
| 10 | Enterprise Features | Planned |

## Roadmap Rules

- Canonical Maven execution must remain the foundation.
- Discovery must support common layouts first and real-world multi-module layouts over time.
- UI surfaces must reuse execution logic rather than fork behavior.
- User-facing workflows must stay clear, predictable, and low-friction.
- Observability must improve feedback without changing framework semantics.
- Enterprise features must not make the extension project-specific.
- A `[ + ]` marker should be added next to a phase name when measurable progress has been made and should remain visible for in-progress or completed phases.

## Phase Documents

- [[ + ] Phase 1: Canonical Execution](../phases/PHASE_1_CANONICAL_EXECUTION.md)
- [[ + ] Phase 2: Scenario Discovery](../phases/PHASE_2_SCENARIO_DISCOVERY.md)
- [[ + ] Phase 3: Execution Root Discovery](../phases/PHASE_3_EXECUTION_ROOT_DISCOVERY.md)
- [[ + ] Phase 4: CodeLens](../phases/PHASE_4_CODELENS.md)
- [[ + ] Phase 5: Process Architecture](../phases/PHASE_5_PROCESS_ARCHITECTURE.md)
- [Phase 6: Observability](../phases/PHASE_6_OBSERVABILITY.md)
- [Phase 7: Failure Navigation](../phases/PHASE_7_FAILURE_NAVIGATION.md)
- [Phase 8: Allure Integration](../phases/PHASE_8_ALLURE_INTEGRATION.md)
- [Phase 9: TreeView Execution Panel](../phases/PHASE_9_TREEVIEW_EXECUTION_PANEL.md)
- [Phase 10: Enterprise Features](../phases/PHASE_10_ENTERPRISE_FEATURES.md)

## Milestones

- `[ + ]` Phase 1 milestone: cursor-based scenario execution was verified through Run and Debug on a representative sample project.
- `[ + ]` Phase 2 milestone: scenario discovery was verified for `Scenario`, `Scenario Outline`, tagged scenarios, and step-line invocation.
- `[ + ]` Phase 3 milestone: execution root resolution was moved off workspace-root assumptions and now reports selected `Execution` and `POM` context.
- `[ + ]` Phase 4 milestone: `BDD Run Scenario` CodeLens was verified on both `Scenario` and `Scenario Outline` in the editor.
