# Writer calibration unit scope, part 02

Part 02 of [Writer calibration unit scope](translation-repair-writer-unit-scope-2026-09-11.md),
whose index lists every part in order.

## Owning journal design, continued

### Measuring the owning journal's dependency closure, continued

Initial build,
types and focused tests pass.
Formatter findings are named permission constants and a missing handle comment.
Independent review identified input-bearing `SyntaxError` causes,
uncontextualized UUID failure,
circular digest checking and missing completion/failure controls.
The syntax diagnostic now retains only the parser class name,
identity generation is inside the contextualized post-plan operation,
and tests independently hash stored bytes,
retain partial marker failures,
hold write-completion gates and observe native file sync.
The initializer promises file-content sync only,
not containing-directory power-loss durability.
R2 passes every verification phase under Node 26.8.2.
The actual full-suite `unit exit 0` was inspected at line 9840 of
`preparation-attempt-unit-r2-20260912.out`.
The tests include separately held root/identity writes,
native file-sync invocation and completion,
independent SHA-256 of stored bytes,
private rendered syntax failures and retained partial identity bytes.
The native `chmod` is additional permission enforcement;
these tests establish final private modes,
not that removing a redundant chmod alone would change them.
Namespace guard proof remains pending;
no reviewed-phase or crash-durability authority follows from this initializer.
A follow-up moves plan hashing before directory allocation,
and makes concurrent-allocation and retained-directory witnesses fail through ordinary assertions.
R3 passes every phase;
`unit exit 0` was inspected at line 9841 of `preparation-attempt-unit-r3-20260912.out`.
The next namespace operation will verify independently supplied attempt identity and exact root-plan bytes
without treating a marker's own values as expectations.
`verifyPreparationAttempt` now performs that identity/integrity check,
with streaming raw-byte hashing in `preparation-attempt-read-file.ts`.
It checks private directory/file identities,
rejects symlink files and final-directory indirection,
limits each stream to its observed file extent and verifies descriptor/path metadata afterward.
The identity marker's expected size is checked before content reading.
No stored marker values are adopted as expectations,
and no plan JSON is parsed or emitted by the verifier.
It grants neither semantic plan approval nor acquisition authority.
Tests cover real namespaces,
same-length wrong expectations,
missing/changed/partial files,
identical-content symlinks,
private modes,
non-files,
whole-plan multi-chunk hashing and caller expectation snapshots.
R4 passes all verification phases;
`unit exit 0` was inspected at line 9869 of `preparation-attempt-unit-r4-20260912.out`.
Independent review identified unchecked metadata extents,
lossy numeric filesystem identities and relative-path drift across awaits.
Creation now records exact UTF-8 `rootPlanBytes` and returns an absolute namespace path.
Verification validates canonical UUID/digest metadata,
checks the independently supplied byte extent before reading the plan,
and uses BigInt inode/device/size and nanosecond timestamp observations.
This binds total work to the measured plan rather than an unmeasured global size ceiling.
It is observed stability,
not a lease against an adversarial concurrent writer or proof of original creation.

Deterministic stream observers now exercise append,
truncate,
same-size mutation and identical-byte pathname replacement during reading.
Controls also cover marker-first refusal,
one-byte-over-extent rejection before a plan stream,
canonical metadata and cwd changes.
R5 passes build,
types and focused tests including the controlled filesystem changes.
Its formatter findings concern explicit UUID constants,
ASCII iteration and a test disposer statement layout.
The identity scanner now uses a bounded code-unit cursor rather than string spreading,
with named UUID segment dimensions.
R6 passes build,
types and focused tests;
its formatter rejected the scanner's function-root cursor.
The cursor now belongs to the counted loop only.
R7 passes all phases on Node `26.8.2`;
`unit exit 0` was inspected at line 9880 of `preparation-attempt-unit-r7-20260912.out`.
The source checkpoint is `926bb930d`.
Follow-up `33d3b20ab` makes the successful cwd control assert the settled result explicitly,
so a removed path boundary produces an ordinary assertion rather than an uncaught filesystem error.
No semantic phase plan,
lease or paid acquisition authority is introduced by this checkpoint.

The combined removal proof exposed test gaps rather than production changes.
Its first raw-parser-cause mutation survived:
Node `26.8.2` rendered only `private-fi` from the long canary,
so absence of the complete input was not a privacy witness.
`b0824a634` adds a native short-input exposure control and a sanitized-boundary assertion.
The isolated second run detects that removal.
Source trace,
probe catalogs and the discarded filename-collision probe are recorded in
[Node JSON diagnostic privacy canaries](../troubleshooting/node-json-error-privacy-canary.md).

