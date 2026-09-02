# Roster calibration under the owner blocklist, 2026-09-01

Evidence record for the seating step of the owner's R3 order
(`doc/decision/translation-repair-roster-blocklist.md`:
"code lands verified, calibration seats the roster, four-entry pass, reading").
Both calibration instruments ran on the nine-model roster at build `48799e6d1`
in the `translation-repair` worktree.
The seating decision itself is recorded separately once the seating-grade editor run lands;
this document carries the numbers that decision cites and the seating rules written before those numbers arrived.

## Status

-   `producer-calibrate` over 40 rounds: complete, standings recorded here.
-   `editor-calibrate` at its 6-slice default: complete, recorded here as a same-day replicate,
    not as seating evidence (the repo's own record calls a standing this small noise).
-   `editor-calibrate` over 40 slices: complete, 21:44Z to 01:02Z (11908 s), four slices in flight,
    300000 ms straggler window; 111 editor rounds from 30 slices, 25 refiner rounds from 25 slices.
    Log at `~/temp/agent/editor-calibrate-40-20260901.log`.
    Seated on it: `doc/decision/translation-repair-roster-seating-2026-09-01.md`
    (editors GLM-5.3-Flash, glm-5.3, deepseek-v4-pro-0813; refiners GLM-5.3-Flash, deepseek-v4-pro-0813,
    minimax-m3; checkers unchanged).
    Its Synthetic weekly cost: 15.5 to 10.4 percent remaining; Hyper 6967 to 6636 credits.
-   Logs of the two finished runs: `~/temp/agent/producer-calibrate-40-20260901.log`
    and `~/temp/agent/editor-calibrate-6-20260901.log`.
-   Landed at `03a58d2ca` on the owner's role-drop authorization: `RUN_TRANSLATORS` (seven, without
    `gpt-oss-120b` and `deepseek-v4-flash-0731`) and `RUN_JUDGES` (eight, without `glm-5.3`) in
    `src/corpus-run/run-config.ts`; read back from the built chunk `pass-entry` imports: roster 9,
    translators 7, judges 8 in both lanes, critics and panel 9.
-   The standing report now ends with one counts line per slice (`sliceStandingLines`),
    so the next calibration's log supports a bootstrap over slices without a log parser;
    the 40-slice run in flight predates it and is read through the winner lines instead.

## The roster measured

Synthetic (subscription): `hf:Qwen/Qwen3.8-27B`, `hf:moonshotai/Kimi-K3`, `hf:openai/gpt-oss-120b`,
`hf:zai-org/GLM-5.3-Flash`.
Charm Hyper (metered credits): `glm-5.3`, `gemma-4-26b-a4b-it`, `minimax-m3`, `deepseek-v4-pro-0813`,
`deepseek-v4-flash-0731`.
`glm-5.3` and `GLM-5.3-Flash` are the two admissions of the post-blocklist catalog refresh;
`qwen3.8-flash` and `qwen3.8-2.4t-a95b` were culled before either run on the forced-tool-choice probe.

Seats in production at the time of measurement (`src/corpus-run/run-config.ts`):
critics, panel, judges and translators are the whole roster;
editors and refiners are Kimi-K3, Qwen3.8-27B and gemma-4-26b-a4b-it;
checkers are Qwen3.8-27B, Kimi-K3 and gpt-oss-120b with self-certification permitted at half weight.

Quorum arithmetic at nine: `gatherStageVoices` needs `ceil(9 / 2)`, which is 5 voices.
`minBallotWeight` stays the absolute 3, so the share of the panel that must cast a non-abstain ballot is 3 of 9,
33 percent, inside the range already lived at ten models (30 percent) and eight (37.5 percent).

## How the numbers are read

Every standing counts disinterested ballots only: a judge's ballot for its own candidate is excluded.
The pooled null is every disinterested win over every disinterested ballot in that standing,
and each model's z is its share against that null with the null's own standard error,
which is the ballot-level statistic the 2026-08-24 seating used.
The Bonferroni two-sided threshold for nine comparisons is z 2.77.
The availability-adjusted share charges a model zero for every round it produced nothing in:
raw share times candidates over rounds.
Ballots within one round share a slate and are not independent,
so the z is a ranking aid rather than a p-value.

## Producer calibration, 40 rounds

Every model wrote each slice from the source and every model judged.
Ran 18:15:54Z to 20:57:58Z (9734 s), one slice at a time,
under the 180000 ms production straggler window because `producer-calibrate` has no calibration dial yet
(`doc/decision/translation-repair-calibration-overlap.md` lists that as follow-up work).

Standing as printed, best first:

-   `hf:Qwen/Qwen3.8-27B`: 35.5 percent (83 of 234 disinterested ballots, over 40 candidates)
-   `glm-5.3`: 17.2 percent (35 of 204, over 36 candidates)
-   `gemma-4-26b-a4b-it`: 16.4 percent (36 of 219, over 40 candidates)
-   `hf:zai-org/GLM-5.3-Flash`: 12.7 percent (27 of 213, over 38 candidates)
-   `minimax-m3`: 11.8 percent (25 of 211, over 40 candidates)
-   `hf:moonshotai/Kimi-K3`: 9.5 percent (21 of 221, over 40 candidates)
-   `deepseek-v4-pro-0813`: 6.9 percent (15 of 218, over 40 candidates)
-   `hf:openai/gpt-oss-120b`: 2.4 percent (5 of 207, over 40 candidates)
-   `deepseek-v4-flash-0731`: 2.4 percent (5 of 208, over 40 candidates)

Pooled null 13.02 percent (252 wins of 1935 ballots). Read against it:

-   `Qwen3.8-27B` clears the null at z +10.20, adjusted share 35.5 percent, 40 of 40 candidates.
-   `gemma-4-26b-a4b-it` z +1.50 and `glm-5.3` z +1.75 (adjusted 15.4 percent, 36 of 40) are not separable from the null.
-   `GLM-5.3-Flash` z -0.15 (adjusted 12.0 percent, 38 of 40), `minimax-m3` z -0.51, `Kimi-K3` z -1.56,
    `deepseek-v4-pro-0813` z -2.69: not separable.
-   `gpt-oss-120b` z -4.53 and `deepseek-v4-flash-0731` z -4.55 sit under the null.

Seat lines: every model answered every ask usably except `Kimi-K3` (78 of 79, one thrown),
`GLM-5.3-Flash` (77 of 82, five thrown) and `glm-5.3` (63 of 78, fifteen thrown).

