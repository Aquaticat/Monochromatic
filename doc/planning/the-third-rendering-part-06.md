# The third rendering, part 06

Part 06 of [The third rendering](the-third-rendering.md),
whose index lists every part in order.

## The slate terminal now names three states, and a settlement keeps its findings

Landed 2026-08-22 across `0898c8d17`,
`8d3da278d` and `e2e8b1216`,
the first item of the coordinated schema change,
after `#170`'s two schema-free items landed as `0b64add7f`.

### The retired name is not reused

The earlier plan kept `slate-kept-standing` for the endorsed case,
on the reasoning that the surviving name would then mean what it says.
A census taken before writing any code overturned that.

Across every settled artifact on this machine,
47 scanned and 14 carrying a consolidation over 42 slices,
the terminal appears on 11 rows in `Acheron`,
`Zha_Ke`,
`gaoyanger` and `lintong`.
Every one of those rows carries the identical key set,
`chunkIndex`,
`demoted`,
`gate`,
`rewrapped`,
`shipped`,
`terminal` and `verdicts`,
with no record of the judged round.

So no legacy row can be told apart from any other.
Had the endorsed case kept the spelling,
a census over mixed artifacts could not have separated
a post-split endorsement from a pre-split row meaning one of three,
except by keying on which other fields a row happens to carry,
which is implicit versioning by another name.

All three states get new names,
and `slate-kept-standing` survives only in the artifact reader,
as `ArtifactConsolidationTerminal`,
whose docblock says what it cannot tell apart.
The 11 rows are not backfilled from logs or captures.
They are unrecoverable by construction,
and inference presented as data is worse than a named absence.

### Legacy tolerance is confined to the reader, and that was verified

Artifacts outlive pipeline digests.
Caches do not.

`openNamespacedCache` returns an empty resume map and discards the namespace
 whenever the generation stored beside it differs from the running digest,
and `openConsolidateCache` is handed the pipeline digest as that generation.
So no consolidate cache entry written before this change can ever be resumed,
which is why the producer union and the cache guard carry only the new names
while the reader carries the retired one as well.

### What the split confirmed on the first run

The test named `KEEPS THE STANDING TEXT WHEN EVERY JUDGE DECLINES`
has always described a declining panel,
and had always asserted the name a panel ENDORSING the archive would carry.
Under the split it settles as `slate-declined-standing`.

That is the defect the task predicted,
found in the repository's own test suite rather than in a run,
and it is the clearest evidence that one name for three states
was being read as the wrong one of the three.

### The decision read survives, against the plan to retire it

Splitting the terminal was expected to make
`consolidationWorthResuming` a pure terminal read.
It does not,
and the reason is worth recording so a later session does not retry it.

`slate-declined-standing` covers both the two declines a second panel might
 change and the settled `no-candidate-backed` recorded after that second panel
 has already run.
Those get opposite answers,
so the terminal alone cannot decide them.
The other four terminals now decide by name,
through `SETTLED_WITHOUT_A_GATE`,
and the persistence policy is unchanged in every case.

### A settlement carries its own findings

Folded in from the `#174` survey,
because it changes the same type
and doing it separately would rewrite that type and its reader twice.

`ConsolidationSettlement` carried no findings field,
so the produce half's findings reached a reader only where a judged round or a
 gate round happened to run.
The two terminals that end before either,
`no-standing-text` and `incumbent-only`,
dropped them on EVERY run rather than only on a resume.

Those are exactly the terminals whose findings explain them.
`produced.findings` is gather findings plus repair findings,
which is where voice loss and transport failure are recorded,
so the account of why a slate had nothing valid on it was being lost
at the terminal that reports a slate had nothing valid on it.

Per-proposal validity findings were never affected,
because `ProposalVerdict` carries its own,
so the loss was bounded to the produce half.
No lint signal existed,
because `producedFindings` is used on one branch
and so is not an unused parameter.

Three tests pin it.
Two show the loss,
and both fail against the code before this change,
where `settled.findings` reads `undefined`.
The third pins that a path reaching both rounds reports each finding ONCE,
which is the trap in fixing the first two:
the judged round is already handed the produce half's list,
so a settlement appending it again would report one lost voice twice.

## One key name stopped meaning two things

Landed 2026-08-22 as `0b64add7f` for the two schema-free items
and `6cf4ed287` for the artifact field,
completing the coordinated schema change begun by the terminal split.

### An alignment observation now names the numbering it counts in

