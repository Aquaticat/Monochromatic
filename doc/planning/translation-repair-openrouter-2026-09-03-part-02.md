# Translation repair: OpenRouter as the paid fallback provider, part 02

Part 02 of [Translation repair: OpenRouter as the paid fallback provider](translation-repair-openrouter-2026-09-03.md),
whose index lists every part in order.

## The third live pass, keyword233, 18:15 to 18:36 UTC, OpenRouter alone

Launched from the worktree at tip `f26c5fb60` with the Synthetic and Hyper keys unset,
which the run reads as both dry (`~/temp/agent/openrouter-live3-20260903.log`,
artifacts beside it):

- `METERS synthetic=dry hyper=dry openrouter=wet` throughout;
    `JUDGE SEATS` at every phase read `wide=6 select=6 late=7 slate=7 checkers=3 withheld=hf:moonshotai/Kimi-K3`,
    the all-dry bench with gemma as the substitute checker.
- `TALLY keyword233 status=SETTLED slices=3 ... ms=1247533`;
  lanes 621 seconds,
  lane contest 68,
  consolidation 548.
    `verify-published` answered 1 of 1 (`chars=805=expected missing=0`);
    the page reads as before.
- 0.7590 USD floor over 235 costed OpenRouter calls (two carried no cost),
  meter 55.89 before and 55.05 after.
    DeepSeek V4 Pro 0.19 USD,
    Qwen3.8-27B 0.18,
    Kimi-K3 0.17 from six calls,
    glm-5.3 0.10,
    gpt-oss-120b 0.04,
    MiniMax 0.04,
    GLM-5.3-Flash 0.02,
    DeepSeek Flash 0.01,
    gemma 0.01.
    No refusal,
    no 5xx retry line,
    no exhausted ladder.
- **The withhold reached only the judge benches.**
  Kimi-K3 wrote six translations on OpenRouter (Fireworks 3,
    Modal 3),
    a quarter of the pass's bill,
    while every bench had it out:
    `judgeSeatsFor` filtered the wide,
    late,
    select and checker seats by `seated` and left `translatorModelIds` as the static `RUN_TRANSLATORS`,
    and `pass-entry.ts` passed the catalog's `RUN_READER_MODELS` to the picture stage unfiltered.
    Fixed in `8848f070e`:
    `JudgeSeats` carries `translators` and `readers` filtered the same way,
    the translate lane takes its writers from there,
    and the picture stage reads its own seats (`JUDGE SEATS phase=pictures`,
    `pass-seated-pictures.ts`);
    the seat guards shown failing with the filters removed,
    restored and passing,
    and the entry driver test now counts four meter readings per entry.
    The fourth pass (19:33 UTC,
    launched on that fix) then bought Kimi-K3's first call from the block-pairing
    round six seconds before any bench was read:
    preparation,
    insertion admission and the consolidation writers all took the static `RUN_ROSTER`.
    `68ad11530` adds `roster` to `JudgeSeats`,
    the whole roster less any withheld model,
    read for `phase=preparation` before the pairing round,
    and the other two stages take their own reading's roster;
    guard shown failing with the filter removed,
    restored and passing.
    Not yet exercised live past the pairing round;
    the next OpenRouter-only pass must show no `SPEND provider=openrouter model=moonshotai/kimi-k3` line.
- **The Parasail ignore and the OpenInference ignore both held**:
  36 of 36 MiniMax calls to ModelRun,
  all completed,
    three schema-mismatches (two consolidation gates,
    one translate vote);
    no DeepSeek Flash stream on OpenInference.
- **Qwen3.8-27B served by OpenRouter conformed**:
  31 of 31 completed answers usable,
  all on Parasail,
    completed p50 18.3 s,
    p90 52.8 s,
    max 147 s,
    against p50 16.5 s,
    p90 48.8 s,
    max 228 s on Synthetic on the second pass.
    The endpoint is not the slow part;
    the model reasons long on either provider.
- **Every cut was a reasoning-only stream on Parasail ending at the 60 second straggler grace**,
  14 of them:
    Qwen 7 of 38 asks,
    DeepSeek Flash 6 of 27 (Parasail 17 of 23 completed,
    p50 16.4 s,
    p90 49.5 s;
    Makora 4 of 4 at 6.9 s),
    DeepSeek Pro 1 of 37 (Parasail 20 of 21 at 21.3 s;
    Sail Research 16 of 16 at 1.5 s).
    Cut at 67 to 188 seconds with no content character and 15k to 43k reasoning characters each,
    across critic,
    panel,
    select,
    lane-contest and consolidation-gate rounds.
    `run-timing-report`:
    47 rounds,
    28.7 of 34.7 round-minutes waiting after quorum (82.7 percent),
    19 voices never heard,
    against 43 rounds,
    62.3 percent and 12 on the second pass.
    The all-OpenRouter bench reaches quorum sooner (gpt-oss on Cerebras and Groq at 1 to 2 seconds,
    MiniMax at 2.6,
    gemma at 4 to 8) and the reasoning seats then have less absolute time before the grace ends.
    No ignore fits this:
    Parasail's completed latencies match Synthetic's for the same model,
    and Qwen has no other endpoint on this run.
    The lever is the grace,
    `TRANSLATION_REPAIR_STRAGGLER_GRACE_MS` (default 180 s in `stage-round.ts`,
    set to 60 s on every keyword233 pass of this day),
    and that is a speed-against-width tradeoff put to the owner.
