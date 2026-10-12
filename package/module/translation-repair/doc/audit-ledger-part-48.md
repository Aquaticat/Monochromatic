# Audit ledger, part 48

Part 48 of [Audit ledger](audit-ledger.md),
whose index lists every part in order.

## Recurring code families, continued

### B416: tests armed a model card's stream bound on the real clock, which the real clock scan could not see

Red `0f8847e91f`,
fixed in `5b0b8fef14`.

Found on 2026-10-11 (UTC) as the open item B401 recorded.
The Bedrock client arms each card's `streamBoundMs` around every attempt unless handed `streamBoundMsOverride`,
and the real clock scan keyed neither the card's field nor a client built without the override.
By the agent's probe over one whole suite run,
`bedrock-client.unit.test.ts`,
`client-log-context.unit.test.ts` and `owner-body-rules.unit.test.ts` armed the Gemma cards' 60,000 ms bound in 14 attempts,
the same length as the hang stop,
so no case was cut;
their timing rested on a production measurement that no scan or test showed.
No test or fixture wrote `streamBoundMs`.

The fix:
the scan keys `streamBoundMs`,
reads a `createBedrockClient` from the built package whose options name no override,
and leaves a stream bound of `'unbounded'`;
`streamBoundMsOverride` takes `'unbounded'`;
the three files hand it,
and one listed case reads the catalog for the gpt-oss card,
which carries no bound,
so the client's fallback to the card's bound is covered.
The change is red on the base build only to the type checker,
since the client already passed `'unbounded'` through.
By the agent's control,
setting the test helper's override back to a bound fails the case that asserts no timer is armed.
Two same-family fields were read and left:
`waitOutHold` takes a real hold wait in milliseconds that `budget-hold-wait.unit.test.ts` sets without the scan seeing it,
and `holdMs` arms no timer.

Read and left:
`budget-hold-wait.unit.test.ts` calls `waitOutHold` with a real wait of 6 milliseconds
and asserts only a lower bound of 5 on the time it took,
and with a wait of 50 milliseconds under a signal that has already aborted,
which ends before any wait;
both follow the real clock rule in `mistake-prevention.md`.
The scan does not key the `ms` parameter,
since keying it would catch many unrelated record fields.

Open to the owner's veto:
`'unbounded'` in the tests,
where the alternative is the hang stop,
which needs no production change but keeps a real 60 second timer armed;
the scan flags every test client built with no override,
where the alternative reads only the two keys and misses the measured sites;
and the scan leaves `'unbounded'`,
where the alternative lists each such site.

Recurrence:
`mistake-prevention.md`,
"Tests on the real clock".

### B417: a contest most of whose ballots called the archive flawed ran no run-off

Red `52a38dc6cf`,
fixed in `c66cb5e474`.

Found on 2026-10-11 (UTC) in the read of TianqiChen66622.
Slice 4 settled neither,
with four of its five usable contest ballots calling the archive flawed,
yet the run-off over a tied slate with an eligible standing read every usable ballot,
so it ran a single round;
three proposals tied at weight one,
the standing drew none,
and the tie kept the archive's present-tense sentence.
The owner answered the same day,
"Majority flawed yes".

The fix:
`archiveFlawedByMajority` (`consolidate-archive-flawed.ts`) triggers the run-off on a strict majority of the usable ballots,
and the driver sets `runoffOverStanding` from it.
`CONSOLIDATE_CACHE_VERSION` moved from 20 to 21,
since stored settlements change meaning.
The archive predicate cases read three of five flawed as a run-off and two of four as none.

Open to the owner's veto:
a ballot silent about the archive counts in the denominator,
where the alternative counts only ballots that judged the archive.

### B418: a single-round tie the standing drew no ballot in kept the standing

Red `52a38dc6cf`,
fixed in `c66cb5e474`.