The second proof run also shows that the existing sync-await test can pass with the explicit await removed.
A `returned` flag sampled after one `setImmediate` does not establish that disposal has not already started.
The revised test observes the actual handle's asynchronous disposal boundary,
first proves the observer detects a disposable handle,
and requires no disposal before releasing the controlled sync promise.
R9 passes build,
types,
focused tests,
formatter,
lint and the full suite;
`unit exit 0` was inspected at line 9886 of `preparation-attempt-unit-r9-20260912.out`.
Only Markdown wrapping required correction.
The third isolated run uses base `33d3b20ab` plus the explicitly hashed committed test overlays from `a7dcdc526`;
it stops on the symbol-spy diagnostic formatting failure,
not a counted guard detection.

The first namespace container launch selected Node `26.7.0` and correctly failed its runtime assertion.
An explicit Node `26.8.2` launcher passed the same tool/cgroup/credential-mask checks.
R3 nevertheless shows Node `26.7.0` in the actual failing Mise task children.
This distinction was already recorded for the pairing identity proof;
newer harnesses incorrectly relied on the worker-only check.
The qualification,
receipt and request proof logs also show `26.7.0`.
Those old records remain unchanged as evidence of their actual runtime.

R4 pins `MISE_NODE_VERSION=26.8.2` for the experiment
and supplies a `NODE_OPTIONS` preload to inherited Node environments.
The preload records version,
executable,
entry file and phase,
and refuses another version.
The worker requires a matching observation for every designated test file.
A native Mise control succeeds on `26.8.2` and refuses `26.7.0` with the expected runtime diagnostic.
The source trace and verified override are recorded in
[Node command contexts](../troubleshooting/node-lookup-in-agent-command-context.md).
No lockfile or installed runtime was modified.

R3 also exposed Sinon diagnostic formatting rather than an ordinary failed assertion:
`Cannot convert a Symbol value to a string` arose when the symbol-named disposal spy's matcher failed.
`b197a67f9` compares its primitive `callCount` instead.
R10 passes every source and Markdown phase;
`unit exit 0` was inspected at line 9885 of `preparation-attempt-unit-r10-20260912.out`.
Its per-child runtime ledger is `preparation-attempt-runtime-r10-20260912.jsonl`.
R4 reached the intended ordinary assertions for 25 removals,
but its relative-path witness still passed after removing the pin.
The former relative path resolved to the same namespace from both working directories.
`2d62d0c61` constructs independently owned cwd locations at different depths
and explicitly proves that resolving the supplied relative path from the changed cwd gives a different location.
It also tests a self-consistent malformed UUID marker and matching expectation,
not only the early diagnostic for malformed input.

Independent review prompted fresh exclusive runtime ledgers and a per-invocation identity,
with each designated file's runtime observations retained in the final report.
The successful and deliberately older Mise runtime controls are themselves checked against their ledger rows.
Coverage is the observed task shells and every designated test-entry process,
not hypothetical descendants that clear the preload environment.

R11 passes all verification phases;
`unit exit 0` was inspected at line 9884 of `preparation-attempt-unit-r11-20260912.out`.
Its runtime ledger is `preparation-attempt-runtime-r11-20260912.jsonl`,
run identity `6d7c04be-110f-43fd-a078-9b2a6657fa14`.
R5's complete isolated proof passes all 26 registered successful mutant builds
and designated ordinary assertions,
then restores source hashes,
rebuilds and passes the namespace suite.
Every designated test entry and observed task shell is verified on Node `26.8.2`.
Peak memory is 794329088 bytes,
with no OOM or PID-limit event.

`namespace-guard-proof-20260912` retains 261 hash-checked files,
including failed revisions,
committed test overlays,
per-invocation runtime records and the final assertions,
plus cleanup audit and removal evidence.
The audit found only owned generated paths and the committed test overlays,
with no root Git sentinels.
Directory and registration absence are verified at `2026-09-12T23:39:16.154Z`.
The fixed namespace reader/initializer boundary is verified;
task 41's semantic phase plans,
leases,
source authority and acquisition journal remain unfinished.
Combined file-indirection and post-read metadata removals prove their joint boundaries,
not necessity of every redundant mechanism separately.

The harness-diagnostic follow-up is complete:
[called symbol-spy diagnostics](../troubleshooting/sinon-called-symbol-spy-diagnostics.md)
records the source path,
consumer workaround,
bounded disposable prototype and local additive-comment draft.
No upstream communication or installed dependency edit occurred.

The next owning-journal seam is definition-only evidence qualification.
`cac56abfb` extracts `replayPreparedBlockEvidence` from `qualifyQueriedBlockPairing`:
current question identity,
native raw-outcome replay,
aggregate comparison and configured usable quorum are shared,
while full-parent placement and coverage checks remain in their existing consumer.
The helper returns a transient replay view;
the final qualifier still owns its returned data.
`preparation-evidence-replay-verification-20260912.out` passes every phase.
The inspected full-suite terminal is `unit exit 0` at line 9886 of `preparation-evidence-replay-unit-20260912.out`.
The driver records Node `26.8.2` task shells and designated test entries in a fresh nonce-bound runtime ledger.

