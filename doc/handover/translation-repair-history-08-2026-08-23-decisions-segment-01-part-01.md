# Translation repair history: 2026-08-23 decisions

Part of the [translation repair history index](translation-repair-history.md).

## Current stop condition

Historical evidence only.
Candidate M failed on 2026-09-01.
No historical next-action list authorizes a corpus run,
model call,
spent-prompt retry,
or successor implementation.

## #181 adopted: option B, on a standing instruction rather than a fresh preference

### Why this stopped being a question

The ranking B > C > A was already argued from the measurement.
What was left looked like a preference call between B and C,
and it is not one.

C accepts that nothing ever evaluates the shipped text
on about 16 percent of contested slices,
on the ground that the archive is the conservative default.
The standing instruction for this work is that whatever we produce must be good
even when the originals are not.
That instruction decides between them directly:
an unevaluated archive is exactly the case it was given for.
So B is adopted,
and the adoption is a derivation from an instruction already given
rather than a new decision taken on the owner's behalf.
It is open to veto on that basis.

A stays last for the reason the measurement gave:
it buys one case in six and adds a second trigger path to reason about,
so it is worse than doing nothing deliberately.

### What B has to solve, which the ranking did not settle

The collision named in the task is real and is the first thing to work out.
Both contests share `CONTEST_POLICY`,
and B needs a way for the contest to reach the incumbent
when both candidates are declined,
without the policy naming either side's candidates.

Two things the measurement already fixes about the shape.
It must cover all six observed cases rather than the one with a flagged incumbent,
because the size note is incidental to this path.
And it must not read a recorded terminal as a stable property of an entry:
Zha_Ke and gaoyanger both settled differently across pipeline versions at identical slice sizes,
so run identity and code identity are confounded in the record.

### What is still not shown

Nothing establishes that the archive at any of those six slices is WRONG,
only that nothing evaluated it.
Deciding any of them is wrong means reading the passage,
which is a separate act under the corpus rules.


## #185: the bound reaches the wire, and the re-ask is bounded too

Two gaps,
both found reviewing `#184` after it closed.
Neither disturbs its classification or its census;
the GAP-not-regression finding and the 947-emission bound both stand.

### The claim no test supported

`produced-volume-bound.unit.test.ts` hands `maxAnswerChars` straight to `drainBody`.
Between the producer and the drain the bound crosses five boundaries
as an optional field forwarded by conditional spread:
quorum,
round,
call,
client,
transport.
Delete any one of those spreads and the code still compiles,
the whole suite still passes,
and production silently returns to the state `#184` existed to end,
where the seam exists and nothing passes anything through it.

`produced-volume-threading.unit.test.ts` drives `produceTranslateSlate`
against a stub client that records what it was handed.
Run against the build from `#184`,
its producing assertion PASSED and its three re-ask assertions FAILED.
That split is both halves of the evidence at once:
the pass is the positive control proving the probe can see a bound when one is passed,
and the failures prove the second gap was real rather than theoretical.

### The re-ask carried no bound, and it is the busiest producing path

`repairOneCandidate` sends an invalid candidate back to its author
and gets a fresh rendering of the same slice.
That is a producing call by every measure that matters,
and it was policed only by the absolute 32000 cap.

Measured over 32 artifacts and 175 slices:
the re-ask fired on 96 slices,
274 findings.
Re-asked slices are short.
Source minimum 5 code points,
median 111,
maximum 291,
with 23 of them below the floor crossover at 64.
By model:
GLM-4.7-Flash 69,
Nemotron-3-Super 53,
gpt-oss-120b 47,
Kimi-K3 36,
GLM-5.2 31,
Qwen3.6-27B 31,
Qwen3.8-27B 7.

### Why the producing bound could not simply be copied across

The two wires are not the same shape.
`TranslateReportWire` is `{translation}` alone.
`TranslateRepairWire` is `{resolution, translation, explanation}`,
and `explanation` is free prose no source slice bounds.
The census that set sixteen measured slate candidate TEXT,
not envelopes carrying a second prose field.

On a 5-code-point slice the bound floors at 1024.
A correct repair there could be a 15-character translation
beside a 900-character explanation,
and would be refused.
A refusal costs the voice,
since `stage-round.ts` turns any stream error into `voice: { heard: false }`,
so on this path a false refusal loses a candidate on 55% of slices.

So the re-ask counts the findings alongside the slice.
The prior translation is deliberately NOT counted,
though the re-ask does send it:
it is itself bounded at sixteen times the source,
so counting it would permit roughly 272 times the source
and clear the 98.2 floor of every runaway observed here.
Detection would be gone.