Found with B417.
A single round that declined on a tie between proposals kept the standing,
even when the standing itself drew no ballot.
The owner answered on 2026-10-11 (UTC),
"Run off the tied finalists".

The fix:
`judgeSingleRoundOverStanding` runs off the tied finalists once through `runoffTiedFinalists` (`translate-retry.ts`)
when the single round declines and the standing drew no ballot;
a run-off that ties again keeps the standing,
and a standing that drew a ballot keeps the single round.
The settle cases run off a three-way tie the standing drew no ballot in,
keep a tie the standing took part in,
and keep the standing when the run-off ties again after one ask.

Left open for the next round:
`archive-block-review-stage.ts` keeps a ballot-drawing fallback on a tie,
where the same run-off would apply.

### B420: a seat that threw on every call kept its place on every bench for the whole run

Red `2a049370cd`,
fixed in `06442b4689`.

Found on 2026-10-11 (UTC) in the read of TianqiChen66622,
where seats that threw on every call they were given were still asked by every later gather
and still counted in every quorum denominator,
so each gather waited on them and sized its quorum on a bench they could not fill.

The fix:
`seatTallyClient` (`seat-tally.ts`) takes a `minAsks` threshold
and refuses a seat the tally has withheld with `NoProviderForModelError` before the inner client is asked,
which every stage already reads as an unreachable seat;
a refusal is not an ask,
so it leaves the counts as they were.
The threshold is `SEAT_WITHHOLD_ASKS` in `stage-quorum.ts`,
`STAGE_RETRY_ROUNDS` plus one:
the most asks one gather gives a lost seat,
so a withheld seat has failed a whole gather's worth of asks rather than one round.
The quorum gather leaves withheld seats out of its bench and its denominator,
and each gather whose stage named a withheld seat warns which seats it did not ask and why.
The run's seat line names each withheld seat with how many of its asks threw.

Open to the owner's veto:
the threshold of four asks;
`runWindowedRounds`,
the judge benches and the floor checks do not filter withheld seats themselves,
and reach them only through the refusal.

### B421: a call the caller abandoned would have counted as the seat's failure

Red `2a049370cd`,
fixed in `06442b4689`.

Found on 2026-10-11 (UTC) in the lead's review of the B420 patch,
before it merged.
Every catch in `seatTallyClient` recorded `threw`,
so a call the caller aborted
(a straggler cut off after quorum,
a stage deadline,
an entry stop)
counted as the seat's own failure.
A slow but healthy seat cut off four times would then have been withheld for the whole run;
Kimi-K3 took 44 to 74 seconds to its first byte in TianqiChen66622,
which is that shape.

The fix:
a throw after the request's signal has aborted records nothing,
the treatment the tally already gave a call cut off when the process ends.
One case records nothing for four calls a caller aborted and that then threw,
and another withholds a seat whose four calls threw with the caller still waiting on each.

### B422: the census of thrown text found every failed call already written

No code change.

The dark-seat work counted every path where a stage call can throw,
to find any whose error text reached no line,
since TianqiChen66622's log had none for the seats that threw.
Every caller already writes the thrown text on a warn line;
that log lost them to the launch's stream wiring
(M147).
The run's "seats dark" line now says where those lines are:
"<stage> <model>: <error>,
voice lost",
or "seat unreachable".

### B424: the forfeit of an eligible standing read every ballot where the run-off read a majority

Red `46fe30664f`,
fixed in `b640f2392e`.

After B417,
the forfeit of an eligible standing past an undecided gate still needed every contest ballot to call the archive flawed,
the rule since 2026-09-27 ("Slate's choice"),
while the run-off read a strict majority,
so the same contest could run off and still keep the standing.
The owner answered on 2026-10-11 (UTC),
"Majority,
like the run-off".

