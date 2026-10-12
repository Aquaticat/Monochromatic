# Audit ledger, part 06

Part 06 of [Audit ledger](audit-ledger.md),
whose index lists every part in order.

## Test suite, continued

### T8: code no unit test runs, continued

The batches now read against the whole suite at `d51526b60` under the census
(`census-oRsK9f`,
1,394 PASS lines and no FAIL line,
taken from a tree with nothing uncommitted under the package),
which is also the whole-suite run B34's barrel,
return-type and error-class changes had not yet had.
Library source holds 1,051 stretches over 2,581 lines in 407 files,
with 27 functions never called.
By the first construct each stretch's lines hold
(`t8-triage-orsk9f.txt`,
from `t8-triage.mjs` in the audit's scratch folder),
the queue is 290 returns,
274 ternaries,
221 nullish fallbacks,
141 throws
and 125 others.

The fifth batch (`fc9e80ca8`) took the comparison,
coherence,
digest
and identity modules,
12 stretches in seven files.
Ten were reachable and got cases:
repeated repair rows,
a repair slice the translate ledger lacks,
two ledgers in different orders
(which also runs the one cold sentence of `lane-comparison-fault.ts`),
a retained incumbent carrying other text,
the two wording faults no case reached,
the digest refusal's two plural ternaries,
and the identity of line-structured slices,
which the whole suite had never hashed.
The case named for repeated repair rows repeated both ledgers,
so the translate check refused first and the repair check it names never ran;
its fixture is now the one its name describes.
Two were unreachable and went:
`decisionsEqual`'s last return,
and the digest refusal's fallback for a first entry the non-empty list always has,
now `nonNullishOrThrow`.
The same change narrowed `compareDocumentLanes`' lookup after a length check with `nonNullishOrThrow`,
which the census had not listed as a stretch.
The digest refusal now names the first foreign entry by name,
since a directory lists its entries in no promised order.
Every refusal case in the batch's six test files reads its message whole,
and `LaneComparisonError`'s archive-kind sentence was reworded to read as English.
Its census (`census-Xs4MQy`) read against `census-oRsK9f`:
ran 4,
still cold 0,
and each of the four sources edited since then left no cold stretch in this run's own rows.
From this batch on,
each batch ends with a whole-suite census at its committed head,
which is the batch's whole-suite run and the next batch's baseline,
and each takes one cluster of the triage at a time.

That census at `a46136f5d` (`census-VdHVJb`,
1,395 PASS lines,
taken from a tree with nothing uncommitted under the package)
is the sixth batch's baseline.
Its suite log matches the FAIL pattern once,
in the census test's own fixture command,
as `census-oRsK9f`'s log did.
Library source holds 1,039 stretches over 2,541 lines in 400 files,
with 27 functions never called.
By the first construct each stretch's lines hold
(`t8-triage-vdhvjb.txt`),
the queue is 288 returns,
271 ternaries,
220 nullish fallbacks,
135 throws
and 125 others.
The largest clusters are the translate modules
(70 stretches),
repair (46),
the corpus-run pass (31)
and the corpus-run artifact readers (26);
the sixth batch takes the translate modules.

Every census through `census-VdHVJb` measured a compressed build (M79).
Reading the sixth batch's first stretches found a guard,
`if (node === undefined) continue;` in `translate-skeleton.ts`,
that the census never listed although no test can reach it:
the bundle wrote it as `node!==void 0&&(…)`,
whose untaken side has no V8 range.
A whole-suite census of the same commit on a build with `minify: false`
(`census-gMPS3j`,
1,395 passes,
taken with only the coverage config edited)
lists 1,184 library stretches over 2,481 lines in 418 files,
against 1,039 over 2,541 in 400;
`census-compare.mjs` in the audit's scratch folder reads 289 lines in 133 sources only it calls cold
and 370 lines in 108 sources only the compressed build does.
Both guards that started this appear only in the unminified census
(`translate-skeleton.ts` 273,
`inspect-paragraph.ts` 303),
beside nine guard returns of `isAbsoluteNaturalnessReviewWire`
(lines 165 to 196)
that compression had folded into logical expressions.
Every row read on the other side is a line that ran:
a condition line beside its cold return
(`prompt-payload-store.ts` 191 and 207,
`list-spread-restore.ts` 181,
`seed-detection.ts` 122),
or a span stretched over lines that ran,
where a swapped arm maps across the branch between
(`refine-eligibility.ts` 241 to 283 against 241 to 244,
`attribution-read.ts` 57 to 68 against 57,
61 and 67,
`window-trial-probe.ts` 142 to 240 against 142 to 202 and 218 to 240).
The coverage build now keeps the source as written,
and the census refuses a minified build before the suite runs (`requireUnminifiedBuild`):
rolldown opens each module's code with a region comment only where it does not minify,
and the compressed normal build held none in any chunk,
the unminified one held one in 174 of its 175
(all but the index,
which only re-exports).
A unit test importing the build config was the first guard written,
and the package lint refused it
(`test-import(require-eventual-artifact)`:
tests import what the package ships);
the census's own refusal also covers a compressed build reaching the directory any other way.
The five batches' readings stand for what a compressed build could show;
a file they closed can hold a folded guard,
and the next baseline,
the first taken unminified,
lists it again for its cluster.
The suite passing 1,395 times on both builds also says the tests do not depend on minification,
which matters now that the census runs them against a build that differs from the shipped one.
Put back to compressed,
the coverage build met the new refusal before the suite ran:
the census named 174 mapped bundles with no module region comment and ran no test.

The sixth batch's baseline is that commit's whole-suite census
(`aeab4cfad`,
`census-xBFoZt`,
1,396 PASS lines,
taken from a tree with nothing uncommitted),
whose library counts match `census-gMPS3j`'s:
1,184 stretches over 2,481 lines in 418 files,
with 27 functions never called.
By the first construct each stretch's lines hold
(`t8-triage-xbfozt.txt`),
the queue is 420 returns,
269 ternaries,
219 nullish fallbacks,
137 throws
and 139 others.
The triage's "uncalled function" kind is new:
it counts stretches the census names by the function they span,
and the census names 31 stretches under `src/` that way here against 1 in `census-VdHVJb`,
25 of them in library source.
The translate modules are still the largest cluster
(73 stretches in 28 files),
and the sixth batch takes them.

The sixth batch closed the cluster's 73 stretches in 28 files,
read file by file from `census-xBFoZt`'s rows:
44 reached by new cases,
17 removed as unreachable
(a `nonNullishOrThrow` where the value always exists,
a parameter every caller passes made required,
a record type that carries the field,
a loop keyed on its own pop),
and 12 restructured so no statement of their own remains,
each new shape reached by cases.
By commit:
`62ad2c084` (ledger B35) removed the definition-leak and marker-drop key fallbacks (2);
`f792174a2` restructured the formula and skeleton rethrows and work-stack walks (4);
`92335e14a` (B36) reached the plain-markdown reading's catch and removed the validator's empty-skeleton alternate (2);
`c5adca0f7` removed the reporter's dropped-names fallback with a record union (1);
`0c2704754` reached ten address and suicide-floor stretches and removed two fallbacks (12);
`15ea09099` (B37) rewrote the atom floor's count arm (1);
`c44cfd311` (B38) moved the Latin title floor's stop into the paired-mark reader (1);
`53727c304` reached the link-name,
Han title,
Han residue and sheet-leak stretches (10);
`20d0b873f` reached three signer and run-off stretches and removed five (8);
`c3c240e5a` reached the judge's blank-span exit and the author repair's three arms (4);
`0da72d2e3` reached three retry stretches,
restructured one and removed the loop's cap (5);
`1e02727d6` (B39) restructured the slice attempt's rethrow and removed its no-voice conversion (2);
`ada092329` reached ten threading and exit stretches in the stage,
its repair half,
the producer and the document driver,
removed four conditional spreads and restructured one rethrow (15);
`a589d1fde` removed the stage's stand-in for a refusal naming nothing (1);
`83d4cd981` (B42) reached two translate-slice stretches and the rewritten quote refusal (3);
`b546d1b2d` restructured the blank-record throw into a tested helper (1);
`0fcb75c7b` reached the stage's line for an original no grammar reads (1).
Named apart:
`a589d1fde` left `floorFindings`' arm for a pass with no caller able to reach it,
a stretch of the batch's own making that the census at `b546d1b2d` showed and `0fcb75c7b` removed (M80);
and the quote refusal read as unreachable until a probe found the guard counting quotes the floor does not,
which is B42.
The whole-suite census at `0fcb75c7b`
(`census-6nasbO`,
1,410 passes,
taken clean)
read against `census-xBFoZt`:
ran 16,
still cold 0,
not loaded 0,
claimed sources with no stretch there 0,
sources edited since then 20,
and each edited source "loaded it and left 0 cold stretches".
The batch's control copy,
the slice guards' test (`translate-slice-guards.unit.test.ts`,
committed as `translate-slice-settle.unit.test.ts`,
a name `translate-slice-settle.ts` already meant)
with its shipped-quote case expecting a refusal,
failed on that case alone.
The defects the batch found are B35 to B42;
B43 was open at its close.
The shell rule (M1) held in every call since the batch's last context resume;
the calls before it were not re-read.

