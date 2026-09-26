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

### Q6: Offline evaluation before cutover

The user did not select the proposed live-shadow versus delayed-cutover menu.
They supplied a different path:

> You can generate synthetic test data from my past transcripts.
> You can look at the decisions Laya would've made yourself.

Proceed with assistant-led offline evaluation before returning to cutover decisions.
Derive synthetic cases from local histories, label expected decisions independently,
run Laya, and inspect its counterfactual decisions and mistakes.
Do not require the user to supervise a live shadow rollout to collect the initial evidence.
Neither incumbent verdicts nor Laya output are ground truth.
This authorizes evaluation, not product changes, fine-tuning, or a completed cutover design.

### Fine-tuning scope

The user added:

> I am also not against fine-tuning Laya.

Fine-tuning is an eligible follow-up if baseline errors warrant it.
Do not assume the user requires pretrained-only integration.
This expresses openness, not a decision to start training or use paid/external compute.
Existing no-upload and no-raw-history-commit boundaries remain active.
Split synthetic examples by source scenario into training, calibration, and frozen held-out groups;
paraphrases of the same case must not leak across those groups.
Establish the baseline before tuning and evaluate any trained result on unseen cases.

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

## Incumbent responsibility ledger

This maps current ownership, proposed disposition, and verification surfaces.
It does not claim any migration code or tests have run.
The final user-facing policy is still being interviewed.

### Static safety and path handling

Current owner: `src/signals.ts`, `src/path-signals.ts`, shell-analysis helpers,
read-only command proofs, scratch/skill/worktree allowlists, and `src/virtual-input-guard.ts`.
Proposed disposition: retain outside Laya; a model must not override the fixed virtual-input block.
Preserve canonical paths, symlink-escape checks, secret-path checks, and read-versus-write distinctions.
Parity: `signals`, `command-parser`, `temp-allowlist`, `git-worktree-read-allowlist`,
`virtual-input-guard`, and `static-guard-import` unit suites.
Correct the #279 fixture dependency when implementing the affected test changes.

### Lifecycle, batch context, and denial follow-ups

Current owner: `src/index.ts`.
It captures loaded context/skills, tracks turn siblings and previous denial,
retains project context across retry boundaries, and clears settled-run state.
Proposed disposition: preserve lifecycle and denial sensitivity in the extension.
Laya input eligibility must not silently discard context needed for the current decision.
Parity: `index.unit.test.ts`, `context.unit.test.ts`, plus new overflow and missing-evidence cases.

### Session approvals and trust rules

Current owner: `src/context.ts`, `src/tool-helpers.ts`, `src/guard-command.ts`,
and `src/register-propose-trust.ts`.
Existing exact approvals use action plus input/cwd/project-context fingerprint;
read ranges share path scope, while different edit/write payloads do not.
Trust rules are session-branch-local prose interpreted by the judge.
Proposed disposition: retain explicit approval and reset/replay boundaries.
The local interpretation of arbitrary prose trust rules remains a design question.
Migration needs an explicit rule for historical machine-approved verdict reuse
rather than silently treating a different judge policy as the same authorization.
Parity: `context`, `context-trust`, `tool-helpers`, `register-propose-trust`, and `evaluate` unit suites.

### Bypass and manual approval

Current owner: `src/bypass.ts`, `src/ask-user.ts`, and lifecycle wiring in `src/index.ts`.
Proposed disposition: retain explicit user bypass, audit entries, status, Allow/Deny/Stop,
notification failure handling, and headless refusal/report-to-parent behavior.
The virtual-input guard remains active during bypass.
Parity: `index-bypass`, `ask-user`, `update-widget`, and `model-feedback` unit suites.

### Remote judge transport and selection

