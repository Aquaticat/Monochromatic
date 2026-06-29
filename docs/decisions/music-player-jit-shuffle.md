# music-player: Just-in-time shuffle without a precomputed order

Status:
 decisions accepted;
 implementation not yet started.
 Date:
 2026-06-13.
Applies to both `packages/music-player/desktop-app` and `packages/music-player/android-app`.

## Context

The Queue materialized a shuffled permutation (`order: Vec<usize>`) up front.
Any live change to the Queue then had to patch that permutation (insert a new track somewhere,
 remap indices on
removal),
 which is bookkeeping that exists only because the order is precomputed.

## Decision

Shuffle picks a track just in time rather than building a permutation.
It is **without replacement,
 built as you go**:
 each cycle plays every track in the current scope once in random
order,
 the played set grows as tracks play,
 and exhausting the scope starts a fresh cycle (the existing
scope-loops behavior).
The play history this produces is `prev`'s back-stack,
 and for `next` after `prev` it acts as a back/forward
cursor (you retrace forward before drawing new random picks).
The seedable PRNG is kept,
 so shuffle remains deterministic under test.

## Consequences

- Live add/remove needs zero shuffle bookkeeping:
   a newly added track is simply an eligible pick not yet in the
  cycle,
   and a removed track drops from eligibility and history.
  This is what let the live-update path collapse to a single rescan-and-diff
  (see `music-player-live-update-rescan.md`).
- `prev` now depends on retained history rather than walking a stored order.
- Changes the Queue's shuffle internals and their tests;
 moderately hard to reverse once the model and tests are rewritten.
- The play history is kept by load-order index,
   not by path,
   so it does not survive the index
  shifts a rescan causes.
 A reload or live rescan therefore resets the shuffle cycle:
 the controller re-selects the surviving track by path,
   which restarts the history at that
  track and begins a fresh cycle.
 This is acceptable because live changes to the source root are rare;
 the alternative (path-keyed history surviving rescans) was not worth the added complexity.
- Implementation detail:
   `Off` keeps the existing sequential scope order (it is deterministic
  and needs no history);
 only `WithinPage` and `All` use the just-in-time history,
   so `prev` wraps in `Off` but stops
  at the history start under shuffle.

## Considered and rejected

- With-replacement pure random (no cycle):
   rejected because a track could recur before others are heard and some
  tracks could go unplayed for a while.
- Keeping the precomputed permutation:
   rejected because it is the source of the live-update bookkeeping this whole
  redesign removes.