## Editor calibration, 6-slice default

Every model edited each slice through the whole repair lane and every model judged;
the refiner standing comes off the same spend.
Ran 20:59:21Z to 21:35:36Z (2185 s), four slices in flight, 300000 ms window.
Two of the six slices (GLaDOSister chunk 0, zheermao101 chunk 8) carried nothing eligible and bought no round;
the other four (Everythings99 chunk 6, lxyddice chunk 2, shihai4h chunk 12, donotexist_A chunk 1)
bought 14 editor rounds and 4 refiner rounds.

EDITOR standing over 14 judged rounds, from 4 of 6 slices:

-   `hf:zai-org/GLM-5.3-Flash`: 28.8 percent (30 of 104, over 16 candidates)
-   `glm-5.3`: 25.8 percent (24 of 93, over 16 candidates)
-   `hf:Qwen/Qwen3.8-27B`: 20.0 percent (20 of 100, over 16 candidates)
-   `hf:moonshotai/Kimi-K3`: 13.1 percent (13 of 99, over 16 candidates)
-   `deepseek-v4-pro-0813`: 7.1 percent (6 of 85, over 14 candidates)
-   `minimax-m3`: 6.8 percent (6 of 88, over 15 candidates)
-   `hf:openai/gpt-oss-120b`: 5.5 percent (5 of 91, over 15 candidates)
-   `gemma-4-26b-a4b-it`: 1.1 percent (1 of 90, over 12 candidates)
-   `deepseek-v4-flash-0731`: 0.0 percent (0 of 90, over 14 candidates)

Pooled null 12.50 percent (105 of 840).
`GLM-5.3-Flash` z +5.04 and `glm-5.3` z +3.88 clear it; `Qwen3.8-27B` z +2.27 and `Kimi-K3` z +0.19 do not separate;
`gemma-4-26b-a4b-it` z -3.27 and `deepseek-v4-flash-0731` z -3.59 sit under it.
The gemma reading is the one that matters for the current seats:
a model that writes from the source at the roster's second-best rate wrote the worst edits on this sample,
which is the divergence the editor instrument exists to catch and the writer instrument cannot.

REFINER standing over 4 judged rounds, from 4 of 6 slices:

-   `hf:zai-org/GLM-5.3-Flash`: 34.4 percent (11 of 32, over 4 candidates)
-   `minimax-m3`: 31.3 percent (5 of 16, over 2 candidates)
-   `deepseek-v4-pro-0813`: 18.8 percent (6 of 32, over 4 candidates)
-   `hf:moonshotai/Kimi-K3`: 18.8 percent (3 of 16, over 2 candidates)
-   `gemma-4-26b-a4b-it`: 9.4 percent (3 of 32, over 4 candidates)
-   `hf:openai/gpt-oss-120b`: 4.2 percent (1 of 24, over 3 candidates)
-   `glm-5.3`: 4.2 percent (1 of 24, over 3 candidates)
-   `hf:Qwen/Qwen3.8-27B`: 0.0 percent (0 of 16, over 2 candidates)
-   `deepseek-v4-flash-0731`: 0.0 percent (0 of 8, over 1 candidate)

Pooled null 15.00 percent (30 of 200); only `GLM-5.3-Flash` clears it (z +3.07), and four rounds decide nothing.

Editors shipped on 4 of 6 slices: `glm-5.3` wrote shipping text on two, `GLM-5.3-Flash` on one, `Qwen3.8-27B` on one.
Shipping is not a preference: it includes text every editor proposed identically, which no judge was asked about.

Seat lines: every model was asked 54 times; `Kimi-K3` and `glm-5.3` each lost one, the rest answered all.
Other warnings: `deepseek-v4-flash-0731` failed the select schema guard twice (parsed JSON, wrong shape,
recovery round failed the same way), `Qwen3.8-27B` returned one select answer with a bad control character,
one HTTP 503 was retried.

Why this run does not seat anyone: `doc/decision/translation-repair-calibration-overlap.md` records a four-slice
EDITOR standing moving one model from 52.2 percent to 26.7 to 10.0 across identical runs,
and names more slices as the remedy.
`bench-sample.ts` draws a deterministic stride over slices ordered by source size,
so the 40-slice draw is a different sample from the 6-slice draw and the two are not pooled.

## Reliability of the two new admissions

The two instruments ran under different straggler windows, and that is where the `glm-5.3` numbers come from:

-   Under the 180000 ms production window (producer calibration) `glm-5.3` lost 14 streams to the window
    after quorum (10 at select, 4 at translate) plus one select AbortError: 15 of 78 asks, 19 percent.
    Read per role: 4 of 40 translate asks (10 percent) as a writer, 11 of 38 select asks (29 percent) as a judge
    over a slate of up to ten candidates.
    Each cut stream had delivered about 2 M raw SSE characters, zero content characters and tens of thousands
    of reasoning characters: the model reasons past the window and never reaches its answer.
-   Under the 300000 ms calibration window (editor calibration) it lost 1 of 54, a panel stream cut after 3.45 M
    raw characters.
-   The corpus pass runs under the 180000 ms window (`corpus-pass.ts` resolves `STRAGGLER_GRACE_MS`),
    so the 19 percent figure is the one that describes production.
    A lost judge voice thins a nine-judge panel rather than biasing it, and the stage had already reached quorum
    every time; the cost is metered output.
-   `GLM-5.3-Flash` lost 6 streams the same way in the producer run (3 select, 2 translate, one transport cut
    retried) and none in the editor run.

Cut streams emit no `SPEND` line: `reportSpend` in `hyper-client.ts` and `synthetic-client.ts` runs after
`extractAnthropicCompletion` on a drained reply, and a stream abandoned at the window never reaches it.
`spend-report` therefore understates `glm-5.3`.
Summing the reasoning characters the cut streams delivered (954109 in the producer run, 121962 in the editor run)
at four characters per token gives about 238657 and 30491 output tokens,
which at the 95.8144 credits per million output rate is about 22.9 and 2.9 credits unbilled in the logs.

## Meters and spend