### What is measured here and what is reasoned

The ratio is measured,
over 947 emissions.
The material it is applied to is reasoned,
because explanation length is recorded nowhere:
slate candidate records carry only `hash index origin producer text`,
`attempts.json` is a per-entry retry counter and names no stage,
and the only logs naming `translate-repair` are scripted test fixtures.
A probe that finds nothing was run against a control here:
the same search finds no stage name of any kind in those files,
because there is nothing of that kind in them.

Three things bound the risk of having reasoned it.
The widening only ever LOOSENS,
so it adds no refusal the producing path does not already make.
The widened bound still lands far below the 10381-character emission that opened `#184`,
which is what the fourth test case asserts.
And a false refusal costs one candidate,
after which the slice falls back to its other voices and to the incumbent,
which is where an invalid candidate went before the re-ask existed at all.

### The two producing chains, which the GFP experiment exposed

Removing the spread at `stage-round.ts` and rebuilding failed 2 of 4 cases,
not 4,
and the unbounded-request list held exactly one entry.
The reason is that the two producing paths do not share a chain.
Producing runs producer to `gatherStageVoices` to `runGatherRound` to `attemptStageCall`.
The re-ask runs `repairOneCandidate` straight to `attemptStageCall`,
skipping quorum and round entirely.

Removing the spread at `stage-call.ts`,
the hop both chains cross,
failed all 4 cases.
Both spreads were restored and the test returned to green.
So the produce assertions pin producer,
quorum,
round and call;
the re-ask assertions pin `repairOneCandidate` and call;
and no single deletion can silence both except at the hop they share.

### Scope, checked rather than assumed

`translate-retry.ts` holds only `judgeSlateWithRetry`.
Judging calls emit verdicts,
not translations,
so no source-derived volume bound applies to them.
Out of scope by shape,
not by oversight.

Of 15 `gatherStageVoices` call sites only the producer carries a bound,
and that is correct:
critics,
judges and probes emit commentary no source length bounds.

`producedVolumeBound` takes `materialChars` now rather than `sourceChars`,
because two callers count different things into it.
`MAX_PRODUCED_TO_SOURCE_RATIO` keeps its name,
which records where the number was measured
rather than what a caller may widen it against.

GATE:
suite 537 PASS / 0 FAIL / exit 0,
`lint` 0 warnings 0 errors,
`lint:types` exit 0.
Commit `b28954495`.

## #181: the build plan, after reading the deciding source

### `CONTEST_POLICY` does not change at all

Step 1 concluded the archive question could be stated once in the shared policy.
It can be,
and it should not be.
The gap is lane-only.
`consolidate-gate-wire.ts` offers `neither` between `consolidated` and `standing`,
and `standing` is the archive,
so the gate's decline already lands on the archive by construction.
The lane contest's `neither` is the one that lands nowhere.

The two sheets already carry their own `Return JSON` instructions outside the shared policy,
so a lane-only field has an established place to live:
`lane-contest-wire.ts`,
beside its own instructions.
`CONTEST_POLICY` stays byte-identical,
which also leaves the measured `neither` wording untouched
(10 of 13 against an 8-of-13 general-preference control).
If the gate ever needs the same question,
the block lifts to shared then.

### The archive verdict must be recomputable, because the reader recomputes

`LANE_CONTEST_QUORUM = 2` is frozen,
and its TSDoc says why:
`artifact-v2-read-contest.ts:221` recomputes every recorded verdict
by calling `settleLaneContestBallots` over the stored ballots,
and refuses the artifact when the stored verdict and the recomputed one disagree.

So the archive verdict cannot be a number the stage decides and writes down.
It has to be a pure function of the stored ballots,
settled by mirroring `settleVotes` (`lane-contest-stage.ts:137`):
quorum of two,
and a clear winner or none.
Endorsed at two or more and strictly ahead of declined endorses;
declined at two or more and strictly ahead declines;
anything else is unjudged.
The threshold is mirrored rather than invented,
so no second frozen constant enters the artifact contract.

### The terminal question resolves differently than expected

The archive verdict does NOT belong in `ConsolidationTerminal`
(`consolidate-settle.ts:72`).
That union describes how a CONSOLIDATION ended.
The lane contest records into a different union,
`ArtifactContestVerdictV2` (`artifact-v2-contest.ts:119`),
whose three kinds are `quorum-not-met`,
`settled-neither` and `lane-won`.
`settled-neither` is exactly the state #181 is about,
so the archive verdict rides there,
and the eight-member consolidation terminal union is not touched.

