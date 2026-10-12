# Writer calibration unit scope, part 01

Part 01 of [Writer calibration unit scope](translation-repair-writer-unit-scope-2026-09-11.md),
whose index lists every part in order.

## Evidence that changes the launch decision

The existing deterministic forty-row sample was read completely.
It contains 4290 source characters and 11946 incumbent characters,
with no empty side.
Heading-only and media-only tasks are not automatically invalid,
and an imperfect incumbent is not mislabeled gold in the producer instrument.

However,
`windward0032#14` pairs only the ten-character Chinese heading
with an English heading and three body paragraphs,
849 characters in total.
Its corresponding body source is in sibling `#15`,
whose incumbent contains only the final English tail.

The actual frozen validator establishes the consequence:

```text
The PAGE AS IT STANDS is 4 blocks (heading (level 2), paragraph, paragraph, paragraph)
and your translation is 1 (heading (level 2)).
Every block of the PAGE AS IT STANDS has to appear in your translation,
of the same kind and in the same order.
```

A heading-only candidate is refused,
while the complete incumbent passes.
The `lintong#0` heading-to-heading positive control passes.
Evidence is `v41-writer-heading-floor-20260911.out`
and the owned workspace's `heading-floor-check.json`.
This is the production archive floor functioning as designed against an incorrectly scoped benchmark unit.

An initial review had conditionally recommended preserving the forty rows because all writers see the same input.
The concrete floor test disproved the necessary premise:
the instrument forces preservation of body content whose source is outside the supplied task.
The independent reviewer withdrew that recommendation after seeing this probe.
Equal inputs do not establish validity of the task being ranked.

## Declared-original eligibility before pool freezing

The initial unapproved normalized pool also needed the existing source-authority admission boundary.
A provider-free review of its frozen input texts identified
`gqt/source-section/6/target-section/6` as part of a whole-page English original.
Both raw and normalized archive readings return `whole-page`.
`package/module/translation-repair/src/corpus-run/pass-entry.ts:155`
declines such an entry before any purchase.
The initial prototype's selected `hakureico` parent also requires the existing sealed-span treatment.

Apply those production rules before freezing the acquisition population and deterministic draw.
Do not buy correspondence for a production-declined entry,
use protected original-English text as a writing task,
or drop a parent only after acquisition outcomes arrive.
Recompute the eligible population and revalidate the reading journal against its identities and hashes.
This is source-authority eligibility,
not the rejected size/shape filtering.
The eligible empty-layout `ArtsEpiphany` preservation control remains a separate case.

Evidence is `prototype-original-eligibility.json` in the owned writer workspace
and `~/temp/agent/writer-prototype-original-eligibility-20260911.out`.
The probe ran without network in the configured 2 GiB,
2 CPU,
512 PID container.
No paid preparation or writing preceded this finding.

## Policy-eligible population on 2026-09-12

Task 38 is split into independently verifiable work:
task 40 freezes and reads the policy-eligible pool,
task 41 implements current-evidence qualification and journals,
task 42 gates native writer execution on a separately reviewed plan,
and task 43 acquires and reviews the final prepared tasks.
Task 40 has complete reading coverage and a verified frozen parent selection.
Task 41 is the next implementation boundary.
No acquisition or writer launch is approved by the selection manifest.

The provider-free rebuild on frozen `086fd9f6e` reads 93 entry ids.
It excludes the whole-page originals `cheonwoomaeng` and `gqt`
and records `tdor` as missing a corpus side.
The remaining 90 entries yield 272 deterministic parent pairs.
The existing spread draw selects forty parents across thirty entries.
They contain 20467 source and 71446 incumbent characters before production subdivision.
The population digest is
`17bef29954c1db3e0242b28fbdfe77c3c57e6f53e56e7a29003ed7d2cfdfaaab`;
the pool digest is
`235e18fe08d07b39c056e12f134479cdd803756cd4b601c533a289f2fd4404a2`.

Only seven primary parents coincide with the original prototype draw.
The change comes from applying eligibility before the deterministic draw,
not model outcomes.
`ArtsEpiphany` remains eligible in the population but is not selected by this draw;
it was not manually deleted or forced back in.
The population retains its protected-span parent with explicit annotations,
but no selected parent intersects that span.
No shape/size filter was added.

