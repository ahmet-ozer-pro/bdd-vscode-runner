# Current Phase

## Active Phase

`[ + ]` Phase 9: TreeView Execution Panel

## Status

In Progress

## Tracking Marker

Use `[ + ]` next to a phase name when implementation progress is active or when the phase is completed. Planned phases without measurable progress should remain unmarked.

## Current Focus

Move from a first working execution panel to a richer IntelliJ-like session and run tree experience.

The active goal is now explicit IntelliJ capability convergence for failure detail, stack-trace correlation, and session-driven runner UX, while leaving room for selective VS Code-specific improvements that reduce friction for automation engineers.

The May 2026 parity review adds a hard ordering constraint: zero-config blockers must be closed before polishing runner UX. Maven Wrapper auto-detect and minimal optional configuration are therefore the next cross-cutting blockers even though the visible active phase remains Phase 9.

## Near-Term Sequence

1. ~~Pass/fail filter controls in the execution panel~~ ✓ Completed
2. ~~Feature -> scenario tree grouping in the panel~~ ✓ Completed
3. ~~Debug mode implementation~~ ✓ Completed
4. ~~Multi-feature selection execution~~ ✓ Completed
5. ~~Structured live step status (NDJSON stream preference over stdout regex)~~ ✓ Completed
6. Richer tag/folder session node representation (scope-aware labels and grouping depth)
7. Session history comparison view
8. Allure integration (Phase 8)

## Required Guardrails

- Canonical Maven execution from Phase 1 must remain valid.
- `.feature` files must not be modified.
- VS Code workspace root must not be treated as Maven execution root.
- Discovery, root resolution, CodeLens, and observability output must continue to reuse the same execution core.
- Existing IntelliJ, Maven, Cucumber, Appium, Playwright, Allure, and CI behavior must remain valid.

## Exit Criteria

- Reliable failures can be linked to useful source or output context.
- Raw Maven output remains available when navigation cannot be inferred safely.
- Existing canonical execution, discovery, and observability behavior remain intact.
- Future Allure integration can complement rather than replace failure navigation.
- Future panel or TreeView work must consume the same execution session model rather than parsing output independently.
- Structured result sources must become the preferred source of truth whenever available.
- Panel state must continue to reuse the same canonical execution and session model.

## Latest Milestones

- `[ + ]` CodeLens runs were verified successfully on both `Scenario` and `Scenario Outline`.
- `[ + ]` Discovery and execution continue to work alongside other installed runner extensions.
- `[ + ]` Active run cancellation was verified in the editor and output channel.
- `[ + ]` Structured execution summaries were verified for both success and failure outcomes.
- `[ + ]` Execution session model work has started with discovered step metadata and shared session shaping for future panel surfaces.
- `[ + ]` A dedicated `BDD Runner` execution panel now shows the latest scenario session, discovered steps, and failure targets.
- `[ + ]` Failure analysis now considers `surefire-reports` in addition to live Maven output.
- `[ + ]` Failure navigation now prioritizes structured failed-step targets before feature fallback when artifact data is available.
- `[ + ]` Execution panel sessions now update during a live run so completed steps can move from `pending` to `passed` before the full Maven process finishes.
- `[ + ]` Failure targets now include explicit Java source targets such as step-definition methods and no longer rely only on feature-line fallbacks.
- `[ + ]` Failed-step detail now anchors relevant output closer to the assertion block instead of starting from generic startup or configuration noise.
- `[ + ]` Related project frames now include nearby project log classes such as page objects when stack-trace data alone is not enough.
- `[ + ]` The execution panel now exposes visible rerun actions instead of relying only on subtle context-menu entries.
- `[ + ]` `Rerun Failed` now has smarter intent for failed `Scenario Outline` sessions by preferring the failed example row target.
- `[ + ]` `.feature` files can now expose a whole-feature run entry point in addition to scenario-level execution.

## Recorded Next Work

