# Preparation plan and journal implementation

## Current state

Task47 is complete within its recorded artifact-qualification scope.
The sealed runner reconstructs unqualified inputs only;
do not duplicate it or add arbitrary execution modes.
Task41 now owns finite correspondence plans and the acquisition journal.
Its implementation is split into task51 for persisted-input comparison verification,
task52 for finite root/phase materializers and task53 for current-attempt acquisition journals.
Task52 waits for task51;
task53 waits for task52.
Task41 remains incomplete until those owners satisfy their own acceptance boundaries.
No paid acquisition or writer calibration is authorized by this work record.

The canonical standing constraints and completed input-runner evidence are in
[`translation-repair-writer-unit-scope-2026-09-11.md`](translation-repair-writer-unit-scope-2026-09-11.md).
The final input artifact has SHA-256
`12c4f304dad2a7039c5452ae7f3de5a84160f759e27968e05e47494c0f3eb75a`.
It is not a reviewed plan or evidence receipt.

## Existing interfaces to compose

- `buildPreparationRootInputs` owns current corpus reconstruction and frozen-parent lookup.
  Its registry distinguishes writer parents,
  definition dependencies and structural dispatch.
- `captureBlockPairingRequests` materializes native header-free provider bodies without transmission.
  It records initial gather plus `STAGE_RETRY_ROUNDS`,
  per-provider HTTP bounds and a self-digest.
  It does not prove current seating,
  provider availability,
  acquisition provenance or approval.
- `PreparationReceiptBinding` separates plan,
  attempt,
  receipt,
  pipeline,
  configuration and roster identities.
- `readPreparationReceipt`,
  `readPreparationOccurrence` and `readPreparationDefinitionRelations`
  already own raw-outcome replay and their distinct evidence authority.
- `createPreparationAttempt` owns exclusive namespace creation and synced plan/identity files.
  It checks JSON object syntax,
  not root-plan semantics,
  phase review or directory power-loss durability.

## First provider-free measurement

Managed process `proc_ae93` completes the initial request census with exit zero.
Its log is `preparation-root-request-census-20260914.out` under private agent scratch.
Structured output is `preparation-root-request-census-tInl5c/request-census.json`.
The worker uses the already frozen application runtime and exact input artifact,
with network disabled and a positive fetch-interception control.
It reads the compiled `RUN_ROSTER` and materializes potential requests for queried registrations.
The timeout value comes from the separately read `RUN_PER_CALL_TIMEOUT_MS` in `run-config.ts`.

The measured census contains 42 queried parents,
12 configured model identities,
1050 potential provider bodies and a conservative initial envelope of 21000 model POST attempts.
These are potential-envelope counts,
not predicted requests or cost.
The structural entries remain the implicit gaoyanger,
xuewulihuameng and zheermao parents.
The instrumented fetch count is zero after the positive control.
No provider or accounting operation is authorized by these measurements.

This census is not a root plan,
a provider seating decision or permission to acquire evidence.
It does not yet register conditional post-relabel phases,
budget GETs,
redirects or live journal claims.

## Required owning behavior

Register finite initial and conditional post-footnote slots before acquisition.
Exact question aliases may share payload lineage,
not occurrence qualification or voters.
No finding,
failed review,
cache miss or revision may create work outside those slots.

Persist each root or materialized phase,
exit,
review its exact bytes separately,
then independently rebuild before constructing live clients.
The journal must own exclusive claims,
leases,
write-before-I/O records,
raw responses,
usage and route/HTTP/redirect lineage.
Retain complete usable output after later verification failure;
never resume,
overwrite or repurchase automatically.

Definition-only receipts have no body,
media,
decline or archive-prose authority.
Mio source/context coverage and the other outstanding reading obligations remain explicit.
None may be replaced with fabricated approval or sample substitution.

## Scoped design review

The independent review proposes a closed root,
initial-phase and post-footnote-phase materializer,
with finite occurrence slots and per-model claim units.
It also identifies binding ambiguity in `acquisitionPlanDigest`,
seating ownership and redirect accounting that must be resolved before live journal work.
This is design input,
not acceptance of a root plan or an exported implementation.

One proposed recomputation step does not fit the actual DTO.
`PreparationRootRawDocument` stores identities and extents,
not every raw document body.
`PreparationRootReference` likewise stores hashes,
extents and bindings,
not supporting artifact bytes.
Only selected complete entries retain prose.
The Task47 artifact alone therefore cannot rebuild the complete population and supporting-evidence interpretation.
The next design must compose the existing native input owner with original bounded input evidence,
or require its independent exact-byte rebuild;
it must not invent a second complete-corpus reconstruction from absent bytes.