The definition-only consumer must require the independently registered current definition domain,
project only independently endorsed definition endpoints,
and return no body placement,
media widening,
target-decline or archive-prose authority.
Zero-question dispatch remains structural accounting rather than manufactured votes.
A parent selected for writing still requires the existing full qualification separately.
`readPreparationDefinitionRelations` now implements that projection with an exact current domain,
shared native replay and owned definition endpoints.
Its result says `qualification: 'pairing-only'` and `scope: 'footnote-definitions'`.
An empty relation list means no endorsed definition correspondence,
not an inferred equal-spelling identity or a qualified whole parent.
It does not itself establish receipt/attempt provenance or complete-document transition authority.
The new consumer tests compare it with a full-parent refusal for the same body-unclaimed evidence,
exercise domain changes,
quorum/endorsement differences,
current labels,
structural refusal and output ownership.
The first definition verification passes build and types.
Its mixed-endpoint fixture wrongly expected partial projection:
`pair-blocks-wire.ts:425` already rejects an entire reply containing a definition/body relation.
The corrected test requires unusable evidence and quorum refusal;
production wire policy is unchanged.
The configured-denominator control deliberately includes a model unreachable by its Synthetic-only adapter.
R2 passes build,
types and focused tests;
its formatter rejected array deletion and an untyped reflective return in a synthetic mutation fixture.
Independent review then identified the more consequential boundary:
a public reader accepting a naked parent and ID-only domain could be misbound,
and a caller-supplied accessor could change that parent between replay and endpoint lookup.
The arbitrary-node-table interface and its mutation fixture are superseded.

The public reader now snapshots `PreparationDefinitionRegistration`,
then calls `readPreparationOccurrence` with the registered full-document,
parent,
receipt and request-configuration expectations before any projection.
`projectPreparationDefinitionRelations` is internal and receives only that owned reconstruction.
Returned evidence retains the checked occurrence binding;
no matching local question or node-ID list selects its own parent.
The finisher and occurrence types now express their existing queried paired/fallback result,
rather than also claiming impossible singleton/empty variants.
A body-only empty definition domain is refused;
one-sided inventories can contribute no invented counterpart.

Tests now use actual terminal receipt fixtures,
complete-document alias controls,
receipt-bound relabel/reprepare,
partial/crossing/one-sided definitions,
foreign or partial receipts,
and a receipt accessor that mutates caller registration after the reader snapshots it.
The first independent-review attempt timed out without a review;
its subsequent completed review supplied these ownership concerns.
R3 builds,
but TypeScript reports `TS2339` where the fixture returned a broad prepared union and tests accessed `evidence.outcome`.
The fixture now returns its already narrowed queried evidence explicitly;
no production policy changes for that diagnostic.
R4 passes all phases,
with `unit exit 0` inspected at line 10099 of `preparation-definition-unit-r4-20260912.out`.
Final review nevertheless identified an authority-path problem:
calling the full occurrence reader also executed unrelated body/media and fallback handoff work.
Definition-only output fields did not remove that work's control-flow veto.

`readPreparationEvidenceOccurrence` now owns current document/parent/receipt checks and native raw replay
without media normalization or prepared handoff.
`readPreparationOccurrence` layers its existing full handoff on that internal core.
The public definition reader consumes the core directly.
Expected occurrence data is snapshotted before receipt access.
The model distinguishes `receipt-bound-evidence` from the full `receipt-bound-occurrence` result.

Controls now exercise a deliberately failing real fallback-handoff logger boundary,
with a successful full-reader invocation of the fault proving the instrument works.
The definition reader must not reach that handoff.
An actual transcript/media-claim contrast checks unchanged definition relations
alongside changed full-body normalization.
Parser-backed label controls cover indentation,
escaped closing delimiters/backslashes,
Unicode,
multiline definition bodies and the active label-length boundary.
`definitionLabelsOf` has only empty-array and single-label return branches;
the parser-backed catalog checks actual current endpoint extraction.
An attempted empty-or-singleton tuple annotation was rejected by `no-optional-escape`,
so the existing readonly-array interface is retained rather than suppressing that rule.
Crossing agreement now asserts the exact native retained edge,
and ownership controls mutate the registered electorate actually consumed by the reader.
R5 passes build,
types and focused consumer tests.
Its formatter rejects the empty tuple annotation and sequential independent media fixtures;
those are replaced by the existing array return type and concurrent fixture acquisition.
It also reports `prefer-readonly-parameter-types` for the untouched consolidation callback
and repeated `SemanticBridgeError: Owned effect edge lacks callee summary` messages for `definitionLabelsOf`.
No unrelated source or lint policy is changed on that evidence;
the next run must establish whether the findings remain after the annotation correction.
Successful-call controls now produce ordinary assertions on removed boundaries,
and a full-occurrence receipt-accessor control verifies the core's own expectation snapshot.
R6 passes every phase,
including zero-warning lint and the full suite's `unit exit 0`
at line 10231 of `preparation-definition-unit-r6-20260912.out`.
The consolidation callback and missing-summary diagnostics do not recur;
no consolidation or lint-policy edit was made.
This records the measured after-state,
not an isolated diagnosis of the semantic-index warning's cause.
The native full-handoff fault,
media contrast,
parser-label catalog and actual registered-electorate ownership controls pass.
`a2d8cc470` adds independent current source/target parent-index controls after that source verification.

