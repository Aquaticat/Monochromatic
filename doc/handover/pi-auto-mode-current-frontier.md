# Auto-mode current frontier

## Purpose and live status

Continue the authorized auto-mode repair,
architecture cleanup and complete lint queue without asking the human to request continuation.
Updated 2026-10-18.
The [historical frontier archive](pi-auto-mode-frontier-2026-10-18.md)
retains the original incident evidence,
adopted designs,
failed experiments and superseded next actions.
It replaces a 14,000-line chronological checkpoint as the current resume surface.

The work is **not complete**.
The native cancellation-control defect is repaired and consumer-verified.
MiMo is now performing the first actual lint-editing checkpoint through supervised Pi RPC.
Full-package lint completion,
final configured replays,
final measurement and final documentation remain open.
Do not repeat a premature readiness claim or return a manual handoff.

## User requirements and settled constraints

The human reports at least five premature readiness claims and requires sustained work through completion.
Their concern is valid Pi,
Node and Linux behavior exposing defects in this code,
not presumed defects in those platforms.
They authorize invoking and monitoring MiMo directly through Pi RPC.
They authorize shared logger fixes and require a publishing version bump if that package changes.
Logger `0.4.2` is now published and registry-consumer-verified.

Keep root `TCV` unchanged.
Missed-boundary lessons belong in package docs;
`EVQ` in the instruction-collection explanation requires actual retained event evidence.
There is no adopted 13k line target.
Measure runtime,
verification and build code separately,
and justify each retained major responsibility in package-local docs.
Do not relax lint rules,
coverage or severity to clear diagnostics.

Preserve original request/source occurrence identity,
publication and freshness,
complete prepared-group membership,
callbacks,
execution order,
cancellation,
issued-work drain,
exact-group Allow/Stop and headless withholding.
Provider checks inspect actual transmitted requests for required and excluded material,
including exclusion of raw structured command payloads,
thinking and signatures.

Luna stays `openai/gpt-6-luna-decisions`,
cutoff `0.60`,
three sequential bundles of up to three parallel calls,
at most 200 questions per call,
and one eligible retry.
Fifteen seconds remains advisory.
Clause,
heading,
unit and whole-operation fallbacks remain distinct.
The canonical native interface supplies the generated bridges;
the retired extension pipeline and whole-call adapters remain removed.

## Active MiMo checkpoint

The live controller uses `llmgateway-devpass/mimo-v2.6-pro` and pins `native-release-dXedQJ`.
Its fixture is `${HOME}/temp/agent/pi-mimo-rpc-session-5F6ed2`.
The controller command session is `82172`;
its actionable-state watchers are short-lived;
the newest one is recorded by the current command tool session.
Its log is `mimo-rpc-session-lint-cluster1.log` in the investigation scratch.
The actual command is stored in `mimo-lint-cluster1-command.json`.
That prompt is supervisory-agent delegation within the human's existing authorization,
not a new human request or a source of additional permission.
The initial group is withheld for command-chain and long-flag violations;
the new idle-turn prompt in `mimo-resume-cluster1-command.json` restates the same authorized checkpoint.
The first scoped diagnostic run reports 412 warnings and eight errors in 3,511 output lines.
At 33 tool results,
the supervisor allows only the displayed private-log histogram commands
through selector `8fae1bc3-3ebf-48e8-a050-f0d718b9c744`.
These are scoped diagnostics,
not a clean-lint or completed-edit claim.

### Reopened parallel progress freshness failure

The actual two-command histogram group exposes a separate runtime failure after RPC Allow.
`call_712e50eea8bb4a3397ce36d2` executes;
`call_7da656b11baa42d5971c1183` is withheld with
`The established policy decision is no longer current; propose the operation again`.
The cause is `PolicySlotBindingError: Native extension event callbacks changed after source capture`.
The saved domain changes from revision 3992,
`tool_call`,
pending zero to revision 3993,
`tool_execution_update`,
pending one;
registered event kinds are unchanged.
There is no active RPC steering message in this incident.
Keep it separate from the earlier steering freshness guard and signal-prototype defect.