`AlignmentFinding.pairIndex` was documented as not always a pair index,
and it was not.
A whole-document observation borrowed zero for a number it does not have,
and a refusal carried the index of the unpaired chunk on its OWN side,
whose numbering need not line up with the pairs a run produced.
All three rendered as `(pair N: ...)`,
beside a `target-unclaimed (pair N: ...)` carrying a real pair index.

The field is now `attachedTo`,
a union over the three numbering spaces,
so the whole-document case has no index at all rather than a borrowed zero.
A refusal now reads
`alignment structure-mismatch (source section 1: ...)`,
measured on live output before and after:
the same fixture rendered `(pair 1: ...)` under the previous code,
where the 1 was a source-side index.

Both blockers the task recorded against this rename were checked and refuted
 before it was made.
No scorecard renders the field,
and renaming a TypeScript field could not have changed any stored string,
because the template interpolates the value and writes the word itself.

### The comparison row's verdict is now a lane relation

`comparison[].verdict` and `laneSelection.slices[].verdict`
sat at sibling paths of one artifact under one bare key.
The first says WHICH LANES CHANGED a slice and names no winner.
The second says WHO WON,
which is the question about shipping.

Reading the wrong one neither throws nor surfaces as an absence:
taking the string form for the object form yields `undefined` for every row,
which reads as a uniform,
plausible answer.
The measured cost was a probe reporting 142 of 142 slices as audit subjects,
caught only because it printed a distribution as a control.

The comparison field becomes `laneRelation`.
The contest field keeps `verdict`,
because it is the one a reader asking about shipping wants.

### The reader takes either spelling, and that was verified on the archive

Refusing the retired key would have made every settled artifact unreadable
 to buy a name,
so the reader accepts either,
and refuses a row carrying both rather than resolving it.

VERIFIED AT THE BOUNDARY rather than by fixture.
Every settled artifact on this machine was parsed through the current reader:
47 files,
all 47 carrying a comparison,
271 rows,
and all 271 spelled under the retired key.
Zero rows were refused.

The relations read back as
138 `both-differ`,
56 `translate-only`,
36 `repair-only`,
36 `archive-stands`
and 5 `both-agree`,
which is the positive control the discipline this task recorded calls for:
a reader returning one bucket for every row would be the failure signature,
and this distribution is not that.

### What this batch did not touch

A third field spelled `verdict` sits at
`comparison[].decisionComparison.verdict`,
holding `same` or `different`.
It is nested rather than a sibling,
so a reader reaches it through a name that already says which question it
 answers,
and it was left alone deliberately rather than missed.

## The archive read was one level below the boundary it claimed

The rename check read `parseComparisonRowV2` per row.
That covers the comparison half and nothing else.
The terminal half of the same batch had only its declaration:
`slate-kept-standing` sat in the reader's allowed names with a comment saying
 the archive stays readable,
and no test anywhere carried the string,
because the split had moved every fixture onto the three new names.

`parseSettledArtifactV2` is the real boundary.
It runs `assertRecordedComparisonMatches` over the whole artifact and reads the
 consolidation beside it,
so it is the only entry point that exercises a retired terminal at all.
Reading all of it through that function reports
47 version 2 artifacts,
271 comparison rows,
271 of them under the retired relation spelling,
11 consolidation rows under the retired terminal across 9 artifact files
 spanning 4 entries,
and zero refusals.

The 11 rows and the 4 entries reconcile with the census this batch recorded
 earlier.
The distinct-slice count is smaller than 11,
because `vub-run1-20260821` keeps a second copy of its artifacts and one entry
 appears only in that copy.

### The probe reproduced the defect it was checking

The first run of that read reported zero legacy terminal rows while `rg` found
 the string in four files.
The probe asked for `artifact.consolidate.slices`.
The artifact writes `artifact.consolidation.slices`.
A wrong key on a JSON object returns `undefined`,
`?? []` turns that into an empty array,
and the count comes back zero with nothing raised anywhere.

That is the same failure this batch renamed two fields to prevent,
committed in the instrument built to measure it,
and it was caught only because a second measurement disagreed.
A count that reads as an answer is worth nothing without something independent
 saying the same number.

## What would ship is derived, because nothing publishes it

The reader `wouldShipTextFor` lands in
 `package/module/translation-repair/src/corpus-run/would-ship-text.ts`.
It answers,
 for one slice,
 what a document assembled today would carry there.

### The name is what it can prove