The fix:
both rules read `archiveFlawedByMajority`;
the consolidation carries one flag,
`runoffOverStanding`,
which `settleConsolidation` hands to the gate as `standingFlawedByMajority`;
`archiveFlawedByEveryBallot` and `archiveFlagsOf` are removed,
and the finding and the warn line say "a majority of contest ballots".
`CONSOLIDATE_CACHE_VERSION` stays 21:
its account names this change,
and no pass had run since 21 was set.
Red at the base:
"expected 'gate-kept-standing' to equal 'consolidated'".

### B425: archive-absent insertions went to the roster, and those that missed quorum shipped nothing

Red `4f0ab3522d`,
fixed in `5059b141cc`.

Ledger item L6,
measured before the fix over 952 contests in 240 artifacts:
931 shipped the translate lane,
5 consolidated,
and 16 missed quorum and shipped nothing.
At an archive-absent insertion the repair lane records `not-applicable`,
so the question had one applicable lane,
yet the contest asked the roster.

The fix:
`contestDocumentLanes` gives such a slice a `sole-lane` verdict before any cache or roster read,
with no ballots and no usable voices,
unless the slice is front matter,
whose candidates the syntax admission rule judges and records one by one.
The consolidation and the final selection read `sole-lane` as a win for that lane,
and the would-ship reader ships its wording.
The artifact writer moves to generation 15,
which records `sole-lane`;
the reader accepts it only there,
only on a slice with one applicable lane and no ballots,
and reads generation 14 contests unchanged.
The persistence helpers moved unchanged to `lane-contest-persist.ts`.
No cache version moved:
`sole-lane` rows never reach the lane-contest cache,
and every namespace is keyed by the pipeline digest.
The 16 lost passages were not measured again;
that waits for a pass.

Open to the owner's veto:
a `sole-lane` record keeps `ballots: []` and `usable: 0`,
where the alternative omits the keys and needs a second record shape;
the would-ship reader reuses `decidedBy: 'contest'`,
where the alternative is a new decider value;
front-matter insertions stay on the roster;
`soleLaneOf` answers both lanes rather than throwing on a row where neither or both lanes are not applicable,
so a reader refuses it as a parse error;
a runs directory holding generation 14 artifacts is refused on resume.
The lead kept each of these on 2026-10-11 (UTC),
under the owner's instruction of that day to decide the remaining items without asking.

### B419: no judge was shown which wordings narrate an ended life in the present tense

Red `a1f98e76d4`,
fixed in `afeac61dbb`.

Found on 2026-10-11 (UTC) in the read of TianqiChen66622,
which shipped the archive's present-tense narration of its subject
because the judges left the archive standing.
The census of that day over the 92 pinned archive pages
labelled 80 of 536 detector hits by hand:
about 68% precision when traits of the person count,
about 24% when only narrated acts count.
A detector that weak cannot refuse a wording or mark a text flawed,
so the owner chose to show its hits to the judges as candidates.

The fix:
`present-tense-candidates.ts`,
with the readings it stands on
(`present-tense-text.ts`,
`present-tense-words.ts`,
`present-tense-vocabulary.ts`),
returns each candidate with its sentence,
matched words and rule,
skips quotations,
blockquotes,
headings,
code and HTML through the shared slice grammar,
and reads nothing where the entry records no death.
The subject is every name the translation declares,
the front matter `name` and each alias in `info.alias`
(`subject-names.ts`;
a comma-joined string or a list),
the longest tried first.
`corpus-run/entry-info-record.ts` reads `people/<id>/info.yml` at the pin;
`identity-context.ts` reads `died` by the rule every identity field follows,
a bare year included,
and the identity block every stage reads names the date.
The lane contest,
the translate slate,
the consolidation slate,
its run-off over the tied finalists
and the consolidation gate
print a labelled tense block for each text with a candidate
(`tense-candidate-block.ts`,
each sentence written as a JSON string);
no verdict,
flawed-archive count or run-off reads it.
Artifact generation 15 records the candidates for the audit trail,
on a contest slice (`lane-contest-tense.ts`)
and,
for the wording that shipped,
on a consolidation slice (`consolidate-shipped-tense.ts`);
the readers refuse the key in generation 14 and earlier,
on a `sole-lane` slice,
which asks no judge,
and on a consolidation slice that ships no wording of its own.
Replays tell the death only for a generation 15 artifact,
whose models saw it,
so an earlier artifact replays with the block its models saw.
No cache version moved:
each affected stage's run shape names the death and the subject names,
so an entry that records a death asks a new question under a new key,
and the three pinned-key witnesses keep their strings.