This also answers the sub-question about `no-standing-text` carrying two meanings.
It does not have to be split:
the ambiguity it was accused of belongs to a different layer than the one being fixed.

### Ask always, count only on a decline

Asking only after a decline needs a second call,
a second cache entry and a second failure mode,
which is the same objection that sank option A.
The field is asked on every contest ballot and read only when the choice is `neither`.
Answers on lane-won slices cost nothing extra and are free telemetry on archive quality.

### Shipped bytes change nowhere

Worth stating plainly,
because it bounds the risk.
`no-standing-text` already ships the archive,
an endorsement ships the archive,
and a decline also ships the archive,
because nothing else exists.
The deliverable of option B is EVALUATION AND RECORD,
not different output.
The regression guard follows from that:
a re-run of a settled entry must publish byte-identical pages,
the #172 pattern.
What can move is judge behaviour and artifact shape,
and those are what the tests cover.

### Landmines to cover, not to assume away

  - The cache keep-predicate is `outcome.usable >= LANE_CONTEST_QUORUM`
    (`lane-contest-driver.ts:59`),
    which is on the voice count,
    not the verdict,
    so an unjudged archive still caches.
    Old cache entries carry no archive field;
    `lane-contest-cache-store.ts` must read their absence as unjudged rather than refuse them.
  - A one-sided slice has no archive to judge.
    The field's meaning has to be guarded there.
  - The archive must be judged on the SAME two questions as the candidates,
    or it gets a laxer standard and the endorsement is biased.
    Mostly-declined is a legitimate outcome,
    not a failure of the build.
  - A new required schema field can raise schema-mismatch voice loss on weak models.
    Measure contest-stage voice loss before and after on live slices;
    do not predict it.

### Scope check, run rather than assumed

`SETTLED_WITHOUT_A_GATE` (`consolidate-driver.ts:88`) names four terminals
that never reached a judge.
Whether `incumbent-only` and `slate-unjudged-standing` also ship unevaluated text
is the same class of gap as #181.
If they do,
that is a NEW task,
not #181 scope.

## #181: what landed, and the GFP that nearly reported a false null

### The shape, as built

The archive question is an orthogonal field on the lane contest ballot,
`publishable` or `flawed`,
asked on every ballot and read only where the choice is `neither`.
`CONTEST_POLICY` is byte-identical.
The gate does not ask,
because its `standing` choice IS the archive
and a judge preferring it has already said the archive is worth keeping.

`settleArchiveBallots` mirrors `settleVotes`:
quorum of two,
strict lead,
otherwise `unjudged`.
It is exported and shared with the artifact reader,
exactly as `settleLaneContestBallots` is,
so a stored verdict is re-derived from the ballots beside it
and `assertVerdictMatches` refuses the artifact when the two disagree.

Two decisions carry the backward compatibility,
and both are load-bearing rather than tidy:

  - The field is REQUIRED IN THE SCHEMA but OPTIONAL IN THE SHAPE GUARD.
    `isLaneContestWire` refuses a reply missing any field,
    so requiring it there would trade whole lane ballots for archive answers
    on models that ignore the schema.
  - An unjudged archive OMITS THE KEY rather than recording `unjudged`.
    `requireExactKeys` rejects only extra keys,
    so an omitted field means every artifact settled before today
    derives the same token it recorded,
    with no exception in the comparator.

### Measured, not asserted

Suite 539 PASS / 0 FAIL / exit 0,
up from 537 by the two new suites.
Lint 0 warnings 0 errors.
`lint:types` exit 0.
The full suite was also run BEFORE the new tests were added
and reported 537 PASS / 0 FAIL,
which is what shows the artifact reader still parses everything already on disk.

### The GFP, including one probe that lied

Three probes,
each rebuilt and re-run:

  - Quorum removed from `settleArchiveBallots`:
    the lone-voice case fails,
    `expected 'endorsed' to equal 'unjudged'`.
  - Omission rule removed,
    so the field is always recorded:
    the absent-key case fails.
  - Strict lead relaxed to `>=`:
    the tie case fails,
    node exits 1,
    passing suites fall from two to one.

The third probe reported NO FAILURE on its first run,
and that was an artifact.
`git checkout -- <src dir>` between probes discarded the barrel exports,
which were still UNCOMMITTED,
so the rebuilt bundle no longer exported `settleArchiveBallots`,
the test file failed at import,
and a grep looking only for assertion text found nothing and read as green.
This is the GFP warning about restoring over uncommitted work,
met in practice.
The fix was to commit the guard and the test first,
then re-probe while checking two things the first run never checked:
the import error count,
and the number of suites that still passed.
A null result from a probe that cannot run the assertion is not evidence.

