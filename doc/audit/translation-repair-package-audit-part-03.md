# Translation-repair package audit, part 03

Part 03 of [Translation-repair package audit](translation-repair-package-audit.md),
whose index lists every part in order.

## Findings register, continued

### probes-5, MAJOR, verified: the recall scorecard is overwritten in place, non-atomically

`src/corpus-run/recall-benchmark.ts:332-335`:
plain `writeFile` to the fixed name `recall-scorecard.json`.
`src/corpus-run/probe-store.ts` states the repo's own rule for repeated measurements (stamped names,
atomic writes);
a twelve-hour run replaces the previous one with no trace.
Tracked as `#250`.

FIXED 2026-08-26 in `2c9886a55`:
`persistRecallScorecard` (`src/corpus-run/recall-scorecard-store.ts`) writes
`recall-scorecard/<start stamp>-<tip>.json` through `writeFileAtomic`,
the benchmark stamps its start and records
`startedAt` and `finishedAt`,
and the `SCORECARD kept at <path>` line names the file.
Guards:
two runs keep both files with their own rows,
two builds started in the same instant keep two files,
the
name carries no colon;
collapsing the name to the old fixed one or dropping the tip fails all 4 cases.
Plan mode (`-- --plan`) still constructs the client and writes nothing.
The old `recall-scorecard.json` files on disk are left where they are;
nothing reads them programmatically.

### probes-6 to probes-13, MINOR, verified where cited

The derivability sheet's fixed `=====` fence (`src/derivability-wire.ts:22`;
zero collisions in the
pinned corpus,
measured by the reviewer with `git grep --count`);
stale six-model roster prose in
`src/corpus-run/judge-independence.ts:7-11` and the NOTE pasted into verdicts by
`src/corpus-run/score-crosscheck.ts:363-366`;
per-region tallies counting checks rather than probers
(`src/introduced-defect-screen.ts:504-513`);
damage sheet and manifest written with plain
`writeFile` to fixed names (`damage-sample.ts:347-365`,
`probe-verify.ts:210-219`);
the relabel
control stamping `baseIndex: index` (`probe-relabel-control.ts:234`);
`coverage-probe` and
`judge-fidelity-probe` printing rows that carry corpus-derived text to stdout by design
(`coverage-probe.ts:463-467`,
`judge-fidelity-probe.ts:501`);
caught error text persisted into bench
rows (`bench-record.ts:289-290`,
`benchmark.ts:415-424`);
`writeBenchReport` named by no test.
Full text in `~/temp/agent/audit-probes.md`.

FIXED 2026-08-26 in `ebc53f24f` (probes-6 landed with repair-5 in `9135037e8`).
probes-7:
the judge-independence note and the crosscheck's printed NOTE describe the whole-roster panel,
six from one
provider when written and ten across two since 2026-08-24,
with the shape (no seat outside the panel to bar) as the
point;
prose only.
probes-8:
the screen counts one check per prober per region,
the first with a known verdict,
and counts a prober that
cast nothing on the region as uncertain;
a prober whose only check carried an unknown verdict stays dropped,
which the
existing schema-noise case pins.
Guard:
the collapse undone fails `COUNTS a prober once on a region however many checks it cast there`;
restored,
passes.
probes-9:
`sheet-write.ts` lands a sheet and its manifest atomically and refuses,
as a stated refusal naming the path,
to write into a directory already holding either;
`damage-sample` and `probe-verify` write through it.
Guard:
the refusal removed fails `REFUSES to write into a directory already holding the sheet`;
restored,
passes.
probes-10:
the relabel control's slices are stamped from the finished order through `reindexSlicePair` and checked by
`assertSliceIndexing`,
the path `probe-relabel-case.ts` already took.
No guard:
`gatherControlCases` walks the corpus;
the stamping rule's own suite covers the helper.
probes-11:
the README names `coverage-probe` and `judge-fidelity-probe` as the two outputs that quote corpus text,
and
the fidelity probe keeps its rows through `persistProbeRun` before printing them.
No unit guard:
command-level.
probes-12:
bench rows carry `refusalText` instead of `String(error)`,
in both recorders,
and the per-call deadline's
reason is `CallTimeoutError`,
marked,
so a hung call still reads as a timeout in a row.
Guard:
the marker removed fails the two inventory cases;
restored,
passes.
The benchmark suite's hung-call case pins
the timeout wording through the marked message.
probes-13:
`writeBenchReport` has a suite on a disposable runs directory.
Guard:
the file name changed fails `LANDS roster-bench/rows.json under the runs directory`;
restored,
passes.
The fidelity probe's argument reader and its constants moved to `judge-fidelity-args.ts`,
since the probe crossed the
file-length cap with the persistence added.