The seventh batch's baseline is that commit's whole-suite census
(`0fcb75c7b`,
`census-6nasbO`,
1,410 passes,
taken from a tree with nothing uncommitted):
library source holds 1,095 stretches over 2,302 lines in 386 files,
with 26 functions never called.
By the first construct each stretch's lines hold
(`t8-triage-6nasbo.txt`),
the queue is 402 returns,
244 ternaries,
206 nullish fallbacks,
122 throws
and 121 others.
The repair modules are now the largest cluster
(46 stretches in 17 files),
and the seventh batch takes them.

B43 and B45 landed between the batches,
so the seventh batch reads against the census at their last commit instead
(`d780418f7`,
`census-v7Dz0r`,
1,417 passes,
taken clean):
library source holds 1,092 stretches over 2,276 lines in 385 files,
with 26 functions never called.
By the first construct
(`t8-triage-v7dz0r.txt`),
the queue is 400 returns,
244 ternaries,
206 nullish fallbacks,
121 throws
and 121 others,
and the repair cluster still holds 46 stretches over 148 lines in 17 files.

The seventh batch took the repair modules against `census-v7Dz0r`
and addressed all 46 of their stretches in 17 files,
read file by file from the coverage build
(`t8-batch7-spans.txt` in the audit's scratch folder holds each stretch's code):
`da99d5b69` removed the per-run adjudication override,
whose conditional spreads were 7 of the rows,
together with its hops outside the cluster
(`document-lanes.ts` and `panel-stage.ts`)
(7);
`40b9eb0b4` made the deadline required in the repair entry,
the driver and the benchmark,
since every production caller states one (2);
`9fbc8c19d` handed the chunk proof the window the stages saw
instead of rebuilding it from two optional texts (2);
`b91a05e1b` reached the stretches of the grade reader,
the scorecard,
the benchmark,
the cache gate and the sheet,
restructured the issue record's probe counts,
the damage evidence's report read
and the driver's dominance reading so no arm is left that no input can take,
and made the benchmark throw the caller's abort reason (16);
`63140e337` reached the resume discard and both refusals under a live signal,
the unprepared-slice check with the lane off,
and made the lane wordings leave an unmade slice to the coverage check (5);
`26ad14044` reached the chunk's three unchanged exits,
the gate's refusal counts
(sorted as finished lines,
since one editor reply can raise only two kinds),
the worse-vote strip's exit where every edit goes and the editor's rule addendum,
and threaded attested details to the screen (13);
`06f231981` read the worse-voted issues off the checker tallies,
removing a lookup for an issue with no tally (1).
Named apart:
`26ad14044`'s message said a case reached that lookup's miss;
the census at that commit still read it cold,
and no input can reach it,
since the checker stage keeps a tally for every accepted issue,
one no checker voted on included.
The source comment calling that tally absent was wrong too.
A commit comment on `26ad14044` corrects the message,
and `06f231981` removed the lookup and the comment.
The adjudication thresholds are now keyed nowhere,
since no run can change them;
the run shape keeps `null` in their slot so no settled slice's key moved,
which the key test's pinned literal shows
(it failed with the slot removed and passed with it restored),
and a change to `DEFAULT_ADJUDICATION_CONFIG` now bumps `SLICE_CACHE_VERSION`.
The benchmark's scorecard reads coverage 1 over no records while every rate reads 0 on an empty denominator;
coverage asks what share of entries ran and a rate what share of seeds came back,
so the asymmetry is kept.
The batch's calls under the owner's standing quality directive,
each open to veto:
removing the per-run adjudication override,
requiring the three deadlines,
the benchmark throwing the caller's abort reason,
the lane wordings leaving an outcome for an unmade slice to the coverage check,
and that scorecard asymmetry.
A second opinion on the batch plan found `repair-slice-settle.ts` 259 to 271 missing from it
and the benchmark's abort rethrow at odds with every other catch in the package;
both were taken up.
The batch's control copy,
`repair-chunk-exits.unit.test.ts` with its worse-strip case expecting a change,
failed on that case alone.