The port onto the branch head found a defect in the first draft:
its reader allowed the key from generation 14,
while the generation 15 `sole-lane` path (B425) returned before the key was read,
and its writer wrote the key on every slice,
so a sole-lane record would have been read with the key dropped.
The writer now skips a sole-lane slice and the reader refuses the key there.
The same port first logged an absent `info.yml` to standard output in two built commands whose terminal output is pinned;
the replays now record an absence in silence.

Decided by the owner on 2026-10-11 (UTC):
every model sees the death date;
the record holds candidates on contest and consolidation slices;
the subject names are the front matter `name` and its declared aliases.
Decided by the lead under the owner's instruction of the same day:
generation 15 alone;
no cache version bump;
a bare year counts as a recorded death;
the replay readers take the death date,
`corpus-run/page-republish.ts` included,
whose page never depends on the identity block
but whose pass already fails on a damaged `info.yml` at prepare.

### B423: nothing located the repeated wording a page-level consistency pass would read

Red `0916175337`,
fixed in `7bd373eb3f`.

Found on 2026-10-11 (UTC) in the read of TianqiChen66622,
whose source repeats one refrain four times and one sentence twice,
and whose page renders the refrain four ways and the sentence two ways.
The owner asked for a page-level consistency pass,
and nothing in the package located the repeats it would read.

The fix:
`repeatGroupsOf` (`repeat-groups.ts`) reads the body paragraphs of a page through `parseDocument`
and returns maximal repeats of twelve or more characters
and refrain frames
(a shared prefix of four or more characters,
a shared suffix of three or more,
and a varying slot of one to eight),
each occurrence placed in the slice that holds it whole.
An occurrence no slice holds,
as a sealed original or a refused section leaves it,
is listed in the group's `unplaced` with its offsets and why;
the first draft threw `unreachable:` there,
and both shapes reach it.
A group with a quoted occurrence,
or with every occurrence on one line,
is left out.
Hardened on the way to the merge:
an opening quotation mark counts as inside the quote,
a stray closing mark no longer drives the depth below zero,
an HTML comment inside a paragraph is no wording,
and lengths count code points where the first draft counted UTF-16 units.

The `repeat-census` task (read-only,
spends no quota) reruns the design's line reading
beside the package's detection over the 92 pinned entries.
At `7bd373eb3f` the line reading finds 76 groups on 48 pages
(68 maximal,
8 refrain);
the package finds 6 groups on 5 pages with no occurrence unplaced,
the line reading's 11 body-only groups less the same-line and quoted ones;
the live page's four refrain lines and two sentence lines are both found.

Decided by the owner on 2026-10-11 (UTC):
quoted repeats stay out of the groups.
Kept by the lead under the owner's instruction of the same day:
occurrences no slice holds whole are listed rather than refused;
lengths and slot bounds count code points while the line reading keeps UTF-16 units;
a paragraph holding `{` or an inline tag is left out whole,
where the alternative cuts only the tag;
the census modules sit on the own-test allowlist;
`maximalRunsOf` is exported through the index as a test seam;
same-line repeats stay out of the groups,
as the design recommended.

### B426: the repeat reader tested raw regions the parse had already hidden

Red `cda53b4338`,
fixed in `566de2e511`.