### Still owed on #181

Shipped bytes change nowhere,
so what remains is live behaviour rather than output:

  - contest-stage voice loss measured before and after on live slices,
    because a new required schema field can raise schema-mismatch loss
    on weak models,
    and GLM-4.7-Flash already leads that table.
  - the wangzihao980 slice 3 against slice 4 control,
    where the field is consumed on one and ignored on the other.
  - a one-sided slice,
    where there is no archive to judge,
    checked rather than assumed.

Commits:
83cfaa4bd (plan),
377e3e62f (wire),
2d8fc8914 (settle and record),
37feccb35 (tests).

## #181 verified live: the field costs no voices, and the archive loses on every slice

Two arms over `wangzihao980`'s five contested slices,
same slices,
same roster of six,
one run each,
differing only in whether the ballot asks the archive question.
Run through `contestLaneSlice` against the live roster,
with source rebuilt from the corpus at the artifact's own commit.

### Voice loss did not rise, which was the risk worth measuring

  - asks-archive:
    30 of 30 voices usable,
    zero lost.
  - no-archive:
    27 of 30 usable,
    three lost.

The concern was that a new required schema field would raise schema-mismatch loss
on the weaker models,
GLM-4.7-Flash above all.
It did not:
the arm carrying the field sat at the ceiling and lost nothing,
and every one of its 30 ballots answered the new field.

Read the DIRECTION,
not the size.
Single runs cannot resolve three voices in thirty against the run-to-run band,
which was never measured here,
so the honest claim is that loss did not increase,
not that the field improves it.

### The control pair behaves as designed

  - chunk 2 and chunk 3 settled `neither`,
    so the archive verdict is CONSUMED there.
    These are exactly the slices `#181` was opened about:
    the archive ships and the record used to say nothing about it.
  - chunk 0,
    chunk 4 and chunk 5 had a winning lane,
    so the field is IGNORED
    and no archive key is recorded.

Choices agreed across the arms on four of five slices.
Chunk 5 differed,
`translate` against `repair`.
One slice on single runs is consistent with ordinary judge variation
and is not evidence that the field perturbs the choice.

### The archive lost everywhere, and that is a finding rather than a fault

29 of 30 archive answers said `flawed`;
one said `publishable`.
All five slices settle `declined`.
The roster judges the published rendering of this entry unfit as it stands
at every slice it was asked about,
including the three where a candidate beat it.

This is the outcome the design anticipated:
the deliverable is EVALUATION AND RECORD,
not endorsement,
and a mostly-declined archive is a legitimate answer.
Shipped bytes are unchanged either way,
because the archive already ships wherever the contest declines both candidates.

### Still owed, and now the only thing owed on #181

A contested slice whose archive is EMPTY has no archive to judge,
and the sheet would ask about a blank block.
Not reachable in this entry,
whose five contested slices all carry one,
so it is unmeasured rather than refuted.
The fix belongs in `buildLaneContestMessages`:
omit the archive question when `incumbentText` is empty,
and let the lenient guard settle it `unjudged` as it already does for a silent judge.

Probe:
`${HOME}/temp/agent/181-live.mjs`,
results in `181-live-asks-archive.json`
and `181-live-no-archive.json`.
Ids,
counts and verdicts only;
no passages.

## #181 closed: the absent archive is guarded, and the case was measured before it was built

The last owed case is built rather than deferred.
A contested slice whose archive is absent shows judges an empty block
while the schema still asks whether the archive is publishable,
so `contestLaneSlice` now drops archive answers when `incumbentText` is empty.

Stripped in the STAGE rather than where the record is built.
The recorded verdict is derived from exactly the ballots that get stored,
so removing the answer in one place keeps the stored ballots
and the verdict derived from them in agreement,
and the artifact reader re-derives `unjudged` from what it reads back.

MEASURED BEFORE BUILDING,
and the measurement did not excuse the work.
Across 13 settled artifacts,
all 108 comparison rows carry `incumbentKind: present`,
so none of the 92 contested slices has an empty archive.
`IncumbentKind` nevertheless admits `absent`,
and `wording-coherence.ts` handles it,
so the state is representable and merely unobserved in the artifacts to hand.
Unobserved is a reason to guard it,
not a reason to assume it away.

GFP:
removing the strip fails the DROPS case
with `expected 'declined' to equal 'unjudged'`,
node exits 1,
while the KEEPS positive control beside it still passes,
which is what shows the assertion is specific to the strip
rather than to the archive machinery in general.