Current owner: `src/evaluate.ts`, `src/judge.ts`, `src/judge-fallback.ts`,
`src/budget-model*.ts`, `src/judge-call-history.ts`, and shared review/selection packages.
Proposed disposition: remove auto-mode's provider selection, authentication, forced-tool requests,
JSON retries, remote fallback race, and provider-health selection machinery from its active path.
A Laya adapter and manual fallback would own local decision availability.
Shared review code is also consumed by `package/pi-plugin/goal/package.json`;
do not remove or change that other consumer as part of this migration.
Parity: replace transport-specific tests with zero-provider-call, timeout, malformed-result,
unavailable-runtime, cancellation, and local-result validation tests.

### Verdicts, explanations, and evidence

Current owner: `src/judge-tool.ts`, `src/judge-json.ts`, `src/system-prompt.ts`,
`src/judge-messages.ts`, `src/visible-context.ts`, and `src/types.ts`.
Incumbent verdicts include generated reason/guidance and can receive image-bearing context.
Laya's typed output is not a generated explanation or proof that omitted context is irrelevant.
Proposed owner: extension-owned policy/result validation and factual reason templates,
with Laya supplying only evaluated typed decisions.
Selection status: final authority and eligibility rules remain open.
Parity: #558 checklist plus long inputs, negation, hostile tool text,
rephrased denied goals, images, unsupported schema, and incomplete policy/context cases.

### Packaging and host integration

Current owner: `package.json`, `mise.toml`, build configuration, and exported extension factory.
Runtime install boundary: published package loaded by Pi;
`package/config/pnpr/config.yaml` references the package.
Public named exports in `src/public-api.ts` expose verification seams as well as policy helpers.
Repository text searches found test consumers for named auto-mode exports,
not an independent production caller of its judge functions.
Proposed disposition: preserve the extension's host registration and package ownership.
Parity: isolated install/import, actual Pi tool calls, type lint,
module-test unit suites, and scoped lint/build tasks.

## Historical sample

After Q5 authorization, a metadata inventory found 1,499 project session files.
A bounded newest-first sample selected 24 files that were not modified in the preceding 120 seconds,
each at most 16 MiB, with a total-read cap of 64 MiB.
Actual read size: 48,793,354 bytes; 10,437 parsed JSONL records; no malformed records.

Observed custom guard records in that sample:

- 877 verdict entries: 685 `approve`, 9 `user-approve`, and 183 `user-deny`.
- 35 verdicts explicitly marked as approval reuse.
- 182 records with the exact reason `no UI`.
- 1 trust directive and 1,837 bypass records.

These are sampled archival entries, not remote request counts, cost figures, or ground-truth safety labels.
Forks, repeated approvals, provider retries, and transport usage prevent those equivalences.
The sample excludes larger and recently modified sessions; it is not representative proof of the whole workload.
Headless behavior therefore needs explicit coverage, not a blanket promise that every fallback can show a prompt.

The script and path-only sample manifest remain in private scratch:
`~/temp/agent/laya-guard-history-summary.mjs`
and `~/temp/agent/laya-guard-history-sample-manifest.json`.
No raw action, reason, trust text, or transcript was printed or committed by this probe.

## Research still required

- Finalize open ownership/authority choices in the responsibility ledger.
- Validate each retained and replaced branch at the actual Pi integration boundary.
- Inspect the exact Laya inference, tokenization, serving, dependency, model-artifact, and test paths.
- Measure Laya CPU inference on the probed workstation inside resource-bounded isolation.
- Establish a labelled guard-action corpus, including negation and adversarial inputs.
- Measure current judge calls and costs without exporting private transcripts.
- Define deployment, error handling, explanations, rollout, rollback, and acceptance criteria.
- Complete Laya source, provenance, security, and runtime vetting before granting decision authority.
- Skip competing-candidate discovery and ranking because the user explicitly excluded alternatives.

## Next action

Complete the Laya CPU execution audit and generate transcript-derived synthetic evaluation cases.
Run offline inference in bounded isolation and inspect mistakes independently.
Use that evidence to resolve authority, trust-rule interpretation, context completeness, and cutover.
Do not require live user-supervised shadowing as the first evidence source.
Recompute the remaining interview frontier from the source findings.
Keep implementation blocked until the complete design is confirmed.
