# Audit ledger: outcome rules and stage records

Rules that decide what a slice ships and what a stage records:
exits an outcome rule could not reach,
records that dropped a round,
and work no floor could check.

Part of [Audit ledger](audit-ledger.md),
which lists every file of this record.

## B39: an empty slate over wording the floor refused stopped the entry

Status:
fixed 2026-09-30 (UTC) with the sixth T8 batch,
found reading `translate-slice-attempt.ts` 189,
the rethrow of an absence refusal on a slice the archive translates,
which its comment called a backstop no input reaches.
A slice whose archive wording the deterministic floor refuses
reaches the translate stage as an absent incumbent,
withheld rather than missing (`translate-stage.ts`).
The owner's rule keeps the archive at a slice no wording passed and ships
(2026-09-27,
"No valid wording"),
and "Preference + polish" made the follow-up round ship its preferred candidate past a declined challenge round.
That rule reached the judge's decline exit and not its empty-slate exit:
where every translator was heard and none proposed wording the floor accepts,
the slate was empty in both rounds,
the judge raised `no-candidate` with the message that the archive has no translation,
the stage rethrew it,
and the slice attempt rethrew it for a content slice,
so the entry stopped where the rule says it ships.
A case running the stage over such a slice
(the address floor refusing the archive and every translator's defended narration)
raised `no-candidate` on the build from before the fix.
Whether any run met it is not measured.

Fix:
on the round that ships past a decline,
an empty slate whose translators were heard keeps the withheld wording and names `no-candidate`,
the same record a present incumbent's empty slate returns;
a slate nobody was heard on still raises,
and the stage still turns that into a provider interruption,
since it says nothing about the passage.
The slice attempt now returns an unfilled slice only for an absence over an insertion slice
and rethrows everything else in one statement,
a content slice's absence among it,
so the backstop stands with no statement of its own;
its branch for `no-voice-heard` is gone,
since the stage converts that reason before the attempt sees it.
`translate-withheld-empty-slate.unit.test.ts` pins the whole kept record,
and that a slate nobody was heard on still interrupts.
The stage's record keeps the archive's wording,
so the translate cache account takes this change before a launch.

## B41: the translate stage's record dropped its first round

Status:
fixed 2026-09-30 (UTC),
found reading `runTranslateRepairs` for the B39 fix.
A slice whose incumbent is absent or withheld gets a follow-up round when the first round's judges reject every candidate,
and `runTranslateRepairs` returned the follow-up round's record as it stood,
or rethrew the follow-up's absence as it stood.
The first round's findings reached the follow-up's translators as evidence,
and nothing else kept them:
a slice filled at depth two recorded no decline at all
(read from the code),
and one left unfilled recorded a single round,
where the judges' retry beside it carries every ask it made
("so the record shows each ask rather than only the one that answered",
`translate-retry.ts`)
and a stage case pins that a settled absence carries the evidence of the work that led to it.
Measured on the build from before the fix:
the depth-two absence in `translate-stage.unit.test.ts` carried the 7 findings of one round,
where the two rounds make 15.

Fix:
the record and the settled absence carry the first round's findings,
then `translate-followup-round (after <reason>, <count> rejected candidates)`,
the sentence the log already wrote,
then the follow-up round's own.
Nothing in the package parses a stage record's findings
(`rg` over the source outside the translate modules finds no reader of a translate finding by name),
so the change reaches the records alone.
The rethrown absence carries no finalists,
since every absence the judges' retry lets out is built without them.
The stage case compares the whole record around the named follow-up,
and the B39 case pins both rounds on the kept record.
The translate records change,
so the cache-account audit before a launch takes this change beside B36 to B40.

## B43: where the floor compares nothing, the stage withholds the archive and lets a candidate stand

Status:
fixed 2026-09-30 (UTC),
found that day closing `translate-stage.ts` 62 in the coverage census's sixth batch.
Where the floor can compare nothing
(an original the strict grammar cannot read,
or a page neither grammar reads),
`validateTranslatedSlice` answers `unknown`.
The stage keeps the archive off the slate on it,
since the archive stands only on a pass,
while the author repair lets a candidate stand unvalidated (`translate-repair.ts`),
and every later reader takes `unknown` as no pass:
the consolidation's standing check (`readStandingVerdict`),
the lane offer (`consolidate-lane-offer.ts`),
the contest's eligibility (`lane-contest-eligibility.ts`)
and the polish round (`consolidation-polish-round.ts`).
Reach at the pin:
0 of 1,351 slices over the 92 entries have an original the strict grammar cannot read
(`~/temp/agent/audit-glossary-fix/t8b6-unreadable-originals.mjs`,
whose positive control flags an unclosed tag).

Measured with fixtures on 2026-09-30:
where the contest backed either lane,
the consolidation refuses both lanes' texts and the archive alike and ships the archive
(`incumbent-only`;
`consolidate-driver.unit.test.ts`,
"SHIPS THE ARCHIVE where the floor can compare nothing"),
so on a contested slice the stage's calls are waste;
but an admitted insertion whose original no grammar reads ships the translate lane's unvalidated rendering into the page
(a scratch case over `translateDocument`,
status complete and the rendering in the page),
since no consolidation reads an insertion slice.
That is wrong output,
reaching no pinned slice.

Decided,
for the owner to veto:
a slice no grammar can floor settles before any call,
on the archive where there is one,
unfilled where there is none,
with a finding naming the floor's reason.
The revision round is not the place,
since a finding about an unreadable original is one no translator can act on.

First half,
2026-09-30:
whether the floor can compare anything is read once,
in `translate-floor-ground.ts`,
and both floors take their `unknown` details from it
(`validateTranslatedSlice` for Markdown,
`validateFrontMatterTranslation` for front matter),
so the stage can ask the floor's own question before it buys a round.
The Markdown floor keeps its order:
a candidate the strict grammar refuses against a readable original is refused before an unread page is reported.
`translate-floor-ground.unit.test.ts` pins each way a side goes unread,
and that the floor's detail is the ground's for the same slice.

Fix:
`runTranslateStage` asks `floorReach` of the original and the page every candidate is floored against,
after the roster check and before anything is bought.
On a blind slice `settleUnflooredSlice` (`translate-unfloored.ts`) settles it:
where the archive has wording,
the archive stands under the new decision `unfloored`,
with nobody heard,
no slate
and the finding `translate-unfloored (<the floor's detail>)`;
where it has none,
the stage raises the absence with the new reason `unfloored`,
which the slice attempt turns into an unfilled passage and the driver never caches.
`settleTranslateSlice` settles an `unfloored` stage on the archive's own bytes,
unchanged,
so a disputed slice's repair text,
which no floor could check there either,
does not ship with nobody heard
(`assertUnheardKeptIncumbent` would have stopped the entry on it).
Past the reach check the floor cannot answer `unknown`,
so the stage and the post-repair floor read its verdict through `requireComparedVerdict`,
which raises `FloorGroundDisagreementError` rather than keep a candidate on an answer that cannot come;
the stage's `floorFindings`,
whose `unknown` arm that made unreachable,
is gone.
The consolidation's slate terminals map `unfloored` with the unjudged,
though no slate of that stage raises it.
Cases:
`translate-stage.unit.test.ts`
(an archive standing with no call,
and an absent passage raising `unfloored` with no call),
`translate-slice-guards.unit.test.ts`
(the archive's own bytes with no sheet sent,
plain and with a disputed slice's stand-in,
each passing the unheard-record check),
`translate-document.unit.test.ts`
(an admitted insertion left unfilled as `unfloored`,
with the translate calls of the document without it,
and its rendering not in the page),
and `translate-floor-ground.unit.test.ts` for the reach and the narrowing.
The translate records change,
so the account rides inside version 15:
no slice-cache file was written after 04:27 UTC on 2026-09-27,
where a control from midnight that day finds 494
(M81 records the two confounds that check first met).

The guard in `settleTranslateSlice` was shown to fail,
committed first (`8fb8e6401`):
with its condition made unmatchable and the build rerun,
the slice guards' case failed with `TranslateUnheardError`
("slice 0 heard no translator and c…",
the check that would have stopped the entry on the disputed slice),
and with the condition restored it passed.
The consolidation's writers were still asked on such a slice until B45.

## B44: the front-matter floor charged a refusal of the original's or the page's YAML to the candidate

Status:
fixed 2026-09-30 (UTC),
found reading the front-matter floor for B43.
`validateFrontMatterTranslation` split the original,
the page and the candidate inside one try,
and its catch answered every throw as the candidate's:
"Your translation could not be parsed as YAML front matter".
Run on the build before the fix
(a throwaway worktree at `b70065c7f`,
`~/temp/agent/audit-glossary-fix/b44-before-probe.ts`),
a sound candidate against an original whose fenced YAML the parser refuses came back `invalid` with that finding,
and so did one against such a page,
while the same candidate against readable sides was `valid`.
The finding sends the candidate's author to revise text with nothing wrong in it,
and on such a slice every candidate is refused for the same reason.
Reach at the pin:
0 of 92 front-matter slices carry an original or a page the reader cannot read,
and no document's front matter is refused
(`~/temp/agent/audit-glossary-fix/b44-front-matter-reach.mjs`,
whose controls show a broken fenced block throwing and an unfenced one reading as none);
preparation splits every document's front matter first,
so a refused document stops before any slice.

Fix:
both sides are read by `readFrontMatterGround` (`translate-floor-ground.ts`) outside the candidate's try.
A refused side is a blind ground carrying the refusal's message,
which its class declares safe to forward,
and the floor answers `unknown` with it after the candidate's own faults.
The catch narrows to the YAML refusal through `requireFrontMatterRefusal` (`front-matter.ts`),
as `requireMdxRefusal` does for the Markdown grammar,
and `wording-key.ts` narrows its own catch through it,
whose rethrow census-6nasbO lists as cold.
The probe over the fixed source answers `unknown` for both,
naming the side and the parser's refusal.
Cases:
`front-matter-slice.unit.test.ts`,
a refused and an unfenced original and page beside a sound candidate,
and a candidate's own fault still charged first;
`front-matter.unit.test.ts` for the narrowing,
whose rethrow its case reaches.

## B45: the consolidation asks its writers on a slice the floor can compare nothing on

Status:
fixed 2026-09-30 (UTC),
found that day measuring B43.
A scratch copy of `consolidate-driver.unit.test.ts`'s case
"SHIPS THE ARCHIVE where the floor can compare nothing",
counting the producer requests its scripted client served,
found 3 for each lane the contest backed,
and the slice still ends `incumbent-only` on the archive:
the floor refuses every standing and every text the writers return,
so their calls buy nothing,
as the translate stage's did before B43.
Those writers were also the only path left to the author repair's `unknown` arm (`translate-repair.ts`),
which let a candidate stand unvalidated.
Reach at the pin is the same as B43's:
0 of 1,351 slices.

Fix:
`buyConsolidationAttempt` (`consolidate-slice-buy.ts`) asks `floorReach` of the original and the archive's page,
which every proposal is floored against (`consolidate-produce.ts`),
before any writer,
and on a blind slice settles with no voices,
as it already did with no standing text,
carrying the finding `consolidate-unfloored (<the floor's detail>)`;
the settlement's own floor then refuses the standing and every lane text and keeps the archive.
The author repair reads both its verdicts through `requireComparedVerdict`,
so its `unknown` arm is gone:
no caller reaches it,
and a candidate the floor could not check is a fault there rather than one to keep.
`unflooredFinding` names the stage it speaks for.
Cases:
the consolidation's blind-floor case now counts every request its client served,
producers',
judges' and the gate's,
and expects none for either lane,
with the log line naming the floor's reason;
`translate-repair.unit.test.ts` replaces the case that pinned the unvalidated candidate with one expecting the disagreement,
carrying the floor's detail,
with no follow-up call.
A blind slice's settlement ends in `keepTheArchive`,
which marks it `archiveKept`,
and `consolidationWorthResuming` persists no archive-kept settlement,
before this change or after,
so no cached consolidation answers such a slice and no cache account moves.

The reach check was shown to fail,
committed first (`c9ec438c3`):
with its condition made unmatchable and the build rerun,
the consolidation's blind-floor case failed with `FloorGroundDisagreementError`,
since the writers were asked and the author repair now refuses a verdict that compared nothing,
and with the condition restored it passed.
So the check is what keeps such a slice from stopping the entry,
not only what saves the writers' calls.

The fix left two stretches of its own making,
which the whole-suite census at `cce456093` (`census-qTbkjB`,
1,417 passes) listed in `consolidate-slice-buy.ts` at lines 169 and 172:
the fix had given the exits asking no writer their own copy of the settlement's arguments,
and that copy's two conditional spreads,
for a polish configuration and a standing refusal,
took only the arm no case supplied,
where the produced-slate exit's copy took both.
`d780418f7` builds the arguments once,
on every call,
for all three exits,
and the census at that commit (`census-v7Dz0r`,
1,417 passes,
taken clean) read against `census-qTbkjB`:
sources edited since then 1,
that file,
with 2 cold stretches left,
lines 203 to 213 (the exit with no standing text)
and 315 (the standing's `?? true` default),
both cold in `census-6nasbO` as well;
the census holds 1,452 stretches,
2 fewer than `census-qTbkjB`.

## B48: a polish round that paid for text its floor could not check

Found by the eighth coverage batch (census-dUOMFS):
the polish round's structural check had an arm for the floor answering `unknown`,
which it does only on blind ground,
an original the strict grammar cannot read or a page no grammar reads.
The round learned that only after paying its refiners,
its rankers and its gate judges,
and then kept the base.
Ledger B43 removed the same waste from the translate stage,
and B45 from the consolidation,
but neither reached the polish round,
which asked nobody whether its own ground was readable.
In production the consolidation's reach already keeps the archive,
unpolished,
on a blind original,
so only a base no grammar reads could reach it;
the round depended on its caller for the rest.

Fixed in `42bbbfa0a`:
the round asks `floorReach` against the original and the base before anything is bought,
and on blind ground keeps the base with a `consolidation-polish-unfloored` finding;
the structural check's verdict goes through `requireComparedVerdict`,
so its `unknown` arm is gone.
The case with a blind original was shown able to fail:
with the reach check disabled and the package rebuilt,
it failed with `FloorGroundDisagreementError` after the refiners were asked,
and passed again once the check was restored.
The account rides inside `CONSOLIDATE_CACHE_VERSION` 20:
no slice-cache file was written after 04:27 UTC on 2026-09-27,
where the midnight control finds 494.

Recurrence:
a stage that buys model calls asks the floor's reach first,
whoever its caller is;
a caller's check is not the stage's.

## B54: the preparation's own findings never reached an artifact

Found by the ninth coverage batch (census-SfAXnI),
casing the footnote relabel's rows.
`preparePassEntry` (`pass-prepare.ts`) returned its own findings,
the footnote relabel's,
the reference attestation's,
the page title lexicon's,
the archive block review's
and the unclaimed-blocks line,
in a list beside the preparation,
and `pass-entry.ts` destructured that list as `pairingFindings` and never read it again.
Only the pairing round's findings reached the artifact,
because `prepare-with-pairing.ts` also folds them into `alignmentFindings`,
the channel the artifact records,
as its commit said they should ("Findings ride the alignment channel,
which already reaches the artifact",
`c914333fa`).
Ledger X18 had guarded that the evidence rounds' findings survive every way out of the preparation,
reading the list nothing downstream read.

Measured on a past run:
hulicaijia31's log holds footnote lines for a reading left out,
a relabel,
retained labels and moved definitions,
and its artifact holds 16 alignment findings,
none opening "footnotes:";
across the 263 artifacts under `~/temp/agent/**/artifacts` that `rg` reached,
no string opens `"footnotes: `.

Fixed as a quality call open to veto:
red first (`8f014848e`,
five test files reading the channel the artifact records,
seven cases failing),
then `398cd3448`:
the preparation carries its own findings on `alignmentFindings`,
after the pairing round's,
on each way out,
and the result type drops the list beside it,
so no caller can read one the artifact never sees.
No cache account moves:
no cache key,
preparation identity or model sheet reads `alignmentFindings`.

Recurrence:
a value returned for "the entry's findings" is checked at the artifact,
the boundary its reader sees,
not at the function that returns it.

## B417: a contest most of whose ballots called the archive flawed ran no run-off

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

## B418: a single-round tie the standing drew no ballot in kept the standing

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

## B424: the forfeit of an eligible standing read every ballot where the run-off read a majority

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

## B425: archive-absent insertions went to the roster, and those that missed quorum shipped nothing

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