- Improve tag and folder session node representation with scope-aware labels that distinguish tag runs, folder runs, and scenario runs visually.
- Add session history comparison view once retained sessions are stable enough to drive a side-by-side or diff-style panel.
- Begin Phase 8 Allure integration: detect existing Allure result locations and surface links without replacing project-owned report generation.
- Consider Phase 10 enterprise preparation: multi-root workspace config, shared policy settings, and session export once Phase 9 panel parity is sufficiently complete.

## Newest Milestone

- `[ + ]` Structured result ingestion is now active with Cucumber JSON, message-style ndjson recognition, and `surefire-reports` fallback support.
- `[ + ]` Execution sessions now carry example rows and lifecycle hook groups, and the execution panel has started evolving from a flat list into a grouped run tree.
- `[ + ]` Selecting panel session nodes now opens item-specific execution detail documents with related output excerpts, while failure targets continue to navigate directly to source lines.
- `[ + ]` The execution panel now retains recent runs instead of replacing the previous session immediately, creating the first run-history foundation.
- `[ + ]` Failed step detail now begins to correlate project-owned Java stack frames and assertion values such as `expected` and `actual` when they are present in run output.
- `[ + ]` Failure targets are now cleaner and more intentional: failed feature steps, correlated Java methods, and fewer redundant feature-output fallbacks.
- `[ + ]` Global state `ExtensionRuntime` sınıfına taşındı; ayarlar `onDidChangeConfiguration` ile canlı güncelleniyor.
- `[ + ]` Tag koşumu ortak `runMavenExecution` path'ine birleştirildi; ayrı `runTagMavenExecution` akışı kaldırıldı.
- `[ + ]` `runMavenExecution` dört yardımcı fonksiyona bölündü; orchestration 47 satıra indi.
- `[ + ]` Execution detail görünümü Webview Panel'e taşındı; durum rozetleri, renkli adım satırları, assertion bloğu ve failure target etiketleri IntelliJ benzeri HTML ile sunuluyor.
- `[ + ]` Tag ve folder koşumları `ExecutionSessionStore`'a session olarak yazılıyor ve panel'de görünüyor.
- `[ + ]` Status bar'da koşum süresinde gerçek zamanlı sayaç akıyor.
- `[ + ]` Editor sağ tık context menüsüne `.feature` dosyaları için Run komutları eklendi.
- `[ + ]` 58'den 66'ya test coverage artışı: tag/folder builder, store lifecycle, NDJSON, `findNearestScenarioLine`, wrapper öncelik.
- `[ + ]` Pass/fail filter controls added to the execution panel with toolbar buttons.
- `[ + ]` Feature -> scenario tree grouping implemented; single-feature sessions show a flat list, multi-feature sessions group under feature nodes.
- `[ + ]` Debug mode implemented via `vscode.debug.startDebugging`; `⚙ Config` CodeLens now triggers a real Java debug launch configuration.
- `[ + ]` Multi-feature selection command added with multi-select Quick Pick; selected files run through the canonical execution path.
- `[ + ]` Live step status now reads streamed NDJSON events when the plugin is active; stdout regex is the fallback.
- `[ + ]` Test coverage reached 74: filter behavior, feature grouping, NDJSON live parsing, and multi-feature arg construction all covered.

## Recorded Gap To Close

- Tag and folder session nodes currently appear identically to scenario session nodes; scope-aware labels and richer grouping depth are still missing.
- Session history comparison view is not yet implemented; retained sessions provide the data foundation but comparison UI is absent.
- Phase 9 Acceptance Criteria for "discovered features, scenarios, modules" panel representation is substantially met but not fully complete: multi-module grouping and tag/folder node depth still have room to improve.

## Product Position

- Target parity: IntelliJ-like run understanding, failure reasoning, and step-to-source mapping.
- Target differentiation: lower-friction execution, navigation, and detail access inside VS Code once parity-critical gaps are closed.