FINAL GATE:
suite 540 PASS / 0 FAIL / exit 0,
lint 0 warnings 0 errors,
`lint:types` exit 0.
Commits:
83cfaa4bd,
377e3e62f,
2d8fc8914,
37feccb35,
2c08becfc,
f69f15342,
731dcc3e2.

## Task 91: the self-certification discount, and why the roster half did not follow

Question 4 answer A is implemented.
A checker's verdict on text it helped write is heard at `SELF_VOTE_WEIGHT`,
the same one-half the selection stage already applies,
imported rather than re-declared.

AUTHORSHIP IS PER ISSUE,
which the task note did not anticipate.
It said "the winning editor's identity",
singular.
An `EditableEnvelope` carries `issueIds` plural,
and each envelope's selected round has its own winning producer,
so one patched text has several authors and the discount has to resolve per issue.
`producerModelIds` already maps a producer to every model with a stake in it,
covering composites and collapsed incumbents,
so nothing new had to decide what a stake is.

AUTHORSHIP EXISTS ONLY THROUGH APPLIED OPERATIONS.
An envelope the gate refused put no text into the candidate,
so the issues it named keep whole votes.
A round scoped to `CHUNK_SCOPE_ENVELOPE` authors every issue in the chunk,
including ones it was never told about,
which is why `IssueAuthorship` keeps `perIssue` and `everyIssue` apart
instead of flattening the chunk-wide case across an issue list it would have to be handed.

THE REFINE RECHECK DISCOUNTS BOTH STAGES.
Refined text is the editor's repair rewritten for naturalness,
so `retainsResolvedIssues` now receives the outcome carrying the rounds of both,
and takes its envelope map from `repairRegions`,
the regions the accuracy stage actually replaced.

`checker-sensitivity` passes `UNATTRIBUTED_TEXT` at all three of its calls.
Its sheets are hand-written fixtures no roster model wrote,
and discounting there would measure the discount rather than the checkers.

### A defect the suite caught, and one the probe caught

`selectedIndex` is the ONE-BASED number of the winner on the slate the judges were shown,
and its own doc warns the caller may rotate the slate first.
Reading `slate[selectedIndex]` therefore named the neighbour,
and named nothing at all when the winner sat last.
`refine-phase.unit.test.ts` threw `Expected non-nullish value` on three cases immediately.
Fixed by matching `entry.index` against `selectedIndex`,
the only join a rotated slate survives.

THE FIRST VERSION OF THE GUARD FOR THAT FIX PROVED NOTHING.
It used a rotated slate,
winner numbered 1 at position 1,
where `slate[selectedIndex]` lands on the winner by luck;
the case passed with the defect restored.
Natural order is the discriminating shape:
winner numbered 1 at position 0,
so indexing names the LOSER.
This is the second time in this work a guard has looked green while guarding nothing,
after the barrel-export false null recorded under task 181.

### GFP

Removing the discount fails five weight-dependent cases,
node exits 1,
PASS suites 2 to 1,
with zero import errors,
so the bundle loaded and the failures are the assertions.
The positive control beside the discriminating case,
identical ballots with nobody named as an author,
still passes,
which is what shows the assertion reads the discount rather than the ballots.

Restoring the array index fails the join case with a value mismatch rather than a throw,
plus the composite case with a throw,
covering both failure modes.

### What #84's numbers say about each half

CORROBORATES THE HALF.
#84 measured self-preference paired across two draws sharing no slices:
own 0.367 against 0.220 for judges holding no stake,
excess 0.147,
lift 1.67 times.
A discount dividing by two is the right order and slightly more aggressive than the measured effect,
so the owner's "consistency is its only argument" now has a second argument.

DOES NOT SUPPORT THE ROSTER HALF,
which is why that half is not in these commits.
Question 1 answer D said the producing roster stays at three
"until #84 measures judge quality on preserve-or-replace,
then widens on those numbers".
#84 reported,
and its numbers do not carry that decision:

- Its width series is `NO WIDTH TREND`,
  and it is a series about SELF-PREFERENCE by width,
  0.083 then 0.182,
  non-monotone and mostly inside its own band.
  It says nothing about whether wider PRODUCTION yields better candidates.
- Its one width-correlated quality-adjacent number is replacement rate,
  0.83 at widths two to four against 0.94 at widths five and six.
  Replacing the incumbent more often is churn,
  not quality;
  reading it as quality assumes the thing being asked.
- Its abstention finding cuts the other way.
  `gpt-oss-120b` and `Nemotron-3-Super` decline most slices carrying any archive imperfection,
  so on exactly the slices that matter the effective roster is about four voices,
  not six.

