# Pi auto-mode Laya migration interview

## Status and authority

Design interview in progress.
The user requested migration to [Laya] and explicitly requested grilling before implementation.
Do not implement until shared understanding is confirmed.
No dependency, production configuration, or runtime changes have been made for this task.

The user subsequently restricted research explicitly:

> Only look at Laya. No alternatives.

Run a Laya-only feasibility and migration audit.
Do not search for, evaluate, or rank competing technologies.
The incumbent is a responsibility/parity baseline, not a competing candidate.
Do not expand this interview into selecting another model provider.

[Laya]: https://github.com/NandhaKishorM/laya

## Confirmed motivation

The user's answer to Q1:

> reduce costs and werid-looking requests to coding plan providers.

Cost and provider-facing request patterns are the target.
The initial assistant suggestion about autonomous task completion was not the user's stated objective.
Auto-mode is a tool-call safety guard, not task-completion orchestration.

## Evidence gathered

`package/pi-plugin/auto-mode/README.md` describes the current flagger, judge, and approval pipeline.
`package/pi-plugin/auto-mode/src/evaluate.ts` checks reusable session approvals before resolving a judge model.
It asks the user when model resolution or judging fails.
`package/pi-plugin/auto-mode/src/judge.ts` sends structured-tool requests through shared model-review code
and retries using direct JSON when no verdict tool call appears.
These paths are relevant to request volume and request shape.
Actual provider call counts, costs, and account-policy implications have not been measured.

The current upstream Laya README advertises typed decisions rather than generated explanations.
It also documents input-window limits, overconfidence, and negation failures.
These are upstream statements, not local runtime validation.
They motivate source inspection and guard-specific evaluation before adoption.
No claim of safety parity, cost savings, or adequate local performance has been established.

## Decision frontier

### Q2: Provider boundary

Settled: A.
Auto-mode must make zero coding-plan judge requests, including fallback.
The main coding agent's normal provider traffic is outside this boundary.
Do not propose a different model provider as fallback under the Laya-only scope.
Manual approval is the fallback direction established by Q3.

### Q3: Safety and interruption tradeoff

Settled: A.
Additional manual approvals are acceptable when needed to preserve safety.
Cutover does not require retaining the current level of automatic handling.
Keep deterministic safety checks and require human approval when the local decision lacks validated support.
Do not treat model confidence alone as proof of safe authorization.

### Q4: Deployment scope

Settled: A.
Target this Linux workstation first.
Do not make validation on other Pi hosts a first-cutover requirement.

### Q5: Evaluation data

Settled: A.
The user authorizes local inspection of existing Pi session histories
and retaining redacted guard-action examples alongside synthetic/adversarial cases.
Do not upload session data or commit raw histories.
Review redaction before committing any fixture.
This does not authorize fine-tuning or ongoing transcript capture.

## Existing GitHub issues

Checked open and closed issues in `Aquaticat/Monochromatic` on 2026-09-26.
GitHub search queried title, body, and comments for:
`"auto-mode"`, `"auto mode"`, `guardrail`, `safeguard`, `judge`,
`"budget-model-auth"`, and `"ProviderHeaders"`.
Each query used `per_page=100` with pagination;
GitHub returned `incomplete_results=false` and fewer than a page of results for each.
Relevant issue bodies and comments were read.
No issues were mutated.

### #558: Existing Laya evaluation request

