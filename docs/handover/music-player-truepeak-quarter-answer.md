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

## Status

- Baseline reproduced offline with exact parity (analysis/corpus.mjs +
  baseline.mjs on the branch); anatomy + adaptive experiments done and committed
  (anatomy.mjs, adaptive.mjs).
- Two subagents running: (a) no-decode byte-rate profile extractor
  (opus TOC / m4a stsz / mp3 frames) for the encoding-bones road;
  (b) album-prior evaluation.
- Next: bones correlation + guided-probe simulation, then compose the final
  policy, wire a bench mode, write the answer doc.

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