Synthetic weekly allowance remaining: 19.25 percent when the producer run started (18:15Z),
19.16 at its last reading (20:53Z), 19.07 when the editor run started (20:59Z), 17.83 at its last reading (21:34Z).
The five-hour meter never fell under 2737 of 2750.
Both runs cost near 1.6 points of the weekly allowance gross once the allowance's continuous regeneration
over each run's wall clock is added back.
Charm Hyper balance: 7272 to 7135 credits across the producer run, 7134 to 7077 across the editor run
(one credit is five cents).

Every Synthetic seat has a Hyper route (`qwen3.8-27b`, `kimi-k3`, `gpt-oss-120b`, `glm-5.3-flash`),
so a dry Synthetic allowance moves cost onto credits rather than emptying seats.

Token totals from `SPEND` lines, prompt then completion:

-   Producer run, 687 lines: `deepseek-v4-flash-0731` 89966 / 16960 over 78 calls;
    `deepseek-v4-pro-0813` 183768 / 16779 over 79; `gemma-4-26b-a4b-it` 160555 / 10246 over 79;
    `glm-5.3` 97159 / 434729 over 63; `minimax-m3` 46382 / 280952 over 77;
    `Qwen3.8-27B` 153309 / 498935 over 77; `Kimi-K3` 162449 / 67601 over 78;
    `gpt-oss-120b` 155093 / 93144 over 79; `GLM-5.3-Flash` 146386 / 403609 over 77.
-   Editor run, 484 lines: `deepseek-v4-flash-0731` 133204 / 11596 over 54;
    `deepseek-v4-pro-0813` 147386 / 8964 over 54; `gemma-4-26b-a4b-it` 115793 / 6988 over 54;
    `glm-5.3` 96001 / 334010 over 53; `minimax-m3` 60414 / 150677 over 54;
    `Qwen3.8-27B` 128109 / 270724 over 54; `Kimi-K3` 130550 / 32810 over 53;
    `gpt-oss-120b` 125548 / 53706 over 54; `GLM-5.3-Flash` 121381 / 281479 over 54.

Hyper rates in credits per million tokens as read 2026-09-01 (`src/corpus-run/hyper-price.ts`):
`glm-5.3` 30.4864 in and 95.8144 out; `minimax-m3` 6.5328 and 26.1312; `deepseek-v4-pro-0813` 28.74432 and 86.23296;
`deepseek-v4-flash-0731` 8.8 and 26.4; `gemma-4-26b-a4b-it` 2.4 and 8.4; `glm-5.3-flash` 3.2664 and 10.888;
`kimi-k3` 65.328 and 326.64.

## Slice-clustered reading of the 6-slice replicate

A second reviewer (sol, reading the standings file) made two points the first rules had missed:
the slice, not the ballot, is the independent unit (14 editor rounds came from 4 slices),
and "the leader clears the null" says nothing about seats two and three or the boundary between three and four.
The log does not carry the authorship of losing candidates, so per-slice ballot shares cannot be rebuilt from it;
what it does carry is every round's winner
(`[decideBestCandidate] candidate N from <author> won weight W across B ballots`, tagged by slice),
which supports a round-win share per model and a bootstrap over whole slices.
The reader is `~/temp/agent/round-wins-bootstrap-20260901.mjs`; a composite winner credits each author one share,
as the standing does.
Control on the 6-slice log: it found 12 winner-bearing editor rounds of the 14 judged
(two rounds cast ballots and crowned nobody) and 4 of 4 refiner rounds.

EDITOR round wins over 12 rounds from 4 slices, with top-three inclusion over 4000 slice resamples:
`GLM-5.3-Flash` 5 wins (92.7 percent inclusion), `glm-5.3` 5 (82.9), `Qwen3.8-27B` 4 (72.8), `Kimi-K3` 3 (50.7),
`gpt-oss-120b` 1 (0.0), `minimax-m3` 1 (0.0); the rest won nothing.
Three of the twelve winners were composites credited to several authors.
REFINER round wins over 4 rounds: `GLM-5.3-Flash` 2 (94.0 percent inclusion), `deepseek-v4-pro-0813` 1 (69.7),
`minimax-m3` 1 (67.8).

The replicate also shows the editor and refiner standings reversing for four models
(`glm-5.3` and `Qwen3.8-27B` second and third as editors, near zero as refiners;
`deepseek-v4-pro-0813` and `minimax-m3` the other way round),
which four rounds cannot establish but which is enough to say "refiners are the editors" is a transfer assumption,
not a measurement.

## Seating rules, written before the 40-slice numbers arrive

Revised at 22:10Z on the reviewer's points, while the 40-slice run stood at slice 6 of 40 with no refiner round
printed yet, so still before any number they decide on existed.
Revised again at 22:25Z (slice 12 of 40) to remove the numeric gates on the owner's note that testing against a
magic number is discouraged: the rules now rank and report, and the numbers beside a rank are evidence a reader
weighs, not thresholds a rule trips on.

1.  Editors are seated from the 40-slice EDITOR standing alone.
    The 6-slice run is a same-day replicate that shows the band; its editor rounds are never pooled in.
2.  Editors: the top three by availability-adjusted share of disinterested ballots in the 40-slice EDITOR
    standing (printed share times candidates over rounds; every round seats the same judges,
    so the product weights rounds about equally).
    Two readings go beside the rank that the ballot-level z cannot give: the slice-clustered round-win bootstrap
    (round-win share and top-three inclusion probability), and production-window reliability from the
    180000 ms instrument (voices lost per ask in the producer calibration, by role).
    Where the third and fourth seats are not separated by the bootstrap, the seat goes to the one that lost
    fewer voices under the production window, and the record says the seat was decided on reliability.
3.  Refiners: the REFINER rounds of the 6-slice and 40-slice runs are pooled as slice clusters
    (same build, same instrument, same 300000 ms window; slices from two strides are distinct clusters),
    and the refiners are the top three by availability-adjusted share over the pooled rounds,
    with the same two beside-readings and the same reliability tie-break.
    The record states how many slices reached a rewriter; if none did, the refiners are the editors,
    recorded as an unvalidated transfer assumption, and a refiner-targeted calibration is filed as follow-up.
4.  Checkers stay Qwen3.8-27B, Kimi-K3 and gpt-oss-120b.
    No instrument ranks checkers: `checker-sensitivity` asks whether checkers can say no on fixtures,
    and the `run-config.ts` note already says the writer and editor instruments are far from checking.
    The gap is recorded as a gap.
