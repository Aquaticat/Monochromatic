# On the quarter measure: the answer

This answers `docs/audit/music-player-truepeak-quarter-measure.md`: a true-peak probe policy
that beats the shipped proportional policy on all three of the letter's measures at once,
under the same law (decode at most a quarter of the library's seconds), reproduced from the
same corpus by a committed bench mode. Every road the letter asked about was tested; the
refusals are reported with numbers.

## The method: frontier zoom

Keep the ninety-second rule: short tracks are decoded whole and known exactly.

For each longer track, spend its share of the budget in two motions:

1.  An even pass: single 0.1 s windows spread evenly across the track, one tenth of its
    length in total.
2.  The climb: repeatedly take the loudest window decoded so far and decode the 0.1 s
    windows on either side of it; newly decoded windows join the candidate heap. Repeat,
    always expanding beside the loudest decoded window, until the track's budget is spent.

Spend the whole allowance: the shipped policy decodes 193094 s and leaves a seventh of the
lawful 229215 s unused; frontier zoom decodes 228970 s (24.97%), raising each long track's
coverage from one fifth to just under a quarter. The fixed margin stays as the final dial;
readings below.

## Why it works

The even probe's under-read is not set by where the crest hides but by how many 0.1 s bins
anywhere in the track come near the crest's level. Measured on every loud long track: the
median track has about twenty bins within 0.5 dB of its crest scattered through its loud
passages, so a one-fifth even probe almost surely strikes one (median miss 0.14 dB).

The 43 clamp-tail tracks have exactly one or two such bins. That is the whole anatomy of the
problem: they are needles. A needle's neighbors betray nothing; even the bins adjacent to
the crest sit 1.6 to 2 dB below it, no louder than the track's ordinary chorus. This is why
no probe-feature classifier can exist: the trace in the heard is not faint, it is absent
(see `analysis/anatomy.mjs` on the branch).

The opening is the rest of the tail. Most of the upper tail is near-misses: probes that
landed on the shoulder of the loud passage without striking its top. Shoulders are slopes,
and slopes can be climbed. The expansion walks up every heard hill and reads its top
exactly; half of all loud long tracks end within 0.01 dB of perfect. Climbing cannot find
needles and does not pretend to; instead it collapses the ordinary misses so far that a
small margin covers as many tracks as the large one did.

## Measured result

Same corpus, same meter, same law. Under-read percentiles in dB, shipped policy then zoom:

- median: 0.14 becomes 0.01
- p90: 0.63 becomes 0.36
- p99: 1.33 becomes 0.91
- worst: 2.25 becomes 1.84

At margin 0.5 dB, all three ledger measures improve at once:

- worst too-quiet: 0.50 dB (shipped: 0.80)
- average needless-quiet across all 4114 tracks: 0.371 dB (shipped: 0.528)
- cold-start clamps: 26 (shipped: 43)

## Margin dial readings

- Margin 0.3: worst quiet 0.30, average 0.203, clamps 62.
- Margin 0.4: worst quiet 0.40, average 0.285, clamps 43 (the shipped count, at roughly half
  the quiet cost).
- Margin 0.5: worst quiet 0.50, average 0.371, clamps 26 (beats all three measures at once).
- Margin 0.8: worst quiet 0.80, average 0.640, clamps 7.

Ranking: 0.5 first (answers the letter in its own terms; the 26 clamps stay a cold-start,
first-play-only artifact that background warming cures), then 0.4 (equal clamp count at half
the audible cost, the better trade if average loudness matters most day to day), then 0.8
(only if clamps weigh far beyond the letter's stated bounds), last 0.3 (62 cold clamps buy
an average gain hardly distinguishable from 0.4).

Provenance refinement: lossless tracks never clamp under zoom at margin 0.5, so a split
margin (safe provenance 0.3, rest 0.5) lowers the average to 0.315 at the cost of one
lossless track clamping (27 total). Ranks between 0.5 and 0.4 if the extra rule is
acceptable.

## Roads tested and declined, with numbers

### Encoding bones: broken open, and found to lie

The letter's most tempting road. The container framing of every lossy loud long track
(2441 files) was parsed without decoding any audio: Opus packet sizes via the TOC byte, m4a
sample tables (stsz/stts), mp3 frame walks. Timelines align with the decoded bins to within
0.15 s worst case.

The byte-rate profile does not locate crests. The crest's slot ranks at the median at the
60th percentile of its own track's byte-rate, worse than chance; padding the window makes it
mediocre at best (36th percentile at ±1 slot). Codecs spend bits on spectral busyness
(cymbals, reverb, dense mixes), not on instantaneous peak height; hot masters are near-flat
in loudness so byte-rate follows texture; and a sub-0.1 s crest is not an expensive event to
encode. Every composed policy that diverted budget toward byte-heavy slots matched or lost
to zoom alone (see `analysis/correlate.mjs`, `analysis/bones-extract.mjs`).

### Album kinship: real, but a poor buyer of seconds

Measured via parent-directory grouping (`analysis/album-prior.mjs`): 95.7% of loud long
tracks live in groups of three or more; the median member sits 0.92 dB below its group max;
probing identifies the group's true loudest member 66.8% of the time, and mispicks miss by a
median 0.12 dB. The kinship is real.

But capping fellows by a fully-scanned album master spends essentially all spare budget
(~36000 s) to bring the average quiet only to 0.362 at best, never improves the worst quiet,
and with no allowance creates five net new clamps. The same seconds spent climbing buy an
average of 0.285 and halve the worst quiet. With tight probes and a small margin the album
cap almost never binds; it is a cure for loose probes, and zoom removes the disease.

### No full hearings at all: measured, and a near-wash that tilts against

The natural next question: is hearing any song in full ever optimal, or should the
ninety-second rule go and every track be probed? Measured: dropping the rule (cutoff 0 s)
frees about three quarters of the 12153 short-track seconds and raises probed coverage from
0.2398 to 0.2499. At margin 0.5 that buys exactly one clamp (25 instead of 26) and costs
0.014 dB of average quiet (0.385 instead of 0.371), because roughly two hundred short tracks
trade exact, zero-error gains for margin-bearing estimates. A 30 s cutoff lands in the same
place (25 clamps, 0.384). Both variants still beat the shipped policy on all three measures,
so this is a genuine dial rather than an error; the rule stays because the letter prices
quiet error as the only true cost, and because exact short-track crests are cached once and
never need the background warming pass that probed tracks still owe.

Across the 723 tracks that declare a peak, the true crest exceeds the declaration by a
median 1.92 dB (worst 4.62). The letter's reading was right: the marks name the safe but
cannot bound the loud.

### Per-track margins, reallocation, position priors: measured and exhausted

Three further non-opaque levers were measured (`analysis/levers.mjs`). A per-track margin
formula from observable heard statistics has nothing to stand on: Spearman correlation of
the zoom's residual under-read against heard spread (max minus p90 or p99 of heard bins),
heard level, and log duration is -0.062, -0.146, 0.011, -0.031; the spread even points the
wrong way, because flat heard profiles are hot masters hiding needles. Global budget
reallocation with a provable-safety early stop (stop probing tracks whose heard max plus
the corpus's worst-known needle prominence stays under the ceiling) harvests 22 of 3903
long tracks, 613 s, +0.0007 coverage: measures unchanged. Position-weighting pass one away
from track openings (crests skew late) is slightly worse than uniform, because the climb
already recovers late structure.

## What this method does not do

The needles stay needles. No heard feature locates them, the bones do not betray them,
their albums do not vouch for them. Zoom narrows the tail they live in (worst miss 2.25 to
1.84 dB) and cheapens the insurance on everyone else, shrinking the guard's work from 43
tracks to 26. Zero clamps ever would still cost a margin near 2 dB on every track; the
letter already declined that price, and this answer declines it too.

These are songs, not arbitrary audio, and the repetition of songs is exactly what the
method already spends: choruses recur, so the ordinary track offers about twenty
near-crest instants and the climb ends within 0.01 dB of perfect on half the library.
The residual tail is the part of each song that breaks its own pattern. Measured on the
26 tracks still clamped at margin 0.5: for 9 the crest is strictly one-off (zoom already
reads within 0.1 dB of the loudest instant two or more seconds away from the crest, so no
hearing-bounded method improves them without decoding the event itself); the other 17
keep a louder echo somewhere that zoom missed by 0.2 to 0.8 dB, and a perfect
echo-finder would dissolve about 14 clamps. But those echoes are needles too (the tail's
median is one crest plus one echo within 1 dB, whole-track), so collecting them reliably
is the same lottery one level down. That bounds what any structure-exploiting,
non-opaque method can still win here: about half the residual clamps, nothing on the
worst quiet, and nothing on the average that the margin dial does not already price.

Practical notes:

- The climb is adaptive: pass two depends on pass one, so the decoder seeks more than the
  even probe does. The law counts decoded seconds and the method obeys it with room to
  spare, but seeking costs wall-clock time; expansions cluster into contiguous runs beside
  peaks, which an implementation can decode as runs.
- With a smaller margin the rare clamped instant clips slightly harder: worst first-play
  overshoot above the ceiling rises from 1.19 to 1.33 dB. Still a brief cold-start artifact
  on one instant, corrected once warming scans the track exactly.
- Numbers are fitted to this corpus exactly, per the agreed fit-the-current-corpus decision
  in `docs/planning/music-player-shared-truepeak-core.md`. The mechanism (miss distribution
  governed by near-crest bin multiplicity; hill-climbing recovers shoulder misses) is
  content-generic; the margin remains the guard against drift.

## Reproduction

Everything reproduces from the recorded corpus without re-decoding the library. On the
branch `truepeak-quarter-answer`:

- `truepeak-core.bench` run with `--zoom` (corpus and metadata arguments as for
  `--proportional`) prints the zoom miss distribution and every dial reading quoted here;
  commit `0bda0177f`.
- `analysis/final.mjs`: the definitive offline comparison (the Rust mode matches it
  exactly). `analysis/baseline.mjs`: ledger parity check. `analysis/anatomy.mjs`: needle
  anatomy. `analysis/adaptive.mjs`: zoom variants. `analysis/correlate.mjs` plus
  `analysis/bones-parsers.mjs`, `analysis/bones-extract.mjs`, `analysis/bones-validate.mjs`:
  the encoding-bones road. `analysis/album-prior.mjs`: the album road.
- The byte profiles (`out/byte-profiles.jsonl`) are regenerated by
  `node analysis/bones-extract.mjs`; large outputs stay untracked.