Not `shippedTextFor`.
Nothing assembles a document out of these decisions at all,
so nothing this reader names has been published.
The founding defect of this family was `repairDisposition: 'shipped'`,
a name that went on asserting a publication after the stage performing it
 stopped being last,
and a reader called `shippedTextFor` over a pipeline that publishes nothing
 would repeat that on its first day.
The pipeline-scale version of that gap is recorded as its own task,
 because whether the pipeline should publish is the owner's decision.

### No reading may carry an empty string

`standingTextFor` returns the empty string at a declined contest,
 deliberately,
 because it answers what a consolidation slate must beat.
`ArtifactConsolidateShippedV2` already documents the consequence:
 a consumer reading a bare per-slice `text` and writing it into a document
 would delete every declined slice outright.

So a reading carries either wording plus the decider that settled it,
or a named silence,
and never a `text` key holding nothing.

This corrects one line of the decision recorded earlier in this document.
That line said any terminal other than `consolidated` yields the standing text.
Taken literally it returns the empty string at `no-standing-text`.
The archive is the floor underneath both declines instead:
 this pipeline repairs an English translation that already exists,
 so a slice no later stage displaced still carries what the archive published.
Where the archive holds nothing either,
 the reading names which stage left the slice silent.

### The order the deciders ran in, read backwards

A `consolidated` terminal yields its text.
Otherwise the contest's winning lane.
Otherwise,
 where the contest never saw the slice,
 the wording both lanes agreed on,
 since a slice is eligible exactly where the lane texts differ.
Otherwise the archive.

Terminals are tested by shape rather than enumerated by name,
so the eight keeping terminals need no list and a terminal added later cannot
 silently begin yielding text.
That includes the retired `slate-kept-standing` spelling.

### The control was registered before the instrument existed

Task `#166` recorded these numbers on 2026-08-22,
 measured by hand,
 before this reader was written.
Running the reader over every settled artifact reproduces them exactly:

-   `Acheron`,
    4 contested slices,
     the translate lane's text is what would ship at 1,
     so the audit is wrong at 3 of 4.
-   `Weideriche_`,
    2 contested slices,
     the translate lane's text is what would ship at 0,
     so the audit is wrong at 2 of 2.
-   Together,
    1 of 6.

Across the whole population,
 47 version 2 artifacts parsed and 0 refused,
 14 of them carrying a settled contest across 6 entries.

The first roll-up of this measurement reported counts above the registered ones,
 because it tallied per entry while the registered numbers are per artifact.
An entry carries one artifact per pass,
 and the passes are not one:
 the two entries the control names carry two artifacts each,
 while `Zha_Ke` carries four across two run roots.

The copies are not always the same artifact twice.
The two `vub-run1` copies of `Zha_Ke` disagree at two of its four contested slices,
 where the contest reads `settled-neither` in the earlier and `lane-won` in the later.
That is not a cache the second pass re-bought.
`pass-entry.ts` discards a settled entry's whole slice cache after the artifact write,
 bounding the directory to documents still in flight,
 so a pass that settles every entry leaves nothing for the next one to resume.
The second pass was cold rather than resumed,
 the repair lane bought new wording at three of those four slices,
 and the contest key covers that wording,
 so re-asking was the correct answer to a question whose inputs had moved.

### One decomposition differs, and the difference is the point

The earlier hand count described the five mismatched slices as one where the
 repair lane won,
 one that settled neither,
 and three where the translate lane won and the consolidation replaced it.
The reader attributes four to the consolidation and one to the archive.
Both totals are five.
The disagreement is that one slice the repair lane won was then replaced by the
 consolidation,
 so the contest verdict and what would ship name different stages.
Asking who won and asking what would ship are different questions,
 which is the whole reason this reader exists.

## The consumers ask both questions now, and measuring stopped one wrong port

Task `#166` item 2 told me to route the settled rendering audit and the damage
draw through `wouldShipTextPerSlice`.
Measuring both consumers first refuted the instruction,
and the reason is the same in each case:
33 of the 47 settled artifacts carry `laneSelection: pending-human-decision` and
no consolidation at all,
so a would-ship reading on them falls all the way back to the archive.

For the audit,
that would have put the archive's own English under audit at 227 of 271
subjects,
which is exactly the case `auditsArchiveText` exists to separate out,
since the instrument was built for output that has no BEFORE text.
For the damage draw,
the failure has the opposite shape and is worse:
the population does not get polluted,
it vanishes.
A would-ship-scoped builder keeps 30 of 378 regions and deletes every region
from those 33 artifacts,
because where the archive stands nothing replaced an incumbent and no region
exists at all.

