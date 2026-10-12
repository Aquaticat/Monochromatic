# Translation repair: OpenRouter as the paid fallback provider, part 30

Part 30 of [Translation repair: OpenRouter as the paid fallback provider](translation-repair-openrouter-2026-09-03.md),
whose index lists every part in order.

## Class sixty-two, 2026-09-19, 06:15 UTC: one model's upstream rate limit holds the whole provider out

Found by XingZ612's lanes.
Inception's shared pool rate-limited Mercury 2.5 from 06:06 UTC,
and OpenRouter passed each refusal on as
`429 {"error":{"message":"Provider returned error","code":429,"metadata":{"raw":"inception/mercury-2.5 is temporarily rate-limited upstream. ...","provider_name":"Inception","provider_error_code":"rate_limit_exceeded","limit_source":"upstream_provider_shared_pool",...}}}`.
The transport ladder rode five attempts in 10 s and handed the reply to the router,
which read every 429 as the provider's budget refusal
(`isBudgetRefusal`)
and held the whole of OpenRouter out for 60 s
(`markRefused`,
"refused us while its meter reads wet",
16 holds between 06:06 and 06:12 UTC).
Every OpenRouter seat read unreachable for the minute,
the editors and refiners have no seat elsewhere while Synthetic and Hyper are dry,
and the seat wait stopped the entry at the hold's end:
`writing bench unreachable at lanes: editors 0 of 3 reachable, floor 2; refiners 0 of 3 reachable, floor 2; no provider has named its return`.
Three attempts,
31 minutes,
2.4 minutes and 1.7 minutes,
the same wall each time;
the meters never moved off wet
(Bedrock 149.20 to 148.02,
OpenRouter 215.18 to 214.17,
2.19 USD).
Mercury was asked 262 times and threw 89.
Fixed in `c340b496b`
(guard red first at `79b3ee845`,
`provider-budget-refusal.unit.test.ts`):
a 429 whose body opens with `"message":"Provider returned error"` is one model's upstream endpoint refusing,
not the account's budget
(`isUpstreamModelRefusal`);
`isBudgetRefusal` excludes it,
the router logs
`passed on its upstream endpoint's rate limit for this model; the seat is lost this round and the provider stays where its meter puts it`
and rethrows,
so the seat is dark for that round and the provider stays where its meter puts it.
A bare 429 and a 402 stay budget refusals.
The OpenRouter error page could not be fetched
(client-rendered);
the shape is taken from the live body.
XingZ612's admission at 06:00 UTC had confirmed class sixty-one live
(slice 70 admitted inside details of slices 67 to 71,
5 blocks against 4)
with no slice unresolved,
the first pass with none.

## XingZ612 launches on class sixty-one, 2026-09-19, 05:39 UTC

Frozen `75f67fbd4` (classes forty-one to sixty-one and the tail budget),
pid 895538,
runs `~/temp/agent/XingZ612`,
log `~/temp/agent/XingZ612.log`,
`TRANSLATION_REPAIR_SLICE_OVERLAP=8`,
Bedrock and OpenRouter wet,
Synthetic and Hyper dry at launch,
no cron job,
the background waiter alone reports the exit.
Admission read at 06:00 UTC,
21 minutes in:
class sixty-one live,
`insertion-container-deficit-admitted (slice 70 inside details of slices 67 to 71: the original writes 5 blocks there, the archive 4)`;
the tail admitted on the bound
(31 slices,
5,144 source code points at expansion 2.98,
expected 15,318,
last pair renders 173);
no `placement unresolved` on any slice,
the first pass with none.
Read next the translate assembly,
the memorial disclosure block on the page with its four paragraphs,
the bilibili link,
the nine definitions,
the run time,
then the seven steps and the three checks.

## Class sixty-one, 2026-09-19, 05:30 UTC: the interior budget refuses a paragraph the archive's block is short of