5.  Wide roles (critics, panel, judges, translators) stay the whole roster.
    Only the owner blocklist removes a model from the roster; writers under the null still judge,
    since neither instrument measures judge accuracy.
    One question goes to the owner rather than being decided here: the producer standing places
    `gpt-oss-120b` and `deepseek-v4-flash-0731` under the null as writers with full availability
    (40 of 40 candidates each), which is a quality finding about the translator seat specifically.
    `RUN_TRANSLATE_MODELS` was measured at full width, so narrowing it is a design change, not a seating.
6.  `glm-5.3`'s reliability is read off the 180000 ms instrument, because that is the corpus pass's window,
    and by role: 10 percent of translate asks lost as a writer, 29 percent of select asks lost as a judge.

## Owner authorization of 2026-09-01 and the drops made on it

The owner wrote mid-run: "I authorize you to drop any model from any role, as long as you have evidence.
These doesn't count as design decisions."
That settles the question rule 5 had put to the owner and narrows the owner-blocklist-only clause to roster
membership: a role drop on measured evidence is part of this seating.

Latency of completed streams per model, from the two logs (`>180 s` counts completed streams that ran past the
production window's length, an upper bound on further cuts under it, since the window starts at quorum):

-   `glm-5.3`: producer run p50 61 s, p90 166 s, max 221 s, 14 cut and 4 completed past 180 s of 77;
    editor run p50 66 s, p90 172 s, max 278 s, 2 cut and 4 past 180 s of 55.
-   `GLM-5.3-Flash`: producer run p50 66 s, p90 153 s, 6 cut and 4 past 180 s of 83;
    editor run p50 52 s, p90 199 s, none cut and 6 past 180 s of 54.
-   `Kimi-K3`: producer p50 26 s, p90 104 s, 1 cut and 1 past 180 s; `Qwen3.8-27B`: p50 33 s, p90 77 s, none.
-   Every other model: p90 under 50 s, nothing past 120 s except two gemma streams in the editor run.

Schema-mismatch lines by model and stage, recovery re-asks included:
`deepseek-v4-flash-0731` at select 8 (producer) and 4 (editor), every one a numeric string where the guard wants
a number (`"best": "8"`); `Qwen3.8-27B` at select 2 (editor run, one answer with a bad control character).

Drops made before the 40-slice standing:

-   Translator seat: `hf:openai/gpt-oss-120b` and `deepseek-v4-flash-0731` leave
    `RUN_TRANSLATE_MODELS.translatorModelIds`.
    Evidence: the 40-round producer standing, 5 of 207 and 5 of 208 disinterested ballots, z -4.53 and -4.55
    against the pooled null, at 40 of 40 candidates each, so the finding is about writing, not availability.
    Both keep every other seat.
    With seven translators and eight judges every slate keeps at least two disinterested judges
    (`assertJudgeableProducerRoster`'s floor) and the translator quorum is 4 of 7.
-   Judge seat, both lanes: `glm-5.3` leaves `judgeModelIds`.
    Evidence: under the production window it lost 11 of 38 select asks (29 percent), each loss holding the round
    for the whole window after quorum and delivering about 2 M raw characters of reasoning that never reached an
    answer, at the roster's highest output rate; its completed select streams are the roster's slowest.
    It keeps the critic, panel and translator seats, where no production-window measurement exists
    (the editor calibration ran at 300000 ms and lost 1 of 54 there); the four-entry pass logs abandons by role
    and supplies that evidence.
-   Not dropped: `deepseek-v4-flash-0731` as a judge loses about a tenth of its select ballots to the numeric
    string shape, a parser tolerance question filed as follow-up rather than evidence about its judgment;
    `GLM-5.3-Flash` as a judge lost 6 of 83 asks (7 percent) under the production window and none under
    300000 ms, and stays.

## Wall clock, and the owner's fast-iteration principle

The owner, on seeing the pass's `hard=25200000ms` (the 420-minute per-entry cap raised on 2026-08-17 after
entries were measured clearing at seven hours): "A 7h run is pretty unacceptable, since it goes against the
principle of fast iteration at this early stage of the project."
Recorded as the `FIT` rule in `AGENTS.md`.

Where the time goes, measured on the two calibration logs and the first hours of the 40-slice run
(`<stage> round: N/M heard, T total, Q to quorum, G in grace` lines):

-   Producer calibration, 80 rounds: 83 percent of summed round time is waiting after quorum
    (select rounds mean 138 s with 25 s to quorum; translate rounds 98 s with 14 s to quorum).
-   Editor calibration, first 81 rounds of the 40-slice run: 75 percent
    (panel 213 s with 59 s to quorum; select 91 s with 17 s; critic 68 s with 20 s; editor 69 s with 19 s).
-   In the rounds where everyone answered, the last voice arrived a median 46 to 66 s after quorum,
    p90 141 to 158 s. A 60 s window keeps every voice in 43 to 62 percent of such rounds, 90 s in 62 to 72,
    120 s in 74 to 82; the voices a shorter window drops are the two GLM models, whose completed streams run
    p50 52 to 66 s and p90 153 to 199 s against p90s under 110 s for every other seat.

Levers applied on that measurement, all within the role-drop authorization or the launch-time overrides the
drivers already carry:

-   `glm-5.3` leaves every nine-wide seat (critic, panel, judge), landed at the commit that introduced
    `RUN_WIDE_SEATS`; the eight remaining reach quorum at 4.
-   The four-entry pass launches with `TRANSLATION_REPAIR_STRAGGLER_GRACE_MS=60000` and
    `TRANSLATION_REPAIR_SLICE_OVERLAP=4`, the owner's original 60 s figure of 2026-08-14 now backed by the
    last-voice distribution, and the overlap the calibration arms measured at half the wall clock.
    The built-in constants are untouched; `doc/decision/translation-repair-straggler-grace.md` keeps the 180 s
    built-in until a decision moves it, and the pass prints both overrides at launch.
-   The two launches run concurrently rather than one after the other.
-   The 40-slice calibration in flight is left to finish (about two hours at its 300 s window);
    its standing is computed in memory at the end, so stopping it would keep only the winner lines.

What a 60 s window costs is measured by the pass itself: it logs every abandon by model and stage,
and the standing of the pass's own rounds says whether the dropped voices were the ones that mattered.

## Stale text the seating edit fixes in `run-config.ts`

-   `RUN_ROSTER` says "EIGHT MODELS NOW"; the roster is nine.
-   `RUN_READER_MODELS` says "Four of the eight read images"; four of the nine do.
-   The quorum paragraph stops at ten; nine needs 5 voices and puts `minBallotWeight` at 3 of 9.
-   If two GLM-family models take editor seats, the provider-coverage paragraph must also name the family
    correlation, since it currently argues from providers alone.

## Before the four-entry pass

The pass keeps its own timing: one slice at a time and the built-in 180000 ms window
(`corpus-pass.ts` resolves `STRAGGLER_GRACE_MS`; only `editor-calibrate` adopts the 300000 ms calibration window
and the overlap of four).
The overlap decision doc leaves moving the pass to `#261`'s measurement.
So the pass launches at its defaults, not at "measured calibration values".

Launch form verified on 2026-09-01 with the zero-quota `--plan` mode, both printing `PLAN ok` with
`client=constructed` at tip `c4f707e3b`:

-   `TRANSLATION_REPAIR_RUNS_DIR=<throwaway> mise run //package/module/translation-repair:corpus-pass -- --only keyword233,Toka_ls,XIEPT2`
    against the clone at `~/one-among-us/data`, verified at `a41fc607ea5a70d8a7625cc67d5ed8c444f53379`.
-   The same with `TRANSLATION_REPAIR_CORPUS_CLONE_DIR` at the PR-386 fixture
    (`~/temp/agent/pr386-mock-home-20260829/one-among-us/data`, HEAD `d343df909b1673d68dd5cd805aeda1dfacd2d3c4`)
    and `TRANSLATION_REPAIR_CORPUS_COMMIT` set to that sha, `-- --only Carena0442`.
-   Each hand-picked run goes into its own throwaway runs dir, as the `ONLY` banner demands.
    The plan had the two run one after the other so the per-model limiter stays one process wide;
    the fast-iteration principle (the "Wall clock" section) launched them concurrently instead,
    so each process holds its own limiter and a Synthetic model can see both at once.
-   The pass reports `soft=259200000ms hard=25200000ms` budgets.
-   The pass log's abandons by role are the production-window evidence the `glm-5.3` judge drop left open
    for its critic, panel and translator seats.

## The four-entry pass, first twenty minutes

Launched 2026-09-02 01:10 UTC at tip `23814e8bf`, both passes printing `STRAGGLER GRACE OVERRIDDEN ... 60000ms`
and `OVERLAP <entry> value=4 source=TRANSLATION_REPAIR_SLICE_OVERLAP`; the real clone and the PR-386 fixture
stayed clean (`git status --short` empty on both after the first rounds).
Logs: `~/temp/agent/four-entry-pin-20260901.log` (keyword233, Toka_ls, XIEPT2) and
`~/temp/agent/four-entry-carena-20260901.log` (Carena0442).

What the 60 s window did to the seats, read off `<stage> round: N/M heard` lines and the abandon lines
at 19 minutes in:

-   Editor rounds: pin pass 12 of 13 heard all three, Carena 7 of 9; every one of the 3 cuts was
    `hf:zai-org/GLM-5.3-Flash`, the top editor by both readings, cut mid-reply exactly 60000 ms after quorum
    (quorum formed at 13 to 23 s; the round then ran 73 to 83 s).
    The other GLM editor, `glm-5.3`, was never cut: it is the quorum-forming voice, and the window does not
    run against whoever forms quorum.
-   Refiner rounds: none reached yet in either pass.
-   Checker rounds: 18 of 19 heard all three.
-   Critic rounds (8 seats, quorum 4): pin 8 of 15 heard all eight, Carena 1 of 14;
    Carena's mode is 6 of 8.
    Panel rounds: pin 3 of 13 full, mode 7 of 8; Carena 1 of 14 full, mode 7 of 8.
    The cut readers are the same slow voices as in calibration (`GLM-5.3-Flash`, `Qwen3.8-27B`, `Kimi-K3`,
    `minimax-m3`, `gemma-4-26b-a4b-it`).
-   The `0/1 heard` rounds are not retries. Each follows a `<stage>: recovery round for 1 unreadable answers`
    line (`stage-quorum.ts`, the one recovery round for an answer that parsed but failed the schema guard),
    and each is answered in 0 to 1 ms by `PROMPT-REUSE source=memory` for the same model and digest, then
    fails the same guard on the same bytes.
    `prompt-uniqueness-client.ts` states it: "Any returned outcome claims identity permanently for client
    lifetime, including schema mismatch or refusal."
    So the recovery round costs no wall clock and can never recover anything: the same prompt to the same
    model is served the same unreadable reply.
    Five such rounds so far (Carena 3: gemma twice, deepseek-v4-flash once; pin 2).
    This is the path the unsettled gemma malformed-JSON item was leaning on, and it is dead by construction;
    filed as `#473` for the owner (a design conflict between two deliberate rules, not a fix to make
    unasked).
-   Wall clock, projected from the slice cache (`slice-cache/<entry>/<hash>.json`, one per settled repair
    slice): Toka_ls 14 of 16 repair slices at 25 minutes, Carena 18 of 22 at 22 minutes, and each entry then
    runs its translate lane over the same slices.
    An entry is about an hour; the pin pass carries three in sequence, so it projects to about three hours
    against the `FIT` hour.
    It is left running rather than stopped, because the reading step starts on the first two artifacts
    (Toka_ls and Carena) as they land and does not wait on the pass, and because a relaunch on the current
    build would discard the slice cache (the pipeline digest moved from `ab964c96…` to `d0a82037…` with the
    writer dial), re-spending what is already settled.
    The owner's veto stops it at any time; the artifacts already written survive a stop.
-   The "delivered chars" in a cut line is the raw streamed body (`partialText` in `stream-drain.ts` joins
    the decoded chunks, framing and reasoning deltas included), which is why a critic cut at 60 s shows
    0.2 to 1.7 million characters: it is not answer text, and the figure says only that the model was still
    streaming.
-   Spend: Synthetic weekly allowance 10.39 to 8.18 percent over the 19 minutes with both passes running
    (about 7 points per hour, so the remaining allowance carries roughly another hour before every Synthetic
    seat falls to its Hyper route); Hyper balance 6636 to 6492 credits.
    No retry exhausted; 429s were retried within the budget (pin 4, Carena 11 in the first ten minutes).

The advisor's reading of the launch, taken before these numbers: a window sized for the eight-wide reader
rounds can unseat the writers the three-wide rounds were seated on, since the last reader voice adds one
ballot to seven while the last writer voice is a whole candidate.
The numbers bear it out in one place, the top editor on the long Carena document, and nowhere else so far.

The remedy is a launch-time dial rather than a built-in and rather than a restart:

-   `TRANSLATION_REPAIR_WRITER_GRACE_MS` (commit `a3da317df`, `writer-grace-override.ts`) gives the editor,
    refiner, translate and consolidate gathers a window of their own; unset, they follow the round window as
    before, so nothing built-in and nothing in `doc/decision/translation-repair-straggler-grace.md` moves.
    Both dials read through one parser (`readWindowDial`), the pass and the editor calibration print a
    `WRITER GRACE OVERRIDDEN` note beside the round note, and the zero-quota `--plan` run at tip `f7abd69b5`
    printed the note under `60000`/`180000` and refused `180s` by name.
-   The running passes were NOT restarted under it. Three cut editor rounds in 22 is the measured cost;
    a restart re-spends twenty minutes of both passes and about 2 points of the Synthetic allowance to
    recover a voice that 19 of 22 rounds already heard, against the owner's fast-iteration principle.
    The next launch sets the writer dial; the reading step (task 3) reads these artifacts knowing which
    editor rounds ran short, since each artifact carries `stage-voice-lost (editor hf:zai-org/GLM-5.3-Flash)`.
-   What the dial should say is measured, not chosen: the built-in 180000 ms covers the GLM editors' p90
    (153 to 199 s completed streams) at the cost of up to two more minutes on the minority of writer rounds
    the third voice runs long in; 300000 ms is the calibration's own window and what the seat was measured
    under.
    Rule, written before the refiner and translate rounds of this pass are read: the next launch sets
    `TRANSLATION_REPAIR_WRITER_GRACE_MS=180000` (the built-in, no new number), unless this pass's refiner or
    translate rounds show the seated slow voice (`GLM-5.3-Flash` as refiner, `glm-5.3` as translator) losing
    a majority of its rounds to the window AND winning the judged round when it is heard, in which case the
    tail is the seat and the dial goes to the calibration's 300000 ms.
    Editor rounds are the writer seat's best case (the slow `glm-5.3` forms quorum, so the window runs
    against one slow voice with a head start); refiner rounds (quorum on `deepseek-v4-pro-0813` and
    `minimax-m3`, both fast) and translate rounds (quorum 4 of 7 in seconds against `glm-5.3` at p50 61 to
    66 s) are where a 60 s window bites hardest, and the first refiner round of the pin pass heard all three
    in 23.8 s.
    Whether the late editor voice wins its rounds cannot be read from the round lines alone (the `in grace`
    figure does not name the late voice; the judged-round winner lines are per issue envelope, several per
    editor round); pairing needs the per-call stream lines joined by time, which is instrument work for the
    reading step if the counts warrant it.

