# Roadmap

This roadmap defines the phase order for building BDD VSCode Runner as a production-grade orchestration and observability extension for Java Maven Cucumber projects.

## Phase Status

| Phase | Area | Status |
| --- | --- | --- |
| 1 | `[ + ]` Canonical Execution | Completed |
| 2 | `[ + ]` Scenario Discovery | Completed |
| 3 | `[ + ]` Execution Root Discovery | Completed |
| 4 | `[ + ]` CodeLens | Completed |
| 5 | `[ + ]` Process Architecture | Completed |
| 6 | `[ + ]` Observability | Completed |
| 7 | `[ + ]` Failure Navigation | Completed |
| 8 | Allure Integration | Planned |
| 9 | `[ + ]` TreeView Execution Panel | In Progress |
| 10 | Enterprise Features | Planned |

## Roadmap Rules

- Canonical Maven execution must remain the foundation.
- Discovery must support common layouts first and real-world multi-module layouts over time.
- UI surfaces must reuse execution logic rather than fork behavior.
- User-facing workflows must stay clear, predictable, and low-friction.
- Observability must improve feedback without changing framework semantics.
- Enterprise features must not make the extension project-specific.
- Zero-config first run must include Maven Wrapper projects by default; configuration may override behavior but must not be required for common cases.
- A `[ + ]` marker should be added next to a phase name when measurable progress has been made and should remain visible for in-progress or completed phases.
- IntelliJ-like runner behavior should be treated as the reference standard for execution understanding and failure detail where it clearly improves developer workflow.
- IntelliJ parity should not block thoughtful VS Code-specific improvements when they reduce friction without weakening generic compatibility.

## Phase Documents

- [[ + ] Phase 1: Canonical Execution](../phases/PHASE_1_CANONICAL_EXECUTION.md)
- [[ + ] Phase 2: Scenario Discovery](../phases/PHASE_2_SCENARIO_DISCOVERY.md)
- [[ + ] Phase 3: Execution Root Discovery](../phases/PHASE_3_EXECUTION_ROOT_DISCOVERY.md)
- [[ + ] Phase 4: CodeLens](../phases/PHASE_4_CODELENS.md)
- [[ + ] Phase 5: Process Architecture](../phases/PHASE_5_PROCESS_ARCHITECTURE.md)
- [[ + ] Phase 6: Observability](../phases/PHASE_6_OBSERVABILITY.md)
- [[ + ] Phase 7: Failure Navigation](../phases/PHASE_7_FAILURE_NAVIGATION.md)
- [Phase 8: Allure Integration](../phases/PHASE_8_ALLURE_INTEGRATION.md)
- [[ + ] Phase 9: TreeView Execution Panel](../phases/PHASE_9_TREEVIEW_EXECUTION_PANEL.md)
- [Phase 10: Enterprise Features](../phases/PHASE_10_ENTERPRISE_FEATURES.md)

## Focused Plans

- [Execution Experience Plan](./EXECUTION_EXPERIENCE_PLAN.md)
- [IntelliJ Parity Priority Roadmap](./INTELLIJ_PARITY_PRIORITY_ROADMAP.md)

## Milestones

