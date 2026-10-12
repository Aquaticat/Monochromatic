# Translation repair: OpenRouter as the paid fallback provider, part 10

Part 10 of [Translation repair: OpenRouter as the paid fallback provider](translation-repair-openrouter-2026-09-03.md),
whose index lists every part in order.

## The owner asks where 200 USD went, and six levers land, 2026-09-09, 16:50 UTC

The owner,
after the payment refusal of 12:22 UTC:
"What the hell is going on,
I just topped up 200USD to openrouter yesterday and today it's already dry?
We're being token inefficient at an unsustainable level."
Then,
after a question that should not have been asked:
"Of course we need to do everything in our power to NOT bleed.
Of course we need to always fix and relaunch.
I have topped up OpenRouter one final time.
Mercury 2.5 is out and approved."
Then "No,
there are obviously more token efficiency fixes",
and "Do not ignore the fact that if you make whatever sent to Hyper/Synthetic more efficient,
Hyper/Synthetic would last longer and therefore fewer requests would need to fallback to openrouter in the first place."

### Where the 200 USD went

Between the top-up of 2026-09-08 11:27 UTC (200.01 on the meter) and the refusal of 2026-09-09 12:22 UTC (1.51),
the meter moved 199.92 USD.
The `SPEND` lines of every pass log in that window sum to 141.62.
The rest,
58.30,
was never logged:
streams the rounds abandoned 120 s after quorum,
2,135 of them since the top-up,
1,088 of them Qwen3.8-27B (3.0 GB of raw stream) in select,
critic,
panel and lane-contest seats,
served by CoreWeave,
Parasail and Phala,
which OpenRouter's streaming page lists neither among the providers that stop billing on a cancelled stream nor among
those that do not,
while Alibaba and MiniMax are listed as billing the whole response.
Reckoned at each model's raw characters per completion token (Qwen 377,
deepseek-v4-pro 386,
glm-5.3 103,
the others near 135),
the abandoned streams come to about 58 USD (Qwen about 24,
glm-5.3 about 18,
prompts about 5),
which closes the gap.
Two more findings from the same logs:
69.70 USD of the logged spend went to 17 passes killed before their page was read,
and `deepseek-v4-pro-0813` cost 1.87 times its listing price
(Parasail 1.85 and CoreWeave 2.11 over 3,894 calls;
55.14 USD paid against 29.56 at listing),
`deepseek-v4-flash-0731` 1.43 and `glm-5.3-flash` 1.52,
because the default load balancing spread calls over endpoints priced at twice the cheapest.

### The six levers, in commit order

