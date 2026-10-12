# Translation repair: OpenRouter as the paid fallback provider, part 33

Part 33 of [Translation repair: OpenRouter as the paid fallback provider](translation-repair-openrouter-2026-09-03.md),
whose index lists every part in order.

## Mio26 launches on classes forty-one and forty-two, 2026-09-17, 03:25 UTC

Frozen `052f8eea0` (class forty-one,
the references on the refine sheets;
class forty-two,
the break floor under a substitute block and the untranslated refusal),
pid 2838543,
runs `~/temp/agent/Mio26-20260917`,
log `~/temp/agent/Mio26-20260917.log`,
Synthetic and Hyper dry,
Bedrock and OpenRouter wet.
Read first slice 2's polish
(`consolidation.slices` by `sliceIndex`,
`polish.baseText` against `polish.text`,
and the polish gate ballots,
which should now cite the attested line rather than call the clause unsupported),
then the page's sentence on the sister,
then slice 16's rendering
(`cat -A` on the page's last lines:
the poem's quote lines end in two spaces when the breaks survived,
and the translate log carries
`ORIGINAL blockquote block(s) carry 5 explicit line break(s)` on any flat candidate),
then any `repeats the ORIGINAL untranslated` finding in the log,
then `attempts.json`
(Mio25 needed two),
then the Mio25 reading.

## Classes forty-one and forty-two, 2026-09-17, 03:20 UTC: the polish strips the attested clause, the verse loses its breaks under a substitute paragraph