[Issue #558](https://github.com/Aquaticat/Monochromatic/issues/558) is open.
It explicitly says to try Laya locally on CPU first.
Its migration checklist covers call volume, input sizes, spend, retries, latency,
verdicts, explanations, manual approval, trust directives, fallback,
complete context, images, context limits, and adversarial safety cases.
Carry this checklist into the migration acceptance ledger.
Its historical Jev comparison and TypeSafe-terms work are excluded by the user's newer Laya-only scope.
The sole comment is a Linear backlink, not additional requirements.

### #279: Non-hermetic skill allowlist fixtures

[Issue #279](https://github.com/Aquaticat/Monochromatic/issues/279) is open.
Current source still has maintainer-local fixture paths:
`package/pi-plugin/auto-mode/src/signals.unit.test.ts:107-120`
and `package/pi-plugin/auto-mode/src/index.unit.test.ts:371-420`.
These tests do not construct the named skill files.
This is current source confirmation of the fixture dependency, not a fresh reproduction of failure.
The migration's verification must use real disposable skill directories
and complete mock session contexts rather than treating a pass on this workstation as portability proof.
Do not weaken the canonical-path fail-closed behavior.

### #114: Historical upstream home-path false positives

[Issue #114](https://github.com/Aquaticat/Monochromatic/issues/114) is open upstream-tracking work for pi-safeguard.
It is not evidence that current auto-mode has that same defect.
`package/pi-plugin/auto-mode/src/path-signals.ts:69-73` documents removal of the system-path test;
`src/signals.unit.test.ts:67-78` covers paths under `/var/home` within the project.
Keep home alias, canonical containment, and secret-path behavior in the parity suite.
No pi-safeguard evaluation or upstream tracking was initiated.

### Closed issues and excluded matches

- [#166](https://github.com/Aquaticat/Monochromatic/issues/166):
  closed after the maintainer confirmed the earlier cohesion fixes.
  Do not revive its historical file-count prescription as a migration requirement.
- [#155](https://github.com/Aquaticat/Monochromatic/issues/155):
  missing TSDoc was recorded as resolved.
- [#237](https://github.com/Aquaticat/Monochromatic/issues/237):
  dependency-catalog cleanup was recorded as resolved.
  Preserve catalog ownership when introducing Laya dependencies.
- [#534](https://github.com/Aquaticat/Monochromatic/issues/534):
  closed after fixing runtime peer installation and verifying an isolated consumer.
  Repeat isolated installation/import checks for the migrated extension.
- [#254](https://github.com/Aquaticat/Monochromatic/issues/254):
  closed logger-lifecycle work; its follow-up does not name auto-mode as a remaining consumer.
  A current auto-mode source search found no `initPromise` references.
- [#359](https://github.com/Aquaticat/Monochromatic/issues/359):
  the build override was recorded as removed and verified.
  Its comment mentions a separate historical `ProviderHeaders` error;
  searches for that diagnostic and `budget-model-auth` found only #359,
  so no separate issue or current failure was established.
- [#291](https://github.com/Aquaticat/Monochromatic/issues/291):
  API-mock work names other Pi plugins, not auto-mode.
  Do not conflate the distinct `guardrail` package with this package.
- [#391](https://github.com/Aquaticat/Monochromatic/issues/391):
  subagent model-class policy, not guard-judge migration.
- Other search matches concern repository-wide lint, catalog, scaffolding, or unrelated tool guards.
  They are not additional auto-mode behavior requirements.

## Research still required

- Inventory every consumed auto-mode responsibility and assign its future owner and parity test.
- Inspect provider selection, fallback, session reuse, trust directives, bypass, and headless behavior.
- Inspect the exact Laya inference, tokenization, serving, dependency, model-artifact, and test paths.
- Probe available deployment hardware before choosing a runtime or host.
- Establish a labelled guard-action corpus, including negation and adversarial inputs.
- Measure current judge calls and costs without exporting private transcripts.
- Define deployment, error handling, explanations, rollout, rollback, and acceptance criteria.
- Complete Laya source, provenance, security, and runtime vetting before granting decision authority.
- Skip competing-candidate discovery and ranking because the user explicitly excluded alternatives.

## Next action

Inspect the incumbent policy surface and Laya input and deployment boundaries.
Inspect local historical guard decisions without exposing raw histories.
Resolve user-visible policy changes required by the Laya boundary.
Recompute the remaining interview frontier from the source findings.
Keep implementation blocked until the complete design is confirmed.