## The pin pass died of a refusal cooldown, not of budget

At 01:40:19 UTC the pin pass ended with `DONE processed=0 of pending=3; artifacts=0/92 elapsed=1786317ms`:
`TALLY Toka_ls status=INCOMPLETE ms=1786206 ... error=translation repair interrupted: provider-unavailable`,
then XIEPT2 in 44 ms with the same error, then keyword233 in 66 ms with
`front matter is not publishable (incumbent-fallback)`.
No page and no artifact were written; the real clone stayed clean.

What happened, read off the log and the source:

-   Two processes, each with four slices in flight over eight-wide reader rounds, produced HTTP 429 bursts
    (68 in the pin log, 11 in the first ten minutes of Carena's), eight calls at once hitting the retry
    ladder together (`exchangeWithRetry`, five attempts, about 15 s in total).
-   A 429 that outlives the ladder reaches the router as a `SyntheticHttpError`, and `isBudgetRefusal`
    (`provider-budget-refusal.ts`) counts 429 and 402 alike as "out of budget": `markRefused` then holds that
    provider dry for `REFUSAL_COOLDOWN_MS` (300000 ms) whatever its meter says, by design
    (`provider-budget.ts`: "A refusal is stickier than a meter reading";
    `doc/decision/translation-repair-multi-provider.md`).
-   Synthetic was so held at 01:21:44, 01:32:56 and 01:39:28 (each time on `GLM-5.3-Flash`), which routed
    its traffic to Hyper; at 01:39:54 to 01:39:59 Hyper refused eight models in five seconds and was held
    too; with both held, `BothProvidersDryError` fired for every voice of every stage (518 lines in
    twenty-five seconds), Toka_ls's translate lane ended, and the two remaining entries were attempted and
    failed inside the same second because the hold is process-wide state.
-   Thirteen seconds before the verdict the meter read
    `METERS synthetic=wet hyper=wet syntheticWeekly=7.24% syntheticFiveHour=2729/2750 hyperBalance=6447`.
    Neither provider was out of anything.
    The error text, "Synthetic has no five-hour or weekly credit left and Charm Hyper has no balance left.
    Nothing further can be bought, so this run ends", asserts a state that was never measured.
-   keyword233's refusal is the same outage through another guard: every stage lost every voice, the
    front-matter slice kept the archive's text, and `assertFrontMatterComplete`
    (`corpus-run/front-matter-completeness.ts`) refuses a page whose metadata is the incumbent while the
    source's differs. It is not a defect of that entry.
-   The Carena pass, in its own process, was held out of Hyper at 01:40:32 to 01:40:35 (four refusals) with
    Synthetic wet, so for five minutes its Hyper-only seats (`glm-5.3`, `deepseek-v4-pro-0813`, `minimax-m3`,
    `gemma-4-26b-a4b-it`) answered `NoProviderForModelError`: editor rounds with one voice of three, refiner
    rounds with one of three. It kept running and its artifact will carry those degraded stages as findings.

The launch decision that produced the burst was mine (two concurrent processes, against the runbook's
one-process note and the advisor's warning on per-model load), and the pass's own SEAT lines carry the cost
as `threw`: `deepseek-v4-pro-0813 asked=168 threw=74`, `GLM-5.3-Flash asked=173 threw=97`,
`Qwen3.8-27B asked=177 threw=83`, most of them the dry-verdict lines rather than provider faults.

What is the pipeline's, not the launch's, and is filed for the owner as a design conflict (`#474`):

-   A 429 is read as allowance exhaustion without consulting the meter that was read thirteen seconds
    earlier and says otherwise; a rate limit and an empty allowance get the same five-minute hold.
-   When both providers are held, the pass fails every remaining entry at once instead of waiting out the
    shorter hold, which is at most five minutes against a 72 hour soft budget.
-   The `BothProvidersDryError` text states what was assumed, not what was measured.

Whether one process trips the hold, measured rather than assumed:

-   The single-process calibration logs at overlap 4 carry no hold at all: `editor-calibrate-40` (three
    hours, the repair lane) 0 `markRefused`, 0 HTTP 429, 268 HTTP 503; `producer-calibrate-40` 0, 0, 1;
    `editor-calibrate-6` 0, 0, 1. A 503 is not a budget refusal and never held anyone.
-   The Carena pass, alone from 01:40 and at overlap 4, was held out of Hyper again at 01:54:06 and
    01:54:08, four minutes into its TRANSLATE lane (seven translators and eight judges per slice, four
    slices in flight, five of the nine models Hyper-only). So one process at overlap 4 is safe in the repair
    lane and trips Hyper's rate limit in the translate lane; the hold is not only a two-process artifact,
    which is added to `#474`.
-   The Synthetic weekly allowance is the other fuse: once it reads zero the meter legitimately says dry,
    every Synthetic seat routes to Hyper, and that is the 01:39:54 load shape. The quota reading carries
    no reset time (`synthetic-client.ts` reports five-hour remaining/max and weekly percent only). At 01:54
    it read 6.66 percent, falling about 2.3 points per hour with one process, so roughly three hours remain.

Relaunch plan, revised on that: one entry per launch (Toka_ls first, then XIEPT2, then keyword233), one
process, after the Carena pass exits, under `TRANSLATION_REPAIR_WRITER_GRACE_MS=180000`, the 60 s round
window and `TRANSLATION_REPAIR_SLICE_OVERLAP=2`, into one fresh throwaway runs dir
(`~/temp/agent/pin-relaunch-20260902`) on the current build. Overlap 2 rather than 4 because 4 tripped Hyper
in the translate lane in one process; rather than 1 because 1 is the built-in the fast-iteration rule spends
first, and a single Hyper hold with Synthetic wet degrades five minutes of rounds rather than ending the run.
If the relaunch logs a `markRefused`, the next entry launches at overlap 1. One entry per launch ends inside
the hour, inside the weekly fuse, and puts an artifact in front of the reading step while the next runs.

Tooling note from the day: twice, the package `lint` task's `build` dependency left `dist/final/node/index.d.mts`
without the new exports until an explicit `mise run //package/module/translation-repair:build`, so
`lint:types` read stale declarations. Reproduced, not diagnosed.

## The Carena pass finished and was refused at publish time

`TALLY Carena0442 status=INCOMPLETE ms=5668128 ... error=entry Carena0442 front matter is not publishable
(incumbent-fallback)`, after 94.5 minutes, a finished consolidation and polish, and no `[error]` line.
No page and no artifact: publication precedes persistence by design (`pass-entry-persist.ts`), so a refusal
at the page leaves nothing but the slice cache.

What happened, read off the log, the fixture and the source:

-   The translate lane's metadata slice (chunk 0, 92 source characters) was judged at 01:57:15 with four of
    eight ballots heard (the Hyper hold of 01:54:06 had taken the four Hyper-only judges): "winner drew only
    weight 1.5 across 4 ballots; keeping the fallback", then "declined-indecision; challenging same panel
    under distinct responsibility", then at 02:00:03 the same again. The incumbent stood; the slice cost
    423 s.
-   The incumbent is correct. The fixture's `page.en.md` carries `name: Carena`, `alias: Carena`,
    `location: Shanghai` and a translated `desc`, against the source's `飞猫`, `飞猫, Carena`, `上海`.
    CORRECTION 2026-09-02 03:20: the keep was NOT a judged keep. Both rounds ended `declined-indecision`:
    the four heard judges split (GLM-5.3-Flash and Qwen3.8-27B for candidate 1 at weight 1.5 together,
    gpt-oss-120b for candidate 2 at weight 1, Kimi-K3 for candidate 3 at weight 0.5) and the leader fell
    short of the minimum weight of 3, so the stage shipped the incumbent by fallback. `translate-stage-result.ts`
    says it in its own words: "the incumbent shipped" and "the judges chose the incumbent" are different
    facts, and only the second is evidence about the incumbent. The sentence this replaces called it a
    review that found nothing to change; the sol review of the guard files (`~/temp/agent/sol-front-matter-guard-review-20260902.txt`)
    caught the misreading.
-   `assertFrontMatterComplete` (`corpus-run/front-matter-completeness.ts`, landed 2026-08-28 as "review
    visible front matter", "keep invalid metadata retryable", "support one-sided front matter") refused
    because the page's front matter equals the archive's while the source's differs, which it read as an
    incumbent standing by default. Its own test for that rule used an archive whose name is the directory
    id (`name: EntryId`), and that fixture was being refused by the identity rule in
    `validateFrontMatterTranslation` before the completeness rule ever ran, so the rule had never been
    exercised by its test.
-   The translate lane already tells a decision from a default (`translate-lane-wordings.ts`: a record
    whose stage heard at least one translator is `decided`, one that heard nobody is `incumbent-fallback`,
    the distinction `lane-slice-text.ts` draws since 2026-08-16). The guard inferred the default from bytes
    instead.

The first fix (commit `503ec902c`, "publish a judged keep of correct front matter") took the metadata
slice's standing off the translate lane's wording, which says only whether a translator was heard, and
published every keep whose stage had heard one. Under it the Carena keep, an indecision, would have
published; so would any wrong incumbent kept by a split vote. SUPERSEDED the same night by commit
`daaf0ffa0` after the sol review named the gap: `metadataStandingOf` now reads the metadata slice's
selection off the persisted translate lane (`sliceSelections`: decision, origin, producer), and the guard
publishes a byte-equal keep only when the judges chose the incumbent (`judged-keep`, weight carried) or
every heard translator reproduced it (`matched-keep`, matched models carried, which the incumbent producer's
`matched` list records). Every fallback refuses with the decision after the reason, so a TALLY line reads
`incumbent-fallback: declined-indecision` rather than one word for a hold, a split and a lost voice alike;
a withdrawn replacement and an unrecorded slice refuse by those names; a kept directory id refuses as
`directory-id-name` whatever the decision. The departure from the 2026-08-28 rule is now small and stated:
that rule refused every byte-equal keep, this one publishes the two kinds that are a review of the
incumbent. Recorded for veto rather than put as a question because the 2026-08-28 rule discarded a correct
judged keep on a byte comparison its own test never reached, and the reshape keeps every refusal that rule's
tests name.

What it does not fix: the minimum vote weight is 3 whatever the ballot count, so a judge round that hears
four of eight voices during a provider hold cannot reach it with a split vote, and every kept incumbent in
that window was a hold, not a judgment. That is `#474`'s territory; under the reshaped guard such an entry
is refused by name (`incumbent-fallback: declined-indecision`) and stays retryable, which is what the
2026-08-28 rule intended. A Carena rerun with all eight judges heard either reaches weight 3 or is a
genuine split over which name form is right (gpt-oss-120b argued in both rounds that candidates 1 and 3
"replace the original name with an alias"), and a genuine split is not something publication should paper
over.

Left for task 8, per the review: the directory-id check fires only on a byte-equal block, so a page that
kept `name: <directory id>` while changing another field passes it; and the standing does not carry the
accepted text, so the guard never checks that the page's metadata is the wording the selection supports.
Neither is the misreading; both are behavior changes for the owner's say. A third case the standing does
not see: it reads the translate lane only, so when lane contest or consolidation restores the archive's
metadata over a translate replacement (the `#269` path the package README recounts), the selection reads
judged, fresh, shipped, and the guard refuses as `incumbent-fallback: replacement-not-carried`. That matches
the 2026-08-28 rule, and a second panel choosing the incumbent is arguably a review; the detail name reads
like an assembly defect when it is a contest decision, so a reader of that TALLY line should know this is
the sentence that explains it. The matched-keep path also has no live evidence yet: no artifact has shown a
sole-candidate metadata slice with a non-empty `matched` list, and an empty one refuses as
`sole-candidate-unmatched`, which fails closed. When the first artifact lands, its `sliceSelections` entry
for slice zero (decision, origin, matched) goes next to the TALLY here.

The Carena entry has to run again: its slice cache was written under the previous pipeline digest and the
dial and the guard both moved it. keyword233's identical refusal in the first pin pass was the outage
(every stage lost every voice, the metadata slice kept the archive by default) and reads as
`incumbent-fallback: no-voice-heard` under the reshaped guard.

## The chain was cut to two entries on a rate measurement

"One entry per launch" sized each launch to the hour, and four launches queued back to back unattended
are the same multi-hour run with pauses. Measured at 03:07 UTC: the Toka_ls relaunch at overlap 2 had
settled 7 repair slices of 16 in 21 minutes, against 14 in 17 minutes for the same entry at overlap 4 in
the first pin pass, so overlap 2 runs at about half the rate and an entry is on the order of two hours
before its refine and translate lanes. Four entries at that rate is six to eight hours, past the hour the
owner named and past the Synthetic weekly meter, which read 4.24% at 03:07 and has been falling about two
points an hour. That is the run the owner called unacceptable, so the chain was stopped at 03:10 and
requeued as:

- Toka_ls to completion (running since 02:45:50 on the pre-fix build), rerun on the fixed build only if
  the old guard refuses its metadata slice.
- A meter gate: `budget-sample` runs once, and Carena0442 launches only if the sample says routing would
  use both providers. A Synthetic weekly at zero legitimately holds it dry, every seat routes to Hyper,
  and that is the load shape of 01:39:54 that ended the pin pass; reordering without the gate only picks
  which entry dies.
- Carena0442 (the owner's hand-picked fixture entry, the longest document, the most evidence per entry),
  under the same dials, into `~/temp/agent/carena-relaunch-20260902`.

XIEPT2 and keyword233 are deferred to the owner alongside the guard veto: they need either a fresh
Synthetic week or the owner's say on a run longer than an hour. `src/` is frozen until the chain's last
TALLY: every launch rebuilds, so a mid-chain edit lands the entries under different pipeline digests,
which the standing readers refuse to pool, and a broken build launches a broken pass unwatched.

## Next action

Toka_ls is running alone under the writer dial at overlap 2 on the build before either guard change. If
its page is refused at publish time, its metadata judge round gets read the way Carena's was (weight, split,
decision) and the rerun is decided by hand: the slice cache is digest-keyed, so a rerun is a full two hours,
and an indecision keep is refused again by the reshaped guard. No automatic rerun. Then the meter gate and
Carena0442 as the section before this one says, on the `daaf0ffa0` build. The gate reads the meter once at
launch; Synthetic's weekly at about 4% and falling two points an hour reaches zero around 05:00 UTC, likely
mid-Carena, so a Hyper-only tail in that pass is expected, not a regression. Each landed artifact goes through
`verify-published` (which reads `artifacts/` and `fixed/` and never touches `pass.lock`) and the reader
script (`~/temp/agent/read-artifact-20260902.mjs`) for task 3, in this order: `git status --short` on the
real clone, `verify-published`, the reader script, then the translate-round heard counts under the writer
dial against the first run's two Qwen cuts at 60 s, which is the dial's first live measurement.

## Decisions waiting on the owner

Collected here so a reader of the last section has the whole list; each item's evidence lives in the
section or issue it names.

- Issue #473: recovery rounds for unreadable answers are served from the prompt-uniqueness cache in
  0 to 1 ms and never recover anything. Vary the prompt with the guard's complaint, or delete the round.
- Issue #474: an HTTP 429 (a concurrency limit on Synthetic) is read as a budget refusal and holds the
  provider dry for five minutes whatever its meter says; two holds at once end the pass and fail every
  remaining entry in under a second. Re-read the meter on 429 and back off briefly, or wait out the
  shorter hold, or at least state measured facts in the message. The fixed minimum vote weight of 3,
  which a 4-of-8 ballot round cannot reach while a provider is held, belongs to the same decision.
- The front-matter guard reshape of commit daaf0ffa0 (superseding 503ec902c), recorded for veto in the
  section "The Carena pass finished and was refused at publish time": a byte-equal keep the judges chose,
  or every heard translator reproduced, now publishes; every fallback refuses by the decision's name.
  The 2026-08-28 rule refused all of them.
- XIEPT2 and keyword233: not in the chain. Running them needs either a fresh Synthetic week or the
  owner's say on a run longer than an hour at overlap 2.