The owned definition guard worktree is `translation-repair-definition-guard-20260913`,
created from the main worktree at `a2d8cc470` without an overlay.
It uses the namespace proof's fresh run-bound runtime ledgers,
per-test entry checks,
Mise version override and deliberate older-runtime refusal control.
The container has no network,
2 GiB memory,
2 CPUs and 512 PIDs,
read-only source/dependency mounts,
masked known root credential files and owned writable outputs.
`definition-guard-mutations-20260913.mts` registers definition authority,
receipt/current-document binding,
quorum,
endpoint metadata and no-full-handoff-veto controls.
The complete proof passes all 22 registered successful mutant builds and designated ordinary assertions.
Restored source hashes,
build and definition/occurrence tests pass.
Each designated test entry and observed task shell has a matching Node `26.8.2` record under its invocation identity.
All assertion lines were read,
including the restored out-of-scope handoff's explicit invocation counter,
not merely a thrown exception.
Snapshot and definition-filter removals demonstrate wrongful refusal of valid input;
those are not described as unsafe-acceptance results.

`definition-guard-proof-20260913` retains 72 hash-checked files,
plus assertion reading,
cleanup audit and removal evidence.
Peak container memory is 695382016 bytes,
with no OOM or PID-limit event.
The cleanup audit finds no tracked modifications,
only owned generated paths,
and no ignored root Git sentinels.
Directory and registration absence are verified at `2026-09-13T02:17:04.409Z`.
This completes the definition-only receipt/current-occurrence boundary,
not task 41's finite root/phase manifests,
conditional review gates,
acquisition leases,
request lineage or final source-channel/writer admission.

Initial root scope was then rebuilt provider-free against
`node_modules/.frozen-dist-preparation-root-scope-20260913`,
digest `sha256-tree-v1:43e3f6d7d282cd92e1845d969c4beb466625d028fa051a6342653891173e262a`.
`preparation-root-scope-VrOExG/report.json` verifies all 63 frozen file references,
all 40 selected parents across 30 entries,
and the unchanged union of 45 parents with 42 queried and three implicit dispatches.
The nine definition parents still add exactly five dependencies.
The scope registry now carries each current combined/source/target index,
document hashes,
question hash,
roles and definition-node inventory.
The no-network container records zero provider requests and zero fetches;
peak memory is 186380288 bytes with no OOM or PID-limit event.
This is a current scope registry,
not a reviewed phase or acquisition authority.

The next planner boundary is `readRegisteredPreparationParent`.
It shares registered complete-document/hash/parent selection with receipt reconstruction,
but does not require or invent a receipt for initial phase materialization.
`PreparationParentExpectation` excludes receipt binding,
and `RegisteredPreparationParent` explicitly marks mechanical selection only.
Singleton and native insertion-anchor parents can be planned structurally;
`readPreparationEvidenceOccurrence` still refuses to manufacture model receipts for zero-question dispatch.
The new tests cover native selection,
structural parents,
full-document drift,
registered side indexes,
section correspondence and ownership.
`preparation-parent-verification-20260913.out` passes every phase.
The inspected full-suite terminal is `unit exit 0` at line 10314 of `preparation-parent-unit-20260913.out`.
Its fresh runtime ledger records the requested Node `26.8.2` task shells and designated test entries.
Formatter-only changes were reviewed separately.

The correspondence-only root is the next owning boundary.
It must derive the frozen ordered selection and definition closure from independently verified task40 artifact bytes
and complete pinned documents,
not accept caller-supplied nodes as registration proof.
It excludes section,
image,
title and writer calls;
those unresolved source-channel obligations remain visible without call authority.
The root predeclares initial and bounded post-relabel slots.
Exact roster,
timeout,
caps,
routes and retry/no-nudge configuration belong to each independently reviewed phase identity.
Root/phase reconstruction and self-digests remain distinct from review approval.
Unregistered duplicate substantive prompts abort rather than creating another payload.
The first data boundary is verification and typed reading of the frozen selection artifact;
all referenced bytes and semantic roles must subsequently be bound before a root can authorize materialization.
`readFrozenPreparationSelection` now checks the independently expected digest before JSON parsing,
refuses unsupported/promoted formats,
retains the ordered forty-parent identity grammar,
checks reading counts and preserves each unresolved source-context obligation.
It retains all supporting references as unverified locators,
without reading or executing them,
and separates historical sampler/runtime provenance from the future acquisition runtime.
No typed selection result grants root,
phase or writer approval.
The first selection verification passes build,
the actual task40 consumer probe,
types and focused tests.
The consumer confirms the 50399-byte artifact,
40 ordered parents,
63 still-unverified supporting references,
and the retained `Mio#0` open scope obligation.
Its formatter findings concern imported callback arity,
statement layout and destructuring.
Validation-only policy scans now use explicit loops;
remaining transformations use named callbacks and explicit destructuring.
R2 repeats the passing build,
actual consumer,
types and focused tests,
then flags a shadowed context callback parameter.
After its rename,
R3 passes every phase;
`unit exit 0` was inspected at line 10315 of `preparation-selection-unit-r3-20260913.out`.