The whole-suite census at `26ad14044`
(`census-zCwMAm`,
1,421 passes,
taken clean)
read against `census-v7Dz0r`:
ran 9,
still cold 1,395,
not loaded 6,
claimed sources with no stretch there 0,
sources edited since then 15,
and each edited repair source "loaded it and left 0 cold stretches"
but `repair-worse-strip.ts`,
which left the lookup `06f231981` then removed.
The census at `06f231981`
(`census-dUOMFS`,
1,421 passes,
taken clean)
reads the same counts against `census-v7Dz0r`,
with every edited repair source at 0.
The 9 rows that ran are the rows of the four cluster files the batch reached without editing
(`repair-sheet.ts` 5,
`repair-grade-read.ts` 2,
`repair-scorecard.ts` 1,
`repair-cache-gate.ts` 1),
listed by comparing the two census files
(`t8-batch7-ran-rows.mjs` in the audit's scratch folder).
The two hop files left 1 (`document-lanes.ts`) and 2 (`panel-stage.ts`):
the baseline rows the removed hops did not cover
(429,
136 and 178,
each now a line or more earlier),
which stay in the queue for their own clusters.
Library source went from 1,092 stretches to 1,044,
the cluster's 46 and the hops' 2,
so the batch left none of its own making.

The eighth batch's baseline is that census
(`06f231981`,
`census-dUOMFS`):
library source holds 1,044 stretches over 2,125 lines in 368 files,
with 20 functions never called.
By the first construct
(`t8-triage-duomfs.txt`),
the queue is 394 returns,
220 ternaries,
200 nullish fallbacks,
117 throws
and 113 others.
The consolidation modules are now the largest cluster,
55 stretches in 17 files
(the triage's `consolidation` and `consolidate` prefixes,
30 and 25,
name one feature),
and the eighth batch takes them.

The eighth batch took the consolidation modules against `census-dUOMFS`
in fourteen code commits,
`62a745069` to `0fba3dea4`,
and entries B46 to B52.
Its census at `0fba3dea4`
(`census-SfAXnI`,
1,429 passes,
taken clean)
reads against `census-dUOMFS`:
ran 5,
still cold 1,327,
not loaded 6,
claimed sources with no stretch there 0,
sources edited since then 18.
Every edited consolidation source "loaded it and left 0 cold stretches";
the two edited sources outside the cluster that kept any are `lane-contest-key.ts` (1)
and `refine-stage.ts` (2,
its baseline rows 302 and 352).
The 5 rows that ran are the cluster files the batch reached without editing
(`consolidate-lane-offer.ts`,
`consolidation-polish-apply.ts`,
`consolidate-settle-context.ts`,
`consolidate-standing-verdict.ts`
and `consolidation-polish-config.ts`),
and the 6 not loaded are one unmapped chunk whose bundle name changed.
Library source went from 1,044 stretches to 976:
per-file counts compared between the two census files give the cluster's 55,
all 17 files now at none,
and 13 outside it
(`lane-contest-wire.ts` 7,
`refine-prompt.ts` 2,
`run-seats.ts` 2,
`refine-stage.ts` 1,
`artifact-two-lane-consolidate.ts` 1),
removed with the arms that B46,
B47,
B52 and the run roster's needless fallbacks took out.

The ninth batch's baseline is that census
(`0fba3dea4`,
`census-SfAXnI`):
library source holds 976 stretches over 1,982 lines in 347 files,
with 19 functions never called.
By the first construct
(`t8-triage-sfaxni.txt`),
the queue is 372 returns,
197 nullish fallbacks,
182 ternaries,
114 throws
and 111 others.
The largest cluster is the corpus-run passes,
31 stretches in 16 files
(the triage's `corpus-run/pass` prefix),
and the ninth batch takes them.

The ninth batch took the corpus-run passes against `census-SfAXnI`
in fifteen code commits,
`b7cab3bbb` to `51b888ac2`,
and entries B53 to B55.
Its census at `51b888ac2`
(`census-VW2tHL`,
1,437 passes,
taken clean)
reads against `census-SfAXnI`:
ran 18,
still cold 1,291,
not loaded 6,
claimed sources with no stretch there 0,
sources edited since then 11.
Every edited pass source "loaded it and left 0 cold stretches";
the one edited source outside the cluster is `archive-footnote-order.ts`,
which left 1 (B55 moved its order check).
Of the 18 rows that ran,
12 are the cluster files the batch reached without editing
(`pass-generation-guard.ts` 5,
`pass-footnote-relabel-read.ts` 2,
`pass-page-assembly.ts` 2,
`pass-contest.ts`,
`pass-entry-persist.ts`
and `pass-insertion-admission.ts` 1 each),
and 6 lie outside it,
reached by the new `settleEntry` cases
(`lane-contest-driver.ts` 2,
`artifact-two-lane-build.ts`,
`prepare-with-pairing.ts`,
`pair-definition-order.ts`
and `reference-attest-stage.ts` 1 each);
the 6 not loaded are one unmapped chunk whose bundle name changed,
6 stretches before and after.
Library source went from 976 stretches to 938:
per-file counts compared between the two census files give the cluster's 31,
all 16 files now at none,
and 7 outside it,
the 6 that ran and `archive-footnote-order.ts`'s 1.
The row at `pass-entry.ts:313` moved with its loop into `pass-carried-fold.ts`,
which the census lists among loaded sources and nowhere among cold ones.

How the rows closed,
by commit:
`b7cab3bbb` typed the seats' repair models as the run's,
whose refiners are required,
and dropped the pass's polish-disabled and missing-map arms (4 rows);
`cc59c4803` narrowed three refusal catches through one helper each
and cased the decline's removal failure (4);
`1556de391` refused a non-artifact apart in the schema guard (B53)
and cased the guards' counted wording (7);
`8f3eee26d` cased the footnote relabel's disagreeing evidence and interleaved definitions (4);
`1a6e0db7c` handed the archive-note reader the entry's logger
and cased both its readings and the whole-page decline through `settleEntry` (2);
`50595604b` cased a cited reference reaching the contest and consolidation sheets
and an attested detail reaching the translators' (4);
`5cf4536e8` cased a sealed span through `settleEntry`
and at `publishFixedPage`,
the one place the seal speaks (2);
`f18381be1` cased a page pass's correction and both its warnings through `settleEntry` (2);
`7c3c3e3b5` cased the container-deficit finding the admission logs (1);
and `51b888ac2` moved the carried fold and its log loops behind an injected logger
and cased a fold and a stand-aside (1).
B54 and B55 came from reading the relabel and the preparation's findings for those cases.

The tenth batch's baseline is that census
(`51b888ac2`,
`census-VW2tHL`):
library source holds 938 stretches over 1,893 lines in 329 files,
with 19 functions never called.
By the first construct
(`t8-triage-vw2thl.txt`),
the queue is 366 returns,
196 nullish fallbacks,
161 ternaries,
110 throws
and 105 others.
Three clusters tie at 26 stretches:
`align` (5 files,
39 lines),
`corpus-run/artifact` (8 files,
35 lines)
and `corpus-run/title` (4 files,
41 lines).
The tie goes to the most cold lines,
so the tenth batch takes `corpus-run/title`.

The tenth batch took the corpus-run title modules against `census-VW2tHL`
in nine code commits,
`7e3772ba8` to `95ca288cd`,
and entries B57 to B60.
Its census at `95ca288cd`
(`census-BF4g7o`,
1,445 passes,
taken clean)
reads against `census-VW2tHL`:
ran 3,
still cold 1,220,
not loaded 6,
claimed sources with no stretch there 0,
sources edited since then 16.
The four title sources are among the edited ones,
and each "loaded it and left 0 cold stretches";
the two modules B59 split from them,
`title-reference-link.ts` and `title-reference-rewrite.ts`,
are new since the baseline,
and the census lists both among loaded sources and neither among cold ones or functions never called.
The other twelve edited sources are B56's (`9a02d8e0b`),
committed after the baseline was taken.
Library source went from 938 stretches to 900:
per-file counts compared between the two census files give the cluster's 26
(`title-reference-unify.ts` 12,
`title-reference-locate.ts` 7,
`title-reference-scope.ts` 6,
`title-reference-marks.ts` 1),
all four files now at none,
and B56's 12 in nine files:
the ten rethrow arms it named,
and `settled-carve.ts`'s two early returns in its own `isMissingPath`,
which B56 removed
(lines 158 and 160 at `51b888ac2`).
`settled-carve.ts` went from 4 to none;
`bedrock-ledger.ts`,
`page-republish.ts`,
`published-tree-listing.ts`,
`runs-lock.ts`,
`sheet-path.ts`,
`sheet-write.ts`,
`slice-cache-dir-read.ts`
and `window-trial-ledger.ts` lost one each.
No library file outside those changed its count.
The census does not list the 3 rows that ran;
by inference from the per-file counts they lie in the other packages' sources,
where `with-timeout.ts` (`async-time`) went from 1 to none and `create-logger.ts` (`logger`) from 16 to 14,
while `error-format.ts` (`logger`) went from 1 to 3;
the 6 not loaded are the unmapped `wording-key` chunk under a new bundle name,
6 stretches before and after.

How the rows closed,
by commit:
`7e3772ba8` replaced the unreachable fallbacks with narrowings that throw
(`unify` 176,
189 and 444-445,
`scope` 359)
and read the marked spans as first and rest,
with a case for two spans both carrying the heading (`marks` 235);
`fdceec645` (B57) cased a page carrying the destination with no `[` before it (`locate` 196);
`ae29c52fa` (B58) cased a glossed run longer than the heading (`unify` 342 and 477-480);
`a90f7fd98` (B60) cased two headings rendering one title apart (`unify` 197 and 209);
and `95ca288cd` cased the rest:
a heading glossing its own title,
one with a Latin letter in its original title,
one rendered as its gloss alone and one left in Han (`unify` 122-127,
184,
193 and 195),
an original link that never closes and a page that quotes a linked title (`locate` 152 and 187),
a gloss after a quoted title,
one opening the page
and a run reaching the page's start (`locate` 249,
282-284,
320-322 and 351-353),
the five scope arms (`scope` 130,
166,
210,
358 and 438)
and a quoted span's trailing period (`unify` 314).
B57 to B60 came from reading those arms against the pass's own rules.
The batch's control copy,
the marks test with the trailing-period case expecting the span unrewritten,
failed on that case alone and was deleted.

The eleventh batch's baseline is that census
(`95ca288cd`,
`census-BF4g7o`):
library source holds 900 stretches over 1,821 lines in 321 files,
with 19 functions never called.
By the first construct
(`t8-triage-bf4g7o.txt`),
the queue is 348 returns,
192 nullish fallbacks,
158 ternaries,
100 throws
and 102 others.
Two clusters tie at 26 stretches:
`align` (5 files,
39 lines)
and `corpus-run/artifact` (8 files,
35 lines).
The tie goes to the most cold lines,
so the eleventh batch takes `align`.

The eleventh batch took the alignment modules against `census-BF4g7o`
in three code commits,
`c5fd0b03e` to `791bc45fe`,
and no entry of its own.
Its census at `791bc45fe`
(`census-5PAw2O`,
1,446 passes,
taken clean)
reads against `census-BF4g7o`:
ran 0,
still cold 1,227,
not loaded 6,
claimed sources with no stretch there 0,
sources edited since then 5.
The five edited sources are the cluster's,
and each "loaded it and left 0 cold stretches";
`table-cell.ts`,
new since the baseline,
is among the census file's loaded sources
and holds no cold stretch and no function never called.
Library source went from 900 stretches to 874:
per-file counts compared between the two census files give the cluster's 26
(`align-headings-optimal.ts` 10,
`align-headings-forced.ts` 7,
`align-blocks-walk.ts` 5,
`align-headings-grid.ts` 3,
`align-blocks.ts` 1),
all five files now at none,
and no other library file changed its count.
The 6 not loaded are the unmapped `wording-key` chunk,
6 stretches before and after.
Three files of other packages moved,
and no commit since `cce456093` edits either package:
`with-timeout.ts` (`async-time`) went from none to 1,
`create-logger.ts` (`logger`) from 14 to 16
and `error-format.ts` (`logger`) from 3 to 1.
Read by line in the eight census files from `census-qTbkjB` on,
those three files hold the same stretches in each but `census-BF4g7o`,
whose run alone reached the timer callback in `with-timeout.ts` (lines 57 to 59),
the sink verification failure in `create-logger.ts` (240 to 247 and 366 to 373)
and `error-format.ts`'s lines 31 to 58 but for 41,
49,
50 and 52.
So the tenth batch's "ran 3" are the `with-timeout.ts` stretch and the two `create-logger.ts` ones.
Every test at `95ca288cd` is in this suite unchanged
(the batch's test changes are 34 added lines in `align-blocks.unit.test.ts` and the new `table-cell.unit.test.ts`),
so by inference a timeout and a sink failure of that one run reached them,
not code a commit reached,
and they are cold again here.
The reading printed none of that:
it reads only the baseline's stretches,
so the stretches that went cold again,
and a cold stretch in a source new since the baseline,
are counted nowhere (B61,
found with B62).

How the rows closed,
by commit:
`c5fd0b03e` replaced the unreachable fallbacks with narrowings that throw,
most through a new `tableCell` read (`table-cell.ts`)
(`grid` 210,
247 and 249,
`optimal` 111,
219,
297,
365,
387 and 406,
all seven of `forced`,
`walk` 183,
189-190,
201-202 and 208-209),
dropped the optimal scan's checks for a cell no filled table leaves unreached (`optimal` 203 and 345),
called `pairScore` where the scan wrote its body out (`optimal` 351 and 360)
and let each traceback move name its own step (`walk` 313-320);
`40b2cd1ff` cased two blocks with no characters (`align-blocks.ts` 238);
and `791bc45fe` summed both sides' characters through one `charsAcross`,
where `estimateExpansion` had written the same reducer twice.
The duplicate-body guard did not report that copy:
the reducer's body is 42 characters once comments and whitespace go,
under the guard's floor of 80.
Every row but 238 is an index read into a table whose size fixes the index,
and 238 guards input the exported scorer accepts though no parse writes it.
With that guard removed the empty-block case alone failed,
and the guard was restored with no diff.
The batch's control copy,
the align-blocks test with the empty-block case expecting a non-finite score,
failed on that case alone and was deleted.

The twelfth batch's baseline is that census
(`791bc45fe`,
`census-5PAw2O`):
library source holds 874 stretches over 1,782 lines in 316 files,
with 19 functions never called.
By the first construct
(`t8-triage-5paw2o.txt`),
the queue is 347 returns,
171 nullish fallbacks,
158 ternaries,
99 throws
and 99 others.
`corpus-run/artifact` leads alone,
with 26 stretches in 8 files over 35 lines,
so the twelfth batch takes it.

B61 and B62 were fixed before the twelfth batch began
(`48c580d16` to `4304d167d`),
so the batch reads against a census taken after them:
the whole suite at `4304d167d`
(`census-7D4Vp9`,
1,447 passes,
taken clean)
reads against `census-5PAw2O`:
ran 0,
still cold 1,228,
cold since then 0,
not loaded 6,
claimed sources with no stretch there 0,
sources edited since then 0.
No stretch ran,
none went cold
and no source with a stretch in either census changed,
so the queue and the twelfth batch's cluster stand as read from `census-5PAw2O`;
per-file counts compared between the two census files agree in every source.
The reading's unmapped fix (`5af5eeec8` and `ce32e438d`) came after this census
and changes nothing it read,
since both censuses carry the unmapped chunk under the same bundle name.

The twelfth batch took the artifact modules of `corpus-run` against `census-7D4Vp9`
in ten code commits,
`21d3654d5` to `99eed862e`,
and two entries of its own,
B63 and B64.
Its census at `99eed862e`
(`census-aoSuO0`,
1,458 passes,
taken clean)
reads against `census-7D4Vp9`:
ran 2,
still cold 1,164,
cold since then 0,
not loaded 6,
claimed sources with no stretch there 0,
sources edited since then 14.
The 2 that ran are `artifact-two-lane-project.ts`'s two stretches,
the one cluster source the batch never edited.
Of the 14 edited sources,
seven are the rest of the cluster,
and each "loaded it and left 0 cold stretches";
the other seven were edited by B63,
B64 and the plural-word helper,
and per-file counts compared between the two census files give each of them the count it had
(`attribution-read.ts` 11,
`editor-standing-read.ts` 13,
`verify-published.ts` 6,
`line-structure-guard.ts` 5,
`page-republish.ts`,
`pool-generation.ts` and `rendering-audit-settled-input.ts` 1 each).
Library source went from 874 stretches over 1,782 lines in 316 files to 848 over 1,747 in 308:
the cluster's 26
(`artifact-eligible.ts` 6,
`artifact-two-lane-rebuild-rows.ts` 5,
`artifact-generation.ts`,
`artifact-placement.ts`,
`artifact-pool-refusal.ts` and `artifact-provenance.ts` 3 each,
`artifact-two-lane-project.ts` 2,
`artifact-two-lane-verify.ts` 1),
all eight files now at none,
and no other library file changed its count.
Entry files keep 30 stretches,
over 754 lines where they covered 778:
`editor-standing-read.ts` holds its 13 over 114 lines where it held them over 138.
Other packages' sources are unchanged at 61 files and 324 stretches.
The 6 not loaded are the unmapped `wording-key` chunk,
now named `wording-key-BponvTmf.mjs` where it was `wording-key-DoHfCZX0.mjs`,
6 stretches under each name.
The bundles no test loaded are still 36,
carrying 38 sources over 13,323 lines where they carried 39 over 13,450:
`runs-layout.ts`,
which `runs-layout.unit.test.ts` (new in the batch) loads,
is no longer among the library sources only those bundles carry.