### consolidate-1, MAJOR, verified: a slice with no standing text buys a producer round it then discards

`src/consolidate-driver.ts:333-338` computes `standingText`,
which `standingTextFor`
(`src/consolidate-standing.ts:40-44`) answers as `''` for a `settled-neither` or `quorum-not-met`
contest;
`settleFresh` then builds the producer input (`:378-405`) and calls `produceConsolidations`
unconditionally,
and `settleConsolidation`'s first exit (`src/consolidate-settle.ts:407-412`) refuses
with `no-standing-text` before judging anything.
One roster of producer calls plus up to one roster of repair calls per deadlocked slice,
with no
possible effect on output;
on a night the contest loses quorum,
every contested slice pays it.
Whether such a slice should instead be judged against both lane renderings is a design question the
reviewer raised separately;
the spend is a defect regardless.
Tracked as `#251`.

FIXED 2026-08-26 in `a8bc69508`:
`settleFresh` in `src/consolidate-driver.ts` hands the settle half an empty slate
when the standing text is empty and asks no producer,
so the `no-standing-text` terminal,
its floor and its
findings still come from `settleConsolidation` and the settlement still resumes.
Guard:
a `settled-neither` and a `quorum-not-met` contest each settle to `no-standing-text` under the driver
test's refusing client,
which throws on any call;
restoring the purchase fails 2 cases with that throw.
The design question (judge such a slice against both lane renderings instead) stays open and is not decided here.

### consolidate-2 to consolidate-10, MINOR, verified where cited

Bare `Error` for operator refusals in `src/grade-agreement.ts:170-184,266-269`;
the agreement guard
checks count but not index presence (`:238-268`);
sheet items indexed by position,
not by printed
number (`src/grade-sheet-read.ts:252-265`);
the scorecard prints 0 for an empty denominator
(`src/scorecard.ts:397-399,447-452`);
an internal invariant thrown as bare `Error`
(`src/consolidate-driver.ts:322-326`);
`describeAbandon` falling back to `String(error)` into a warn
line (`src/abandon-kind.ts:76-77`);
four prose drifts;
`consolidate-produce.ts` and `tally-claim.ts`
reached only through callers;
a gate ballot lost whole when one list field is not an array
(`src/consolidate-gate-wire.ts:132-146`).
The reviewer also answered calibrate's open question:
`candidate-select.ts:159` sets `judges` to the
SEATED roster,
so a half-dark panel is correctly excluded by the window trial's full-panel filter.
Open question it raised for the main session:
the consolidation gate's bar is absolute
(`CONSOLIDATE_GATE_QUORUM = 2`,
`HEARD_NEEDED = 2`),
so two of ten ballots against one can replace a
memorial page's wording and be cached as settled;
whether that bar is intended is recorded here,
undecided.