Independent review clarifies this boundary as a checked partial projection,
not a complete nested-schema,
population or eligibility audit.
Unprojected fields stay bound by the whole-artifact digest and must be interpreted by the later root builder.
The ambiguous reserialized `samplerDigest` is removed;
only the independently expected whole-artifact digest binds the remaining sampler recipe.
A type brand would not establish external approval:
the expected digest remains trusted owner input,
and the native root entrypoint must obtain it from the separately recorded task40 authority.
No ingestion result acts as approval.

Entry IDs now reject whitespace edges and control code units without rewriting frozen spelling.
The real-artifact consumer compares every returned reference locator/hash pair and source-obligation record,
not just their counts.
It still does not read or verify the referenced file bytes.
R4 passes build,
actual-artifact projection comparison,
types and focused tests.
Its formatter requires `codePointAt` instead of `charCodeAt`.
The control-character scan now uses the preferred API with an in-range non-nullish assertion,
and a printable Unicode/astral entry-name control preserves original spelling.
R5 passes every phase,
with `unit exit 0` inspected at line 10327 of `preparation-selection-unit-r5-20260913.out`.
The real artifact projection comparison and printable Unicode control pass.
This verifies the limited selection-identity ingestion boundary,
not referenced bytes or the semantic root.

`readPreparationSelectionEvidence` is the next byte-ownership boundary.
It re-reads raw selection text against the independent digest
rather than accepting a caller-fabricated typed certificate,
requires exactly the frozen supporting inventory,
checks inventory before content access,
copies raw byte arrays before hashing,
and returns matched content and extents in original reference order.
It opens or executes no path and assigns no semantic roles or approval.
Tests cover missing/extra/duplicate/foreign inventory,
invalid UTF-8 bytes,
CRLF changes,
genuine empty artifacts,
Buffer inputs,
detached arrays,
locator snapshots and both ownership directions.
The first supporting-byte build and actual consumer probe pass.
All 63 references match in original order,
covering 3290843 raw bytes,
with `Mio#0` still open and no semantic-role or acquisition approval.
Type checking reports `TS2322` because the fixture callback declared a generic `ArrayBufferLike` view
where its constructed data has an `ArrayBuffer` backing.
The fixture callback and owned-copy result now name that actual backing type;
a shared-input positive control verifies the returned snapshot is non-shared.
R2 passes build,
actual consumer,
types and focused tests.
Its formatter reports array destructuring and unsafe values introduced by `Array.isArray`'s broad narrowing.
Inventory entries are now treated as `unknown`,
checked as non-array records,
and held as unknown-valued descriptors until byte validation;
no type assertion supplies missing content proof.
R3 passes every phase,
with `unit exit 0` inspected at line 10352 of `preparation-supporting-bytes-unit-r3-20260913.out`.
Independent review identified remaining descriptor and evidence-lifetime concerns.
Path,
content,
length and indexed-entry access now pass through a fixed-error boundary that omits input-bearing accessor failures.
Indexed traversal ignores custom array iterators and checks final inventory cardinality.

Matched content is explicitly point-in-time owned data,
not an immutable certificate.
The downstream owner must rehash supplied bytes through the owning boundary;
a mutated-result control demonstrates refusal on revalidation.
Additional controls cover nonzero-offset views,
shared-input/distinct-output buffers,
throwing descriptor/array accessors and custom iteration.
The API requires caller-side size bounds before loading data.
The actual consumer now checks regular-file extents and a 64 MiB probe input envelope before body reads,
reads only those extents,
and checks them again before byte matching.
This is a probe bound,
not a new repository-wide runtime pin or acquisition authority.

A synchronous scoped `git add` timed out while its wrapper logger reported a sink-verification timeout.
Read-only index and process checks found no staged result or surviving add;
retry uses the managed process tool rather than a native write bypass.
R4 passes build,
actual bounded-input consumer,
types and focused tests.
Its formatter rejects a hand-authored primitive throw in the accessor fixture.
The fixture now uses a real aborted signal's caller-supplied primitive reason,
first proving the native operation throws that exact value.
That fixture correction changes neither production exception handling nor lint policy.
The managed retry committed successfully as `cb1dc3bb4`.
R5 passes every phase at `25ab749b6`,
with `unit exit 0` inspected at line 10374 of `preparation-supporting-bytes-unit-r5-20260913.out`.
Its run identity is `41329548-f3df-4a4b-b2fb-de2f0be47c5e`.
Only the owner's `mise.lock` remained dirty after that checkpoint.