- Other endpoints seen,
  for the record:
  gemma on DeepInfra 30 of 30 at 8.4 s (the ignore stays rejected),
    gpt-oss on Nebius 14 at 6.6 s,
    glm-5.3 on Modal 3 at 40.5 s against Together 15 at 5.2 s,
    GLM-5.3-Flash on Together 8 at 65.8 s and Makora 1 at 70 s against Venice 2 at 5.2 s and Reka 1 at 1.8 s.
    GLM-5.3-Flash's slow endpoints cut nothing (14 of 14 usable),
    so nothing is ignored on one pass's counts.

## The fourth live pass, keyword233, 19:33 to 19:55 UTC, OpenRouter alone at a 120 s grace

Launched from the worktree at tip `f4d59bf65` (the translator and reader withhold,
before the roster-wide one) with `TRANSLATION_REPAIR_STRAGGLER_GRACE_MS=120000`,
everything else as the third pass (`~/temp/agent/openrouter-live4-20260903.log`):

- `TALLY keyword233 status=SETTLED slices=3 ... ms=1321136`;
  `verify-published` 1 of 1 (`chars=773=expected missing=0`);
    no refusal,
    no 5xx retry,
    one schema-mismatch.
- Cut streams 7 (Qwen3.8-27B 6,
  gemma 1) against 14 at 60 s;
  `run-timing-report` 37 rounds,
    34.6 of 37.7 round-minutes waiting after quorum (91.7 percent),
    8 voices never heard against 19.
- 0.4502 USD;
  Kimi-K3 bought 3 calls (0.07 USD):
  one from the block-pairing round and two as consolidation writers,
    the roster-wide gap `68ad11530` closes.
    `JUDGE SEATS` read `translators=6 readers=3` at every phase.
- Put to the owner with the third pass's figures;
  **decided:
  120 s**,
  now the built-in (`doc/decision/translation-repair-straggler-grace.md`,
    "Decision 2026-09-03").
- Decided at the same asking:
  the recovery round keeps its complaint-appended re-ask
    (`doc/decision/translation-repair-recovery-reask.md`) and per-slice semantic wrap stays
    (`doc/decision/translation-repair-page-shape-per-slice-wrap.md`).

## The fifth live pass, keyword233, 19:58 to 20:21 UTC: the withhold holds through every stage

Launched from the worktree at tip `47a292e2a` (the roster-wide withhold) at the 120 s dial,
OpenRouter alone (`~/temp/agent/openrouter-live5-20260903.log`):

- **No Kimi-K3 call at all**:
  no `SPEND` line and no stream for `moonshotai/kimi-k3` from preparation to consolidation;
    `JUDGE SEATS` read `roster=8 translators=6 readers=3 withheld=hf:moonshotai/Kimi-K3` at all five readings,
    `phase=preparation` first.
    The owner's withhold is now verified at the user boundary.
- `TALLY keyword233 status=SETTLED slices=3 ... ms=1358549`;
  `verify-published` 1 of 1 (`chars=796=expected missing=0`);
    no refusal,
    one 5xx retried and recovered,
    two schema-mismatches.
- 10 cut streams (DeepSeek Flash 5,
  Qwen 3,
  GLM-5.3-Flash 2),
  12 voices never heard,
  40 rounds with 92.5 percent of round time waiting after quorum;
    0.4999 USD;
    meter 54.45 before,
    53.89 after.
    Against the fourth pass's 7 cuts and 8 never heard at the same window:
    single runs on this entry spread that wide,
    and neither pair is a window effect on its own.
    DeepSeek Flash this time went mostly to Phala (16 of 18 completed) with Parasail 2 of 5;
    the routing moves between passes,
    which is one more reason single-pass endpoint counts do not earn an ignore.
- The sixth pass launched at 20:21 UTC on `e0509047b` with no straggler dial,
  to run the built-in 120 s window
    and carry the first `recovery round heard N of M` count (`~/temp/agent/openrouter-live6-20260903.log`).

## The sixth live pass, keyword233, 20:21 to 20:43 UTC: the built-in window, no dial

- No `STRAGGLER GRACE OVERRIDDEN` line;
  every reader-round abandonment reads `abandoned 120000ms after quorum`
    (six of them) and the one writer-round abandonment `180000ms`,
    the writer dial still set at launch.
    The built-in 120 s is what the pass runs.