Evidence is `mimo-parallel-allow-stderr.log`,
`mimo-parallel-allow-events.jsonl` and `mimo-parallel-allow-next-state.json` in the scratch.
The deciding guard is
`package/pi-plugin/auto-mode/native/contract/integration/policy-source/policy-input-collector.mjs`.
Reproduce with actual native progress callbacks and a complete parallel group,
then preserve real governing-source,
tool-input and cancellation invalidation while removing the false progress invalidation.
Do not fix it by ignoring arbitrary stale-source errors or weakening permission guards.
Source inspection finds an existing execution-retention handoff after automatic approval
in `native/contract/integration/native-batch/prepared-group.mjs`,
but none after confirmation resolves an automatic Ask to Allow.
The collector already supports append-only event receipts after that handoff.
The maintained decision-fallback fixture now emits tracked progress from both tools
and registers an asynchronous original extension observer for every existing decision mode.
New `allow-stale` and `allow-abort` cases change governing policy or cancel during confirmation.
The paired regression is now proven on `native-release-dXedQJ`:
automatic approval executes both tools and observes both tracked updates;
confirmed Allow fails with `1 !== 2` and the same callback-revision freshness cause.
Evidence is `progress-manual-red.log` and `progress-automatic-control.log`.
Commit `83b10e751f` preserves the failing regression before the repair.
The source repair shares the existing approved-dependency handoff across automatic approval
and confirmation of a captured automatic review.
Manual fallback without captured automatic sources keeps its original behavior.
Repair commit `9f357591dd` builds as `native-release-rKKphY`
from an archived committed contract snapshot while the worker keeps its previous pinned runtime.
The complete `test:native:decision-fallback` task passes,
including tracked progress after automatic approval and confirmed Allow,
Stop,
dismissal,
headless withholding,
source replacement,
cancellation,
prohibition and the new confirmation-time source/cancellation controls.
Evidence is `confirmed-progress-suite.log` and its bounded-task receipt.
A private source-copy rebuild removes only the confirmed-approval retention call.
The maintained `unknown` regression fails with `1 !== 2` and the original callback-revision cause.
`confirmed-progress-mutant-receipt.json` verifies unchanged production hashes and active publication.
Next run the execution/ownership/phase safety tasks,
then restart the RPC worker on the verified runtime with its saved session preserved.
Add private actual-request capture and exercise RPC compaction before continuing the scoped edits.

### Reopened persisted assistant-content capture failure

The preserved real worker session opens in captured RPC fixture `pi-mimo-rpc-session-6nOsXz`
on `native-release-rKKphY`,
but startup retains `SessionInputCaptureError` with `Run message profile supports text content only`.
The original failure is `loaded-history.mjs` calling the text-only validator on assistant content.
Live manager capture already uses `assertManagerMessageContent`,
which preserves native text signatures,
thinking and tool-call blocks.
Keep this incident separate from progress freshness and cancellation-handle projection.
RPC `compact` succeeds with `tokensBefore: 145267`,
and the probe confirms actual `session_before_compact`,
an original cancellation handle and 108 branch entries.
That success does not clear the retained history error or establish the next tool review.
The maintained SDK persistence and live/load differential regression is committed before the repair.
Commit `927ad36265` preserves the regression before repair.
The actual SDK reopen fails with the same retained text-only error on `rKKphY`;
evidence is `loaded-message-content-red.log`.
The repair reuses the existing manager-content validator in loaded history,
preserving supported blocks and its rejection of unsupported fields/types.
Its committed source still needs an owned rebuild and the differential/SDK persistence checks.

The worker is restarted fresh as `pi-mimo-rpc-session-JTeYFr`,
session `44944`,
with actual Luna-body capture and verified runtime `rKKphY`.
Its current editing checkpoint is only the CLI network guard and process consumer pair.
The supervisor owns the other original checkpoint files during the history/compaction investigation;
their lint work stays queued.
This keeps lint implementation independent of the failing resumed-session consumer.
At this checkpoint,
Git shows no MiMo source edits yet;
its first lint slice is still analysis.
The supervisor allows the subsequent one-command private-summary preview only.

The first checkpoint clears all findings in these package-relative files:

- `native/contract/collector/run-prompt-custody-v3/event-controls.ts`.
- `src/native-event-controls.test.mjs`.
- `src/native-session-actions.test.mjs`.
- `native/contract/integration/native-host/process-network-guard.ts`.
- `native/contract/integration/native-host/process.test.mjs`.

