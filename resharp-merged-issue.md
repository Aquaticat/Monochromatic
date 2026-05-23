# Merged upstream issue draft for resharp

This is the single issue body to file at `https://github.com/ieviev/resharp`.
Attach `TROUBLESHOOTING.resharp.md` (the full investigation) and
`TROUBLESHOOTING.resharp.patch` (the combined fix) when filing.

Before filing, re-run `git apply --check TROUBLESHOOTING.resharp.patch` and the
reproducers against the current `main`: this was prepared against HEAD
`e0b8aba96f0c1987f9802498e585b5e88966023b` (declares 0.6.3) on 2026-05-23, and
resharp's main branch moves quickly. Update the commit hash below to whatever
`main` resolves to at filing time.

---

**Title:** Three DFA-construction bugs in 0.6.3 plus an error-message nudge, with proposed fixes

**Labels:** `bug`, `engine`, `algebra`

## Summary

While using resharp as the regex engine for a CI secret-scanner (rules combine
intersection `&` and complement `~` heavily), fuzzing surfaced three distinct
DFA-construction defects (plus a minor error-message legibility issue) that
persist in published 0.6.3 and on `main` (`e0b8aba`). Each is reproduced below
with a minimal pattern, the source location of the cause, and a proposed minimal
fix. The four fixes together are
attached as a single patch; applied to `main` they make every reproducer below
behave correctly and leave `cargo test --workspace --no-fail-fast` at
`231 passed; 0 failed; 19 ignored`, identical to the unpatched baseline (purely
additive, no regressions).