FIXED 2026-08-26 in `f83e9b449`,
with the guards in `c27dfa297`.
consolidate-2:
the pre-grade parser and the agreement guard refuse as `StatedRefusalError`,
naming positions and
counts;
the unknown verdict is no longer quoted,
since the rule that keeps text out of a refusal goes by class.
consolidate-3:
the agreement guard refuses a pre-grade file that misses any sheet position,
count aside.
consolidate-4:
the sheet reader parses the printed item number and refuses when it disagrees with the position.
Guards:
the presence loop removed fails `REFUSES a pre-grade file that misses a sheet position`;
the heading check
disabled fails `REFUSES a sheet whose printed item number disagrees with its position`;
a non-array pre-grades file
is refused as a stated refusal (case added);
each restored,
passes.
consolidate-5:
`recall-benchmark` refuses,
after keeping its record,
to print rates over no dispatched entries or no
planted seeds,
so a zero denominator never prints as a zero rate;
the scorecard's fields are unchanged.
No unit guard
(command-level);
the refusal names both counts and the kept path.
consolidate-6:
the contested-slice invariant is `ConsolidationLedgerGapError`,
marked and in the inventory.
Guard:
the marker removed fails the two inventory cases;
restored,
passes.
consolidate-7:
`describeAbandon` names an unfamiliar class through `refusalText` instead of rendering its text.
Guard:
`String(error)` restored fails `NAMES THE CLASS of anything it does not recognise`;
restored,
passes.
consolidate-8:
the driver's TSDoc says the producers are asked at every slice the contest was asked about,
the
selection header lists total resolution in the order `compareCandidates` reads,
`consolidateSliceKey` documents both
neighbouring texts,
and `quoteLine` and `renderCandidate` carry examples.
Prose only.
consolidate-9:
`consolidate-produce.unit.test.ts` drives the producing half on its own with a scripted transport:
a proposal refused for shape is sent back to its author and both verdicts are reported,
a valid slate asks nothing
more and reports the same verdict twice,
and the repair's findings follow the gather's.
Guard:
the repair round bypassed fails `SENDS a proposal refused for shape back to its author`;
restored,
passes.
consolidate-10:
a gate ballot whose `unsupported` or `dropped` is not a list keeps its choice and reads the field as
empty;
the wire type carries the fields as `unknown` and the reader narrows.
Guard:
the list checks restored in the guard fail `KEEPS the choice and reads the field as an empty list`;
restored,
passes.
The open question the reviewer raised (whether the gate's absolute bar of two ballots is intended) stays recorded above
and undecided;
it is a design question,
not a defect this pass lands.

### document-1, MAJOR, verified: any corpus read failure silently drops the entry from a pass

`src/corpus-run/corpus-pass.ts:392-396` continues past any `CorpusReadError`,
and `src/corpus-source.ts:239-243` wraps every `execFile` rejection as one,
with no kind field:
a non-zero git exit,
a spawn failure,
and a `maxBuffer` overflow all read as the expected missing side.
No line is written on either side,
so the entry is absent from `pending=` and nothing says why;
a resumed pass then ranks bands over a shrunken `settled`.
No corpus-pass test references `CorpusReadError`.
Tracked as `#252`.

FIXED 2026-08-26 in `8af2b2bde`:
`CorpusReadError.kind` is read off git's stderr,
measured against git 2.55
(a path absent at the commit says `does not exist in` and is `missing-object`;
an unreadable clone,
a spawn failure,
an oversized blob or a failed listing is `other`),
`isMissingCorpusObject` is the one guard a corpus walk may step
past,
and all five catchers use it (the pass,
the recall benchmark,
the picture gatherer,
the window trial probe,
the slice census).
The pass's walk lives in `src/corpus-run/pass-eligibility.ts`,
names each incomplete entry by id and absent side,
and the pass prints one `INCOMPLETE <id>: <side> page absent at the pin (...)` line per entry.
Guards:
the corpus-source tests assert the kind on a missing path,
a missing clone and a failed listing;
the
eligibility tests sort a throwaway clone into a pair,
a settled size and a named gap,
name a missing original as
the source side,
and propagate an unreadable clone.
Collapsing the classifier fails 2 and 3 cases;
re-widening the walk's catch fails 2.

### document-2, MAJOR, verified: a transient reader failure is cached as a permanent `unavailable` verdict

`src/document-readings.ts:166-183` persists every paired reading whatever its kind;
`src/image-reading-pair.ts:380-388` records a reader that threw as `reader-failed` and counts it absent,
and `:432-440` turns fewer than two readings into an `unavailable` pair verdict.
On resume `:150-158` serves that verdict from the cache with only `resumed, unavailable` in the log,
until the generation marker retires the cache on a rebuild,
never on the provider's recovery.
That is provider trouble degrading the pipeline durably,
which the owner's standing rule forbids.
Tracked as `#253`.

FIXED 2026-08-26 in `17bcaf46c`:
an `unavailable` pair verdict carries `transient`,
true when any reader produced
nothing for a reason that may not hold tomorrow (`reader-failed`,
`empty-reply`,
`too-short`,
`reads-as-refusal`),
false for a disagreement or a roster that cannot read the picture;
`readDocumentPictures` persists only resumable
verdicts (`isResumableReading`),
and `openPictureReadingCache` refuses a transient record and any record written
before the field,
so the one reader failure that left a picture unread is read once more.
Guards:
a throwing reader marks the verdict transient and unresumable,
a disagreement stays stable,
the document
reader persists nothing under a failing client and one record under a disagreeing one,
and the cache refuses the
transient and the older-shape records.
Flattening the mark fails 3 and 2 cases,
dropping the persist guard fails 2,
re-admitting transient records fails 3.

### document-3, MAJOR, verified: a CRLF original silently disables the line-structure family

`src/line-structure.ts:57-66` splits blocks on `\n\n`,
which a CRLF document never contains,
so every slice counts as one block,
fails `MIN_BLOCKS`,
and `isLineStructured` answers false:
no editor addendum,
no inheritance,
no line-count guard.
`src/markdown-blocks.ts:11-16` already measured the population:
one of 184 files at the pin,
`people/gqt/page.md`,
the source side,
which is the side the predicate reads.
`src/mask-invisible-lines.ts:260` splits on `\n` alone,
so an invisible line on that page keeps its `\r` and is never masked;
`src/quote-normalize.ts:205-212` treats `\r\n` as two breaks,
so every wrapped critic quote there is refused (document-4).
Tracked as `#254`.

FIXED 2026-08-26 in `7a2a21ed8`:
`readCorpusFile` folds every CRLF to LF through `foldCarriageReturns`
(`src/line-endings.ts`,
which counts what it folded),
`isLineStructured` folds again for callers that read text by
other means,
and the invisible-line mask judges each line without its carriage return and blanks around it,
keeping
the return and the length.
Measured on the page at the pin:
141 endings folded,
1 block before the fold and 45 after;
the page is prose,
so the
predicate answers false for the right reason now,
and it carries no invisible-only line.
Document-4 no longer meets corpus text,
since the quote normalizer sees LF;
its two-break reading of a literal CRLF
stands for text read by other means and is recorded here rather than changed,
because a length-preserving
normalizer cannot collapse a two-unit ending to one space without an offset map.
Guards:
the fold counts and shrinks by exactly the count and leaves LF and a lone return alone;
a CRLF page reads
back LF;
CRLF verse is line-structured;
a CRLF invisible line is blanked with its return kept and the region
covering the mark alone.
Undoing the read fold,
the splitter fold,
or the mask's body judgement fails 2 cases each.

### document-5 to document-12, MINOR, verified where cited

The unread-signals doc describes a `mirrored` flag and a proportional fallback that `chunk-document.ts:425-444`
no longer has (`equalShape` now,
and the fallback is deleted);
`entry-filter.ts:58,79` throws operator mistakes as bare `Error`;
`image-reading-past-refusal.ts:76` justifies `REFUSAL_ASK_LIMIT` with the projection its own module note refutes;
`locate-quote.ts:151,171,253` writes up to 60 characters of a critic's quote into a `quote-not-found` finding
(corpus text in logs,
no decision recorded);
`readingAnchors`,
`sharedAnchorCount`,
and `quotedTranscript` have no production caller;
per-character accumulator rebuilds in `footnote-graph.ts:106,190`,
`image-reading-sense.ts:180,187`,
`reading-refusal.ts:156`,
and `protected-atom.ts:259-273` (`RG2`,
linear in practice);
bare `Error` for the footnote overflow refusal and several unreachable states,
one defaulted with `?? ''`;
`image-ocr.ts:261,275` discards both decoder errors with `void error` (`LG2`),
and `MIN_OCR_CHARS` is a literal copy of `MIN_READING_CHARS`.

FIXED 2026-08-26 in `8ac0fff65`,
with the tightened entry-filter guard in `b19bd23b0`.
document-5:
`doc/troubleshooting/translation-repair-unread-signals.md` names `equalShape` and `alignHeadingsForced`
and describes the proportional fallback as deleted.
Prose only.
document-6:
both `--only` refusals are `StatedRefusalError`;
the suite's three THROWS cases assert the class.
Guard:
both throws reverted to bare `Error` fail all three THROWS cases;
restored,
passes.
document-7:
`REFUSAL_ASK_LIMIT` is justified by the `#124` measurement (20 extra calls against 119 first asks,
one
recovery on the third ask);
the refuted projection is gone.
Prose only.
document-8:
`needlePreview` reports the flattened needle's length and Latin token count and never its text,
so a
`quote-not-found` finding carries shape only;
the decision is recorded in the module note.
Guard:
text quoting restored fails five locate-quote cases,
among them `COUNTS a paragraph-length needle rather than
quoting any of it`;
restored,
passes.
document-9:
`readingAnchors`,
`sharedAnchorCount`,
`quotedTranscript` and their constants are deleted with their
describes and barrel exports;
`MIN_READING_CHARS` stays,
exported.
Deletion;
no guard applies.
document-10:
`footnote-graph.ts` collects digit parts into a list joined once and slices the GFM identifier from its
start;
`reading-refusal.ts` builds each word in a list closed by `closeWord()`;
`protected-atom.ts` walks with a
cursor and a run start and slices each atom once.
Each is one linear pass with no accumulator rebuild.
Guards:
the identifier start shifted by one fails two footnote-graph cases;
the closing `closeWord()` dropped fails
two reading-refusal cases (`` ACCEPTS `note` AS ITS OWN WORD `` among them);
the atom slice shortened by one fails four
inspect-paragraph cases;
each restored,
passes.
document-11:
the overflow refusal is `FootnoteOverflowError`,
marked and in the inventory;
`chunk-insertion.ts`
reads the source chunk through `nonNullishOrThrow` instead of defaulting to `''`.
Guard:
the marker removed fails the two inventory cases (`KEEPS exactly the classes the inventory records` among
them);
restored,
passes.
The `nonNullishOrThrow` change has no guard:
the defaulted branch was unreachable.
document-12:
`decodeToPng` logs each decoder's refusal through `refusalText` at debug,
and `image-ocr.ts` imports
`MIN_READING_CHARS` instead of copying it.
Logging;
no guard.

### slices-1, MAJOR, verified: the slice-cache store cannot refuse a silence-settled record

Folded into `#238` as its store side:
`src/corpus-run/slice-cache-store.ts:48-66` and `:423-427` are shape-only guards ending in `Array.isArray(...)`,
no guard reads `heardCriticIds.length` or a `stage-quorum-unmet` finding,
and the artifact reviewer confirmed the owned artifact shape carries no per-stage heard count either,
so the slice caches are the only place that decision lives.
Contrast `lane-contest-driver.ts:56-60`,
whose `worthResuming` persists only quorum-met outcomes.

### slices-2, MAJOR, verified: the contest-ledger readers are blind to the ordinal collision

Folded into `#246` as its reader side:
`ledger-directory.ts:177-185` sorts by file name and asserts that is contest order,
`ledger-read.ts:365` reports the file count as the contest count,
and `ledger-parse.ts:494-498` reads the `at` stamp that no reader compares.

### slices-3, MAJOR, verified at the call shape: the slice census carves with the abandoned pairer

Folded into `#249`:
`slice-census-entry.ts:159-162` aligns with `alignDocumentSections` and `:225-232` subdivides with no `blockPairing`,
so the `CENSUS` lines size a translate lane over slices the pass no longer produces.

FIXED 2026-08-26 in `459482191`:
`censusEntry` takes the settled recipe,
feeds the section pairing to alignment and
each section's block pairing to subdivision,
and labels every row `settled-complete`,
`settled-partial` or
`deterministic`;
the driver reads each entry's recipe from the runs directory and opens with a `CENSUS carve:` line
naming how many rows are which,
legacy artifacts counted apart.
Guards:
a recipe that unpairs the middle section moves the unpaired counts,
and one that declines the middle block
shrinks the sliced translation characters;
dropping either spread fails 2 cases.
Measured:
92 complete pairs,
6 settled-partial rows against the 2026-08-17 runs directory and 86 baseline.

### slices-4 to slices-9, MINOR, verified where cited

Raw `console.log` in `slice-cache-namespace.ts:553-556`;
the proportional merge loop at `slice-pair.ts:360-471` is unreachable while its TSDoc calls it the live fallback;
nine index-and-count error classes across the delivery,
coverage,
comparison,
and assembly modules lack
`messageNamesOnly`,
so the boundary prints only their names;
the repetition containment rule (`assembly-repetition.ts:420-422`,
`assembly-adjacent-repetition.ts:289-294`)
compares space-joined strings with `includes`,
so a phrase inside a longer span across word boundaries is dropped;
`SpanAnchor` names two declarations and the explicit `index.ts:37` export shadows the rendering-audit one;
`draw-entry-load.ts:162-189` throws its three reconcile refusals as bare `Error`,
muting the counts they carry.

FIXED 2026-08-26 in `c2d2473db` (slices-4,
5,
7,
8,
9),
`9f0145fcb` and `95882d3fe` (slices-6).
slices-4:
`discardNamespace` announces through `tagged({ tag: discardNamespace.name, l })`,
same wording.
Guard:
`console.log` restored fails `COUNTS what it removed and NAMES who filled it`,
which asserts the
`[discardNamespace]` tag;
restored,
passes.
slices-5:
the proportional merge loop and `totalRunChars` are deleted,
the target runs with them,
and the TSDoc names
the three live shapes:
aligned when both sides carry blocks,
one slice per source run at the insertion boundary,
one
re-indexed slice otherwise.
Deletion;
`slice-pair` passes unchanged and `lint:types` is the guard.
slices-6:
the nine classes forward no message.
`SliceRecordContradictionError` takes `{ lane, sliceIndex, changed }`;
the other eight take a fault union (`SliceIndexingFault`,
`SliceCoverageFault` with `BlockPlacementFault`,
`DeliveryInvariantFault`,
`DeliveryCoherenceFault`,
`LaneComparisonFault`,
`LaneSliceCoverageFault`,
`AssemblyContractFault`,
`SliceDeliveryFault`) and word it through a sentence function in their own module
(`lane-comparison-fault.ts`,
`assembly-contract-fault.ts`,
`slice-delivery-fault.ts` are new siblings;
the rest sit
beside the class).
All nine are marked and in the inventory,
so the boundary and the `TALLY` line print the slice and
the counts.
Block ids in a coverage fault are the parser's positional `block/N` tokens,
recorded on the type.
The
named slice sets carry a closed `NamedSliceSetLabel` and their clauses live beside the sentence,
so no caller string
reaches a message.
The reviewer's fix shape (add the marker) was not available:
the inventory refuses a marked class
that forwards its message,
`StatedRefusalError` being the sole exception.
`slice-delivery.ts` split into
`slice-delivery-decide.ts` and the fault module,
and the lane exports moved to `lane-barrel.ts`,
both for the
file-length limit.
Each of the nine suites gained a `WORDS its refusal` case pinning the sentence and the marker.
Guards,
part one:
the marker removed from `SliceCoverageError` fails three inventory cases;
a word dropped from
`indexingSentence`,
the two phrases swapped in the record class,
and the separator changed in
`deliveryInvariantSentence` each fail their suite's `WORDS` case.
Part two:
the marker removed from
`SliceDeliveryError` fails three inventory cases;
a word dropped from `coherenceSentence` fails `WORDS` and `REFUSES a
gap that carries wording anyway`;
the clause dropped from `comparisonSentence`,
the wrong clause looked up in
`laneCoverageSentence`,
and the two numbers swapped in `assemblySentence` each fail their suite's `WORDS` case;
all
restored,
all suites pass.
slices-7:
`holdsPhrase` pads both phrases with spaces before the substring test,
in both the document and the
adjacent check.
Guard:
plain `includes` restored fails `KEEPS a phrase that is a character substring of a longer finding across a word
boundary` and `KEEPS wording that is a character substring of longer shared wording across a word boundary`;
restored,
passes.
slices-8:
the rendering-audit type is `RenderingAuditSpanAnchor`;
the root barrel exports one `SpanAnchor`.
Rename;
`lint:types` is the guard.
slices-9:
`DrawReconcileError` (`corpus-run/draw-reconcile.ts`),
marked,
names the entry (deliberately,
as the pass's
`INCOMPLETE` lines do) and the counts,
and carries the stray value's `typeof` name in place of its `JSON.stringify`.
Guard:
the marker removed fails the two inventory cases;
a bare `Error` restored fails `REFUSES as
DrawReconcileError`;
restored,
passes.

### artifact-1 and artifact-2, MAJOR, verified: both comparison checks embed whole rows in their messages

Folded into `#237`:
`artifact-two-lane-read-comparison.ts:150-154` puts `JSON.stringify(row)` (archive English and both lanes' text)
into an `ArtifactParseError`,
a class marked `messageNamesOnly` at `artifact-guard.ts:26`,
so `refusalText` forwards the row verbatim at every CLI that reads a settled artifact;
`artifact-two-lane-comparison.ts:330-335` puts both rows into the unmarked `ArtifactComparisonError`,
which the pass's TALLY and CLEANUP lines print 200 characters of.
The trigger is a stored row disagreeing with the frozen rules,
which is exactly what the guards exist to catch.

FIXED 2026-08-26 in `c19d203c6`:
both checks name the differing fields through `comparisonRowDifferences`
(`comparisonRowsEqual` derives from it) and never a row;
the read test asserts the message names `laneRelation`
and carries no `"repairText"`;
guard fails with `laneRelation` dropped from the checks (2 failing lines per suite).

### artifact-7, MAJOR, verified structurally: the round-three instruments cannot read their own draw

`probe-relabel-artifact.ts:362-383` reads through `repairLaneRecordsOf` (`artifact-repair-lane-records.ts:83-121`),
which calls `parseSettledTwoLaneArtifact` directly and refuses any artifact without a numeric schema version;
the reviewer measured,
with structural output only,
that all 17 round-three entries are unversioned legacy
artifacts that `readSettledArtifact` reads as `kind: 'legacy'`.
Loud,
not silent:
exit 5 at the first item.
Tracked as `#257`,
to be decided with `#247` and `#249`.

FIXED 2026-08-26 in `f199b70cf` and `bab444350`:
`readArtifactRecords` dispatches on the generation through `readSettledArtifact`,
the lane for version 2 and the root for the legacy and version 1 generations,
with two cases pinning the legacy path.
`f199b70cf`'s message claimed both cases passed;
one was failing at commit time
(the legacy parser requires `repairDisposition` and `refined` once a record carries regions,
and the fixture lacked them),
which `bab444350` fixed and says so.
Guard shown to fail with the dispatch forced to the lane (both legacy cases refuse at `artifactSchemaVersion`),
restored,
passed.
Live run of `probe-relabel` against the round-three draw,
2026-08-26,
exit 0:
`RELABEL rebuilt 5 distinct damaged regions`,
`gathered 10 unflagged control regions`,
fifteen regions each under `issues-withheld`,
`issues-rendered`,
and `issues-absent`,
none under the old label,
three checker seats asked 45 and usable 45,
no dark seat.
Summed over the fifteen regions the arms raised `removal` 1 (withheld),
3 (rendered),
1 (absent)
and `corroborated` 0 each;
on real regions carrying six to seventeen prior issues the rendered prompt raised more,
not fewer,
removal claims,
the opposite of the cat fixture's direction,
which is a fact for `#68`'s successor to read,
not a verdict.
