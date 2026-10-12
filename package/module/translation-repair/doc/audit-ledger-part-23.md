# Audit ledger, part 23

Part 23 of [Audit ledger](audit-ledger.md),
whose index lists every part in order.

## Recurring code families, continued

### B42: the quote guard counted quotes on a blank-line split

Status:
fixed 2026-09-30 (UTC),
found closing the coverage census's translate-slice stretch for the quote-loss refusal (ledger T8's sixth batch).
The stretch looked unreachable:
the floor requires every top-level block of the page as it stands in the candidate,
of the same kind and in the same order,
so a floor-valid winner keeps every top-level blockquote.
It was reachable,
because the guard did not count what the floor reads.
`quoteBlockCount` split a text on blank lines and counted the chunks opening with `>`,
and the parser disagrees twice:
a quote opening on the line after a paragraph's is a blockquote to the parser and the floor,
and was none to the count;
a quote inside a container tag sits inside a block the floor compares only as a whole,
and was none to the count unless blank lines set it apart.
A scratch probe over the build from before the fix found a floor-valid candidate the guard refused in two shapes,
a paragraph then a quote,
and a quote in a list item,
each with no blank line opening the quote.
Over the stored translate records on disk
(2,958 records,
8,295 distinct texts,
read through the floor's own reader,
`~/temp/agent/audit-glossary-fix/b42-reach-floor-reader.mjs`):
the old count was below the parse's in 26 texts and above it in none,
and 20 texts carry a quote below the top level,
which the raw parse finds inside a container tag or inside another quote
(`b42-nested-quote-kinds.mjs`).
Of the 4 stored quote-loss refusals,
one,
hulicaijia24 slice 2,
kept the archive over a replacement the parse reads as carrying its one quote;
replayed through the fixed guard,
it ships,
and the other three,
XingZ60 slice 88 in two runs and slice 29,
still refuse
(`b42-stored-refusals-replay.mjs`).

The reporter was wrong beside it.
`alignmentRefusals` rebuilt the refusal's sentence by recounting the record's `outputText`,
the whole archive,
where the guard compared the archive's judged part with the target-only transcript held out,
so a slice with a held-out transcript would have reported the transcript's quotes as the judged part's
(read from the code;
no stored refusal carries a held-out transcript).
The sentence also said "1 quoted passages".

Fix:
the slice skeleton counts blockquotes at every depth off the parse (`quotedPassages`),
under the strict grammar and under plain markdown alike,
and the guard reads both texts as the floor reads a page
(`readPageSkeleton`:
strict first,
plain markdown where it refuses).
A quote inside another quote counts,
so a winner turning a quoted reply into the letter's own words is refused,
as a top-level quote turned into a paragraph is refused by the floor;
that is a behaviour change rather than a repair,
since such a winner shipped before it.
A text neither grammar reads keeps the archive,
since a check that could not run has not shown the quotes survive.
A quote-loss refusal stores the counts it compared,
the reporter names them,
the cache reader recomputes a refusal without them,
and the sentence puts each count in its number.
`quoteBlockCount` is gone;
`topLevelBlocks` stays for the target-only run,
which splices text and so needs each block's text.
Cases:
`quote-preservation.unit.test.ts` for the counter and the sentence,
`translate-slice-guards.unit.test.ts` for a floor-valid winner dropping a quote from inside a container tag
(refused,
the counts stored)
and one keeping its quote on the line after a paragraph's
(shipped),
and `slice-cache-store.unit.test.ts` for the stored counts.
The translate records change,
so the cache-account audit before a launch takes this change beside B36 to B41.

Queued:
the floor itself still compares top-level blocks only,
so a candidate dropping a quote inside a container tag passes the floor and is refused only after the judges chose it,
keeping the whole archive,
where a floor finding would send it back to its translator first.
Moving the count into the floor changes every lane's floor,
so it lands after the replay over the pinned human archives and settled pages that every floor had before landing
shows what it would refuse there.
Landed as B110.

