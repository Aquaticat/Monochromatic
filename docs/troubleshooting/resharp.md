# Resharp: upstream bugs and forbidden-strings workarounds

This document tracks the upstream resharp bugs that `forbidden-strings`
defends against, the consumer-side guards that block each, and the
verification path for each finding.

Current status (2026-06-03, resharp 0.6.8): the lockfile and the
`packages/cli/forbidden-strings/Cargo.toml` requirement floor are bumped
from 0.6.3 to 0.6.8, executing the wait-then-bump-then-re-fuzz plan recorded
for 0.6.3 (since removed as spent; git history has it). Behavioural
re-verification at 0.6.8
(targeted probe crates, not a fresh fuzz campaign; the full fuzz re-run
stays a recommended next step):

- Bugs B, C, E, F: fixed upstream. Bug C and Bug E compile cleanly and fast;
  Bug B and Bug F are now rejected at `Regex::new` with
  `Algebra(UnsupportedPattern)` (fail closed, no release corruption, no
  arithmetic overflow). Their four pre-validators are now belt-and-suspenders
  rather than load-bearing.
- Bug A: unchanged (complement-of-lookaround still rejected). New at 0.6.8:
  the `\A`/`\z`-inside-complement workaround is now also rejected, so it no
  longer compiles; the literal-whitespace and `\W` workarounds still work.
- Bug D: was fixed-and-clean at 0.6.3; 0.6.8 tightened further and now
  rejects the shape at compile. Still fail-closed-safe.
- Bug G: still unfixed at 0.6.8 (`max_depth` was not upstreamed). The deep-
  complement stack-overflow floor dropped below 20,000 levels. The
  consumer-side depth pre-validator and the upstream filing are now
  unblocked (the bump-trigger is met); both are held for a separate
  go-ahead.
- Intersection over alternation (new, found by forbidden-strings fuzzing on 0.6.8): an
  uncatchable algebra-recursion stack overflow distinct from Bug G, with no
  safe consumer-side guard. A minimal fix (a re-entrancy guard on the
  distribution rewrites) is now prototyped and verified; file-ready, held for
  go-ahead. See "Intersection over alternation: unbounded algebra recursion".
- Hardened `find_all` drops zero-width matches (new, found 2026-06-03): a
  soundness defect. The `hardened(true)` engine returns no matches for a
  pattern that `is_match` and `find_anchored` both report matching (e.g. `\B|,`
  on a single non-word byte). Prototyped and verified (differential-clean
  against published 0.6.8); file-ready. See "Hardened find_all drops zero-width
  matches".
- Compile-time timeouts on small patterns (new, found 2026-06-03, now resolved):
  the fork's add-fuzz `compile` target (libFuzzer `-timeout=10`) fired on a
  lookbehind and two `\p{...}` inputs. Reproduced from the exact
  `fuzz/artifacts/compile/`
  bytes: not a resharp defect. The watchdog times one unit, which is the full
  six-config `option_sweep()` run under ASAN; each compile is sub-second on a
  normal build (the lookbehind sweep reaches ~12.5s only under ASAN). Not
  fileable: the fault is the fork's harness, not the engine. See "Compile-time
  timeouts on small patterns (fuzz-harness artifact, resolved)".