The original eighteen full-entry readings were revalidated against their original hashes and parent membership.
Twelve match entries in the new pool,
and six parent-scope readings carry forward by exact parent and entry hashes.
The journal now covers all thirty selected entries and forty parent scopes.
Changed scopes in carried entries were reread rather than inheriting an unrelated parent review.
The previously truncated `shihai4h` reading was repeated in contiguous bounded requests through its final notes.
An independent review questioned truncation visible in its serialized context,
then withdrew that claim because it could not establish truncation in the original tool responses.
The notes are scope/context observations,
not gold references or automatic correspondence evidence.
The provider-free selection-freeze check rebuilt the complete population from the corpus pin
and validated every reading-file and note binding before producing an exclusive manifest.
`writer-policy-selection-freeze-20260912.out` records exit zero,
with order,
source-coordinate and protection-annotation positive controls.
The check used the no-network 2 GiB,
2 CPU,
512 PID container and created no provider.
`frozen-parent-selection-20260912.json` binds sixty-three files and has digest
`853fd30daef7464865356ac1ffa901de4ba5cb35b4ef80d28cf6a043c36be3be`.
It freezes parent identities and baseline coordinates only.
Current correspondence,
source-channel qualification,
dependencies,
call budgets and the separately reviewed forty writer units remain tasks 41 to 43.

Artifacts in the owned writer workspace:

- `preparation-pool-policy-20260912.json` retains population metadata,
  selected parents,
  exact entry texts and declaration exclusions.
- `preparation-pool-policy-reading-20260912/` holds the full source/target reading files.
- `preparation-policy-reading-journal-20260912.json` binds carried and fresh readings to hashes.
- `reading-Dethelly-20260912.json`,
  `reading-Futajuhuacha-20260912.json`,
  `reading-GLaDOSister-20260912.json` and `reading-MTF_0615-20260912.json` record fresh observations.

`Dethelly` requires out-of-parent footnote context and distinguishes source note 1 from the archive's location note.
`Futajuhuacha` has no selected-parent footnote reference despite differing apparatus elsewhere.
`GLaDOSister` needs work-title/conlang naming evidence without declaring archive spellings official.
`MTF_0615` explicitly discusses name pronunciation in ruby markup
and separately supplies an attributed caring quotation.
These dependencies must be represented in the preparation and final-input plan,
not repaired with uncredited archive prose.
The completed readings also identify:

- `Mio` parent 0's forward-summary coverage/context requirement,
  which remains open for the actual prepared units.
- `hulicaijia` parent 13's shifted definition relations and unmatched archive apparatus.
- `shihai4h` parent 4's added reference apparatus and unrendered localization notes,
  neither invented source correspondence nor automatically verified quotation authority.
- `Chinatsu_Suzuki` parent 6's image/caption groups and archive `Original` disclosure wrapper.
  That label is not an English-original declaration.
- `Xu_Yushu` parent 3's will-image dependency and differing date precision.
- `TianqiChen666` parent 1's institution/character terminology and headpiece metaphor.
  Describing a visual performance does not itself create an image-reading dependency.

These observations do not filter ordinary incumbent defects out of the population.
Any later source-channel finding that changes eligibility invalidates the selection freeze;
abort or explicitly reopen task 40 rather than replacing a failed parent.
Baseline coordinates must not survive a later target rewrite without reparsing and repreparing.

## Current-evidence implementation checkpoint

Task 41 is active.
`b3ad51467` extracts `blockPairingQuestion` and routes `prepareBlockPairing` through it,
so numbering,
definition exemptions and the existing versioned cache key have one implementation.
`0af39bd18` adds exact-key,
changed-text/order,
definition and empty-side controls;
`16f9b6732` corrects their harness-required asynchronous callbacks and retains formatter output.
The first type-aware formatter invocation saw stale built exports and synchronous test callbacks,
not a pairing guard failure.
Fresh build,
types,
zero-warning lint and full-unit verification pass on `16f9b6732` source.
`pairing-question-unit-20260912.out` contains the new question controls at line 362
and the inspected `unit exit 0` at line 9310.
Scoped Markdown lint also passes.
These checks verify shared question construction,
not current-evidence qualification or writer admission.

Question construction alone does not qualify evidence.
`647f713d2` adds the separate `qualifyPreparedBlockPairing` replay check;
`14083dfd7` adds transport-backed tests.
It retallies actual queried outcomes,
requires the configured usable quorum,
recomputes existing media claims and definition separation,
and rejects historical cache or unresolved fallback as current qualification.
Source insertions and target declines retain the existing all-originals-placed condition.
Unendorsed archive gaps retained inside a split rendering also remain unqualified.