Found by XingZ611's admission,
17 minutes after launch,
and named a class by the owner.
Class sixty read as designed:
all 31 tail slices admitted on the bound,
the five splits among them
(95,
106,
107,
113 and 118)
included,
nothing unresolved in the tail.
Slice 70 was found absent
(split on XingZ608 and XingZ610)
and left "placement unresolved after the single round (verdict absent)":
the interior keeps the whole-page budget,
and on this page that budget is zero,
since the archive's translated half runs at 2.99 code points per source code point against the median's 2.65.
Slice 70 is the third paragraph of the memorial disclosure block
(172 source characters,
"her departure is an indictment of society and a call to each of us").
The archive's block is a translation of another revision of that memorial,
the Metal Gear Solid one,
three paragraphs where the original writes four and a summary none of whose sentences the current original carries;
the roster paired what it could and left the third paragraph source-only.
The translate lane bought nothing for it
("the page has no room to be missing it")
and it would have shipped as a recorded gap.
Fixed in `75f67fbd4`
(guard red first at `1083b9163`,
`insertion-container-deficit.unit.test.ts`):
inside a container both of whose halves the archive carries,
the original's block count against the archive's is the deterministic second signal the budget could not give,
and absent verdicts inside are admitted while the deficit lasts,
in document order,
before the container halves
(`insertion-container-deficit.ts`,
the finding `insertion-container-deficit-admitted (slice N inside details of slices A to B: the original writes S blocks there, the archive T)`).
A container the archive carries with as many blocks as the original admits nothing,
and a split with an anchored claim is not an absent verdict.
XingZ611 was killed at 05:37 UTC,
1 hour and 42 minutes in,
both lanes over
(no withdrawal,
no footnote revert on the translate assembly),
6.91 USD by the meters
(Bedrock 151.81 to 149.25,
OpenRouter 219.58 to 215.23),
5,675 seats,
111 retry rounds.

## XingZ611 launches on class sixty, 2026-09-19, 03:55 UTC

Frozen `de25b4ed8` (classes forty-one to sixty and the tail budget),
pid 856143,
runs `~/temp/agent/XingZ611`,
log `~/temp/agent/XingZ611.log`,
`TRANSLATION_REPAIR_SLICE_OVERLAP=8`,
Bedrock and OpenRouter wet,
Synthetic and Hyper dry at launch,
no cron job,
the background waiter alone reports the exit.
Read first the admission:
the `untranslated tail:` line,
then no `placement unresolved` on slices 89 to 119
(a split there now carries `insertion-split-in-tail` and is admitted on the bound),
then the translate assembly,
the bilibili link,
the nine definitions,
the run time,
then the seven steps and the three checks.

## Class sixty, 2026-09-19, 03:50 UTC: a split verdict inside the admitted tail stays unresolved