### B43: where the floor compares nothing, the stage withholds the archive and lets a candidate stand

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

### B44: the front-matter floor charged a refusal of the original's or the page's YAML to the candidate

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

### B45: the consolidation asks its writers on a slice the floor can compare nothing on

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

### B46: ballot guards that disagreed on whether a finding's shape costs a voice

Status:
fixed 2026-09-30 (UTC),
found reading the ballot-reply guards in T8's eighth batch.
Three guards decide whether a judge's reply is a ballot:
the lane contest's (`lane-contest-wire.ts`),
the consolidation gate's (`consolidate-gate-wire.ts`)
and the polish gate's (`consolidation-polish-gate-wire.ts`).
The lane contest refused a reply whose `unsupported` or `dropped` was missing or not a list of strings,
choice and reason readable or not.
The two gates kept a reply whose findings were anything at all,
reading a non-list as no findings,
but refused one with a findings key left out.
So a reply whose findings were `null` was a ballot at the gates and a lost voice at the contest,
and a reply with `dropped` left out was a lost voice at all three.

How they came apart:
`57e0ad7fa` (2026-08-20) stopped the lane contest's guard refusing findings over their wording,
after calibration lost two of its first sixty voices that way,
on the rule that the choice is what a contest counts and no wording of a finding may cost a voice;
it kept the shape check,
which its test pinned so that the reader would never receive a value it could not read.
consolidate-10
(`f83e9b449`,
2026-08-26,
`doc/audit/translation-repair-package-audit.md`)
carried the rule to type at the consolidation gate,
narrowing in the reader instead,
but left the gate's key-presence checks,
and neither change read the other guard.
The shape check was deliberate,
but for the reader's sake,
and a reader that narrows removes that reason.

Decided,
under the owner's standing quality directive and open to veto:
one rule for all three.
A reply is a ballot when its choice names a candidate and its reason is text;
findings left out,
`null`,
a bare phrase or a list carrying anything but strings read as no findings,
raw findings included.
`findingsOrNone` (`contest-ballot-wire.ts`) is the one reading,
and each reader takes both fields through it;
the lane contest's wire type now carries the findings,
and the archive answer its guard never checked,
as `unknown`.
Cases:
each guard's case in `consolidate-gate-wire.unit.test.ts`,
`lane-contest-wire.unit.test.ts` and `consolidation-polish-gate.unit.test.ts`
accepts a reply with a findings key left out;
the lane contest's case that pinned the refusal of a non-list now pins its acceptance;
a reader case each for the lane contest and the polish gate reads non-list findings as none,
choice kept;
`contest-ballot-wire.unit.test.ts` pins `findingsOrNone`.
Those cases were committed red first (`395567499`):
the three guard cases and the lane contest's non-list case failed against the build before the fix.
The change turns a lost voice into a kept one and never the reverse,
which changes whose voices a round hears,
so the accounts ride inside `LANE_CONTEST_CACHE_VERSION` 6 and `CONSOLIDATE_CACHE_VERSION` 20:
no slice-cache file was written after 04:27 UTC on 2026-09-27
under the agent runs or either worktree's runs directory,
copy payloads left out,
where a control from midnight that day finds 494.
The replies the runs stored under `prompt-payloads/` were not counted for such ballots:
they sit in many run roots,
and no count over them could show it covered every reply behind a cached ballot.

### B47: a refine mode no production code built, kept alive by tests

Found by the eighth coverage batch (census-dUOMFS),
where `consolidation-polish-round.ts` asked the same question three times:
whether the mode was `required-naturalness-correction`.
No production code builds that mode:
`rg` over `src` without tests or fixtures finds only reads.
`git log -S` names `0f1898942` from 2026-09-01,
"remove the naturalness correction loop",
which removed its only producer;
the mode,
its branches in the refine prompt,
the refine selection context and the polish gate sheet,
its prior-correction rendering,
and its `no-correction` outcome all stayed,
built by tests alone,
and the rendered-sheets fixture rendered a slate no run could send.
Production builds two modes:
comparative and objection correction.