Keep deterministic root/phase plan bytes separate from random attempt identity and storage paths.
Alias authority belongs to each occurrence's role,
not to the union of roles sharing a receipt.
Conditional questions are materialized only after qualified initial evidence determines the deterministic relabel;
unknown future bytes must not be fabricated in the root plan.

## Retention-boundary correction

Commit `33df5ddd2` added an optional expected output identity inside `buildPreparationRootInputs`.
Independent review rejected that placement before tests or qualification:
a mismatch would throw before the I/O owner could persist the fresh differing reconstruction.
The diagnostic's instruction to retain both results could not be satisfied through that API.
Commit `cce2219af` removes its identity type,
optional argument and comparison.
The remaining source change is not only the corpus-pin helper extraction:
`buildPreparationRootInputs` also names its result before the final success log,
so reference and question-alias construction precede that callback.
Its TSDoc names the post-persistence comparison boundary.
The helper's logic is moved unchanged;
commit `4aa61c52e` formats its imports.
A diff against the parent of `33df5ddd2` and targeted source searches verify this scope.
The removed expectation type,
argument and diagnostics are absent.

Task41 must instead invoke the existing fixed Task47 operation from original bounded evidence,
allow the fresh run to persist and verify its artifact and completion,
then compare independently reverified artifact identities.
A mismatch retains that complete run and a Task41-owned expected/observed comparison record,
creates no root plan or acquisition attempt,
and does not retry or overwrite.
No DTO reserialization or second reconstruction implementation supplies that comparison.

This correction is not a completed Task41 implementation.
The next consumer still needs strict artifact reading,
fixed persistence,
retention tests and complete native integration verification.

## Native persisted-comparison probe

The frozen probe `node_modules/.frozen-preparation-input-comparison-2JDKo6/run.mjs`
under the translation-repair package has SHA-256
`7c454c004db3b82c3bc6af49830cfcf604d8d1a0376ce698e57cceed159bce15`.
It invokes the actual Task47 `WWrgVV` bootstrap and `fOagX0` runtime,
not `runProducerInputHost` from a differently authenticated entry.
Both runs use the unchanged pinned corpus and frozen selection in fresh exclusive namespaces.
The probe is syntax-compatible TypeScript copied to `.mjs` before execution;
no frozen file is edited.

`preparation-input-comparison-probe-mxsJW2/verification.json`
under private agent scratch records successful matching and differing-reference cases.
The matching case reaches a synthetic continuation witness.
The deliberately wrong reference digest causes a names-only refusal only after the fresh artifact,
completion and independent comparison record exist.
It does not reach that witness.
Both fresh artifacts retain 2821409 bytes and SHA-256
`12c4f304dad2a7039c5452ae7f3de5a84160f759e27968e05e47494c0f3eb75a`.
Both completion files remain readable after comparison.

This establishes the tested persistence ordering through the real fixed CLI.
It does not establish a production Task41 reader,
root-plan creation guard,
exhaustive file-race defense or independent parser correctness.
The synthetic continuation is not a root plan or acquisition attempt.
No model invocation is made by this probe.

## Task41 implementation checkpoint

The comparison owner is implemented but verification remains incomplete.
Its dedicated inert build entry is `producer-input-comparison.mjs`;
it is not an alternate Task47 CLI or a generic command runner.
Internal building blocks include:

- `producer-input-completion-record.ts`:
  shared closed completion parser taking owned run and launch primitives,
  not a fabricated full host DTO.
- `producer-input-comparison-model.ts`,
  `producer-input-comparison-error.ts` and `producer-input-comparison-contract.ts`:
  base-launch authority,
  distinct derived-launch identity,
  names-only refusals and primitive ownership before callbacks.
- `producer-input-comparison-storage.ts`:
  exclusive comparison records plus an initially empty private `producer-runs` descendant.
- `producer-input-comparison-launch.ts`:
  exact base bytes,
  explicit closed derived launch changing only `outputParent`,
  and separately persisted base/derived lineage.
- `producer-input-comparison-process.ts`:
  one fixed bootstrap invocation,
  internally selected Node and minimal environment,
  runtime/bootstrap byte checks,
  retained streams,
  actual-close observation and bounded interruption.
