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

### Complete current AGENTS.md is mandatory

The user added this hard requirement:

> Laya must receive the full current AGENTS.md .

Every evaluated migration decision must include the complete current repository `AGENTS.md`.
No summary, filtered subset, or silent tokenizer truncation satisfies this requirement.
Passing the full string into an API that truncates it internally is not full model coverage.
Measure actual tokens for the file plus question prefix, complete current action, and required context.
Record the snapshot hash and re-read current content rather than keeping an obsolete startup snapshot.
Do not substitute separately windowed policy fragments without resolving whether that preserves the requirement.

The existing synthetic corpus supplies scenarios only.
Its condensed context is not a valid evaluation of this newly required migration input.
Revise the runner/input preparation before measuring safety or claiming feasibility.
No Laya inference had run when this requirement arrived.

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

## Offline evaluation preparation

### Synthetic diagnostic corpus

Prepared private scratch `laya-auto-mode-eval-2026-09-26/corpus-v3.json` before running Laya.
SHA-256: `23f541af9a4518dde90131dd413c07daec276091d023f59a6d4997cfd0591d86`.
It contains 59 cases: 35 development and 24 reserved cases;
reference targets are 29 approve, 10 deny, and 20 ask.
Question schemas are predeclared semantic labels, opaque labels, and reversed semantic-label order.
No fixture command will be executed.

A second private history pass skipped 3 sample files whose sizes changed,
then inspected 21 unchanged files.
It found action-shape signals for scratch inspection, Git reads/mutations, GitHub reads,
container runs, inline interpreters, permissions, deletion, secrets, downloads, installs, and file reads.
Literal matches can overlap or occur inside quoted code;
these are discovery signals, not a production traffic distribution or independent safety labels.
The synthetic cases replace all account paths, repository names, URLs, and content rather than copying history.
Additional reserved cases exercise current policy and #558 boundaries,
including negation, revocation, quoted commands, executable payloads, missing images,
headless sessions, and long-context action placement.

An independent Advisor review identified oracle ambiguity, simulated fact provenance,
static-versus-model pipeline scope, and held-out contamination risks.
The corpus records these limitations explicitly:

- Expected labels are authored reference targets, not old-judge verdicts or measured truth.
- Both ask and deny block execution; report hazardous auto-approval separately from exact-label mismatch.
- Environment facts are synthetic ground-truth assumptions, not a proven production evidence collector.
- Static/fixed-block cases are controls, not evidence that Laya should own those boundaries.
- Most cases have not yet been run through the actual flagger, so this is not approval-coverage measurement.
- Reserved families must not guide prompt, threshold, or fine-tuning selection.
  A later cutover claim needs new independent validation cases.
- The runner must send only case state and question schema, never reference labels or rationales.
- Record actual token truncation; incomplete inputs are ineligible for automatic approval regardless of model output.

### Runtime preparation

Laya source is pinned at `4066d5d5fbf08b66c6757ddeedbd797bd7655bc0`.
The local image `localhost/laya-cpu-benchmark:0.3.6` was discovered by inspecting existing Podman images.
It contains an older Laya package with CPU torch and transformers;
it is only a possible dependency base, not the runtime source being evaluated.
The planned runner must import the freshly inspected Laya source and record its actual version/path.

Data-only downloads use the checkpoint revisions explicitly listed in `laya/revisions.py`:

- English: `55cf4c4ebb4ebe31b2550e8bdf3bd21b99753851`.
- Multilingual: `e4e9ddf21a7b1903b7acffd8814ad4307bf63a67`.
- Typed decisions: `1a793eb568e6718f15941d08f85432581df534e3`.

Only safetensors weights and allowlisted JSON configs/tokenizers are retrieved.
The downloader verifies published byte counts and LFS SHA-256 or Git-blob hashes.
It loads no checkpoint-provided code and sends no transcripts or credentials.
The first English-weight transfer hit its 300-second per-file deadline after writing 397,053,883 bytes.
A matching content-addressed English weight blob was available in a stopped local benchmark container;
it was copied to scratch for digest verification rather than blindly repeating the transfer.
Recovery uses a bounded 900-second per-file deadline for the remaining model data.
No inference has run yet.

### Full-policy tokenizer probe execution manifest

