# What the translate lane costs, measured

Date:
 2026-08-15

Answers the measurement half of task `#92`, which asks for the budget numbers a
long corpus run needs before it starts.
Every number here comes from calls already bought by the roster-width bench, so
this cost no further quota.

## Evidence

Source:
 `~/temp/agent/roster-bench-2026-08-15/roster-bench/rows.json`,
 60 slice runs over ten stratified slices at widths two through six,
 with width four run twice.
Each row carries every exchange the slice made, with its schema, model, wall
time, server-reported token total, and outcome.

Slice counts per entry come from `prepareDocumentPair` over the 92 corpus pairs
that carry both `page.md` and `page.en.md`, run locally with no model calls.

Two limits on what follows.
The bench recorded the server's TOTAL token count per exchange, so the input and
completion split `#92` asks for is not recoverable from it;
recording both halves is a small change to `bench-record.ts` for the next run.
And the projections apply one per-slice wall time to every slice of an entry,
while a slice's cost plainly varies with its size, so treat entry hours as an
order of magnitude rather than a schedule.

## What one exchange costs

Over 602 exchanges:

-   `translation_report` (translator):
    240 calls,
    mean 3305 tokens,
    latency p50 19.4 s,
    p90 42.2 s,
    p95 52.9 s,
    p99 69.4 s,
    max 71.3 s.
-   `candidate_ballot` (judge):
    318 calls,
    mean 3354 tokens,
    p50 19.0 s,
    p90 46.1 s,
    p95 60.1 s,
    p99 81.2 s,
    max 88.6 s.
-   `translation_repair_report` (a rejected rendering sent back to its author):
    44 calls,
    mean 3934 tokens,
    p50 16.4 s,
    p95 53.9 s,
    max 61.0 s.

So the judge stage is not cheaper than the translator stage per call.
Every candidate becomes input to every judge, which is why a slate of seven
costs what it does.

## Failures

594 of 602 exchanges returned `ok`.
The other 8 were `AbortError`, all of them the bench's own straggler cut after
quorum, and all on the two GLM models:

-   `hf:zai-org/GLM-4.7-Flash` 4 of 135 (3.0%)
-   `hf:zai-org/GLM-5.2` 4 of 119 (3.4%)
-   `hf:Qwen/Qwen3.6-27B`, `hf:moonshotai/Kimi-K3`,
    `hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4`,
    `hf:openai/gpt-oss-120b`:
    zero.

No truncation, no schema-invalid reply, no timeout other than that cut, across
the whole bench.
The one 6-minute timeout and one schema-invalid reply recorded in `#92` came
from an earlier probe on a 4641-character section, and nothing that size appears
here.

That last sentence is a limit on the evidence, not a reassurance, and
`mise run //package/module/translation-repair:slice-census` says how big a
limit.
Incumbent chars per slice over all 1260:
 p50 299,
 p90 486,
 p99 1512,
 max 10959.
The bench's ten slices spanned 94 to 497 incumbent chars, so they sample the
corpus up to about its 90th percentile and nothing above it.
One slice of 1260 exceeds the 4641 characters that produced the known timeout,
and it is more than twice that size:
 `shihai4h` carries 10959 characters in a single slice.
So a clean tail here is evidence about ordinary slices, and says nothing about
the handful that are an order of magnitude larger.

Latency by model, which is what the straggler cut is really measuring:

-   `hf:openai/gpt-oss-120b` p50 4.4 s, p95 8.3 s, max 10.6 s.
-   `hf:moonshotai/Kimi-K3` p50 9.5 s, p95 30.0 s, max 46.5 s.
-   `hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4` p50 12.9 s, p95 41.1 s.
-   `hf:Qwen/Qwen3.6-27B` p50 23.7 s, p95 38.3 s, max 48.0 s.
-   `hf:zai-org/GLM-5.2` p50 24.0 s, p95 74.0 s, max 85.5 s.
-   `hf:zai-org/GLM-4.7-Flash` p50 30.5 s, p95 72.9 s, max 88.6 s.