Guard preparation exposed a further observation gap,
confirmed by independent review and red regressions at `e359a7d53`.
Byte-view proxies can throw input-bearing errors during prototype or iterator observations;
revoked inventories and descriptors can throw during `Array.isArray`.
R6 rebuild,
consumer and types pass,
then the designated ordinary assertions fail for those cases.
The fix uses a measured native byte-view brand check and narrowly sanitized array-shape observations.
The [Node byte-view observation record](../troubleshooting/node-typed-array-proxy-observations.md)
retains source evidence,
probe catalogs and exact failures.
R7 passes rebuild,
actual bounded consumer,
types and focused tests including every proxy regression.
Its formatter findings concern fixture statement layout and array destructuring;
those are corrected without changing production behavior.

Before the combined guard proof,
positive iterator,
subarray and locator-snapshot controls assert successful return explicitly,
so a wrongful refusal produces a designated ordinary assertion instead of an unrelated uncaught error.
Parent-count,
duplicate and grammar fixtures now keep their other reading/obligation counts consistent;
removing the intended guard cannot hide behind a later incidental mismatch.
An unsafe-integer coordinate is included separately from noncanonical numeric spelling.
R8 passes rebuild,
consumer,
types and focused controls.
Its formatter rejects a test helper's nullish result slot and a direct array-element declaration.
The helper now returns directly from its `try` and asserts unexpected failures in `catch`,
without an absence encoding;
the element declaration uses destructuring.
R9 passes every verification phase at `0d8460433`,
including zero-warning lint over 1484 files and the actual bounded supporting-artifact consumer.
`unit exit 0` was read at line 10383 of `preparation-supporting-bytes-unit-r9-20260913.out`.
The runtime ledger's run identity is `422d0eb0-7fb4-42d5-acb7-fe29b3351054`.
Only the owner's `mise.lock` remains modified outside the documentation update.

The combined identity/supporting-byte guard proof uses a main-created disposable worktree at
`/var/home/user/temp/agent/translation-repair-selection-guard-20260913`,
checkpoint `0d8460433`,
without overlays or copied ignored state.
Its container has no network,
2 GiB RAM,
2 CPUs and 512 PIDs;
source and dependencies are read-only and known root credential files are masked.
Native Mise controls accept Node `26.8.2` and refuse `26.7.0`,
with a fresh nonce-bound runtime ledger.
The mutation run is recorded in `selection-guard-mutations-20260913.out`.
All 37 registered mutations build successfully and fail their designated ordinary `AssertionError` checks.
All assertion lines were read;
restored source hashes,
rebuild and the selection/supporting-byte suite pass.
Peak container memory is 681996288 bytes,
with no OOM or PID-limit event.
Wrongful-refusal and metadata checks are not reported as unsafe acceptance.

The retained proof at `/var/home/user/temp/agent/selection-guard-proof-20260913`
contains 108 hash-checked files,
including source and test copies,
run/phase-bound runtime observations,
plans,
launches and exact failure lines.
Cleanup verifies no tracked changes,
no root Git sentinels and only owned ignored/untracked outputs.
Both directory and registration absence were verified at `2026-09-13T05:41:59.174Z`.
This completes verification of the partial selection-identity and supporting-byte boundaries,
not semantic reference roles,
population eligibility,
correspondence root/phase review,
acquisition leases or writer admission.

The next prototype reconstructs semantic input ownership before implementing the complete root owner.
It uses the verified byte matcher,
then checks pool/journal/prior-reading bindings,
full reading frames,
notes and opaque historical-source references against the frozen producer's actual construction.
Historical source files are bound but never executed.
It rebuilds the eligible population from pinned raw corpus bytes,
checks native raw-to-effective text parity,
and retains archive normalization origins.
The forty parents are looked up by their frozen identities;
`pickSpreadSample` is not invoked and no parent is redrawn.
The prototype does not yet establish complete execution-dependency provenance or produce a reviewable acquisition root.

