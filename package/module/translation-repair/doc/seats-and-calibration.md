# Deciding who fills a seat

Part of [the package README](../README.md).

`judge-fidelity-probe` uses the source-reviewed manifest in `fidelity-reference-manifest.ts`.
It no longer calls the first long archive slice “clean” merely because it is unchanged.
The loader verifies pinned source/archive/donor ranges,
shared normalization,
reviewed local corrections,
reference length and every generated damage hash before any model call.
No corpus passage is committed in the manifest,
and local calibration corrections never edit the corpus or filter production translations.

`--cap 0` is explicitly metadata-only preflight,
not a quality result.
Unknown `--only` entries,
unreviewed `--context`,
a different configured corpus revision
and any requested damage family absent from the selected population are refused before corpus/provider access.
For example,
`--only gqt` cannot provide the default alteration arm;
`--only gqt --damage deletion` requests a supported narrower comparison.

Positive runs materialize the position/direction matrix before applying the row cap.
A capped prefix is explicitly marked incomplete,
not complete admission evidence.
Each invocation creates a fresh payload namespace and persists its logical plan,
completed rows and terminal result separately.
Interrupted execution can therefore retain rows without claiming completion.
The result includes exact reference provenance and its manifest digest.

A singleton panel's merged verdict can be underweight even when its individual vote is correct;
it is not the per-model admission score.
Admission additionally requires the registered complete question set,
peer participation and one score per actual question,
not duplicate scores for equivalent direction bookkeeping.

The historical `hakureico/7` and `noname/4` reference set contained unsupported facts and changed certainty.
Those scores are not source-grounded admission proof.
The [reviewed fixture record](../../../../doc/planning/translation-repair-reviewed-calibration-fixtures-2026-09-11.md)
records the replacement references and each verified delta.
No existing role is retroactively removed solely on the old fixture diagnosis.

## Prepared writer inputs

The `producer-input-*` runner this section describes was torn down in `cbedea357` (2026-09-16)
with the rest of the provider-free preparation layer;
the section stays for the artifacts and standings it produced.