Fixed in `6a3e6cffa`,
a quality call open to veto:
the mode and everything only it reached are gone,
and so is `disposition` on the refine stage and polish round results,
which without `no-correction` equalled `changed`
and which no production code read.
The cases that built the mode now pin the objection mode where it had the same thing to pin:
fencing,
the base label,
and a declined or split round keeping the text.

No cache version moves,
on a measurement rather than a reading:
a probe rendered 58 sheets from the builds before and after the edit:
every fixture sheet,
and the gate,
the selection context and the refine prompt in each live mode,
with and without declared names and references.
49 are byte-identical;
the 9 that differ are the removed mode's own renders,
the probe's positive control.

Recurrence:
when a commit removes a producer,
`rg` for every constructor of the value it produced,
and remove each branch,
type member and test that only that value reached.
A test that builds a value production cannot build keeps dead code looking covered.
Left as it is:
`consolidation-polish.ts` still records `correctionCount: 0` and `corrections: []` on every review;
those are stored artifact fields with readers,
so changing them is a schema change for its own entry.

### B48: a polish round that paid for text its floor could not check

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

### B49: standing flags that defaulted to letting a standing ship

Found by the eighth coverage batch (census-dUOMFS),
at `input.standingMayShip ?? true` in `consolidate-slice-buy.ts`.
Four consolidation functions defaulted `standingMayShip`,
and two of them `standingEligible`,
to `true`:
the slice buy and its attempt,
the settlement,
and the persistence predicate and writer.
The driver passes both flags on every production call,
so no production caller used a default;
a caller that forgot one would have let a standing no contest endorsed,
or no gate found eligible,
ship as though it were both.
That is the silent permissive default of B21's seventh family.

Fixed in `30127d1c3`:
the flags are required.
The test calls that relied on a default were listed by a type check against a rebuilt `dist`
(a check before the rebuild read the old declarations and passed),
and each now passes the value the default gave.

Recurrence:
a flag whose absent value grants something takes no default;
and a type check of tests that import the build runs after the build.

### B50: a test named for an exit the code stopped taking

Found by the eighth coverage batch (census-dUOMFS):
the census found the settlement's absence exit cold,
yet a case in `consolidate-settle.unit.test.ts` was named for it,
"the absence the judged round raises over an ineligible standing".
Its run's log shows the judging returning "nothing proposed" instead:
since B39,
a withheld slate on which a voice was heard keeps its wording rather than raising,
so the case's input no longer reaches the exit its name promised,
and the name kept that exit looking covered.
Renamed in the B50 commit to the path it takes,
with the `translate-no-candidate` finding asserted;
whether the absence exit can still be reached at all is its own entry.

Recurrence:
when a change moves an input to a different exit,
rename or repoint every case named for the old one;
a case name is a coverage claim no runner checks.

### B51: an archive-keeping exit for an absence no judging raises

Found by the eighth coverage batch (census-dUOMFS),
behind B50:
the settlement's exit for an absence the slate judging raised over a withheld standing
(`consolidate-settle-judge.ts` returning it,
`consolidate-settle.ts` keeping the archive on it)
was cold,
and no input reaches it.
The judging raises over a withheld standing only on a slate with no candidate and nobody heard;
with a candidate it ships its preference past every decline,
by the owner's "Preference + polish" of 2026-09-27,
and its retry raises only while a run-off still narrows.
The settlement keeps the archive before judging where no proposal survived the floor and no lane text is offered,
the lane offer drops blank texts and any the rule does not pass,
and the candidate builder keeps every lane text that shows something;
so a slate that reaches the judges has a candidate or a surviving proposal.
Two inputs were tried and neither reached the exit:
one blank surviving proposal returns "nothing proposed" (B50),
and no voices at all settles `incumbent-only` first.