The cost side was already measured:
two producers to six multiplies calls by 1.7 and tokens by 1.8.
Cost is not the constraint here;
the missing measurement is.
Widening now would act on a number that does not measure what the decision needs.
Carried on its own task with the probe it would take.

FINAL GATE:
suite 546 PASS / 0 FAIL / exit 0,
lint 0 warnings 0 errors,
`lint:types` exit 0.
Commits:
bd972fbc2,
664cbc42f,
de3e8c51f,
583005335,
23f1432e4.

## Task 187: the discount was reading the wrong source, and missed the author on a reachable path

Task 91 shipped the self-certification discount and its arithmetic is unchanged by this.
What moved is where authorship comes from.

### What was wrong

`collectIssueAuthors` reconstructed "who wrote the shipped text" from the judged rounds.
Two directions of error,
one of which defeated the feature outright:

- UNDER-DISCOUNTED THE AUTHOR.
  When the whole-chunk judges decline with `indecision`,
  `editor-ensemble.ts` ships `pickFallbackPatch({ candidates: repairing, },)`,
  a real editor's applied operations.
  The round is recorded as `declined`,
  and a declined round has ballots and no winner,
  so `roundWinnerAuthors` credited nobody.
  Creditable issues existed and the checkers ran,
  and the model that wrote the shipped text certified its own work at full weight.
  That is exactly what task 91 promises to stop.
- OVER-DISCOUNTED NON-AUTHORS.
  Envelope-round winners were credited for their envelope's issues.
  The composite is assembled from those winners,
  but a single model's whole-chunk proposal competes against it and can win,
  and when it does their text did not ship.
  Direction-blind,
  like the discount itself,
  so not a conservative error.

Neither was reconstructable.
The information is not in `authorsFromRounds`' input,
so no patch to that function could have been correct.

### What was verified NOT broken, rather than assumed

- The unconditional chunk-scope credit is CORRECT BY CONSTRUCTION.
  The apply gate runs BEFORE selection (`editor-ensemble.ts` takes `Candidate<PatchOutcome>[]`),
  and zero-applied candidates are excluded twice:
  `repairing` filters on `applied.length > 0` in `repair-editor-stage.ts`,
  and the composite joins the slate only when it applied something in `editor-candidates.ts`.
  A selected chunk round therefore cannot have a winner that wrote nothing.
- Refine's declined branches are clean.
  Both dispositions ship `unchanged` in `refine-stage.ts`,
  so no candidate's text ships there without a winner.
- No settled artifact is affected.
  Rounds are ephemeral and no artifact field carries them,
  confirmed by scanning both run directories.

### The shape it landed in

The stage knows the shipped producer at every exit,
so it states it instead of leaving it to be inferred.
`ChunkPatchSelection` and `EditorStageResult` carry `shippedProducer`,
`pickFallbackCandidate` returns the candidate rather than a bare patch so the declined path has one,
and `chunkCandidateOf` builds slate and fallback the same way so the two cannot drift.

Authorship then reads that producer.
A `model` producer wrote the whole chunk and answers for every creditable issue.
A `composite` defers to the envelope rounds that assembled it,
which is the one case where parts of the shipped text have different authors.
`NOBODY_WROTE_IT` means the untouched translation shipped.

Absence is a NAMED STATE rather than `CandidateProducer | undefined`.
The repo forbids nullish unions and was right to here:
shipping the translation as it stood is a decision two exits reach on purpose.

`ChunkRepairOutcome` carries `authorship` so the naturalness recheck can still name the editor after a resume,
which cost `SLICE_CACHE_VERSION` 30.
`collectRefinedAuthors` unions the refiners onto it from `RefineStageResult.contributors`,
a field whose own documentation claimed callers barred its models and which had no readers at all.

### GFP, both directions, zero import errors on each

- Probe A restored the rounds reconstruction.
  Three cases failed:
  the lone winner,
  the indecision fallback,
  and the envelope winner whose composite lost.
  The positive control,
  `NAMES NOBODY WHEN THE UNTOUCHED TRANSLATION SHIPS`,
  still passed.
- Probe B dropped the refiners from the union.
  Two cases failed.
  The positive control,
  a lost refinement adding nobody,
  still passed.

### Also fixed on the way

`splice-slices.unit.test.ts` had hand-copied the whole `ChunkRepairOutcome` shape as an inline return type,
which is why it drifted the moment the record grew.
It names the contract now.
`unchangedChunkOutcome` moved to `repair-unchanged-outcome.ts`,
the max-lines remediation for `repair-chunk.ts` reaching 301,
which also stops three exits restating one record shape.