The legacy writer sampler is not approved for further admission measurements.
It can attach archive body obligations to a source heading.
Its native CLI is not yet gated on a reviewed preparation plan;
the private paid launcher remains blocked.
See the [writer-input work record](../../../../doc/planning/translation-repair-writer-unit-scope-2026-09-11.md).
The frozen parent selection is not acquisition approval or a final forty-round writer plan.
`readFrozenPreparationSelection` checks its independently expected bytes and preserves ordered parent identities,
reference inventory,
historical sampler provenance and unresolved source obligations.
This is a partial identity projection,
not a complete nested-schema or population audit.
It does not verify referenced files,
re-run selection or approve a correspondence root.
The independently expected whole-artifact digest binds sampler metadata that is not projected.
`readPreparationSelectionEvidence` additionally matches an exact caller-loaded supporting-byte inventory,
returns owned raw snapshots and extents in frozen order,
and does not open paths or assign semantic roles or approval.
The I/O owner must size-bound inputs before loading them.
Byte inputs must be genuine branded `Uint8Array` views,
including `Buffer`;
byte-view proxies are refused.
Matching is point-in-time evidence;
a downstream owner must rehash bytes rather than trusting a mutable returned record.
Its byte-binding boundary is verified independently of the still-unfinished reviewed root and acquisition owner.
`buildPreparationRootInputs` owns fresh byte matching,
independent corpus configuration,
current native population reconstruction and exact frozen-parent lookup without resampling.
It checks the consumed frame/note/carry relationships,
preserves source obligations,
and derives writer-parent and definition-only registrations from the complete selected entries.
Unaligned definitions remain namespace data;
unused support remains `opaque-selection-support` rather than gaining authority from its filename.
The result says `scope: 'unqualified-preparation-root-inputs'`.
Persisted `registry[*].freeOrder` uses explicit numeric arrays,
while native pairing questions retain their in-memory sets.
Older artifacts containing empty objects in those fields do not establish empty definition-order domains;
use a freshly qualified reconstruction rather than filling missing values.
It creates no providers,
section override,
reviewed phase or writer approval.
Its native corpus and full-suite regression checks
do not establish independent correctness of the shared parser/aligner.
The writer-input work record reports the listed boundary mutation proof
and remaining reviewed-root,
phase and acquisition integration work.
The separate `runtime:seal` task builds a Linux x64 GNU application-runtime candidate under
`node_modules/.sealed-runtime-candidate`,
with the native parser asset and a relative-path `sealed-runtime.json` inventory.
The normal build retains its existing dependency policy.
A candidate must be copied into a fresh frozen directory before reviewed use;
the build neither approves execution nor implements the required pre-import target/environment gate.
The separate `bootstrap:seal` task builds `producer-prepare.mjs` and `producer-bootstrap.json`
under `node_modules/.producer-bootstrap-candidate`.
Its CLI accepts `--launch`,
`--launch-sha256` and `--launch-bytes` from independently recorded launch authority.
The trusted caller authenticates the frozen bootstrap and host before invoking Node.
The host owns private output creation,
native creation inspection,
bounded start/cleanup and output verification;
the child checks context and runtime bytes before importing `producer-prepare-app.mjs`.
The tested frozen CLI reconstructs the unchanged 40-parent input artifact on the pinned corpus,
with byte equality to the prior native serialization and independent container-absence verification.
This is unqualified input reconstruction,
not a reviewed root,
phase,
writer plan or publication result.
Current-artifact native qualification exercises pre-import and pre-start refusals,
output retention,
file replacement,
exclusive collision and interruption/cleanup boundaries.
The committed CLI tests and private native qualification suites have distinct owners and scopes;
see `producer-input-verification.md`,
removed with the runner in `cbedea357`.
Native qualification is not presented as exhaustive package-path or portable CI regression coverage.
Package `test:unit` depends on the separate bootstrap build.
For explicitly prebuilt artifacts,
`--skip-deps` skips task dependencies;
`--no-deps` only skips automatic dependency preparation.

The separate inert `producer-input-comparison.mjs` entry exports `runProducerInputComparison`.
It owns request primitives,
authenticates the fixed bootstrap launch,
derives only a private `outputParent`,
then verifies and compares the actual persisted input file.
A mismatch retains the output and `comparison.json` before rejecting.
Successful results and `ProducerInputComparisonError` expose `loggerCallbackFailures`:
a detached frozen list of callback names observed to throw,
in canonical logger order.
Logger exceptions do not cancel the comparison or replace its primary failure;
explicit `AbortSignal` cancellation remains independent.
Live cancellation is forwarded into an owned native signal without copying caller reasons
or consulting own public signal accessors.
The temporary subscription preserves propagation resistance and is removed on exit.
Synthetic or replayed events do not substitute for native aborted state,
and an unreadable composite observation cannot authorize success.
Proven native cancellation retains interruption precedence over a prior unreadable observation.
Failure-path subscription cleanup precedes the terminal error snapshot;
its fixed observation warning does not replace the primary failure.
Fallible interruption registration completes before child creation;
the actual-close observer is installed before the child is attached to that scope.
These guarantees do not cover corrupted native internals or a hostile runtime.
The snapshot follows terminal logging and failure-record activity.
It is not written retroactively into `comparison.json` or `failure.json`.
Only an actual failure-record I/O refusal may supersede the primary failure as `storage`.
During initial request capture,
getter failures become fresh contract refusals;
a caught comparison-shaped Error does not supply operation kind,
directory or callback observations.
The observer neither proves message delivery nor contains blocking callbacks,
process exit,
filesystem mutation or unobserved promises returned from void level callbacks.
The [comparison work record](../../../../doc/planning/translation-repair-preparation-plan-and-journal-2026-09-14.md)
separates implemented behavior from current qualification and remaining work.

`readRegisteredPreparationParent` shares complete-document and parent-coordinate preflight with receipt reconstruction,
while allowing structural planning without inventing model evidence.

