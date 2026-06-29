# Self-consistency lane results

`src/bin/selfconsist.rs`.
 Engine-internal contract checks across all four unicode
modes (ascii,
 default,
 full,
 javascript) and hardened/default,
 over the full
anchor and lookaround superset (the generator emits `^ $ \A \z \b \B`,
 the four
lookarounds,
 intersection,
 complement,
 star,
 opt,
 any-byte `_`).
 No external oracle
needed;
 it checks resharp against its own documented,
 asserted contracts.
 This lane
found both of the campaign's findings.

Alphabet `a b \n` (newline included so multiline anchors are exercised),
 inputs
exhaustive to length 5,
 6,899,984 pattern-input pairs over 4 seeds on x86 (plus the
M1),
 release and debug profiles.

## Checks and results

- C1 `is_match <=> find_all non-empty`:
   VIOLATIONS.
   Minimal `_&(?:[ab]|$)?` on
  `"\n"`:
   is_match=true while find_all=[] and the language is empty there.
   The
  is_match false-positive finding
  (`bug-is-match-false-positive-inter-optional-end-anchor.md`).
- C2 `find_anchored=Some(m) => m.start==0 and m == longest find_all match at 0`:
  VIOLATIONS.
   `(\z|$)$` on `"\n"`:
   find_anchored=Some(0,1) (phantom width-1) while
  the longest find_all match at 0 is (0,0).
   The find_anchored finding
  (`bug-find-anchored-end-anchor-union.md`).
- C3 `find_anchored=None => no find_all match at 0`:
   VIOLATIONS.
   `(\z|$)$` on
  `"\na"`:
   find_anchored=None while find_all has (0,0).
   Same finding as C2 (the
  other direction).
- C4 `default find_all == hardened find_all`:
   0 violations.
   Default and hardened
  agree on every pair.
   The 06-11 bug-07 (default-vs-hardened divergence) is fixed.
- C5 `stream non-empty <=> find_all non-empty`:
   violations,
   all in the experimental
  off-by-default `stream` API (`stream-experimental.md`).
   Not a production-API
  finding.

Crashes (panics in compile-accepted patterns):
 0,
 in release and debug.
 No
assert/overflow/unwrap panic was reached by any generated pattern across the
superset.

## Reading

The lane cleanly separates the state of 0.6.13:

- `find_all` and `is_match`/`find_anchored` AGREE in the overwhelming majority;
   the
  disagreements are two narrow,
   minimizable triggers,
   both in the accepted
  superset,
   both isolated to `find_anchored` and `is_match` respectively (find_all
  is the correct side in each,
   confirmed by the denotational and Lean lanes).
- The contracts the maintainer hardened in the 0.6.9 to 0.6.13 window (default ==
  hardened,
   no crashes,
   is_match/find_all agreement in general) hold across
  millions of superset pairs;
   the residue is the long tail of the bug-02/08/10
  families on specific end-anchor compositions.

## Reproduce

```bash
cd /tmp/agent/resharp-denot-oracle
cargo run --release --bin selfconsist 300 8000 5 4   # one seed; sweep many seeds
cargo run --release --bin c1min          # is_match (C1) trigger boundary
cargo run --release --bin trig           # find_anchored (C2/C3) trigger boundary
```