The current `AGENTS.md` snapshot has 42,514 bytes and 1,824 lines.
SHA-256: `f15df716f1a7cb9cb4838686e2cde8f006a87b99c3aa7db87533fb47b8314840`.
English tokenizer JSON comes from the verified pinned checkpoint download.
Its encoder config declares `max_position_embeddings: 8192`;
this is source configuration, not yet proof of a hard runtime limit or supported extrapolation.

The scratch probe is `laya-auto-mode-eval-2026-09-26/context-probe/`.
Its `mise.toml` defines `build` and `probe`; the Containerfile has no RUN instruction.
Build only copies the full policy, tokenizer data, and reviewed Python probe onto pinned local dependency image
`ddb7f6c055731eb83def1eca6b9568cbe6c0c54bd9f505c751dacb3fe700a5c6`.
OCI manifest digest: `sha256:ae5fec490715809bd448a0e9ccfc2489e72dab44b05757206959dc09e881a78f`.

Runtime command: `/usr/local/bin/python3 -I -S /input/probe.py`.
It bypasses Python startup hooks, explicitly adds the image's inspected package directory,
and imports stdlib plus `tokenizers` 0.22.2.
The inspected wrapper loads its Hugging Face Rust tokenizer extension;
no Laya weights, router, serving code, training, shell commands, or fixture actions are invoked.
The backend reads baked tokenizer JSON and encodes the complete UTF-8 policy and a JSON context envelope.
A deliberately enabled 64-token cap supplies a positive control before truncation is disabled again.

Expected reads: baked input files and pinned Python/tokenizers runtime libraries.
Expected writes: stdout only; root filesystem is read-only and no host directory is mounted.
Expected subprocesses and network: none.
Container runs as UID/GID 65534 with all capabilities dropped and no-new-privileges.
No host environment or proxy credentials are passed.
Limits: 2 GiB memory with no additional swap, 2 CPUs, 64 processes, 256 file descriptors,
and a 120-second container deadline.
Build also has network disabled, a 2 GiB bound, and a 2-CPU quota.
Success requires printed file/tokenizer hashes, full token counts, and a passing positive control.
Any unexpected execution, write, network dependency, or limit breach stops the probe for review.
Container is removed on exit; the scratch source/data and output evidence are retained.

### Full-policy tokenizer result

The English tokenizer probe passed with no stderr diagnostic beyond task commands.
The 64-token positive control behaved as expected.
For snapshot `f15df716f1a7cb9cb4838686e2cde8f006a87b99c3aa7db87533fb47b8314840`:

- Complete `AGENTS.md`: 11,893 tokens.
- Full file inside a minimal action/context JSON envelope: 12,501 tokens before the question prefix.
- Tokenizer SHA-256: `6c8aaa9a542084f2457eab775d4eeb51f92a70c0fd9de28d5edb0ddec3c08d30`.
- Probe image: `c77564ed8521de45f2326f61286697649ff802f532157985b28d2360e597fcc7`.
- Process: `proc_3b0b`; exit 0; process-manager elapsed 26 seconds includes image build and probe.
  This is not an inference-latency measurement.

The file exceeds the English encoder's configured 8,192 positions and Laya's default 512-token sequence cap.
Neither default setting alone proves a hard mathematical/runtime limit.
Installed transformers 5.0.0 constructs positions dynamically in
`models/modernbert/modeling_modernbert.py:923-927` and computes RoPE for supplied positions at `:312-327`.
Laya `Agent.predict` accepts a per-call `max_len` override.
Next probe: exercise an actual bounded full-length forward pass,
record all retained tokens, and distinguish runtime acceptance from decision quality or supported extrapolation.
Do not substitute truncation or policy window fragments.

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

Snapshot and measure the full current `AGENTS.md` with the actual Laya checkpoint tokenizers.
Revise every diagnostic input to carry the complete file and verify model coverage.
Finish the Laya CPU execution manifest and input-projection checks.
Verify downloaded artifact hashes and run offline inference in bounded isolation only after the new input gate is explicit.
Inspect mistakes independently without using reserved results to tune the tested schemas.
Use that evidence to resolve authority, trust-rule interpretation, context completeness, and cutover.
Do not require live user-supervised shadowing as the first evidence source.
Recompute the remaining interview frontier from the source findings.
Keep implementation blocked until the complete design is confirmed.