Its frozen runtime is `.frozen-dist-preparation-root-semantic-20260913`,
digest `sha256-tree-v1:58ad2c4de75b90c8ddb2a341f8e633d2928ec95a94eb860c0c37db18d7a29b94`.
The private launcher and worker are `run-preparation-root-semantic-20260913.mts`
and `preparation-root-semantic-20260913.mts` in the agent scratch directory.
The run uses the same no-network 2 GiB,
2 CPU,
512 PID isolation with read-only source/corpus/dependencies and masked root credentials.
`preparation-root-semantic-20260913.out` records the successful run.
The report is `/var/home/user/temp/agent/preparation-root-semantic-3JTXjn/report.json`.
All sixty-three artifacts receive checked roles:
policy pool,
current and prior reading journals,
thirty complete-entry frames,
twenty-four note files,
five opaque historical source files and one source-floor probe.
The prototype reproduces the frozen 93/90/272 population and forty-parent/thirty-entry membership,
retains raw identities for 184 corpus documents and normalization origins for ninety eligible entries,
with zero fetch/provider requests.
Peak container memory is 1652715520 bytes;
this is a measured prototype footprint,
not a claim about the future native owner.
No prototype output is acquisition or writer approval.

Execution dependency closure still needs evidence.
`corpus-run/pipeline-digest.ts` excludes external runtime dependencies.
Its historical comment says closing that requires repo-wide build configuration,
but the current repository-owned `nodeConfig` accepts a per-package `external` override,
and `nodeExternal` accepts bundle-inclusion patterns.
The deciding source is `package/config/rolldown/src/index.node.ts:145`
and `package/config/rolldown/src/package-externals.ts:185`.
A package-only bundled-runtime experiment can test whether this dissolves the dependency-snapshot problem.
Do not infer dependency closure from a build alone:
inspect emitted imports and exercise a copied artifact without workspace or `node_modules` access.
No build-policy change has been adopted by this observation.

The owned runtime-closure worktree starts at `f896c779f`.
Its package-only JavaScript-bundling prototype is committed as `cb3101583`,
with no auto-push because HEAD is detached.
The native Git trust and scanner-input setup is recorded separately in
[temporary policy inputs](../troubleshooting/cli-git-temporary-worktree-policy-inputs.md).
No guard was disabled;
that temporary trust must be revoked during cleanup.

The JavaScript-only build and types pass,
but the full suite fails while importing Satteri's native loader,
before ordinary test assertions:
`MODULE_NOT_FOUND` for `./satteri_napi.linux-x64-gnu.node`
and `@bruits/satteri-linux-x64-gnu` relative to the emitted chunk.
The actual installed Satteri package and native package are `0.9.5`.
Its generated loader contains a `0.8.1` version-check literal;
that literal is not proof that a different package version was resolved.
Direct resolution from both worktrees confirms the same `0.9.5` JavaScript entry.
Do not follow the loader's generic npm-reinstallation advice for this relocation failure.

The next prototype emits the exact resolved Linux x64 GNU native asset beside the bundled JavaScript
and records emitted import/module metadata.
`runtime-closure-build-20260913.out` retains the failed JavaScript-only run.
The baseline and failed bundle are separately copied and hash-checked before rebuilding;
`artifact-copies.json` in the worktree's `.guard-sandbox` records 380 copied files.
The new run uses fresh `r2` output and runtime-ledger paths under the same resource limits.
The R7 matched-environment full suite passes build,
types and all 629 test-entry processes on Node `26.8.2`.
`test:unit exit 0` was read at line 10374 of `.guard-sandbox/r7/test-unit.out`.
Peak container memory is 1032114176 bytes.
Harness corrections preserve the real command defaults:
independent `/tmp`,
default-path libatomic and a readonly corpus at the temporary home's normal corpus location,
not a global clone-directory override.
The separate failures and their controls remain in
[native runtime bundling](../troubleshooting/translation-repair-native-runtime-bundling.md).

The copied R2 artifact exercises the complete semantic-input consumer with no workspace or `node_modules` mount.
The original artifact fails for missing `p-limit`,
and removing only the native asset from the copied candidate fails for missing native binding.
All 192 copied R2 files match the R7 artifact by name and bytes.
The comparator's actual one-byte-file-change positive control is retained in `candidate-parity-controlled.json`.

The emitted/import audit examines 150 JavaScript files,
790 static AST edges and 794 emitted edges.
Static edges name only Node builtins or existing local output files.
Its 87 indirect observations retain Satteri's native override,
platform and fallback loaders plus literal Node dynamic imports.
These must be classified against an enforced target/environment contract;
static closure is not complete closure.

Independent review recommends a dedicated sealed build,
not changing the default package build.
The experimental `runtime-imports.json` contains source-location paths and must stay outside the sealed artifact.
The native-asset build helper must not remain under published `src` subpaths.
Remaining requirements are GNU-libc/Node/native-asset identity,
pre-import rejection or binding of loader overrides,
final lint,
matched-environment standalone verification and a second-worktree byte comparison.
The development worktree now has a separate `runtime:seal` package task and `rolldown.sealed.config.ts`,
introduced in `67e5468c4` and refined through `382dfe702`.
Named runner entries are shared with the ordinary config without changing its externalization policy.
The candidate output is `package/module/translation-repair/node_modules/.sealed-runtime-candidate`,
outside published `dist/final` and `src`.
It is not an execution directory:
copy it into a fresh frozen location before any reviewed use.

