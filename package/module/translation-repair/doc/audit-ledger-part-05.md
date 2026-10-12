# Audit ledger, part 05

Part 05 of [Audit ledger](audit-ledger.md),
whose index lists every part in order.

## Test suite, continued

### T5: flaky timing

Status:
fixed;
the finding text below the measurements is as first recorded.
The contest case's delayed seats never answer,
on an abortable timer:
5 of 5 pass at 0.2 CPU
(`~/temp/agent/audit-tests/t5-fix-summary.log`).
The naturalness-review sibling measured 5 of 5 at 0.2 CPU before any change and is left as it is:
its fake answers in microtasks,
so the race read into it does not occur.
Real sleeps removed:
the `stage-quorum` stall (30.49 s to 0.51 s),
the contest driver's production backoff (27.4 s to 0.55 s),
and the client's malformed-body case (11.98 s to 0.76 s).
`consolidate-driver` ran 10.24 s,
0.77 s after the fix:
its two positive controls ("reaches the roster" cases) passed only because
five production backoffs outlasted `driveWith`'s 5 s abort,
so they asserted a timeout,
not a roster call;
they now count transport calls under a zero-retry client and assert the observed exits.
A sweep of all 729 test files for timers of 500 ms or more
(`~/temp/agent/audit-repair/long-timer-sweep.json`) found three more real waits:
the `benchmark` fake's two 2 s waits,
now a fake clock the benchmark reads (`544169f98`,
2.36 s to 0.59 s),
the `stage-round-refill` slow seat,
now abortable (`9441af9de`,
1.94 s to 0.46 s),
and `transient-retry`'s backoff,
which is the behaviour under test and stays.
Long `settleWithin` and `armCallDeadline` timers are armed and cleared and cost no wall time.
The shapes read into the rest were measured,
8 runs each at 0.2 CPU
(`~/temp/agent/audit-tests/t5-rest-summary.log`,
`t5-peak-summary.log`):
`synthetic-client`,
`hyper-client`,
`provider-router`,
`transient-retry`,
`budget-hold-wait`,
`refine-phase` and `lane-contest-driver` passed 8 of 8 and are left as they are
(a floor on a wait only grows under load;
the `transient-retry` ceiling is a daily refusal's wait).
`stage-round` failed 1 of 8:
time to the first answer (398 ms) passed the 250 ms grace it was compared with;
it is now anchored on when the first voice really answered (`c10d62663`),
16 of 16 after.
`consolidate-driver` failed 1 of 8 on the T6 order check this audit added,
ordered by 20 ms against 5 ms sleeps;
both overlap cases now order by a gate (`d76d2424a`,
M11),
16 of 16 each at 0.2 CPU after (`t5-gate-summary.log`).
`lane-contest-stage.unit.test.ts` "RECORDS RAW HALF-QUORUM BALLOTS" fails 2 of 5 at 0.2 CPU
(positive control:
the `podman run` in `~/temp/agent/audit-tests/run-container.mjs`);
its sibling case,
the naturalness-review grace case,
settle-by-timer checks in `synthetic-client`,
`hyper-client` and `provider-router`,
and the driver trio's `peak` checks are the same shape by reading;
wall-clock floors in `transient-retry`,
`budget-hold-wait`,
`stage-round` and the benchmark have no slack.
Real sleeps:
`stage-quorum` waits 30 s ignoring the abort signal;
`synthetic-client` and `lane-contest-driver` run production backoff.

Recurred in `request-pace.unit.test.ts`,
found 2026-10-01 (UTC) from the coverage census:
the default sleeper's resumption (`request-pace.ts:128`)
ran in `census-zkJwfY` and not in `census-dnr81C`,
the source and its test unchanged between them.
The case "SLEEPS ON THE REAL CLOCK WITH THE DEFAULT SLEEPER" took two places on a 20 ms window on the real clock.
A take works out its wait before it first awaits,
so a run stalled past the window between the two takes found room,
never slept,
and passed its one-sided check all the same:
its name claimed a sleep it did not make sure of (the T6 shape),
and what it covered rode on load.
The pacer's clock is now held still until the second take has started its sleep on the default sleeper,
then released,
so the sleep is the whole window on every run;
the default clock stays covered by the B78 case on a stepped wall clock.

Recurred in `absolute-naturalness-review-stage.unit.test.ts`,
found 2026-10-03 (UTC) in the trial's suite start under the whole suite's load:
the "STARTS GRACE AT HALF instead of requiring delayed final seat" case
ordered its delayed seat's rejection 30 ms against its peers' microtask answers,
and load starved the peers' quorum to the seat's arrival,
so the reply raced the 0 ms grace close
and the case failed 2 of 5 full-suite runs
(a correction naming itself:
the Status's claim that the naturalness-review sibling's "race read into it does not occur" rested on 5 of 5 at 0.2 CPU,
which never probes the whole suite's load).
The seat's answer is now held on a gate the case releases after the review settled
(the M11 shape),
so the straggler arrives after the close on every run
and its words still flow past the no-leak check,
which a seat that never answers would have left vacuous;
"KEEPS REJECTION that arrives inside bounded post-quorum grace" keeps its 30 ms sleeper against a 100 ms grace,
safe in both orderings,
as the control.

### T6: names claiming more than they check

Status:
fixed in `292939dab`,
`6baf52dbe`,
`bc80c8c14` and `6d7d83c1b`,
whose order checks were timing-ordered and are made deterministic in `d76d2424a` (M11);
the "trio" is two files (refine phase,
consolidation driver) whose names claim the second call answers first.
`bedrock-catalog` "EVERY ROUTE" checks one route;
`synthetic-catalog` pins a literal price;
`block-pairing-protocol` compares a wrapper to its own builder;
the driver trio never asserts the second call answers first.

### T7: magic numbers

Status:
fixed in `c0ce1a2c5`,
`7a4d521ed`,
`962770574`,
`04a9f499a` and `e2c887ee7`;
`roster-reach` under E9.
`roster-reach`,
`request-pace`,
`synthetic-catalog`,
`deepseek-v41-admission`,
`synthetic-client`,
`repair-slice-key`,
`anthropic-request` (a cap that should be computed from the exported caps),
and vote weights not derived from exported constants in `candidate-select` and `candidate-select-decision`.
The rule applied:
a measured provider fact or owner limit is pinned once,
where it is owned
(`hyper-catalog`,
the GLM wire facts,
the account limit in `request-pace`),
with its source named;
every other test derives from the export.
Kept as pins,
deliberately:
`repair-slice-key`'s key literals,
which exist to fail when a key changes,
and `request-pace`'s account limit.
`completion-cap` gained the only check that a pooled card name resolves to one shared figure;
before,
the DeepSeek test's 13,082 literal was its only cover.

### T8: code no unit test runs

Status:
open,
and the next launch waits for it:
under the owner's standing directive of 2026-09-28 to prefer the quality of the end result,
the launch follows the tests this entry asks for,
and the owner may veto that order and launch first.
Remeasured 2026-09-29 by block coverage mapped to source lines,
which supersedes the 2026-09-28 figures;
first recounted 2026-09-27 at 79 of 1,178 barrel-exported functions
(`~/temp/agent/audit-repair/untested-exports.mjs`,
list in `untested-exports.json`),
queued after the findings that change a run's output.
76 public functions named by no test;
a coverage sample shows `isPaymentRefusal`,
`statedWaitMsOf`,
`routedJson`,
`secondOpinionsFrom` and others never called,
and the decision reply's refusal branches never exercised.
Recounted 2026-09-28 with the same script:
94 of 1,248,
the barrels having grown;
`reseatHookFor` (X12) is among them though every hook builder's test runs it.
The count has two blind spots,
so it is neither a floor nor a ceiling of untested code:
it reads `export function` declarations only (never `export const`),
and it counts a name mentioned anywhere in a test as tested,
while a function called only through another is uncounted.
The work waits on a measurement of execution rather than names:
the unit suite under `NODE_V8_COVERAGE`,
with function entries that never ran intersected with the barrel exports,
then a case per branch of each function on that list (TCV).

Measured so on 2026-09-28 at `1ea1e350a` (`~/temp/agent/audit-glossary-fix/coverage-exports.mjs`,
result in `coverage-exports.json`):
835 test processes,
7,044 bundle functions,
1,407 exported functions.
Three exported functions never ran:
`DecisionsCardMissingError`,
`UnpositionedContainerError` and `spendCeilingOverrideNote`.
Five exports match no bundle function by name
(`isAsciiLowerLetter`,
`isJsonRecord`,
`seatJudges`,
`seriesFor`,
`textSettingOf`),
so the measure cannot say whether they ran.
The name census's 94 was mostly functions reached through others.
The branch gap is the larger one:
371 exported functions that ran hold 952 blocks no test reached
(175 functions with one such block,
130 with two or three,
57 with four to ten,
9 with more,
led by `repairChunk` at 22),
and blocks inside functions the package does not export are not yet counted.
The 952 was a listed-range sum over exported functions alone;
it and the five unmatched names are superseded by the 2026-09-29 measurement.

Remeasured on 2026-09-29 at `cd3f14810`,
with every block rather than exported functions' alone:
the unit suite under `NODE_V8_COVERAGE` against a build carrying source maps
(862 test processes;
1,356 passes counted by marker and no failures,
where a count of lines reads 1,355 because one output line held two tests' lines),
each bundle cut at every range boundary any process reported,
each piece given the count of its innermost enclosing range in each process and summed over processes,
and the pieces no process ran merged and mapped to source lines through the maps.
Summing only the ranges each process lists,
as the 2026-09-28 measurement did,
calls blocks cold that ran:
V8 drops a nested block whose count equals its parent's
(`MergeNestedRanges` in V8's `src/debug/debug-coverage.cc`),
so a block one process lists as cold can have run in another that does not list it.
Of the 2,371 blocks in every function that sum calls cold on this run,
1,061 ran.
That measurement also keyed each function by its start offset alone,
so a function opening its chunk merged with the chunk's top-level script and took its empty name:
those are the five unmatched exports,
and all five ran
(`isAsciiLowerLetter` 35,657,557 times,
`isJsonRecord` 1,286,565,
`seatJudges` 14,
`seriesFor` 9,
`textSettingOf` 3).
Two controls hold the mapping:
the three exports no test calls land on their own declarations
(the constructors at `src/model-card-derive.ts:271` and `src/unwrap-container.ts:162`,
`spendCeilingOverrideNote` at `src/corpus-run/spend-ceiling.ts:132`),
and the spans in `src/repair-chunk.ts` read as whole branches
(ternary arms,
early returns with their log lines),
though a span can start a line late where the minifier folds a log call and a return into one statement.
Neither control could show a span that crosses from one module into the next,
since each reads within one function,
and such spans were recorded under their first source alone (M67),
so the counts of spans,
lines and files in this entry until the M67 rerun leave out every source after the first;
counts of functions never called are unaffected,
a function being mapped by its own first character.

What no unit test ran on that build,
by class,
read through the mapping M67 corrected.
In library source,
1,223 spans over 3,229 lines in 449 files,
holding 72 functions no test calls.
In the six runner entry files tests load,
27 spans over 798 lines,
holding 14 such functions.
The 35 runner bundles no test loads carry 12,928 physical lines in 38 files,
counted apart from the spans;
three of those files are library source only those runners import
(`src/corpus-run/audit-sensitivity-input.ts`,
`src/corpus-run/runs-layout.ts`,
`src/corpus-run/pass-republish.ts`).
Other workspace packages built into the bundles add 233 spans over 3,906 lines in 59 files,
which are theirs to test rather than this entry's.

T8 closes when every library span has a case that runs it and checks what it does (TCV),
a throw on malformed input included
(driven by an input cast past its type,
asserting the error class),
and a span no runtime value can reach is removed as dead code under this ledger;
the runner entry files and the runners no test loads come after the library.
A batch proves its reach by rerunning its own test files under coverage against a mapped build:
every span it claims must read a count above zero there.
The whole census reruns before the launch checklist.
The first 2026-09-29 measurement ran from scratch scripts;
the census is now the package task `mise run coverage-census`
(`f81b58992` to `7253426c8`).
It builds with a source map beside every chunk (`coverage-census:build`),
runs the unit suite or the test files named after `--` with `NODE_V8_COVERAGE` set,
refuses a failing suite,
tallies and maps the cold code as the scratch census did
(until M67),
prints the report,
writes `census.json` under `~/.cache/translation-repair/coverage`,
deletes the raw coverage,
and runs the normal build again.
Given the same coverage and build as the scratch census,
its functions reproduced every total of it
(`t8-port-control.mjs` in the audit's scratch folder),
which proved the two agreed and not that either was right:
both recorded a stretch under its first character's source (M67).
Since `25dc7e9f6` the census splits each stretch where its source changes,
writes census format 2,
refuses a baseline of an earlier format,
and refuses to report where an uncalled function's first line sits in no stretch of its own source.
A batch proves its reach with `--baseline <census.json>` (format 2) and `--source <file>` for each source it claims,
or,
where the batch edits a source it claims,
by a format 2 census of its own test files in which each claimed stretch is gone:
a claimed source loaded with no stretch left,
or,
where the batch claims only some of a source's stretches,
each claimed line outside every stretch left.

The census's first whole-suite run refused,
the suite failing on the census's own commits (M59 again,
M63),
and a later one showed stretches in the census's own modules (M66).
The whole-suite census at `e22373347` (1,381 passes,
`census-7rB6TM`) was the baseline the batches were read against until M67:
library source holds 1,232 stretches over 3,239 lines in 453 files,
with 72 functions never called;
the six runner entry files tests load hold 27 stretches over 798 lines,
with 14 never called;
the 36 bundles no test loads carry 13,389 physical lines in 39 sources,
three of them library source only those bundles carry;
other workspace packages hold 228 stretches over 3,898 lines in 59 files.
Its stretch,
line and file counts leave out the sources after the first in every stretch crossing modules,
and a format 2 baseline replaces it;
its lists of functions never called and bundles never loaded stand.
The first batch,
`7253426c8`,
closed the census's own stretches,
read through a census of its three test files that showed `coverage-tally.ts`,
`coverage-lines.ts`,
`coverage-file.ts` and `build-entries.ts` loaded with no stretch left;
that reading went through the M67 mapping,
and the format 2 baseline repeats it.
The second batch,
`f2c96d7dd`,
gave cases to the refusals of `decisionsCardOf`,
`flattenContainers`,
`footnoteIdentifiers` and `clusterReadings`,
and removed two throws no input reaches (`AtomFloorError`,
`AnchorRegionError`) and one v8-ignored guard.

The whole-suite census at `77de8e685` (1,386 passes,
`census-qilSwP`,
format 2) is the baseline from M67 on:
library source holds 1,207 stretches over 3,473 lines in 445 files,
with 63 functions never called;
the six runner entry files tests load hold 27 stretches over 799 lines,
with 14 never called;
the 36 bundles no test loads carry 13,418 physical lines in 39 sources;
other workspace packages hold 230 stretches over 4,278 lines in 61 files.
In it the first batch's four sources,
and every census module,
are loaded with no stretch.
The second batch's sources are loaded with no stretch but two:
`src/model-card-derive.ts` keeps lines 374 and 429 to 435,
table checks of its own file batch rather than the refusal the batch claimed,
and `src/unwrap-container.ts` kept three,
two of them the refused container's fragment arms
(a fragment's name,
which the MDX extension writes as null,
and `<>` in the message)
and one a container whose children are not a list.
Cases for all three followed,
and a census of their test file against this baseline reads the three as ran and `src/model-card-derive.ts`,
the untouched control,
as still cold.
A stretch's line range runs from the lowest line its characters map to to the highest,
so where the minifier moves an early return behind the code after it,
the range can take in lines that ran:
the bundle writes that non-list return as `isNodeList(children)?…:!1`,
and the separator before `!1` maps to the last line of the arm before it,
so the stretch read 278 to 284 where only 278 was cold.
This entry then said the error was only ever toward calling code cold,
an inference no build without the minifier had tested,
and it was wrong (M79):
compression also folds guards into expressions V8 gives no range,
so a guard no test reaches read as run.
The census has measured an unminified build since.

The third batch gave cases to named functions no test called,
each an exchange or helper production reaches:
the prefixing logger's `error`,
`fatal`,
`flush` and `trace`;
the culled-seat guard's `chatJson` and `decide`,
refused for a culled model and passed through otherwise
(the guard is now exported for its test);
the router's `decide`,
refused with no decisions client and while OpenRouter reads dry,
and marking the meter on a budget refusal;
the seat tally's `decide`;
the Anthropic scanner's `servedBy`,
which the drain asks on every Hyper stream;
the pacer's default sleeper,
driven on the real clock through a wait and an abort;
and `sealedEnd`,
which only the scorer walk reaches,
with an original left behind the last seal and nothing after it.
`sealedEnd`'s hand-written unreachable throw became `nonNullishOrThrow`,
and the provider barrel's `//endregion` moved to its end,
past the two export blocks that had landed after it.
A census of the batch's test files against the format 2 baseline reads every claimed stretch as ran,
and `src/group-merge.ts`,
edited,
holds neither `sealedEnd` nor the seal branch calling it in a fresh census of those files.
The census reports raw truth and honours no v8 ignore hint:
a guard a hint hid is restructured in its file's batch,
as `flattenContainers`' was.

The fourth batch,
`be6490163`,
gave cases to five `corpus-run` files:
`spendCeilingOverrideNote`,
and `resolveSpendCeilingUsd` reading its dial from the environment;
the two-lane artifact reader's sealed archive-original spans,
and its refusals of an empty span list,
a span ending before its start,
a digest that is not one,
and a front matter authority other than the archive's;
`loadEntry`'s happy path,
through a corpus reader it now takes as a parameter,
on an invented page rather than the clone;
and `widthControlHolds` over a panel backing the intact passage and one backing the passage missing a sentence.
The `not-an-object` reconcile fault,
which no parsed artifact could raise,
was removed.
A census of its test files against the format 2 baseline reads every claimed stretch as ran,
`src/model-card-derive.ts`,
untouched,
as still cold,
and the edited `draw-entry-load.ts` and `draw-reconcile.ts` as holding no stretch.

The fifth batch began with M68,
and then the run's outside readers,
which only `pass-entry.unit.test.ts` had reached,
and only through the live key,
caches and corpus.
`outsideReadsFrom` builds them over an environment,
a transport,
a corpus pin with its lister and reader,
and a clock that is the wall clock unless one is handed in;
`RUN_OUTSIDE_READS` is its call over the process's own.
Its cases buy a work title and a linked page through a stub transport into a throwaway cache,
stamped by the wall clock and then by a handed clock,
search and read nothing without a key,
and read the names at the pin handed over.
A fresh format 2 census of `pass-outside-reads.unit.test.ts` (`census-BsBdqy`) loads `src/corpus-run/pass-outside-reads.ts` with no stretch left
(`9a03a4852`).
Two mutants were each caught by one case alone:
readers that stamp every record by the wall clock,
a handed clock ignored,
failed the fixed-clock stamps;
names read at the run's pin in place of the one handed over failed the pins the lister and reader saw.

The sixth batch gave cases to three more `corpus-run` files.
`openPageTitleCache` now round-trips a stored round through a throwaway directory,
and its guard refuses a stored value that is not a round,
or holds a title or finding of the wrong shape,
one field at a time.
The relabel probe's artifact reader renders a recorded tally under its envelope
(a count never written as 0,
a count of another type as itself),
reads a probe block written as null or holding no regions as no tallies,
and refuses a tally with no envelope,
an issue severity and a claim category outside the taxonomy,
each by its path;
the test file's `PROBER` constant had claimed a recorded tally no fixture carried,
and now says it is the roster.
The provider gate for measured arms took an optional transport,
defaulting to the live one,
and read its keys and the Bedrock ledger's place from `process.env`;
its tests set keys by writing `process.env`.
`assertRequiredProvidersReady` now requires `env` and `transport` (the pass hands over `process.env` and `fetchTransport`),
and its tests hand over their own,
the Bedrock case a ledger in a throwaway directory;
new cases cover an absent flag,
a flag with no value,
an empty value or an unknown provider,
nothing required,
a meter the transport cannot read,
and Bedrock wet and dry.
The gate's catch rethrew a `RequiredProviderError` nothing under a meter read raises,
and dropped every other failure without a word;
the rethrow is gone,
and the failure is logged before the arm is refused as `meter unavailable`.
A census of the three test files against the format 2 baseline (`census-5MbbbV`) reads the six stretches of the two unedited sources as ran,
and loads the edited `required-providers.ts` with no stretch left
(`4138c5ade`).

The seventh batch closed `run-config.ts` with X23.
Its baseline stretches were the checker-independence call's fallbacks for the run's refiners and self-certification,
which `RUN_MODELS` always sets
(it is now typed `RunRepairModels`,
the contract with both required,
and the fallbacks are gone);
the stand-in caller for an absent provider,
removed as unreachable;
the exhausted meter answered when the first provider has no key;
the Bedrock and OpenRouter arms and the decisions client no case had built without the suite's keys;
and the payload store.
New cases build on Hyper alone and read the exhausted meter,
build on all four stand-in keys and read Bedrock wet under its credit and dry at none,
refuse a seat whose only provider has no key without asking anyone,
and replay a prompt from a payload directory in a second client without asking.
A fresh format 2 census of `run-config.unit.test.ts` and `provider-router.unit.test.ts` (`census-IHg9So`) loads `run-config.ts` and `run-providers.ts` with no stretch left;
`provider-router.ts` keeps the baseline's lines 506 to 509 (now 542 to 545),
left to the batch of anonymous callbacks and library stretches,
beside lines the router's other test files run.

The eighth batch closed `ordinal-style.ts`,
whose fifteen baseline stretches the series pass's fixtures had left:
the arabic and roman forms read and rendered,
a prefix with no number word,
the "No." leader,
digits past the word tables,
the no-number style rendering nothing,
and the Han numeral's refusals of a second ten,
a second digit in one place and a character that is no numeral.
It had no test file of its own;
`ordinal-style.unit.test.ts` drives each directly,
and reads back every style it renders for every number a series carries.
Writing it showed the roman reading took any word of roman letters as a numeral,
so a capitalised "DID" or a malformed "IIII" before a colon read as a number
that a series re-rendered in another style would have replaced;
it now takes only the numeral `roman` writes for a number from one to ninety-nine.
No stored page carries either
(`t8-roman-headings.mjs` in the audit's scratch folder read 894 headings on 23 published pages and 251 on 92 archive pages,
and its positive control file found one of each kind).
A fresh format 2 census of the new test file (`census-c3xfXm`) loads the edited `ordinal-style.ts` with no stretch left
(`08eb4cba0`).
The mutant restoring the letters-only reading failed the roman refusal case alone,
at "Mittens DID" read as roman.
With it the corpus-run named functions no test called are done.

`PageAssemblyRoundError` (the baseline's `page-assembly-rounds.ts` lines 37 and 46 to 59,
and the throw at 308 to 311) was decided rather than tested.
The page-assembly rounds threw it when a round took back a slice an earlier round had taken back.
A round's lane rows exclude every slice taken back before,
so only a pass-made row can bring one back,
and two passes do write rows on every slice the page carries
(`canadianizePage`,
`correctPinyinPage`);
the guard takes back every row when a structural break has no single culprit,
so such a row can be taken back again.
No fixture or stored run is known to reach it.
Were one to,
the throw stopped the entry's page,
against the owner's rule that a run always ships,
and without it the rounds would make and lose the same row forever.
The rounds now settle on a round that takes back nothing new:
each further round must add a slice to those taken back,
so they still end,
and the page they settle on is consistent,
since the slice stays withdrawn and ships the archive's text
and `guardPageAssembly` writes no pass row the settling round's guard took back.
A quality call under the standing directive,
recorded for the owner to veto.
`freshlyTakenBack` carries the rule and `page-assembly-rounds.unit.test.ts` drives it:
a round's new take-backs each once,
none for a round that took back only what earlier rounds had,
and none for a round that took back nothing.
A fresh format 2 census of that file and `page-assembly-guard.unit.test.ts` (`census-gBeTc1`) loads `page-assembly-rounds.ts` with no stretch left;
`page-assembly-guard.ts` keeps its baseline lines 114 to 116,
`namesIt`,
which needs a pass-restored row and a guard-trimmed row on one page,
for the batch of anonymous callbacks and library stretches
(`1891634ee`).
The mutant whose filter in `freshlyTakenBack` keeps every slice failed the first two cases;
the third,
a round that took nothing back,
reads the same under both.

The whole-suite census at `73c702e24` (1,397 passes,
`census-K2JBPw`,
format 2) is the baseline for the anonymous callbacks and the library stretches still cold:
library source holds 1,142 stretches over 2,910 lines in 429 files,
with 35 functions never called;
the six runner entry files tests load hold 27 stretches over 799 lines,
with 14 never called;
the 36 bundles no test loads carry 13,462 physical lines in 39 sources;
other workspace packages hold 228 stretches over 4,234 lines in 60 files.
Batches from here read their reach against it,
and the readings earlier batches took against `census-qilSwP` stand.

B30 and B31 then removed or moved the code only tests reached,
B32 the imports nothing read,
and the whole-suite census at `6e631988b` (1,387 passes,
`census-wNMuym`) is the baseline from there:
library source holds 1,104 stretches over 2,799 lines in 423 files,
with 29 functions never called;
the runner entry files hold 27 stretches over 799 lines,
with 14 never called;
the 36 bundles no test loads carry 13,603 physical lines in 40 sources;
other workspace packages hold 230 stretches over 4,278 lines in 61 files.
Its first attempt refused before any test ran:
the build's `index.mjs` had no source map,
since it holds only import and export statements now that the seats inlined into it left the build (B31),
and the census refused any bundle without a map,
without naming it.
`6e631988b` reads a map only where the census places code in a bundle
(`coverage-bundle-maps.ts`,
with its refusals named and tested)
and moves the tally's placement out of the entry at its line budget
(`coverage-census-place.ts`),
which this census lists among the library sources only unloaded bundles carry,
so a test of it is part of the library batches.

The first batch against `census-wNMuym` tests that placement (`5e27208c7`).
`coverage-census-place.unit.test.ts` builds a disposable package with bundles,
maps,
sources and a coverage file,
and drives `placeTally` through `tallyCoverage` and `bundleMapsOf`:
a cold block and an uncalled function placed on their source lines,
the sources loaded and unloaded bundles carry,
a bundle holding only import and export statements read for nothing,
and each of the three refusals by name.
A format 2 census of the test file (`census-qGKHBE`) left one stretch,
lines 212 to 213:
the `?? []` for an unloaded bundle with no reading.
`requireMapFor` refuses every unloaded bundle with no map before that line,
so the fallback never ran;
the unloaded sources now come from the mapped readings of bundles no process loaded,
as the loaded sources do,
and a second census (`census-4rpchd`) loads the file with no stretch left.
Both censuses ran at `e96946582` with the batch uncommitted.

That batch's baseline reading printed `ran 0, still cold 0, not loaded 0`,
which reads as nothing left to do:
`census-wNMuym` never loaded the placement file,
so it holds no stretch there,
and the reading counted only the baseline's stretches.
A claimed source with no baseline stretch proves nothing through those counts,
whether the baseline ran it whole,
never loaded it,
or names no such path.
`297c72fd5` reads the baseline's loaded sources too,
counts each such claimed source in the reading's first line,
and names it with both censuses' standing.
For a source the baseline never loaded,
the proof is this run's own rows:
loaded,
with no cold stretch left.
Its census against `census-wNMuym` (`census-mHL50b`) printed the placement file as not loaded there
and `coverage-census-report.ts` as ran whole there,
each with no cold stretch now.
`76a9e39ca` records in `bundleMapsOf`'s TSDoc that a bundle with no map holding code no test ran is now refused after the suite,
at the cost of one suite run,
and why that is rare:
the coverage build cleans its directory before it writes.

The triage of the queue
(`t8-triage.mjs` in the audit's scratch folder,
reading `census-wNMuym`'s library stretches against the source at `76a9e39ca`,
where only the census files moved lines since the baseline)
classes each stretch by the first construct its lines hold,
in the order throw,
catch,
nullish fallback,
optional chain,
ternary,
function or callback,
loop,
return,
branch.
Of the 1,104 stretches in 423 files,
181 hold a throw,
7 a catch,
222 a nullish fallback,
2 an optional chain,
276 a ternary,
32 a function or callback,
4 a loop,
296 a return,
43 a branch,
and 41 none of these.
The largest clusters by file stem are the corpus-run artifact files (78 stretches in 27 files),
translate (70 in 28)
and repair (46 in 17).
Each fallback and throw is read for reachability before a case is written:
an unreachable one is removed and recorded under B21's silent fallbacks,
a reachable one gets a case.
Batches go by shared fixture rather than by file,
one census per batch with all its test files,
and prove reach from the fresh census's rows for every claimed source,
with the baseline reading's named claims for sources the baseline holds no stretch in.

The second batch (`a564eccc7`) took the absolute naturalness review readers
(`artifact-two-lane-read-naturalness-review.ts`,
`-round`,
`-seat`,
`-digest`
and `-confirmation`),
24 stretches:
18 refusals of a malformed stored review,
and 6 guards and fallbacks in four functions that no stored review reaches,
removed (the fallbacks are listed under B29).
Its test's refusal cases had checked only that something threw,
so a case refused by another check passed;
each now checks the path and reason its message carries,
and a copy with one reason changed failed on that case.
The third batch (`09b76e1b4`) took the polish and polish gate readers,
12 stretches,
all reachable,
and tightened that test's refusals the same way.
Each batch's census of its own test file
(`census-0C66lF`,
`census-e9z8Pk`)
read every claimed stretch as run
and left no stretch in its readers,
and the whole suite at `a564eccc7` printed 1,389 PASS lines and no FAIL line.
Many older tests check a refusal by its class or by throwing at all,
so each batch reads its test's refusal cases and makes each name the check it means.

The fourth batch (`74387b886`) took the contest verdict,
contest,
lanes,
row relations,
comparison,
consolidation
and consolidated slice readers,
11 stretches.
All were reachable but two lookups following a check that two lists hold the same number of rows,
now narrowed with `nonNullishOrThrow`.
Reading every consolidation refusal whole found five reasons that read wrong after "expected",
two of them saying the opposite of what the reader wants (B33).
Its census of six test files (`census-7fz0Nm`) read the 11 claimed stretches as run and none still cold.
The whole-artifact and consolidated-parts tests still checked many refusals by a fragment of path or reason;
`1e813a44b` made all 42 whole-message checks,
after a probe printed each fragment beside its message,
and a copy of each test with one expected message changed failed on that case.

B34 (`7360aae58`,
`a1e4accbd`) came next,
since the tightening pass would have pinned messages it rewrote.
It removed the corpus verification's two lane checks,
which no artifact the reader accepts can fail,
narrowed `compareLanes`' and `assertDerivationsAgree`'s lookups after a length check with `nonNullishOrThrow`,
and gave `compareLanes`' archive-wording refusal its first case.
Its census of eight test files (`census-9ZsGww`) printed no stretch in the comparison,
comparison fault,
comparison reader
and corpus verification sources.
The same census printed stretches in the pipeline digest
(three lines of the foreign-entry refusal:
two ternaries and a fallback),
the wording coherence rule
(two refusals no case in that run reached),
row equality
(`decisionsEqual`'s last return)
and the preparation identity's framing,
which the next batch reads against a whole-suite census.
Its baseline reading printed "ran 13" over those sources,
and some of the 13 had only moved:
the reading compares line numbers,
and B34 had edited the digest,
identity
and wording coherence modules,
so their stretches at the baseline's lines now point at other code.
`baselineStatusesOf`'s TSDoc said an edited source is read against a fresh census instead,
and the printed reading said nothing of it.
Fixed in `d27a89dd0`
(red first in `4ab6436bf`):
the reading asks git which claimed sources differ between the baseline's commit and the tree
(`sourcesEditedSince`),
leaves them out of every count,
and prints each with this run's own standing,
"edited since <commit>,
so its baseline lines name other code";
a baseline taken with uncommitted changes is refused,
since its lines match no commit.
Each earlier batch's claim was read again against its own census's rows,
which no line match touches:
the naturalness readers in `census-0C66lF`,
the polish readers in `census-e9z8Pk`
and the fourth batch's ten readers in `census-7fz0Nm` hold no stretch,
except the consolidated slice reader's lines 195 and 254 to 264 in the last,
which that batch's six test files never reach and the whole suite at the baseline did;
its one baseline stretch,
lines 77 to 80,
read as run,
and no commit has touched that file since the baseline.