MiMo may extract necessary sibling helpers and their rationale.
It must commit explicit paths and report a fresh zero-finding scoped lint result before this checkpoint ends.
The supervising agent then reviews and independently verifies the change,
then assigns the remaining full-package clusters without asking the human to continue.
Do not concurrently edit those worker-owned source files or run verification against changing inputs.
The concurrent `package/config/pnpr/config.yaml` change belongs to another worker.

The host has a 2-GiB memory and 2-CPU limit,
a disposable home,
private project settings,
private package caches/logs,
`rg` on PATH and a recursion guard.
The controller resolves the repository's Mise environment without printing credentials.
It launches maintained Pi from the repository root,
not the package `native:cli` task whose cwd lacks this bootstrap's `AGENTS.md`.

Private tasks `mimo-rpc-command` and `wait-mimo-lint` send atomic commands and wait for actionable state.
Inspect every complete approval group before responding through RPC;
do not blanket-approve unrelated operations.
Use a new prompt after idle for the next checkpoint.
A live steering message can replace the recorded run input while an old request is being reviewed,
which trips the explicit freshness guard.
That incident is separate from the repaired signal copier;
its saved evidence is `mimo-live-closure-failure.json` in the scratch.
Do not cite historical witnesses or supervisory prompts as new human authorization.
Close the controller and verify process retirement before removing its pinned native release.

## Verified repairs and evidence

### Shared logger and publication

Logger `0.4.2` deduplicates pending completion observations without dropping sink invocations.
Serial file batches preserve reentrant serialization order,
independent file ownership,
complete JSONL and recovery after filesystem/serialization failures.
The package-local [write-completion explanation](../../package/module/logger/doc/write-completion.md)
records the structures and limits.
Build,
full units and types pass;
Oxlint reports zero warnings and errors across 63 files.
The 100,000-record regression retains 48,304 bytes against its 93,863,816-byte failing baseline.
Four private rebuilt mutations fail their maintained regressions with production hashes unchanged.

Version commit `3befa69c148c609f864fdb200c75cbbb6d9e0cce` reaches the remote and triggers release.
Automatic run `39104844467` fails with pnpm `ERR_PNPM_FAILED_TO_PUBLISH`,
HTTP 404;
that response does not establish the authentication cause.
The targeted recovery first exposes missing generated root Mise tasks.
Their authoritative source is repaired in `mise.no-env.toml`,
and the original `file-enforcer.config.ts` generator regenerates `mise.toml` without touching concurrent owners.
Commit `d6d1d67b069de6dd6cff8dc7543f06bd6fd94caa` reaches the remote.
Targeted run `39106517976` succeeds.
The registry's SLSA statement names that commit,
`.github/workflows/npm-publish.yml` and that invocation.
A fresh registry consumer verifies exports and five tagged,
large,
reentrant and independently owned-file records as valid JSONL.
The automatic pnpm HTTP 404 remains a distinct unresolved publishing path;
publication through the established targeted path is complete.

### Native control projection and lifecycle

Ordinary event copying rejected Pi's real `AbortSignal` in `session_before_tree`.
The passive observer preserved callbacks but retained a failure for later assessment readers.
The initial committed RED consumer reproduces that distinction in `native-event-controls-red.log`.
Pi also supplies the control to `session_before_compact`.

A Node `v26.12.0` probe shows the intrinsic `aborted` getter accepts copied reflectable symbol state
and invokes composite-signal refresh.
It is not constructor authentication or a side-effect-free camera.
Default abort reason is a `DOMException`.
MiMo independently reviews the corrected opaque-control design and retracts its earlier getter/brand proposal.
The new receipt retains an authority-free reference scoped to one original emission,
never reads control internals,
and preserves every other event descriptor through the unchanged strict copier.
The map survives all publish parts.
Cancellation remains the original SDK/control owner's job.

`native-release-FWhe9T` passes the opaque-control consumer,
all 14 real session-action modes with explicit manager-capture assertions,
and the complete affected native matrix including units and types.
Logs are `native-event-controls-green.log`,
`native-event-controls-lifecycle.log` and `native-event-controls-matrix.log`.
The lifecycle sequence's final CLI fixture initially fails independently:
its background startup classifier lacks the synthetic credential while every fetch is rejected.
The fixture now answers only that classifier locally,
rejects external routes,
records a positive local request,
and waits for child `close` before checking complete stderr.
Rebuilt `native-release-dXedQJ` passes types and the actual CLI process test:
one local classification request,
zero external requests,
verified RPC state and clean shutdown.
Evidence is `native-cli-fixture-types.log` and `native-cli-local-classification.log`.