- `producer-input-comparison-child.ts`:
  post-close direct-child observation capped at two returned entries,
  with explicit ambiguity rather than selection among candidates.
- `producer-input-comparison-output.ts` and `producer-input-comparison-output-shape.ts`:
  closed dedicated-input-parent,
  application-output and empty-home inventories;
  creation/completion/cleanup consistency,
  executed launch binding and streamed artifact verification.
  The comparison root and native control root are not closed inventories.
- `producer-input-comparison-file.ts`:
  original created descriptor snapshots checked against final pathnames,
  private permissions and mutation timestamps.
  Metadata records and launch bytes also receive persisted-byte verification;
  stream descriptor snapshots survive native close for the output reader.
- `producer-input-comparison-interrupt.ts`:
  scoped interruption timers without caller logging in event callbacks.
  Interruption logging stays at the awaiting owner.
- `producer-input-comparison.ts`:
  one owning composition,
  serial settled execution and child-observation evidence,
  post-persistence comparison,
  retained failure records and no automatic retry.

The dedicated native output parent addresses failed or timed-out bootstraps that never print a success directory.
This invocation's trusted Task41 owner authorizes a private descendant derivation;
base-launch hashes and filesystem writability do not independently grant that authority.
Task47 itself receives an ordinary exact derived launch through its unchanged fixed CLI.
Completion must bind the derived SHA;
comparison records must retain both base and derived identities.

The shared parser and initial contract/storage checkpoint pass type checks.
The derived-launch/process/observation checkpoint also passes `lint:types` in `devtypes-EUszfp`,
with no source changes or OOM/PID event.
`preparation-comparison-derivation-types-20260914.out` retains that result.
The complete owner passes types,
normal/bootstrap builds and the separate runtime seal.
The earlier frozen parent runtime `node_modules/.frozen-input-comparison-runtime-TnArUr`
has 164 manifest files and manifest SHA-256
`4a89d5c9c466e4b80a051324a604196f3e82b7bdc2b5bcf3eb8c34f82c030cf5`.
`current-input-comparison-native-N6oMvI/verification.json` under private agent scratch
records matching and wrong-reference calls through this built API and the actual Task47 bootstrap.
Both retain their native artifact and completion.
The consumer verifies exact base bytes,
only the derived output-parent change,
base/derived identity separation and derived-SHA completion binding.

Committed consumer regressions use an explicitly authenticated fixture bootstrap,
not a fake claim that those fixture outputs came from Task47's application.
They cover matched/mismatched references,
bootstrap failures,
missing/ambiguous child observations and output/lineage refusals.
`current-comparison-package-verification-20260914.out` records passing types,
normal/bootstrap builds and initial comparison plus names-only tests.
Its full lint completes 1557 files and 484 rules with 471 warnings and 7 errors,
not an OOM failure.
Missing TSDoc,
ASCII identity iteration,
nullable UUID checks and unsafe fixture JSON reads are then corrected.

The private formatter overlay `devformatcomparison-IyzRg1` changes only comparison source files,
but its oracle suffers a kernel-confirmed `tsgolint` memcg kill.
Its edits are not called converged or verified lint output.
`comparison-format-ast-5B4o0i/report.json` checks the ten changed files with a positive comparator.
The non-location/comment/parenthesis differences are separate `signal`/`l` destructuring
and nonnegative directory-array lengths using `> 0` rather than `!== 0`.
That reviewed partial formatting is transferred only after all development-before hashes match.
It does not establish independent runtime equivalence.

Subsequent descriptor binding and module splits change the implementation again.
The `TnArUr` native evidence is therefore stale for those new branches.
New committed controls cover independent Node authentication,
exact minimal environment,
metadata collisions,
equal-byte pathname replacement,
concurrent failed invocations,
late cancellation,
actual-close ordering and deadline escalation.
The logger-failure control now throws once on the actual awaiting-owner interruption message.
The R2 sequence `comparison-r2-verification-20260914.out` passes types,
normal/bootstrap builds,
the incumbent Task47 bootstrap tests,
the new comparison tests and names-only inventory.
Its full-scope lint `devlint256go1-YmE28G` reports 151 warnings and zero errors without recorded OOM events.