The spread is a factor of seven at the median.
The 60-second straggler grace sits between the GLM p50 and p95, which is exactly
why those two are the models it cuts.

## What one slice costs

Per slice, by producing-roster width:

-   width 2:
    7.2 calls,
    22118 tokens,
    wall p50 71.7 s,
    p90 103.3 s,
    max 107.7 s.
-   width 3:
    9.0 calls,
    30006 tokens,
    p50 78.1 s,
    p90 146.8 s.
-   width 4:
    10.2 calls,
    34567 tokens,
    p50 86.1 s,
    p90 143.6 s,
    max 170.3 s.
-   width 5:
    11.3 calls,
    41734 tokens,
    p50 112.4 s,
    p90 155.4 s,
    max 210.0 s.
-   width 6:
    12.4 calls,
    40294 tokens,
    p50 101.8 s,
    p90 115.8 s.

Width 6 costing less than width 5 on both wall time and tokens is the
run-to-run band showing itself, not an economy of scale.

## The selector prompt

362 selection exchanges, largest 12119 tokens, p95 8052.
The largest slate the bench built was 7 candidates.
So the selector prompt is nowhere near a context limit on this corpus, and the
`#92` worry about it is answered for slices of this size.

## What the corpus costs

1260 slices over 92 pairs, which is what today's shape costs.
It is not the whole corpus.

Two entries carry sections the aligner refuses to pair, and a refused section
becomes no pair and therefore no slice:
 11 source sections and 10 target sections across `XIEPT2` and `XingZ60`,
 holding 13147 source characters and 1297 target characters that no lane sees.
Sliced at the corpus median source size of 101 characters, that source text
would add on the order of 130 slices, about a tenth of a pass on top of the
figures here.
So `#90` landing raises the cost rather than redistributing it.

A separate asymmetry sits INSIDE the paired sections and is already paid for
here:
 132 blocks across 39 entries, 44731 characters, that the translation carries
 and the original does not.
`#90` decides how a slice is sized around those, not whether they are bought.

An earlier version of this section said no population sat outside the slices,
reading a census counter that walked the pairs.
Only a forced pairing becomes a pair, so a refused section is absent from the
pairs rather than present with an empty side, and that counter could only ever
report zero.
The census now counts sections against pairs instead
(`mise run //package/module/translation-repair:slice-census`).
Slices per entry:
 p50 8,
 p90 25,
 p95 44,
 max 83.
The ten largest are `XingZ60` 83, `aiyysk` 80, `hulicaijia` 71, `shihai4h` 54,
`interrgned` 44, `NIGHT81473140` 42, `Xu_Yushu` 35, `mikaela_khara` 35,
`zhangyubaka` 31, `TianqiChen666` 25.

One full pass, tokens:

-   width 2: 27.9M
-   width 3: 37.8M
-   width 4: 43.6M
-   width 5: 52.6M
-   width 6: 50.8M

Against the three-hour per-entry cap, with slices run sequentially:

-   At the median slice time, EVERY entry fits at every width.
    The median entry takes about 11 minutes at width 4;
    the 95th percentile entry about 63 minutes;
    the largest, `XingZ60`, about 2 hours.
-   At the p90 slice time, 90 of 92 entries fit at width 4, 89 of 92 at width 5,
    and all 92 at widths 2 and 6.
    The entries that fall out are the two largest.

So the cap is not the binding constraint the repair lane made it.
The two entries that can exceed it are exactly the two the slice cache exists
for, and they resume rather than restart.

## What this does not answer

-   Input against completion tokens, since the bench recorded only the total.
-   Whether a slice's cost scales with its size, which needs the per-slice sizes
    joined to per-slice times over more than ten slices.
    The sizes are now known (p50 299 incumbent chars, max 10959);
    what is missing is a timed run over the large end.
-   What the largest slices do at all, since the bench sampled none above 497
    incumbent characters and the one slice over 4641 is the size that timed out
    before.
-   Anything about the repair lane under the new shape, which is a separate
    budget and is not measured here.