Combined upstream PR (2026-06-03): the four file-ready fixes (Bug G `max_depth`,
the intersection-over-alternation re-entrancy guard, the hardened zero-width
`find_all` fix, and the flaky-test calibration) are bundled on branch
`fix/zerowidth-findall-and-stack-overflow-guards` in the user's fork
(`~/resharp`, `https://github.com/Aquaticat/resharp`), based on `c6623fe`
(0.6.8), and filed as
[ieviev/resharp#13](https://github.com/ieviev/resharp/pull/13). A fifth commit
adds a `max_depth` boundary test (depth-999 accepted, 1001 and complement-1001
rejected, `unbounded_size` opt-out) in response to Copilot review. The full
draft, per-fix root-cause traces, verification, and combined diff are in the
out-of-band local file `docs/todo/resharp-bugs-202606031308-pr.local.md`
(gitignored, not committed). The combined patch is
`/tmp/agent/resharp-combined-202606031308.patch`.

A flaky upstream timing test (`rev_bot_skip_terminates_fast`) surfaced while
verifying the prototype; it fails identically on stock 0.6.8. Its absolute
sub-millisecond bound is replaced by a verified self-calibrating linearity-test
prototype; both are documented under "Flaky upstream test" below.

Full per-bug method and probe output: see "Bump to resharp 0.6.8
(2026-06-03)" below.

Fixed upstream (historical breadcrumb): Bugs B, C, D, E, F were tracked
here through their full investigation and were fixed upstream in resharp
0.6.4 (the maintainer shipped our prototype patches the same day we filed
the merged issue [ieviev/resharp#5](https://github.com/ieviev/resharp/issues/5)),
then re-verified fixed or fail-closed at 0.6.8. Their detailed per-bug
sections and the spent filing / prototype / plan narrative were removed
2026-06-03 once that work landed; git history before that commit holds the
full analysis. Their consumer-side pre-validators
(`intersection_with_lookbehind`, `intersection_with_word_end_alternation`,
`lookaround_in_alternation_with_sibling`,
`complement_intersection_quantified_group`,
`nested_lookahead_in_quantified_group`) in
`packages/cli/forbidden-strings/src/rules/engine.rs` stay as
belt-and-suspenders; over-rejection is fail-closed-safe.

Still-live items, each with its own section below: Bug A
(complement-of-lookaround), Bug G (deep-nesting stack overflow),
intersection over alternation (algebra-recursion stack overflow), hardened
`find_all` dropping zero-width matches (soundness), compile-time timeouts on
small patterns (fuzz-harness artifact, resolved), the flaky
`rev_bot_skip_terminates_fast` timing test, and the lower-severity flags H, I, J.

## Bump to resharp 0.6.8 (2026-06-03): plan executed

The wait-then-bump-then-re-fuzz plan recorded for 0.6.3 (since removed as
spent) held the lockfile at 0.6.3 until the maintainer's follow-up release. resharp 0.6.8 (published 2026-06-03, the
crates.io `max_version`) is that release line. This pass bumped
`packages/cli/forbidden-strings/Cargo.toml` from `resharp = "0.6"` to
`resharp = "0.6.8"` and updated `Cargo.lock` (resharp, resharp-algebra, and
resharp-parser all 0.6.3 to 0.6.8), then re-verified every tracked bug
behaviourally against the published 0.6.8 build.

### What 0.6.8 changed upstream

Read against a fresh clone of `https://github.com/ieviev/resharp` at
`c6623fe` (the `0.6.8` commit). The 0.6.4 fix code (Bugs B, C, E, F) is
present and was extended across 0.6.5 through 0.6.8:

- `resharp-engine/src/prefix.rs:23-35`: the Bug E `visited` set plus
  clear-and-break (our prototype, shipped in 0.6.4) is unchanged.
- `resharp-algebra/src/lib.rs:2543`: the Bug C / Bug F
  `tail_rel.saturating_add(la_rel)` is present (it shipped in 0.6.4; 0.6.5
  separately replaced the `incr_rel` helper with `u32::saturating_add` in
  upstream PR #6, hardening related `rel` arithmetic).
- `resharp-algebra/src/lib.rs:2040-2049`: `strip_lb` keeps the Bug B fail-
  closed `if self.contains_lookbehind(result) { return Err(...) }`, and
  `strip_lb_inner` was rewritten to recurse through intersection, union,
  and concat operands. Despite that rewrite the Bug B shape still ends up
  rejected (now at `Regex::new`, see below), so the "reallow properly"
  follow-up the maintainer mentioned did not re-admit it.
- Commits `b552bc7 ensure unsupported patterns are rejected`,
  `8252fe9 word boundaries rewrites`, `2a89b6b improve word boundary
  rewrites`, `37dfa20 distribute inter before supported check`, and
  `cb527d6 short circuit non overlapping intersections` tightened the
  unsupported-pattern rejection. Net effect: several shapes that used to
  overflow, corrupt, or compile-then-misbehave now fail closed at
  `Regex::new` with `Algebra(UnsupportedPattern)`, and a couple of shapes
  that used to compile (Bug A `\A`/`\z`-in-complement, Bug D) now also
  reject.
- `PatternFlags` (`resharp-parser/src/lib.rs`) still has no `max_depth`
  field and `parse_inner` has no depth check, so Bug G is unfixed. The
  unrelated `max_depth` in `resharp-engine/src/lib.rs:1323` is a prefix-
  length cap in the anchored `is_match` heuristic, not a nesting bound.

### Probe method

A throwaway crate (`resharp = "=0.6.8"`, release profile matching this
crate: `lto`, `codegen-units = 1`, `opt-level = 3`, `panic = "unwind"`,
`overflow-checks = true`) calls `Regex::new` and `find_all` directly on
each tracked shape, built and run in both debug (debug-assertions and
overflow-checks ON) and release. Bug G's deliberately stack-overflowing
deep-nesting runs were isolated in `podman run --memory=2g --cpus=2 --rm`
(fedora:44), one input per `timeout`, so an abort is observable by exit
code without risking the host. This is a targeted re-verification of the
known shapes, not a fresh fuzz campaign; re-running the forbidden-strings
`fuzz_extract_gate_soundness` and companion targets against 0.6.8 stays a
recommended next step.

### Per-bug results at 0.6.8

- Bug A (`em&~(.*\bnpm\b.*)`, `em&~(^foo$)`, `em&~((?=foo).*)`): still
  `Algebra(UnsupportedPattern)`; `em&~(.*\B.*)` still
  `Parse(UnsupportedResharpRegex)`. Unchanged. New: `em&~(\Afoo\z)` now
  also returns `Algebra(UnsupportedPattern)` in both profiles (it compiled
  cleanly through 0.6.3), so the `\A`/`\z` workaround no longer holds. The
  literal-whitespace control `em&~(.* (npm|git) .*)` still compiles, which
  is the workaround the production rules already use.
- Bugs B, C, D, E, F (spent, full per-bug detail removed; git history has
  it): all fixed or fail-closed at 0.6.8. Bug C (`(?:\w|$)(?:(?![1g]\_X)& a)`)
  and Bug E (`abc~(\w)&(?:aaa)*`) compile cleanly and fast; Bug B
  (`(?:(?=a)&(?<=_))`), Bug D (`(a|(?![_]))(?!a)`), and Bug F
  (`(?:(?!\?){1,2}){3}`) are rejected at compile with
  `Algebra(UnsupportedPattern)` (no release corruption, no overflow). Their
  pre-validators are now belt-and-suspenders.
- Bug G (nested `~(...)` / `(?=...)`): unchanged. In release the complement
  and lookahead nests still abort with a stack overflow (exit 134); the
  abort floor for `compl` dropped to at-or-below 20,000 levels (`compl
  20000` aborts at 0.6.8 versus returning `Ok` at 0.6.4), so the heavier
  algebra walks now cost more stack per level. Plain `group` still reaches
  the size guard (`Ok` at 49,000, `Err(Parse(UnsupportedResharpRegex))` at
  60,000). `catch_unwind` cannot intercept the SIGABRT.

### Pre-validator decision

Every pre-validator stays in place. For Bugs B, C, E, F (and D) the upstream
shapes are now fixed or fail-closed, so the matching pre-validators in
`packages/cli/forbidden-strings/src/rules/engine.rs` are belt-and-
suspenders: they reject the same shapes upstream rejects, or shapes that now
compile harmlessly, and over-rejection is fail-closed-safe (the production
corpus has no rules of these shapes). Bug A's `lookaround_in_complement`
stays load-bearing: upstream still rejects, but the pre-validator rejects
earlier with an actionable, doc-pointing message. No pre-validator is
loosened in this pass; loosening would trade a safe over-rejection for a
dependence on exact upstream behaviour, with no production benefit.

### Now-unblocked follow-ups (actioned 2026-06-03)

The bump satisfied the "next upstream release bump" condition both deferred
items waited on; both are now actioned:

- Bug G consumer-side `nesting_depth` pre-validator: implemented in
  `packages/cli/forbidden-strings/src/rules/nesting.rs` (cap 1,000), wired as
  the first check on the resharp path in `compile_rule_src`, with tests in
  `nesting_tests.rs`. It byte-scans paren depth outside character classes and
  rejects before resharp's `Regex::new`, fail-closed and safe to over-reject.
- Bug G upstream filing prep: the prototype `max_depth` diff was re-ported and
  re-validated against a fresh 0.6.8 clone (the literal 0.6.4 diff no longer
  applies: line drift plus the parse-loop check now reads `self.stack_group` /
  `self.max_depth` directly rather than the 0.6.4 `self.parser()` wrapper). It
  builds clean and the cap holds: `compl` nested 30,000 deep returns a clean
  `Err` instead of aborting, the boundary is exact (999 compiles, 1,001
  rejects), and real rules still compile. Re-verified again 2026-06-03 in a
  fresh `c6623fe` clone (`compl`/`look`/`group` all `Ok` at 999, `Err` at 1,001;
  `compl`/`look` at 30,000 and `group` at 60,000 return a clean `Err`, no abort)
  and bundled into the combined PR branch (see the "Combined upstream PR" note
  near the top). NOT pushed (a shared-state action; held for the user).

The forbidden-strings fuzz campaign that the "Probe method" note above deferred
was also run against 0.6.8. Two distinct harnesses appear throughout this doc,
so the target names are qualified by which one they belong to:

- The forbidden-strings harness lives in this workspace at
  `packages/fuzz/forbidden-strings`; its `smoke` task runs all seven targets
  under AddressSanitizer: `fuzz_extract_gate_soundness`,
  `fuzz_regex_engine_dispatch`, `fuzz_residual_shards`, `fuzz_literal_roundtrip`,
  `fuzz_regex_syntax_walkers`, `fuzz_ruleset_scan_invariants`, and
  `fuzz_scan_format`. It fuzzes forbidden-strings, which depends on resharp, so
  it reaches resharp defects through the consumer.
- The resharp fork's `add-fuzz` harness lives in the fork (`~/resharp`,
  `https://github.com/Aquaticat/resharp`) under `fuzz/`, with three targets that
  fuzz resharp directly: `compile`, `diff_regex`, and `match_invariants`. It
  surfaced the compile-timeout artifacts and the hardened `find_all` zero-width
  crash documented in their own sections below.

`fuzz_extract_gate_soundness` (the forbidden-strings Bug B to F soundness
target) is clean on 0.6.8. The forbidden-strings campaign surfaced one new
resharp defect, below.

## Intersection over alternation: unbounded algebra recursion (found 2026-06-03)

A defect distinct from Bug G, surfaced by the forbidden-strings targets
`fuzz_regex_engine_dispatch` and `fuzz_residual_shards` during the 0.6.8
campaign.

### Symptom

`resharp::Regex::new` overflows the stack (AddressSanitizer reports
`stack-overflow`, the process aborts via SIGABRT) on patterns that combine
intersection (`&`) with a nested, flagged or anchored alternation operand.
Minimal reproducer:

```text
(?iu)(?:@2222&(?:(?:(?:(?:(?:i22|222)|(?:222|^))|café)|café)|café))
```

The abort is uncatchable: it is a stack overflow, not an arithmetic panic, so
`catch_unwind` cannot intercept it; and it is NOT absorbed by a larger stack
(re-tested under `ulimit -s 1000000`, about 1 GB: still overflows), so the
recursion is effectively non-terminating, not merely deep.

### Root cause

The recursion cycle, symbolized from the ASAN trace, is resharp's algebra
distributing intersection over union and back:

```text
<resharp_algebra::RegexBuilder>::mk_union
<resharp_algebra::NodeId>::iter_union::<...attempt_rw_inter_2::{closure}>
<resharp_algebra::RegexBuilder>::mk_inter
<resharp_algebra::RegexBuilder>::attempt_rw_union_2
(back to mk_union)
```

`attempt_rw_inter_2` distributes `A & (B|C)` into `(A&B)|(A&C)`, and
`attempt_rw_union_2` distributes the result back, so the two rewrites
ping-pong without reaching a fixpoint for this operand shape. The 0.6.x
commits `37dfa20 distribute inter before supported check` and `cb527d6 short
circuit non overlapping intersections` are in this code path.

### Bisection: the trigger is a feature interaction, not just nesting

Simpler variants compile cleanly on 0.6.8 (probe crate, capped container):

- `a&(b|c)` and `a&(((((b|c)|d)|e)|f)|g)` (a 5-level nested alternation under
  intersection, no flags, no anchor) both return `COMPILE-OK`.
- The production rule
  `/\b((?:A3T[A-Z0-9]|AKIA|ASIA|ABIA|ACCA)[A-Z2-7]{16})\b&~(AKIA2{16})/`
  (line 105 of the generated baseline) returns `COMPILE-OK`.

Only the full combination (intersection + nested alternation + `(?iu)` flags +
a `^` anchor inside the alternation + unicode literals) overflows. The trigger
is a narrow multi-feature interaction, not a single measurable axis.

### Defense (consumer side): none safe; fuzz targets skip the combo

There is no safe consumer-side pre-validator. A guard broad enough to catch
the overflow (for example "reject `&` co-occurring with a positive `|`") also
rejects the line-105 AWS-key rule above, which has a positive alternation
under intersection and compiles fine. `nesting_depth` does not catch it either
(paren depth is about 7, far below the cap, because the blowup is algebraic,
not paren-nesting), and `catch_unwind` cannot catch the abort.

Two forbidden-strings fuzz targets reach it and now skip the combo:

- `fuzz_regex_engine_dispatch` skips the compile-dispatch comparison for any
  `&`+`|` rule (keeping the soundness-critical under-classification assert).
- `fuzz_residual_shards` drops `&`-rules before `build_residual_shards` unions
  the survivors (the union `(...|A&B|...)` is what creates the combo from
  individually-safe rules).

Production is UNDEFENDED but unaffected in practice: the trusted corpus uses
only flat alternations under intersection (which compile), and rules are
config, not attacker input. A hand-written rule of the trigger shape would
abort the scanner.

### Five-constraint upstream-filing check

1. Upstream's fault? Yes. A parser-reachable pattern that aborts the process
   via non-terminating algebra recursion is a defect.
2. Can upstream fix it? Plausibly the same shape as the former Bug E fix (a
   visited-set / fixpoint guard in `prefix.rs`, shipped in 0.6.4): a visited
   or fixpoint guard on the `attempt_rw_inter_2` / `attempt_rw_union_2`
   distribution so it cannot re-enter the same rewrite indefinitely. Touches
   the algebra core, so larger than that prefix-loop fix.
3. Supporting this use case? Yes. Intersection and alternation are both
   headline features; combining them is natural.
4. Likely to fix? Plausible; the maintainer is responsive and the recent
   commits actively rework intersection distribution.
5. Prototyped a minimal fix? Yes (2026-06-03). See "Prototype" below.

All five constraints now hold, so this is file-ready. It is NOT yet filed:
filing is a shared-state action held pending explicit go-ahead, the same as
the Bug G `max_depth` patch.

### Prototype (2026-06-03): re-entrancy guard on the distribution rewrites

A minimal fix breaks the cycle without touching the distribution rewrites'
semantics. The re-materialized 2026-06-03 patch is part of the combined PR
branch and `/tmp/agent/resharp-combined-202606031308.patch`
(`resharp-algebra/src/lib.rs` only, ~33 insertions; the per-fix diff is in
`docs/todo/resharp-bugs-202606031308-pr.local.md`).

Mechanism: add an in-progress set
`rw_active: FxHashSet<(u8, NodeId, NodeId)>` to `RegexBuilder` (the `u8` tags
inter=0 / union=1 so the two rewrites do not alias), and wrap
`attempt_rw_inter_2` and `attempt_rw_union_2` so that re-entering either with a
`(kind, left, right)` triple already on the stack returns `None` (decline the
rewrite). `mk_inter` / `mk_union` then fall through to building the plain
`Inter` / `Union` node, which has identical language semantics, so declining an
optimization rewrite is sound. The hash-cons cache does not break the cycle on
its own because the key is inserted only after the rewrite completes, which for
this operand shape never happens.

Why it terminates: the cycle is, by construction, the same canonical triple
re-entering its own rewrite. Blocking exactly that re-entry costs nothing for
non-cyclic rewrites (sequential same-triple calls insert, run, and remove
before the next call) and cannot recurse, because the second nested visit of a
triple is precisely the cycle.

Verification (all on the capped probe, gnu target, 8 MB stack):

- Minimal repro
  `(?iu)(?:@2222&(?:(?:(?:(?:(?:i22|222)|(?:222|^))|café)|café)|café))`
  now returns `COMPILE-OK` (was: stack overflow, SIGABRT) on the guarded build.
- Previously-OK patterns still compile: `a&(b|c)`,
  `a&(((((b|c)|d)|e)|f)|g)`, the line-105 AWS-key rule.
- resharp's own suite on the guarded build: every test passes
  (`engine_test` 123/0, `properties_test` 36/0, `neon_simd` 73/0, parser, seek,
  stream, deriv, rev_nulls all green), with only the pre-existing flaky timing
  test `rev_bot_skip_terminates_fast` excluded (it fails identically on stock
  0.6.8; see its own section below).
- Differential match check: a `find_all` comparison of guarded vs unmodified
  0.6.8 over a corpus of intersection patterns (`abc&.*b.*`,
  `[a-z]+&~(.*foo.*)`, `(a|b)+&.*ab.*`, the AWS-key rule, `(?i)foo&.*o.*`, etc.)
  is byte-for-byte identical: the guard changes zero match results.

A cleaner upstream fix would make the two distributions converge to a canonical
form instead of declining on re-entry, but the guard is the minimal change that
proves the defect is fixable and stops the abort with no semantic change.

Re-materialized and re-verified 2026-06-03 in a fresh `c6623fe` (0.6.8) clone
(the prior session's `/tmp/agent` patch was cleaned). The guard is one of the
four fixes in the combined PR branch (see the "Combined upstream PR" note near
the top). Re-verification on the combined build: the full release suite passes
(`engine_test` 124/0 including the now-green `rev_bot_skip_terminates_fast`,
`properties_test` 36/0, all binaries 0 failed), the minimal reproducer compiles,
previously-OK patterns compile, and a guarded-vs-published-0.6.8 `find_all`
differential over 10 intersection/union patterns x 7 inputs (70 checks) shows
0 differences. The forbidden-strings fuzz target `fuzz_regex_engine_dispatch`
is the compile target this overflow class belongs to: it exercises
`compile_rule_src` on every
generated rule and now skips the `&`+`|` compile-dispatch comparison to avoid the
abort (keeping the soundness assert).

---

## Hardened find_all drops zero-width matches (found 2026-06-03)

### Symptom

`Regex::find_all` on the hardened engine (`RegexOptions::default().hardened(true)`)
silently under-reports: it drops a zero-width match at position 0 and at
end-of-input, while `is_match` and `find_anchored` both report the match and the
default (non-hardened) engine returns it. This is a soundness defect (matches
present in the language are not returned), specific to hardened mode.

Reproduction against published 0.6.8:

```rust
use resharp::{Regex, RegexOptions, Match};
let re = Regex::with_options(r"\B|,", RegexOptions::default().hardened(true)).unwrap();
let hay: &[u8] = &[0xAB]; // one non-word byte
assert!(re.is_match(hay).unwrap());                              // true
assert_eq!(re.find_anchored(hay).unwrap(), Some(Match { start: 0, end: 0 }));
assert_eq!(re.find_all(hay).unwrap(), Vec::new());              // BUG: empty
// default engine is correct:
assert_eq!(
    Regex::new(r"\B|,").unwrap().find_all(hay).unwrap(),
    vec![Match { start: 0, end: 0 }, Match { start: 1, end: 1 }],
);
```

The drop is precisely at the two boundary positions. For `"  "` (two spaces,
all `\B` positions): hardened returns `[{1,1}]` while default returns
`[{0,0},{1,1},{2,2}]` (interior position 1 kept, boundary positions 0 and 2
dropped). For `"abc"` where `\B` only holds at interior positions 1 and 2,
hardened and default agree (the dropped boundary positions do not match anyway,
so nothing is lost there, which is why this hid).

### Root cause

`find_all` routes hardened patterns to `find_all_dfa` ->
`find_all_dfa_inner` -> the hardened active-set branch
(`resharp-engine/src/lib.rs:1734`), which calls `scan_fwd_active_set`
(`resharp-engine/src/fas.rs:348`). For `\B|,` the pattern is neither
`always_nullable` nor `rev_trivial` (confirmed: removing the `&& !self.hardened`
guard at `lib.rs:1719` does not change the result), so the
`find_all_nullable_slow` path that handles nullable patterns is not taken; the
matches come from `scan_fwd_active_set`.

`scan_fwd_active_set` spawns matches from the reverse-scan `nulls` set and
records the best end in `max[i]`, using `max[i] == 0` as the "no match" sentinel
(`fas.rs:365`). Its non-`ALWAYS_NULLABLE` emission loop (`fas.rs:532-538`) is:

```rust
for &i in nulls.iter().rev() {
    if i < skip_until || max[i] == 0 {
        continue;
    }
    emit(i, max[i], &mut skip_until);
}
```

Two gaps:

1. A zero-width match at position 0 has end 0, which collides with the
   `max[i] == 0` "no match" sentinel, so position 0 is skipped.
2. The scan loops only `while pos < data_end`, so it never spawns a match
   starting at `data_end`; `max[data_end]` stays 0 and the end position is never
   emitted.

The correct default path `scan_fwd_all` (`resharp-engine/src/engine.rs:894`)
avoids both: it uses `NO_MATCH` (not 0) as its sentinel, emits position 0
explicitly with `l_max_end` seeded from `initial_nullability` (lines 911-962),
and emits `Match{data_end, data_end}` unconditionally when `data_end` is in
`nulls` (lines 970-975). In this engine, membership of a boundary position in
`nulls` (computed by the reverse scan) is itself the confirmation that a match
starts there; the forward scan only determines the end.

### Verification

A probe crate (`resharp = "=0.6.8"`, release) reproduces the empty `find_all`
on the hardened engine while `is_match`/`find_anchored`/default all report the
match. The prototype below makes hardened agree with default with 0 differences
across 11 zero-width/nullable patterns x 8 inputs, and resharp's own release
suite stays green.

### Prototype (2026-06-03): emit boundary matches in the active-set scan

Part of the combined PR branch (see the "Combined upstream PR" note near the
top); the per-fix diff is in
`docs/todo/resharp-bugs-202606031308-pr.local.md` and the standalone patch is
`/tmp/agent/resharp-hardened-zerowidth-findall-0.6.8.patch`. The fix changes the
non-`ALWAYS_NULLABLE` emission branch of `scan_fwd_active_set` so the two
boundary positions in `nulls` are treated as confirmed matches (the reverse
scan guarantees them, exactly as `scan_fwd_all` does) and emits with
`max[i].max(i)` (end == i for a zero-width match, a no-op for a confirmed longer
match whose end is always >= i). Interior candidates are unchanged: they still
require `max[i] != 0`.

```diff
         } else {
             for &i in nulls.iter().rev() {
-                if i < skip_until || max[i] == 0 {
+                if i < skip_until {
+                    continue;
+                }
+                if i != 0 && i != data_end && max[i] == 0 {
                     continue;
                 }
-                emit(i, max[i], &mut skip_until);
+                emit(i, max[i].max(i), &mut skip_until);
             }
         }
```

Verification on the patched `c6623fe` clone:

- The reproducer now returns `[{0,0},{1,1}]`; `"  "` returns
  `[{0,0},{1,1},{2,2}]`.
- Differential `find_all` over 11 patterns (`\B|,`, `\b|x`, `a*`, `x*|,`, `.*`,
  `(?:a)?`, `\B|a`, `,|\B`, `[^a]*`, `a|`, `\b|,`) x 8 inputs: hardened ==
  default, 0 differences (patterns that fail to compile in both modes are not
  mode discrepancies).
- `cargo test --release --workspace --no-fail-fast`: every binary green
  (`engine_test` 124/0, `properties_test` 36/0).

### Five-constraint upstream-filing check

1. Upstream's fault? Yes. `find_all` is documented to return all matches; the
   hardened engine returning fewer than the default engine for the same pattern
   is a soundness defect, not a documented mode difference.
2. Can upstream fix it? Yes; the minimal fix is the localized emission change
   above (the default path already does the right thing).
3. Supporting this use case? Yes. Hardened mode is a headline feature ("hardened
   mode for untrusted patterns"); it must not change which matches `find_all`
   returns, only the algorithm.
4. Likely to fix? Plausible; the maintainer is responsive and the fix is small,
   localized, and differential-clean.
5. Prototyped a minimal fix? Yes, verified (above), in the combined PR branch.

All five hold; file-ready as part of the combined PR. Held for the user to push.

### Consumer-side note

forbidden-strings compiles its rules with the default engine, not
`hardened(true)`, so production is not affected. No consumer-side guard is
needed; the fix is purely upstream.

---

## Compile-time timeouts on small patterns (fuzz-harness artifact, resolved)

### Symptom

The 0.6.8 fuzz campaign (`compile` target, libFuzzer `-timeout=10`) saved three
small-pattern artifacts under `fuzz/artifacts/compile/` on the fork's `add-fuzz`
branch: two `timeout-<hash>` files and one `slow-unit-<hash>`. The headline read
as "`Regex::with_options` exceeds the 10s per-input timeout on a lookbehind
`(?<=b\b)_*...` and a `\p{L}`-bearing pattern", which looked like a pathological
compile-time slowdown or non-termination.

It is neither. Reproduced from the exact artifacts, every one of these patterns
compiles in under one second on a normal build. The 10s the fuzzer measured is
one libFuzzer unit, which is the full six-config `option_sweep()` run under an
ASAN-instrumented build, not a single compile.

### Root cause: harness measures six compiles per unit, under ASAN

The `compile` fuzz target compiles each input under every option in the sweep,
discarding results (fork `add-fuzz`, `fuzz/fuzz_targets/compile.rs`):

```rust
fuzz_target!(|pattern: &str| {
    for opts in option_sweep() {
        let _ = Regex::with_options(pattern, opts);
    }
});
```

`option_sweep()` returns six configs (`fuzz/src/lib.rs`): `default`,
`hardened(true)`, the three `UnicodeMode`s, and a flag bundle. So one libFuzzer
"unit" the `-timeout=10` watchdog times is six calls into
`Regex::with_options` (`resharp-engine/src/lib.rs:915`), not one. cargo-fuzz
builds with ASAN plus SanitizerCoverage; ASAN alone multiplies the slowest of
these compiles enough that six of them cross 10s.

The artifact bytes decode to the pattern via `<&str as Arbitrary>::
arbitrary_take_rest`, which is the longest valid-UTF-8 prefix of the whole
input. The three decode to:

- `slow-unit-1ae74b9...` -> `\P{L}` (input truncates at the first `0xff` byte).
- `timeout-5022ded...` -> `<d\d` then six NULs, `d`, six NULs, `\p{L}d`
  (truncates at the `0xa2` continuation byte).
- `timeout-5cb5f42...` -> `(?<=b\b)_*\x12\x00](8=a)\\` (all ASCII).

There is no super-linear blowup: per-compile cost is flat across all six options,
and bounded. The earlier "could not reproduce" reading was wrong because it used
reconstructed partial patterns and timed a single compile in a plain release
build, not the six-config sweep under ASAN.

### Verification

Stock 0.6.8 (fork `add-fuzz` engine == upstream `c6623fe`), reproduced with an
`examples/repro3.rs` that decodes each artifact exactly as the fuzz target does,
then times `Regex::with_options` per option. Built and run in
`podman run --memory=2g --cpus=2 --security-opt label=disable`. Per-compile wall
times (the `ascii` config returns `Err` for `\p{...}` immediately, so it is ~0ms
and omitted):

- Plain release:
  - `\P{L}`: ~155ms each, sweep ~0.77s, all `Ok`.
  - `<d\d`...`\p{L}d`: ~75ms each, sweep ~0.37s, all `Ok`.
  - `(?<=b\b)_*...`: ~760ms each, sweep ~4.6s, all `Err`.
- Release with `-Cdebug-assertions=on -Coverflow-checks=on` (cargo-fuzz's
  non-ASAN defaults): essentially unchanged (`\P{L}` ~170ms, NUL/`\p{L}` ~85ms,
  lookbehind ~850ms). Debug assertions are not the amplifier.
- Release under `-Zsanitizer=address` (nightly):
  - `\P{L}`: ~355ms each, sweep ~1.8s.
  - `<d\d`...`\p{L}d`: ~200ms each, sweep ~1.0s.
  - `(?<=b\b)_*...`: ~2.5s each, sweep ~12.5s. This sweep crosses the 10s
    watchdog, which is the `timeout-5cb5f42...` artifact.

The two cheaper patterns sit at ~1 to 1.8s per sweep under ASAN; SanitizerCoverage
overhead on top, plus campaign-time machine load, accounts for `\P{L}` and the
NUL/`\p{L}` input also tripping the slow-unit / timeout save during the original
run. None of this is resharp taking pathologically long; each compile is
sub-second on a normal build.

The repro harness (disposable clone under `/tmp/agent`):

```rust
// resharp-engine/examples/repro3.rs (excerpt)
fn decode(bytes: &[u8]) -> &str {
    match std::str::from_utf8(bytes) {
        Ok(s) => s,
        Err(e) => std::str::from_utf8(&bytes[..e.valid_up_to()]).unwrap(),
    }
}
// for each artifact's bytes, for each of the six option_sweep() configs:
//   let t = Instant::now(); let _ = Regex::with_options(decode(bytes), opts);
//   eprintln!("{ms} ms");
```

### Why we do not file this upstream

Constraint 1 (is it really upstream's fault?) fails outright. This is not a
resharp compile-time defect: every affected pattern compiles in under a second
on a normal release build, with cost flat across options and no growth in input
size. The >10s is a property of the fork's own fuzz harness (six compiles per
libFuzzer unit) measured under ASAN, a measurement artifact, not engine
behaviour. With constraint 1 failing there is nothing to file and no minimal fix
to prototype against resharp.

One bounded inefficiency is worth recording but is not defect-grade: the
`(?<=b\b)_*\x12\x00](8=a)\\` input spends ~0.76s (release) only to return `Err`,
a slow rejection path for a malformed 20-character pattern. It is bounded and
sub-second, so it stays a note, not a report.

### Optional fork-harness tuning

If the campaign should not flag this shape again, the change lives in the fork's
`add-fuzz` `compile` target, not in resharp. Either raise `-timeout` for that
target (one unit legitimately performs six compiles), or restructure so a unit
compiles under a single option (derive the option index from a leading input
byte), so the 10s watchdog reflects one compile. This is a harness-strategy
choice for the fork owner, left unapplied here.

### The `match_invariants` crash artifact is finding #1, not separate

`fuzz/artifacts/match_invariants/crash-bcf205a...` decodes (pattern then
haystack) to pattern `\B|,` against byte `0xAB`. That is the hardened `find_all`
zero-width soundness bug documented above and fixed in
[ieviev/resharp#13](https://github.com/ieviev/resharp/pull/13), not a distinct
defect.

### Consumer-side note

forbidden-strings rules are trusted config, not attacker input, and resharp
exposes no compile timeout to wrap. The existing `complement_intersection_
quantified_group` and `nested_lookahead_in_quantified_group` pre-validators
cover the known compile-time blowup shapes. A sub-second lookbehind or `\p{L}`
compile of this kind needs no guard: no production rule has the shape, and the
cost is bounded regardless.

---

## Bug A: `\b`, `\B`, `^`, `$` inside complement bodies fail with `Algebra(UnsupportedPattern)`

### Symptom

A rule passed to [`resharp`][resharp] 0.5.x through 0.6.x (via the
consumer crate `forbidden-strings` 0.1.0 in this workspace, but the bug
is upstream) fails at compile time when its complement body contains a
word-boundary or text-anchor assertion. The compile-time error surfaces
with one of two variants depending on which rewrite path the offending
atom takes:

```text
forbidden-strings: rule on line N (resharp): Algebra(UnsupportedPattern)
forbidden-strings: rule on line N (resharp): Parse(ParseError { kind: UnsupportedResharpRegex, ... })
```

Resharp renders `Algebra(UnsupportedPattern)` as "unsupported lookaround
pattern" (`resharp-algebra/src/lib.rs:35`); `UnsupportedResharpRegex` is
emitted by the parser when an unrewritable assertion survives the boundary-
rewriting helper. The "Verification" section below lists which surface
patterns hit which variant.

User-facing patterns that trigger the failure:

```text
/em-dash&~(.*\bnpm\b.*)/
/em-dash&~(.*\B.*)/
/em-dash&~(^foo$)/
/(?<=[a-z]) -- (?=[a-z])&_*&~(.*\b(npm|git)\b.*)/
/^.*[a-z] -- [a-z].*$&~(.*[`].*)&~(.*npm.*)&~(.*\bgh\b.*)/
```

An earlier reading suggested an "algebra ceiling" tied to alternation
count or chained-complement count.
That reading is wrong:
500 alternatives inside a single complement and 500 chained complements
both compile cleanly,
provided the bodies use literal characters or character classes.
The trigger is the presence of `\b`, `\B`, `^`, or `$` inside `~(...)`,
regardless of size.

## Root cause

Three rewriting steps in resharp turn user-visible "anchors" into
internal lookarounds,
then the symbolic-derivative reverse pass refuses to reverse a complement
whose body contains a lookaround.

### Step 1: `^` and `$` become lookarounds in default multiline mode

`resharp-parser/src/lib.rs:64` defaults `multiline` to `true`:

```rust
multiline: true,
```

In multiline mode, `^` and `$` map to `StartLine` / `EndLine`,
and the AST-to-NodeId translator rewrites them to lookarounds
(`resharp-parser/src/lib.rs:1425-1441`):

```rust
ast::AssertionKind::StartLine => {
    if !self.multiline.get() {
        return Ok(NodeId::BEGIN);
    }
    let left = NodeId::BEGIN;
    let right = tb.mk_u8(b'\n');
    let union = tb.mk_union(left, right);
    Ok(tb.mk_lookbehind(union, NodeId::MISSING))
}
ast::AssertionKind::EndLine => {
    if !self.multiline.get() {
        return Ok(NodeId::END);
    }
    let left = NodeId::END;
    let right = tb.mk_u8(b'\n');
    let union = tb.mk_union(left, right);
    Ok(tb.mk_lookahead(union, NodeId::MISSING, 0))
}
```

So `^foo$` parsed under default flags becomes
`Lookbehind(begin|nl) · foo · Lookahead(end|nl)` in the NodeId tree.

`\A` and `\z` map to `StartText` / `EndText`
(`resharp-parser/src/lib.rs:1417-1418`),
which return `NodeId::BEGIN` / `NodeId::END` directly,
bypassing the lookaround rewrite:

```rust
ast::AssertionKind::StartText => Ok(NodeId::BEGIN),
ast::AssertionKind::EndText => Ok(NodeId::END),
```

### Step 2: `\b` and `\B` become lookarounds via context rewriting

`resharp-parser/src/lib.rs:1305-1346` pre-processes `\b`/`\B`
in concatenation contexts.
It inspects the atoms to the left and right of the boundary,
classifies each as `Word`, `NonWord`, or `Unknown`,
then rewrites the boundary as a lookaround whose body asserts the opposite class
(`resharp-parser/src/lib.rs:1329-1345`):

```rust
match (left, right) {
    (NonWord, Word) | (Word, NonWord) => Ok((NodeId::EPS, idx + 1)),
    (Word, _) => {
        let neg = tb.mk_neg_lookahead(word_id, 0);
        Ok((neg, idx + 1))
    }
    (NonWord, _) => {
        let tail = tb.mk_concat(word_id, NodeId::TS);
        self.merge_boundary_with_following_lookaheads(asts, idx, tail, translator, tb)
    }
    (_, Word) => Ok((tb.mk_neg_lookbehind(word_id), idx + 1)),
    (_, NonWord) => Ok((tb.mk_lookbehind(word_id, NodeId::MISSING), idx + 1)),
    _ => Err(self.error(self.span(), ast::ErrorKind::UnsupportedResharpRegex)),
}
```

A bare `\b` that survives this helper
(for example, `\b` between two unknowns)
falls through to the generic assertion handler at
`resharp-parser/src/lib.rs:1419-1424`,
which surfaces a different error at parse time:

```rust
ast::AssertionKind::WordBoundary => {
    Err(self.error(self.span(), ast::ErrorKind::UnsupportedResharpRegex))
}
ast::AssertionKind::NotWordBoundary => {
    Err(self.error(self.span(), ast::ErrorKind::UnsupportedResharpRegex))
}
```

In the em-dash rules,
the `\b` always has a known word neighbour
(`\bnpm\b` has Word on both sides via the literal letters),
so it passes parsing and reaches the algebra layer as a lookaround pair.

### Step 3: `reverse` refuses complement-of-lookaround

DFA construction walks the NodeId tree in both directions.
The reverse pass at `resharp-algebra/src/lib.rs:2203-2281` rewrites each node.
The complement case at lines 2233-2239 is the failure site:

```rust
Kind::Compl => {
    if self.contains_look(node_id.left(self)) {
        return Err(ResharpError::UnsupportedPattern);
    }
    let body = self.reverse(node_id.left(self))?;
    self.mk_compl(body)
}
```

`contains_look` (`resharp-algebra/src/lib.rs:978-981`) is a cheap meta-flag check:

```rust
pub fn contains_look(&mut self, node_id: NodeId) -> bool {
    self.get_meta_flags(node_id)
        .has(MetaFlags::CONTAINS_LOOKBEHIND.or(MetaFlags::CONTAINS_LOOKAHEAD))
}
```

The error variant is declared at `resharp-algebra/src/lib.rs:25`
and rendered at `:35`:

```rust
UnsupportedPattern,
// ...
ResharpError::UnsupportedPattern => write!(f, "unsupported lookaround pattern"),
```

So the call chain for `em&~(.*\bnpm\b.*)` is:
parser rewrites `\b` to lookarounds (step 2),
the complement body now `contains_look`,
DFA setup calls `reverse` on the complement,
reverse hits line 2234 and returns `Err(UnsupportedPattern)`.
The render is intentionally generic ("unsupported lookaround pattern"),
which masks the surface trigger.

### Why this restriction exists

Resharp implements Brzozowski-style symbolic derivatives over a structured
node tree,
and the matching engine derives both forward and reverse derivatives during
DFA construction
(the reverse pass is invoked from `ts_rev_start` at
`resharp-algebra/src/lib.rs:2196-2201`).
Reversing a complemented language with zero-width positional constraints
is not algebraically straightforward:
De Morgan-style pushdown of the complement past a lookaround does not
preserve the lookaround's position-sensitive semantics,
because the reverse operation flips which direction "before" and "after" point.
Rather than implement a per-case reverse for each lookaround kind nested
under complement,
the codebase bails.
The same node tree without the enclosing complement reverses cleanly:
the `Kind::Lookahead` arm at lines 2251-2273 returns `Ok` for `rel == 0`
lookaheads without anomalous tails.

## Verification

Verified 2026-05-10 against `resharp 0.5.2` (crates.io checksum
`80f2ed5c008a621ce1ab18946bdca99584ed8a6c943f64dd73f7570a23ca1eb8`,
published 2026-05-09) via a synthetic Rust crate calling
`resharp::Regex::new` directly on each pattern, and against `resharp 0.5.1`
via the forbidden-strings 0.1.0 release binary
(`packages/cli/forbidden-strings/target/release/forbidden-strings`).
The `0.5.1`-to-`0.5.2` upstream delta is streaming/seeking, aarch64+wasm
build targets, and a prefix-engine bugfix; none touch the `Kind::Compl`
arm of `reverse`, which lives at `resharp-algebra/src/lib.rs:2234-2235`
in 0.5.2 (previously quoted as `:2233-2239` against an earlier checkout;
slight line drift only).

Re-verified 2026-05-16 against `resharp 0.6.0` (published 2026-05-15)
via the same probe path. The `Kind::Compl` arm of `reverse` and the
parser rewrites at `resharp-parser/src/lib.rs:1305-1346`,
`:1419-1424`, and `:1425-1441` are all unchanged in 0.6.0.

Re-verified 2026-05-23 against published `resharp 0.6.3` and against git
HEAD `e0b8aba`. The complement-of-lookaround reject still fires for every
complement-body shape below; the behaviour is unchanged, only the source
lines drifted. At HEAD the reverse-pass `Kind::Compl` arm that returns
`UnsupportedPattern` is at `resharp-algebra/src/lib.rs:2242-2243`
(was `:2234-2235` in 0.6.0), `contains_look` is at `:979`, and the
`UnsupportedPattern` variant and its render are at `:25` and `:35`. The
parser rewrites drifted substantially: the boundary rewrite is around
`resharp-parser/src/lib.rs:1456-1491`, the generic word-boundary reject
at `:1562-1569`, and the multiline `^`/`$` rewrite at `:1577-1586`
(the `913c9fe accept more patterns`, `d1d560e javascript word boundary`,
and `ec54529 auto-rewrite more unsupported patterns` commits added new
`WordBoundary*` assertion kinds at `:1595-1610`).

Two patterns the earlier write-up listed wrongly were corrected during
this pass after testing them against both 0.6.0 and 0.6.3 (identical in
both, so neither is a 0.6.x change):

- `/(?=^foo)bar/` compiles cleanly (it was listed under parser-layer
  rejects). The `^` inside a lookahead body does not break compilation.
- `/em.*\bword\b/` does NOT compile; it fails with
  `Algebra(UnsupportedPattern)` because the `\b` rewrite produces a
  negative lookbehind / lookahead that the reverse pass then refuses.
  The "move the boundary outside the complement" workaround below is
  therefore not reliable and is annotated accordingly.

Test harness (binary route):

```bash
cd /tmp
touch probe-input.txt
FS=/var/home/user/Monochromatic/packages/cli/forbidden-strings/target/release/forbidden-strings
echo '<rule>' > probe-rule.txt
$FS --rules probe-rule.txt probe-input.txt
echo "EXIT=$?"   # 0: compile + scan OK; 2: rule error
```

Test harness (synthetic crate, exact error variant):

```toml
# /tmp/resharp052-repro/Cargo.toml
[package]
name = "resharp052_repro"
version = "0.0.0"
edition = "2021"
[dependencies]
resharp = "=0.5.2"
```

```rust
// /tmp/resharp052-repro/src/main.rs
use resharp::Regex;
fn main() {
    for src in [r"em&~(.*\bword\b.*)", r"em&~(.*\B.*)", r"em&~((?=foo).*)"] {
        match Regex::new(src) {
            Ok(_)  => println!("OK    {}", src),
            Err(e) => println!("ERR   {}\t{:?}", src, e),
        }
    }
}
```

### Rules that compile cleanly

- `/em&~(.*foo.*)/` (simple literal in complement body)
- `/em&~((?i)foo)/`, `/em&~([a-z]+)/`, `/em&~(.*[^a-z].*)/` (other features in complement body)
- `/em&~(\Afoo\z)/` (`\A`/`\z` text anchors inside complement; no lookaround rewrite).
  At 0.6.3 only: 0.6.8 now rejects this with `Algebra(UnsupportedPattern)`
  (see "Bump to resharp 0.6.8"), so the `\A`/`\z` workaround below no longer
  compiles.
- `/em\b/`, `/\bem\b&_*/`, `/\bem\b&_*&~(.*foo.*)/` (`\b` outside complement body)
- `/(?=\bem\b).*/` (`\b` inside a lookaround body, not inside a complement)
- 500 alternatives in a single `~(.*(w0|w1|...|w499).*)` with simple bodies
- 500 chained `&~(.*w0.*)&~(.*w1.*)&...&~(.*w499.*)`

### Rules that fail with `Algebra(UnsupportedPattern)` (algebra-layer reject)

Patterns whose offending atom is rewritten to a lookaround by the parser
but then refused by `reverse` at the `Kind::Compl` arm:

- `/em&~(.*\bnpm\b.*)/`, `/em&~(.*\bnpm.*)/`, `/em&~(.*npm\b.*)/`
  (`\b` in complement body, with a known word-class neighbour so the
  boundary rewrite succeeds and produces a lookaround pair)
- `/em&~(^foo$)/`, `/em&~(\Afoo$)/`, `/em&~(^foo\z)/`
  (default-multiline `^`/`$` rewritten to `Lookbehind`/`Lookahead`)
- `/em&~((?=foo).*)/`
  (user-explicit lookahead inside complement, no `\b`/`^`/`$` involved;
  proves the restriction is "lookaround in complement" generally, not
  word-boundary syntax specifically)

### Rules that fail with `Parse(UnsupportedResharpRegex)` (parser-layer reject)

Patterns where the parser's boundary-rewriter helper cannot classify the
atom's neighbours or the assertion sits in a lookaround body where the
rewrite chain is wired against the surrounding flag state:

- `/em&~(.*\B.*)/`
  (`\B` between two `.*` atoms; both neighbours classify as Unknown so
  the boundary-rewrite helper around `resharp-parser/src/lib.rs:1456-1491`
  falls through to the generic assertion handler at `:1562-1569`, which
  rejects bare `\B` outright)
- `/(?<=\b)foo/`
  (`\b` in a lookbehind body with no neighbouring word-class atom)

`/(?=^foo)bar/` was previously listed here but compiles cleanly in 0.6.0,
0.6.3, and HEAD; it is not a parser-layer reject. See the correction note
in the Verification section above.

The earlier "alternation count" / "seven chained complements" framing was a misdiagnosis:
every observed failing case contained a lookaround-introducing assertion in a complement or lookaround body,
and the count axis had no measured ceiling within practical bounds.

## Verified workarounds

### Replace `\b` with literal whitespace inside complement bodies

```text
# fails
/^.*[a-z] -- [a-z].*$&~(.*(\bnpm\b|\bgit\b).*)/

# compiles
/^.*[a-z] -- [a-z].*$&~(.* (npm|git) .*)/
```

Tradeoff: tokens at line start or line end are not bracketed by literal spaces
and slip through the exclusion.
For prose scans where the excluded tokens are toolchain names appearing
mid-line, this is acceptable.

### Replace `\b` with `\W` character class inside complement bodies

```text
# fails
/em&~(.*\bnpm\b.*)/

# compiles
/em&~(.*\Wnpm\W.*)/
```

Tradeoff: `\W` consumes a character on each side,
so the complement matches strings whose `npm` is bracketed by non-word characters
rather than just bordered by a word boundary.
Tokens at the absolute start or end of the scanned content
(no character before or after) still slip through.

### Use `\A`/`\z` instead of `^`/`$` inside complement bodies (broken at 0.6.8)

This workaround compiled at 0.6.3 but no longer compiles at 0.6.8:

```text
# fails (0.6.3 and 0.6.8)
/em&~(^foo$)/

# compiled at 0.6.3; rejected at 0.6.8 with Algebra(UnsupportedPattern)
/em&~(\Afoo\z)/
```

When it did compile, the semantics shifted from "any line whose entirety is
`foo`" to "the entire scanned content is exactly `foo`", useful only when
the rule already scans whole-file content rather than per-line. At 0.6.8 the
unsupported-pattern tightening (commit `b552bc7`) rejects `\A`/`\z` inside a
complement too, so use the literal-whitespace or `\W` substitutions above
instead (those still compile at 0.6.8). See "Bump to resharp 0.6.8".

### Move the boundary check outside the complement (does not reliably work)

Lifting `\bword\b` out of `~(...)` into the main concatenation was once
recorded as a workaround, but it does not compile:

```text
# fails: Algebra(UnsupportedPattern)
/em&~(.*\bword\b.*)/

# also fails: Algebra(UnsupportedPattern) (verified in 0.6.0, 0.6.3, HEAD)
/em.*\bword\b/
```

A `\b` adjacent to a word-class atom still rewrites to a negative
lookbehind / lookahead, and `em.*` ahead of it forces the reverse pass
over a lookaround-bearing subtree, which hits the same
`UnsupportedPattern` reject. Prefer the literal-whitespace or `\W`
substitutions inside the complement body (above), which keep the rewrite
out of a reverse-over-lookaround position.

## What does not work

- **Splitting one complement across multiple rules.**
  Forbidden-strings combines rules via union,
  so any rule firing flags the line.
  Splitting makes detection more permissive, not less.
- **Inline `(?-m)` flag to disable multiline.**
  `/(?-m)em&~(^foo$)/` and variants still fail.
  The flag does not propagate into the complement body's parse context
  in the configurations tested, and the rewrite at
  `resharp-parser/src/lib.rs:1425-1441` runs against the surrounding
  flag state, not a locally-scoped override that reaches the assertion.
  Use `\A`/`\z` instead.
- **Wrapping the complement body in a non-capturing group with flag modifiers.**
  `/em&~((?-m:^foo$))/` fails identically;
  the `^`/`$` rewrite happens at AST translation, before the group's flag
  scope is applied to its children's positional semantics.

## Draft upstream issue (DO NOT FILE without an architectural prototype)

### Why we do not file this upstream

This repo's policy is to report an issue upstream only when ALL of the
following hold: we are absolutely sure it is the upstream's fault, they
can fix it, they are supporting the use case, they are likely to fix it,
and we have already prototyped a minimal fix compatible with their
architecture. Every reported issue that does not satisfy all five is
treated as a publicity incident.

Walking the five constraints against the resharp complement-of-lookaround
restriction:

1. **Is it really upstream's fault?** Mostly no. The restriction is
   architectural. Brzozowski-style symbolic derivatives do not compose
   naturally with position-sensitive constraints under reversal; this
   doc's "Why this restriction exists" section spells out the algebraic
   reason. The default-multiline `^`/`$` rewrite and the `\b` to
   lookaround rewrite are defensible parser choices that interact badly
   with the architectural restriction; the badness lives in the
   interaction, not in any single decision. The only narrow surface-
   quality grievance is the generic "unsupported lookaround pattern"
   string not naming the trigger, but that is wording, not behaviour.

2. **Can upstream fix it?** Partially. Positive-lookaround reverse cases
   are tractable via De Morgan body inversion; negative-lookaround
   reverse cases require preserving position-sensitive match-set
   semantics through the complement structure, which is non-trivial work
   touching the algebraic core. Not a 1-line change.

3. **Are they supporting this use case?** No documented signal. The
   crate's stated value proposition is "high-performance regex engine
   with intersection and complement operations." Lookarounds-in-
   complement sits at the intersection of two features that compose
   poorly; no upstream doc, example, or test shows the combination as
   expected to work.

4. **Will they likely fix it?** Upstream signal points the other way.
   Commit `e9676b4 2026-04-19 rejecting unsupported patterns, more
   tests` shows the project scoping DOWN what is supported; commit
   `b256ea8 2026-04-24 rewrite negative lookaheads on construction`
   moved lookaround handling in a different direction (construction-
   time rewrites). The 0.5.1 to 0.5.2 delta was orthogonal (streaming/
   seeking, platform builds, prefix-engine bugfix). No movement on
   complement-of-lookaround in the visible history.

5. **Have we prototyped a minimal fix?** No. The "Suggested fix"
   section below is speculative design with no code, no correctness
   argument, no test against any nontrivial rule set.

We fail constraints 1, 4, and 5 clearly; 2 and 3 are equivocal at best.
The decision is to not file the behavioural fix upstream.

One part was separable and shipped: suggested fix 2 below (improve the
error message to name the surface trigger) is a wording change, not an
algebra change, so it cleared constraint 5 trivially and was folded into
the merged upstream issue
[ieviev/resharp#5](https://github.com/ieviev/resharp/issues/5); the
maintainer shipped the improved render string in 0.6.4. Only the
behavioural fix (actually supporting complement-of-lookaround), which
would touch the algebraic core, stays unaddressed; the behaviour is
unchanged through 0.6.8 (the shape still rejects), and it is the single
Bug A item still held back.

The consumer-side workaround is implemented in `forbidden-strings` as a
parse-time guard (`engine::lookaround_in_complement`) that rejects every
failing shape with a named-trigger error pointing to this doc. That
solves the user-facing problem at our boundary, where it actually
matters for us. The draft below is kept as a reference in case the
underlying situation changes (e.g., upstream announces complement-of-
lookaround as supported, or someone in the project lands a prototype
fix and asks for community testing). Re-evaluating the five constraints
must precede any filing.

### Draft (do not file as-is)

Title: `Algebra(UnsupportedPattern)` for `\b`, `\B`, `^`, `$` inside
complement bodies; error string ("unsupported lookaround pattern") does
not mention the surface trigger

Labels: `bug`, `parser`, `documentation`

````md
## Description

Patterns of the form `A&~(B)` where `B` contains `\b`, `^`, `$`, or any
user-written lookaround fail at compile time with
`ResharpError::UnsupportedPattern`, rendered as "unsupported lookaround
pattern". Patterns where `B` contains `\B` (or where `\b`/`^` sit inside
a lookaround body that the parser cannot rewrite) instead fail with a
parse-layer `UnsupportedResharpRegex`. Neither error message names the
surface trigger.

The root cause chain:

1. The parser rewrites `^`/`$` to lookbehind/lookahead in default
   multiline mode (`resharp-parser/src/lib.rs:1425-1441`).
2. The parser rewrites `\b` to negative-lookahead / negative-lookbehind
   based on adjacent-atom classification
   (`resharp-parser/src/lib.rs:1305-1346`). When the helper cannot
   classify a `\b` or `\B` neighbour, the assertion falls through to
   the generic handler at `:1419-1424`, which rejects it with
   `UnsupportedResharpRegex`.
3. The reverse pass refuses to reverse a complement whose body contains
   any lookaround (`resharp-algebra/src/lib.rs:2234-2235`).

Legibility issue: a user writing `em&~(.*\bnpm\b.*)` has not written a
lookaround anywhere in the surface syntax, so the error "unsupported
lookaround pattern" is not actionable. A user writing
`em&~(.*\B.*)` gets a different error variant for the same conceptual
problem, fragmenting the symptom across two log surfaces.

## Reproduction

Against `resharp 0.5.2`:

```rust
use resharp::Regex;

// These four fail with Err(Algebra(UnsupportedPattern))
let _ = Regex::new(r"em&~(.*\bword\b.*)");
let _ = Regex::new(r"em&~(^foo$)");
let _ = Regex::new(r"em&~(\Afoo$)");
let _ = Regex::new(r"em&~((?=foo).*)");  // user-explicit lookaround in complement

// These two fail with Err(Parse(UnsupportedResharpRegex))
let _ = Regex::new(r"em&~(.*\B.*)");
let _ = Regex::new(r"(?<=\b)foo");
// NOTE: (?=^foo)bar compiles cleanly in 0.6.0/0.6.3/HEAD; do not include
// it as a failing case (the earlier draft listed it in error).
```
````

```rust
// These compile fine, demonstrating the trigger is positional, not size:
let _ = Regex::new(r"em&~(.*foo.*)").unwrap();
let _ = Regex::new(r"em&~(\Afoo\z)").unwrap();
let _ = Regex::new(r"em\b&_*&~(.*foo.*)").unwrap();
// 500 alternatives in a single complement compile cleanly
// 500 chained `&~(...)` complements compile cleanly
```

## Why this matters

Resharp's set algebra is the feature that makes complement-style
exclusion rules tractable; the rule shape `A&~(B)` is the primary use
case for choosing resharp over the standard `regex` crate. The natural
way to write "match A but not when bordered by token X" is
`A&~(.*\bX\b.*)`, and that fails opaquely. Users without algebra-layer
familiarity reach for alternation count or chain count as the suspected
trigger and report the wrong limit upstream.

## Suggested fix

Either of:

1. Lift the "no lookaround inside complement" restriction by handling
   the four lookaround reverse cases (`Kind::Lookahead` / `Kind::Lookbehind`,
   positive / negative) inline at the `Kind::Compl` arm of `reverse`
   (`resharp-algebra/src/lib.rs:2233`). Positive lookarounds can be
   pushed through De Morgan with body inversion; negative lookarounds
   require ensuring the complement structure of position-sensitive
   match-set semantics is preserved.

2. At minimum, improve the error message to name the surface trigger.
   `UnsupportedPattern` should distinguish "complement contains
   lookaround (introduced by `\b`/`\B`/`^`/`$` rewrite)" from
   "complement contains unhandled counted repetition" so users can map
   the error to a workaround without reading the algebra source.

## Workaround

Replace `\b` with literal whitespace or `\W` inside complement bodies;
use `\A`/`\z` in place of `^`/`$` when whole-content semantics are
acceptable. Move boundary assertions to the match site outside the
complement when the rule's intent permits.

---

## 2026-05-25 follow-up pass (resharp 0.6.4)

This pass read the current published source (resharp 0.6.4, crates.io
`max_version` 0.6.4 published 2026-05-23T15:24:24Z; git HEAD `9b324ff`, the
0.6.4 `bump ver` commit plus a readme commit) to flag issues beyond Bugs A
through F. It targeted the classes drawn from the A through F root causes
(unbounded loops, postcondition `debug_assert!`s that fail open in release,
unchecked arithmetic) plus a new class, unbounded recursion, and parser
robustness against malformed input.

Probe crates ran under `podman run --memory=4g --cpus=4 --rm` against
`resharp = "=0.6.4"`, each pattern in its own subprocess wrapped in
`timeout` so a crash, hang, or panic is isolated and observable by exit
code (0 returned, 101 panic, 124 hang, 134 abort or stack overflow, 139
segfault).

Scope: this pass surveys compile-time behaviour (`Regex::new`) and parser
robustness against malformed patterns. Match-time soundness against
adversarial input (the class the former Bug B belonged to) is not re-probed
here; it is left to a fuzz re-run on the published build, a recommended
next step.

### Negative results (parser robustness)

About 50 malformed or adversarial patterns compile to a clean
`Err(ParseError { ... })` with no panic, abort, or hang. Tested shapes
include unterminated and nested character classes (`[`, `[[`, `[a[b]]`,
`[a&&[b]]`), POSIX-style class names (`[[:alpha:]]`, `[[:foo:]]`,
`[[.ch.]]`, `[[=a=]]`), reversed and mixed ranges (`[z-a]`, `[a-\d]`),
partial groups and lookarounds (`(?`, `(?P<`, `(?<=`), invalid Unicode
classes (`\p{Foo}`, `\P{}`), out-of-range hex (`\x{110000}`),
backreferences (`\0`, `\700`), and invalid repetition (`a{2,1}`, `a{`).
The `panic!` sites in `resharp-parser/src/lib.rs` at `:906`, `:907`,
`:929`, and the `unreachable!` at `:1344` are internal invariants guarded
by parser structure; none are reachable from the surface inputs probed.
The `[[:foo:]]` case returning `Ok` (an unknown POSIX class name treated as
literal characters rather than rejected) is a minor leniency quirk, not a
soundness issue.

## Bug G: deeply nested complement or lookaround patterns abort `Regex::new` with an uncatchable stack overflow

### Symptom

A rule whose pattern nests complement (`~(...)`) or lookaround (`(?=...)`,
`(?<=...)`) groups deeply enough aborts the process during
`resharp::Regex::new`:

```text
thread 'main' has overflowed its stack
fatal runtime error: stack overflow, aborting
```

The abort is a stack overflow (SIGABRT, exit 134), not an arithmetic
overflow panic and not the `expanded_ast_limit` rejection. The depth at
which it fires depends on the build profile, and the two profiles diverge
in a way that matters for forbidden-strings:

- Release profile (forbidden-strings' scanner, small stack frames):
  `~(...)` and `(?=...)` nested past 20,000 to 30,000 levels overflow and
  abort (verified Ok at 20,000, abort at 30,000). This is below the
  `expanded_ast_limit` of 50,000, so the
  parser's size guard never rejects the pattern first. Plain capturing
  groups `(...)` and non-capturing groups `(?:...)` do NOT overflow in
  release: they survive to about 50,000 levels, where the size guard
  rejects them cleanly with `Parse(UnsupportedResharpRegex)`.
- Debug profile (the forbidden-strings package's `cargo test` and fuzz targets,
  large stack frames): every nesting kind, including plain `(...)`, overflows at
  about 1,500 levels, below every size guard.

So in release the dangerous shapes are complement and lookaround nesting,
the constructs forbidden-strings uses for exclusion rules; in debug and
under fuzzing, any deeply nested group triggers it.

### Root cause

resharp's parser deliberately avoids recursion for the parse itself: it
drives a flat loop in `parse_inner` (`resharp-parser/src/lib.rs:1847-1851`)
that pushes and pops an explicit open-group stack (`stack_group`, e.g.
`resharp-parser/src/lib.rs:708` for `(` and `:745` for `~(`):

```rust
match self.char() {
    '(' => concat = self.push_group(concat)?,
    ')' => concat = self.pop_group(concat)?,
    '|' => concat = self.push_alternate(concat)?,
    '&' => concat = self.push_intersect(concat)?,
    '~' => concat = self.push_compl_group(concat)?,
    // ...
}
```

The recursion that overflows lives in the passes that walk the resulting
tree, none of which bound depth:

1. `expanded_ast_size` (`resharp-parser/src/lib.rs:2872`), the very guard
   that enforces `expanded_ast_limit`, recurses on AST depth and runs at
   `resharp-parser/src/lib.rs:1876` before it can return the size that
   would trip the limit:

   ```rust
   ast::Ast::Group(g) => go(&g.ast, limit).saturating_add(1).min(limit),
   ast::Ast::Complement(c) => go(&c.ast, limit).saturating_add(1).min(limit),
   ast::Ast::Lookaround(l) => go(&l.ast, limit).saturating_add(1).min(limit),
   ```

   The arithmetic is saturating (overflow-safe), but the recursion depth is
   not bounded. For a pattern nested N deep, `go` recurses N frames.

2. The AST-to-NodeId translation (`ast_to_node_id`) recurses on the AST
   (the `Group`, `Complement`, `Lookaround`, and `Repetition` arms each
   call back into themselves).

3. The algebra tree-walks recurse on NodeId depth, for example
   `get_bounded_length` (`resharp-algebra/src/lib.rs:1051`):

   ```rust
   Kind::Concat => {
       let (lmin, lmax) = self.get_bounded_length(node_id.left(self));
       let (rmin, rmax) = self.get_bounded_length(node_id.right(self));
       (lmin + rmin, lmax.saturating_add(rmax))
   }
   ```

   `reverse`, `der`, and `contains_look` are recursive on the same trees.

4. The nested AST (a tree of boxed enums) and the NodeId tree drop
   recursively, so even an all-iterative analysis would overflow on `Drop`
   for a deep enough tree.

`PatternFlags` exposes `multiline`, `expanded_ast_limit`, `max_list_len`,
and `max_repeat` (`resharp-parser/src/lib.rs:37-50`) but no `max_depth`, so
nothing caps nesting depth.

### Why complement and lookaround overflow below the size limit but plain groups do not (release)

A capturing `(...)` or non-capturing `(?:...)` group introduces no distinct
algebra node: `(a)` compiles to the same node as `a`, so the NodeId tree for
`((((a))))` collapses to `a` and stays shallow. The only
deep recursion is then `expanded_ast_size` over the deep AST, whose release
frames are small enough to reach the 50,000 size limit before the stack
runs out (confirmed: `group` returns `Ok` at depth 49,000 in release and is
only stopped by the limit at 60,000). `~(...)` and `(?=...)` build genuine
`Compl` and `Lookahead` nodes, so the NodeId tree is itself N deep and the
heavier algebra passes (`get_bounded_length`, `reverse`, `der`,
`contains_look`) plus the recursive `Drop` run over it; their larger
per-level stack cost overflows between 20,000 and 30,000 levels, below the
size limit. In debug, frames are large enough that even `expanded_ast_size`
overflows at about 1,500 levels for every nesting kind.

### Defense

forbidden-strings has no nesting-depth pre-validator. The six existing
pre-validators in `packages/cli/forbidden-strings/src/rules/engine.rs`
cover lookaround-in-complement, the two intersection shapes, the
alternation-sibling shape, complement-intersection-quantified-group, and
nested-lookahead-in-quantified-group, none of them depth. The
`catch_unwind` net in `compile_rule_src` does not help: a stack-overflow
abort is SIGABRT, which unwinding cannot intercept.

The durable consumer-side fix is a `nesting_depth` pre-validator that
byte-scans the rule source, tracks maximum `(` / `~(` / `(?...` nesting
depth, and rejects any rule above a safe cap well below both thresholds
(for example 1,000, under the debug 1,500 and release 20,000 floors and
under `expanded_ast_limit`). This matches the existing pre-validator shape:
a cheap source-text scan that rejects before resharp sees the rule,
fail-closed and safe to over-reject because the production corpus has no
deeply nested rules. A complementary mitigation is to run `Regex::new` on a
thread with a large explicit stack, but that only moves the finite ceiling;
the pre-validator is the actual fix.

Update (2026-06-03, resharp 0.6.8): this pre-validator is now IMPLEMENTED in
`packages/cli/forbidden-strings/src/rules/nesting.rs` (cap 1,000), wired as
the first check on the resharp path in `compile_rule_src`, with tests in
`nesting_tests.rs`. Bug G itself is unchanged at 0.6.8 (no `max_depth`
upstream), and the release `compl` overflow floor dropped to at-or-below
20,000 levels (`compl 20000` now aborts; it returned `Ok` at 0.6.4), so the
heavier algebra walks cost more stack per level. The cap of 1,000 is still
comfortably below that floor. The upstream `max_depth` patch was re-validated
against 0.6.8 but not filed; see "Now-unblocked follow-ups" under "Bump to
resharp 0.6.8".

### Verification

Probe crate `Cargo.toml`:

```toml
# /tmp/resharp-probe/Cargo.toml
[package]
name = "probe"
version = "0.0.0"
edition = "2021"
[dependencies]
resharp = "=0.6.4"
[profile.release]
overflow-checks = true
panic = "unwind"
```

The probe builds a pattern from a kind and a depth N, prints `START` before
the call, then prints the `Regex::new` result, so a crash still shows which
input was in flight:

```rust
// /tmp/resharp-probe/src/main.rs (shape)
// "group" => "(".repeat(n)  + "a" + ")".repeat(n)
// "compl" => "~(".repeat(n) + "a" + ")".repeat(n)
// "look"  => "(?=".repeat(n) + "a" + ")".repeat(n)
// "ncg"   => "(?:".repeat(n) + "a" + ")".repeat(n)
match resharp::Regex::new(&pat) {
    Ok(_) => println!("OK   {kind} n={n}"),
    Err(e) => println!("ERR  {kind} n={n} {e:?}"),
}
```

Each `(kind, N)` runs as `timeout 20 ./probe <kind> <N>` so an abort is
isolated. Results:

Debug profile (`cargo build`):

- `group` returns `Ok` at N=1,400; aborts (exit 134, "overflowed its
  stack") at N=1,600. Threshold is about 1,500.
- `compl`, `look`, `ncg` all return `Ok` at N=1,000 and abort by N=5,000.

Release profile (`cargo build --release`, matching forbidden-strings):

- `group` and `ncg` return `Ok` through N=49,000, then return
  `Err(Parse(UnsupportedResharpRegex))` at N=60,000 and N=100,000 (the size
  guard rejects, no overflow).
- `compl` and `look` return `Ok` through N=20,000, then abort (exit 134,
  "overflowed its stack") at N=30,000, N=40,000, N=49,000, then return
  `Err` at N=60,000. The abort window sits below the size-guard rejection
  point, so deep complement and lookaround nesting overflows before the
  guard can reject it.

The release abort message captured directly:

```text
=== compl 30000 (release) exit=134 ===
thread 'main' (3) has overflowed its stack
fatal runtime error: stack overflow, aborting
```

### Suggested upstream fix

Add a `max_depth` to `PatternFlags` (default in line with the other limits)
and enforce it during parsing using the open-group stack the parser already
maintains: reject when `stack_group` depth (plus complement and lookaround
nesting) exceeds `max_depth`. Enforcing at parse time stops the deep AST
from ever being built, which heads off `expanded_ast_size`, the translation
pass, the algebra walks, and the recursive `Drop` at once. This is small and
scoped (a single counter check in `parse_inner`'s loop against
`stack_group.borrow().len()`, the nesting depth the parser already tracks)
and architecturally consistent with the existing `max_repeat`,
`max_list_len`, and `expanded_ast_limit` guards.

### Prototype fix (verified 2026-05-25)

Prototyped in a fresh `mktemp -d` clone of
`https://github.com/ieviev/resharp` (origin and HEAD `9b324ff`, version
0.6.4, both confirmed before editing). The 16-line patch adds a `max_depth`
to `PatternFlags` (default 1,000) and checks the open-group stack depth once
per `parse_inner` loop iteration, rejecting before the deep AST is built.
The 1,000 default sits below the debug stack-overflow floor of about 1,500,
so the deepest AST ever constructed cannot overflow even on `Drop`; the
`unbounded_size` option path sets `max_depth` to `usize::MAX`, preserving
the existing escape hatch.

```diff
diff --git a/resharp-engine/src/lib.rs b/resharp-engine/src/lib.rs
@@ -841,6 +841,11 @@ impl Regex {
             } else {
                 resharp_parser::DEFAULT_MAX_REPEAT
             },
+            max_depth: if opts.unbounded_size {
+                usize::MAX
+            } else {
+                resharp_parser::DEFAULT_MAX_DEPTH
+            },
         };
         let node = resharp_parser::parse_ast_with(&mut b, pattern, &pflags)?;
         Self::from_node_inner(b, node, opts, pattern.len())
diff --git a/resharp-parser/src/lib.rs b/resharp-parser/src/lib.rs
@@ -48,6 +48,10 @@ pub struct PatternFlags {
     pub max_list_len: usize,
     /// max upper bound on bounded repetition `{n,m}`. default 500.
     pub max_repeat: u32,
+    /// max nesting depth of groups, complements, and lookarounds before the
+    /// parser rejects the pattern. default 1_000. bounds the recursion in the
+    /// AST and algebra tree-walks and in `Drop`, which are otherwise unbounded.
+    pub max_depth: usize,
 }
@@ -55,6 +59,7 @@ pub struct PatternFlags {
 pub const DEFAULT_MAX_REPEAT: u32 = 500;
 pub const DEFAULT_EXPANDED_AST_LIMIT: u64 = 50_000;
 pub const DEFAULT_MAX_LIST_LEN: usize = 4_000;
+pub const DEFAULT_MAX_DEPTH: usize = 1_000;
 
 impl Default for PatternFlags {
     fn default() -> Self {
@@ -69,6 +74,7 @@ impl Default for PatternFlags {
             expanded_ast_limit: DEFAULT_EXPANDED_AST_LIMIT,
             max_list_len: DEFAULT_MAX_LIST_LEN,
             max_repeat: DEFAULT_MAX_REPEAT,
+            max_depth: DEFAULT_MAX_DEPTH,
         }
     }
 }
@@ -275,6 +281,7 @@ pub struct ResharpParser<'s> {
     expanded_ast_limit: u64,
     max_list_len: usize,
     max_repeat: u32,
+    max_depth: usize,
     comments: RefCell<Vec<ast::Comment>>,
@@ -401,6 +408,7 @@ impl<'s> ResharpParser<'s> {
             expanded_ast_limit: flags.expanded_ast_limit,
             max_list_len: flags.max_list_len,
             max_repeat: flags.max_repeat,
+            max_depth: flags.max_depth,
             comments: RefCell::new(vec![]),
@@ -1871,6 +1879,9 @@ impl<'s> ResharpParser<'s> {
                 }
                 _ => concat.asts.push(self.parse_primitive()?.into_ast()),
             }
+            if self.parser().stack_group.borrow().len() > self.max_depth {
+                return Err(self.error(self.span(), ast::ErrorKind::UnsupportedResharpRegex));
+            }
         }
         let ast = self.pop_group_end(concat)?;
```

Verification used a probe with a path dependency on the patched clone, run
under `podman run --memory=4g --cpus=4 --rm` in debug and release:

- The pre-patch aborts become clean rejections: `group` at depth 2,000,
  `compl` at 30,000, and `look` at 30,000 all return
  `Err(Parse(UnsupportedResharpRegex))` (exit 0) instead of aborting (exit
  134), in both profiles.
- The cap boundary is exact and uniform across nesting kinds: `group`,
  `compl`, `look`, and `ncg` all return `Ok` at depth 999 and `Err` at
  1,001 (the check reads the shared `stack_group` depth).
- Real rules still compile: `~(.*foo.*)`, `(?=bar)baz`, and
  `em&~(.* (npm|git) .*)` all return `Ok`.
- No abort (exit 134) at any probed input post-patch.

Regression: `cargo test --workspace --no-fail-fast` against the clone is
`235 passed; 0 failed; 19 ignored` both with the patch and with it stashed
(`git stash`), so the change is purely additive. resharp has no `build.rs`,
so the run executed no upstream build scripts; it ran in the same capped
container.

### Five-constraint upstream-filing check (Bug G)

1. Upstream's fault? Yes. A parser-reachable pattern that aborts the
   process via stack overflow, below the size guard meant to bound resource
   use, is a defect. The crate already bounds repeat count, list length,
   and expanded size; depth is the missing dimension.
2. Can upstream fix it? Yes, and the change is small (the parse-time
   `max_depth` check above) because the parser already tracks open-group
   depth on `stack_group`.
3. Supporting this use case? Partially. Deep nesting is not a headline
   feature, but the existing limit set shows the project intends to bound
   pathological patterns rather than crash on them.
4. Likely to fix? Plausible. The project actively adds limits and was
   responsive on the merged issue (0.6.4 shipped same-day). A depth limit
   fits the established pattern. Tracker checked 2026-05-25 (`gh issue list
   -R ieviev/resharp --state all`): five issues total, none touching
   nesting depth, recursion, or stack overflow (#5 is the merged
   DFA-construction issue, #4 is a syntax discussion, #1 through #3 are
   unrelated), so Bug G is not a duplicate.
5. Prototyped a minimal fix? Yes, 2026-05-25. The 16-line parse-time
   `max_depth` patch in the "Prototype fix" subsection above moves the abort
   to a clean `Err(UnsupportedResharpRegex)` in debug and release, holds an
   exact cap boundary (depth 999 compiles, 1,001 rejects), leaves real rules
   compiling, and is regression-clean (`235 passed; 0 failed; 19 ignored`
   both with and without it).

All five constraints now pass, so the draft below is fileable. Per the
2026-05-25 decision it is not filed yet: the upstream fix and the
consumer-side depth pre-validator both wait for the next upstream release
bump (the maintainer's "coming days" follow-up that re-allows the restricted
lookbehind-in-intersection patterns), folding Bug G into a single
bump-and-re-fuzz pass. Re-run `git apply --check` of the prototype diff
against that release before filing, since resharp's `main` moves fast.

Update (2026-06-03): that release bump happened (0.6.3 to 0.6.8), so the
wait is over and the draft is unblocked. Bug G is still unfixed at 0.6.8
(constraint re-check is unchanged: `max_depth` was not upstreamed). Tracker
re-checked 2026-06-03 (`gh issue list -R ieviev/resharp --state all`): the
tracker grew to 11 issues, including a wave of correctness and UB reports
(#7 through #10) fixed across 0.6.6 to 0.6.8 and a closed #11 "Building basic
regex uses 10+ GB of RAM and takes forever". None is the deep-nesting
stack-overflow abort: #11 is a separate memory and time blowup, not a stack
overflow, and the rest are unrelated, so Bug G is still not a duplicate.
Before filing, re-run `git apply --check` of the prototype `max_depth` diff
against the 0.6.8 source, since it moved since 0.6.4. Filing is a shared-state
action and is held for explicit go-ahead.

### Draft upstream issue (Bug G, fileable, held until the next bump)

````md
**Title:** stack overflow aborts `Regex::new` on deeply nested complement
or lookaround patterns, below `expanded_ast_limit`

**Labels:** `bug`, `parser`, `engine`

## Description

`resharp::Regex::new` aborts the process with a stack overflow on patterns
that nest complement (`~(...)`) or lookaround (`(?=...)`, `(?<=...)`) groups
deeply:

```text
thread 'main' has overflowed its stack
fatal runtime error: stack overflow, aborting
```

In release this fires at about 25,000 to 30,000 levels of `~(...)` or
`(?=...)`, which is below the `expanded_ast_limit` of 50,000, so the size
guard never rejects the pattern first. In debug (and under cargo-fuzz,
which builds with a large stack) every nesting kind including plain `(...)`
overflows at about 1,500 levels. A stack-overflow abort is SIGABRT, so a
`catch_unwind` around `Regex::new` cannot intercept it.

The parser avoids recursion for the parse itself (the flat `parse_inner`
loop over an explicit `stack_group`), but the passes that walk the
resulting tree do not bound depth: `expanded_ast_size`
(`resharp-parser/src/lib.rs:2872`, the guard that enforces
`expanded_ast_limit`), the AST-to-NodeId translation, the algebra
tree-walks such as `get_bounded_length` (`resharp-algebra/src/lib.rs:1051`),
`reverse`, `der`, and `contains_look`, and the recursive `Drop` of the
nested AST and NodeId trees. `PatternFlags` bounds repeat count, list
length, and expanded size, but not nesting depth.

## Reproduction

```rust
use resharp::Regex;

// release: aborts (stack overflow) around depth 25_000-30_000
let pat = "~(".repeat(30_000) + "a" + &")".repeat(30_000);
let _ = Regex::new(&pat);

// debug / cargo-fuzz: aborts around depth 1_500 for any nesting kind
let pat = "(".repeat(2_000) + "a" + &")".repeat(2_000);
let _ = Regex::new(&pat);
```

## Suggested fix

Add a `max_depth` to `PatternFlags` (default 1,000, below the debug
stack-overflow floor) and reject during parsing using the open-group stack
the parser already maintains, so the deep AST is never built. This heads off
`expanded_ast_size`, the translation pass, the algebra walks, and the
recursive `Drop` at once, and matches the existing `max_repeat`,
`max_list_len`, and `expanded_ast_limit` guards. A 16-line patch (attached)
does this; against 0.6.4 the trigger then returns a clean `Err` instead of
aborting in both profiles, the cap boundary is exact (depth 999 compiles,
1,001 rejects), and `cargo test --workspace --no-fail-fast` is unchanged at
`235 passed; 0 failed; 19 ignored`.
````

## Other flags from the 2026-05-25 pass

These rank below Bug G: a latent arithmetic asymmetry not reachable under
default limits, a 0.6.4 acceptance regression, and a low-confidence
loop-termination question.

### Flag H: `get_bounded_length` min-length add is not saturating

`resharp-algebra/src/lib.rs:1061`, the `Kind::Concat` arm of
`get_bounded_length`:

```rust
(lmin + rmin, lmax.saturating_add(rmax))
```

The max-length add is saturating; the min-length add is a plain `+`. The
asymmetry suggests the max was hardened (consistent with the overflow
awareness behind the former Bug C / Bug F `saturating_add` fix) while the
min was missed. It is not reachable under
default limits: min-length accumulates through concatenation and is bounded
by the expanded node count, which `expanded_ast_limit` (50,000) caps far
below `u32::MAX`, so `lmin + rmin` cannot overflow for any pattern the
parser accepts. Latent defensive-consistency issue; the one-line fix is
`lmin.saturating_add(rmin)`. Flagged, not a live bug.

### Flag I: 0.6.4 `strip_lb` fail-closed rejects lookbehind shapes beyond the intersection case

`resharp-algebra/src/lib.rs:2005-2014`. The former Bug B fix (the
`strip_lb` fail-closed change shipped in 0.6.4) made `strip_lb`
return `Err(UnsupportedPattern)` (at `:2010-2011`, and `strip_lb_inner` at
`:2021`) when it cannot remove a lookbehind. `strip_lb` runs during
`find_all` for any lookbehind-bearing pattern, not only intersection
shapes, so 0.6.4 can now reject lookbehind patterns that 0.6.3 accepted,
including shapes with no intersection. forbidden-strings'
`intersection_with_lookbehind` pre-validator only guards `&` co-occurring
with `(?<=` / `(?<!`; a non-intersection lookbehind rule that `strip_lb`
cannot fully strip would surface `UnsupportedPattern` at scan time rather
than being caught by a pre-validator. This is a 0.6.3 to 0.6.4 acceptance
regression, not a soundness defect (the maintainer commented out their own
HTML-attribute, word-boundary, and user-agent tests with "TODO: reallow
once guaranteed 2 be correct"). Whether it matters depends on whether any
production rule uses a lookbehind outside an intersection; the example
betterleaks config does not, so the practical risk is currently low.
Flagged as a scope item: a known-restriction class, not a new crash.

### Flag J: `prefix.rs` lookbehind fixpoint loop assumes monotonicity

`resharp-engine/src/prefix.rs:1006-1013` strips a lookbehind prefix in a
loop that breaks when `after == lb_stripped`:

```rust
loop {
    let stripped = b.strip_prefix_safe(lb_stripped);
    let after = b.nonbegins(stripped);
    if after == lb_stripped {
        break;
    }
    lb_stripped = after;
}
```

It terminates only if `strip_prefix_safe` then `nonbegins` is
monotone-shrinking toward a fixpoint. If that composition could oscillate
between two node ids for some input, the loop would not terminate. Low
confidence: these strip operations are normally monotone and no probe
triggered it. Flagged as a place to check if a future hang bisects into
`prefix.rs`, not a confirmed defect.

## Flaky upstream test: `rev_bot_skip_terminates_fast` (timing assertion)

### Symptom

resharp's own test `rev_bot_skip_terminates_fast`
(`resharp-engine/tests/engine_test.rs:1318` at the 0.6.8 tag) fails on this
hardware:

```text
thread 'rev_bot_skip_terminates_fast' panicked at resharp-engine/tests/engine_test.rs:1318:5:
`\z` on 4MB took 7.813198ms, expected sub-ms (BOT skip regressed?)
```

It is the reason a plain `cargo test --workspace` on a resharp checkout fails
fast before reaching `properties_test` and `fuzz_compare` (those binaries sort
after `engine_test`, and cargo stops the test phase on the first failing
binary unless `--no-fail-fast` is passed).

### Cause: an absolute sub-millisecond wall-clock bound

The test scans `\z` against a 4 MB input and asserts the elapsed time is under
500 us (`elapsed.as_micros() < 500`), as a proxy for "the BOT-skip fast path did
not regress". That is an absolute wall-clock threshold with no machine
calibration.

Measuring on this host (warmed, best of many runs, release + lto) shows the
threshold is simply wrong here, not that anything regressed:

```text
\z   (reverse BOT-skip) find_all on 4 MiB : ~7.0 ms
\Ax  (one linear DFA pass) on 4 MiB       : ~6.8 ms   (ratio z/base ~= 1.0)
[^q]*q (un-accelerated full scan) on 4MiB : ~7.0 ms
q    (memchr literal, absent) on 4 MiB    : ~0.065 ms
```

Two facts fall out. First, a 4 MB scan CAN be sub-millisecond (the memchr
literal does it in 65 us), so the author's sub-ms expectation was reasonable on
a host where the skip yields a big speedup. Second, on this build the skip
yields no measurable speedup at all: `\z` costs the same as one plain linear DFA
pass (`\Ax`, `[^q]*q`), so it runs at full per-byte cost (~7 ms), far over the
500 us cap. Whether the skip helps is therefore host- and build-dependent, and
no fixed wall-clock budget is portable. `\z` does stay LINEAR in input size
(time roughly quadruples for a 4x larger input, never 16x), which is the
portable invariant the test should actually guard.

### Not caused by the intersection/alternation prototype

`\z` is an end-of-text anchor; it never enters the intersection or union
distribution rewrites the re-entrancy-guard prototype touches. Confirmed
empirically: the test fails identically on a clean, unmodified 0.6.8 checkout,
consistently across runs:

```text
# clean (unguarded) 0.6.8, 3 runs:
`\z` on 4MB took 7.334028ms, expected sub-ms (BOT skip regressed?)
`\z` on 4MB took 6.905390ms, expected sub-ms (BOT skip regressed?)
`\z` on 4MB took 6.822778ms, expected sub-ms (BOT skip regressed?)
```

So it is a pre-existing, hardware-dependent flaky assertion, not a regression.

### Handling

When running resharp's suite to validate a prototype on this hardware, skip
this one test and pass `--no-fail-fast` so the differential suites still run:

```bash
cargo test --release --workspace --no-fail-fast -- --skip rev_bot_skip_terminates_fast
```

### Prototype (2026-06-03): self-calibrating linearity assertion

The calibration patch (`resharp-engine/tests/engine_test.rs` only) is part of
the combined PR branch and `/tmp/agent/resharp-combined-202606031308.patch`; the
per-fix diff is in `docs/todo/resharp-bugs-202606031308-pr.local.md`.

The fix replaces the absolute `< 500 us` budget with a self-calibrating
linearity check. It times `\z` find_all at 1 MiB and at 4 MiB (best of 3 runs
each, keeping the correctness asserts: exactly one match, at end of input), then
requires the 4x-larger input to cost under 8x more time. Linear scaling gives
~4x; a quadratic regression of the reverse BOT-skip would give ~16x, so the 8x
ceiling separates O(n) from O(n^2) with 2x headroom on each side. A guard
returns early when `\z` on 1 MiB is already under 100 us (the skip is fully
effective and the measurement is timer-noise-dominated, so the ratio is
meaningless), keeping the test trivially green on hosts where the skip works.

Verification:

- On this host the measured factor is ~4.0x (1 MiB ~= 1.84 ms, 4 MiB ~= 7.43 ms),
  comfortably under the 8x ceiling.
- Passes 10/10 runs on the guarded build and 6/6 runs on a clean, unmodified
  0.6.8 checkout (the test fix is independent of the algebra re-entrancy guard:
  the two patches touch different files and were applied separately).
- The original absolute-bound test failed 100% of runs on both builds.
- Re-verified 2026-06-03 on the combined PR build: the recalibrated test runs in
  release (it is `#[cfg_attr(debug_assertions, ignore)]`) and passes
  (`rev_bot_skip_terminates_fast ... ok`) within the full
  `cargo test --release --workspace --no-fail-fast` run.

This is one of the four fixes in the combined PR branch (see the "Combined
upstream PR" note near the top). Pushing stays held for the user. Per the
Claude Code / out-of-scope exemptions this repo follows for non-actionable
upstream churn, a flaky timing assertion in a dependency's own test suite would
normally just be recorded here; the prototype exists so the fix can be offered
upstream cheaply, and it is bundled with the three behavioural fixes since the
maintainer is fine with big PRs.

[resharp]: https://github.com/ieviev/resharp