FINAL GATE:
suite 546 PASS / 0 FAIL / exit 0,
lint 0 warnings 0 errors,
`lint:types` exit 0.
Commits:
9b433ea4f,
e796d2956.

## Task 187, corrections found while covering the wire

Three corrections to the section above.
None of them change what shipped;
two change what a later session should believe about it.

### "Reachable path" was true of the code and false of production

The heading above says the discount missed the author "on a reachable path".
Reachable in code,
yes.
Reachable in a corpus pass,
no,
and the distinction matters because it decides whether the machinery earns its complexity.

`wroteTextForIssue` weights a checker's verdict at half when that checker appears in `IssueAuthorship`.
Authorship can only ever name an editor
(`producer.modelId`,
`producer.matched`,
`producer.contributors` at `candidate-select-model.ts:136-139`)
or a refiner,
added by `collectRefinedAuthors`.
`assertCheckerIndependence` at `repair-contract.ts:359` refuses any roster where a checker is also an editor
or a refiner,
and it runs at `repair-chunk.ts:126` and `refine-phase.ts:153`,
so every chunk and every refine phase is gated on it.
The production roster at `corpus-run/run-config.ts:192`,
the only `RepairModels` literal outside TSDoc examples,
is disjoint:
editors and refiners are Kimi-K3,
GLM-5.2 and GLM-4.7-Flash,
checkers are Qwen3.8-27B,
Nemotron-3-Super-120B and gpt-oss-120b.

So the checker-side discount has changed no tally that ever shipped.
Task 187's corrections are right and covered;
they are also currently inert,
and so is the half of task 91 that built them.

SCOPE THIS PRECISELY.
`SELF_VOTE_WEIGHT` has two independent readers and only one is unreachable.
The SELECTION side at `candidate-select.ts:276` halves a JUDGE's vote for its own candidate,
`judgeModelIds` is the whole six-model roster,
and the quorum threshold at `repair-contract.ts:288` is written around it.
That copy fires on every chunk;
the suite log shows it live
(`hf:zai-org/GLM-5.2 chose candidate 1 at weight 0.5`).
Do not delete it.

Whether to drop the checker-side apparatus or instead relax the assert and let the strongest editors check too,
with their self-votes discounted,
is a design question with a measurement behind it.
It is filed,
not decided here.

### The stored authorship went stale the moment a refinement was kept

`repairedText` became the refined text while `authorship` stayed editor-only,
so every `refined: true` record misstated its own contract.
The recheck's union lived in an argument and died with the call.
Fixed at the shipping return only:
both rollback paths hand back the editor's text,
so the editor's authorship is already true of them.

No cache bump was needed.
`SLICE_CACHE_VERSION` 30 is baked into the key,
and no pass has run since it landed,
so there is no v30 entry to go stale.

GFP:
removing the stored union fails `STORES BOTH STAGES ON A RECORD WHOSE REWRITE SHIPPED`
with `expected [ GLM-4.7-Flash ] to deeply equal [ GLM-4.7-Flash, GLM-5.2 ]`,
while the control `NAMES NO REFINER ON A SLICE IT ROLLED BACK` still passes.
Restored byte-identical,
zero import errors on the probe.

### Test files are exempt from max-lines

The section above splits a test file at the 300-line budget.
That split is fine to keep,
but it was self-imposed:
`package/config/oxlint/src/overrides.ts:161` turns `eslint/max-lines` off for `**/*.{test,bench}.ts`.
Only source files carry the budget.

FINAL GATE:
suite 546 PASS / 0 FAIL / exit 0,
lint 0 warnings 0 errors,
`lint:types` exit 0.
Commits:
3922cba3b,
f3c444458.

### Correction to the section above: the unreachability was already recorded

`doc/decision/translation-repair-question-answers.md` lines 130 to 140 already say it,
and say it as a deliberate state rather than a defect:

> `assertCheckerIndependence` in `repair-contract.ts` THROWS when any checker id also appears among the editors
> or refiners.
> A roster where a model could certify its own text is refused before any work happens,
> so no
> checker is ever a self-certifier and a half-weight branch would never run.
>
> Relaxing that assertion is the "widen the producing roles" half of `#91`,
> and question 1 answer D blocks
> roster widening until `#84` reports.
> So the ordering is forced:
> `#84`,
> then the roles widen,
> then the half
> becomes reachable and is applied.

So the checker-side discount is unreachable BY DESIGN,
pending task 186,
not by oversight.
Task 188 is the "and is applied" step,
blocked by 186,
not a discovery.