`blockPairingQuestion` shares current local block numbering,
definition-order exemptions and the unchanged historical cache key.
`blockPairingProtocol` shares the stage's actual messages and an owned copy of its response schema.
It does not include provider bodies,
model caps or attempt identity,
so it is not itself a complete question receipt.
`prepareBlockPairing` retains production singleton,
empty,
queried,
cached and fallback behavior.
`qualifyPreparedBlockPairing` separately replays current outcomes against the supplied configured electorate,
requires its usable quorum,
and verifies the complete preparation handoff and findings.
It distinguishes independent relation endorsement from deterministic media ownership,
source insertions and policy-backed target declines.
Historical caches and unresolved fallback do not qualify.

Every returned value says `qualification: 'pairing-only'`.
Zero-question results report structural relations,
source insertions and archive blocks without source,
not invented model votes or automatic writing eligibility.
`readPreparationReceipt` compares terminal data with independently supplied namespace,
configuration,
question and electorate expectations,
then returns only owned raw final seat outcomes.
`readPreparationOccurrence` checks complete current document hashes and registered parent indexes,
reparses the documents and rebuilds current definition interpretation,
container ownership,
alignment findings and preparation handoff.
Its `scope: 'receipt-bound-occurrence'` result is not qualification.

`createPreparationAttempt` creates a fresh private namespace with exclusive fixed-name files,
content sync and an independently returned exact plan digest and byte extent.
`verifyPreparationAttempt` checks those expected bytes and observed file identities within the registered extent.
Neither operation grants semantic plan approval,
leases,
original-creation authentication or containing-directory power-loss durability.

`readPreparationDefinitionRelations` snapshots a registration,
reconstructs its terminal receipt against complete current documents,
and only then projects usable evidence to the registered definition domain.
Its internal evidence core does not run body/media normalization or fallback handoff;
those remain in the full `readPreparationOccurrence` consumer.
Its `qualification: 'pairing-only'` and `scope: 'footnote-definitions'` result retains the checked occurrence binding
and endorsed definition endpoints.
An empty projection invents no correspondence,
and no body pairing,
media claim,
target decline or full-parent writing qualification follows from it.
The definition-only consumer is verified against the native footnote operation,
full-handoff failure and media-claim controls,
with isolated guard proofs.
It does not supply the owning journal's conditional review or acquisition gate.

The owning journal must still establish exclusive attempt provenance,
derive actual configuration and provider-body identities,
verify allowed target transitions and bind source channels and dependencies.
A target rewrite requires reparse,
repreparation and newly bound evidence.
A registered same-attempt receipt can supply an unchanged exact question after an unrelated rewrite,
but no old coordinates or handoff survive that reuse.
Changed questions cannot reuse the old receipt.

`captureBlockPairingRequests` materializes the shared protocol through individual native provider clients
with a mandatory non-serving transport and refused accounting.
It records exact header-free projections and conservative stage/route/HTTP bounds,
not current budgets or admission evidence.
Its digest covers the emitted materialization data;
the owning journal must independently verify the selected runtime and request configuration.
Native retry and route-fallback tests compare against separately constructed provider clients.

This check does not replace the separately reviewed native execution gate,
which remains unimplemented.

## Historical writer and editor runners

Two other runners rank models on the job the seat actually does.
Both spend quota,
both write nothing to a corpus,
and both take a slice count after `--`.

```sh
mise run //package/module/translation-repair:producer-calibrate -- 10
mise run //package/module/translation-repair:editor-calibrate -- 14
```

`producer-calibrate` ranks WRITERS.
It drives the translate stage:
a model writing English from Chinese with nothing in front of it but the source.

