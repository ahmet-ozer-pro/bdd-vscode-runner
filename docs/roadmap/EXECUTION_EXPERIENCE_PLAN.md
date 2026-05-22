# Execution Experience Plan

This plan defines the recommended order for reaching an IntelliJ-like execution experience in VS Code without replacing Maven, Cucumber, Appium, Playwright, Allure, hooks, or CI behavior.

The target is not only parity where practical, but also selective advantage where VS Code can offer lower-friction workflow improvements without changing canonical execution.

## Planned Order

1. Preserve zero-config execution for Maven Wrapper projects
2. Add minimal optional configuration without making setup mandatory
3. Unify scenario and feature execution orchestration
4. Complete discovery gaps that affect run-tree accuracy
5. Improve CodeLens and panel feedback toward IntelliJ parity
6. Add richer scenario, step, assertion, and source details

## Recorded Tracks

### `[ + ]` Track 0: Zero-Config Execution Parity

Status: Completed

Recorded progress:

- `[ + ]` `mvnw` auto-detected on Unix-like systems when present
- `[ + ]` `mvnw.cmd` auto-detected on Windows when present
- `[ + ]` falls back to `mvn` / `mvn.cmd` when no wrapper exists
- `[ + ]` `bdd-vscode-runner.mavenExecutable` override supported
- `[ + ]` `bdd-vscode-runner.testClassName` override supported with `RunCucumberTest` as default
- `[ + ]` Windows Maven command execution handled with `shell: true` and `.cmd` awareness
- `[ + ]` `onDidChangeConfiguration` listener keeps configuration live without restart

### `[ + ]` Track 1: Failure Navigation Foundation

Status: Completed

Recorded progress:

- `[ + ]` feature-line fallback navigation exists
- `[ + ]` step-level feature URI parsing exists where output is specific enough
- `[ + ]` workspace and execution-root Java source targets are filtered and prioritized ahead of framework noise
- `[ + ]` surefire report content is now considered as a secondary failure-analysis source
- `[ + ]` structured result sources now feed failed-step targets before feature fallback when available

Remaining work in this track:

- extend navigation depth further toward page-source and helper-source correlation
- reuse future structured hook and example data to improve source ranking
- reduce duplicated fallback targets when stronger feature-step or Java-source targets already exist

### `[ + ]` Track 2: Structured Result Ingestion

Status: In Progress

Goal:

Collect reliable scenario, example, hook, step, duration, and failure data from structured artifacts instead of depending mainly on terminal text.

Planned inputs:

- `target/surefire-reports`
- Cucumber JSON, XML, or message-style artifacts when present
- Maven output only as a fallback source

Expected outcome:

- step status can be derived from normalized result data
- failure navigation can use richer source context
- panel state no longer depends primarily on console parsing

Recorded progress:

- `[ + ]` a dedicated result-ingestion layer now exists
- `[ + ]` Cucumber JSON artifacts are parsed when available
- `[ + ]` Cucumber message-style ndjson artifacts are recognized
- `[ + ]` `surefire-reports` text can be used as a structured fallback source
- `[ + ]` execution sessions now prefer structured result data over pure output inference when available
- `[ + ]` live running sessions now update step state from streamed output before structured result artifacts arrive at the end of the run
- `[ + ]` live NDJSON step statuses are now parsed from streamed output during a run; `parseLiveNdjsonStepStatuses` feeds `projectLiveNdjsonSteps` as the preferred live source when the plugin is active

### `[ + ]` Track 3: Execution Session Foundation

Status: In Progress

Recorded progress:

- `[ + ]` scenario discovery now captures step metadata
- `[ + ]` a shared in-memory execution session model exists
- `[ + ]` session summaries are emitted to the output channel
- `[ + ]` multiple UI surfaces can now reuse a common session object
- `[ + ]` `Before` and `After` hook nodes are now represented in the session model
- `[ + ]` `Scenario Outline` example instance rows are now represented in the session model
- `[ + ]` per-step and per-hook durations are now retained when structured data provides them
- `[ + ]` multiple retained sessions now exist instead of latest-run only

Remaining work in this track:

- add rerun-oriented metadata so sessions can restart themselves without re-deriving command context from raw panel state
- move more failure-detail payloads into first-class session data so UI surfaces can stop re-parsing late-stage output where practical
- attach Background steps to each scenario session once discovery provides them
- treat Scenario Outline example rows as first-class targets where line metadata is available

### `[ + ]` Track 4: Execution Panel Foundation

Status: In Progress

Recorded progress:

- `[ + ]` the first `BDD Runner` activity-bar panel exists
- `[ + ]` the panel shows recent sessions, grouped steps, hooks, examples, failure targets, and output access
- `[ + ]` the panel reuses shared execution state instead of forking execution logic
- `[ + ]` the panel now supports selection-driven detail views for sessions, steps, hooks, and examples
- `[ + ]` the panel now supports initial history and multi-session browsing
- `[ + ]` the panel now exposes visible rerun actions instead of relying only on context menus
- `[ + ]` failed step detail views now begin to include correlated project frames and parsed assertion values when output provides them
- `[ + ]` failure targets now surface explicit Java source entries such as step-definition methods
- `[ + ]` failed-step detail views now anchor relevant output near the assertion and failure block rather than near generic startup logs
- `[ + ]` related project frames can now be enriched from nearby project log context such as page objects
- `[ + ]` running sessions now update step progress live instead of keeping all future steps pending until process completion