The second formatter overlay `devformatcomparison-hw4tpo` also fails,
with kernel-confirmed `tsgolint` memcg kills of host PIDs `3499979` and `3500341`.
The retained container is `b5298fd752501207dd34b34d9fb8f46429a8bce1e58b92f331f75cfc8e09a255`.
`comparison-format-ast-9CuORg/report.json` checks ten changed files with a positive comparator
and finds no normalized AST differences.
The transfer matches every development-before hash.
This remains partial formatting evidence,
not a successful formatter oracle or a runtime-equivalence certificate.

R3 `comparison-r3-verification-20260914.out` passes types,
normal/bootstrap builds and the focused test entries.
Its full-scope `devlint256go1-gqlzJu` reports 46 warnings and zero errors on 1561 files with 484 rules.
R4 `comparison-r4-verification-20260914.out` likewise passes the builds and focused tests;
`devlint256go1-F1Qo0J` reports two warnings and one readonly-parameter error on the same file/rule counts.
Neither lint run records an OOM event.
The R4 result is not zero-findings verification.

Commit `8ba9b900d` extracts documented metadata access to function scope,
uses concurrent independent directory observations,
names UUID field widths and gives positive API cases explicit fulfilled-outcome assertions.
It adds separate Node binary,
version and component-version refusal cases.
Commit `5ed18da3d` makes directory observations deeply readonly
and fixes the remaining literal/chain layout findings.
R5 `comparison-r5-verification-20260914.out` passes types,
normal/bootstrap builds and focused tests.
Its read-only lint oracle `devlint256go1-PGjjx1` reports zero warnings and zero errors
on 1561 files with 484 rules.
Peak cgroup memory is `2147483648` bytes with no recorded OOM event;
this is not evidence of spare capacity or universal memory stability.
Source and configuration remain read-only to the verifier;
only designated build outputs and private diagnostic sinks are writable.
No rule or resource limit is relaxed.

Current-artifact resealing,
native requalification,
complete unit/branch coverage,
listed guard proofs and evidence cleanup remain outstanding.
No matching/mismatch run grants root or phase approval.

## Full-suite checkpoint and task54 logging blocker

`comparison-full-unit-20260914.out` records the default package suite at the `5ed18da3d` implementation.
The private run `devfull-4za6Le` has 632 expected and 632 observed test-entry processes,
all observed on Node `26.8.2`.
The verifier compares the complete expected/observed entry sets,
checks source/configuration identity and records zero OOM/PID events.
Peak cgroup memory is `556630016` bytes.
This is an entry-process count,
not a test-case count or proof of untested branches.
It predates the new logging regressions.

The first independent Advisor invocation expires without a review.
The second identifies an uncovered callback boundary in `producer-input-comparison.ts`:
its terminal catch calls the caller's `warn` before attempting `failure.json`.
A persistently throwing logger can therefore replace the chosen names-only error
and prevent the failure-record attempt.
Preflight and creation catch blocks have related exposure.
Creation also logs success before returning the created run to its outer owner.
Logging inside the storage transaction can report failure after content has already synchronized.
These are source-reviewed defects,
not consequences of the formatter OOM incidents.
Existing physical artifacts need not be deleted for failure-record retention to be broken.

Task54 owns this blocker;
task51 returns to pending until the remediation is verified.
The required precedence is the original fixed operation failure,
with only actual failure-record persistence refusal allowed to supersede it as `storage`.
Caller logging must not leak arbitrary thrown values or prevent retained failure evidence.
Move telemetry to ownership-known boundaries or isolate its exceptions;
do not remove logging infrastructure,
add generic execution modes or retry the operation.
Storage and created-run handoff must not depend on a successful caller callback.
The earlier once-throwing interruption control does not establish persistent-logger behavior.

Commit `13870bd70` adds persistent warning regressions for mismatch,
bootstrap and output failures using ordinary and revoked Error objects,
preflight refusal,
post-creation success logging,
failure-record collision and interruption after native close.
The tests check retained useful output before the designated missing-record assertion where applicable.
Managed process `proc_dd50` completes the red verifier.
Types and normal/bootstrap builds pass;
`devtest-iU1fZl` then reports exactly ten designated ordinary `AssertionError` leaf failures.
Its `logging-red-reading.json` retains each test name and assertion location.
The post-output cases fail because `failure.json` is absent after useful artifact bytes are verified;
preflight,
interruption and collision cases expose the caller's Error instead of `ProducerInputComparisonError`.
The post-creation case likewise lacks `failure.json` while `created.json` exists.
The verifier checks no source/configuration change,
OOM/PID event or signal.
`comparison-logger-red-verification-20260914.out` retains the build and native test outcomes.
The red verifier's zero exit means the defect was reproduced,
not that the package tests pass or the defect is fixed.
No remediation or guard-removal proof is established at this checkpoint.