`editor-calibrate` ranks EDITORS,
and reports the refiner standing off the same spend.
It keeps four slices in flight and waits 300000 ms on stragglers after quorum,
both the owner's decisions of 2026-08-26 on the five calibration arms
(`doc/decision/translation-repair-calibration-overlap.md`);
`TRANSLATION_REPAIR_SLICE_OVERLAP` and `TRANSLATION_REPAIR_STRAGGLER_GRACE_MS` override either for one launch,
and `120000` reproduces the pass's own window:
the pass's window moved from 180000 to 120000 on
2026-09-03 by the owner's decision on a measured pair (`doc/decision/translation-repair-straggler-grace.md`).
The pass keeps four slices in flight as well since 2026-09-06,
read off the four matched pass pairs `#261` asked for
(`doc/decision/translation-repair-pass-overlap.md`);
`TRANSLATION_REPAIR_SLICE_OVERLAP=1` reproduces the sequential driver for one launch.
`TRANSLATION_REPAIR_HYPER_REQUESTS_PER_HOUR` (`request-pace.ts`) sets how many Hyper requests may start
in any rolling hour,
retries and credit reads included;
the rest queue in arrival order instead of being refused with HTTP 429.
The default,
1,000,
is the account's limit as the owner stated it and as
XIEPT2's refusals on 2026-09-03 bear out (612 successes in 43 minutes once the hour's thousand was spent,
a trickle of about 12 a minute under refusal);
a value that is not a positive number leaves the default,
and the retry ladder separately waits as long as a refusal's "try again in Ns" asks.
The window starts empty at launch,
so a launch within an hour of a heavy run is refused until that run's requests leave the window.
The WRITER rounds,
editor,
refiner,
translate and consolidate,
wait 180000 ms on stragglers after quorum (`WRITER_GRACE_MS` in `writer-grace-override.ts`,
the owner's decision of 2026-09-06 in `doc/decision/translation-repair-straggler-grace.md`),
since a cut writer voice is a whole candidate lost while a cut reader voice is one ballot of eight;
they follow the round window instead when a launch made that the longer one,
as the calibration's 300000 ms is,
so the built-in never shortens a writer round.
`TRANSLATION_REPAIR_WRITER_GRACE_MS` moves the writers for one launch in either direction.
Every launch prints `WRITER GRACE built in`,
or `WRITER GRACE OVERRIDDEN` when the dial is set,
beside the round note in both the pass and this calibration.
It drives the whole repair lane,
so the claims an editor works from are claims models really raised about that passage rather than fixtures.
That costs more per slice than the writer calibration,
because a slice buys critics,
a panel,
editors,
judges and checkers instead of one stage.

Every model writes on every slice in both.
A narrow slate would compare only the models that happened to be seated,
so a standing would mean something different for each of them.
Every model also judges,
matching production,
and each model's ballots on its own work are then discounted,
because counting self-votes ranks the most self-confident model first rather than the best-written one.

## The standing that costs nothing

Every settled artifact's repair chunks already record the slate judges were shown,
each candidate's producer,
and every ballot.
That is what a standing counts,
so one can be read off work already paid for:

```sh
mise run //package/module/translation-repair:editor-standing-read -- <run dir> [<run dir> ...]
```

It spends nothing and touches no model.
Four things bound what it can say.

It is OBSERVATIONAL.
Only models that held a seat ever wrote a candidate,
so it ranks whoever was seated and is silent about everyone else.
An absent model is unmeasured,
not last.
That is the survivorship the controlled calibrations exist to defeat,
which is why this corroborates them and never replaces them.

It NEVER POOLS ACROSS PIPELINE DIGESTS,
because two builds are two configurations and a figure summed over both describes neither.
Each digest is reported alone with its entry count,
which is the denominator that governs:
rounds inside one entry are correlated.

It REFUSES AN ARTIFACT FROM AN EARLIER ROSTER,
by name.
Model ids are a closed set,
and reading an id the roster no longer seats as though it were current would let a standing mix two rosters silently.
Those artifacts are counted apart from malformed ones and named with the exact path that held the departed id.

It SEPARATES AN EARLIER SCHEMA FROM A DEFECT.
A repair result whose `chunks` field is absent entirely was settled before the lane recorded rounds at all.
That record is complete and correct for the build that wrote it;
it simply cannot answer this question.
It is counted as `earlierSchema`,
not as a parse failure,
because calling it broken would report a healthy archive as a damaged one.
Chunks present and not an array stays a parse failure.

The report accounts for every artifact it opened,
across `read`,
`earlierRoster`,
`earlierSchema` and refusals,
so a reader can see what fraction of an archive the standing actually rests on.
On the archives as of 2026-08-24 that is 41 artifacts:
2 read,
17 from an earlier roster,
22 from an earlier schema,
none malformed.

## Reading a standing honestly

Three things on the report decide whether a standing means anything.

The COUNTS beside each share.
A share with no denominator cannot be told from a share one ballot wide,
and a lead smaller than its denominator supports is not a lead.

The SLICES that paid in,
printed as `from N of M slices`.
Adjudicated is not accepted:
a slice can buy ten critics and a ten-model panel,
have its issues rejected at the accept gate,
and contribute nothing to an editor standing.
A standing drawn entirely from one slice reads identically to one drawn evenly from six without this line.

The models the table DOES NOT DESCRIBE,
named at the end.
A standing carries a row only for a model somebody voted on,
so every other seated model vanishes,
and its absence would otherwise read exactly like a model that wrote and lost.
During a provider outage that is half the roster.

Three different things put a seated model outside the table,
and the calibrations name them apart rather than reporting one absence (`#263`):

-   WROTE AND WAS NEVER VOTED ON.
    Its text reached a slate and no disinterested ballot was cast over it,
    which is what a slice where every producer proposed the same wording does:
    it ships unjudged.
    That evidence is already paid for,
    and more slices are what would separate it.

-   ANSWERED AND WAS NEVER SLATED.
    At least one usable answer of its was heard and none became a candidate a judge saw:
    a rewriter that leaves a paragraph as it stands,
    or whose rewrite is dropped before judging.
    Re-running it buys the same again;
    slices with something to rewrite are what would seat it.
    Arm A of 2026-08-26 reported such a seat as silent beside a `SEAT` line saying it had answered 31 of 31,
    which is the misreport this state exists to end.

-   ANSWERED NOTHING USABLE.
    No usable answer of its was heard at the seat.
    A provider out of budget,
    a refused sheet and a call that timed out all look identical from the report,
    and the `SEAT` lines and the run log name which.
    That evidence has not been bought yet,
    and re-running those seats buys it.

Only a seat that records who answered can tell the last two apart.
The refiner seat does (`settleRefinedSlice` returns `refinersHeard`);
the editor and translate seats carry only a heard count out of their stages (`#266`),
so their silent line reads `NO CANDIDATE OF THEIRS REACHED ANY SLATE` and says the seat does not record who answered,
instead of calling the unknown silent.

The silent line carries both denominators,
as `covers N of M seats`,
so a table narrowed by an outage cannot read as a full roster comparison.

A standing,
a slate or an answer list naming a model the run never seated is REFUSED,
because coverage of one roster cannot be read off another.

## Editor credit and refiner credit are separate columns

The lane unions them,
so the split takes work.
`collectRefinedAuthors` merges the editors with any refiner whose rewrite won,
so the refined outcome's authorship names both seats in one list that cannot be split back apart.

The editor column is therefore read off the accuracy lane's own outcome,
before refinement,
and the refiner column off `settleRefinedSlice`'s `refinedBy`,
which names the models whose rewrite is actually in the text that shipped.
`refinedBy` is empty on every path where no rewrite ships,
including one the recheck rolled back,
and it is deliberately kept off the cached settlement for the reason `asked` is:
a slice resumed from disk bought no rewrite.
`refinersHeard` rides beside it,
also uncached:
the refiners heard with a usable answer,
proposal or not,
which is what separates a seat that answered from one that never did.

## The editor calibration diverges from production in one place

Checkers self-certify there,
and only there.
Production forbids a checker from proving its own repair,
and seating all ten as editors leaves nobody independent to check.
Rotating editors out instead would reintroduce the survivorship the shape exists to avoid.

It is safe for that measurement because checking runs after selection:
the ballots a standing reads are cast before any checker is asked,
so self-certification can move how many rounds happen,
not who won the ones that did.