Independent review found unchecked preparation-level findings and incomplete fast-path accounting.
`790b26946` shares complete queried handoff findings with production,
rebuilds the final handoff through `finishPreparedBlockPairing`,
and records zero-question structural relations,
source insertions and archive blocks without a source.
`7998ce3db` adds complete-finding,
index,
extra-key and ownership controls.
All returned variants explicitly say `pairing-only`.
This implementation is awaiting complete verification;
it is not verified by the earlier question-construction suite.
The first build passed but TypeScript `TS2322` required an explicit positive questioned-variant branch,
fixed with an unknown-disposition control in `8af49c645`.
The next build and types passed;
formatter findings concerned the test transport's function expression/asynchronous signature
and an insufficient symbol description.
`86997ec10` uses a declared transport returning its already available reply through `Promise.resolve`
and retains the reviewed formatter output.
`qualified-pairing-verification-r3-20260912.out` records passing builds,
types,
formatter and zero-warning lint,
but the full suite failed on fixture assumptions:

- The rotated window asks four of five configured identities;
  `SyntheticModelNotServedError` loses `glm-5.3` before transport,
  leaving three heard replies but only two usable replies.
- One uncorroborated suggestion is removed before agreement findings are generated,
  so it does not make `cacheEligible` false.
  A separate crossed-definition control must exercise an actually dropped endorsed relation.
- An entirely empty document has no aligned parent.
  The empty-side helper contract needs an explicitly supplied empty side,
  not a claim that section alignment produced one.

`dcb478f1c` corrects these fixtures without changing production behavior or thresholds.
`qualified-pairing-verification-focused-20260912.out` records passing rebuild and type checks,
then the qualifier and existing parent-preparation tests through the package's file-filtered `test:unit` task.
The focused test log ends with `unit-focused exit 0` at line 229.
This includes the otherwise-qualifiable uncacheable outcome,
complete media findings,
all supplied empty-side accounting and unchanged cold/warm production preparation.
The fresh full run `qualified-pairing-verification-r4-20260912.out` passes every phase on `dcb478f1c` source:
build,
types,
formatter,
rebuild,
types,
zero-warning lint,
full unit and Markdown lint.
`qualified-pairing-unit-r4-20260912.out` ends with the inspected `unit exit 0` at line 9478.
Independent re-review found no concrete remaining pairing-only defect,
but requested one composed relabel/reprepare qualification test before guard-removal proof.
`c62c6b37c` adds the composed lifecycle test:
actual acquired definition relations drive relabeling and repreparation,
old evidence fails against changed current text,
and newly acquired evidence qualifies with current labels,
nodes,
ranges,
line flags and stage inputs.
Both direct relabel and initially unqualified crossed-definition cases pass,
alongside the actual pass/cache lifecycle test.
`qualified-pairing-unit-footnote-footnote-20260912.out` records `unit-footnote exit 0` at line 75;
its build and types also pass.
The subsequent full run `qualified-pairing-verification-r5-20260912.out` passes all phases,
including the inspected full-suite `unit exit 0` at line 9508.
`c95318ebe` additionally guards ownership of the zero-question result.
The owning journal is not complete.

Removal proof completed in the owned disposable worktree
`~/temp/agent/translation-repair-qualified-guard-20260912`,
created from the main worktree at `519e87092` to avoid copying ignored state.
Its only source overlay is the committed `c95318ebe` boundary test,
bound in `.guard-sandbox/test-overlay.json`.
The dependency preparation records thirty-two links and an absent credential file.
`worker.mts` and `mutations.mts` live under that worktree's `.guard-sandbox/`;
the launcher is `~/temp/agent/run-qualified-guard-container-20260912.mts`.
The no-network mutation run verified the 2 GiB,
2 CPU,
512 PID limits.
All twenty-two registered changes built successfully and failed their designated normal `AssertionError`.
Source hashes were restored and the rebuilt restored tests passed.
Peak memory was 667873280 bytes,
with no OOM or PID-limit events.
The target-key case changes refusal from `question` to `result`;
complete handoff validation still refuses stale evidence.
That case proves diagnostic binding,
not that stale evidence would otherwise be accepted.

Proof is retained in `~/temp/agent/qualified-guard-proof-20260912`,
with sixty-six copied records,
script files and logs,
plus the cleanup audit and test-overlay patch.
The audit rechecks source hashes,
permits only the committed test overlay and owned generated paths,
and finds no root Git sentinels.
The owned worktree was removed through `git worktree remove --force` from the main worktree.
`removal.json` verifies both filesystem and worktree-registration absence.
The retained proof and unrelated worktrees remain untouched.
Continue the owning journal's exact document,
roster,
attempt and source-channel bindings;
this pairing-only milestone does not complete task 41.
No paid preparation or writing was involved.
These harness and lint failures are not semantic guard-detection evidence.

