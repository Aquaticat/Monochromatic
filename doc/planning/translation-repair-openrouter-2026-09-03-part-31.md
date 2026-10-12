# Translation repair: OpenRouter as the paid fallback provider, part 31

Part 31 of [Translation repair: OpenRouter as the paid fallback provider](translation-repair-openrouter-2026-09-03.md),
whose index lists every part in order.

## Class fifty-five, 2026-09-18, 11:15 UTC: a tied consolidation slate over an ineligible standing declines without the challenge round

Found by the XingZ605 read.
Slice 13 again:
the standing withheld as ineligible
(the translate lane won the contest 4 of 5 with the untranslated pronoun still in its text),
the slate offered three writers' proposals and the repair lane's text,
all four valid,
and the judges split 2 to 2
(DeepSeek and Mercury for one "her" rendering,
Gemma E2B and GPT-OSS for the repair lane's).
`judgeTranslateSlate` declined `declined-indecision`,
the consolidation named it `slate-declined-standing`,
and the entry stopped INCOMPLETE at 4h08m,
before class fifty-four's gate path was ever reached.
The translate lane has re-asked a declined slate once under `decline-challenge` since class fifty-three,
narrowing a tie to the candidates that drew a ballot;
the consolidation called the judge directly and had no second ask.
Fixed in `adca69d4e`
(guard red first at `c6ec06788`):
`settleConsolidation` routes the slate through `judgeSlateWithRetry` when the standing is ineligible,
so a tie or rejection is challenged once with the run-off before the slice is given up;
an eligible standing keeps the single round,
since there a decline keeps text the contest endorsed.
The guard's fixture now takes a scripted judge reply
(a function over the sheet and the call count)
so one round can tie and the challenge round can settle.

## XingZ605 read, 2026-09-18, 11:12 UTC: INCOMPLETE at 4h08m on slice 13, the slate tied

Frozen `0d0747200`,
4 hours and 8 minutes
(`ms=14889531`),
`status=INCOMPLETE`,
`error=slice 13: the standing text failed the deterministic publication rule and the consolidation left nothing valid to ship (slate-declined-standing)`,
no page written,
`attempts.json` reads 1.
Spend by the meters:
Bedrock 169.57 to 166.42,
OpenRouter 242.13 to 239.87,
5.41 USD;
`pass-spend.mjs` logs 6220 seats and 108 retry rounds
(select 412 rounds,
2001 asked,
1889 heard;
translate 179 rounds,
706 asked,
511 heard).
Phases:
preparation 07:01 UTC,
pictures 07:05 UTC,
lanes 07:13 UTC,
translate lane 09:47 UTC,
lane contest 10:50 UTC,
consolidation 10:55 UTC,
stop 11:08 UTC;
Synthetic dry throughout,
Hyper wet at launch and dry by the consolidation
(`wide=7 select=8`).
The stop is class fifty-five
(the heading dated 2026-09-18 11:15 UTC);
class fifty-four's gate path was never reached.

What held:
`image0.webp` corroborated by 4 of 4 readers at overlap 0.603;
no `translate-runoff` finding
(class fifty-three still untested live).
Jev live:
`SEAT typesafe/jev-1.13 asked=254 usable=254 unusable=0 threw=0`,
245 ballots logged,
agreeing with the round's winner on 117 of 156 repair select rounds,
46 of 62 translate slates and 3 of 4 consolidation slates
(`jev-agree.mjs`).
The nine footnote definitions,
the components,
the `details` summary and the profile link could not be read:
no page.
Elsewhere in the consolidation a slate over an eligible standing
(the rescue-work paragraph)
drew only weight 1.5 across 5 ballots with MiniMax declining all four candidates over the declared name of a linked person,
and kept its standing as designed.

## XingZ605 launches on class fifty-four, 2026-09-18, 07:03 UTC

Frozen `0d0747200` (classes forty-one to fifty-four plus the decision seat),
pid 474604,
runs `~/temp/agent/XingZ605`,
log `~/temp/agent/XingZ605.log`,
providers at launch `synthetic=dry bedrock=wet hyper=wet openrouter=wet`,
meters Bedrock 169.57 and OpenRouter 242.13,
no cron job,
the background waiter alone reports the exit.
It resumes from XingZ604's slice cache
(slice 13's consolidation was not cached,
its settlement threw).
Read first slice 13's consolidation
(the `undecided-gate-ships-proposal` finding,
or a gate at quorum either way,
never a stop),
then the page's rendering of the funeral paragraph
(singular they or the name where the original writes TA,
no TA left standing),
then the nine footnote definitions and their labels,
the components,
the `details` summary,
the profile link,
then the seven steps and the three checks.

## Class fifty-four, 2026-09-18, 06:58 UTC: the consolidate gate's indecision keeps an ineligible standing over the proposal the slate chose

Found by the XingZ604 read.
The archive's funeral paragraph carries the original's neutral pronoun untranslated
("in the eyes of TA's parents"),
which the deterministic publication rule refuses,
and the lane contest settled 5 of 7 on the translate lane's text,
which carries it too;
so the consolidation's standing was ineligible and,
under the 2026-09-09 addendum,
the incumbent could not stand in.
The slate offered the writers' proposals and the repair lane's text
(which had rendered TA as "their"),
the slate judges chose GPT-OSS's proposal 3 of 4
("her parents",
"gender expression"),
and the consolidate gate went 5 of 7 usable with neither rendering at its quorum of two over the other.
The gate's rule that indecision keeps the standing text fell back to the ineligible standing,
`requireShippableTerminal` refused `gate-kept-standing`,
and the entry stopped INCOMPLETE at 4h53m over a text the judges had already endorsed.
Fixed in `0d0747200`
(guard red first at `b8b32e28d`):
`shipPastUndecidedGate` (`consolidate-ineligible-standing.ts`) resolves a `neither` verdict over an ineligible standing toward the consolidation,
recording `undecided-gate-ships-proposal`,
under the owner's 2026-09-04 rule that the best valid proposal is preferred.
A gate that refuses the consolidation at quorum still keeps the standing and still stops the slice;
an eligible standing keeps the slice on the same indecision as before.
Addendum in `doc/decision/translation-repair-ineligible-standing.md`.

## XingZ604 read, 2026-09-18, 06:55 UTC: INCOMPLETE at 4h53m on slice 13, the first pass with a typed-decision judge

Frozen `c14c7f176`,
4 hours and 53 minutes
(`ms=17589011`),
`status=INCOMPLETE`,
`error=slice 13: the standing text failed the deterministic publication rule and the consolidation left nothing valid to ship (gate-kept-standing)`,
no page written,
`attempts.json` reads 1.
Spend by the meters:
Bedrock 172.62 to 169.57,
OpenRouter 247.06 to 242.14,
7.97 USD;
`pass-spend.mjs` logs 6655 seats and 401 retry rounds
(select 480 rounds,
2266 asked,
1854 heard;
translate 189 rounds,
731 asked,
489 heard).
Phases:
preparation 01:56 UTC,
lanes 02:10 UTC,
translate lane 05:19 UTC,
lane contest 06:33 UTC,
consolidation 06:38 UTC,
stop 06:47 UTC;
Synthetic went dry during the lanes and the contest and consolidation ran `wide=7 select=8`.
The stop is class fifty-four
(the heading dated 2026-09-18 06:58 UTC).

What held:
`image0.webp` corroborated by 5 of 6 readers at overlap 0.870
(class fifty-two live on a wider bench);
slice 14 translated on its first rounds
(GLM-5.3-Flash's candidates at weight 3 and 5 of 6,
one `declined-indecision` challenge elsewhere in the lane),
so class fifty-three's run-off was never needed and stays untested live;
no `translate-runoff` finding anywhere.

Jev live:
`SEAT typesafe/jev-1.13 asked=221 usable=221 unusable=0 threw=0`,
217 ballots logged
(130 repair-lane select rounds,
82 translate-lane slates,
5 consolidation slates),
every call on the decisions route.
Measured against the round's winner
(`jev-agree.mjs` over the log):
repair select 110 of 124 agree,
translate slate 53 of 76,
consolidation 4 of 5.
Its probabilities ranged from split
(0.49 against 0.41 on its first ballot,
confidence 0.24)
to decisive
(0.98,
confidence 0.97);
the log line carries them.
The nine footnote definitions,
the components,
the `details` summary and the profile link could not be read:
no page.

## XingZ604 launches on the Jev seat, 2026-09-18, 01:56 UTC

Frozen `c14c7f176` (classes forty-one to fifty-three plus the decision seat),
pid 211894,
runs `~/temp/agent/XingZ604`,
log `~/temp/agent/XingZ604.log`,
Synthetic,
Bedrock and OpenRouter wet,
Hyper dry at launch,
meters Bedrock 172.63 and OpenRouter 247.07,
no cron job,
the background waiter alone reports the exit.
The JUDGE SEATS line at 01:56 UTC reads `wide=8 select=9`:
the ninth select seat is `typesafe/jev-1.13`,
the first pass with a typed-decision judge on the select benches.
It resumes from XingZ602's slice cache.
Read first slice 14's translate rounds
(a winner,
or a `translate-runoff (finalists N of M)` finding,
never an ERROR),
then Jev's ballots in the select rounds
(reason prefix `typed decision`,
the probabilities on the line),
then the pictures line,
then the nine footnote definitions and their labels,
the components,
the `details` summary,
the profile link,
then the seven steps and the three checks.

## XingZ603 killed, 2026-09-18, 01:56 UTC: 60 minutes into the repair lane, the seat landed

Frozen `012b9ccc3`,
killed by pid at 01:56 UTC under always-kill-and-relaunch once `c14c7f176` seated Jev.
It had reached repair chunk 18 of the repair lane
(chunks 14 to 18 repaired,
chunk 10 unchanged)
and never entered the translate lane,
so class fifty-three is still untested live.
Spend by the meters:
Bedrock 173.08 to 172.63,
OpenRouter 247.86 to 247.07,
1.24 USD;
`pass-spend.mjs` logs 1238 seats and 28 retry rounds
(select 40 rounds,
196 asked,
179 heard).

## Jev 1.13 seated as a select judge, 2026-09-18, 01:47 UTC: 12 of 12 through the production probe

`ad20acc84` put `typesafe/jev-1.13` on the roster as a decision-only seat
(a `decisions` side on the card,
no chat catalog,
held `judge-unmeasured`,
`writer-unmeasured`,
`reader-unmeasured`),
`bc6fdc9b9` built the transport
(`decisions-client.ts` posting `{model, state, questions}` to the decisions endpoint through the retry policy,
`decision-contract.ts` reading the typed answers,
`stage-decision-call.ts` turning one into a stage voice,
`candidate-select-decision.ts` asking the select question as one `choice` over the candidate numbers with `0` for none)
and threaded it from `decideBestCandidate` through `gatherStageVoices` to `attemptStageCall`,
which routes a decision seat to `client.decide` instead of `chatJson`.
The router refuses `decide` while OpenRouter is dry and marks its refusals on the budgets.

The production probe ran at 01:40 UTC
(`mise run judge-fidelity-probe -- --candidates typesafe/jev-1.13`,
runs `~/temp/agent/jev-probe`,
log `~/temp/agent/jev-probe.log`)
over the 16 reviewed rows of `gqt` and `MTF_0615`
(the probe itself warned the matrix partial,
16 of 28,
the `Y1Ran` reference not on disk here),
Jev beside the ten seated judges.
Every one of Jev's 12 calls went through `provider=openrouter model=typesafe/jev-1.13` on the decisions route
(1173 to 1211 prompt tokens,
38 output tokens,
338 to 685 ms,
0.000049 to 0.000051 USD each),
the fan-out window spared it on the four `gqt` insertion rounds.
It chose the reviewed reference 12 of 12 times,
no damaged pick,
no decline,
probabilities 0.75 to 0.96 on the reference
(least sure on gqt's deletion rows at 0.75 to 0.81,
as the scratch measurement had found).
Peers on the same rows:
DeepSeek V4.1 Flash 12 of 12,
Mercury 12 of 12,
Qwen 10 of 10,
GLM-5.3-Flash 10 of 10,
Kimi,
GPT-OSS and MiniMax 8 of 8,
Gemma 26B 8 clean and 2 declined of 10,
Gemma E2B 8 clean and 2 damaged of 10;
glm-5.3 unreachable throughout
(Hyper dry).
Jev meets the admission bar
(clean count at the peer median,
damaged count below the peer maximum),
so `c14c7f176` removes `judge-unmeasured` from its card
(guards red first at `1e2c18de4`)
and `RUN_DECISION_JUDGES` seats it after every wide seat on `RUN_SELECT_JUDGES`,
seated when OpenRouter is wet and unseated when it is dry.
Only the candidate-select stage has a typed question for it;
consolidation slates,
lane contests,
panels and gates still call chat,
so a decision seat there is a lost voice,
never a vote.
Writer and reader holds stay:
a typed decision writes and reads nothing.
Runbook section "Add a decision-only model" in `882e4f8c2`.

## XingZ603 launches on class fifty-three, 2026-09-18, 00:55 UTC

Frozen `012b9ccc3` (classes forty-one to fifty-three),
pid 4181820,
runs `~/temp/agent/XingZ603`,
log `~/temp/agent/XingZ603.log`,
Bedrock and OpenRouter wet,
Synthetic and Hyper dry at launch,
meters Bedrock 173.08 and OpenRouter 247.86,
no cron job,
the background waiter alone reports the exit.
It resumes from XingZ602's slice cache.
Read first slice 14's translate rounds
(a winner,
or a `translate-runoff (finalists N of M)` finding,
never an ERROR),
then the pictures line,
then the nine footnote definitions and their labels,
the components,
the `details` summary,
the profile link,
then the seven steps and the three checks.

## Jev 1.13 approved on OpenRouter, 2026-09-18, 00:29 UTC: a typed-decision model, probed live

The owner:
"<https://openrouter.ai/typesafe/jev-1.13> is now up and approved on openrouter."
Jev is TypeSafe's System One model:
text in,
typed answers out
(a choice with a probability per option,
a yes-probability the docs call a noul,
a score over ordered levels),
no prose and no reason.
It is served through `POST https://openrouter.ai/api/alpha/decisions`
with `{model, state, questions}`,
each question `{type: 'choice' | 'noul' | 'score', instructions, criteria}`,
answering `{answers, usage: {input_tokens, output_tokens, cost}, model, provider}`
(OpenRouter's OpenAPI document,
schemas `DecisionsRequest` and `DecisionsResponse`;
TypeSafe's models page:
32k tokens of state plus the longest question,
0.042 USD per million input tokens,
output free).
A cat-themed live probe at 00:32 UTC answered in 1216 ms for 0.000023 USD:
the faithful candidate chosen at probability 1,
the detail-dropping candidate flagged at 0.98,
the meaning-changing candidate scored "changes the meaning" at 0.99.
It cannot take a chat completion,
so it fits only the seats whose ballot is a choice
(the select and slate judges,
the lane contest,
the panel's votes,
the polish gate,
the attestation confirm round),
through a decisions transport beside the chat clients
and a per-stage question the stage builds from the same sheet;
the judge fidelity probe seats it or not,
as for every candidate.
Open as the work of seating `typesafe/jev-1.13` in the vote-shaped seats by measured fidelity;
nothing is wired yet.

Measured at 01:05 UTC on the source-reviewed fidelity matrix
(`reviewedFidelityTrials` over the three reviewed references,
28 rows:
deletion and insertion in both directions and both positions,
alteration on the one reference that reviews it),
asked as one choice per row with the ungoverned translate criteria in the state
(the same task and criteria `runFidelityTrial` puts on the sheet,
a scratch script outside the package):
28 of 28 chose the reviewed reference,
no decline,
probabilities from 0.83 to 0.99 on the clean side,
mean 600 ms per row,
0.00137 USD for the matrix.
The one bench where it read least surely was gqt's deletion pair
(0.83 to 0.89 for the clean text,
0.09 to 0.12 for declining).
That is the bar DeepSeek V4.1 Flash and Mercury met on admission,
so the transport and the select-seat adapter are worth building;
the production probe re-measures it through the selector once wired.

## Class fifty-three, 2026-09-18, 00:45 UTC: a tied slate with nothing to fall back on is challenged over the same slate and stops the entry

Found by the XingZ602 read.
Slice 14 of XingZ60 is a content slice whose archive text carries the pronoun untranslated
("TA once said"),
which `validateTranslatedSlice` refuses
(measured with the frozen build on 2026-09-18),
so the translate stage ran it with `effectiveIncumbentKind` absent.
Five candidates went to the judges,
four of five were heard,
three named three different candidates at weight one against a minimum of two,
and the decline challenge put the identical slate to the same panel,
which split the same way.
The retry settled the slate as `no-candidate-backed` and raised the absence error;
the backstop in `translate-slice-attempt.ts` refuses to record a content chunk as unfilled and rethrew it;
the entry stopped `status=ERROR` at `ms=9459888`
(2 hours and 38 minutes)
and the REATTEMPT re-bought the translate lane,
where the same slice found a winner on the second try.
Fixed in `012b9ccc3`
(guard red first at `5ae2e79ad`,
shown red against the frozen `24372215a` build):
the judge records on the absence error which candidates a tie backed
(`runoffFinalists` in `translate-runoff.ts`,
a tie's finalists when fewer than the slate drew a ballot),
and the retry's challenge round offers only those,
naming the run-off in the findings
(`translate-runoff (finalists N of M)`).
A second tie still settles as before;
a rejection,
fewer than two backed candidates or a fully backed slate leave the whole slate on the second sheet.

## XingZ602 read, 2026-09-18, 00:56 UTC: ERROR at 2h38m on slice 14, the reattempt killed at 5h57m in consolidation

Frozen `24372215a`.
Attempt 1 ran from 18:56 to 21:34 UTC and stopped
`status=ERROR ms=9459888 error=slice has no translation in the archive and produced none (no-candidate-backed)`
on slice 14:
class fifty-three.
Before that,
the pictures phase corroborated `image0.webp` by 4 of 4 readers at overlap 0.570,
so class fifty-two held on the picture that stopped XingZ601 at 0.297.
Attempt 2 ran from 21:34 UTC,
resumed 143 cache records,
re-bought slice 14 with a winner,
reached the lane contest at 00:24 UTC and the consolidation at 00:47 UTC,
and was killed by pid at 00:56 UTC under always-kill-and-relaunch once `012b9ccc3` landed,
5 hours and 57 minutes after launch,
three consolidation slices in.
Spend by the meters:
Bedrock 177.43 to 173.08,
OpenRouter 253.32 to 247.91,
9.76 USD;
`pass-spend.mjs` logs 10034 seats and 348 retry rounds
(translate stage alone 173 rounds,
703 asked,
518 heard).
No page was written.
The run time is the open concern:
attempt 2 alone took 3 hours and 22 minutes to reach the consolidation on a 577-line entry,
against the owner's 7-hour ceiling.

## XingZ602 launches on class fifty-two, 2026-09-17, 18:56 UTC

Frozen `24372215a` (classes forty-one to fifty-two),
pid 3880778,
runs `~/temp/agent/XingZ602`,
log `~/temp/agent/XingZ602.log`,
Bedrock and OpenRouter wet,
Synthetic and Hyper dry at launch,
no cron job,
the background waiter alone reports the exit.
Read first the pictures phase:
`image0.webp` corroborated by two or three of the readers with the closest pair named,
then the nine footnote definitions and their labels,
the components,
the `details` summary,
the profile link,
then the seven steps and the three checks.

## Class fifty-two, 2026-09-17, 18:50 UTC: a picture three readers read is corroborated on the first two alone

Found by the XingZ601 read.
The picture corroboration compared the first two readings and no other,
under a comment calling the two "the whole roster today";
the vision bench has been five seats since Bedrock's Gemma readers were seated on 2026-09-08.
On XingZ601 three readers read the score screenshot
(gemma-4-31b 2792 characters,
gemma-4-26b 2501,
minimax-m3 2092;
GLM-5.3-Flash returned nothing after 206 seconds of reasoning,
Qwen3.8-27B refused by the router),
the two compared stood at overlap 0.297 against a threshold of 0.3,
and the entry stopped INCOMPLETE at the pictures phase after seven minutes.
Measured over the stored readings,
gemma-26b and gemma-31b agree at 0.586 and minimax and gemma-31b at 0.326;
the one pair the code chose was the only pair below the line.
Fixed in `24372215a`
(guard red first at `c8d9a990c`):
`clusterReadings` (`reading-cluster.ts`) measures every pair,
a reading vouched for by any other reading travels as corroborated,
the picture is corroborated when at least one pair agrees,
and a refusal names the closest pair.
A reading no other reading vouches for is left out of the corroborated set,
so the archive block review's one-transcript rule keeps choosing among readings that describe the same picture.

## XingZ601 read, 2026-09-17, 18:48 UTC: INCOMPLETE at the pictures phase

Frozen `479bb011f`,
7 minutes
(`ms=412885`),
`status=INCOMPLETE`,
`error=visual evidence incomplete for 1 referenced assets`,
no page written,
`attempts.json` reads 1.
Spend by the meters:
Bedrock 177.45 to 177.43,
OpenRouter 253.39 to 253.37,
0.04 USD;
`pass-spend.mjs` logs 90 seats and 3 retry rounds.
The deterministic reader found 58 characters on `image0.webp` (2400 by 2616),
three models read it,
and `readImagePair` refused it on the first two readings' overlap of 0.297:
class fifty-two.
Nothing past the pictures phase ran.

## XingZ601 launches, 2026-09-17, 18:39 UTC

Frozen `479bb011f` (classes forty-one to fifty-one),
pid 3839544,
runs `~/temp/agent/XingZ601`,
log `~/temp/agent/XingZ601.log`,
Bedrock and OpenRouter wet,
Synthetic and Hyper dry at launch,
no cron job,
the background waiter alone reports the exit.
The entry is 577 source lines against 358 archive lines,
the largest read so far:
nine footnote definitions in the original and none in the archive,
a `PhotoScroll`,
`Hexagon`,
`DottedNumber`,
`BlurBlock` and `TextRing` components,
a `details` block whose summary carries inline HTML and a blockquote,
two commented-out empty paragraphs,
and a profile link to another entry.
Read first the nine definitions on the page and their labels
(class nineteen's relabel,
class twenty-one's orphan guard),
then the components as the archive has them,
the `details` summary,
the profile link,
then the seven steps and the three checks.

## yingying1 read, 2026-09-17, 18:42 UTC: SETTLED, clean

Frozen `479bb011f`,
15 minutes
(`ms=885658`),
`status=SETTLED` on the first attempt,
`translateStatus=complete`,
`pageSilent=0`,
`attempts.json` reads 1,
35 page lines against the archive's 23.
Spend by the meters:
Bedrock 177.53 to 177.45,
OpenRouter 253.52 to 253.42,
0.18 USD;
`pass-spend.mjs` logs 345 seats and 12 retry rounds.
Both footnote definitions on the page under their own labels,
the bare-URL definition byte for byte,
the link definition with the name rendered "Yingying" where the archive wrote "Sakura"
(the original's link text carries her name,
so the declared name rule applies);
the archive-only `## Description` heading and bare "References" line kept as the archive has them;
front matter equal to the archive;
the contributors line with its two links unchanged;
no Han outside comments,
no refusal.
The closing wish ships in the second person as the original has it
("May you still have the same cheerfulness"),
where the archive had the third.
The semantic wrap puts each footnote marker on its own line after its sentence,
which renders inline;
recorded as a shape,
not a defect.

## yingying1 launches, 2026-09-17, 18:23 UTC

Frozen `479bb011f` (classes forty-one to fifty-one),
pid 3820813,
runs `~/temp/agent/yingying1`,
log `~/temp/agent/yingying1.log`,
Bedrock and OpenRouter wet,
Synthetic and Hyper dry at launch,
no cron job,
the background waiter alone reports the exit.
The entry is 17 source lines against 22 archive lines:
two footnote definitions,
one of them a bare URL,
the other a link whose text the archive renders with the name as "Sakura";
the archive adds a `## Description` heading and a bare "References" line the original does not carry;
the front matter is translated,
so it ships as the archive has it.
Read first the two definitions on the page
(class twenty-one's orphan-definition guard and class forty-six's bare-URL scan both touch them),
the archive-only heading and the "References" line,
the front matter,
the name in the farewell link,
then the seven steps and the three checks.

## shi_Yumiaoya5 read, 2026-09-17, 18:28 UTC: SETTLED, the death paragraphs on the page

Frozen `479bb011f`,
40 minutes
(`ms=2406596`),
`status=SETTLED` on the first attempt,
`translateStatus=complete`,
`pageSilent=0`,
`attempts.json` reads 1,
318 page lines against the archive's 55.
Spend by the meters:
Bedrock 177.87 to 177.53,
OpenRouter 253.95 to 253.52,
0.77 USD;
`pass-spend.mjs` logs 969 seats and 45 retry rounds.
Classes fifty and fifty-one live:
`insertion-coverage (slice 13, verdict absent, full 0, partial 0, absent 4, heard 6 of 6)`,
the two dark seats out of the denominator,
the passage admitted by the shortfall and both paragraphs on the page
(the intervention,
the bullying,
the rooftop).
Class forty-nine held again:
the opening section with its film link
(rendered "movie",
the original's own word),
one `[^1]` definition at the foot.
The farewell ships as the archive has it,
English only,
the film line and the attribution once;
no Chinese line this time,
so the slate's choice between the two shapes is a coin the judges toss.
Four body links,
the commented-out profile link on nobody's page,
front matter equal to the archive.
Three quality notes,
none deterministic,
recorded for the judge-preference list:
the page renders 中山一酒店 as "the Zhongshan No. 1 Hotel",
where the 一 reads either way on the page and only world knowledge settles it
(hotels are not named No. 1 outside academic practice materials;
the owner,
2026-09-17),
so this is a world-knowledge miss rather than a grammar miss:
gemma-4-26b's candidate,
chosen on the translate slate and again on the consolidation slate with ballots praising its "specificity"
and one judge calling it "a translation of the address marker" without penalty,
while three other candidates had it right;
the opening line keeps 小药娘 in Han
(the archive translator's own comment says to leave it untranslated,
and the footnote defines it),
while the death paragraph renders the same term "yao-niang [transfeminine person on HRT]",
so one page carries two renderings;
and the absolute naturalness review on the last slice closed `quorum-not-met` at 3 of 5 usable
with `quorumOver=8` counting Qwen3.8-27B and glm-5.3,
both refused by the router the whole run,
the class-fifty shape in another stage,
harmless here since the review carried no findings.

## shi_Yumiaoya5 launches on classes fifty and fifty-one, 2026-09-17, 17:38 UTC

Frozen `479bb011f` (classes forty-one to fifty-one),
pid 3740123,
runs `~/temp/agent/shi_Yumiaoya5`,
log `~/temp/agent/shi_Yumiaoya5.log`,
Bedrock and OpenRouter wet,
Synthetic and Hyper dry at launch.
Read first slice 13's coverage line
(the death paragraphs;
`coverage=absent` and an admission,
or a split carrying a misattributed count),
the two paragraphs on the page,
then the opening section with its film link,
one `[^1]` definition,
the farewell,
then the seven steps and the three checks.
The owner asked for no cron job on this pass;
the background waiter alone reports the exit.

## Classes fifty and fifty-one, 2026-09-17, 17:35 UTC: dark seats in the coverage denominator, and a partial claim pointing at another slice's rendering

Both found by the shi_Yumiaoya4 read.

Class fifty.
Slice 13's coverage round asked eight seats
(six in the first window,
two more when the round re-asked its pending voices),
the router refused glm-5.3 and Qwen3.8-27B for want of a wet provider,
six voices were heard,
four found the passage nowhere,
and the majority was still taken over eight,
so four of eight was a split.
The gather has tracked the seats the router refused since class twenty-six
(`unreachable`),
and the owner's decision of 2026-09-09 sizes a deciding bench by its reachable seats;
the coverage stage now takes its majority over the seats asked that a provider could serve
(`coverage-stage.ts`),
so a dark seat withholds no vote.
Fixed in `479bb011f`
(guard red first at `6f7567f7e`).

Class fifty-one.
The one anchored partial claim on that round was gpt-oss quoting "girl's last tour ended",
the archive's farewell line,
as partial coverage of the death paragraphs because it "states that Yumiao's life came to an end";
the pairing had assigned that line to the original's own farewell slice.
The verdict file's own header recorded this gap in 2026-08
("two of six voices claimed coverage and quoted a real sentence belonging to a different passage").
The admission now hands the coverage stage every target region the pairing assigned to some source slice
(`foreignRegions`,
all of them foreign to a source-only candidate),
and a partial claim whose quote overlaps one is dropped as misattributed,
neither coverage nor a vote for absence
(`coverage-foreign-region.ts`,
`judgeCoverage`'s `misattributed` count and `misattributedQuotes`);
a full claim there is kept,
since an archive that merged two originals into one paragraph carries the second inside the first's region,
and that is what a full claim there reports.
Fixed in `479bb011f`
(guard red first at `6f7567f7e`).
With both,
shi_Yumiaoya4's round reads four absent of six reachable,
an absent verdict,
and the shortfall corroboration admits the passage.

## shi_Yumiaoya4 read, 2026-09-17, 17:30 UTC: SETTLED, but the death paragraphs shipped as a recorded gap

Frozen `cd789763c`,
52 minutes
(`ms=3105288`),
`status=SETTLED` on the first attempt,
`attempts.json` reads 1,
page written,
294 lines against the archive's 55.
Spend by the meters:
Bedrock 178.17 to 177.87,
OpenRouter 254.44 to 253.95,
0.79 USD;
`pass-spend.mjs` logs 899 seats and 51 retry rounds.
Class forty-nine held:
no `defines footnote` refusal,
no `assembly-footnote-reverted` line,
the opening section on the page with its film link
(rendered as the film's title read off the Wikipedia URL,
where the original writes "movie name"),
the marker on the opening line and one `[^1]` definition at the foot.
The farewell ships once in English with the Chinese quote line kept above it and the attribution once,
the corpus's own shape for a quoted original beside its English
(hakureico's lyrics,
shihai4h's Camus),
and the archive's rendering,
which dropped the Chinese line,
lost the slate to GLM-5.3-Flash's
(Mercury and gpt-oss voted for Mercury's candidate,
which left the closing prose in Chinese);
the doubled quote of the earlier passes is gone.
Four body links on the page,
the commented-out profile link on nobody's page,
the community-term footnote at the foot with a parenthetical gloss added on the opening line.
The page's one Han line outside comments is that quote line.
But slice 13,
the two paragraphs on the suicide intervention and Yumiao's death,
is not on the page:
`insertion-coverage (slice 13, verdict split, full 0, partial 1, absent 4, heard 6 of 8)`,
`source-passage-unfilled (slice 13, not-corroborated)`,
both lanes `gap-remains`,
on a SETTLED page.
Classes fifty and fifty-one.
Two dark seats the whole run
(glm-5.3 and Qwen3.8-27B refused by the router),
Synthetic dry throughout.

## shi_Yumiaoya4 launches on class forty-nine, 2026-09-17, 16:30 UTC

Frozen `cd789763c` (classes forty-one to forty-nine),
pid 3610388,
runs `~/temp/agent/shi_Yumiaoya4`,
log `~/temp/agent/shi_Yumiaoya4.log`,
Bedrock and OpenRouter wet,
Synthetic and Hyper dry at launch.
Read first the opening section on the page with its film link,
one `[^1]` definition on the page and no `assembly-footnote-reverted` line in the translate log,
any `defines footnote` refusal in the slate findings
(class forty-nine's first live measurement),
then slice 13 on the page,
the farewell quote
(the slate has chosen the doubled rendering on every pass so far),
then the seven steps and the three checks.