What the 2026-08-23 reading did add,
and what is worth keeping:
the two readers of `SELF_VOTE_WEIGHT` must not be conflated.
The selection-side copy at `candidate-select.ts:276` is live on every chunk and must survive any cleanup
aimed at the checker-side one.

The lesson for a later session is the search,
not the fact:
`grep -rn 'SELF_VOTE_WEIGHT' src/` found the code
and `grep -rn 'assertCheckerIndependence' doc/` would have found the decision.
Searching the source and not the decisions is how a recorded choice gets rediscovered as a bug.

## Task 188, the arithmetic checked before the relaxation is written

Read on 2026-08-23,
while task 186's probe was in flight,
so the relaxation could be written the moment
the width question resolves rather than after it.

The worry worth settling first was whether relaxing `assertCheckerIndependence` would leave the discount
doing nothing.
If every checker is also an editor,
and every checker were therefore halved,
the discount would cancel out of `tallyResolutionChecks`:
its rule is `resolved: fixed > (notFixed + worse)`,
a comparison of two weighted sums,
and scaling both sides by one half leaves every verdict exactly where it was.
A uniform discount over a fully overlapping roster is not a safeguard,
it is a no-op.

It is not uniform.
The weight is chosen per issue at `package/module/translation-repair/src/tally-resolution.ts:265`,
by `wroteTextForIssue({ authorship, issueId, modelId, },)`,
so a checker is halved only on the issues whose shipped text it actually helped write
and keeps full weight on every other issue in the same slice.
A six-seat roster checking its own slice therefore still produces a mixed tally
rather than a uniformly scaled one.

This is what makes task 187 a prerequisite rather than a neighbour.
The discount reads `authorship`,
and until 187 the record could carry an author list describing pre-refinement text,
which would have halved the wrong checkers on the wrong issues once the roster overlapped.

What task 188 still owes when it runs,
none of which this reading settles:
the assertion's duplicate-checker refusal must survive,
because a repeated id is a different fault from an overlapping one
and `gatherStageVoices` still counts a repeat twice toward quorum
while `runCheckerStage` collapses it to one ballot;
`assertJudgeableProducerRoster`'s capacity arithmetic at `repair-contract.ts:288` must be re-read
at whatever width 186 lands on;
and the selection-side reader of `SELF_VOTE_WEIGHT` must not be touched.

## Task 186, the constraint that decides it is arithmetic, not a measurement

Found 2026-08-23 while the width probe was running,
by reading the live roster instead of the probe.

The repair lane's rosters are a PARTITION of the six-model roster,
not a selection from it.
`RUN_MODELS` at `package/module/translation-repair/src/corpus-run/run-config.ts:192` seats
three editors,
the same three as refiners,
and the disjoint other three as checkers.
Three writers plus three checkers is exactly six.
The partition saturates the roster,
with nothing spare.

That is not a coincidence,
it is what `assertCheckerIndependence` forces:
checkers must exclude every editor and every refiner,
so `writers + checkers` can never exceed the roster.

The consequence for the owner's standing ruling,
"All producing roles to 4":
it is not reachable under the current assertion.
Four writers out of six leaves at most two checkers,
and if the refiners were also widened to four as a distinct set the writers alone would exceed the roster
and no checker could be seated at all.

NOTHING WOULD REFUSE THE SHRUNK ROSTER.
The only floor on the checker roster is `assertRostersConfigured` at
`package/module/translation-repair/src/roster-configuration.ts:72`,
which refuses an EMPTY role and nothing else.
Every other assertion in the module was enumerated to check this;
`assertJudgeableEditorRoster` and `assertJudgeableProducerRoster` both bound the PRODUCING side.
So seating four editors today would quietly drop the checker stage to two voices,
and at two voices one `fixed` against one `not-fixed` resolves nothing,
because `tallyResolutionChecks` requires `fixed > (notFixed + worse)`.

THIS REVERSES THE ORDERING THE PLANNING DOC RECORDS.
That doc has the sequence as `#84`,
then the roles widen,
then the checker-side half becomes reachable
and `#188` applies it.
The arithmetic says `#188` comes FIRST:
until the assertion permits overlap,
there is no width at which four editors and a usable checker roster
can coexist,
so `#188` is a prerequisite of the owner's ruling rather than a consequence of it.

WHAT THIS DOES NOT SETTLE,
and what the probe is still for:
whether widening buys better repairs at all.
If the probe's move count lands inside its own null band,
the answer is that the width does not decide
anything measurable,
and the cheapest correct action is to stay narrow and record that,
which spends nothing and leaves the assertion alone.
The arithmetic above only says what widening COSTS if it is done;
it does not say it is worth doing.