The owning journal must bind the exact acquired roster,
full documents,
parser data,
containers and attempt identity before accepting this replay check.
Initial crossed-footnote evidence can remain recorded but unqualified while relabeling and repreparation occur;
only a final recipe must pass complete target accounting.
Source-channel manifests,
current full-document/range binding,
persisted recipes and native reviewed-input execution remain unimplemented.

## Owning journal design

This design remains unimplemented.
It separates an immutable current-attempt question receipt from each freshly reconstructed occurrence binding.
The historical block-cache key cannot serve as either complete identity.

### Question receipts

Bind the acquisition plan and exclusive attempt namespace,
registered slot or alias class,
terminal state,
frozen protocol/runtime identity,
exact numbered texts,
messages,
response schema,
configured roster and per-model request parameters.
Retain actual asked identities,
provider-specific request bodies,
raw final outcomes,
route/HTTP-attempt lineage and usage evidence.
A different route never creates another model identity.
Partial receipts and receipts from older attempts cannot be reused.

Full-document hashes,
parent indexes,
node IDs,
offsets and containers do not belong in payload equivalence when they were not sent to the model.
An unrelated footnote rewrite can change those values while leaving the exact question unchanged.
Reuse only an explicitly registered same-attempt receipt or alias,
not a content-addressed search across historical runs.
Reused evidence must be identified as reuse,
not logged as a fresh model call.

### Occurrence bindings

Reparse complete current source and target documents for every binding.
Bind corpus paths/revision,
initial archive and normalized hashes,
allowed deterministic rewrite lineage,
current nodes/containers,
parent identity/ranges and fresh definition-order exemptions.
Replay raw outcomes under current interpretation and reconstruct complete production handoff/findings.
Never carry forward the previous aggregate,
qualification,
ranges or map merely because a payload matches.
The final writer plan must also bind globally reindexed children,
line flags,
context and each exact `translateSliceInput` surface.

### Conditional phases and dependency authority

Exact post-relabel bodies are unknown until initial evidence determines the deterministic label map.
Register bounded conditional slots in the initial manifest,
then materialize exact post-relabel requests,
persist and exit,
review that phase,
and recreate providers only after its gate.
An unchanged question reuses its registered receipt rather than purchasing another payload.
No failure may add a slot,
substitute a parent or enlarge output scope.

Definition-only dependencies require the configured usable quorum,
independently endorsed current definition endpoints,
a preregistered relation domain and complete operational namespace accounting.
They need not qualify unrelated body scope in the same dependency parent.
Their authority ends at the existing deterministic footnote operation:
no body pairing,
media claim,
target decline or archive prose follows from a definition-only receipt.
Any dependency parent selected as a writer unit separately needs full qualification.
Dependency closure never changes the frozen writer-parent pool or sampler population.
A dependency discovered outside the registered closure aborts that phase.

Tests must distinguish same-payload/new-occurrence reuse,
changed-question refusal,
changed interpretation,
foreign/partial receipts,
roster/schema/cap/body drift,
definition-only authority and final child-index/projection rebuilding.
`4db2bcade` begins implementation by sharing the actual block-pairing protocol payload.
`blockPairingProtocol` now constructs the messages and an owned copy of the unchanged response schema;
`pairBlocksWithRoster` consumes that same operation.
`33e183a51` adds exact-contract,
fence/numbering,
schema-ownership and actual-client/HTTP controls.
`pairing-protocol-verification-20260912.out` records passing build,
types and focused consumer tests.
Its formatter stopped on the test observer's `no-nullish-union` finding.
The observer now records optional schema presence with an optional property and conditional spread,
without changing the production protocol.
`pairing-protocol-verification-r2-20260912.out` passes build,
types,
focused tests,
formatter,
rebuild,
types,
zero-warning lint,
full unit and Markdown lint.
The inspected full-suite terminal is `unit exit 0` at line 9512 of `pairing-protocol-unit-r2-20260912.out`.
This is only a protocol-construction seam,
not a receipt,
attempt journal or final occurrence binding.

### Receipt data and fresh occurrence implementation