Found on 2026-10-12 (UTC) by an independent review of B423.
The wording reader ran its markup test and its inline cuts on the raw paragraph,
so a brace or tag inside an HTML comment,
inline code or a bare URL dropped the whole paragraph,
though the parse reads none of them as an expression or tag;
a URL or backtick inside a comment opened a cut that ran past `-->` and ate the wording after it;
a comment inside a repeat ended the run;
and an edge paragraph of a container carried the container's tags into the markup test,
which 37 paragraph ranges of the pinned corpus hold.

The fix:
the reader blanks comments and container tags,
reads them as whitespace,
and runs the markup test with hidden ranges and inline cuts blanked.
The groups over the 92 pinned pages did not change.

### B427: straight double quotation marks were not read as quotation

Red `cda53b4338`,
fixed in `566de2e511`.

The reader treated only corner brackets and curly marks as quotation,
so a repeat inside straight double marks was reported.
The pinned corpus writes ASCII `"` in 98 body paragraphs;
two of its characters,
in one paragraph,
reach the wording.

The fix:
a straight mark opens a quotation when none is open in its paragraph,
and closes the open one otherwise.

### B428: a repeat's slice depended on the order of the slice list

Red `cda53b4338`,
fixed in `566de2e511`.

`placementOf` took the first slice in list order that held an occurrence's start,
so with overlapping slices it reported `crosses-slice-end` for an occurrence another slice held whole.
The order of groups that start at the same offset was fixed by construction but stated nowhere.

The fix:
an occurrence goes to the slice with the lowest `sliceIndex` among those holding it whole;
`compareFoundRepeats` (`repeat-groups-order.ts`) states the group order.

### B429: the repeat finders grew with the square of their input

Red `cda53b4338`,
fixed in `566de2e511`.

`maximalRunsOf` extended every window group,
so a paragraph copied whole cost the square of its length
(8000 elements per copy took 2329 ms);
the refrain finder compared every pair of clauses sharing four leading elements;
and the line lookup sliced the page once per occurrence.

The fix:
a window group that is the previous one moved by one element is skipped
(the same copy takes 26 ms),
clauses are bucketed by both ends,
and line numbers come from one table of line starts.
The maximal runs of 20000 random streams and the groups of the 92 pinned pages are unchanged.
A page of clauses that nearly all share both ends is still quadratic,
as the TSDoc of `refrainFramesOf` says.
The largest pinned page takes tens of milliseconds.

### B430: three repeat modules were tested only through their caller

Red `cda53b4338`,
fixed in `566de2e511`.

`repeat-groups-bounds.ts`,
`repeat-groups-runs.ts` and `repeat-groups-wording.ts` sat on the own-test allowlist,
reached only through `repeatGroupsOf`,
the shape that hid the defects of B103.
They,
with `repeat-groups-refrain.ts` and `repeat-groups-order.ts` split off to meet the line limit,
now have unit tests of their own,
and the allowlist lines are gone.

Kept by the lead under the owner's instruction of 2026-10-11 to decide without asking:
an HTML comment is whitespace;
an opening mark that never closes quotes to the end of its paragraph;
invisible characters stay as wording;
overlapping slices place an occurrence in the lowest `sliceIndex`;
inline code is read on one line;
a lone carriage return is no line end;
emphasis marks stay as wording;
quotation marks no body paragraph of the corpus uses are not read;
the helpers are exported through `repeat-groups-barrel.ts`.
Changed by the lead's decision in a later commit:
a repeat that touches quoted speech anywhere stays out,
as the owner's answer of 2026-10-11 reads;
no two groups claim overlapping text;
the census fails when a positive control fails.

### B431: a repeated source line could ship rendered several ways on one page

Red `f59e887105`,
fixed in `c08beb9682`.

Found on 2026-10-11 (UTC) in the read of TianqiChen66622,
whose page rendered one refrain four ways and one sentence two ways;
the owner asked for a page-level consistency pass the same day.