Found by XingZ610's admission,
19 minutes after launch.
The tail line read as designed:
"31 slice(s) after the last agreed pair,
5175 source code points at expansion 2.99,
expected 15455,
last pair renders 173:
admitted on that bound".
Twenty-eight of the 31 were admitted;
slices 102,
108 and 113 were left "placement unresolved after the single round (verdict split)",
since the tail rule admitted absent verdicts and unanchored splits alone,
and each of the three had one voice anchor a claim of coverage on the page
(the cached replies quote archive lines the pairing assigned to nobody,
the archive's own "This version is NOT the formal version" note among them).
Slice 113 is the second footnote definition,
which split on XingZ608,
XingZ609 and XingZ610 alike;
on XingZ608 it shipped as a recorded gap.
Slices 102 and 108 were absent on both earlier runs.
Fixed in `de25b4ed8`
(guard red first at `6420d96e8`,
`insertion-tail-split.unit.test.ts`):
inside a tail the bound admits,
a split is no majority and the bound decides it;
a verdict a majority carried still stays out.
The finding `insertion-split-in-tail (slice N, full F, partial P, absent A of K asked; no majority, the tail bound decides)`
names the tallies beside the corroboration.
XingZ610 was killed at 03:53 UTC,
29 minutes in,
69 repair chunks started,
2.08 USD by the meters
(Bedrock 152.96 to 151.85,
OpenRouter 220.62 to 219.65),
2,074 seats,
26 retry rounds.

## XingZ610 launches on the tail budget, 2026-09-19, 03:24 UTC

Frozen `5bda732de` (classes forty-one to fifty-nine,
the deepseek route,
the untranslated tail's own budget),
pid 834115,
runs `~/temp/agent/XingZ610`,
log `~/temp/agent/XingZ610.log`,
`TRANSLATION_REPAIR_SLICE_OVERLAP=8` on the launch line,
Bedrock and OpenRouter wet,
Synthetic and Hyper dry at launch,
no cron job,
the background waiter alone reports the exit.
Read first the admission's `untranslated tail:` line
(31 slices after the last agreed pair,
about 5,100 source code points at the page's own expansion of about 2.9,
expected about 14,900 against the last pair's rendering,
"admitted on that bound"),
then every tail slice's `insertion-corroboration (slice N, tail admitted, ...)` finding
and no `placement unresolved` on slices 89 to 119,
then the translate lane's assembly
(no `assembly-footnote-reverted unresolved-reference`,
no `assembly-withdrew-every-replacement`),
then the bilibili link in the poem attribution on the page,
then the nine definitions on the page under the original's labels,
then the run time against XingZ608's 2h16m,
then the seven steps and the three checks.

## The untranslated tail is budgeted from the pairing, 2026-09-19, 03:20 UTC: the owner's "Do #1"

The owner answered the shortfall budget question at 02:55 UTC with "Do #1":
a budget per aligned region,
the untranslated tail's own expectation read off the pairing's last agreed pair.
Built in `5bda732de`
(guards red first at `c6c869267`),
after a measurement that narrowed the region to the tail.

The measurement,
over every run that left both an artifact and a log
(the artifact's comparison rows give each slice's archive text,
the repair lane's `SLICE-START` lines its source size,
the admission's `coverage=` lines the roster's verdict):
a window of one paired neighbour each side of an insertion run,
read at the page's own paired expansion,
refused passages the pages needed.
hakureico's last line
(73 source code points,
wanting 172 at the page's 2.36)
was refused on a neighbour 44 code points over its expectation;
xiept2 lost 8 of 25 interior passages the same way;
shi_Yumiaoya's slice 4 and noname's opening heading likewise.
One paragraph's expansion is noisy by more than a small passage's size,
so a neighbour-sized window cannot read a merge at that scale.
The whole-page budget averages that noise away,
which is why the decision of 2026-08-23 measured clean on 92 pairs;
its blind spot is the page whose archive stops early and runs long.

The tail is the one region the pairing makes exact.
`readUntranslatedTail` (`coverage-tail.ts`) takes every source-only slice after the last agreed pair,
the page's own expansion over its paired slices
(the corpus median when nothing was paired),
and the tail's expectation as its source at that expansion.
The second signature stays model-free,
as the decision requires:
the pairing is a roster's work,
so "nothing after the last pair" is not the deterministic reading;
size is.
A tail whose expectation exceeds the last agreed pair's whole rendering cannot have been merged into it,
the one place a tail could hide,
and is admitted on that bound
(`insertion-corroboration (slice N, tail admitted, ...)`).
A smaller tail stays with the whole-page budget,
where it was.
The interior's whole-page budget leaves an admitted tail's source out,
so the tail's absence is not counted twice.
The roster-free `admitInsertions` path,
which has no coverage verdict as a first signal,
is unchanged.
On XingZ60 the tail is slices 89 to 119,
about 5,100 source code points at the page's own 2.9,
expected about 14,900 against slice 88's rendering of a few hundred:
admitted whole,
where the whole-page budget had 10,794 for everything.

XingZ609 (frozen `06b395ac7`) was killed at 03:24 UTC under always-kill-and-relaunch,
35 minutes in,
118 repair chunks done,
the translate lane not entered.
Its admission had confirmed class fifty-nine live:
`insertion-definition-admitted (slice 117 defines 4, referenced by the page ...)`
and `(slice 118 defines 9, referenced by slice 94 ...)`,
with slice 112 still unresolved on the budget,
which the tail rule now covers.
Spend by the meters:
Bedrock 154.76 to 152.96,
OpenRouter 222.07 to 220.62,
3.25 USD.


Frozen `06b395ac7` (classes forty-one to fifty-nine,
the deepseek route),
pid 775640,
runs `~/temp/agent/XingZ609`,
log `~/temp/agent/XingZ609.log`,
`TRANSLATION_REPAIR_SLICE_OVERLAP=8` on the launch line,
Bedrock and OpenRouter wet,
Synthetic and Hyper dry at launch,
no cron job,
the background waiter alone reports the exit.
Read first the admission's `insertion-definition-admitted` lines for the definition slices 112 to 119
(each names the label and the referencing slice),
then the translate lane's assembly
(no `assembly-footnote-reverted unresolved-reference`,
no `assembly-withdrew-every-replacement`),
then the bilibili link in the poem attribution on the page,
then the nine definitions on the page under the original's labels
with the orphan trim's findings for any definition no marker on the page references,
then the run time against XingZ608's 2h16m,
then the seven steps and the three checks.

## Class fifty-nine, 2026-09-19, 02:45 UTC: the shortfall budget refuses the definitions the shipped markers reference

Found by the XingZ608 read.
The whole-page shortfall budget
(`coverage-corroboration.ts`;
expected English at the corpus median of 2.65 code points per source code point,
less what the page carries)
is spent over the absent-voted passages in document order,
and a page's footnote definitions stand last.
XingZ60's budget is 10,794 code points
(16,650 source code points against 33,329 on the archive page);
the passages at slices 89 to 111,
4,043 source code points,
spent 10,714 of it,
and none of the eight definition slices
(112 to 119,
63 to 192 source code points each)
fitted the 80 that remained.
Every one was refused,
"the page has no room to be missing it",
while the translate lane wrote slices carrying `[^3]`,
`[^7]`,
`[^8]` and `[^9]`.
The lane's assembly then reverted every carrier of a marker with no definition
(`assembly-footnote-reverted unresolved-reference gfm 3`,
`7`,
`8`,
`9`),
slice 95 among them,
the poem attribution holding the page's only rendering of the bilibili link,
and the entry stopped INCOMPLETE at publish on the dropped destination.
XingZ605 refused the same tail
(112 to 117);
XingZ607 attempt 1 refused slices 99 and 102 instead,
1,953 code points that left the tail room.

Fixed in `06b395ac7`
(guards red first at `db5f0124e`):
`admitReferencedDefinitions` (`insertion-referenced-definitions.ts`) runs after the container halves
and admits every unresolved definition whose label the standing page or an admitted slice's source references
and nothing on the shipping page defines,
finding `insertion-definition-admitted (slice N defines L, referenced by slice M ...)`.
A marker the page will carry with no definition under its label is the page's own graph saying the definition is absent,
the same kind of independent signal as a missing destination,
which the admission already reads past the budget.
A definition nothing references stays with the budget,
and a definition the page already carries under that label is left alone.
Definitions a slice brings in beside the referenced one that no marker on the page references
are trimmed by class twenty-one's orphan guard at assembly.

An open question stands beside the fix,
recorded in the handover's "The shortfall budget question":
the budget under-reads a page whose archive stops early and runs long.
XingZ60's archive ends at "Under Construction" with the source's second half untranslated,
and its translated half runs at about 3.3 English code points per source code point against the corpus median of 2.65,
so the whole-page shortfall reads 10,794 where the untranslated half alone
(slices 89 to 119,
about 5,100 source code points)
expects about 13,600.
The budget refused nothing on XingZ608 that class fifty-nine does not now admit,
but a longer untranslated tail would run out of budget on prose,
which no structural rule admits.

## XingZ608 read, 2026-09-19, 02:35 UTC: INCOMPLETE at 2h16m at publish, the run time verified

Frozen `eaaf39ec3`,
2 hours and 16 minutes
(`ms=8153159`),
`status=INCOMPLETE`,
`error=entry XingZ60 would drop 1 source destination(s)`,
one attempt,
no page written.
Spend by the meters:
Bedrock 158.98 to 154.76,
OpenRouter 227.93 to 222.07,
10.08 USD;
`pass-spend.mjs` logs 7,958 seats and 284 retry rounds.

The run time first.
Preparation 00:16 UTC,
pictures 00:24 UTC,
repair lane 00:33 UTC,
translate lane 01:10 UTC,
lane contest 01:41 UTC,
consolidation 01:45 UTC,
publish 02:31 UTC:
the whole pipeline in 2h15m where XingZ607 attempt 1 reached consolidation at 5h05m and the deadline at 7h.
deepseek-v4.1-flash was served by Morph 680 times,
Krea 291 and Makora 4,
never DeepInfra or Wafer,
at a median of 11.1 s,
11.0 s and 17.9 s;
no HTTP 429 at eight in flight.
The endpoint route and the overlap of 8 are kept.

Then the stop.
The admission admitted slices 89 to 111 and refused 112 to 119,
the footnote definitions,
on the whole-page shortfall budget
(class fifty-nine,
the heading dated 2026-09-19 02:45 UTC);
no `insertion-container-half-admitted` line was needed
(slice 99 was admitted on its own split verdict with no anchored claim,
slice 102 on an absent one),
and no half shipped alone.
The translate lane wrote 112 slices and its assembly reverted the four marker carriers,
nothing else:
class fifty-eight's advancing withdrawal was not exercised
(no structural break),
and no blanket withdrawal fired.
Jev's select ballots:
agreed with the round winner 87 of 106 in repair,
44 of 65 in translate,
31 of 39 in consolidation.
Two consolidation slices shipped the archive's wording without contest endorsement
(slices 53 and 66,
`final-selection-unendorsed`),
and slice 14's standing was withheld from the slate for the untranslated pronoun and a valid proposal shipped
(class fifty-four's path).
The page's footnotes,
components,
summary and profile link are read on XingZ609.


Frozen `eaaf39ec3`,
pid 725364,
runs `~/temp/agent/XingZ608`,
log `~/temp/agent/XingZ608.log`,
Bedrock and OpenRouter wet,
Synthetic and Hyper dry at launch,
`TRANSLATION_REPAIR_SLICE_OVERLAP=8` on the launch line
(the pass-overlap decision's variable,
which overrides the four in either direction;
XingZ607 met 5 HTTP 429 refusals in 6,289 calls at four and no Bedrock throttle),
no cron job,
the background waiter alone reports the exit.
Read first the run time against XingZ607's 8h41m
(one attempt,
under the seven-hour deadline,
the phase boundaries),
the endpoints serving deepseek-v4.1-flash
(`served by "Morph"`,
never DeepInfra or Wafer)
and the 429 count at eight,
then the admission lines for slices 99 and 102
(`insertion-container-half-admitted`),
the translate lane's assembly
(no `assembly-withdrew-every-replacement`),
the five archive-absent disclosure blocks on the page with the bilibili link,
then the seven steps and the three checks.

## deepseek-v4.1-flash routed off DeepInfra and Wafer, 2026-09-19, 00:05 UTC: the endpoint was the slow seat

Measured on XingZ607 for the run-time work
(the task the seven-hour deadline opened).
Every judge seat but one answers under 14 s at the ninetieth percentile
(minimax 4 s,
gpt-oss 14,
gemma-26b 3,
mercury 8,
jev 0);
deepseek-v4.1-flash answered at 30 s median and 129 s at the ninetieth,
set the quorum time in 553 of the run's 2,320 rounds
(689 of the 1,173 minutes of quorum wait,
249 of them in select rounds,
165 in lane contests,
70 at the consolidate gates),
held 15 rounds to the full 360 s timeout,
and was abandoned 93 times after the 120 s grace.
The completion cap held it:
its longest completed reasoning was 56 thousand characters and every cut stream sat at the 13,082-token pooled ceiling
(the "1.4 million characters" of the attempt 1 heading were raw stream bytes,
not reasoning).
By endpoint the picture splits:
Morph served 262 calls at 11 s median and 25 s at the ninetieth,
DeepInfra 701 at 45 s and 158 s with 89 of the 97 cut streams,
Wafer 27 at 26 s and 122 s with the other 8.
XingZ605,
served by Morph alone,
was the fastest XingZ60 run at 4h08m;
XingZ604 and XingZ607 ran on DeepInfra.
Fixed in `ac93f7978` by the class twenty-four route:
`ignoredEndpoints: ['deepinfra', 'wafer']` on the card,
slugs from the gateway's providers listing of 2026-09-18,
the catalog and client tests updated
(`4cd9bf5c1`).
The other levers stay measured and unpulled:
the refiners' 37 minutes of grace after quorum were deepseek's stragglers,
and the lane width moves by the launch variable.

## Class fifty-eight, 2026-09-19, 00:10 UTC: two structural breaks defeat the single-withdrawal proof and empty the lane

The second half of the XingZ607 withdrawal.
The assembly guard's counterfactual withdraws one replacement at a time and keeps the first that leaves the page whole;
a page with two breaks fails every single withdrawal and the guard withdrew all 88 replacements.
Fixed in `eaaf39ec3`
(guards red first at `35b2125d2`):
`MdxParseError` carries the line and column the parser named,
`strict-refusal-offset.ts` reads them as an offset into the whole text,
and `advancingStructuralWithdrawal` withdraws the replacement that moves the first refusal furthest later
(`assembly-structure-advancing-withdrawal slice N: reverting this replacement moves the first strict-parse refusal from offset A to B`),
so the next round reads what is left,
one break at a time.
The blanket withdrawal remains for a defect no withdrawal moves.

## Class fifty-seven, 2026-09-18, 23:55 UTC: a container half ships without its partner and the translate lane withdraws every slice

Found by the XingZ607 read.
The archive carries six of the original's eleven disclosure blocks.
Two of the five it never carried
(the vampire-poem block at source line 452 and 锦心's block at line 509)
had their opening halves,
the `<details>` tag with its `<summary>`,
left unfilled at the insertion admission:
`slice 99: coverage=split` and `slice 102: coverage=split`,
`placement unresolved after the single round (verdict split); not admitted`,
one voice having anchored the poem's title in the archive's other summary.
Their bodies and closing halves were admitted `absent`,
translated,
and assembled:
the lane's page carried two `</details>` with no opening,
the strict grammar refused it at the first
(`mdast-util-mdx-jsx/unexpected-closing-slash`,
reproduced offline from the slice cache with the frozen parser),
the guard's one-slice counterfactual could not repair a page with two,
and it withdrew all 88 replacements:
`assembly-structure-unattributable mdx-downgraded`,
`assembly-withdrew-every-replacement (88 slices)`,
then `translate changed 0/120 slices`.
The same withdrawal stands in the XingZ602,
XingZ604 and XingZ605 logs,
masked by the earlier stops;
XingZ606 downgraded twice and blamed a slice each time.
Fixed in `6036e6618`
(guards red first at `55cd8f7e7`,
the pair reader's own cases at `caac6e3a0`):
`container-half-pairs.ts` reads the source of every slice for lone container tags and pairs each opening half with its closing half;
`insertion-container-halves.ts` admits the unadmitted half of any container one of whose slices was admitted on its own evidence
(`insertion-container-half-admitted (slice 99 beside slice 100: one container's halves ship together, and slice 100 is admitted)`);
`assembly-container-halves.ts` withholds,
at the translate lane's assembly and at the composed page's,
a half whose partner ships nothing
(`assembly-container-half-withheld (slice N beside slice M: ..., and slice M ships nothing)`).
Measured over XingZ607's own slice records:
with the two lone closing halves withheld the lane's page parses as MDX.
Recorded as an addendum to the absence-verdict decision.

## XingZ607 attempt 2 read, 2026-09-18, 23:20 UTC: INCOMPLETE at 1h41m, one source destination dropped, the translate lane empty

Frozen `139a7f99a`,
attempt 2 from 21:39 to 23:20 UTC
(`ms=6064867`),
`status=INCOMPLETE`,
`error=entry XingZ60 would drop 1 source destination(s)`,
no page written,
`attempts.json` reads 2.
Spend by the meters over both attempts:
Bedrock 163.38 to 158.98,
OpenRouter 235.95 to 227.93,
12.42 USD.
The dropped destination is the bilibili link in the poem attribution
(source line 435,
slice 95),
which only the translate lane rendered
(gemma-26b's candidate,
`[Bird in a Cage](https://www.bilibili.com/video/BV17Q4y1s7j1)`);
the lane had withdrawn every replacement at its assembly
(class fifty-seven),
so the page carried none of the five archive-absent disclosure blocks and the destination floor was the first floor to say so.
Slice 113
(a paragraph inside 盖棺定论's block,
which the archive does carry)
also split and stays a recorded gap;
it opens no container.
Classes fifty-four to fifty-six held
(the attempt 1 heading);
the page-level checks
(the nine definitions,
the components,
the `details` summary,
the profile link)
wait for a page.
The 1h41m of attempt 2 were consolidation
(slices 70 to 84 bought,
the rest replayed),
so the entry's whole work was 8h41m and two attempts.

## XingZ607 attempt 1, 2026-09-18, 21:39 UTC: the seven-hour entry deadline in consolidation, both pronoun paragraphs shipped

Attempt 1 ran the whole seven hours
(`TALLY XingZ60 status=ERROR ms=25200004 aborted=true error=refused by StreamCutShortError`,
the per-entry deadline in `pass-entry.ts`)
and the attempt queue re-queued the entry at once
(`REATTEMPT XingZ60 queued: 444 more cache records than it had`,
`attempts.json` reads 2);
attempt 2 replays the cached slices under the same pid and was into the lane contests within four minutes.
Classes fifty-four to fifty-six held:
the funeral paragraph
(slice 13,
standing withheld at 20:13 UTC)
went through its gate at 20:16 UTC told the standing cannot ship,
three ballots for the consolidation
(GPT-OSS,
minimax,
gemma-26b,
each naming the untranslated TA)
against gemma-e2b's "correctly preserves the pronoun 'TA' as dictated by the corpus rules",
`settled on consolidated, ships consolidated`;
the teachers paragraph
(slice 33,
withheld at 20:44 UTC)
the same at 20:47 UTC,
three to one with gemma-e2b again the one,
`exit=computed` at 20:52 UTC.
No slice stopped.
Where the seven hours went,
phase by phase:
pictures and preparation 14:40 to 14:55 UTC,
repair lane 14:55 to 17:50 UTC,
translate lane 17:50 UTC to about 19:20 UTC,
lane contests to 20:00 UTC,
consolidation 20:00 UTC to the deadline at 21:39 UTC with 56 of the slices started and chunk 69 the furthest.
Slice time by lane
(`SLICE-COST`,
concurrent):
repair 2.0 minutes a slice over 240,
translate 1.5 over 232,
consolidation 7.1 over 56.
Inside the consolidation phase the select rounds took 147 minutes of wall time
(116 to quorum),
the refiners 68
(37 of it grace),
the naturalness review 50,
the gates 33 and 25.
deepseek-v4.1-flash is the slow seat:
93 of its 845 calls abandoned,
13 calls at the 360 s timeout
(6 select,
5 lane-contest,
2 consolidate-gate),
15 streams cut between 450 thousand and 1.4 million characters,
2.52 USD of the 9.52 logged,
the most of any seat.
GLM-5.3-Flash on Synthetic ran one coverage stream to 10.5 million characters.
Spend by the meters at the deadline:
Bedrock 163.38 to 160.08,
OpenRouter 235.95 to 230.05,
9.20 USD;
`pass-spend.mjs` logs 7594 seats and 227 retry rounds.
The page read waits on attempt 2.

## XingZ607 launches on class fifty-six, 2026-09-18, 14:40 UTC

Frozen `139a7f99a` (classes forty-one to fifty-six plus the decision seat),
pid 571308,
runs `~/temp/agent/XingZ607`,
log `~/temp/agent/XingZ607.log`,
providers at launch `synthetic=dry bedrock=wet hyper=dry openrouter=wet`,
meters Bedrock 163.38 and OpenRouter 235.95,
no cron job,
the background waiter alone reports the exit.
It resumes from XingZ606's slice cache.
Read first the consolidation of the teachers paragraph
(the slice whose standing carries the untranslated pronoun;
its gate sheet now says the standing cannot ship,
and every gate ballot is logged with its reason:
`consolidate gate ballot <model>: <choice>: <reason>`),
then any other `CANNOT SHIP` gate and how it went,
then the page's teachers and funeral paragraphs
(no TA left standing),
then the nine footnote definitions and their labels,
the components,
the `details` summary,
the profile link,
then the seven steps and the three checks.

## Class fifty-six, 2026-09-18, 14:36 UTC: the gate keeps an ineligible standing it was never told cannot ship, and logs no reasons

Found by the XingZ606 read.
A third paragraph of the entry,
the one on the parents being teachers,
carries the untranslated pronoun in the archive and in the contest winner,
so its consolidation ran with the standing withheld:
the slate chose GPT-OSS's valid proposal 2 to 1.5
(the challenge of class fifty-five was not needed),
and the consolidate gate went 4 of 5 usable for the standing.
A gate refusing at quorum stops the slice under the 2026-09-04 rule,
and the log carried only the tally,
so why four judges preferred a text the rule refuses could not be read afterwards.
The gate sheet showed the judges the standing as a rendering to keep,
with nothing saying it fails the deterministic publication rule or that keeping it stops the entry,
and the comparison they were asked for was against a text that was never going to ship.
Fixed in `139a7f99a`
(guards red first at `90e5e2a19`):
`readStandingVerdict` returns the refusal it already logged
(`standingRefusal`),
the driver,
the buy and the settlement carry it to the gate subject,
and the gate sheet says
`CANDIDATE "standing" CANNOT SHIP: the deterministic publication rule refused it (...)`,
that choosing it stops the entry with no page,
and that a rendering the rule refuses is not the safer choice.
Every gate ballot is now logged with its model,
choice and reason.
A gate that still refuses at quorum still stops the slice;
whether the sheet changes the ballots is what XingZ607 measures.

## XingZ606 read, 2026-09-18, 14:30 UTC: INCOMPLETE at 3h04m on slice 33, the gate keeping the teachers paragraph's standing

Frozen `adca69d4e`,
3 hours and 4 minutes
(`ms=11050301`),
`status=INCOMPLETE`,
`error=slice 33: the standing text failed the deterministic publication rule and the consolidation left nothing valid to ship (gate-kept-standing)`,
no page written,
`attempts.json` reads 1.
Spend by the meters:
Bedrock 166.41 to 163.38,
OpenRouter 239.86 to 235.97,
6.92 USD;
`pass-spend.mjs` logs 6446 seats and 155 retry rounds
(select 411 rounds,
1971 asked,
1737 heard;
translate 168 rounds,
676 asked,
497 heard).
Phases:
preparation 11:18 UTC,
pictures 11:25 UTC,
lanes 11:31 UTC,
translate lane 13:05 UTC,
lane contest 13:56 UTC,
consolidation 14:03 UTC,
stop 14:22 UTC;
Synthetic and Hyper dry throughout
(`wide=7 select=8`),
the fastest of the three XingZ60 consolidations to be reached.
The stop is class fifty-six
(the heading dated 2026-09-18 14:36 UTC).
The funeral paragraph raised no warning in this consolidation,
so classes fifty-four and fifty-five were not exercised on it;
the gate over the whole consolidation went
6 consolidated,
4 neither and 4 standing across 14 slices.

What held:
`image0.webp` corroborated by 3 of 3 readers at overlap 0.590;
eleven `declined-indecision` challenges in the translate lane,
none a run-off.
Jev live:
`SEAT typesafe/jev-1.13 asked=224 usable=223 unusable=0 threw=1`
(one HTTP 520 from OpenRouter at 14:13 UTC,
the voice lost),
agreeing with the round's winner on 100 of 119 repair select rounds,
56 of 70 translate slates and 14 of 18 consolidation slates.
No page,
so the definitions,
components,
`details` summary and profile link could not be read.

## XingZ606 launches on class fifty-five, 2026-09-18, 11:20 UTC

Frozen `adca69d4e` (classes forty-one to fifty-five plus the decision seat),
pid 512931,
runs `~/temp/agent/XingZ606`,
log `~/temp/agent/XingZ606.log`,
providers at launch `synthetic=dry bedrock=wet hyper=dry openrouter=wet`,
meters Bedrock 166.41 and OpenRouter 239.86,
no cron job,
the background waiter alone reports the exit.
It resumes from XingZ605's slice cache
(slice 13's consolidation was not cached,
its settlement threw).
Read first slice 13's consolidation
(a `translate-declined-retried` finding with a run-off,
or a slate at quorum on the first ask,
then a gate at quorum or `undecided-gate-ships-proposal`,
never a stop),
then the page's rendering of the funeral paragraph
(no TA left standing),
then the nine footnote definitions and their labels,
the components,
the `details` summary,
the profile link,
then the seven steps and the three checks.