Fixed as a quality call open to veto,
on the shape ledger B43 set for the floor:
the judging returns only decisions,
and an absence over a withheld standing throws `WithheldSlateAbsenceError`,
a fault in this code,
through one narrowing at the one call site (`requireWithheldSlateDecided`),
cased directly in `consolidate-settle-judge.unit.test.ts`.
An absence over an eligible standing passes through as before.
The owner's rules that a run always ships are about text;
like B43's disagreement,
this names two rules of the code falling out of step,
which no text can cause.
Rides inside `CONSOLIDATE_CACHE_VERSION` 20:
no slice-cache file was written after 04:27 UTC on 2026-09-27,
where the midnight control finds 494.

Recurrence:
when an owner rule turns a raise into a return,
trace every caller's handler for that raise
and retire the ones it left unreachable,
with a named fault where the rule's premise is another module's.

### B52: an unsettled polish nothing built, and three guards against it

Found by the eighth coverage batch (census-dUOMFS),
at the driver's raise of `NaturalnessCompletenessError` for a polish of kind `unsettled`.
No production code builds that kind:
`rg` over `src` without tests finds only its definition and its readers,
and `git show` of `consolidation-polish.ts` just before `0f1898942`
shows the one construction that commit removed,
"remove the naturalness correction loop" of 2026-09-01.
Its TSDoc kept it "for old records and defensive guards",
but no record can carry it:
the artifact projection's output holds only `settled` and `not-run`,
the consolidation cache refused to keep an `unsettled` settlement,
and no slice-cache file has been written since 04:27 UTC on 2026-09-27,
before the cache version the current keys carry.
Three guards read it:
the driver's raise,
the persistence check refusing it,
and the artifact projection's throw.

Fixed as a quality call open to veto:
the kind and its three guards are gone,
the projection loses the slice index it took only to name the throw,
and the one test that built the kind,
a persistence case for a correction loop that no longer exists,
went with it.
`NaturalnessCompletenessError` stays,
thrown by the artifact completeness check.
The cost log's `unsettled` exit stays readable and is no longer written:
an `rg` over the agent runs found `exit=unsettled` in a validation log of 2026-08-29.

Left as it is:
the consolidation cache's shape check trusts a cached settlement's `polish` without reading it,
a gap for the cache store's own entry;
and the settlement type still admits a gate's terminal with no gate and a declined slate with no decision,
states only a type split by terminal would rule out.

Recurrence:
a variant kept "for old records" names the records;
check each store it could live in before keeping it,
and delete it with its guards when none can hold it.

### B53: a file that is not an artifact advised as one of another generation

Found by the ninth coverage batch (census-SfAXnI),
at the schema guard's label for a `malformed` row,
"not an artifact this build recognizes at all",
which no test ran.
The schema census classifies a settled file that is not JSON,
or JSON that is not a record,
as `malformed`,
and its TSDoc says why that answer stands apart:
"its remedy is the opposite one.
Another generation's artifact is a sound result to keep;
this is a file to investigate".
The guard grouped it with the foreign generations anyway,
so `SchemaGenerationError` told an operator the directory
"holds artifacts of another schema generation"
and closed with the ways forward for a sound artifact,
among them moving it to an archive where
"the archived copy stays readable as the generation it is".

Reach:
the pass never met it.
It runs `assertArtifactsPlaceable` first (`corpus-pass.ts`),
whose placement census files an unparseable file as malformed
and a JSON list,
which carries no `id`,
as untagged (`artifact-placement.ts`),
and refuses both as unplaceable.
A caller running the schema guard alone met the wrong advice.