`345d7f7d4` defines a versioned terminal receipt data envelope and fixed receipt diagnostics.
`52fdd006b` adds `readPreparationReceipt` and `readPreparationOccurrence`.
These compare unknown receipt data against independently supplied plan/configuration and current document expectations.
They retain only raw final seat outcomes,
reparse complete documents,
select the registered parent and replay current definition exemptions,
media ownership,
ordered findings and native preparation handoffs.
Returned `scope: 'receipt-bound-occurrence'` is not pairing qualification or writer admission.

Independent review identified missing explicit section correspondence and discarded alignment findings.
The native pre-block constructor is already `alignDocumentSections`;
`d786cd757` forwards its optional `sectionPairing` from the independent occurrence expectation
and retains its findings separately from block-round findings.
Sealing and final slicing options do not enter the native pre-block constructor;
final child construction remains separate.
That commit adds actual-stage/injected-HTTP parity,
receipt refusal,
source/target/parent binding,
ownership and actual footnote-transition reuse tests.

The first verification rebuilt successfully,
then TypeScript reported missing logger arguments at `assertPairingSeats` calls.
The receipt reader now requires and forwards the caller logger.
`preparation-receipt-verification-r2-20260912.out` passes build,
types and focused tests,
including the actual footnote transition and registered section-alignment controls.
Its formatter stops on destructuring,
shadowing,
statement-layout and fixture `Object.setPrototypeOf` return-type findings.
Those findings are corrected without changing receipt acceptance policy.
`preparation-receipt-verification-r3-20260912.out` passes build,
types,
focused tests,
formatter,
rebuild,
types,
zero-warning lint,
full unit and Markdown lint.
The full-suite terminal was inspected at line 9619 of `preparation-receipt-unit-r3-20260912.out`:
`unit exit 0`.
Independent re-review found no concrete remaining defect within this declared data/reconstruction scope.
Valid-wrong-document removal witnesses,
non-prefix sparse outcomes,
changed alignment interpretation,
later mapped parents and ownership of alignment metadata still need additional controls before isolated guard proof.
`5ae0f9a65` adds those boundary controls.
R4 passes build and types,
but the later-parent fixture fails before acquisition:
its reused fixture tries default section alignment before applying the explicit registered correspondence.
`qualification-transport.test-fixture.ts` now owns the shared mock client independently of parent selection;
the receipt fixture applies the intended native alignment directly.
This is a fixture correction,
not evidence of a production receipt defect.

After the owner ran `mise upgrade` in the worktree and restarted the terminal/session,
the agent's own Bash probe resolves `/home/user/.local/share/mise/installs/node/26.8.2/bin/node`
and returns `v26.8.2`.
The R5 runner's `/proc` executable link confirms Node 26.8.2.
R5 passes build,
types,
focused tests,
formatter,
rebuild,
types,
lint and full unit tests,
then stops on Markdown semantic wrapping.
R3 remains recorded under Node 26.7.0.

Guard-proof preparation identified test-evidence gaps rather than new production defects.
The receipt ownership test compared against the same potentially mutated receipt;
it now captures an independent pre-mutation snapshot in a local fixture.
Occurrence ownership tests likewise assert the input expectation is unchanged before attempting another read.
The caption-gap parity case did not exercise deterministic media ownership:
`claimMediaAdjacentTargets` requires a complete `details` run.
Its label is corrected and an actual transcript-container control now requires the added relations and findings.
R6 passes all verification phases under Node 26.8.2.
The actual full-suite `unit exit 0` was inspected at line 9661 of `preparation-receipt-unit-r6-20260912.out`.
The verified source boundary is `eb4223366`.
`cd2ac051a` adds a direct successful-call assertion before the explicit section-correspondence replay,
so removing that forwarding produces an ordinary assertion failure instead of an uncaught domain exception.
Its manual type check passes.

The owned guard worktree is `translation-repair-receipt-guard-20260912`,
created from the main worktree at `eb4223366`.
It carries only the committed `cd2ac051a` test overlay,
with base and overlay hashes recorded in `.guard-sandbox/test-overlay.json`.
The attempted detached switch was refused because the temporary repository's CLI configuration was untrusted;
no trust override or native write bypass was used.
The existing base plus explicit committed test overlay remains the recorded experiment.