The archive standing on an undecided artifact is not a decision.
It is the absence of one,
and it is pending `#175` with the owner.
`ArtifactLaneSelectionV2` says as much in its own docblock:
`pending-human-decision` means the contest has not run over this entry.

So both consumers keep their lane question and gain an annotation beside it,
which is what this task's decision 1 said in the first place.
`SettledPageRelation` in
`package/module/translation-repair/src/corpus-run/rendering-audit-settled-relation.ts`
carries four recorded kinds plus `unrecorded`:
`undecided`,
`survives`,
`displaced` with the decider that displaced it,
and `nothing-would-ship` with the reason nothing stands.

The decider rides by reference rather than being spelled into member names like
`displaced-by-consolidation`.
Spelling them would duplicate `WouldShipDecider`'s list,
so a decider added later would silently produce no new relation,
which is the drift class `#170` measured twice in this same family.

### The branch order is the whole design, and the first guard for it was vacuous

Undecided is answered before any text is compared.
Reversing that reports a displacement on artifacts where no stage displaced
anything.

The first attempt to show that guard failing showed nothing,
because the fixture's texts differed and the branch below also answers
undecided.
Only a fixture where the archive wording matches the lane wording separates the
two orders,
and there the broken order answers `survives`:
it asserts a document would carry that wording on an entry no stage has decided.
That case is now pinned,
and it is the only one that fails under the break.

### Numbers, pre-registered before the field existed and reproduced through the built artifact

Audit subjects, all 271:
undecided 227,
displaced by the consolidation 20,
survives 10,
displaced by the contest 10,
displaced by the archive 4.
On the 14 decided artifacts that is 34 displaced of 44 subjects,
which supersedes the earlier "5 of 6" sizing taken from a hand count of
`Acheron` and `Weideriche_`.

Damage regions, all 378,
read through `collectShippedRegionsV2` rather than a reimplementation of it:
undecided 306,
displaced by the consolidation 38,
displaced by the contest 16,
survives 10,
displaced by the archive 8.

One number must not be quoted alone.
368 of 378 regions disagree with the would-ship text,
but a region exists only where a lane replaced the incumbent,
and on an undecided artifact the would-ship text is the incumbent,
so all 306 of those differ by construction.
The bounded figure is 62 of 72 on the decided artifacts.

### What the report prints, and what the tally counts

No printed line claimed page scope before this,
so nothing had to be corrected there.
`THE TWO HALVES, READ APART` prints `ARCHIVE text` and `FRESH text`,
both lane-scoped and both still accurate.
The annotation goes in as a new line instead.
It counts claims beside subjects,
because a displaced subject nobody claimed anything about cost the run a call
and nothing else,
while a displaced subject carrying claims means the instrument reported defects
in wording no reader of a document would meet.

`settled-tally.ts` gains `pageChanged` and `pageSilent` beside `repairChanged`
and `translateChanged`.
Zero is the honest answer on an undecided entry,
and it is meant to be read beside `selection=pending-human-decision` on the same
line:
two lanes proposed changes and,
as things stand,
a document would carry none of them.

### Two defects found on the way, both of this task's own class

The tally fixture omitted `consolidation`,
which the contract requires and states an absence for,
and an `as unknown as` cast hid the omission.
The first reader to reach for the field got `undefined`.

The annotation also pushed `rendering-audit-settled-input.ts` one line over its
budget.
Nothing was disabled and nothing was reformatted to fit:
`rendering-audit-settled-subject.ts` now holds the subject types,
the archive delivery constant,
`identityOf` and `subjectsOf`,
while the input module keeps the archive walk,
the provenance check and the reading.

## The last owed item asked for a refusal that was already there

Item 4 of `#166` prescribed a refusal:
treat a whole-run `shippedRecords` of zero as a stop rather than a printed zero.
Measuring before building refuted it,
and the refutation has three separate legs.

### The pointed-at-nothing refusal exists and fires

`EmptyPoolError` is raised from `selectEligible` in
`package/module/translation-repair/src/corpus-run/artifact-eligible.ts`,
reached through `resolvePool`,
which all four pool consumers call:
`score-probe.ts`,
`draw-sample.ts`,
`damage-sample.ts` and
`attribution-read.ts`.
Its message already states the rationale item 4 was going to add:
a rate over zero entries is
"a denominator quietly shrunk, here all the way to nothing,
while the number above it still renders".