## Observable logger callback utility

Task55 implements `observeLoggerCallbacks` in `package/module/logger`,
not a comparison-only public test entry.
It retains lazy per-request lookup,
original receivers,
message order and every requested attempt.
Synchronous callback/getter throws and explicitly awaited flush rejection are contained
without inspecting or retaining the thrown value.
The facade introduces no sink,
retry,
timer or implicit flush.
Void callbacks returning unobserved rejected promises remain outside its contract.

The result provides a frozen logger facade
and fresh frozen callback-name snapshots,
deduplicated in canonical order.
The snapshot describes callback failure,
not message delivery or operation cancellation.
README usage wraps the caller logger before composing tags
and takes the terminal snapshot after the final requested callback.

`logger-callback-checks-r1L1OU` passes the complete logger build,
types,
unit task,
read-only lint and README Markdown checks.
A consuming-package smoke imports the built root from translation-repair,
checks actual `tagged` composition,
original receivers,
contained warning/flush failures and the final names-only snapshot.

The new fixture checks require original spy handles to be saved before replacing properties:
`fixture.logger` and `fixture.spies` intentionally reference the same object.
Native rejection controls use `Promise.allSettled` envelopes.
A separate built-package probe finds that module-test's async `getRejection`
adopts arbitrary rejected objects before matching;
revoked and Promise-valued rejections therefore fail identity assertions.
[Issue 519](https://github.com/Aquaticat/Monochromatic/issues/519) records that adjacent defect
and the explicitly unreviewed fixture workaround.
The module-test implementation is not changed here.

`logger-callback-guards-ZpNMxI` records successful builds and designated ordinary assertion failures
for synchronous and flush containment,
each name-recording branch,
level and flush receivers,
callback-free construction,
canonical ordering and frozen snapshots.
Baseline and restored built-artifact tests pass,
and the real source remains unchanged.
These are the listed controls,
not an exhaustive runtime-equivalence claim.
Final recheck `logger-callback-checks-4mXXKz` passes the complete build,
types,
unit,
read-only lint,
README Markdown and consuming-package smoke after the construction control.
Lint reports zero warnings and errors across 56 files and 485 rules.
Peak cgroup memory is `627605504` bytes with zero OOM/PID events.
These results complete task55's utility acceptance,
not comparison integration.
The utility remains explicitly unreviewed in issue #509.

## Earlier verified checkpoint: task50

The retained corpus-pin extraction passes types,
normal/bootstrap builds and both the native-root and names-only test entries.
Full lint first reports only import-layout warnings,
which are corrected.
The next full run is memcg-killed in `tsgolint` under the previously successful single-Go-thread profile.
Task50 obtains unchanged-source full-lint successes and designated positive controls without weakening checks.
The Node old-space `256MiB` plus semi-space `1MiB` profile completes both normal-source checks
and both designated positive findings.
The default-young-space reversal also succeeds,
so the semi-space setting is not established as necessary or causal.
Task50's private proof is `preparation-current-proof-BqAe6I` under agent scratch.
It retains 8429 hashed regular files and the full source-identity comparisons.
All 19 audited stopped diagnostic container IDs are removed and independently absent;
`davincibox`,
worktrees,
corpus and frozen evidence remain untouched.
These results close the bounded lint-verification work,
not Task41's plan or journal implementation.
See [`oxlint-type-aware-cgroup-memory.md`](../troubleshooting/oxlint-type-aware-cgroup-memory.md)
for exact run identities and the limitation of prior per-run successes.
No plan or journal implementation is complete.

## Next action

Integrate the accepted shared observation facade in task54's persistent-logger retention remediation.
Then resume task51's current comparison verification:
zero full-scope lint,
complete default unit-entry evidence,
branch accounting and designated guard-removal assertions,
then current-artifact native qualification and retained exact-ID cleanup.
The implemented comparison owner must not be replaced with a second Task47 implementation.
After task51 completes,
implement task52's native root/phase materializers against the actual request and receipt shapes,
then task53's current-attempt acquisition journal.
Preserve the frozen parent selection,
current provider order,
independent identities,
quorum policy and no-nudge block-pairing envelope.
Keep source authority and final writer-unit review separate from correspondence acquisition.