The fix:
after the slices settle and the consolidation runs,
`runPassSettlement` (`corpus-run/pass-settlement.ts`) runs `runPassConsistency`.
For each repeat group (B423) whose places read differently,
it asks the wide bench one sheet,
reason before choice,
and counts the ballots in code (`consistency-count.ts`,
`consistency-majority.ts`).
A strict majority's quote,
located exactly once in each place's English,
or its refrain pattern carrying the place's own slot,
replaces the other places by code (`consistency-splice.ts`);
no model writes text.
A place the majority keeps for its context,
a tie,
no majority,
a gather below quorum
and an unlocated quote
leave the page as it stands,
recorded.
Each changed slice passes every floor with its current wording as incumbent,
a slice where the archive stands included,
or keeps its wording with a warning and a finding.
Any trouble inside the pass is contained and the page ships.
Artifact generation 15 carries the `consistency` section,
which joined the generation before any pass wrote one,
so the number did not move;
the reader recounts it from the ballots and refuses it in generation 14 and earlier.
The would-ship reader ranks the pass's text under the page assembly and over the polish.
The pass has its own cache namespace at `CONSISTENCY_CACHE_VERSION` 1.

Kept by the lead under the owner's instruction of 2026-10-11 to decide without asking:
the floors here are Markdown only,
since no repeat group holds front matter;
no second quoted-passage guard,
since the publication rule already refuses a lost quoted passage;
the earlier group wins an overlap,
though the groups are disjoint since B435.
Changed by the lead's decision,
in work still open when this entry was written:
the ten modules the pass's tests reached only through callers get tests of their own (B437);
`ConsistencyInvariantError` carries its message;
the consistency sheet shows the tense candidates (B419).

### B432: the tense detector read letters by case mapping, one UTF-16 unit at a time

Red `dd4d201aa2`,
fixed in `9f936b2c2a`.

Found on 2026-10-12 (UTC) by an independent review of B419.
`present-tense-words.ts` took a letter to be a character whose lower and upper case differ,
read by `charAt`,
so a name in Han or another caseless script,
or beyond the first plane,
never opened a word:
14 of the 131 aliases the pinned translations declare could never match.
`wordsOf`,
`namesAt` and `isSEndingWord` now read whole code points by general category.
All 131 aliases and 92 names match;
the candidate count per page did not move on the corpus.

### B433: tense records and sheets the review found loose

Red `dd4d201aa2`,
fixed in `9f936b2c2a`.

The same review found five more.
The pass republish read `info.yml` for every artifact it replays,
where the other replays read it only for generation 15 and later,
so a damaged file beside a generation 14 artifact left its page unrepublished;
`readSettledEntryInfo` is now the one gate.
A damaged `info.yml` threw the parser's own error,
which names no entry and quotes the person's metadata;
it now throws `EntryInfoParseError`,
which names the entry and where the parser stopped,
quotes nothing and carries no cause.
A `died` of a kind that is neither text nor a finite number
(a truth value,
a list,
a record,
a number that is not finite)
switched the feature off without a word;
it is now logged once per entry.
The contest and gate sheets chose the tense block's fence without the block's own lines,
which can hold a longer run of `=` than any text they came from.
The `died` identity line interpolated the raw value;
it is now a JSON string,
byte-identical for every date the corpus records,
so no key moved.
The reader accepted records the writer never writes:
an empty list,
empty groups,
any label;
it now requires the labels the slice's sheet gave,
once each and in order,
and the labels live in `tense-candidate-labels.ts`.

Measured on the pinned corpus:
89 of the 92 `info.yml` files record `died` as a date string and 3 record none;
the detector finds 113 candidates on 41 of the 89 pages that record a death.