Proved at the user boundary rather than inferred.
Pointing the built `score-probe.mjs` at a throwaway run holding an empty artifacts directory
printed the `SOURCE` line naming the directory and then raised,
exiting 1:

```text
EmptyPoolError: No entry has settled yet, so there is nothing to pool.
```

### A surviving zero is a legitimate run, not a misread

Item 1 of this task closed every path by which a misread reaches the printer.
`readArtifactProbe` reads the records through `parseSettledArtifactV2`,
so an absent list,
an absent field,
and a disposition the pipeline never writes each raise
rather than shrinking the count.
The reader's own docblock records why:
both lists "used to be read off the artifact root,
where version 2 writes neither, and both answered their absence with an empty list".

What that leaves is a run whose repair lane genuinely accepted nothing.
The population holds one artifact with repair status `unchanged`,
so a single-entry run over it is a healthy run with a zero denominator.
A refusal there would reject it.

### Nothing divides by the count, which changes what the note must say

The working justification had been that every rate below the count loses its denominator.
Reading `reportProbeTelemetry` refuted that:
every figure it prints is a raw count,
and there is no rate in the report at all.
The real hazard is narrower and worse to state loosely.
With no repair-lane record,
`repairUnprobedRecords`,
`regions` and every `*Introduced` and `CLAIMS` figure are zero by construction,
so the reader meets seven zeros and reads `majorityIntroduced=0`
as the probe having cleared the run.

### So it is a note, and the file already had the idiom

`probe-telemetry-report.ts` met this hazard once before,
for `rewrittenSlices=0`,
and answered it with a note rather than a refusal
because a zero there is ordinary on artifacts written before the lane was audited.
The new note follows it,
and points at `editorOffered` on the `ROSTER` line,
which is the figure that separates the two readings:
above zero the editor was asked and nothing it produced shipped,
at zero the critics filed nothing to repair.

Verified at the user boundary through the built CLI,
on a throwaway run under `~/temp/agent` holding one real artifact
whose only shipped record was moved to `not-selected`:

```text
PROBE entries=1 repairShippedRecords=0 repairUnprobedRecords=0 regions=0 majorityIntroduced=0 ...
NOTE repairShippedRecords=0 means no artifact read here carries a repair-lane record ...
ROSTER editorOffered=1 editorDegraded=0 editorSilent=0 ...
```

`editorOffered=1` beside the zero is the discriminating case working:
the editor was asked at one slice and nothing it produced shipped.

The note is covered by three cases in
`probe-telemetry-report.unit.test.ts`,
which is the file's first test.
Per GFP the note was removed,
rebuilt and rerun:
the two presence cases fail and the silence case correctly keeps passing.

## Two counters were named for a page they never reached

The remaining half of item 3,
renaming consumers that imply a page-level claim,
had no recorded disposition.
`shippedRecords` and `unprobedRecords` are that class,
and the rename landed in `693b0c58a`.

Both count repair-lane issue records whose `repairDisposition` is `shipped`,
which says that lane applied a replacement to the document it built.
The contest and the consolidation both sit downstream of it.
Under the bare word,
`PROBE shippedRecords=271` reads as a count of wording a page carries,
and this task's own measurement says the contest had not run on 33 of 47 artifacts,
so what a page would carry there is the archive's wording rather than either lane's.
They are now `repairShippedRecords` and `repairUnprobedRecords`.

Adding one export to `corpus-barrel.ts` pushed it one line over its budget.
Per MXL nothing was disabled:
`generation-barrel.ts` now holds the pooling and generation-identity exports,
split at the seam the corpus barrel's own header names,
by audience.

## Asking what a document would carry, before writing the artifact that claims it

`settledTallyLine` gained a call to `wouldShipTextFor` per comparison row,
which made `UnansweredContestSliceError` reachable on the production pass path.
It was computed AFTER `writeFileAtomic`,
so a document whose lanes differ at a slice the contest names nowhere
would have its complete artifact written
and then be reported `status=ERROR` by the entry catch below.
Every later reader would find a settled file the pass reported as failed.

Asking first makes the refusal truthful,
and it is the correct refusal rather than the convenient one:
a contest that cannot account for a slice it was obliged to decide has not settled the document.
The stage caches still hold every answer,
so a re-run reproduces the contradiction rather than losing it.
Landed in `462ecd70d`.