A fifth shape (an alternation containing a lookaround alongside a sibling
lookaround, e.g. `(a|(?![_]))(?!a)`, which used to trip
`engine.rs:1020`'s `unexpected end` assertion at `find_all` time) appears to
have been fixed somewhere between 0.6.0 and 0.6.3; it is included only as
resolved context, with no proposed change.

All line numbers are against `main` at `e0b8aba`.

## Bug 1: non-termination in `prefix::calc_prefix_sets_inner`

`Regex::new` never returns for patterns combining a literal prefix, a complement
`~(...)`, an intersection `&`, and a quantified group.

```rust
use resharp::Regex;
let _ = Regex::new(r"abc~(\w)&(?:aaa)*"); // never returns
```

The hot loop is `resharp-engine/src/prefix.rs:27` in `calc_prefix_sets_inner`.
`redundant` is seeded with `BOT` and `start` and never updated, so a derivative
chain of unique fresh nodes (never wrapping back to a boundary node, never
nullable, never self-looping) loops forever. The `targets.retain(|(t, _)|
!redundant.contains(t))` added in 0.6.x does not help, because `redundant` still
only ever holds the two seed nodes.

Proposed fix: track fresh visits in a second set and clear-and-break on a
revisit, mirroring the existing `target == node` self-loop semantics. This keeps
the boundary-wrap path (which retains `result`) separate from the cycle path
(which clears it), so the change is additive.

```diff
--- a/resharp-engine/src/prefix.rs
+++ b/resharp-engine/src/prefix.rs
@@ -23,12 +23,18 @@ pub(crate) fn calc_prefix_sets_inner(
     let mut redundant = BTreeSet::new();
     redundant.insert(NodeId::BOT);
     redundant.insert(start);
+    let mut visited: BTreeSet<NodeId> = BTreeSet::new();
 
     loop {
         if !result.is_empty() && redundant.contains(&node) {
             break;
         }
 
+        if !result.is_empty() && !visited.insert(node) {
+            result.clear();
+            break;
+        }
+
         if b.any_nonbegin_nullable(node) {
             break;
         }
```

With this applied, `Regex::new(r"abc~(\w)&(?:aaa)*")` returns in milliseconds and
`is_match` returns `false` for every input in `{"", "abc", "aaa", "abcaaa",
"aaaaaa", "abc!", "abcaaab"}`, consistent with the empty language the pattern
represents. An earlier one-line variant (inserting every `target` into
`redundant`) was rejected: it conflates the two exit semantics and breaks 9 of
the anchored `prefix_rev` cases in `resharp-engine/tests/prefix.toml`.

## Bug 2: `attempt to add with overflow` in `attempt_rw_concat_2`

Two surface shapes reach the same overflowing add and panic during `Regex::new`
under `overflow-checks` (and silently wrap to a wrong DFA without it):

```rust
use resharp::Regex;
// intersection + \w + end-anchor:
let _ = Regex::new(r"(?:\w|$)(?:(?![1g]\_X)& a)");
// nested lookahead inside a quantified group, outer min >= 2:
let _ = Regex::new(r"(?:(?!\?){1,2}){3}");
let _ = Regex::new(r"(?:(?!abc)){4,12}a");
```

The add is `tail_rel + la_rel` at `resharp-algebra/src/lib.rs:2479` inside
`attempt_rw_concat_2`. Both operands are `u32` lookahead-`rel` values; for these
shapes the lookahead chain saturates and the sum exceeds `u32::MAX`.

Proposed fix: saturate. The sibling `else` arm of the same expression already
uses `u32::MAX` as the unbounded-`rel` sentinel, so saturating to `u32::MAX` on
overflow is the existing semantics, not a new one.

```diff
--- a/resharp-algebra/src/lib.rs
+++ b/resharp-algebra/src/lib.rs
@@ -2476,7 +2480,10 @@ impl RegexBuilder {
             let la_rel = self.get_lookahead_rel(head);
             let la_rel = if new_la_tail.is_kind(self, Kind::Lookahead) {
                 let tail_rel = self.get_lookahead_rel(new_la_tail);
-                tail_rel + la_rel
+                // saturate: the `else` arm already uses u32::MAX as the unbounded
+                // sentinel, and tail_rel + la_rel can exceed u32::MAX (overflow
+                // panic under overflow-checks, silent wrap otherwise).
+                tail_rel.saturating_add(la_rel)
             } else {
                 u32::MAX
             };
```

With this applied, all three patterns above compile (`COMPILE-OK`) in both debug
and release.

## Bug 3: `strip_lb` returns a node still containing a lookbehind (silent corruption in release)

For an intersection with a lookbehind operand, `find_all` (debug) panics on the
`debug_assert!` in `strip_lb`, and `find_all` (release) silently returns
spurious matches.

```rust
use resharp::Regex;
let re = Regex::new("(?:(?=a)&(?<=_))").unwrap();
// debug:   panics at resharp-algebra/src/lib.rs:2007 "should not contain lookbehind"
// release: returns 62 spurious matches on a 64-byte input ending in '_'
//          (and 127 matches on 128 bytes of 'a', which contain no '_' at all)
let _ = re.find_all(b"________________________________________________________________");
```

`strip_lb` (`resharp-algebra/src/lib.rs:2002`) calls `strip_lb_inner`, which for
an intersection recurses into both operands but cannot actually remove a
lookbehind operand; the post-condition `debug_assert!(!contains_lookbehind(...))`
then fails in debug and is compiled out in release, where the un-stripped node
builds a wrong DFA.

Proposed minimal fix: fail closed. When the strip could not remove every
lookbehind, return the `UnsupportedPattern` error this function already returns
elsewhere, rather than a result that violates the post-condition. Every caller of
`strip_lb` already handles the `Err` path (`?`, `map_err`, `if let Ok`, `match`).

```diff
--- a/resharp-algebra/src/lib.rs
+++ b/resharp-algebra/src/lib.rs
@@ -2004,11 +2007,12 @@ impl RegexBuilder {
             return self.strip_lb(node_id.right(self));
         }
         let result = self.strip_lb_inner(true, node_id)?;
-        debug_assert!(
-            !self.contains_lookbehind(result),
-            "should not contain lookbehind: {:?}",
-            self.pp(result)
-        );
+        // fail closed: if the strip could not remove every lookbehind (e.g. a
+        // lookbehind operand of an intersection), returning it builds a wrong DFA
+        // (silent in release; the prior debug_assert only caught it in debug).
+        if self.contains_lookbehind(result) {
+            return Err(ResharpError::UnsupportedPattern);
+        }
         Ok(result)
     }
```

With this applied, `Regex::new("(?:(?=a)&(?<=_))")` returns
`Err(UnsupportedPattern)` cleanly in both debug and release: no panic, no
spurious matches. Note this is an observable behaviour change: a pattern of this
shape that previously compiled and returned (incorrect) matches now errors at
`Regex::new`. Those matches were unsound, so we do not expect correct usage to
depend on them, but the change is visible to callers. This is a conservative fix
(it rejects the pattern rather than correctly supporting
intersection-with-lookbehind); if you would rather support the shape, the real
fix is in `strip_lb_inner`'s intersection handling, which is larger.

## Bug 4 (minor): generic error message for unsupported patterns

`ResharpError::UnsupportedPattern` renders as the static string "unsupported
lookaround pattern" regardless of the surface trigger, which is hard to act on
when the user wrote no explicit lookaround (e.g. `\b` or `^`/`$` inside a
complement, which the parser rewrites to lookarounds, or the intersection-with-
lookbehind shape above).

The diff below is a minimal legibility nudge to the shared render string. It is
not a full fix: the variant is used at six construction sites with different
triggers, so naming the actual surface trigger per site would require splitting
the variant or threading context, which is larger but still localized. Offered
for your preference.

```diff
--- a/resharp-algebra/src/lib.rs
+++ b/resharp-algebra/src/lib.rs
@@ -32,7 +32,10 @@ impl std::fmt::Display for ResharpError {
             ResharpError::StateSpaceExplosion => {
                 write!(f, "too many states, likely infinite state space")
             }
-            ResharpError::UnsupportedPattern => write!(f, "unsupported lookaround pattern"),
+            ResharpError::UnsupportedPattern => write!(
+                f,
+                "unsupported lookaround pattern (lookaround, word boundary, or `^`/`$` anchor inside a complement `~(...)`, or a lookbehind operand of an intersection `&`)"
+            ),
         }
     }
 }
```

## Verification

All four fixes are in the attached `TROUBLESHOOTING.resharp.patch`. Against
`main` at `e0b8aba`:

```text
git apply --check TROUBLESHOOTING.resharp.patch   # applies cleanly
cargo test --workspace --no-fail-fast
# 231 passed; 0 failed; 19 ignored   (identical to the unpatched baseline)
```

Each reproducer was confirmed to fail before the patch and behave correctly after,
in both debug (debug-assertions + overflow-checks on) and release builds. The
full investigation, including the consumer-side pre-validators that currently
guard against these shapes, is in the attached `TROUBLESHOOTING.resharp.md`.

Happy to split this into separate issues if you prefer one per bug.