- `TALLY keyword233 status=SETTLED slices=3 ... ms=1312386`;
  `verify-published` 1 of 1 (`chars=806=expected missing=0`);
    no Kimi-K3 call,
    no refusal,
    no schema-mismatch,
    7 cut streams,
    7 voices never heard,
    37 rounds with 94.3 percent of round time waiting after quorum;
    0.4281 USD;
    meter 53.89 before,
    53.41 after.
- No recovery round ran,
  since no answer came back unreadable,
  so the `recovery round heard N of M` line has no first count yet;
    the re-ask's yield is read off the earlier passes instead (next bullet).
- **The complaint-appended re-ask recovers about half**,
  read off today's first,
  third and fourth passes by
    pairing each `recovery round for N unreadable` line with its stage's next `round: x/N heard` line:
    first pass 2 of 8 parsed rounds heard (the misses were MiniMax on Parasail answering unreadably again,
    before the ignore),
    third pass 3 of 3,
    one round on each of the first and fourth passes with an unparsed stage label.
    5 of 11 in all,
    and no `PROMPT-REUSE source=memory` after any of them:
    the nudge makes the digest new every time.
    Issue 473 closed on this measurement.

## The picture passes, 2026-09-04, and the double-quote undercount

Two picture-bearing entries were launched on OpenRouter alone,
concurrently with the Toka_ls pronoun re-run (Synthetic wet,
Hyper unset),
at the owner's instruction that OpenRouter has no meaningful rate limits:
Hangmster at 04:26 UTC (`~/temp/agent/hangmster-pictures-20260904.log`,
one picture) and BI4PBV at 04:28 UTC (`~/temp/agent/bi4pbv-pictures-20260904.log`,
four pictures,
two of them carrying text).

- **BI4PBV's picture stage took one millisecond and said nothing.**
  `JUDGE SEATS phase=pictures` at 04:29:16.205 UTC,
    `phase=lanes` at 04:29:16.206 UTC,
    and no `gathered N of M pictures` or `reading N pictures` line between them,
    where Hangmster's log has both.
    Its `page.md` writes its `PhotoScroll` paths in double quotes,
    one per line;
    `photo-reference.ts` read single-quoted strings only,
    so the slices showed no pictures,
    and `assertVisualEvidenceComplete`,
    asking the same reader,
    found nothing missing.
    Measured at pin `a41fc607` over the source pages:
    192 single-quoted paths across 47 entries,
    7 double-quoted across 4 (`yulianNyanner`,
    `MTF_0615`,
    `Arita`,
    `BI4PBV`),
    no third form.
- **Fixed in `5e013d24b`**:
  either mark opens a string and only the same mark closes it,
  so a caption in one mark beside paths in the other,
    or an apostrophe inside a double-quoted name,
    cannot split a path.
    Three new guards (the multi-line double-quoted array,
    a page mixing both marks,
    the caption and apostrophe cases) shown to fail with the double mark neutralised:
    the captioned case then read the apostrophe in the caption as an opening quote and lost the path entirely.
    Suite 922,
    lint and types clean.
- **BI4PBV relaunched on the fixed build at 04:43:35 UTC** (`~/temp/agent/bi4pbv-pictures2-20260904.log`,
    fresh runs dir):
    `gathered 4 of 4 pictures`,
    `reading 4 pictures`,
    `image0.webp: no text (0 characters, under 16)` so no model was asked for it,
    `image1.webp: read 52 characters without a model` then `minimax-m3 read image1.webp: 251 characters`.
    The first pass runs on as a no-picture control.
    Readings,
    page and the no-Kimi check follow on the tallies.
- **The displacement screen had the same blind spot** (`corpus-run/markup-slice.ts`):
  a single-quoted path line counted as structure,
    a double-quoted one as prose,
    so the double-quoted block read as
    0.4 markup against the 0.8 threshold and was not exempted from the relocation reading.
    Fixed in `4ff42e627`,
    guard shown to fail neutralised (`expected 0.4 to equal 1`).
    Scope:
    `isMarkupOnly` is called only from `corpus-run/displacement-probe.ts`,
    the offline `mise run displacement-probe` instrument that asks no model and whose output no lane reads,
    so no live pass was affected;
    the probe's relocation count for those four entries was the thing at risk.
    No other rule in the package
    keys on the single mark (`rg` over `src` for `startsWith('\'')` and quote comparisons:
    the four remaining hits are typography and refusal readers,
    not path readers).
- The undercount was invisible from the run log,
  which is the lesson worth keeping:
  a stage that finds nothing to do logs nothing,
    and the completeness guard shared the parser's blind spot.
    The seats line is what made it visible,
    by putting a timestamp on each side of the stage.