Kept by the lead under the owner's instruction of 2026-10-11:
the unreadable-`died` warning sits in the entry reader;
a blank `died` and a top-level one stay silent;
aliases match with case folded;
an alias joined by a slash stays one name;
the detector reads top-level paragraphs only;
the keys name no detector version,
since a change to the detector moves the version of each stage it reaches by the cached-decisions rule.
Changed by the lead's decision,
in work still open when this entry was written:
a damaged `info.yml` is logged and the entry ships with no death recorded,
by the owner's rule that a run always ships;
the window-trial instrument shows the tense block as the pass does.

### B434: a repeat that carried quoted speech was reported when its run began in narration

Red `c5a5e78991`,
fixed in `36ada23b21`.

The owner answered on 2026-10-11 (UTC) to leave quoted repeats out,
yet `repeatGroupsOf` judged a run quoted only by where it began,
so a run that began in narration and carried speech was reported,
and the consistency pass (B431) could have rewritten part of a quotation.
Every character of every occurrence is now asked,
the marks themselves included,
for maximal repeats and refrains alike (`repeat-groups-quotation.ts`).
No group of the pinned corpus left.

### B435: repeat groups could claim overlapping text

Red `c5a5e78991`,
fixed in `36ada23b21`.

Periodic text,
a repeat nested in a longer one that fewer places share,
and a refrain frame over clauses a maximal repeat covers
each yielded groups whose occurrences overlap,
so the consistency pass would have spliced two renderings into one span.
`disjointRepeatsOf` (`repeat-groups-overlap.ts`) keeps the group covering the most wording code points,
drops any group whose occurrence shares a character with a kept one,
breaks ties by the stated group order,
and runs after the quoted and same-line filter and before placement.
The first draft weighed UTF-16 units and so counted text beyond the first plane double.
The pinned corpus held no overlapping group before or after.

### B436: the repeat census printed its positive controls and exited 0 whatever they read

Red `c5a5e78991`,
fixed in `36ada23b21`.

`repeat-census` now prints its whole summary,
then ends at the stated refusal code naming each control that read false,
an absent control entry counting as failed (`failedControlsOf`,
with tests of its own).

### B437: ten modules of the consistency pass were tested only through their callers

Red `f134107681`,
fixed in `a7a2a62c28`.

`artifact-two-lane-read-consistency-coherence.ts`,
`-fit.ts`,
`-occurrence.ts`,
`-parts.ts`,
`-verdict.ts`,
`pass-consistency-apply.ts`,
`-ask.ts`,
`-cache.ts`,
`-settle.ts` and `pass-settlement.ts`
stood on the own-test allowlist of `own-unit-tests.unit.test.ts`,
the shape that hid the defects of B103 and B430.
Each now has a test of its own and its allowlist line is gone.
Two fixtures serve them:
`consistency-group.test-fixture.ts` holds valid recorded groups changed one place per case,
and `consistency-refusal.test-fixture.ts` the whole text of an artifact refusal.
Every refusal case breaks one valid record one way and pins the whole message.
A mutation run over the ten modules left one equivalent mutant
(a located rendering carries no reason,
so the reason check throws either way)
and one choice no case can tell apart without the real clock
(the gather's grace is the round's window).
The cases found the defects of B438 to B440.

### B438: the consistency reader passed groups its writer never writes

Red `f134107681`,
fixed in `a7a2a62c28`.

`assertGroupFits` compared "is a frame" with "both slot offsets present",
so a place of a repeated run carrying one slot offset alone gave false against false and passed;
each offset is now held to the kind of repeat on its own.
It refused a group of two or more places under `too-few-placed`,
but not fewer than two under a verdict the writer gives only to two or more,
since `dispositionOf` answers `too-few-placed` first;
it now refuses fewer than two places under any verdict but `too-few-placed` and `failed`.
The writer sets both offsets or neither and never writes either shape,
so only a damaged file reached them.
(Changed on 2026-10-12 (UTC) by B448:
a `failed` group needs two places too,
since only a group put to the bench can fail and the bench is asked only with two.)

### B439: the consistency cache resumed a stored gather whose quorum no gather closes on

Red `f134107681`,
fixed in `a7a2a62c28`.