Class forty-one.
On Mio25's slice 2 the consolidation slate gate kept the consolidated text with
the sister clause four ballots to one
(three of the four name the attestation),
and the consolidation polish then removed the clause:
three refiners heard,
three proposing,
minimax-m3's proposal selected at weight 2 of 5 ballots
(the record notes a deepseek-v4.1-flash self-vote),
and the polish gate chose the polished text four ballots of six
("removes the unsupported 'also trans' detail",
"the original says only 有一个姐姐,
so base's unsupported addition must go"),
one ballot for the base
("drops the information about the sister being trans,
which is present in the base and the archive rendering"),
one neither.
The page shipped "She has an older sister."
The mechanism is the same blindness class thirty-six closed for the contest and the slate:
`runRefineStage`,
`buildRefineMessages`,
`buildRefineSelectionContext` and `ConsolidationPolishGateSubject` carried no `referenceContext`
(the only files naming the reference block were the critic,
the adjudication,
the lane contest,
the slate and its gate,
and the attestation),
so the repair lane's refiners and their judges,
and the consolidation polish and its gate,
had never seen the references or the attested lines.
Fixed in `836f90687`
(guards red first at `16f7639a1`):
the reference lines and their rule go on the refiner sheet after the declared names
(`citedReferenceCandidateLines`),
the refine judges read them as labelled evidence in both modes
(`citedReferenceEvidence`),
the polish gate sheet carries the same block after the two candidates,
the repair driver hands `prepared.referenceContext` down through `refineSettledSlices`,
`runRefinePhase`,
`settleRefinePhaseSlice` and `settleRefinedSlice`,
the polish reads it off the consolidation subject,
and `refineRunShape` folds it into the refine cache key only where it exists,
so the 33 entries that cite nothing key exactly as before.

Class forty-two.
Mio25's page carries the poem as a blockquote with the bilibili link and none of its five hard breaks:
the translate lane's rendering wrote each verse line as two soft-broken lines,
Markdown renders soft breaks in a quote as spaces,
and the poem reads as one paragraph.
Mio23's rendering had kept the breaks by the writer's choice.
The rule that owes explicit breaks
(`sourceOnlyBreakFindings`) returns nothing whenever the slice's page text is non-empty,
and this slice's page text is the archive's farewell paragraph paired with the poem quote
(class thirty-two's substitute),
so the verse's breaks were never owed.
Fixed in `052f8eea0`
(same guards):
`substituteBreakFindings` owes,
per block kind the page never rendered,
the original's break count for that kind,
counted per kind because the candidate carries the page's paragraph beside the original's quote and
indexes do not align;
run on Mio25's own rendering it refuses with
"ORIGINAL blockquote block(s) carry 5 explicit line break(s),
but your blockquote block(s) carry 0",
and it passes Mio23's.
The same commit refuses a candidate that repeats a Han-carrying original character for character
(`untranslatedFindings`,
a bare link or component returned as it stands still passes):
on Mio25's first attempt two of the four poem candidates were the Chinese returned as it stood,
one judge chose one of them as "the most faithful rendering",
and the select missed its weight floor twice.

## Mio25 read, 2026-09-17, 03:00 UTC: settled on the second attempt, the sister clause lost at the polish, the poem without its breaks

`TALLY Mio status=ERROR` at 73.3 minutes,
then `REATTEMPT Mio queued: 61 more cache records than it had`,
then `TALLY Mio status=SETTLED slices=17` at 65.2 minutes on the second attempt:
136 minutes wall,
two attempts,
`attempts.json` reads 2.

The first attempt died on slice 16,
the poem,
in the translate lane
(`SLICE-COST lane=translate chunk=16 sourceChars=132 ms=689571`).
The select's first round heard four of five judges,
three abstained,
and the one vote drew weight 1 against the 2.00 floor
("keeping the fallback"),
so the stage ran its one follow-up round:
three of five writers heard
(Qwen3.8-27B unreachable with Synthetic dry,
GLM-5.3-Flash cut at the 360 s deadline after 1.9 MB of raw stream,
59,468 reasoning characters and no content),
a retry round asked two more,
and the follow-up select split:
gpt-oss-120b candidate 1,
gemma-4-26b candidate 1 at weight 0.5,
deepseek-v4.1-flash candidate 3,
gemma-4-e2b candidate 4
("preserves the original Chinese text exactly,
including the title '惋秋'"),
with three ballots naming candidates 2 and 4 as the Chinese left untranslated;
weight 1.5 against 2.00,
and the slice has no archive translation to fall back on,
so `TranslateAbsenceError` ended the attempt.
The launcher's re-attempt resumed from the cache and the second select settled the poem.
Class forty-two's untranslated refusal takes such candidates off the slate before any judge reads them;
the absence error itself stands as designed
(nothing honest to ship),
and the re-attempt is the recovery.

Class forty was not exercised:
no `lane texts offered on the slate` line,
because the second attempt's contest on slice 16 chose translate six of six with the archive flawed on
every ballot,
the consolidation terminal is `slate-endorsed-standing` and the translate text shipped unchanged.
The page ends on `May you rest in peace, Mio.`,
then the poem as a blockquote,
`Autumn Lament` as its title,
the credit line with `https://space.bilibili.com/246513889`,
and no hard break on any line
(`cat -A` shows no `  $`;
Mio23's page had them on every verse line):
class forty-two.

`ATTESTED heard=6 answered=13 verified=12 needed=3 details=1`
on the second attempt
(heard 5,
verified 11 on the first):
the sister by five of six voices
(minimax-m3,
gemma-4-26b-a4b,
deepseek-v4.1-flash,
mercury-2.5,
GLM-5.3-Flash),
minimax's graduation-certificate and surgery-money items and deepseek's five other items verified but short of the quorum.

Slice 2.
The repair lane kept the sister clause and wrote
"she attended a local 985 (a top-tier university) at the time of her death"
for 生前;
the translate lane wrote "and she has an older sister" and "during her lifetime".
The contest chose translate four of six with two `neither`,
every ballot weighing the repair lane's unsupported "at the time of her death" against the translate
lane's dropped attested detail
("although it drops the archive's attested detail that Mio's older sister is also trans").
The consolidation gate chose the consolidated text four of five,
with the clause,
three ballots naming the attestation and one calling the clause fabricated.
The polish removed it and its gate confirmed the removal four of six:
class forty-one.
The independent naturalness review then read the polished text unacceptable four of six
(the "Guangdong,
Foshan" order,
"during her lifetime" for 生前,
"a local 985" as jargon),
recorded as evidence with the gated text shipping,
as designed.
The page reads "Her father is a high school teacher,
and her mother is a housewife.
She has an older sister.
Brilliant and dexterous,
she attended a local 985 (a top-tier university) during her lifetime."

The first chat block ships with the archive's wording and speakers,
the `Translation:` label,
"masculine" and "WeChat" corrected,
curly quotes throughout
(`read-page.mjs`:
30 curly apostrophes against the archive's 29,
0 straight double quotes,
the 20 straight apostrophes all inside the JSX photo paths).

The three checks:
front matter equals the archive's;
one `json false start` kept;
46 `schema-mismatch` lines,
none naming `finish_reason=error`,
and four `InStreamProviderError` lines with `code unnamed`,
retried.
The seven checks against Mio12:
澪 kept;
the coming-out sentence ships as prose
("She once served as an administrator of the 春の芽工作室 (Harunome Studio) QQ group,
and she also:")
above the archive's three bullets,
the redundancy as before;
the university as "a local 985 (a top-tier university) during her lifetime";
SRS unexpanded,
as the archive has it;
the `Translation:` label restored;
"masculine";
the poem with its credit line under the farewell but without its five breaks
(class forty-two).

Spend:
2,148 seats asked,
77 retry rounds,
1,737 SPEND lines,
39 abandoned streams at 0.07 USD;
Bedrock 183.59 to 183.09,
OpenRouter 261.51 to 260.77 against 0.73 logged,
1.23 USD for the two attempts.
Synthetic served 222 calls at no cost while its meter read dry.

## Mio25 launches on class forty, 2026-09-17, 00:40 UTC

Frozen `1c38e4f34` (class forty,
the lane texts on the consolidation slate),
pid 2590736,
runs `~/temp/agent/Mio25-20260917`,
log `~/temp/agent/Mio25-20260917.log`,
Synthetic and Hyper dry,
Bedrock and OpenRouter wet.
Read first any `lane texts offered on the slate` line
(one per slice whose standing was neither contest-endorsed nor eligible),
then slice 17's settlement:
which candidate won,
whether the page carries the poem as a blockquote with its line breaks and
`https://space.bilibili.com/246513889`,
then slice 2's sister clause and the contest,
then the first chat block,
then the Mio21 reading and the spend.

## Class forty, 2026-09-17, 00:35 UTC: a declined contest leaves the slate blind to the lane texts

Mio24 stopped INCOMPLETE at slice 17,
the closing poem.
The archive never translated the poem;
its page ends on the farewell line the Mio pages close with,
which the pairing set against the poem's blockquote,
so the slice's incumbent is that one line and the original carries a link the line does not.
The contest heard four ballots,
every one judging the archive flawed,
and settled `neither` three to one:
two ballots called both lanes unsupported for "gendered pronouns" and for the translate lane's
"May you rest in peace" line,
one said the lanes differ only in wording,
one chose translate.
A declined contest leaves the archive's rendering standing,
the deterministic publication rule refused it
(the log line names the bilibili link the original carries and the translation does not),
and the consolidation withheld it from the slate under the owner's decision of 2026-09-04.
The slate then carried only the writers' fresh proposals,
which flattened the poem's blockquote and its line breaks,
and the slate judges said so:
three of five abstained
("none of the candidates reproduce the block quote structure",
"the passage being replaced is a single line"),
the two who voted tied one to one,
the fallback was the withheld standing,
and the entry stopped after 76.7 minutes with `slate-declined-standing`.
The repair lane's text
(`> Lament for Autumn`,
five lines,
the attribution with the link)
and the translate lane's
(the same with the farewell line kept above it)
both passed the rule,
both carried the blockquote,
the line breaks and the link,
and neither was on any slate.
Mio23 never met this because its contest chose translate on slice 17.

The fix,
`1c38e4f34`:
the consolidation slate offers each lane text that passes the deterministic rule and is not the standing,
whenever the standing is neither contest-endorsed nor eligible
(`laneTextsForSlate` in `consolidate-lane-offer.ts`).
A lane text joins the slate under a new `lane` producer kind,
between the incumbent and the fresh proposals,
so the incumbent's bytes win a collapse against a lane that reproduces them and a lane's bytes win one
against a proposal that reproduces the lane,
with the reproducing model discounted as it is for the incumbent.
The settle key carries the offered lane texts only when any were,
so every other slice keys as before;
a floor that refuses every proposal no longer ends the settlement when lane texts remain.
A silent producer round still interrupts the entry as before,
lane texts or none.
Guards red first at `341a540bf`
(lane candidates,
the offer rule,
the settle key,
the artifact producer reader),
all four checks green at `1c38e4f34`.
Not changed:
the contest's `neither` still leaves the archive standing,
which is the consolidation's retry by design;
the slate judges' reading of the one-line standing as the scope of the passage
("the task is to replace only the current English passage")
is noted,
not fixed.

## Mio24 read, 2026-09-17, 00:15 UTC: the attestation and the repair lane hold, the entry stops at slice 17

Mio24 (frozen `27109ca8b`,
launched 22:58 UTC,
Synthetic and Hyper dry) ended INCOMPLETE after 76.7 minutes at slice 17,
class forty,
so no page was written and the seven checks,
the three checks and the first chat block could not be read.
What could be read:

- `ATTESTED heard=5 answered=6 verified=6 needed=3 details=1`;
  the sister detail by four of five voices
  (gemma-4-26b-a4b,
  deepseek-v4.1-flash,
  mercury-2.5,
  Kimi-K3),
  mercury's two extra items
  (the depression hospitalisation,
  the graduation certificate)
  verified but fell to quorum.
- Slice 2,
  the repair lane:
  both addition claims on the sister
  ("Translation adds that the sister is trans",
  "adds that the older sister is also trans")
  rejected before the panel with the reference-attested finding,
  the mistranslation claim on "handles everything at home" rejected by the panel,
  the omission of 当地 accepted,
  and the lane kept "She has an older sister who is also trans."
- Slice 2,
  the translate lane,
  the first pass with the ATTESTED DETAILS block on the writer sheet:
  one candidate of the slate carried the clause
  (candidate 3,
  which mercury voted for,
  "incorporates the cited-reference detail about the sister"),
  and gemma-4-26b-a4b's candidate 4,
  "and she has an older sister",
  won three ballots of five
  (minimax,
  deepseek-v4.1-flash,
  gemma-4-e2b,
  each praising it for adding nothing).
  The writers now hear the rule and one followed it;
  the translate judges have the candidate-sheet rule and three of five still preferred the dropper.
  Recorded,
  not fixed:
  the repair lane carries the clause and the contest chose it.
- Slice 2,
  the contest:
  repair 3 to 2,
  the translate ballots citing "before she passed away" as the qualifier repair lacks,
  one repair ballot noting that repair
  "does drop the archive's accurate attested detail" in its reason while choosing repair.
  Had the page assembled,
  it would have carried the clause.
- Slice 17:
  class forty,
  read in full under its own heading.
- The other contests:
  fourteen settled,
  ten repair,
  three translate,
  one neither
  (slice 17);
  the archive judged flawed on most ballots of most slices.
- Spend:
  select 107 rounds,
  474 seats asked,
  392 heard;
  translate 43 rounds,
  157 asked,
  75 heard;
  1,450 seats asked in all with 66 retry rounds.
  METERS at exit:
  Bedrock 183.59 USD,
  OpenRouter 261.52 USD,
  Synthetic and Hyper dry.
  Read the meter deltas at the Mio25 read together with Mio25's own.

## Mio24 launches on class thirty-nine, 2026-09-16, 22:58 UTC

Frozen `27109ca8b`,
pid 2354397,
runs `~/temp/agent/Mio24-20260916`,
log `~/temp/agent/Mio24-20260916.log`,
Synthetic and Hyper dry.
Read first the `ATTESTED` lines
(expect the sister detail again),
then slice 2's translate lane text
(`lanes.translate.result.sliceTexts` by index;
expect the sister clause carried),
then the contest ballots and what ships,
then the first chat block,
then the seven steps and the three checks.

## Class thirty-nine, 2026-09-16, 22:55 UTC: the translate writer never sees the attested details

The translate writer sheet
(`buildTranslateMessages`)
shows the ORIGINAL,
the EXISTING TRANSLATION as evidence,
the pictures and the declared names,
and nothing about the references:
`referenceContext` reaches the translate judge
(class thirty-six)
and never the writer.
So a translate candidate is written from the ORIGINAL alone,
and an archive detail the ORIGINAL does not state is dropped by construction,
attested or not.
The contest then compares whole slices:
when the translate lane reads better elsewhere,
it wins and the page loses the detail,
whatever the candidate-sheet rule says about dropping it.

`27109ca8b`:
`attestedLines`
(the `- attested:` lines of the prepared pair's `attestedDetails`)
travel from `translateSliceInput` through `runTranslateStage`,
`runTranslateRepairs` and `produceTranslateSlate` into the writer sheet,
which carries them as an `ATTESTED DETAILS` block after the EXISTING TRANSLATION
and adds `TRANSLATE_ATTESTED_RULE` above the reply rule:
each is accurate detail the translator took from the ORIGINAL's own references,
carry every one,
the ORIGINAL not stating it is no reason to drop it,
and they license nothing else.
The lines are folded into `translateRunShape` only when there are any,
so Mio23's cached translate slices are not served back to Mio24
and every entry that attests nothing keeps its key.
Guards red first at `e9f90c485`:
the sheet carries the block,
the line and the rule when given and nothing when not;
the run shape separates the two.
Build,
lint,
types and the unit suite green
(`~/temp/agent/check-package-c39b-20260916.log`).

## Mio23 read, 2026-09-16, 22:40 UTC: the attestation holds and the translate lane wins without the clause

Frozen `887e5262c`,
SETTLED in 94 minutes,
18 slices,
repair 49 issues,
30 accepted,
selection contested,
page changed 12.
Bedrock 0.43 USD,
OpenRouter 0.67 USD by meter against 0.70 logged
(no gap this time;
Mio21's 0.85 gap did not recur),
Synthetic and Hyper dry throughout.

The attestation:
`ATTESTED heard=6 answered=10 verified=9 needed=3 details=1`.
Five of six voices
(gpt-oss-120b,
minimax,
gemma-4-26b,
deepseek-v4.1-flash,
mercury)
attested "She has an older sister who is also trans."
against the blog's "Mio的姐姐也是MtF。";
minimax's other four items
(the university,
the driving,
the programming,
the accident)
verified word for word and fell to the quorum as one voice each.
One item was discarded unverified.

Slice 2:
the critic filed two mistranslation claims
("because of",
"accepted" for 就读)
and no addition claim on the sister,
so the pre-panel screen had nothing to reject
(no `reference-attested` finding anywhere in the log).
The repair lane kept the clause.
The translate lane rendered "Her father is a high school teacher,
her mother is a housewife,
and she has an older sister."
The contest chose translate 3 to 2.
The two repair ballots name the attested detail as their reason
("translate leaves out the confirmed detail that Mio's older sister is also trans").
Of the three translate ballots,
one names the 985,
the local university and "before she passed away" that repair dropped
and adds "though it wrongly keeps the reference-attested 'also trans' sister";
one names the housewife and the study context;
one lists "who is also trans" under dropped in its raw form,
and votes translate anyway.
The consolidation slate was declined,
translate stood,
the polish gate chose neither,
and the page reads "and she has an older sister."
The mechanism is class thirty-nine
(the heading dated 2026-09-16 22:55 UTC):
the translate writer never sees the attested lines,
so its candidate cannot carry the detail,
and the contest is a whole-slice choice.

The first chat block:
the block review's winner drew 1.5 of 5 with two abstentions against a floor of 2.00
and the archive block stood
(Mio21's revision won 3.5 of 5),
so the pat,
the mtf question and the musculine typo stand as the archive has them
and class thirty-eight had no revision to restore quotes on;
the page carries no straight quote anywhere
(`mio21-typo.mjs`:
every slice 0/0).
Slice 3's translate lane added "> hehe~ " for the 嘿嘿~ the archive dropped,
with one trailing space the wrap kept;
the closing poem's two-space hard breaks are the original's own.
Front matter identical to the archive.
Slice 14 declined-standing,
slice 16 consolidated;
the diff against Mio12 is the Mio21 diff again
(the archive's wording kept where Mio19 rewrote it).

## Clustered panels and complete repair evidence implemented, 2026-09-10

This section and the two after it were written by the sessions of 2026-09-10 to 2026-09-15.
A "task N" there names an item of those sessions' own tracker
(the plan `doc/handover/translation-repair-handover-2026-09-06.md` records as abandoned),
described in the planning record the section links;
it is not a GitHub issue.

The final comparison-input probe selects the correct-disclosure draft at weight five over six ballots,
after the existing English before repair is supplied to whole-chunk selection.
It uses actual generated candidates and is not a fallback result.
The group-name mutation remains unresolved.

The measured changes are implemented through `8adb77fb9`:
preplanned cluster-local panel packets,
independent per-cluster quorum accounting,
source evidence in repair cache/twin identity,
and nearby/full source plus existing-English comparison at repair selectors.
No vote creates a new packet and no writing round is added.
Initial-writer and non-persisted-audit treatments that failed their probes are not integrated.

Build,
types,
zero-warning lint and the complete unit suite pass.
`~/temp/agent/evidence-handoff-unit-20260910.out` ends `unit exit 0`.
Compiled prompts match the measured treatments,
and the public panel stage reproduces thirty cached calls with identical decisions and no cache misses.

`proc_ccdb` completed the compiled full repair path without prompt interception,
on one Mio slice after eighty-three requests and 971 seconds.
It still removed the disclosure item;
no correct regional candidate existed to select.
Report:
`~/temp/agent/temporal-implemented-path-probe-20260910/report.json`.
Task 23 waits on category-scope task 24 after this failed wording check.
The diagnostic removal of only the two overlapping addition diagnoses let both GLM editors correct the item,
without changing other issues or preservation licenses.
The category experiment and separate omission control preserve genuine addition/omission repair
and reject conflicting addition diagnoses in the newly derived disclosure packet.
`029c0a886` integrates the measured critic/panel guidance and passes all package checks plus prompt parity.
`proc_948d` exposed an authority leak:
a rejected addition diagnosis became part of an accepted merged issue.
`b9d3b2ea0` partitions by effective member status and preserves deduplicated evidence,
without weakening source-defect protection.
`proc_0dc5` then completed the real repair in 204 seconds:
all editors correct the disclosure direction,
and the whole-chunk composite wins four of six votes without fallback.
The group name still changes and remains task 21.
No production category filter or new writing round is introduced.
Task 21's name authority still blocks the next full Mio pass.
No clean page or overall readiness is claimed.

## Heading-boundary context reaches the repair path, 2026-09-10

The temporal fixed-slate probe passed its direct-source control with all six judges.
Adding the next body paragraph past the immediate heading moved correct choices from one of six to four of six;
paired source/archive context also yielded four correct choices,
with abstentions rather than incorrect alternatives among the remaining replies.
This is per-seat experimental evidence,
not a production tally.

The first-writer context probe did not fix the bullet,
so no initial-translation-writer change was integrated.
`e086402a6` instead repairs the demonstrated window boundary for existing consumers:
include one forward body after a heading-only neighbor,
stop at metadata,
empty content or another heading,
and never scan backward through a heading.
Both language views use the same positions.

`134a2e20c` passes build,
types,
zero-warning oxlint and the full suite;
`~/temp/agent/heading-window-check-unit-20260910.out` ends `unit exit 0`.
Its reconstructed Mio12 window matches the measured paired input byte-for-byte.
The actual repair-path probe `proc_c166` completed on that frozen build in 748 seconds,
using forty-six calls.
Its compiling result removed the list and changed the established group name,
so it failed the wording goal.
Report:
`~/temp/agent/temporal-repair-path-probe-20260910/report.json`.
The cache-only replay reproduces all calls with zero misses.

Task 19's evidence-scope experiment `proc_12b5` produced anchored participant corrections
and removed authorization from the old broad claims,
but the newly derived panel still accepted blanket removal.
`proc_9549` did not establish a remedy from full source evidence or claim extent.
`proc_b599` produced no suitable candidate:
all three stock and all three treated editors removed the list and changed its group name.
`proc_ec6f` produced the intended list correction with all three editors when only the accurate claim was visible.
The subsequent isolated-claim panel diagnostic reversed the false addition claim's matched vote from support to opposition.
No production filter was added.
`proc_2d45` removed blanket-deletion authorization and rejected false friendship claims at cluster scope,
while retaining the participant correction.
Name and placement claims remain problematic.
`proc_ba3f` produced one assembled candidate with the correct disclosure direction under stock windows,
while other drafts deleted or duplicated an item and all changed the group name.
`proc_ae78` now tests the existing selectors on those actual candidates with and without additional source evidence.
No new writing or invented composite is part of that comparison.
No production prompt change,
name-policy change,
quorum change or new production stage has been made.
Task 21 separately tracks full-packet name authority.
No full-entry pass is active and no clean page is claimed.
See [temporal context measurement](translation-repair-temporal-context-2026-09-10.md)
for experiments,
controls,
costs and open verification.

## Archive decision boundaries and English correction verified, 2026-09-10

`ba01babda` is locally verified by build,
types,
oxlint and the full suite ending `unit exit 0` in `~/temp/agent/archive-brief-unit-20260910.out`.
The archive selector now receives the actual retention/revision actions,
linked anonymous candidates,
archive context and the unchanged block;
a retention-only anchor shortfall no longer prevents independent judgment of existing revisions.
Both quorums remain intact.

The initial `6c24c82c1` live run still retained spelling errors after generating a flawed literalized alternative.
A measured clarification of the existing first-review brief produces complete minimal English corrections.
Compiled-stage integration on `ba01babda` retains the useful label and selects the corrected full chat,
without untranslated filler or the `musculine`/`Wechat` errors.
Five revisions competed with the original;
the chosen revision won weight 3.5 across seven ballots.
No extra correction round was added.

The integration report is `~/temp/agent/archive-brief-integrated-20260910/report.json`.
It completed in 783 seconds with 41 forwarded requests,
reusing completed prompt payloads in a disposable cache.
Actual new spend was 0.00046112 USD on Bedrock,
two OpenRouter calls reporting zero,
and three Hyper plus seven Synthetic calls without dollar prices.
The daily helper ran afterward.
Full trace and preceding probe costs live in
[the wording follow-up](translation-repair-mio12-wording-2026-09-10.md).

Readiness remains false.
Retained-label audit accuracy remains unresolved after the context experiments.
Task 20 is deferred without a production change:
the caller trace and public-wrapper control show these detailed findings do not change the page
or reach persisted entry findings.
They are not a prerequisite to another page reading,
though the awaited calls retain their operational cost and failure paths.
Task 19's temporal/participant context is in progress and still needs measurement.
No full-entry pass is active,
and the sequential entry queue has not advanced.

## Naming scope reaches a bounded production stage, 2026-09-10

The Mio12 wording trace is in
[the naming and context follow-up](translation-repair-mio12-wording-2026-09-10.md).
Its first name-form treatment improved writing but split the fixed-slate judges.
Scoping the actual faithfulness and name criteria moved selection of the distinguishing wording from two of six
judgments to four,
without selecting the untranslated-copy negative control.
`514db9b1f` integrates that scope;
`b55a42a0a` explicitly names the declared-identity exemption instead of using an ambiguous pronoun.

A separate actual group-name claim probe distinguishes established names from generic terms needing glosses.
Its votes move from five supporting to three supporting and three opposing.
The existing production `tallyVotes` changes that claim from `accepted` to `needs-human`,
which no longer authorizes an edit.
The explicit-source-definition control changes from five supporting votes to six.
`8a59469f2` integrates the scoped vocabulary rule without changing the owner's first-use gloss requirement
for generic terms or adding a glossary entry.

The combined code is verified through `85f7bac01`:
build,
types,
oxlint and the full unit suite pass with zero warnings.
`~/temp/agent/naming-final-unit-20260910.out` ends `unit exit 0`.

A real `runTranslateStage` probe then completed in 49 seconds on that frozen build.
Qwen produced a fresh elliptical opening that retains the questioned character and the separate chosen name;
Mercury reproduced the archive.
All four responding judges selected Qwen's new wording at ordinary vote weights.
The stage used six requests,
with no structural repair,
follow-up generation or outage fallback.
The selected text compiles and the source hash is unchanged.
This is current-code producing-and-selecting evidence,
not merely a prompt-text assertion.

Reports:
`~/temp/agent/name-form-probe-20260910/report.json`,
`~/temp/agent/inline-name-scope-probe-20260910/report.json`,
`~/temp/agent/archive-name-gloss-probe-20260910/report.json`
and `~/temp/agent/naming-integration-probe-20260910/report.json`.
Their respective logged Bedrock costs are 0.00059064,
0.00056812,
0.00219198 and 0.00056918 USD.
The corresponding OpenRouter calls report zero cost;
Synthetic and Hyper calls have no per-call price.
Each post-probe daily helper ran.

No probe or full-entry pass is active.
Archive apparatus/copy-edit treatment and temporal source context remain before the next Mio pass.
The naming result does not advance the entry queue without that page reading.