`prepare-receipt-guard-20260912.mts` creates owned dependency links and outputs.
The launcher fixes no network,
2 GiB memory,
2 CPUs and 512 PIDs,
with read-only source mounts and owned writable worktree/log paths.
Known source-root `.env.local.json` files are masked with an owned empty JSON file;
the worker verifies those masks and absence of injected API credentials before running tools or tests.
The first tools probe selected retained Node 26.7.0;
`receipt-guard-tools-r2-20260912.out` verifies the explicit Node 26.8.2 launcher,
Mise 2026.9.5,
Git 2.52.0 and ripgrep 15.2.0 inside the bounded container.
That probe covers the launcher,
not the Node processes selected inside Mise tasks.
The retained receipt failure traces report Node `26.7.0`;
the successful guard detections must be attributed to that runtime rather than `26.8.2`.
`receipt-guard-mutations-20260912.out` records the completed baseline/mutation/restoration run.
All 22 registered mutations rebuild successfully,
fail their designated ordinary `AssertionError` and leave source hashes restored.
The restored build and receipt suite pass.
Peak container memory is 723116032 bytes;
no OOM or PID-limit event occurred.
Source and target hash removals each accept a valid wrong document with the unchanged local question,
so those failures demonstrate the full-document boundary rather than a later diagnostic difference.
Removing section correspondence instead wrongly refuses a valid input;
that case demonstrates required forwarding,
not unsafe acceptance.

`receipt-guard-proof-20260912` retains 72 hash-checked records/scripts/logs,
plus the subsequent cleanup audit,
test overlay patch and removal records.
The audit found only the committed test overlay and owned generated paths,
with no root Git sentinels.
Git removed the owned worktree from the main worktree.
`removal.json` verifies its directory and registration are absent at `2026-09-12T17:42:22.550Z`.
This completes the receipt-data/current-occurrence boundary proof,
not task 41's exclusive journal,
transport/configuration provenance,
source-channel/dependency closure or later native execution gate.
This data reader does not independently establish an exclusive attempt directory,
provider transmission,
actual configuration derivation,
allowed target lineage,
source channels or dependency authority.
Those owning-journal obligations remain open.

### Native request materialization in progress

`301aec38a` and `4dca79bbb` introduce non-serving native request capture.
`captureBlockPairingRequests` constructs the shared block protocol,
then invokes the existing provider clients individually with capture-only credentials,
a mandatory stopping transport and a Bedrock accounting adapter that refuses every operation.
It records header-free body/endpoint/label/stream projections in configured model and provider order.
It does not execute the production router or seating operation.
The emitted self-digest is not independent configuration or provenance evidence.
The conservative POST envelope is initial gather plus `STAGE_RETRY_ROUNDS`,
permitted text routes and existing HTTP retries,
without a recovery nudge.

`188e052c5` tests native bodies,
current measured caps,
source escaping,
input ownership,
timeout/roster identity and refusal of structural dispatch.
Initial build,
types and focused tests pass;
formatter findings concern statement layout and sequential awaits in tests.
Independent review identified the need to honor provider-derived exchange cancellation,
keep the internal capture stop out of public failures,
wrap invalid native JSON and narrow the request/provenance descriptions.
Those changes include injected-adapter tests for request shape,
provider-derived aborts,
no-capture/multiple-capture flows,
unexpected errors and native Bedrock accounting refusal.
R2 passes build and types,
then its array-root request fixture demonstrates a validation gap:
`json-guard.ts` deliberately admits arrays for property probing.
The capture operation now rejects arrays explicitly before inspecting object controls.
This does not alter the already verified receipt reader's separate exact-key/prototype checks.