`isConsistencyRecord` tested only `Number.isInteger(quorum)`,
so a stored quorum of -1,
0 or 2 to the 60th resumed,
as did a record of fewer voices than its quorum.
The bench stores a gather only when its quorum is met,
and a quorum is at least one.
A resumed quorum of -1 was written into the group's verdict,
and the artifact reader then refused the run's own artifact.
A record now resumes only with an integer quorum of at least one and no fewer voices,
which also bounds it by what JSON carries exactly;
any other is asked again (the B249 shape).

### B440: the reader of an unplaced occurrence took a place with no bounds

Red `f134107681`,
fixed in `a7a2a62c28`.

`parseConsistencyUnplaced` took any three counts,
where the reader of a placed occurrence refuses a place ending at or before its start,
or on a line before the first.
One `requirePlaceBounds` (`artifact-two-lane-read-consistency-parts.ts`) now states the rule for both.

Found by the same work and changed by the lead's decision,
in work still open when this entry was written:
`reasonContradicted` (`artifact-two-lane-read-consistency-located.ts`) reads a place recorded
`not-found`,
`ambiguous`,
`slot-not-found` or `slot-ambiguous` as fine whatever the ballots quote;
and the region comment of `pass-consistency-apply.ts` says a replacement meant for a refused slice is recorded
`kept-floor`,
where one already `overlapped` stays `overlapped`.
Kept by the lead under the owner's instruction of 2026-10-11:
a `failed` group reads with any count of places;
the reader checks no slot order or containment,
which the writer cannot get wrong without failing its own splice.
(Both changed on 2026-10-12 (UTC):
the reader now refuses a `failed` group of fewer than two places (B448)
and a slot that does not start before it ends or lies outside its place (B444);
`reasonContradicted` was settled by B444 and the region comment by B448.)

### B441: a damaged info.yml stopped its entry and refused its replays

Red `a08a6634b7`,
fixed in `62a07ceeb9`.

Found on 2026-10-12 (UTC) by the lead's decision on B433,
against the owner's rule that a run always ships.
`readEntryInfoRecord` threw `EntryInfoParseError` for an `info.yml` that refused to parse,
so `preparePassEntry` stopped the entry before any paid call and its page did not ship,
and `readSettledEntryInfo` threw for the carve,
the audit and the republish of its artifact.
The reader now answers an `unreadable` record carrying the refusal,
which names the entry and where the parser stopped and quotes none of the file,
and warns when given a logger;
every consumer reads any record that is not `read` as no death,
so the entry goes on exactly as one whose `info.yml` records none.
`entryInfoFindingsOf` puts the refusal on the preparation's findings,
which the artifact records,
so a reader tells an unreadable record from an absent one with no new generation 15 key.
The replays read it the same way,
since the run recorded no death,
and warn only where the caller passes a logger:
the republish does,
the carve and the audit stay silent as their pinned output requires.
No cache key moved,
since the keys fold in an ended life only when there is one.
Changed by the lead's decision,
in work still open when this entry was written:
a `died` of a kind that is neither text nor a finite number,
which B433 logs,
also puts a finding on the artifact.

### B442: the window trial judged on sheets with no death and no tense block

Red `a08a6634b7`,
fixed in `62a07ceeb9`.

`runSliceArms` called `judgeTranslateSlate` with no ended life,
and `drawEntry` prepared the pair with no `sourceEntryInfo` and never read `info.yml`,
so the instrument measured sheets the pass does not ask.
`drawEntry` now reads the entry's `info.yml` after both pages
and returns the page facts of its preparation,
which `runWindowTrial`,
`runPick` and `runSliceArms` pass on as a required parameter;
the judges get all of them,
and the translators the identity block,
as the pass gives them.
`TRIAL_PROTOCOL_VERSION` is 2,
so a ledger bought on the older sheets is not resumed;
the trial reads no slice cache.
