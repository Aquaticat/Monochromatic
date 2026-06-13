# music-player: Just-in-time shuffle without a precomputed order

Status: decisions accepted; implementation not yet started. Date: 2026-06-13.
Applies to both `packages/desktop-app/music-player` and `packages/android-app/music-player`.

## Context

The Queue materialized a shuffled permutation (`order: Vec<usize>`) up front.
Any live change to the Queue then had to patch that permutation (insert a new track somewhere, remap indices on
removal), which is bookkeeping that exists only because the order is precomputed.

## Decision

Shuffle picks a track just in time rather than building a permutation.
It is **without replacement, built as you go**: each cycle plays every track in the current scope once in random
order, the played set grows as tracks play, and exhausting the scope starts a fresh cycle (the existing
scope-loops behavior).
The play history this produces is `prev`'s back-stack, and for `next` after `prev` it acts as a back/forward
cursor (you retrace forward before drawing new random picks).
The seedable PRNG is kept, so shuffle remains deterministic under test.

## Consequences

- Live add/remove needs zero shuffle bookkeeping: a newly added track is simply an eligible pick not yet in the
  cycle, and a removed track drops from eligibility and history.
  This is what let the live-update path collapse to a single rescan-and-diff
  (see `music-player-live-update-rescan.md`).
- `prev` now depends on retained history rather than walking a stored order.
- Changes the Queue's shuffle internals and their tests;
 moderately hard to reverse once the model and tests are rewritten.

## Considered and rejected

- With-replacement pure random (no cycle): rejected because a track could recur before others are heard and some
  tracks could go unplayed for a while.
- Keeping the precomputed permutation: rejected because it is the source of the live-update bookkeeping this whole
  redesign removes.