- **The second pass's picture stage,
  04:43:52 to 04:49:59 UTC**:
  `image0.webp` and `image2.webp` carried no OCR text (0 and 15 characters,
    under 16),
    so no model was asked;
    `image1.webp` was read by minimax-m3
    (251 characters) and Qwen3.8-27B (419) and corroborated by those two at overlap 0.614 after
    GLM-5.3-Flash on Together ran the whole 360 s per-call deadline with 76,412 reasoning characters and
    no content (`stream z-ai/glm-5.3-flash: cut, elapsed 360004ms ... 3932835 raw chars ... 0 content chars`);
    `image3.webp` was read by all three within 3 s and corroborated at 0.966.
    No Kimi-K3 line.
    The cut stream carries no `cost=`,
    so the run meter and the spend report undercount it by whatever the provider bills for those reasoning tokens.
- **The picture gather has no straggler grace** (`image-reading-pair.ts` gathers with `allSettled` and
    waits for every reader or the deadline),
    so `image1.webp` waited 284 s after its second reading for a reader that never answered.
    Measured over every run log in `~/temp/agent` (script `~/temp/agent/picture-wait-20260904.mjs`):
    1,435 pictures with two or more model readings and a settlement;
    the wait after the second reading is 0 s at the median and the 90th percentile,
    1,419 s in total,
    and three pictures waited past 120 s (Toka_ls `photo2.webp` 352 s on 2026-09-02 with
    Kimi-K3 failing at the deadline,
    today's 284 s,
    Zha_Ke `letter.webp` 168 s on 2026-08-27).
    A 120 s grace after corroboration would have saved 444 s across the whole record.
    Most of that record is two-reader rosters where the wait is zero by construction;
    the OpenRouter-alone roster seats three readers,
    so today's two text pictures are the first of the population that matters,
    one of them bad.
    Not built:
    recorded here to be re-read once more three-reader pictures have run.