Remaining work in this track:

- improve source ranking and frame cleanup so the most useful Java and feature targets stay visible with less noise
- show last-run scenario status consistently across panel and CodeLens once session status indexing is available
- preserve recent-run history as a base for a future comparison view
- improve tag and folder session node representation with scope-aware depth and labels

### `[ + ]` Track 4A: Feature-Level Entry Points

Status: In Progress

Recorded progress:

- `[ + ]` `.feature` files can now surface a dedicated whole-feature run entry point
- `[ + ]` feature-level run entry points reuse the same canonical Maven execution root logic as scenario runs

Remaining work:

- improve tag and folder run representation with scope-aware node labels that distinguish run types visually
- add richer feature-run failure navigation when multiple scenarios fail in the same file

### `[ + ]` Track 5: IntelliJ-Like Runner UX

Status: In Progress

Recorded progress:

- `[ + ]` pass/fail filter controls exist in the execution panel
- `[ + ]` feature -> scenario tree grouping exists in the panel
- `[ + ]` debug mode implemented via real Java launch configuration
- `[ + ]` multi-feature selection via Quick Pick available
- `[ + ]` live step status prefers NDJSON stream over stdout regex

Remaining work:

- scope-aware tag/folder session node labels
- session comparison view
- deeper feature -> scenario -> example -> hooks -> steps tree

Goal:

Reach a developer experience closer to IntelliJ IDEA while preserving canonical Maven execution.

Planned capabilities:

- richer run tree behavior
- durable session history
- stronger per-step pass/fail confidence
- clearer failure detail and source navigation
- tighter synchronization between output, panel state, and source editors
- Scenario Outline example-row execution
- Background step visibility in every scenario run tree
- tag-based execution through a Quick Pick flow
- step-definition aware failure details
- assertion-aware detail rendering with `expected` and `actual`
- project-frame aware navigation that prefers relevant workspace code over framework internals

Parity target:

- failed step, related step-definition method, and related project frames should be visible together
- assertion detail should be readable without requiring raw stack-trace scanning
- selected run items should update detail context in a predictable, IDE-like way

Possible IntelliJ-plus opportunities:

- lower-friction switching between feature step, step definition, and output detail
- one-click reveal of the most relevant project-owned frame instead of only raw stack-trace browsing
- combined panel and source workflow that avoids splitting attention across multiple unrelated IDE surfaces

## Why This Order

- Failure navigation creates immediate value on top of existing failed runs.
- Step-level parsing must exist before the extension can show trustworthy per-step pass or fail states.
- An execution session model is required before multiple surfaces can present the same run consistently.
- A TreeView or panel becomes much more useful once it can show real run state instead of raw text only.
- Maven Wrapper detection and minimal configuration come first because IntelliJ-like feedback has little value if common projects cannot start a run.

## Step-Level Failure Navigation

The first target is to identify the failing step or best available source location from execution output and navigate to it reliably. When exact step mapping is not possible, the extension should fall back to the scenario line and preserve raw output.

## Step-Level Execution Parsing

The extension should parse safe, repeatable execution signals from Maven and Cucumber output:

- Scenario start
- Step start
- Step passed
- Step failed
- Step skipped
- Duration when available

This parsing must stay generic and must not require project-specific log formats.

In practice, this should evolve toward structured result ingestion whenever report artifacts are available, because terminal output alone is often insufficient for IntelliJ-like accuracy.

For IntelliJ-like failure detail, this parsing must also grow into:

- project-owned stack-frame extraction
- step-definition method correlation
- assertion message, `expected`, and `actual` extraction
- separation of relevant project frames from framework and launcher noise

## Execution Session Model

The extension should maintain a reusable in-memory run model that can represent:

- Feature
- Scenario
- Step
- Status
- Duration
- Output fragments
- Failure target

This model should be shared by Command Palette, CodeLens, failure navigation, future TreeView, and future reporting surfaces.

The first implementation should be built from:

- discovered feature and scenario structure
- discovered step lines and step order
- reliable failure targets from output or reports
- canonical execution summary metadata

Later iterations should also carry:

- step-definition method references
- related project stack frames
- assertion details
- node-specific output excerpts

## TreeView Or Panel MVP

The first panel version should behave like a developer tool surface, not a marketing UI. It should be able to show:

- Active run
- Scenario list
- Step list for the current scenario when available
- Passed, failed, running, and cancelled states
- Navigation to feature or source locations
- Output and summary context

The first implementation may start with the latest run only, as long as it reuses the shared execution session model and does not invent a second execution path. This initial limitation has already been removed by the current recent-run history layer.

The next panel iterations should make selected items behave more like IntelliJ run nodes by showing:

- source-aware detail views
- assertion summaries
- step-definition references
- related project-frame excerpts
- rerun actions directly from the run surface

## Non-Goals

- Replacing IntelliJ's internal runner model exactly
- Replacing Maven, Cucumber, Allure, or CI reports
- Making step-level visualization depend on custom framework changes
- Hiding raw output behind UI-only abstractions

## Strategic Direction

Implementation should follow this principle:

- match IntelliJ where its test-runner behavior is clearly more useful
- remain generic where IntelliJ relies on product-specific internals that do not translate cleanly to VS Code
- exceed IntelliJ where VS Code can provide a faster or clearer workflow without adding project-specific assumptions