- `[ + ]` Phase 1 milestone: cursor-based scenario execution was verified through Run and Debug on a representative sample project.
- `[ + ]` Phase 2 milestone: scenario discovery was verified for `Scenario`, `Scenario Outline`, tagged scenarios, and step-line invocation.
- `[ + ]` Phase 3 milestone: execution root resolution was moved off workspace-root assumptions and now reports selected `Execution` and `POM` context.
- `[ + ]` Phase 4 milestone: `BDD Run Scenario` CodeLens was verified on both `Scenario` and `Scenario Outline` in the editor.
- `[ + ]` Phase 5 milestone: shared process lifecycle and cancellation were verified through Run and Debug, including visible cancellation request and cancelled completion state.
- `[ + ]` Phase 6 milestone: structured execution summaries were verified for both passed and failed scenario runs, including command, execution root, `pom.xml`, exit code, and duration.
- `[ + ]` Current focus: progress toward IntelliJ-like developer feedback will follow the order `failure navigation -> step-level parsing -> execution session model -> panel MVP`.
- `[ + ]` Current implementation direction: feature discovery is being expanded into step-aware execution session data so future TreeView and panel work can reuse one canonical run model.
- `[ + ]` Phase 9 milestone: the first dedicated `BDD Runner` execution panel is now part of the extension surface and reuses the shared execution session model.
- `[ + ]` Next planned implementation order is now recorded as `structured result ingestion -> session enrichment -> panel evolution -> advanced runner UX`.
- `[ + ]` Structured result ingestion work has started and now feeds execution sessions from Cucumber JSON, message-style ndjson, and `surefire-reports` fallback sources.
- `[ + ]` Session enrichment and panel evolution have started with example-row metadata, lifecycle hook grouping, and a more structured execution tree foundation.
- `[ + ]` Panel interaction has advanced beyond file navigation: session, hook, step, and example nodes now open item-specific execution detail views with relevant output excerpts.
- `[ + ]` The panel now keeps a recent run history rather than only the latest session, which establishes the first multi-run execution timeline.
- `[ + ]` The next recorded implementation target is IntelliJ-like failure enrichment: stack-trace correlation, step-definition binding, assertion parsing, and related project-frame detail rendering.
- `[ + ]` The product direction now explicitly targets both IntelliJ parity for core runner intelligence and selective IntelliJ-plus improvements where VS Code can offer a simpler automation workflow.
- `[ + ]` Live execution sessions now update step state during a running Maven process instead of waiting for the full run to complete before all step statuses change.
- `[ + ]` Failure targets now surface correlated Java source locations such as step-definition methods in addition to failed feature steps.
- `[ + ]` Failure detail now prefers assertion-adjacent output excerpts and can enrich related project frames from nearby project log context.
- `[ + ]` The execution panel now exposes visible rerun actions, and `Rerun Failed` can now prefer the failed `Scenario Outline` example row instead of behaving like a generic rerun only.
- `[ + ]` Feature files can now expose a whole-feature execution entry point in addition to scenario-level runs.
- `[ + ]` The May 2026 IntelliJ parity review is now recorded as a focused priority roadmap. The highest-priority blockers are Maven Wrapper auto-detect and minimal optional configuration, followed by shared execution refactoring, Background step discovery, Scenario Outline example-row execution, CodeLens last-run status, Windows command handling, assertion detail rendering, tag execution, and stronger live step status.
- `[ + ]` Global state `ExtensionRuntime` controller sınıfına taşındı; `onDidChangeConfiguration` ile ayarlar canlı güncelleniyor.
- `[ + ]` `runTagMavenExecution` ayrı akışı kaldırıldı; tag koşumu artık `runMavenExecution` ortak orchestration path'i üzerinden çalışıyor.
- `[ + ]` `runMavenExecution` dört yardımcı fonksiyona ayrıldı: `buildMavenArgs`, `logExecutionHeader`, `buildExecutionContext`, `handleRunResult`.
- `[ + ]` `spawnProcess` senkron throw durumunda promise artık askıda kalmıyor; hata güvenli şekilde yakalanıp caller'a iletiliyor.
- `[ + ]` Execution detail görünümü text document'tan Webview Panel'e taşındı; IntelliJ benzeri HTML/CSS ile durum rozetleri, renkli adım satırları, assertion bloğu ve failure target etiketleri sunuluyor.
- `[ + ]` Tag ve folder koşumları artık `ExecutionSessionStore`'a session olarak yazılıyor; panel'de görünür hale geldi.
- `[ + ]` Koşum süresinde status bar'da gerçek zamanlı sayaç akıyor.
- `[ + ]` `.feature` dosyalarında editor sağ tık context menüsüne Run Scenario, Run Feature ve Run Feature Folder komutları eklendi.
- `[ + ]` Test coverage genişletildi: tag/folder session builder'lar, `ExecutionSessionStore` yaşam döngüsü, NDJSON artifact ingestion, `findNearestScenarioLine` ve Maven wrapper öncelik kuralları artık test altında.
- `[ + ]` Pass/fail filter controls added to the execution panel; failed and passed sessions can now be isolated with toolbar buttons.
- `[ + ]` Feature -> scenario tree grouping added to the panel; sessions from the same feature are grouped under a shared feature node when multiple features are present.
- `[ + ]` Debug mode implemented: `⚙ Config` CodeLens and the new `BDD Runner: Debug Scenario` command launch a Java debug session via `vscode.debug.startDebugging` instead of showing a placeholder message.
- `[ + ]` Multi-feature selection added: `BDD Runner: Run Selected Features` command presents a multi-select Quick Pick of workspace feature files and runs the selected set through the shared canonical execution path.
- `[ + ]` Live step status now prefers streamed NDJSON events over stdout regex when the NDJSON plugin is active; `parseLiveNdjsonStepStatuses` is the preferred live parser and stdout regex is retained as a fallback.
- `[ + ]` Test coverage: 58 -> 74 tests across tag/folder builders, store lifecycle, NDJSON live parsing, scenario line resolution, Maven wrapper priority, filter behavior, feature grouping, and multi-feature arg construction.