Six private source-copy variants each rebuild and fail the maintained control consumer:
kind scope,
output scope,
control identity,
ordinary-field retention,
proxy rejection and control opacity.
`native-event-control-mutants-receipt.json` proves production source/output hashes and active publication unchanged.

### Complete configured replay baseline

On `native-release-mmaT8k`,
faithful fixture `pi-mimo-failure-rpc-7vxnGu` and fragmented fixture `pi-mimo-failure-rpc-LD83ST`
each complete 52 original calls,
62 actual Luna requests,
zero selectors and exit zero.
Both actual payload audits pass their positive controls with no excluded structured fields.
The fragmented case is a synthetic stress profile,
not a claim about unknown original network chunk boundaries.
Prohibition withholds both process/Bash members with zero selectors and three live Luna responses.
Configured Stop,
cancel and abort controls each show one selector and withhold both members.
Repeat the complete configured evidence on the final post-lint artifact before completion.

Raw stderr is retained.
Private reserve-stack probes,
the offline Synthetic catalog-route failure,
tagged deliberate cancellation and unavailable desktop notifications are separate observations.
Do not equate any error-word hit with a bare shutdown error or filter the noise away.

## Queue and completion boundary

- Review MiMo's first coherent checkpoint,
  rebuild affected consumers,
  run types and meaningful native controls,
  then continue through the remaining full-package lint clusters.
- First reproduce and repair the parallel progress freshness failure,
  with automatic and exact-group Allow controls,
  genuine source-change rejection and rebuilt guard mutations.
  Coordinate source ownership with the live worker and restart its pinned host after the repair.
- Obtain a fresh complete lint result with zero warnings and errors,
  passing appropriate tests,
  and comparison of exported/implementation branches against exercised consumers.
- Build the final native output and repeat both complete configured replay variants,
  actual required/excluded provider-payload audits,
  prohibition,
  confirmation,
  cancellation and complete cleanup/stderr checks.
  Also exercise actual configured-host compaction and the next tool review,
  with a positive control that reaches `session_before_compact` and an actual provider-payload audit.
  The standalone control fixture reaches that event kind,
  but its authored preparation is not the full configured compactor's preparation.
- Finish the native-control component rationale and refresh architecture/handoff docs against the final evidence.
  Every major responsibility keeps its package-local justification.
- Measure final source/runtime/verification/build inventories and footprint.
  Re-audit native process consumers with a positive control,
  run cleanup dry runs and root stray-git checks,
  then remove only reviewed inactive artifacts after consumers retire.
- Render final package and canonical Markdown,
  commit explicit scoped paths,
  verify remote containment and report the completed result with material limits.

The named pre-control-regression lint snapshot is 13,834 warnings and 83 errors across 818 files.
The source snapshot is 66,392 nonblank code lines,
including 29,291 verification lines.
The last reviewed cleanup removes eight inactive releases and measures 22,933,936 regular-file bytes,
20,180,992 unique allocated inode bytes and 2,912 regular files,
excluding shared dependency symlink targets.
Later builds add releases;
these values are historical checkpoints,
not final post-lint measurements or total dependency deployment size.
The corrected process audit recognizes Pi's `process.title`,
`/fixture-node` executables and fixture inode identity across all `/proc` entries.
Transient vanished PIDs need a fresh existence check,
not a false live-consumer finding.
Keep one genuinely verified rollback until final cleanup is justified.

The investigation scratch is `${HOME}/temp/agent/pi-mimo-preparation-failure-20261018`.
The earlier lint/architecture scratch is `${HOME}/temp/agent/pi-mimo-lint-approval-20261017`.
Their private receipts retain commands,
logs,
source hashes,
provider captures and counterfactual builds.

## Tool-call scope correction

The historical witness and its limits remain in the
[archived scope correction](pi-auto-mode-frontier-2026-10-18.md#tool-call-scope-correction).
This heading preserves existing links;
it does not reopen a historical queue or grant new permission.

## Original rendered prompt-input contributions

The original derivation evidence remains in the
[archived prompt contributions](pi-auto-mode-frontier-2026-10-18.md#original-rendered-prompt-input-contributions).
This heading preserves existing links;
current consumers and their verification are described in the active checkpoint.