The build checks Linux x64 GNU libc,
compares actual Satteri JavaScript/native package versions,
and records the native asset plus executed Node binary byte identities.
Its relative-path `sealed-runtime.json` excludes source-location paths and timestamps.
Loader-environment absence requirements and system-library responsibility are declarations,
not an implemented pre-import gate.
The native asset's `readelf --dynamic` entries name `libgcc_s.so.1`,
`libpthread.so.0`,
`libc.so.6` and `ld-linux-x86-64.so.2`;
these remain runner/image inputs rather than JavaScript dependencies.

The first independent dedicated-build check passes the ordinary build,
confirms all 150 ordinary runtime files are byte-identical to the frozen baseline,
then passes sealed build and types.
Its physical-file comparison detects declaration chunks incorrectly included in the runtime manifest.
Those are excluded in `5a483507c` rather than counting type-only output as executable identity.
The formatter's readonly-host-callback finding is resolved with an explicit deeply readonly view of consumed fields;
the repeated package formatter reports zero findings.

`sealed-runtime-dedicated-verification-r2-20260913.out` records successful bounded verification.
It confirms the 150 normal runtime files remain unchanged,
checks the manifest against all 151 executable/native files,
and runs all 629 test-entry processes against a copy of the actual sealed artifact.
`test:unit exit 0` was read at line 10378 of `.guard-sandbox/dedicated-r2/test-unit.out`.
The manifest digest is `c6375af734890a5f224e472c5e5e25bb2bd5ed73ee1635cd58a380f3ed742273`.
The normal artifact is restored by asynchronous disposal after the sealed test run.

A second main-created worktree at
`/var/home/user/temp/agent/translation-repair-sealed-location-20260913`
uses source `382dfe702` and the same bounded build environment.
`sealed-location-comparison-20260913.out` confirms identical names and bytes for all 192 emitted files,
including the manifest and declarations.
No policy trust was granted to this build-only worktree.

The final copied consumer checks the independently recorded manifest hash,
Node binary identity,
target,
loader environment and every runtime file before importing the application.
It then reproduces all semantic-input checks with no workspace or `node_modules` mount
and default-path libatomic rather than an `LD_LIBRARY_PATH` override.
Its report is `/var/home/user/temp/agent/runtime-closure-standalone-e3Yxki/report.json`.
This remains a probe of the owning gate contract,
not a production pre-import gate.
Final package lint reports zero warnings and errors across 1485 files.

The durable proof is `/var/home/user/temp/agent/sealed-runtime-proof-20260913`:
744 hash-checked retained copies,
66926586 copied bytes,
151 executable/native files,
629 verified test entries and the independent build-location comparison.
Native policy trust and its recursive authority were revoked before cleanup.
Empty container bind-target directories required checked,
nonrecursive user-namespace ownership repair after Git's partial removal;
the [cleanup observation][input-cleanup-observation]
retains the details and proposed `GCL` clarification.
Both worktree directories and registrations are absent at `2026-09-13T08:34:22.034Z`.

A pre-import gate and native correspondence-root/phase owner remain unfinished.
Place the gate in the actual owning runner before loading the sealed application;
do not introduce a generic execution framework or treat build metadata as approval.

### Native semantic input owner

`buildPreparationRootInputs` now owns fresh selection/supporting-byte matching,
independent corpus configuration,
full native policy reconstruction,
exact frozen-parent lookup,
entry/frame/note provenance,
source obligations and initial definition scope.
Its return scope is `unqualified-preparation-root-inputs`,
not a reviewed root,
phase or writer plan.
Unselected population records contain node/position/protection metadata,
not unrelated complete-parent prose.
Unconsumed historical support remains `opaque-selection-support`;
its filename does not establish execution or interpretive authority.

The first committed owner is `5e02bc978`.
The disposable verification worktree was
`/var/home/user/temp/agent/translation-repair-root-inputs-20260913`.
It is now removed;
retained evidence is under `/var/home/user/temp/agent/semantic-root-guard-proof-20260913`.
`root-inputs-native-verification-20260913.out` records successful build,
actual corpus/artifact consumption and types on Node `26.8.2`.
The native consumer verifies thirty selected entries,
272 population parents,
forty unchanged frozen identities,
184 raw corpus documents,
45 initial scope records,
42 queried and three structural paths,
and Xing's unaligned source definitions `block/236` through `block/244`.
Raw/effective and archive-origin records match the retained prototype after ordering raw identities by locator.
That parity is regression evidence against the shared native semantics,
not an independent proof that those semantics are correct.
`Mio#0` remains open and no provider or fetch request occurs.
Peak container memory is 656478208 bytes.

[input-cleanup-observation]:
  ../troubleshooting/cli-git-temporary-worktree-policy-inputs.md#container-backed-cleanup-observation