- **Hangmster settled at 05:05 UTC** (39 min,
  1.79 USD,
  verify-published 1 of 1,
  no Kimi-K3 call,
  one picture with no OCR text so no model reader).
    Its page restores the `## Introduction` heading the archive English had dropped and retranslates the description;
    **it also ships the photo element broken across two lines**,
    `<PhotoScroll photos={[ '${path}/photos/fufu.webp',]}` then `/>  `.
    The semantic wrapper (`semantic-wrap.ts`,
    markdown-lint's `semantic-line-breaks` with MDX parsing off) read the line as prose:
    JSX braces make the tag invalid HTML to CommonMark,
    and the comma before `]}` is followed by a space.
    Measured over the pinned source pages:
    33 one-line `PhotoScroll` elements,
    16 of them across 11 entries with that comma-and-space shape.
    Fixed in the rule (`66345a092`:
    a paragraph whose whole source opens with `<` and closes with `>` is left unbroken),
    guards in both packages shown to fail neutralised.
    MDX still parses the split element,
    so the shipped Hangmster page renders;
    it is not regenerated here,
    since the pipeline digest changed with the build
    and a regeneration would be a full paid re-run rather than a replay.
- **The first BI4PBV pass settled at 05:02 UTC** (34 min,
  1.57 USD,
  verify-published 1 of 1,
  no Kimi-K3 call) as the no-picture control;
    its page keeps both photo elements as the source writes them.
- **The second BI4PBV pass settled at 05:19 UTC** (`TALLY BI4PBV status=SETTLED slices=5 ... ms=2142085`,
    35.7 min,
    1.3827 USD,
    verify-published 1 of 1 at `chars=1077=expected`,
    no Kimi-K3 line,
    19 cut streams,
    7 ModelRun retries,
    no refusal).
    Both photo elements ship as the source writes them,
    one multi-line and one single-line.
    The two blockquotes transcribed from the photos (the "truly lazy" line and the balloon's loss-of-contact line,
    which the source page carries only as pictures) ship translated;
    against the control the wording differs in the ordinary run-to-run way (the `BlurBlock`
    farewell keeps the archive's rendering here where the control rewrote it),
    and nothing in either page is wrong on its face.
    The picture path on OpenRouter alone therefore reads:
    gather,
    OCR gate,
    three seated readers with Kimi-K3 withheld,
    corroboration,
    and the transcription slices judged and shipped.

## ModelRun's timeouts, 2026-09-04, and what the log called them

- **Symptom.**
  Today's six runs logged 115 `MalformedCompletionError: ... stream ended without its
    [DONE] terminator; the reply was cut off` retries by 05:00 UTC (Toka_ls 51 of 592 spend lines,
    Hangmster 29 of 278,
    the first BI4PBV 26 of 245).
    The retry ladder reached its fourth attempt 8 times and gave up at least 5 times (a coverage voice,
    two critic voices and two panel voices lost,
    all minimax-m3).
- **Attribution.**
  The stream line before each retry names the model and endpoint:
  114 of 115 were `minimax/minimax-m3` served by `ModelRun`,
    body 846 characters (7 of them 871),
    0 content characters,
    "completed" after about 10.5 s.
    ModelRun served 300 MiniMax streams today and 119 of them were that body;
    Venice served 5,
    all with content.
- **Reproduced directly** (`~/temp/agent/modelrun-probe.mjs`,
  six trivial calls with `provider.only:
    ['ModelRun']`):
    the fourth answered HTTP 200 in 10,463 ms with one chunk carrying
    `error: { code: 504, message: "error code: 504", metadata: { error_type: "timeout" } }` and no `[DONE]`.
    The gateway had already sent its success status when the upstream timed out,
    so the failure rides inside the stream.
- **The listing agreed** (`~/temp/agent/minimax-endpoints-20260904.json`,
  05:00 UTC):
  ModelRun `uptime_last_30m` 54.9,
    `status` -5,
    prompt 0.75 and completion 3.0 USD per million,
    fp4;
    every other minimax-m3 endpoint read 98 to 100 uptime and status 0 at 0.23 to 0.6 prompt.
- **Why it cannot simply be ignored.**
  Re-probed with the 2026-09-03 corpus-sized schema request under
    zero data retention (`~/temp/agent/openrouter-minimax-endpoints-20260904.log`):
    ModelRun 4 of 4 conformant,
    11 to 15 s;
    DeepInfra and Venice 404 "No endpoints found that can handle the requested parameters";
    CoreWeave,
    the only other zero-data-retention endpoint listing `structured_outputs`,
    404 "All providers have been ignored",
    which is the account-level ignore list;
    default routing without `only` went to Parasail 3 of 4 times with the known empty content channel.
    Under the ZDR decision,
    ModelRun is MiniMax M3's only endpoint for a schema request.
- **What landed** (`f17feba12`):
  `openrouter-stream-error.ts` reads the gateway's error chunk before the
    terminator check and throws `InStreamProviderError` naming code,
    kind and endpoint
    (`stream carried a provider failure instead of a completion: code 504, type timeout, served by ModelRun`);
    the ladder retries it as it retried the truncation.
    Guard shown to fail with the check removed.
    The catalog comment on the minimax row now states the endpoint situation as re-measured.
- **Open,
  for the owner** (options in the question put at the end of this session's turn):
  keep the seat and take the 504 retries (about 10.5 s per failed attempt,
    roughly 1 to 2 percent of MiniMax calls lost after five attempts at today's rate);
    withhold `minimax-m3` from OpenRouter-served seats while ModelRun reads degraded,
    as Kimi-K3 is withheld;
    or un-ignore CoreWeave at the account level and probe it for conformance,
    which would give the schema request a second zero-data-retention endpoint.

## The 429 hold under concurrency, 2026-09-04, 04:54 to 05:18 UTC

Issue 474's fix (`83e8dfa90`:
a refusal while the meter reads wet holds the provider out for 30 s rather than 300 s,
and a both-dry reading waits out the shorter hold once) had unit tests and no live exercise.
Two keyword233 passes with Synthetic wet and Hyper unset (`~/temp/agent/kw-conc-a-20260904.log`,
`kw-conc-b-20260904.log`,
runs dirs beside them) ran concurrently with the Synthetic-wet Toka_ls pronoun
re-run and two OpenRouter-alone picture passes:
three passes on Synthetic at once,
at overlap 4.

- Synthetic answered `HTTP 429` five times,
  all in arm a,
  all between 05:04:15 and 05:04:18 UTC,
  on Qwen3.8-27B calls (the 40-character stream line before each names the model);
    the retry ladder absorbed them at attempts 1 to 3 and no call reached the fifth failure,
    so `markRefused` never ran.
    Arm b and Toka_ls saw none.
    `syntheticFiveHour` read 2737.8 of 2750 remaining throughout,
    so these were the concurrency limit,
    not the allowance.
- Both arms settled:
  a in 1,409,536 ms (23.5 min,
  0.4202 USD on OpenRouter,
  123 Synthetic and 145 OpenRouter spend lines,
    3 cut streams,
    3 voices never heard),
    b in 1,273,689 ms (21.2 min,
    0.3103 USD,
    119 and 138,
    5 cut,
    6 never heard);
    verify-published 1 of 1 each;
    no `EveryProviderDryError`,
    no `SPEND CEILING` line.
- **What this does and does not show.**
  Three Synthetic-wet passes at overlap 4 provoke the limit only in short bursts the ladder rides out,
    so the hold's 30 s branch was not reached live;
    its behaviour rests on `provider-budget.unit.test.ts` and `budget-hold-wait.unit.test.ts`.
    The 2026-09-02 incident needed
    two passes at overlap 4 with eight-wide reader rounds AND a Synthetic five-hour meter at 2729 of 2750 used;
    today's meter was almost untouched.
    Reaching the hold live would take the allowance near its edge,
    which is not a state to manufacture on purpose.

## The two shape passes, 2026-09-04, 05:45 UTC onward, and what they cost

Launched on OpenRouter alone to read the two fixes of the morning on entries that carry their shapes:
`luxuanwen3` (comma-shaped one-line `PhotoScroll`,
one picture) and `MTF_0615` (double-quoted photo paths,
one picture),
logs `~/temp/agent/luxuanwen3-shapes-20260904.log` and `mtf_0615-shapes-20260904.log`.

- **MTF_0615 settled** in 7,555,138 ms (126 min) at 7.3240 USD for a 1,953-character source:
  21 slices,
    verify-published 1 of 1 (`chars=6267=expected`),
    the single-line photo element intact,
    its picture read by OCR as textless so no model was asked,
    no Kimi-K3 call,
    two guard refusals,
    5 in-stream provider failures now named (`code 502, type provider_unavailable, served by Modal` four times,
    OpenInference once),
    and **155 cut streams,
    all straggler-grace abandonments** (130 of them between 120 and 180 s):
    Qwen3.8-27B on Io Net 42,
    Ionstream 19,
    Reka 10;
    DeepSeek Flash on Parasail 41;
    GLM-5.3 on Reka 13 and Modal 12.
- **luxuanwen3 ended INCOMPLETE** in 3,758,245 ms (63 min) at 2.6143 USD with no page:
  `entry luxuanwen3 front matter is not publishable (invalid-page)`.
    Its picture read fine (three readers,
    corroborated at 0.934).
    The cause is in the front matter,
    next section.
    64 cut streams,
    same endpoints.
- **The endpoint cut rates,
  over every run of the day** (completed against cut,
  by `served by`):
  Reka cut 19 of 40 Qwen,
    12 of 41 DeepSeek Flash and 13 of 26 GLM-5.3 streams;
    Io Net 62 of 153 Qwen;
    Parasail 96 of 464 DeepSeek Flash;
    Ionstream 30 of 173 Qwen;
    Modal 21 of 144 GLM-5.3;
    against Together 0 of 245 GLM-5.3,
    DeepInfra 0 of 732 gemma and 0 of 237 DeepSeek Pro,
    Cerebras and Groq 0 of 488 gpt-oss,
    Makora 2 of 99 DeepSeek Flash.
    The 2026-09-03 ignore of OpenInference for DeepSeek Flash was spelled `openinference`;
    the gateway's slug (`GET /api/v1/providers`,
    `~/temp/agent/providers-20260904.json`) is `open-inference`,
    and OpenInference served 43 streams of that model today:
    the ignore had never reached the wire.
- **CoreWeave was never ignored by the owner.**
  Asked,
  the owner answered that the "All providers have been ignored" reply looked like an OpenRouter bug,
    re-saved the account's allowed providers,
    and the re-probe (`~/temp/agent/openrouter-minimax-endpoints-20260904b.log`) read CoreWeave 4 of 4 conformant
    on the corpus-sized schema request under zero data retention,
    16 to 20 s a call,
    0.0024 to 0.0027 USD against ModelRun's 0.0072 to 0.0087;
    default routing still went to ModelRun 4 of 4.
- **What landed** (`openrouter-catalog.ts`):
  `open-inference` spelled as listed;
  ModelRun ignored for MiniMax M3 (CoreWeave serves);
    Reka and Parasail ignored for DeepSeek Flash;
    Reka and Io Net for Qwen3.8-27B;
    Reka for GLM-5.3.
    Rule recorded on the rows:
    an endpoint is ignored when a day's runs cut a quarter or more of at least twenty of its streams,
    or fail that share in-stream;
    Modal (15 percent) and Inceptron (3 of 3) stay.
    A catalog test checks every ignored slug against a snapshot of the provider listing,
    shown to fail with `openinference` put back.

## luxuanwen3's front matter, and the rule the archive breaks

- `validateFrontMatterTranslation` (`front-matter-translation.ts`) refuses a candidate whose `name` and
    `info.alias` differ when the ORIGINAL declares them the same;
    `front-matter-completeness.ts` applies
    the same validator to the assembled page (`doc/decision/translation-repair-front-matter-guard.md`,
    `invalid-page`).
    luxuanwen3's source has `name: 鲵鲵`,
    `alias: 鲵鲵`;
    the archive's page has `name: Nini`,
    `alias: 鲵鲵, Nini`.
    Reproduced with the built validator on the run's candidates:
    the archive-shaped front matter is `invalid` ("must keep name and info.alias as same visible identity"),
    the two candidates with `alias: Nini` are `valid`.
- The translate lane's standing text was the archive-shaped front matter;
  consolidation logged `slice 0:
    consolidation standing text fails publication eligibility and remains retryable`,
    the judges endorsed the standing over the slate ("matches the declared translated identity",
    three ballots),
    and the single attempt "kept it (slate-endorsed-standing);
    shipping with the finding recorded" (`consolidate-slice-buy.ts`,
    single attempt by design after the no-loop proposal).
    The page guard then refused the entry an hour later.
    `settleConsolidation` is never told the standing is ineligible.
- **Measured over the pinned corpus**:
  14 of 92 sources declare `name` equal to `alias`;
  in 7 of them the archive renders the alias differently:
    MizuharaNagisa ("mizuharanagisa" / "Mizuhara Nagisa,
    水原なぎさ,
    Shui Yuan Zhu"),
    SevenBird,
    Weideriche_,
    gaoyanger ("Gaoyang" / "Gaoyang,
    Lamb"),
    interrgned,
    luxuanwen3,
    noname ("noname" / "noname,
    no name,
    anonymous,
    ...").
    Under the rule as written,
    none of those seven can ship an archive-shaped front matter;
    the lanes must drop the extra renderings from the alias.
- **Decided the same day,
  both by the owner**:
  the alias may carry the name among other renderings (`doc/decision/translation-repair-front-matter-guard.md`,
    addendum),
    and consolidation withholds a standing the deterministic gate refused from the slate,
    failing the slice at once when nothing valid ships (`doc/decision/translation-repair-ineligible-standing.md`).
    Landed in `6bfe6da56`,
    every guard shown to fail neutralised,
    suite 924.
    luxuanwen3 relaunched on that build at 09:24 UTC (`~/temp/agent/luxuanwen3-shapes2-20260904.log`,
    OpenRouter alone) to read the page.
- **The routing check** (`~/temp/agent/kw-routing-20260904.log`,
  keyword233 on OpenRouter alone from 08:59 UTC,
    the ignores of `d55d83082` on the wire):
    MiniMax M3 served by CoreWeave 30 of 30,
    Qwen3.8-27B by CoreWeave 32 (4 cut),
    DeepSeek Flash by Phala and Together,
    GLM-5.3 by Modal and Together,
    no call on an ignored endpoint,
    no in-stream failure,
    4 cut streams in the first 25 minutes against MTF_0615's 155 over two hours.
    Settled at 09:25 UTC:
    `TALLY keyword233 status=SETTLED slices=3 ... ms=1553800` (25.9 min),
    verify-published 1 of 1 at `chars=811=expected`,
    0.6134 USD,
    5 cut streams,
    5 voices never heard,
    no in-stream failure,
    no call on an ignored endpoint.

## The luxuanwen3 re-run, 2026-09-04, 09:22 UTC onward: slice 0 passes, slice 1 stops the entry

Launched on `592562992` (alias containment,
withheld standing,
endpoint ignores),
OpenRouter alone,
log `~/temp/agent/luxuanwen3-shapes2-20260904.log`,
runs dir `~/temp/agent/luxuanwen3-shapes2-20260904`.

- Slice 0,
  the front matter (56 source characters):
  both lanes `exit=computed`,
  no eligibility warning at the lane contest or the consolidation.
    The archive's `alias: 鲵鲵, Nini` passes the containment rule.
- Slice 1,
  the description paragraph (95 source characters):
  the translate lane's winner "fails publication invariants" at the contest,
    the standing "fails publication eligibility" at the consolidation,
    and at 09:56:43 UTC,
    34 minutes in,
    `ConsolidationStandingIneligibleError: slice 1 ... (incumbent-only)` stopped the entry.
    The pass of the morning had run 63 minutes before the page guard refused it.
- The cause,
  read from the slice records (`slice-cache/luxuanwen3/translate.*.json`,
  slice 1 findings):
  the original links `https://twitter.com/Deaver1229`,
    the archive's page `https://x.com/Deaver1229`,
    and `mergeAtoms` in `translate-atom-floor.ts` (commit `3ca134e57`:
    "protected atoms take the larger demand of the two references") owes the per-key maximum of both,
    so a candidate carrying either URL is told it lacks the other.
    The four translators asked to repair were told so in both directions:
    two restored the original's URL,
    two kept the page's,
    and every proposal failed the floor.
    The standing,
    the archive's own paragraph,
    fails the same rule,
    so the slate had nothing and the terminal was `incumbent-only`.
- The log could not say this:
  neither warning named the rule or the findings.
  Both drivers now print the deterministic findings,
    and the consolidation warning distinguishes an invalid standing from an unendorsed one.

Census of the pinned corpus (`~/temp/agent/atom-census-20260904.mjs` over `readSliceSkeleton` on whole pages,
`~/temp/agent/link-census-20260904.mjs` over a plain link scan):
of the 70 pages the strict grammar reads whole,
7 carry a link the archive rewrote,
meaning `link-url` diverges in both directions:
MizuharaNagisa (`www.` added),
Rentable_A (trailing slash dropped),
SS3B_0016 and shihai4h (Chinese Wikipedia to English Wikipedia),
aiyysk (`google.cn` to `.com`),
homoyamakaze (an archived Twitter capture to `mtf.wiki`),
luxuanwen3 (`twitter.com` to `x.com`).
XIEPT2,
whose page the whole-page grammar refuses,
is the eighth by the plain scan.
Footnotes diverge in one direction only (5 pages add one,
1 drops one),
never both.
Under the per-key maximum none of the eight can ship:
the archive's paragraph is ineligible,
and no rendering carries both destinations without inventing a link.

Tally:
`TALLY luxuanwen3 status=ERROR ms=2724158` at 10:08 UTC,
587 OpenRouter calls,
2.01 USD by the log's `cost=` fields,
balance 25.79 USD after.
The in-flight consolidation buys for slices 2 to 4 ran on for 11 minutes after the slice 1 error before the tally;
the stop is at the slice,
not the process.

What the tally exposed next:
`entryErrorOutcome` classed `ConsolidationStandingIneligibleError` as a resumable failure,
so the pass logged `REATTEMPT luxuanwen3 queued` and started the lanes again at
10:08:12 UTC against the same deterministic refusal;
it was stopped by hand at 10:09 UTC and the error joined the stopped list (`ae1d2b55f`,
guard shown to fail without it).
The log now names both verdicts and their findings (`558b46e11`).

Question put to the owner:
which rendering a candidate owes where the archive rewrote a destination.

## The luxuanwen3 re-run on the either-rendering build, 2026-09-04: every slice passes, the publisher refuses

Launched at 12:43:50 UTC on `82888d43b` (the rendering pools) plus the docs commit,
OpenRouter alone,
into `~/temp/agent/luxuanwen3-shapes3-20260904` (log of the same name).
Balance 22.53 USD at the SS3B_0016 launch that followed at 13:20 UTC.

What the slices did:
slice 1,
the paragraph whose link the archive moved from `twitter.com` to `x.com`,
passed the deterministic rule in every lane.
The translate lane's winner carried the original's `twitter.com` once and `x.com` never;
three of its translators matched the incumbent.
The contest recorded eight ballots across the slices (four `repair`,
two `translate`,
two `neither`,
five to seven usable each).
Consolidation started at 13:18:47 UTC on all nine slices;
slice 1 exited `computed` in 536 s with no verdict warning;
slices 2 and 6 logged `consolidation standing text lacks contest endorsement and remains retryable`,
and slice 2's single attempt kept the standing (`slate-declined-standing`) with the finding recorded.
No `must carry exactly`,
no `fails the deterministic publication rule`,
no `REATTEMPT`.

Tally:
`TALLY luxuanwen3 status=INCOMPLETE ms=3365280 aborted=false error=entry luxuanwen3 would drop 1
source destination(s)` at 13:39:55 UTC,
56 minutes,
765 calls,
4.24 USD by the `cost=` fields,
balance 19.26 USD at the last meter reading.
Seats:
gpt-oss-120b 120 of 120 usable,
minimax-m3 117 of 117,
gemma 126 of 126,
deepseek-v4-pro 121 of 122,
GLM-5.3-Flash 35 of 39,
deepseek-v4-flash 82 of 94 (12 threw,
the cut-mid-reply shape of the morning),
Qwen3.8-27B 107 of 127 (20 threw),
glm-5.3 57 of 60.

What refused it:
`DroppedDestinationError` in `publish-fixed.ts`,
the document-level check,
which compared the would-ship page's destinations against the source's alone.
The page carried the archive's `x.com` where the source carries `twitter.com`,
which the slice rule had accepted and the publisher counted as one source destination dropped.
The decision record of the morning had said the publisher was unchanged;
that clause was the defect,
and it is struck.
Fixed in `1c9663666` (`corpus-run/destination-renderings.ts`,
the same pool over the whole page;
findings `destinations-archive-rendering` and `destinations-both-renderings` on the `DESTINATIONS` line),
guards shown to fail with the archive side of the pool neutralised,
and `8d7b151ef` (lint).
Two tests of the morning (`consolidate-ineligible-standing`,
`consolidate-standing-verdict`) still asserted the maximum rule through a candidate keeping the page's link;
the full suite had last run before `82888d43b`.
Moved to a candidate carrying neither rendering in `e66da50ef`;
suite 931 groups,
0 FAIL.

SS3B_0016 (the Wikipedia shape,
912 source characters) had been launched at 13:20 UTC on the same build;
it was stopped at 13:51 UTC during its lanes (422 calls,
1.84 USD) because its page could only reach the same refusal,
and relaunched with luxuanwen3 on `e66da50ef` at 13:51:31 UTC (`~/temp/agent/<id>-shapes4-20260904`),
balance 18.49 USD.
