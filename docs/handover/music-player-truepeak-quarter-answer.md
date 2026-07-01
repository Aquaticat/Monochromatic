# Handover: answering the quarter-measure letter

## The task

Answer `docs/audit/music-player-truepeak-quarter-measure.md`: find a true-peak
sampling policy for the music library that beats the shipped proportional policy
on at least one of three measures (worst too-quiet, average too-quiet, cold-start
clamp count) while decoding no more than a quarter of the library's seconds
(229215 of 916861).

## Where things live

- The letter: `docs/audit/music-player-truepeak-quarter-measure.md`.
- Evidence + prior roads: `docs/planning/music-player-shared-truepeak-core.md`,
  Stage-two section (from line ~787).
- Ground truth corpus: `packages/music-player/truepeak-core.bench/out/tracks-fine.jsonl`
  (95 MB JSONL; per track: path, duration_secs, full_peak linear, bin_seconds=0.1,
  bin_peaks = per-0.1s Catmull-Rom window peaks). Any probe policy simulates offline
  against this; no re-decoding needed.
- Provenance: `out/metadata.jsonl` (codec, kbps, lossless, ytdlp), `out/peak-tags.jsonl`.
- Baseline evaluator: `truepeak-core.bench --proportional` (src/proportional.rs) reads
  `truepeak_core::default_policy` (short_scan<=90s, coverage 1/5, window 0.1s,
  margin 0.8 dB) and reproduces the ledger: decoded ~21%, under-read median 0.14 /
  p90 0.63 / p99 1.33 / max 2.25 dB, 43 tracks clamped at margin 0.8
  (clamped = under_read - margin > max_too_loud 0.5).
- The actual audio library is local at `/home/user/Seafile/Plain/Music` (65 GB;
  opus 2583, flac 1251, aac 135, mp3 13 in the older 3991-track metadata pass).

## Work environment

- Experiments and any code live in the worktree
  `/var/home/user/worktrees/truepeak-quarter-answer` (branch `truepeak-quarter-answer`).
  User authorized anything on worktree branches. Main worktree stays clean except
  this handover and the final answer doc.
- Main repo HEAD moved during the session (stage-three policy resolver landed);
  concurrent sessions are normal here, do not touch unrelated changes.

## Plan (task list mirrors this)

1. Reproduce ledger baseline with bench + an offline simulator (parity check),
   and compute the baseline average-quiet measure.
2. Tail anatomy: around each track's crest bin, does loudness decay slowly enough
   that heard neighbors betray the unheard crest? Especially for the 43 clamp-tail
   tracks. Decides whether adaptive zoom can work.
3. Simulate adaptive two-pass (uniform then zoom), position priors, full-budget
   (25% vs shipped 21%) reallocation, per-provenance margins.
4. Album prior: parent-dir grouping, within-album crest spread, album-max capping.
5. Encoding bones: parse Ogg packet sizes / m4a stsz / flac+mp3 frame sizes (no
   decode; free under the letter's law) into per-time byte-rate profiles; test
   whether they locate crests; simulate profile-guided probes.
6. Compose final policy, verify budget, wire committed evaluation into
   truepeak-core.bench on the branch.
7. Write the answer doc under `docs/audit/`, same register as the letter.

## Status: reopened for the bucket round (user pushback), then re-close

The user pushed past the first close twice: (a) "no full hearings" variant
(measured: buys one clamp, costs 0.014 dB average, rule kept); (b) "these are
songs" (measured: structure ceiling bounds any echo-finder to ~14 of the
residual 26 clamps; 9 crests are strictly one-off); (c) "bucket the metadata
first" (WORKS, see below); (d) "find more levers yourself" (lever matrix run).

Bucket round results (committed 77fcc0ef0, branch):

- tags-sweep.mjs: ffprobe inventory of the whole library (no decode).
  Buckets from embedded tags only (production-legal, no path text):
  flac / store (store IDs or iTunNORM) / purl (youtube provenance tag) /
  bare (untagged lossy). Long-track seconds: bare 534k, flac 311k, purl 37k,
  store 22k.
- Per-bucket zoom tails diverge hard: flac p99 under-read 0.65 dB at 10%
  coverage; bare 1.83 at 10%, 1.00 at 24%, 0.92 at 28%.
- Composite winner (verified by independent re-eval): flac=(c 0.10, m 0.45),
  purl=(0.18, 0.40), store=(0.32, 0.30), bare=(0.32, 0.50): 19 clamps
  (4 flac, 14 bare, 1 purl) / avg 0.349 / worst 0.50, decoded 227901 s.
  Beats uniform zoom (26 / 0.371 / 0.50). All-margins-0.4 variant: 29 clamps /
  0.283 avg / 0.40 worst (vs uniform m=0.4: 43 / 0.285 / 0.40).
- Levers measured dead this round: jittered/golden-ratio pass-1 (grid does not
  alias), wider zoom expansion radii, heard-clipping density (Spearman 0.037),
  declared-peak floors (rgPeak all-opus with 4.6 dB understatement band;
  iTunNORM n=55 with a 5 dB outlier).