`preparation-request-bounds.unit.test.ts` and its routing fixture now drive native providers through
`promptUniqueClient` and `createRoutingClient` into the real `prepareBlockPairing` caller.
Separate controls exercise lost-stage rounds with native HTTP retries,
and payment-refusal fallback across each configured route.
They compare observed bodies with captured projections and check the recorded envelopes,
without adding a nudge or treating routes as independent votes.
R3 rebuilds successfully,
then TypeScript reports that `ChatMessage` is not exported by the built entry point.
The routing fixture now uses the exported `ChatTextRequest['messages']` type.
R4 passes build and types.
The native transient-round/HTTP control and the other fallback cases pass,
but Qwen's final route selects Anthropic stream grammar while the fixture emits OpenAI frames.
The client correctly reports `MalformedCompletionError` with `anthropic stream ended without message_stop`;
the fixture then observes retry calls instead of its expected completed stage.
The fixture now emits the grammar declared by the actual native exchange,
and compares complete header-free projections including stream metadata.
R5 passes build,
types and all focused interception/caller controls.
Its formatter findings are fixture function placement and the private stop class's required `Error` suffix.
Those are corrected without changing native payloads or the capture contract.
The non-serving positive control now asserts successful materialization through `Promise.allSettled`,
so a removed transport binding can produce a designated assertion rather than an uncaught network/capture exception.
R6 passes all verification phases under Node 26.8.2.
The actual full-suite `unit exit 0` was inspected at line 9735 of
`preparation-request-capture-unit-r6-20260912.out`.
Independent review found no remaining capture-adapter defect,
but requested stronger verification:
compare production capture against independently constructed native clients,
exercise every provider's HTTP retry ceiling,
and separate timeout-only from roster-order-only digest changes.
`preparation-native-clients.test-fixture.ts` now constructs every provider through its corresponding
native factory,
not the production capture factory being checked.
The native lost-round/HTTP test is parameterized across Synthetic,
Hyper,
Bedrock and OpenRouter.
Timeout-only and roster-order-only digest controls are separate.
R7 passes all verification phases under Node 26.8.2.
The actual full-suite `unit exit 0` was inspected at line 9833 of
`preparation-request-capture-unit-r7-20260912.out`.
The independent native-constructor,
per-provider retry,
route-fallback and separate digest-sensitivity controls pass.
Isolated removal checks remain before closing the request-materialization proof.
The owned request-capture guard worktree is `translation-repair-request-guard-20260912`,
created from the main worktree at `b19e50a16` with no test overlay.
`prepare-request-guard-20260912.mts` reuses the bounded,
no-network launcher and masks known source-root credential files.
The worker requires Node 26.8.2,
2 GiB memory,
2 CPUs and 512 PIDs before running any check.
This did not constrain Node selected by nested Mise tasks:
the retained request failure traces report Node `26.7.0`.
The completed mutation detections are evidence on that runtime,
not proof that every command used the worker's `26.8.2`.
`request-guard-mutations-20260912.mts` registers request/ledger/transport,
input ownership,
projection,
error identity and native-bound controls.
The mandatory-transport mutation runs only inside that no-network container with dummy client keys.
All 22 registered request-capture mutations rebuild successfully and fail their designated ordinary assertion.
Restored source hashes,
build and tests pass.
Peak memory is 851001344 bytes;
no OOM or PID-limit event occurred.
Every assertion was read in `request-guard-proof-20260912/assertion-reading.jsonl`.
The mandatory-transport case is counted by its ordinary assertion,
not the subsequent no-network `getaddrinfo EAI_AGAIN` failures in other cases.
No outside transmission or paid model response occurred.

`request-guard-proof-20260912` retains 69 hash-checked records/scripts/logs,
plus assertion-reading,
audit and removal records.
The cleanup audit finds no tracked changes,
only owned generated paths and no root Git sentinels.
Git removes only that owned worktree.
`removal.json` verifies directory and registration absence at `2026-09-12T19:28:05.972Z`.
This completes the non-serving request-materialization proof;
it does not complete the exclusive acquisition journal or authorize paid preparation.

The request-capture test's fetch probe needs explicit isolation.
This worktree resolves `@monochromatic-dev/module-test/ts` to its own `package/module/test/src/index.ts`;
`package/module/test/src/sinon.ts` uses ordinary process-global Sinon.
`mise.toml`'s `runTestFiles` launches each test file in a separate Node process.
The capture file now sets `concurrency: 1` around the process-global positive-control stub and its readers.
The newer main-worktree skill's per-attempt method isolation does not describe this older resolved implementation.

### Measuring the owning journal's dependency closure

An independent design review proposed initial and post-footnote phases.
That phase count is not adopted before measuring whether the selected entries trigger native section pairing
or contain definition dependencies outside their selected parents.
The measured caller must determine the finite slot closure.
Model-plus-canonical-prompt uniqueness also applies across slots:
per-slot client caches must not become a way to buy the same model payload again.
Authorized aliases must be established by the root plan,
not inferred silently from a shared cache.

`preparation-dependency-census-20260912.mts` will re-read the pinned selected corpus entries,
verify the frozen selection and its referenced file hashes,
compare current selected-parent coordinates with the baseline,
intercept the actual `buySectionPairing` dispatch and inventory definition/media dependencies.
The section probe has an explicit required-question positive control and an equal-shape negative control.
It obtains no model response and grants no correspondence or final-unit admission.
The census runs with no network,
2 GiB memory,
2 CPUs and 512 PIDs,
read-only source/corpus/selection mounts and owned writable outputs.

