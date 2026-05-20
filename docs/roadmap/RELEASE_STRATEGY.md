# Release Strategy

BDD VSCode Runner should release in small, reversible increments aligned with the roadmap phases.

## Release Principles

- Prefer stable orchestration over broad feature surface.
- Do not release features that change Maven, Cucumber, or framework semantics.
- Keep first-run behavior zero-config for common supported projects.
- Treat compatibility with IntelliJ, Maven CLI, and CI/CD as release requirements.
- Document known limitations when support is intentionally partial.
- Keep roadmap tracking consistent by applying the `[ + ]` marker to phases with measurable progress.

## Release Readiness

Each release should confirm:

- Canonical Maven execution remains preserved.
- Existing extension commands continue to work.
- New UI surfaces reuse shared execution logic.
- Scenario and root discovery do not encode project-specific assumptions.
- Rollback impact is understood for the changed phase.
- A Run and Debug smoke test has been attempted against a representative sample project after phase completion or major implementation changes.

## Versioning Guidance

Patch releases should fix defects without changing behavior. Minor releases may add phase capabilities. Major releases should be reserved for intentional contract changes that are documented and migration-safe.