- Duplicate-master pooling: measured and declined (analysis/duplicates.mjs,
  commit bd92acb15). Duplicate mass is 1.20% of library seconds (53 groups,
  107 tracks). Correlation-matched pooling is HARMFUL: correlation is
  scale-invariant so it pools different masters of the same song (+3 clamps,
  worst quiet 0.50 -> 1.04). Gain-verified pooling (close-bin fraction > 0.95,
  crest spread <= 0.16 dB) is safe but frees only ~2000 s: zero metric
  movement. Lesson recorded: match on gain-sensitivity, never correlation.
- In flight: FLAC frame-size bones agent (lossless bits may track level well
  enough to guide low-coverage flac probes). Compose + wire + re-docs after.

## Prior status: complete (first close)

- The answer is committed: `docs/audit/music-player-truepeak-quarter-measure-answer.md`
  (main, commit d33f2bc58).
- The committed evaluation lives on branch `truepeak-quarter-answer` (pushed):
  `truepeak-core.bench --zoom` (src/zoom.rs, commit 0bda0177f) reproduces every
  quoted number; analysis/*.mjs hold each road's evidence (baseline parity,
  anatomy, adaptive zoom, bones extraction + correlation, album prior, final
  comparison). Byte profiles regenerate via `node analysis/bones-extract.mjs`.
- Result: frontier zoom (even 0.1-coverage pass, then loudest-neighbor
  expansion to the full quarter budget, 228970 of 229215 s) at margin 0.5 beats
  the ledger on all three measures at once: 26 clamps vs 43, avg quiet
  0.371 dB vs 0.528, worst quiet 0.50 dB vs 0.80. Margin dial and a
  provenance-split option (avg 0.315, 27 clamps) are recorded in the answer.
- Not done (possible follow-ups): shipping the zoom policy in truepeak-core's
  resolver (the bench mode is evaluation-only; production needs two-phase
  adaptive window placement), and verifying zoom against exact decoded windows
  rather than the 0.1 s bins (same caveat the plan records for the shipped
  policy).

## Findings so far

- Baseline measures to beat (margin 0.8): worst quiet 0.80 dB, average
  needless-quiet across all 4114 tracks 0.528 dB, 43 cold-start clamps.
  Shipped policy decodes 193094 s; the quarter budget is 229215 s, so
  36121 s go unspent.
- Sanity: max(bin_peaks) equals full_peak exactly for every track, so bin-level
  simulation is faithful.
- Tail anatomy: the 43 clamped tracks are isolated needles. Median tail track
  has exactly 1 bin (0.1 s) within 0.5 dB of its crest across the whole track
  (ordinary tracks: median 20); even bins adjacent to the crest sit 1.6-2 dB
  below it. Under-read is governed by how many near-crest bins exist, so no
  local shoulder betrays the needles; zoom alone cannot catch them.
  All 43 are lossy (41 opus, 2 m4a), none FLAC.
- Frontier zoom (pass-1 even single 0.1 s bins at 10% coverage, then repeatedly
  decode undecoded neighbors of the loudest decoded bin, up to 24% total
  coverage = full budget): under-read p50 0.01 / p90 0.35 / p99 0.91 / max 1.84.
  With margin 0.5 it beats the ledger on all three measures at once:
  26 clamps vs 43, avg quiet 0.372 vs 0.528, worst quiet 0.50 vs 0.80.
  With margin 0.4: 43 clamps (equal), avg 0.286, worst 0.40.
- Gotcha for the answer: better sampling with an unchanged margin makes average
  quiet WORSE (probe closer to truth means the fixed margin over-attenuates
  more); sampling gains must be taken by lowering the margin.
- Album prior measured (analysis/album-prior.mjs, commit 9ee84f77b): 244 groups
  with >= 3 loud long members cover 95.7% of loud long tracks; within-group
  spread median 0.92 dB below group max; probe picks the true loudest member
  66.8% of the time (mispicks mild, median 0.12 dB). But the cap policy costs
  ~36k s (all remaining headroom) for avg quiet 0.528 -> 0.362 at best, never
  improves worst quiet (0.8), and at allowance 0 nets +5 clamps. Zoom spends the
  same headroom strictly better (avg 0.285, worst 0.40, clamps equal). Under
  zoom's tight probes + small margin the cap almost never binds. Verdict:
  measured and declined; document in the answer.
- Encoding bones refuted (analysis/bones-*.mjs, correlate.mjs): all 2441 lossy
  loud long files parsed without decoding (opus TOC, m4a stsz/stts, mp3 frames;
  timelines within 0.15 s). The crest slot ranks at the 60th byte-rank
  percentile of its own track (median), worse than chance; bits follow spectral
  busyness, not peak height. Composed bones+zoom never beats zoom alone.
- Declared peaks verified useless: rgPeak understates the true crest by median
  1.92 dB (max 4.62) across the 723 tagged tracks.
- No-full-hearings variant measured (user suggestion): cutoff 0 s buys one
  clamp (25 vs 26 at margin 0.5) but worsens avg quiet 0.371 -> 0.385 and
  forfeits exact cached short-track crests; recorded in the answer, rule kept.