1. `037d1f650`:
   every OpenRouter call carries `max_tokens` at a measured ceiling
   (the 99th percentile of `completion_tokens` over that model's completed OpenRouter calls since the top-up),
   and Qwen3.8-27B and glm-5.3 leave the OpenRouter catalog
   (24 percent of Qwen's calls there were abandoned and billed to the end;
   glm-5.3 was the second bleeder and Hyper serves both).
2. `4f87555fc`:
   every abandoned OpenRouter stream writes a `SPEND ... estimated=abandoned` line reckoned from the characters
   delivered before the cut,
   so the meter and the log can be reconciled without a second reckoning.
3. `1fe7ca2fe`:
   `provider.sort: 'price'` on every OpenRouter request
   (the routing page says sorting disables load balancing and picks the cheapest;
   zero data retention,
   `require_parameters` and the ignore list still apply),
   and the `SPEND` line carries `cached=N` off `usage.prompt_tokens_details.cached_tokens`,
   since DeepSeek's prompt caching is automatic and reads at a tenth of the input price.
   The third `noname` pass shows the routing at work:
   `deepseek-v4-pro-0813` on NextBit,
   `deepseek-v4-flash-0731` on DeepInfra,
   and `cached=512` on the second minimax call of the pass.
4. `b71a55385`,
   the fan-out window:
   every `gatherStageVoices` round asks quorum plus one seat,
   from a bench rotated deterministically by the prompt,
   and the rest only when a voice is lost;
   quorum is unchanged.
   On the first `noname` pass 1,430 seats were asked across 229 rounds where quorum needed about 810,
   and every surplus seat waited out a grace window and,
   on the per-token provider,
   was generated and billed to the end.
   Three consequences were decided with it:
   a fixture scripting every seat asks for the whole bench through a `fanOut` knob on the select,
   critic,
   chunk-critic and coverage stages;
   the coverage verdict takes its majority over the seats the gather asked,
   since a seat the window spared was never silent;
   and a judge bench whose window could not carry a unanimous self-written slate on self-votes alone
   (four seats:
   three halves fall short of the minimum of 2) asks the whole bench,
   which is one seat more (`candidate-select-fanout.ts`).
5. `78ea8c8c7`,
   the cap on every provider:
   the table moves to `completion-cap.ts` keyed by roster id and every client sends it,
   Synthetic (a weekly token allowance),
   Bedrock (a credit never topped up),
   Hyper (under its own per-model ceiling) and OpenRouter.
   Measured over every `SPEND` line in the pass logs (142,437 completed calls across the four providers;
   `~/temp/agent/cap-measure-20260909.txt` holds the table):
   each cap is the highest 99th percentile any provider with at least 100 calls of the model recorded,
   floored at the pooled 90th (3,831),
   and every cap cuts under one percent of that model's completed calls
   (`minimax-m3` the most,
   274 of 34,018,
   whose Hyper replies ran to the 32,000 ceiling that provider already enforced).
   The caps:
   GLM-5.3-Flash 18,316;
   Qwen3.8-27B 20,894;
   Kimi-K3 10,921;
   gpt-oss-120b 3,831;
   minimax-m3 10,822;
   gemma-4-26b-a4b-it 3,831;
   deepseek-v4-pro 9,128;
   deepseek-v4-flash 16,543;
   glm-5.3 22,067;
   gemma-4-e2b 3,831;
   gemma-4-31b 8,194.
6. `33a023445`,
   the window for the six stages that read their own round
   (the lane contest,
   section and block pairing,
   the consolidation gate,
   the naturalness review and the polish gate;
   356 seats on the first `noname` pass for quorums of about half):
   `runWindowedRounds` asks quorum plus one seat,
   the rest only when a voice is lost,
   up to the same three retry rounds the other stages have and these never had,
   and returns one outcome per seat asked in roster order.
   The naturalness confirmation now challenges exactly the seats the discovery asked,
   at the discovery's quorum,
   since the artifact reads one requested roster across both readings and a challenge put to the reviewers who
   approved is what a confirmation is.
   A provider down for every seat now costs such a stage up to four rounds of the client's five transient attempts,
   as it already costs the other sixteen stages.

Not done,
and next:
Mercury 2.5 (`inception/mercury-2.5`,
0.04 and 0.15 USD per million,
one endpoint,
approved by the owner) as an OpenRouter-only roster id,
seated for judge seats by the fidelity probe and for writer seats by the producer calibration,
so the cheapest seat on the per-token provider carries the judging that today falls on deepseek-v4-pro at 9.128
thousand tokens of ceiling and 1.74 USD per million out.

### The third noname launch, 16:45 UTC

The queue resumed on `33a023445` with the meters reading synthetic wet at 2 percent of the week,
bedrock wet at 186.68 USD,
hyper dry,
openrouter wet at 273.99 USD remaining after the owner's final top-up.
The pass runs from a frozen copy of the built `dist`
(`package/module/translation-repair/node_modules/.frozen-dist-33a023445`,
which the scratch launcher takes as its third argument),
so a rebuild for the Mercury seating cannot change the pass under way;
the kill-and-relaunch rule still applies to the build the pass carries,
not to the files on disk.
What the pass is read for,
besides the `## 简介` heading above the first paragraph:
the seats each round asks against its bench (`retry round N asking X of Y pending voices` where a voice was lost),
the `cached=` counts on DeepSeek calls,
the endpoints the price sort picks,
and whether any `estimated=abandoned` line appears at all now that every stream is capped and windowed.

### Mercury 2.5 judges 14 of 14, 17:00 UTC

`judge-fidelity-probe --cap 48 --candidates inception/mercury-2.5 --candidates-alone` on `3224ff347`
over a throwaway runs dir holding the three settled artifacts on disk
(gqt,
hakureico,
noname):
three entries walked,
28 rows,
fourteen distinct questions
(six deletions,
six insertions,
two alterations;
`gqt/3` states no number the alteration fixture can move),
14 asks,
14 usable,
75 s of wall clock.
The roster verdict reads `declined` on every row,
as it must for one judge under the minimum weight of 2;
the per-judge tally (scratch `fidelity-tally.mjs`) is the reading:

- `inception/mercury-2.5`:
  14 of 14 chose the complete text.
  Deletion 6 of 6,
  insertion 6 of 6,
  alteration 2 of 2;
  no damaged pick,
  no decline;
  position two on 7 of 14.

By the rule written on 2026-09-07,
a candidate at the maximum meets both clauses whatever the seated median reads,
so it joined the judge seats at once (`fcc8ca197`):
critic,
panel and judge in both lanes,
the late bench and the slate.
The seated roster's reading of the same fourteen is bought beside it
(`judge-fidelity-probe --cap 48` over a second copy of the same artifacts,
detached,
pid 875777,
log `~/temp/agent/probe-seated-20260909.log`)
and recorded here when it lands,
for the record's sake rather than the decision's.
Its writing seats wait on
`producer-calibrate 40 --candidates inception/mercury-2.5`
(detached at 17:06 UTC,
pid 875801,
frozen build `3224ff347`,
log `~/temp/agent/producer-calibrate-mercury-20260909.log`,
about three hours by the 2026-09-08 precedent),
read by the scratch `read-standing.mjs` against the pooled null.

## The owner answers the three recorded questions, 2026-09-09, 17:25 UTC

Asked "What other things do you need to ask me?
Ask me now or decide they're not necessarily design decisions",
the three questions the handover recorded were put in one form
("The thin-bench questions" and "The glossary question"),
each with its options,
pros and cons and the ranking.
Everything else pending
(Mercury's writing seats,
its completion cap,
the prompt-volume lever,
the launch order)
is decided by measurement or already answered,
so nothing else was asked.
The answers:

- A deciding bench short of quorum:
  a share of the reachable weight,
  against the recommended stop INCOMPLETE.
  Rule and rejected options in `doc/decision/translation-repair-short-bench-share.md`:
  the minimum weight scales as `MIN_SELECTION_WEIGHT` times reachable over quorum,
  two ballots the floor,
  benches at quorum unchanged.
- An ineligible standing over a valid incumbent:
  keep the incumbent for the slice,
  as recommended.
  Addendum in `doc/decision/translation-repair-ineligible-standing.md`.
- The glossary:
  both the corpus glossary file and the archive's rendering as a candidate the judges must weigh.
  Rule in `doc/decision/translation-repair-community-glossary.md`:
  the glossary rides in the identity context,
  and a deterministic block on the judge sheets names each candidate lacking the community rendering.

Built in that order,
each guard shown to fail first:
`db5927630` (the share;
the gather names the seats the router refused,
the select minimum scales,
ballot counting moved to `candidate-select-count.ts`),
`1463cd359` (the incumbent;
the artifact's shipped kind `incumbent` was needed so the page writes the incumbent rather than the lane's
refused wording,
which a bare "unchanged" would have done),
`b7a0b4f5f` (the glossary;
the editor selections' task and criteria moved to `editor-selection-sheet.ts`).
The running third `noname` carries none of them (frozen `33a023445`);
the next launch carries all three.

The seated roster's reading of the same fourteen landed at 17:18 UTC
(pid 875777,
`judge-fidelity-probe --cap 48` over a second copy of the same three artifacts,
28 rows,
roster verdict clean on 20 and declined on 8,
record `~/temp/agent/probe-seated-20260909/judge-fidelity-probe/`),
with Synthetic at the bottom of its week and Hyper dry,
so `glm-5.3` was lost on every ask
(`OPENROUTER_DROPPED_SEATS` holds it since `037d1f650` and no other provider served it)
and the other seats declined often.
Complete-text picks over the distinct questions each judge answered:

- `hf:moonshotai/Kimi-K3` 8 of 8,
  no damaged pick.
- `google.gemma-4-e2b` 9 of 11,
  2 damaged picks.
- `deepseek-v4-pro-0813` 6 of 9.
- `hf:zai-org/GLM-5.3-Flash` 5 of 9.
- `hf:Qwen/Qwen3.8-27B` 4 of 10.
- `deepseek-v4-flash-0731` 4 of 10.
- `minimax-m3` 3 of 6,
  1 damaged pick.
- `hf:openai/gpt-oss-120b` 2 of 6.
- `gemma-4-26b-a4b-it` 1 of 6.
- `glm-5.3` no usable ask.

The seated median lies between 4 of 10 and 5 of 9;
the most damage-prone seated judge chose the damaged text twice.
Mercury's 14 of 14 with no damaged pick clears both clauses by measurement,
not only by the maximum argument.

## The third noname page is read and the Kimi-K3 leak closes, 2026-09-09, 18:40 UTC

THE PASS:
launched 16:45 UTC on frozen `33a023445`,
SETTLED at 18:08 UTC after 83 minutes,
13 slices,
`pageChanged=9`,
Synthetic wet at 2 percent of the week at launch and dry from 17:25 UTC inside the translate lane,
Hyper dry throughout,
Bedrock and OpenRouter wet.
Meters:
OpenRouter 273.99 to 271.68 USD,
Bedrock 186.68 to 186.49.

THE LEVERS,
measured with the scratch `pass-spend.mjs` beside the two earlier noname passes of the day:

- Seats asked 893 over 900 calls,
  21 retry rounds;
  the second noname asked 1,999 seats over 715 calls with 222 retry rounds,
  the first 1,322 over 1,355.
  Select rounds asked 318 seats over 66 rounds (4.8 a round;
  the first pass asked 7.1).
- Cached prompt tokens 602,368 across the OpenRouter DeepSeek and MiniMax calls (`cached=` on the SPEND line),
  none before the price routing.
- Abandoned streams 28 of 900,
  reckoned at 0.44 USD:
  23 of them DeepSeek-flash reasoning streams at 5,000 prompt and 7,500 to 14,500 completion tokens
  (0.05 USD in all,
  0.10 USD for every DeepSeek-flash call of the pass),
  two of them Kimi-K3 on OpenRouter at 0.28 and 0.08 USD.
- OpenRouter spend 1.87 USD against the second noname's 1.72 and the first's 5.04,
  but 1.14 of it is 22 Kimi-K3 calls the router sent to OpenRouter after Synthetic dried mid-phase,
  at 3 and 15 USD per million (Makora,
  Morph,
  DeepInfra,
  Together and Sail Research endpoints,
  the price sort finding nothing cheaper);
  the other 382 OpenRouter calls cost 0.73 USD.
  The seat reader withholds Kimi-K3 at phase start when OpenRouter would serve it (2026-09-03) and the
  router did not honour that mid-phase;
  closed in `19b6043a3` (the reach says OpenRouter does not serve a withheld model;
  addendum of `doc/decision/translation-repair-provider-aware-judge-seat.md`).
- `glm-5.3` asked 53 times and threw 53 (Hyper dry,
  dropped from OpenRouter since `037d1f650`):
  a dark seat every day Hyper's limit is spent,
  which the select minimum of `db5927630` now counts as unreachable rather than as a lost voice.
  Qwen3.8-27B threw 52 of 125 after Synthetic dried,
  for the same reason.

THE PAGE,
by the seven steps:
`verify-published` 1 of 1 at the length the artifact implies;
`DESTINATIONS noname source=3 page=3 dropped=0`;
front matter as the archive has it;
the fourth `PhotoScroll` path repaired (the archive wrote `'${path} /photos/kuan4.webp'` with a space);
the `## Introduction` heading above the first paragraph,
which the twenty-third class had dropped on the first two passes;
straight quotes 1 and curly 11 on page and archive alike,
ellipses 0 and three-dot 1 alike;
two em dashes where the archive has none,
one carrying the source's own `ーー` in the memorial tweet and one a comma,
inside the archive's convention (38 of the 92 archive pages use one).
The two passages the archive paraphrased read faithful on the page:
"They may not even have been transgender themselves" for
"ta 们或许甚至未必是跨性别本身",
and "Nine days later,
on March 18" where the archive added a year the source does not state.
Refusal vocabulary in the log:
three slices whose standing lacked contest endorsement and shipped with the finding (2,
3 and 12);
no `fails the deterministic`,
no `StandingIneligible`,
no `mdx-downgraded`.
Contest:
8 slices to the translate lane,
4 settled neither;
consolidation:
one slice consolidated (10),
the rest kept their standing.

## The thirteenth Mio launches on the torn-down tree, 2026-09-16, 01:58 UTC

Frozen `cbedea357`,
pass pid `1001520`,
runs `~/temp/agent/Mio13-20260916`,
log `~/temp/agent/Mio13-20260916.log`.
The tree is the 2026-09-09 handoff tip plus the pass-path work of 2026-09-10 to 2026-09-15,
less the provider-free layer removed the same hour (the teardown is recorded in the 2026-09-06 handover under
"Where the work stands").
Build,
oxlint,
types and the unit suite pass.
Meters at launch:
`synthetic=wet bedrock=wet hyper=wet openrouter=wet`,
Synthetic 76.3 percent of its week,
Hyper 171 credits,
Bedrock 185.38 USD,
OpenRouter 267.73 USD.
Seats:
roster 12 (V4.1 Flash judging for the first time in a full pass),
translators 8,
readers 6,
writers 11,
withheld none.
The page is read against Mio12's:
the poem's five breaks,
both chat translations,
the opening's 澪 versus Mio,
the coming-out bullet,
the university wording,
the SRS expansion.

### Mio13 read, 2026-09-16, 02:55 UTC: no page, class thirty-one

`Mio13` ended INCOMPLETE at 02:42:43 UTC after 2,627,941 ms:
`translation repair interrupted: provider-unavailable`,
thrown by the archive block review of the first chat translation with every provider wet.
No page was written,
so the seven steps and the three checks do not apply;
what is read is the log.

- Preparation paired 6 of 6 and 7 of 7,
  3 of 3 and 3 of 5,
  and 13 of 13 originals against 13 of 19 translation blocks across 14 relations.
  Mio12 had paired 12 of 13 originals in that third section,
  and its unpaired original absorbed the unpaired translations into a slice;
  with every original paired,
  the chat translations and the label,
  rule and note blocks around them are declined into the archive review,
  which is the class twenty-five path.
  Eight blocks went to review where Mio12 sent two.
  The preparation code is byte-identical after whitespace between the two tips;
  the difference is the roster's pairing.
- Pictures:
  10 of 10 gathered,
  photo6 corroborated at overlap 0.941,
  photo7 at 0.670,
  photo4 at 1.000.
- Archive review:
  six blocks settled in rounds of 7 of 7,
  5 of 7 plus 2 of 2,
  4 of 7 plus 3 of 3,
  6 of 7 plus a recovery,
  and 7 of 7,
  with cap-cut replies recovered or outvoted along the way.
  The seventh block,
  the first chat translation (prompt about 7,000 tokens,
  the block before it about 9,000),
  lost seven seats to their own reasoning:
  Qwen3.8-27B spent its whole cap of 20,894 completion tokens (76,861 reasoning characters,
  0 content characters),
  GLM-5.3-Flash 18,316,
  minimax-m3 10,822 (40,483 reasoning characters),
  deepseek-v4-flash-0731 16,543,
  deepseek-v4-pro-0813 9,128,
  glm-5.3 22,067 and deepseek-v4.1-flash 13,082,
  each ending `finish_reason=length` or `max_tokens` with no content.
  Mercury 2.5 answered `source-supported` with an empty `sourceQuote` twice and the schema guard refused it.
  Retry rounds 1 to 3 re-asked the cap-cut seats with the same prompt and the prompt cache answered in 1 ms
  with the same cut reply;
  the recovery round re-asked three with the complaint appended and heard none,
  deepseek-v4-pro being cut in its 120 s grace window.
  Heard:
  gemma-4-26b-a4b-it,
  google.gemma-4-e2b,
  google.gemma-4-31b and Kimi-K3 (8,497 completion tokens).
  Their findings on the block:
  a "musculine" typo,
  the parenthetical inverted (≠不想成为男性 means "this doesn't mean I don't want to be a man"),
  敏感 as "sensitive",
  WeChat casing,
  dialogue the source does not carry ("Do you have a moment right now?",
  "Hey~"),
  mis-attributed speakers,
  MTF against trans.
  The stage read "4/12" as an outage and threw.
- Spend:
  164 `SPEND` lines,
  `cost=` summing to 0.013 USD,
  meters at the end Synthetic 77.4 percent of its week,
  Hyper 100 credits (171 at launch),
  Bedrock 185.36 USD,
  OpenRouter 267.73 USD unchanged.
- Class thirty-one:
  a reply the completion cap cut before its content is an answer nobody could read,
  not silence,
  and the archive review's outage test counted it as silence.
  `19ad9d238` adds the guards (a four-seat bench where three answer cap-cut retains the block with the
  quorum finding;
  the gather names the seats whose answers stayed unreadable after the recovery round),
  both red on the unfixed dist;
  `db090b955` fixes it:
  `gatherStageVoices` returns `unreadable`,
  and `runArchiveBlockReviewStage` throws `provider-unavailable` only when heard plus unreadable is below
  the reachable quorum,
  otherwise warning `archive-block-review: N heard and M answered unreadably of B seats` and falling
  through to the no-loop retention with the quorum findings.
  The archive selection fixture's "unavailable" review now throws,
  as a transport that delivered nothing does,
  instead of returning a schema mismatch.
  Build,
  oxlint,
  types and the unit suite pass.
- Open,
  and not a defect class:
  seven of twelve seats cannot review that chat block within their measured caps.
  Under class thirty-one the block ships as the archive wrote it,
  with the four heard seats' findings recorded,
  unless the heard revisions win the independent selection.
  The levers are the owner's:
  the caps are measured,
  not chosen,
  and the picture support sends every corroborating reader's transcript.

## The fourteenth Mio launches on class thirty-one, 2026-09-16, 03:04 UTC

Frozen `db090b955`,
pass pid `1045264`,
runs `~/temp/agent/Mio14-20260916`,
log `~/temp/agent/Mio14-20260916.log`.
Meters at launch:
`synthetic=wet bedrock=wet hyper=wet openrouter=wet`,
Synthetic 77.3 percent of its week,
Hyper 89 credits,
Bedrock 185.36 USD,
OpenRouter 267.73 USD.
Seats as Mio13:
roster 12,
translators 8,
readers 6,
writers 11,
withheld none.
Read against Mio12 as Mio13 was to be,
plus the first chat block's review outcome under class thirty-one:
the `archive-block-review: N heard and M answered unreadably` warning if it fires,
whether the block is retained unresolved or revised through the selection,
and whether the selection's judges overrun their caps on the same block.

## Mio14 killed on the one-transcript landing, Mio15 launched, 2026-09-16, 04:06 UTC

Mio14 was killed at 04:05 UTC (pid 1045264) under the ALWAYS KILL AND RELAUNCH rule:
the one-transcript change landed in `36b79bfa0` while it ran,
and it had already reproduced the Mio13 overrun on the six-transcript support.
What its 61 minutes measured,
read off `~/temp/agent/Mio14-20260916.log`:

- 24 `finish_reason=` cap cuts against Mio13's 19,
  across a longer run;
  the class thirty-one warning fired once,
  `archive-block-review: 5 heard and 6 answered unreadably of 12 seats`,
  and the block went on to `archive review: comparing 3 admissible revisions in 4 candidates;
  3 eligible assessments from 5 heard reviews`,
  so the fix holds:
  the bench that answered unreadably no longer interrupts the entry.
- Hyper fell from 84 to 42 credits over 66 Hyper calls,
  about one credit per one and a half calls;
  the five Hyper seats returned 71,333 (v4.1-flash),
  105,059 (glm-5.3),
  109,738 (v4-flash),
  78,600 (v4-pro) and 69,374 (minimax) completion tokens,
  nearly all of it reasoning the cap cut before content.
  That drain is why the baseline was not run to its page:
  Hyper at 42 is what Mio15 and the queue have.
- Bedrock 0.019 USD summed over 46 `cost=` lines;
  Synthetic 77.32 to 76.47 percent of its week;
  OpenRouter unchanged at 267.73.
- No page was written;
  the lanes had not started.

Mio15 launched at 04:06 UTC on frozen `36b79bfa0`
(pid 1089368,
runs `~/temp/agent/Mio15-20260916`,
log `~/temp/agent/Mio15-20260916.log`).
Meters at launch:
all four wet,
Synthetic 76.5 percent,
Hyper 42 credits,
Bedrock 185.35 USD,
OpenRouter 267.73 USD.
Read against Mio12 as Mio13 and Mio14 were to be,
plus the one-transcript question:
whether the seven seats that overran on Mio13 answer the first chat translation within cap
(grep `archive-block-review`,
`answered unreadably` and `finish_reason`),
and the per-model completion tokens on Hyper against the Mio14 numbers.
If the overrun holds at Mio14's rate,
the lever is spent and the doubled re-ask cap goes back to the owner.

## Mio15 read, 2026-09-16, 06:46 UTC: no page, class thirty-two, and the one-transcript verdict

Mio15 (frozen `36b79bfa0`,
pid 1089368,
launched 04:06 UTC) stopped INCOMPLETE at 06:45:58 UTC after 160 minutes,
in the consolidation of slice 14:
`the standing text failed the deterministic publication rule and the consolidation left nothing valid to ship (gate-kept-standing)`.
No page was written.
Spend:
OpenRouter 0.74 USD over 625 calls (267.73 to 267.02),
Bedrock 0.09 USD over 278 calls,
Synthetic 76.44 to 73.68 percent of its week,
Hyper 40 to 0.

### The one-transcript verdict, against Mio14

Read off both logs at the same stage,
the archive block review:

- Mio14 (six transcripts) reviewed 6 blocks and spent 15 review cap cuts and 8 selection cap cuts;
  the class thirty-one warning fired once,
  `5 heard and 6 answered unreadably of 12 seats`.
- Mio15 (one transcript) reviewed 5 blocks and spent 12 review cap cuts and 3 selection cap cuts;
  the warning fired once,
  `5 heard and 7 answered unreadably of 12 seats`,
  on the last block reviewed,
  the first chat translation;
  the block was reviewed on the 5 heard and retained from the archive
  ("while prior reviews flagged it as unsupported by the provided source images,
  the current archive...").
- The four blocks before it cost 5 review cuts on Mio15,
  one per Hyper reasoning seat,
  against two to four cuts per seat on Mio14,
  and every one reached selection with 6 or 7 heard reviews.

So the lever lowers the bench's load on ordinary blocks and leaves the one block whose content drives the
reasoning seats past cap unchanged:
on that block v4.1-flash was cut four times across its re-asks,
v4-flash,
v4-pro,
glm-5.3 and minimax twice each,
and gemma-4-e2b failed the schema guard.
The lever is spent there;
the doubled re-ask cap is the open owner question.

### Hyper is billed per request

Hyper's balance fell 0.64 credits per call on both passes
(84 to 42 over 66 calls on Mio14,
40 to 12 over 44 calls on Mio15,
then to 0 during the review),
whatever the completion size.
Token efficiency does not save Hyper credits;
only fewer calls do.
With Hyper dry the lanes ran on Synthetic,
Bedrock and OpenRouter,
and OpenRouter carried the five reasoning seats under the caps for 0.74 USD.

### Class thirty-two: the page's substitute block leaves no room for the original's own kind

Slice 14 is the closing poem,
a block quote whose attribution line carries the bare URL
(`——[晓炊](https://space.bilibili.com/246513889)，为 Mio 创作，献给已逝去的所有跨性别同胞`).
The archive never translated the poem;
its page ends with a farewell paragraph of its own,
`May you rest in peace, Mio.`.
The roster's block pairing set the two against each other
(`paired 3 of 3 original and 3 of 5 translation blocks across 3 relations, from 6 usable voices of 6 heard`,
04:57 UTC),
though the pairing sheet says to leave a block with no counterpart out;
a checker then flagged the pair as "too brief",
and 2 of 6 critics voted non-translation,
one short of the floor of 3.
Mio12 had sliced the region differently,
so its page carries the farewell and then the poem as a block quote,
which is the page this entry wants.

From there every stage did what it was written to do and nothing could ship:

- The lane's contest winner kept the poem's block quote and dropped the farewell:
  `The PAGE AS IT STANDS is 1 block (paragraph) and your translation is 1 (blockquote)`.
- The consolidation's standing text was that quote,
  so it was withheld;
  the incumbent,
  the farewell alone,
  fails the link rule
  (`The ORIGINAL or the PAGE AS IT STANDS carries link-url https://space.bilibili.com/246513889 and your translation does not`),
  so only fresh proposals reached the slate.
- The slate chose v4-flash's paragraph with hard breaks
  (weight 3.5 of 6 ballots),
  which passes the rule;
  the semantic gate then preferred the standing
  (`consolidate gate: 6/7 usable, settled on standing, ships standing`),
  and a standing the rule refuses cannot ship,
  which is the owner's 2026-09-04 rule that an ineligible standing stops.

The defect is in the floor rule's ceiling.
`compareBlocks` in `translate-validate.ts` admits at most the larger of the page block count and the original block count,
so with one paragraph on the page and one block quote in the original a candidate may carry one block:
the page's paragraph or a paragraph rendering of the poem,
never the farewell followed by the quote.
The consolidation sheet asks for exactly that
("ADD A BLOCK ONLY to carry something the ORIGINAL has and the archive left out"),
and the rule made it unreachable.
The class-ten decision of 2026-09-07 covers a page with more blocks than the original;
it did not see a page with the same count in a kind the original lacks,
standing in for a block of a kind the page lacks.

The fix,
`8d058d102`
(red guard `9c06d6d63`):
the ceiling also admits the page's blocks plus every original block of a kind the page has no block of,
the finding names the allowance
("The ORIGINAL's blockquote has no block of its kind on the PAGE AS IT STANDS,
so carry the PAGE AS IT STANDS's blocks and add it after them in the ORIGINAL's own kind"),
and the lane sheet asks for that shape outright.
The pinned cases hold:
a page whose extra blocks are of a kind the original lacks
(the archive's quote saying a passage was left by someone) still refuses the original's shape,
Huasheng's stanzas still pass,
and the block-from-nowhere case is still refused,
since the widened ceiling counts only original blocks.
What it does not do is undo the pairing;
the wrong pair stands and the judges choose between the page-shaped and the both-kept renderings with both
texts in front of them.

## Mio16 launches on class thirty-two, 2026-09-16, 07:02 UTC

Frozen `8d058d102`,
pass pid `1135987`,
runs `~/temp/agent/Mio16-20260916`,
log `~/temp/agent/Mio16-20260916.log`.
Meters at launch:
Synthetic 73.7 percent,
Hyper 0 (dry),
Bedrock 185.25 USD,
OpenRouter 267.02 USD.
Read against Mio12 as before,
plus slice 14:
whether the lane or the consolidation ships the farewell followed by the poem's quote
(grep `slice 14` and `no block of its kind`),
and whether the pairing sets the poem against the farewell again.