Fixed as a quality call open to veto (`1556de391`):
the guard refuses `malformed` rows first,
with `UnplaceableArtifactError`,
whose message names each file and says removing it is the whole remedy;
the generation label and grouping take only artifacts,
typed so a malformed row cannot reach them.
The case writes a sound version 1 artifact beside a non-JSON file and a JSON list,
and reads the refusal naming the two files with that remedy,
and naming neither "another schema generation" nor the sound artifact.
Guard-off proof:
with the refusal's condition set to more than a million files and a rebuild,
`pass-schema-guard.unit.test.ts` failed on that case alone
(its FAIL line and its describe's rollup),
the message opening "This artifacts directory holds artifa…";
restored with Edit,
`git diff --stat` empty,
and rebuilt.

Recurrence:
where a classification's TSDoc says one answer takes a different remedy,
check every refusal built from it gives that answer its own.

### B54: the preparation's own findings never reached an artifact

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

### B55: a reorder note for definitions already in order

Found with B54,
casing the relabel's reorder note.
`reorderFootnoteDefinitions` (`archive-footnote-order.ts`) noted that the definitions were interleaved with other blocks,
or shared container delimiters,
before testing whether they already followed the order asked for.
Definitions already in the original's order with prose among them came back with the note,
and the relabel reported "archive definitions stand",
a withheld move where none was needed;
since B54 that finding reaches the artifact.
The note's own TSDoc said it explains why the text stands
"when it does and the order asked for differs".
A probe over the built package (`~/temp/agent/audit-glossary-fix/b55-probe.mjs`,
cat-themed fixtures) gave the same finding for in-order and out-of-order definitions.

Fixed (`2824c6259` red,
`e2edf037a`):
the already-in-order return comes before the two refusals.
The text returned is the same on every path;
only the note moves.

Recurrence:
a note or finding that says work was withheld is emitted only where the work was wanted.

### B56: the missing-path check written out in three shapes, one reading the error's text

Found after the ninth coverage batch (census-VW2tHL),
reading the ten catches whose rethrow arm no test reached
(`page-republish.ts`,
`published-tree-listing.ts`,
`runs-lock.ts`,
`settled-carve.ts` twice,
`sheet-path.ts`,
`sheet-write.ts`,
`slice-cache-dir-read.ts`,
`window-trial-ledger.ts`
and `bedrock-ledger.ts`).
Every catch that reads "nothing stands at the path" as an ordinary answer wrote the check itself,
in three shapes:
`Error.isError && 'code' in && code === 'ENOENT'` twelve times inline and once as `settled-carve.ts`'s own `isMissingPath`,
`isJsonRecord(error) && code === 'ENOENT'` in `bedrock-ledger.ts` and `prompt-payload-store.ts`,
and in `image-ocr.ts` a substring,
`String(error).includes('ENOENT')`,
deciding that tesseract is not installed from the error's text,
which carries the tool's own output.
Two defects rode with the copies.
`sheet-write.ts`'s `exists` said in its comment that any other failure "is still an absence for this purpose"
while its code rethrew it,
the two written together in `ebc53f24f`.
And the substring:
a probe of Node's `execFile`
(`~/temp/agent/audit-glossary-fix/enoent-spawn-probe.mjs`)
shows an absent program rejects with code `ENOENT`
and a program exiting 3 or 1 with that number and no `ENOENT` in its text,
so the code decides the question and the text only happens to agree.
No real outcome read differently in the probe.

Fixed as a quality call open to veto (`9a02d8e0b`):
`missing-path-error.ts` holds `isMissingPathError`,
a Node error whose code is `ENOENT`,
and `rethrowUnlessMissingPath`,
which throws the caught value unchanged otherwise,
the narrowing-helper shape of `requireMdxRefusal` (`f792174a2`);
the catches read `rethrowUnlessMissingPath(...)` and then their "not there" answer,
so each rethrow arm is the helper's,
tested once over real `ENOENT` and `ENOTDIR` failures.
Sharing the check left `bedrock-ledger.ts` and `window-trial-ledger.ts` with one body word for word,
which the duplicate-body guard refused,
so both read through `readTextOrEmptyIfMissing` (`read-text-if-present.ts`),
and so does the cache marker read.
`sheet-write.ts`'s comment now says what its code does,
and `image-ocr.ts` reads the code.
`declined-entries.ts` still reads the code through `filesystemReason`,
since its refusal names the code.

Recurrence:
a catch that answers "not there" uses `rethrowUnlessMissingPath` or `isMissingPathError`;
a comment explaining what a catch does with the other failures is read against the arm it describes.