Its current runtime is frozen at `node_modules/.frozen-dist-preparation-census-20260912` inside the package,
with digest `sha256-tree-v1:f7afc15c1b5cd1becb186fe3af1fad234caef1dd3963cb881bdbd432dc1f5f2a`.
`preparation-census-runtime-20260912.json` records the exact runtime and Node 26.8.2.
The first scratch freeze attempted an exclusive directory copy into its newly created destination and failed;
the inspected empty owned directory was then filled with exclusive per-file copies and both tree digests matched.
The first census validates the frozen references and section-dispatch controls,
then stops because its scratch code called the unexported `activeFootnoteMarkers` helper.
The probe now uses the existing public `documentLabels` and `referenceLabels` projections.
This is a probe-interface correction,
not an eligibility finding or a reason to reopen the frozen parent selection.
R2 completes the census.
R3 adds complete protection-state comparisons and a duplicate-question positive control.
`preparation-dependency-census-r3-20260912.out` and
`preparation-dependency-census-61BEKU/report.json` record the completed measurement:

- All 63 frozen reference files verify.
- All 40 selected parents retain their frozen source/target coordinates,
  node identities,
  hashes and protection state under the current runtime.
- Selected dispatch is 37 queried parents and 3 implicit parents,
  with no empty side.
  The implicit parents are `gaoyanger#0`,
  `xuewulihuameng#0` and `zheermao101#0`.
- The aligned definition inventory adds `Dethelly#5`,
  `Futajuhuacha#2`,
  `NIGHT81473140#9`,
  `Y1Ran#3` and `aiyysk#13`.
  The union has 45 parents,
  including 42 queried parents.
- No exact-question alias group is found;
  the synthetic duplicate-question positive control proves the grouping probe detects one.
- Native whole-entry section pairing triggers only for `XingZ60`:
  15 source sections and 13 target sections.
  Source sections 12 through 14 and target section 12 remain outside deterministic correspondence.
- Xing's source definition nodes `block/236` through `block/244` are unaligned.
  Its target has references but no definition nodes.
  This is deterministic source/namespace context,
  not source-to-target definition endorsement.
- Selected source-picture references occur in the 10 parent IDs listed by the report.
  This is dependency inventory,
  not image reading or corroboration.
- Fetch and provider request counts are zero.
  Peak container memory is 159240192 bytes,
  with no OOM or PID-limit event.

The whole-entry section trigger is not automatic authorization for a new paid phase.
`prepareBlockPairing` accepts an already reconstructed parent;
the frozen-parent design need not inherit every operation of the whole-entry shell.
Conversely,
a nonempty explicit section pairing replaces the default correspondence and can remove a frozen selected pair.
A provider-free consumer/control check is next before fixing journal layout.
It must distinguish unchanged parent selection from newly reconstructed final children:
task 40 did not freeze final writer units,
and an authorized label rewrite must not be required to preserve stale child hashes or coordinates.

`frozen-parent-consumer-control-20260912.out` completes that mechanical control under the same bounded runtime.
`frozen-parent-consumer-c8Htkl/report.json` records:

- Xing parents 6,
  1 and 9 retain their registered source/target scopes without a section override.
- No source-to-target definition relation is invented from the nine source definitions and absent target definitions.
  The definition-only empty relation input produces no label rewrite.
- Native default grouping and `translateSliceInput` stay inside the selected parent node sets,
  with current indexes and hashes.
  These default groups are mechanism evidence,
  not qualified writer units or their future frozen identities.
- The independently valid partial section relation `source 12 → target 12` changes all three selected parent scopes.
  The scope checker requires abort/reopening,
  never substitution.
- Fetch and provider request counts are zero.
  Peak memory is 128495616 bytes.

The journal will retain the approved per-parent seam rather than purchase the broader whole-entry section operation.
Its initial closure is the measured 45 parents,
with 42 queried inputs and 3 structural records.
Xing's unmatched source definitions receive explicit source/namespace accounting only;
that record is neither correspondence nor automatic prompt context.
Future reference-based relabeling still requires qualified current group evidence
and freshly materialized conditional inputs.
The namespace initializer is now implemented in `create-preparation-attempt.ts`,
with fixed-file native I/O in `preparation-attempt-storage.ts` and
`PreparationAttemptError` diagnostics.
It creates a fresh private directory,
writes and file-content-syncs exact `root-plan.json` bytes,
then generates and writes the matching `attempt.json` identity marker.
It never opens or resumes a prior attempt and retains incomplete files on failure.
The storage adapter accepts only the two fixed filenames;
it is not a generic journal record-store interface.
