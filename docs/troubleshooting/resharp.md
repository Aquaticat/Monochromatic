# Resharp: upstream bugs and forbidden-strings workarounds

This document tracks the upstream resharp bugs that `forbidden-strings`
defends against, the consumer-side guards that block each, and the
verification path for each finding.

Current status (2026-06-03, resharp 0.6.8): the lockfile and the
`packages/cli/forbidden-strings/Cargo.toml` requirement floor are bumped
from 0.6.3 to 0.6.8, executing the "wait then bump then re-fuzz" plan under
"Plan (decided 2026-05-23)" below. Behavioural re-verification at 0.6.8
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
- Intersection over alternation (new, found during the 0.6.8 campaign): an
  uncatchable algebra-recursion stack overflow distinct from Bug G, with no
  safe consumer-side guard. A minimal fix (a re-entrancy guard on the
  distribution rewrites) is now prototyped and verified; file-ready, held for
  go-ahead. See "Intersection over alternation: unbounded algebra recursion".

A flaky upstream timing test (`rev_bot_skip_terminates_fast`) surfaced while
verifying the prototype; it fails identically on stock 0.6.8. Its absolute
sub-millisecond bound is replaced by a verified self-calibrating linearity-test
prototype; both are documented under "Flaky upstream test" below.

Full per-bug method and probe output: see "Bump to resharp 0.6.8
(2026-06-03)" below.

Six bugs are tracked (A through F). All were re-verified on 2026-05-23
against published resharp 0.6.3 and against git HEAD `e0b8aba`
(`https://github.com/ieviev/resharp`, 2 commits past the 0.6.3 release
commit `0b7732c`), using standalone probe crates built in debug
(debug-assertions and overflow-checks both on, matching cargo-fuzz
defaults) and in release (both off). Each still-live bug now has a
minimal prototype fix verified against HEAD; the combined patch is at
[resharp.patch](resharp.patch) and the
single merged upstream issue body is at
the out-of-band local file `resharp-merged-issue.local.md` (gitignored, not committed). See the
"Prototype fixes" section for the per-bug results.

A later pass on 2026-05-25 against published resharp 0.6.4 (the current
latest, which already carries the Bug B/C/E/F fixes) added Bug G, an
uncatchable stack-overflow abort on deeply nested complement and lookaround
patterns, plus three lower-severity flags (H, I, J) and a set of negative
results. Those live in the "2026-05-25 follow-up pass (resharp 0.6.4)"
section below and were verified against 0.6.4, not the 0.6.3 / `e0b8aba`
baseline the A through F catalogues use.

Update (2026-05-23, post-filing): the maintainer responded the same day
and published resharp 0.6.4, whose sole fix commit (`bd780ef`) reproduces
our prototype patch (source-verified: the Bug A render string is
byte-for-byte identical to ours and the Bug B/C/E/F hunks match). The
verification catalogues below stay against published 0.6.3 and HEAD
`e0b8aba` (which predates 0.6.4); a behavioural re-fuzz against the
published 0.6.4 build is still pending. See "Upstream response
(2026-05-23)" below for the reply, the source diff, and the
wait-then-bump-then-re-fuzz plan.

Status (0.6.3 / HEAD baseline; superseded for the current pin by "Current
status (2026-06-03, resharp 0.6.8)" above, where Bugs B, C, E, F are fixed
and Bug D tightened further):

- **Bug A** (`\b`/`\B`/`^`/`$` or any lookaround inside a `~(...)` complement
  body fails to compile): unchanged from 0.6.0 through 0.6.3/HEAD.
  Defense: `lookaround_in_complement`. The behavioural fix (supporting the
  shape) stays un-prototyped (architectural); only the error-message
  wording is prototyped (legibility nudge).
- **Bug B** (intersection `&` with a lookbehind): still reproduces, but the
  defect now surfaces earlier in the pipeline. The panic moved from the
  matching engine (`resharp/src/engine.rs:1020` in 0.6.0) to a
  `debug_assert!` in the new `strip_lb` lookbehind-stripping rewrite
  (`resharp-algebra/src/lib.rs:2007` at HEAD, `:2006` in 0.6.3). In release
  the assertion is compiled out and `find_all` silently returns corrupted
  matches. Defense: `intersection_with_lookbehind`. Prototyped fix:
  fail-closed `Err` in `strip_lb`.
- **Bug C** (intersection `&` with `\w` and `$` end-anchor): still overflows
  in `attempt_rw_concat_2` (`resharp-algebra/src/lib.rs:2479` at HEAD,
  `:2478` in 0.6.3; was `:2470` in 0.6.0). Release wraps silently without
  `overflow-checks = true`. Defense: `intersection_with_word_end_alternation`
  plus the `overflow-checks = true` + `panic = "unwind"` profile combo and
  the `catch_unwind` net in `compile_rule_src`. Prototyped fix:
  `saturating_add` (shared with Bug F).
- **Bug D** (alternation containing a lookaround plus a sibling lookaround):
  the documented symptom no longer reproduces in 0.6.3/HEAD. `find_all`
  returns clean results in both debug and release; the shape no longer
  reaches the `unexpected end` `debug_assert!`. Do not file (fixed
  upstream). Defense `lookaround_in_alternation_with_sibling` is now
  belt-and-suspenders rather than a live guard.
- **Bug E** (complement `~` + intersection `&` + quantified group): still
  hangs `Regex::new` in `prefix::calc_prefix_sets_inner`. Prototyped fix:
  `visited`-set cycle break, re-validated against HEAD `e0b8aba` (diff
  applies cleanly, trigger then compiles in milliseconds).
- **Bug F** (nested lookahead inside a quantified group, outer min >= 2):
  overflows in the same `attempt_rw_concat_2` add as Bug C. Defense:
  `nested_lookahead_in_quantified_group`. Prototyped fix: the shared
  `saturating_add`. Previously undocumented; the `engine.rs` pre-validator
  wrongly claimed it was filed upstream.
- **Bug G** (deeply nested complement or lookaround patterns abort
  `Regex::new` with an uncatchable stack overflow): new in the 2026-05-25
  pass against published 0.6.4. In the release profile, `~(...)` or
  `(?=...)` nested past roughly 20,000 to 30,000 levels overflows the stack
  and aborts (SIGABRT) below the `expanded_ast_limit` rejection point, so
  the limit never fires; in the debug profile every nesting kind overflows
  at about 1,500 levels. `catch_unwind` cannot intercept a stack-overflow
  abort, and forbidden-strings has no nesting-depth pre-validator, so this
  is undefended at our boundary. Prototyped 2026-05-25 (a 16-line parse-time
  `max_depth` check, regression-clean, abort becomes a clean `Err`); all five
  filing constraints now pass. Not filed: per the 2026-05-25 decision the
  upstream fix and the consumer-side depth pre-validator both wait for the
  next upstream release bump (see the follow-up section).

Filing summary: filed 2026-05-23 as ieviev/resharp#5
(`https://github.com/ieviev/resharp/issues/5`). Per the user's decision
not to file separate issues, all still-live bugs were merged into that one
upstream issue. Its body is the out-of-band local file
`resharp-merged-issue.local.md` (gitignored, not committed), with the
combined patch attached. Each merged bug has a minimal prototype fix
verified against HEAD, so the five-constraint gate (constraint 5:
prototype) now
passes for Bugs B, C, E, F and for Bug A's wording sub-issue. Bug A's
behavioural fix (actually supporting complement-of-lookaround) stays out
of the issue: it is an architectural change with no prototype. Bug D is
excluded (fixed upstream; filing it would report a resolved defect, which
the policy treats as a publicity incident).

Upstream tracker checked 2026-05-23 (`gh issue list -R ieviev/resharp
--state all`): the repository has four issues total and none cover Bugs A
through F, so the merged issue (filed as #5) was not a duplicate. The closed issue #3
("find_all / is_match false positives for fixed-length patterns with a
literal prefix", 2026-04-02) sits in the same prefix-selection code as
Bug E and shows the maintainer actively fixes bugs there, which
strengthens the case. The `nested_lookahead_in_quantified_group`
pre-validator in `engine.rs` previously claimed "Filed upstream: see
TROUBLESHOOTING.resharp.md Bug F for the issue link"; that was false (no
such issue, no such section). Bug F is now documented below and folded
into the merged issue.

Bugs B through F were originally surfaced by `fuzz_extract_gate_soundness`
and companion fuzz and bisect probes. The `intersection_with_*` and other
pre-validators in `packages/cli/forbidden-strings/src/rules/engine.rs` are
the durable consumer-side fix and stay in place regardless of upstream
status; over-rejection is fail-closed-safe.

## Upstream response (2026-05-23): v0.6.4 fix reproduces our prototype patch

The maintainer (`ieviev`) responded to the merged issue
[ieviev/resharp#5](https://github.com/ieviev/resharp/issues/5) the same
day it was filed, in two comments:

- 15:18 UTC: "Will go over them soon, thanks!"
- 15:27 UTC
  ([`#issuecomment-4525801205`](https://github.com/ieviev/resharp/issues/5#issuecomment-4525801205)):
  "This restricted a few edge case patterns which i will rewrite
  properly to allow them again in the coming days. Bug itself is fixed
  in v0.6.4 now. Thanks again!"

Version facts (crates.io, checked 2026-05-23): resharp 0.6.4 was
published at 2026-05-23T15:24:24Z, between the two comments and minutes
before the "fixed in v0.6.4" reply. It is the latest version as of
2026-05-23; the "coming days" follow-up release that re-allows the
restricted edge-case patterns is not yet published. The repository
publishes no git tags, so crates.io is the version of record (consistent
with this doc otherwise tracking HEAD commits).

### What this changes, and what it does not

- Source-verified: 0.6.4 is our patch. The sole fix commit
  (`bd780ef "edge case bugfix"`, the immediate parent of the
  `3d48f1c "bump ver"` commit crates.io published as 0.6.4) reproduces
  [resharp.patch](resharp.patch) with our
  explanatory comments stripped. Read against a fresh clone: Bug B is the
  fail-closed `Err(UnsupportedPattern)` in `strip_lb`
  (`resharp-algebra/src/lib.rs:2011`), Bug C / Bug F is
  `tail_rel.saturating_add(la_rel)` (`:2480`), Bug E is the `visited` set
  plus clear-and-break (`resharp-engine/src/prefix.rs:33`), and Bug A is
  the expanded `UnsupportedPattern` render string (Display arm at `:35`),
  byte-for-byte identical to our patch's. All three filed
  DFA-construction defects plus the Bug A wording nudge are addressed, by
  our prototype: the patch attached to the filing is the patch the
  maintainer shipped, which is the troubleshooting-doc auto-prototype rule
  paying off.
- Still pending: behavioural re-confirmation against the published build.
  We read the 0.6.4 source but have not re-run the probe crates or fuzz
  targets against 0.6.4, and have not bumped; the catalogues in each bug
  section stay against 0.6.3 and `e0b8aba`. `git apply --check` of our
  patch against 0.6.4 fails because the fix lines are already present,
  confirming the patch is superseded by being upstreamed, not replaced by
  a divergent approach.
- The "restricted a few edge case patterns" is the Bug B fail-closed
  `Err`. The same `strip_lb` change that stops the silent corruption also
  rejects some patterns that previously compiled; the maintainer commented
  out HTML-attribute, word-boundary, and user-agent tests with "TODO:
  reallow once guaranteed 2 be correct". Our Bug B prototype makes the
  identical restriction, and the `intersection_with_lookbehind`
  pre-validator rejects the same shapes earlier with a clearer message.
  The maintainer's "rewrite properly to allow them again" follow-up is
  future work neither 0.6.4 nor our prototype does: correctly supporting a
  lookbehind operand of an intersection in `strip_lb`.
- Supporting more patterns. Bug C, F, and E carry their fix code in 0.6.4
  (the `saturating_add` and `visited`-set patches, which compiled the
  triggers correctly on `e0b8aba`), not a restriction, so their
  pre-validators are candidates to loosen once a re-fuzz confirms the
  published 0.6.4 build matches correctly.
  Bug B's pre-validator stays until the follow-up re-allows
  lookbehind-in-intersection; until then it agrees with upstream's own
  rejection.

### Plan (decided 2026-05-23)

Hold the lockfile at resharp 0.6.3 (the current `Cargo.lock` pin; the
`resharp = "0.6"` requirement in
`packages/cli/forbidden-strings/Cargo.toml` would otherwise let
`cargo update -p resharp` pull 0.6.4). 0.6.4 already carries the Bug C, F,
and E fix code (source-verified above); waiting for the maintainer's
"coming days" follow-up release (which re-allows the Bug B restricted
patterns) folds the Bug B re-allow into a single bump and re-fuzz rather
than bumping twice. When that release ships, in one pass:

- Bump to that release (update `Cargo.lock`, raise the `resharp`
  requirement floor if needed).
- Re-run the fuzz targets (`fuzz_extract_gate_soundness` and companions)
  and the per-bug probe crates against the new version.
- Decide per-bug, from the re-fuzz results, whether each pre-validator can
  be loosened to support more patterns or must stay a fail-closed guard.

Until that re-fuzz lands, treat every bug below as live-and-defended at
our boundary: the pre-validators and the `overflow-checks = true` +
`panic = "unwind"` + `catch_unwind` profile combo remain the durable
consumer-side fix regardless of upstream movement.

## Bump to resharp 0.6.8 (2026-06-03): plan executed

The "Plan (decided 2026-05-23)" above held the lockfile at 0.6.3 until the
maintainer's follow-up release. resharp 0.6.8 (published 2026-06-03, the
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
known shapes, not a fresh fuzz campaign; re-running the
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
- Bug B (`(?:(?=a)&(?<=_))`): `Regex::new` now returns
  `Algebra(UnsupportedPattern)` in debug and release, so `find_all` never
  runs. The 0.6.3 release corruption (62 spurious matches on 64 bytes
  ending in `_`, 127 on 128 bytes of `a`) and the debug `strip_lb` panic
  are both gone, replaced by a clean compile-time rejection. Fail closed.
- Bug C (`(?:\w|$)(?:(?![1g]\_X)& a)`): `COMPILE-OK` in debug and release,
  no `attempt to add with overflow`. Fixed.
- Bug D (`(a|(?![_]))(?!a)`): now `Algebra(UnsupportedPattern)` at compile
  in release (it compiled and returned clean matches at 0.6.3); the
  lookbehind variant `(a|(?<!_))(?<!a)` returns
  `Parse(UnsupportedResharpRegex)`. Further tightened, still fail-closed.
- Bug E (`abc~(\w)&(?:aaa)*`): `COMPILE-OK` in milliseconds, no hang.
  Fixed.
- Bug F (`(?:(?!\?){1,2}){3}`, `(?:(?:(?!\?)){1,5}){2,4}`,
  `(?:(?!abc)){4,12}a`): all `Algebra(UnsupportedPattern)` at compile in
  debug and release, no overflow panic. Fixed (fail-closed).
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
  rejects), and real rules still compile. The refreshed 16-line patch is ready
  but NOT filed (a shared-state action; held for explicit go-ahead).

The fuzz campaign that the "Probe method" note above deferred was also run
against 0.6.8 (the `smoke` task over all seven targets, AddressSanitizer
instrumented). `fuzz_extract_gate_soundness` (the Bug B to F soundness target)
is clean. The campaign surfaced one new resharp defect, below.

## Intersection over alternation: unbounded algebra recursion (found 2026-06-03)

A defect distinct from Bug G, surfaced by `fuzz_regex_engine_dispatch` and
`fuzz_residual_shards` during the 0.6.8 campaign.

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

Two fuzz targets reach it and now skip the combo:

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
2. Can upstream fix it? Plausibly the same shape as Bug E: a visited-set /
   fixpoint guard on the `attempt_rw_inter_2` / `attempt_rw_union_2`
   distribution so it cannot re-enter the same rewrite indefinitely. Touches
   the algebra core, so larger than Bug E's prefix loop.
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
semantics. Patch: `/tmp/agent/resharp-interalt-reentrancy-guard-0.6.8.patch`
(41 insertions, `resharp-algebra/src/lib.rs` only).

Mechanism: add an in-progress set
`rw_active: FxHashSet<(Kind, NodeId, NodeId)>` to `RegexBuilder`, and wrap
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

One part is separable and is now prototyped: suggested fix 2 below
(improve the error message to name the surface trigger) is a wording
change, not an algebra change, so it cleared constraint 5 trivially (see
"Prototype fixes") and is folded into the merged upstream issue. Only the
behavioural fix (actually supporting complement-of-lookaround), which
would touch the algebraic core, stays out of the issue. Bugs B, C, E, and
F are likewise prototyped and merged; Bug A's behaviour is the single
item held back.

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

## Bug B: intersection with lookbehind triggers a `debug_assert!` (silent corruption in release)

### Symptom

A rule whose source contains both intersection (`&`) and a lookbehind
assertion (`(?<=...)` or `(?<!...)`) at the same scope (i.e. both outside
character classes, in the same compiled regex) and which is then matched
against an input of about 64 bytes or longer causes one of two
divergent outcomes depending on the build profile.

The trigger shape is unchanged from 0.5.3 through HEAD, but the defect now
surfaces at a different point. In 0.5.3 and 0.6.0 it tripped a
`debug_assert!` in the matching engine (`resharp/src/engine.rs:1020`,
`unexpected end 0 > N`). From 0.6.2 onward a new lookbehind-stripping
rewrite, `strip_lb`, runs during `find_all` and its own internal
`debug_assert!` fires first:

```text
# Debug profile (debug-assertions ON):
thread 'main' panicked at resharp-algebra/src/lib.rs:2007:   # :2006 in 0.6.3
should not contain lookbehind: "(?=a_*){∅}❮(&(?<=_*_))❯"

# Release profile (debug-assertions OFF, our forbidden-strings default):
# (no panic; find_all silently returns wrong/spurious matches)
```

The minimum reproducer captured by the `fuzz_extract_gate_soundness`
fuzz target is the pattern `(?:(?=a)&(?<=_))` driven through `find_all`.
The 2026-05-23 re-verification (probe crates `rsverify` against 0.6.3 and
`rsverify-head` against HEAD `e0b8aba`) reproduced it identically in both:
the debug build panics in `strip_lb`, and the release build returns
corrupted matches (62 spurious matches on a 64-byte input ending in `_`,
and 127 spurious matches on 128 bytes of `a` which contain no `_` at all
for the lookbehind to anchor on). The `engine.rs:1020` `debug_assert!`
still exists at HEAD (drifted to `engine.rs:1000-1002`) but this shape no
longer reaches it; `strip_lb` intercepts first.

### Root cause

In 0.5.3 and 0.6.0 the trigger reached a `debug_assert!` in the matching
engine (`resharp/src/engine.rs:1020`, `unexpected end {} > {}`), which in
release fell through to a `matches.push` recording a `Match` with
`start > end`. From 0.6.2 onward the live site is the `strip_lb`
lookbehind-stripping rewrite in `resharp-algebra/src/lib.rs`
(`:2003-2012` at HEAD, assert at `:2007`):

```rust
pub fn strip_lb(&mut self, node_id: NodeId) -> Result<NodeId, ResharpError> {
    if node_id.is_concat(self) && node_id.left(self) == NodeId::BEGIN {
        return self.strip_lb(node_id.right(self));
    }
    let result = self.strip_lb_inner(true, node_id)?;
    debug_assert!(
        !self.contains_lookbehind(result),
        "should not contain lookbehind: {:?}",
        self.pp(result)
    );
    Ok(result)
}
```

`strip_lb_inner` is meant to remove every lookbehind from the node, and
the `debug_assert!` enforces that postcondition. For the intersection-
with-lookbehind shape `(?:(?=a)&(?<=_))`, the strip fails to remove the
`(?<=_)` operand of the `&` node, so `contains_lookbehind(result)` is
still true and the assertion fires. In release the assertion is compiled
out, the un-stripped node flows into matching, and `find_all` returns
corrupted matches (the same fail-open class as before: 62 spurious
matches on a 64-byte input, 127 on 128 bytes of `a`).

Whether this is the same underlying invariant as the 0.6.0 engine bug
surfaced one stage earlier, or a distinct defect introduced with the
`strip_lb` machinery, is not determined here. What is verified: the same
trigger shape still produces a debug-build panic and release-build
silent corruption, now via `strip_lb`. The bug only fires when a
lookbehind is one of the intersection operands; pure lookahead
intersections do not trigger.

### Defense

The pre-validator `intersection_with_lookbehind` in
`packages/cli/forbidden-strings/src/rules/engine.rs` walks the source
byte-by-byte tracking character-class membership and rejects any rule
where `&` and `(?<=` (or `(?<!`) co-occur outside any `[...]`. The
rejection produces an actionable error pointing here.

The pre-validator rejects on the source-text shape, so the relocation of
the assertion from `engine.rs` to `strip_lb` does not affect it: the rule
never reaches resharp either way.

The `catch_unwind` net in `CompiledRegex::find_all` exists primarily
for test/CI runs (debug-assertions on) and as a future-regression hedge;
it does not help in release because `debug_assert!` is compiled out and
no panic fires for the corruption path to catch.

Enabling `debug-assertions = true` in `[profile.release]` is deliberately
NOT done: `regex`, `ignore`, and `rayon` have hot-path debug_asserts and
the perf cost was not measured. The pre-validator covers known shapes;
the fuzz target covers unknown variants. New variants would be caught
by fuzzing (which runs with debug-assertions on by default) before they
reach a release run.

### Verification

A throwaway probe crate constructs `resharp::Regex::new("(?:(?=a)&(?<=_))")`
directly (bypassing `compile_rule_src` and the pre-validator) then calls
`find_all`. A plain `cargo run` (dev profile: debug-assertions and
overflow-checks both on by default) is sufficient; no `RUSTFLAGS` override
is needed. The 2026-05-23 re-verification used two such crates, one with
`resharp = "=0.6.3"` and one with a path dependency on the HEAD `e0b8aba`
checkout:

```text
# debug build (cargo run): panics in strip_lb
thread 'main' panicked at .../resharp-algebra-0.6.3/src/lib.rs:2006:
should not contain lookbehind: "(?=a_*){∅}❮(&(?<=_*_))❯"

# release build (cargo run --release): silent corruption
[B-64_]  FINDALL-OK  "(?:(?=a)&(?<=_))" inlen=64  matches=62
[B-128a] FINDALL-OK  "(?:(?=a)&(?<=_))" inlen=128 matches=127
```

The in-tree regression test
`find_all_catches_runtime_panic_via_catch_unwind` in
`packages/cli/forbidden-strings/src/rules/engine_tests.rs` exercises the
same shape through `CompiledRegex::find_all` and asserts no panic escapes.
Note that the package's `mise run test` task is `cargo test --release`, so
debug-assertions are off and no panic fires; the test passes because
`find_all` returns (corrupted) `Ok` rather than panicking. The actual
release-time protection for this shape is the `intersection_with_lookbehind`
pre-validator, not this test. Run plain `cargo test` (debug-assertions on)
to make the test exercise the panic path.

---

## Bug C: intersection with `\w` and `$` end-anchor overflows in `attempt_rw_concat_2`

### Symptom

A rule whose source contains intersection (`&`), `\w` shorthand, and
the `$` end-anchor at the same scope panics at compile time during
`Regex::new` when the release profile has `overflow-checks = true`:

```text
thread 'main' panicked at resharp-algebra/src/lib.rs:2479:   # :2478 in 0.6.3, :2470 in 0.6.0
attempt to add with overflow
```

When the release profile has `overflow-checks = false` (cargo's
default), the add silently wraps and the constructed regex
silently misbehaves at match time. Either outcome is a soundness
problem for a CI gate. The minimum reproducer is the pattern
`(?:\w|$)(?:(?![1g]\_X)& a)`. The 2026-05-23 re-verification reproduced
it identically against published 0.6.3 and HEAD `e0b8aba`: the debug
build panics with the message above; the release build returns `Ok`
(silent wrap). Only the source line drifted (`:2470` -> `:2478` -> `:2479`).

### Root cause

The overflowing `+` lives inside `attempt_rw_concat_2`
(`resharp-algebra/src/lib.rs`, `fn` at `:2405` at HEAD; the overflowing
add at `:2479` at HEAD, `:2478` in 0.6.3, `:2470` in 0.6.0). It adds
`usize` values derived from a node-tree traversal where one operand can
be near `usize::MAX` for the algebra rewrites triggered by intersection-
of-(word-shorthand-alternation, end-anchor-bearing-expression). The
overflow is a true bug, not a sentinel; the wrap produces a DFA that
fails to match content that should match (fail-open).

### Defense

The pre-validator `intersection_with_word_end_alternation` in
`packages/cli/forbidden-strings/src/rules/engine.rs` walks the source
byte-by-byte tracking character-class membership and rejects any rule
where `&`, `\w`, and `$` co-occur outside any `[...]`. The rejection
produces an actionable error pointing here.

The `catch_unwind` net in `compile_rule_src` exists as belt-and-
suspenders: if a new shape evades the pre-validator and `overflow-
checks = true` is set (it is, in our `Cargo.toml`), the resulting
panic gets converted to a fail-closed `Err(String)` instead of
aborting the scanner process or returning wrong results.

The release profile's `panic = "unwind"` and `overflow-checks = true`
settings are both load-bearing: `panic = "abort"` would skip the
unwind barrier and abort the process before `catch_unwind` runs;
`overflow-checks = false` (cargo's default) would let the add wrap
silently, producing the fail-open behaviour with no panic to catch.

### Verification

A throwaway probe crate calls
`resharp::Regex::new("(?:\\w|$)(?:(?![1g]\\_X)& a)")` directly. A plain
`cargo run` (dev profile: overflow-checks on) panics with the message
above; `cargo run --release` (overflow-checks off) returns `Ok` but the
constructed regex misbehaves. Confirmed against 0.6.3 and HEAD on
2026-05-23.

The in-tree regression test `compile_rule_src_does_not_panic_on_known_
bad_shapes` exercises the same shape through `compile_rule_src` and
asserts the pre-validator catches it before resharp sees it.

---

## Bug D: alternation containing a lookaround + sibling lookaround (fixed upstream in 0.6.x)

Status: the documented symptom no longer reproduces in 0.6.3 or HEAD
`e0b8aba`. Re-verified 2026-05-23: `find_all` on `(a|(?![_]))(?!a)`
returns clean results in both the debug build (debug-assertions on) and
the release build, with no panic, for inputs of 1, 2, 64, and 128 bytes.
The lookbehind-direction variant `(a|(?<!_))(?<!a)` is now rejected at
compile time (`Algebra(UnsupportedPattern)`) and never reaches `find_all`.
The `unexpected end` `debug_assert!` still exists (drifted to
`engine.rs:1000-1002`), but this shape no longer reaches it. Do not file
this upstream: it reports an already-resolved defect. The historical
analysis below is retained for the record.

Update (2026-06-03, resharp 0.6.8): 0.6.8 tightened this further. The
forward shape `(a|(?![_]))(?!a)`, which compiled and returned clean matches
at 0.6.3, now returns `Algebra(UnsupportedPattern)` at compile in release
and never reaches `find_all`; the lookbehind variant still rejects. So at
0.6.8 the shape is fail-closed at compile rather than compile-and-run-clean.
The `lookaround_in_alternation_with_sibling` pre-validator now agrees with
upstream's rejection and stays as belt-and-suspenders. See "Bump to resharp
0.6.8".

### Symptom (historical, no longer reproduces)

In 0.5.3 through 0.6.0, a rule whose source had an alternation containing
a lookaround AND another lookaround somewhere else in the source compiled
cleanly via `Regex::new`, but `find_all` panicked during the forward DFA
pass:

```text
thread 'main' panicked at resharp-0.6.0/src/engine.rs:1020:17:
unexpected end 0 > N
```

The minimum reproducer bisected from the fuzzer's
`crash-8cba104f0805ccb567513aff895398a4f652200c` artifact was:

```
(a|(?![_]))(?!a)
```

Confirmed-equivalent shapes:

- `(a|(?![X]))(?!Y)` for X in `_`, `0`, `.`, `-`, `|`, `^a`
- `(?:a|(?![_]))(?!a)` (non-capturing first group)
- `((?![_])|a)(?!a)` (lookaround as first alt branch)
- `(a|(?<!_))(?<!a)` (lookbehind direction; same root cause)

Shapes that do NOT trigger:

- `(a|(?!a))(?!a)` -- first lookaround has a bare atom, not a class
- `(a|(?![ab]))(?!a)` -- class has two chars
- `(?!a)(a|(?!a))` -- lookaround BEFORE alternation, not after
- `(?!a)b(?!c)` -- atom between two lookaheads, no alternation

### Root cause

The same line as Bug B (`engine.rs:1020`'s `debug_assert!(...)`) fires
for a different shape: the algebra simplification leaves a node whose
forward DFA construction reaches an "unexpected end" state when one
operand of an alternation is a lookaround whose body is a single-char
class. The `debug_assert!` shape means release builds silently return
wrong matches; under libFuzzer-sys's panic hook (which calls `abort()`
before `catch_unwind`'s unwind barrier intercepts), the fuzz target
aborts on every iteration that hits this shape.

### Defense

The pre-validator `lookaround_in_alternation_with_sibling` in
`packages/cli/forbidden-strings/src/rules/engine.rs` walks per-paren
depth `(has_alt, has_la)` flags, tracks total lookaround count, and
fires at end-of-walk when any closed group had alt+la AND total
lookarounds >= 2. The deferred check handles both "sibling appears
before the alt+la group" and "sibling appears after" cases.

The detector is direction-agnostic (covers both lookahead and
lookbehind) and conservative (a few shapes that compile OK at scan
time also fire). The trade-off is intentional: false positives here
cost a skipped iteration; missed positives cost a fuzz-target abort.

Now that the upstream symptom is fixed, this pre-validator is
belt-and-suspenders rather than a live guard. It stays in place: it is
cheap, the production rule corpus has no rules of this shape, and it
keeps the fuzz target from re-aborting if a regression reintroduces the
panic.

### Verification

In 0.5.3 through 0.6.0, the probe binaries at
`/tmp/probe-slow-unit/src/bin/bisect2.rs` and `bisect3.rs` reproduced the
panic across all confirmed-triggering shapes with
`RUSTFLAGS="-C debug-assertions=on"`. The 2026-05-23 re-verification
(probe crates against 0.6.3 and HEAD `e0b8aba`, plain `cargo run` so
debug-assertions are on) found no panic: `find_all` on `(a|(?![_]))(?!a)`
returns `Ok` for every probed input, and the lookbehind variant is
rejected at compile time. The in-tree tests
`lookaround_in_alternation_with_sibling_fires` and
`compile_rule_src_rejects_alt_lookaround_sibling_shape` in
`packages/cli/forbidden-strings/src/rules/engine_tests.rs` exercise the
pre-validator and the end-to-end compile rejection path; they still pass
because they test the pre-validator, which is independent of resharp's
runtime behaviour.

---

## Bug E: complement + intersection + quantified group hangs `prefix::calc_prefix_sets_inner`

### Symptom

A rule whose source contains a complement (`~(...)`), intersection
(`&`), AND a quantified group (`(...)*`/`(...)+`/`(...)?`/`(...){N}`)
hangs during `Regex::new`; the compile call does not return within
libFuzzer's per-input timeout (10s in our fuzz run). The minimum
reproducer bisected from
`timeout-00179d433e26fbcc3bedf2b7b38b6ce1ff9e6438` is:

```
abc~(\w)&(?:aaa)*
```

The hang scales with the surrounding shape: a 1-char prefix and a
1-char-body quantified group compile in milliseconds; 3+ char prefix
with 3+ char quantified group never terminate within minutes. Wrapping
the entire source in a single non-capturing group (`(?:...)`) avoids
the hang; the wrapping changes how the simplified AST enters the
prefix-selection phase.

Re-verified 2026-05-23: `Regex::new("abc~(\\w)&(?:aaa)*")` still hangs
past a 10s thread timeout in both published 0.6.3 and HEAD `e0b8aba`,
in debug and release builds. The control shapes `abc~(\w)&(?:a)*`
(1-char body) and `~(\w)&(?:aaa)*` (no literal prefix) return in
milliseconds, matching the scaling described above. This is the only one
of the five bugs that is both still live and has a re-validated prototype
fix; it was filed (with the others) in the merged issue ieviev/resharp#5.

### Root cause

Traced via `gdb -p $HUNG_PID -ex 'thread apply all bt'` plus reading
the cloned resharp source. The hot loop is at
`resharp-engine/src/prefix.rs:27` in `calc_prefix_sets_inner`:

```rust
let mut redundant = BTreeSet::new();
redundant.insert(NodeId::BOT);
redundant.insert(start);

loop {
    if !result.is_empty() && redundant.contains(&node) {
        break;
    }
    // ... compute derivative, set node = target ...
}
```

The `redundant` set is initialized with `BOT` and the original `start`
node, then never updated inside the loop. The loop assigns `node =
target` each iteration, but new targets are not added to `redundant`.
For the trigger shape, the derivative chain produces a sequence of
unique single-target nodes that never visits `BOT` or `start`, so the
loop never terminates.

0.6.x added a `targets.retain(|(t, _)| !redundant.contains(t))` line
(at `prefix.rs:50` at HEAD) and an "empty targets" clear-and-break just
below it. Neither breaks the cycle: `retain` filters the candidate
targets against `redundant`, but `redundant` is still only the two seed
nodes, so the freshly-visited cycle nodes are never filtered out and the
single-target chain still runs forever. The loop header is unchanged at
`prefix.rs:27`, and the trigger still hangs at HEAD (re-verified
2026-05-23), which is what the prototype below addresses.

Stack trace at hang point (3s after compile start):

```
#0 resharp_algebra::RegexBuilder::collect_der_targets
#1 resharp_algebra::RegexBuilder::collect_der_targets   (recursion through TRegex ITE)
#2 resharp_algebra::RegexBuilder::collect_der_targets
#3 resharp::prefix::calc_prefix_sets_inner
#4 resharp::prefix::select_prefix
#5 resharp::Regex::from_node_inner
#6 resharp::Regex::with_options
#7 resharp::Regex::new
```

### Defense

`catch_unwind` does not protect against non-termination, and resharp
does not expose a compile timeout we could wrap from outside. The
pre-validator `complement_intersection_quantified_group` in
`packages/cli/forbidden-strings/src/rules/engine.rs` walks the source
looking for the three co-occurring features and rejects the rule
before `Regex::new` is called.

The detector is conservative: shapes like `~(\w)&(?:a)*` (no literal
prefix) compile in milliseconds but the detector still flags them.
The trade-off is safe because the production rule corpus contains
zero rules combining `&` and `~(` (the only `&` in the example
betterleaks config is escaped HTML `&amp;` or inside character
classes), so the false-positive risk is theoretical only.

### Suggested upstream fix

The initial proposal was a single line:

```rust
node = target;
redundant.insert(node);   // ADD THIS LINE
```

Prototyped against a fresh clone at
`https://github.com/ieviev/resharp.git` HEAD
`6f445d71b194161adc0efe968d723312b6856a26` (2026-05-15, declared
version 0.6.0 in `Cargo.toml`). The single-line variant DOES make
`abc~(\w)&(?:aaa)*` compile in milliseconds, but it regresses
9 of the 46 active cases in `resharp-engine/tests/prefix.toml`:

```text
unsat/prefix_rev:               expected="",          got="o"
alt-neg-la/prefix_rev:          expected="N;F;D",     got="N"
prefix_twain/prefix_rev:        expected="n;i;a;w;T", got="n"
prefix_la1/prefix_rev:          expected="b;a",       got="b"
prefix_huck/prefix_rev:         expected="k;c;u;H",   got="k"
prefix_hello/prefix_rev:        expected="o;l;l;e;h", got="o"
prefix_lookahead/prefix_rev:    expected="a;a;a",     got="a"
prefix_bounded_repeat/prefix_rev: expected="c;b;b",   got="c"
prefix_dotdot_g/prefix_rev:     expected="g;.;.",     got="g"
```

Root of the regression: pre-patch, `redundant` is a "boundary" set
seeded with `BOT` and `start`; the outer check at line 28
(`!result.is_empty() && redundant.contains(&node)`) fires only when
the derivative chain wraps back to one of those boundary nodes and
KEEPS the accumulated result. Inserting every visited node into the
same set makes that check fire on the iteration after the very first
push, so multi-character anchored prefixes are truncated to their
first character. The proposed single-line patch conflates two
different exit semantics (boundary-wrap-keeps-result vs.
fresh-node-revisit-implies-cycle).

The minimal compatible fix keeps the two semantics separate by
tracking fresh visits in a second set and clearing the result on a
fresh-node revisit, while leaving the original boundary-wrap path
untouched:

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

`visited.insert(node)` is gated on `!result.is_empty()` so the very
first iteration (where `node == start`) never enters `visited`; this
preserves the wrap-to-start semantics (still caught by the existing
`redundant.contains(&node)` check, which keeps `result`). Any later
re-visit of a node already seen in the same `calc_prefix_sets_inner`
call clears `result` and breaks, mirroring the pre-existing
"self-loop" handling at `target == node`.

Applied against the same upstream HEAD, the additive variant:

- compiles `abc~(\w)&(?:aaa)*` in milliseconds and the resulting
  regex returns `false` from `is_match` on every probe input in
  `{"", "abc", "aaa", "abcaaa", "aaaaaa", "abc!", "abcaaab"}`,
  consistent with the empty language `abc~(\w) & (?:aaa)*`
  represents;
- passes all 46 active prefix.toml cases (audited via a
  catch_unwind-per-case harness, output:
  `prefix audit: 46 active cases all OK (no failures, no hangs)`);
- passes `cargo test --workspace --no-fail-fast` clean:
  228 passed; 0 failed; 19 ignored across all crates
  (`resharp-engine` per-binary totals: 1 + 2 + 1 + 95 + 0 + 72 + 3
  - 1 + 36 + 1 + 5 + 11; `resharp-algebra`, `resharp-parser`,
    `resharp-ffi`: empty/empty/empty).

Re-validated 2026-05-23 against the current HEAD
`e0b8aba96f0c1987f9802498e585b5e88966023b` (9 commits past the original
`6f445d7` prototype base, which itself declared 0.6.0; HEAD declares
0.6.3). On a fresh local clone the literal two-hunk diff below applies
cleanly (`git apply --check` succeeds). With it applied,
`abc~(\w)&(?:aaa)*` compiles in milliseconds and `is_match` returns
`false` for every input in `{"", "abc", "aaa", "abcaaa", "aaaaaa",
"abc!", "abcaaab"}`. `cargo test --workspace --no-fail-fast` reports
`231 passed; 0 failed; 19 ignored` both with and without the patch (the
unpatched baseline on HEAD is also `231/0/19`), so the fix remains purely
additive and regresses nothing on current `main`. The `46 active
prefix.toml cases` figure from the `6f445d7` audit predates later test
additions; the current `231/0/19` workspace run subsumes it.

### Verification

The original hang was located with probe binaries at
`/tmp/probe-slow-unit/src/bin/bisect5.rs` and `bisect6.rs` (a separate
thread with a configurable timeout), plus `hangtrace.rs` and an
instrumented resharp build. The in-tree tests
`complement_intersection_quantified_group_fires` and the end-to-end
pipeline verify the pre-validator skips the trigger.

The 2026-05-23 re-validation repeated the worker-thread-with-timeout
method against fresh clones of HEAD `e0b8aba`. Unpatched: the trigger
hangs past 10s. Patched (literal diff below applied via `git apply`):
the trigger compiles in milliseconds, `is_match` returns `false` on the
seven-input probe set, and `cargo test --workspace --no-fail-fast` is
`231 passed; 0 failed; 19 ignored`, identical to the unpatched baseline.

---

## Bug F: nested lookahead inside a quantified group overflows `attempt_rw_concat_2`

### Symptom

A rule that nests a lookahead inside a quantified group whose outer quantifier
has min >= 2 panics at compile time during `Regex::new` under `overflow-checks`
(and silently wraps without it), at the same site as Bug C:

```text
thread 'main' panicked at resharp-algebra/src/lib.rs:2479:   # :2470 in 0.6.0
attempt to add with overflow
```

Reproducers (all confirmed panicking on unpatched HEAD `e0b8aba`, 2026-05-23):

```text
(?:(?!\?){1,2}){3}
(?:(?:(?!\?)){1,5}){2,4}
(?:(?!abc)){4,12}a
```

### Root cause

The same overflowing add as Bug C: `tail_rel + la_rel` (both `u32`) in
`attempt_rw_concat_2` (`resharp-algebra/src/lib.rs:2479` at HEAD). The
nested-lookahead-in-quantified-group shape drives the lookahead-chain `rel` to
saturate, and the next add exceeds `u32::MAX`. Bug C and Bug F are two surface
triggers reaching one defective add, so one fix resolves both.

### Defense

The pre-validator `nested_lookahead_in_quantified_group` in
`packages/cli/forbidden-strings/src/rules/engine.rs` rejects the shape before
`Regex::new`. Its doc comment previously claimed this was "Filed upstream: see
TROUBLESHOOTING.resharp.md Bug F"; that was inaccurate (no upstream issue, no
such section) until this section and the merged issue were written.

### Prototype fix

Shared with Bug C: `tail_rel.saturating_add(la_rel)`. See "Prototype fixes".

### Verification

Probe crate against the patched HEAD clone: all three reproducers move from
`COMPILE-PANIC` (unpatched) to `COMPILE-OK` (patched), in debug and release.

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
adversarial input (the class Bug B belonged to) is not re-probed here; it is
left to the next fuzz re-run on the published 0.6.4 build, already on the
plan above.

### Confirmed fixed at 0.6.4 (Bugs B, C, E, F)

The 0.6.4 fix commit `bd780ef` is present at HEAD and matches the prototype
patch (see "Upstream response" above). Re-reading the source confirms each
fix is in place:

- Bug E: the `visited` set plus clear-and-break is at
  `resharp-engine/src/prefix.rs:26-35`.
- Bug C / Bug F: `tail_rel.saturating_add(la_rel)` is at
  `resharp-algebra/src/lib.rs:2480`.
- Bug B: the fail-closed `Err(UnsupportedPattern)` replaces the
  postcondition `debug_assert!` in `strip_lb`
  (`resharp-algebra/src/lib.rs:2010-2011`).

Behavioural re-fuzzing against the published 0.6.4 build is still the
pending step recorded in the plan above; this pass read source and ran
targeted probes, it did not re-run the fuzz targets.

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
- Debug profile (the package's `cargo test` and the fuzz targets, large
  stack frames): every nesting kind, including plain `(...)`, overflows at
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
bump (the maintainer's "coming days" follow-up that re-allows the Bug B
patterns), folding Bug G into the same single bump-and-re-fuzz pass the plan
near the top of this doc describes. Re-run `git apply --check` of the
prototype diff against that release before filing, since resharp's `main`
moves fast.

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
asymmetry suggests the max was hardened (consistent with the Bug C and F
overflow awareness) while the min was missed. It is not reachable under
default limits: min-length accumulates through concatenation and is bounded
by the expanded node count, which `expanded_ast_limit` (50,000) caps far
below `u32::MAX`, so `lmin + rmin` cannot overflow for any pattern the
parser accepts. Latent defensive-consistency issue; the one-line fix is
`lmin.saturating_add(rmin)`. Flagged, not a live bug.

### Flag I: 0.6.4 `strip_lb` fail-closed rejects lookbehind shapes beyond the intersection case

`resharp-algebra/src/lib.rs:2005-2014`. The Bug B fix made `strip_lb`
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

## Prototype fixes (verified 2026-05-23)

Per the `troubleshooting-doc` skill's auto-prototype rule (when constraints 1-4
hold or sorta-hold, prototype the minimal fix rather than stopping at
"constraint 5: not yet"), each still-live bug has a minimal fix prototyped in a
fresh `mktemp -d` clone of `https://github.com/ieviev/resharp` at HEAD
`e0b8aba` (origin and commit verified before editing). The combined patch is
[resharp.patch](resharp.patch); the merged
upstream issue body is the out-of-band local file `resharp-merged-issue.local.md` (gitignored, not committed).

Each fix was verified with a targeted probe crate (its own program calling
`resharp`, run in debug and release) showing the failure pre-patch and correct
behaviour post-patch. The combined patch was then regression-checked:

```text
git apply --check resharp.patch   # applies cleanly to e0b8aba
cargo test --workspace --no-fail-fast
# 231 passed; 0 failed; 19 ignored  (identical to the unpatched baseline)
```

resharp has no `build.rs`, so the test run executed no upstream build scripts; it
ran on the host (the skill's sandbox rule targets untrusted build scripts).

- **Bug E** (`resharp-engine/src/prefix.rs`): add a `visited` set and
  clear-and-break on a fresh revisit, keeping the boundary-wrap path separate.
  Trigger `abc~(\w)&(?:aaa)*` goes from hang to compiling in milliseconds;
  `is_match` returns `false` on all probe inputs (the empty language).
- **Bug C + F** (`resharp-algebra/src/lib.rs:2479`): `tail_rel + la_rel` becomes
  `tail_rel.saturating_add(la_rel)`. The `else` arm already uses `u32::MAX` as
  the unbounded sentinel, so this is the existing semantics. Every Bug C and Bug
  F reproducer goes from COMPILE-PANIC to COMPILE-OK.
- **Bug B** (`resharp-algebra/src/lib.rs` `strip_lb`): replace the
  post-condition `debug_assert!` with a real
  `if self.contains_lookbehind(result) { return Err(UnsupportedPattern) }`. All
  five callers already handle the `Err` path. `(?:(?=a)&(?<=_))` goes from
  debug-panic / release-62-spurious-matches to a clean `Err(UnsupportedPattern)`
  at `Regex::new` in both profiles: fail-closed, no corruption.
- **Bug A wording** (`resharp-algebra/src/lib.rs:35`): improve the
  `UnsupportedPattern` render string to name the common triggers. Honest scope:
  the variant is constructed at six sites with one shared static string, so this
  is a legibility nudge, not a per-site trigger-naming fix; the latter needs
  splitting the variant or threading context (larger, still localized). The
  behavioural Bug A fix (actually supporting complement-of-lookaround) is the
  architectural change in Bug A's draft and is deliberately NOT prototyped.

## Five-constraint audit for Bugs B and C (now prototyped, in the merged issue)

Bug D was in this deferred set in the earlier write-up but is now fixed
upstream (see Bug D's status note); it is dropped here and must not be
filed. The same five-constraint policy applies (see Bug A's "Why we do
not file this upstream" subsection) to the two that remain. For Bug B
(`strip_lb` debug_assert with release silent-corruption) and Bug C
(algebra arithmetic overflow), the constraints land:

1. **Upstream's fault?** Yes for both. A `debug_assert!` whose absence
   produces silently corrupted output is a defect; an algebra add that
   overflows for a parser-reachable input shape is a defect.
2. **Can upstream fix?** Yes. Bug B is fixing `strip_lb_inner` so it
   actually removes the lookbehind from an intersection operand (or
   promoting the `debug_assert!` to fire in release once the invariant
   holds). Bug C is locating which add overflows in `attempt_rw_concat_2`
   and either widening the type or adding a checked-add path.
3. **Supporting this use case?** Mixed. Intersection (`&`) and
   complement (`~`) are headline features of resharp; combining them
   with lookarounds is the natural way to write the "match A but not
   when X" exclusion pattern. No documented restriction.
4. **Likely to fix?** Unknown. The 0.6.0 to 0.6.3 releases relocated
   Bug B's assertion (into `strip_lb`) but did not resolve it, and did
   not touch Bug C's overflowing add beyond line drift.
   Resolved 2026-05-23: the maintainer shipped our prototype as the 0.6.4
   fix the same day the issue was filed. Bug B is the fail-closed `Err` in
   `strip_lb` (`resharp-algebra/src/lib.rs:2011`) and Bug C is
   `saturating_add` (`:2480`); see "Upstream response (2026-05-23)" above.
   Behavioural re-confirmation against the published build is the only
   step left.
5. **Have we prototyped a minimal fix?** Yes, as of 2026-05-23. Bug B:
   fail-closed `Err` in `strip_lb`. Bug C: `saturating_add` in
   `attempt_rw_concat_2` (shared with Bug F). Both verified against HEAD
   `e0b8aba` and regression-clean; see the "Prototype fixes" section.

All five constraints now pass for Bugs B and C, so they are folded into
the merged upstream issue rather than deferred. The pre-validators and
profile settings remain the durable consumer-side fix regardless of
upstream movement.

Bug E (the `calc_prefix_sets_inner` non-termination) was the first with a
minimal-patch prototype satisfying constraint 5; Bugs B, C, and F now have
prototypes too (see "Prototype fixes").
Prototyped against `https://github.com/ieviev/resharp.git` HEAD
`6f445d71b194161adc0efe968d723312b6856a26` (declared version 0.6.0
in `Cargo.toml`, 2026-05-15) in a fresh `mktemp -d` clone. The
initially-proposed single-line patch regressed 9 of 46 active cases
in `resharp-engine/tests/prefix.toml`; the verified prototype is a
two-hunk additive variant (`visited` set plus fresh-revisit clear)
that passed `cargo test --workspace --no-fail-fast` with 228 passed,
0 failed, 19 ignored on that base. Re-validated 2026-05-23 against the
current HEAD `e0b8aba` (the literal diff applies cleanly and the suite
is 231/0/19 both with and without it). See Bug E's "Suggested upstream
fix" subsection above for the diff, the audit method, and the
language-emptiness check on the Bug E trigger pattern. Draft upstream
issue body is below.

Re-evaluation of constraints 2 and 4 in light of the obstacle:

- **Constraint 2 (can upstream fix?)** Downgrades from "single
  line" to "two hunks adding four lines (one new `BTreeSet` plus
  one bounded check); additive only, no behaviour change in any
  existing exit path." Still small and contained to one function.
- **Constraint 4 (will they likely fix?)** Unchanged at "plausible."
  The fix sits inside a function the project already maintains
  (the `redundant` set is the prior author's own cycle-detection
  scaffolding), and the patch reuses the same vocabulary. No
  algebraic-core changes. Borne out: 0.6.4 shipped this exact two-hunk
  `visited`-set patch (`resharp-engine/src/prefix.rs:33`) the day the
  issue was filed (see "Upstream response (2026-05-23)" above);
  behavioural re-confirmation against the published build is the only step
  left.

### Draft upstream issue body for Bug E (filed in merged issue #5)

This per-bug draft was folded into the merged upstream issue
ieviev/resharp#5 (filed 2026-05-23 against HEAD `e0b8aba`); it is kept
here as a standalone reference. If a maintainer re-tests against a later
`main`, re-run `git apply --check` of the diff below first, since
resharp's main branch moves fast.

````md
**Title:** non-termination in `prefix::calc_prefix_sets_inner` for `~(...)&(...)*` patterns

**Labels:** `bug`, `engine`

## Description

`resharp::Regex::new` does not return for patterns combining a literal
prefix, a complement (`~(...)`), an intersection (`&`), and a
quantified group (`(...)*`, `(...)+`, `(...){N}`, etc.). The hot loop
is at `resharp-engine/src/prefix.rs:27` inside
`calc_prefix_sets_inner`:

```rust
let mut redundant = BTreeSet::new();
redundant.insert(NodeId::BOT);
redundant.insert(start);

loop {
    if !result.is_empty() && redundant.contains(&node) {
        break;
    }
    // ... computes der, picks a single target ...
    node = target;
}
```

`redundant` is seeded with `BOT` and `start` and never updated. For
the trigger shape, the derivative chain produces a sequence of unique
fresh nodes that never wraps back to a seeded boundary node, never
becomes nullable, never self-loops, and never narrows to multiple
targets. The loop therefore runs without termination.

Minimum reproducer (bisected from a libFuzzer timeout artefact):

```rust
use resharp::Regex;
let _ = Regex::new(r"abc~(\w)&(?:aaa)*");  // never returns
```

Easiest way to reproduce as a regression test (worker thread with a
hard timeout, since `Regex::new` does not return on the trigger
pattern and no compile timeout is exposed):

```rust
use std::sync::mpsc;
use std::thread;
use std::time::Duration;

#[test]
fn bug_e_trigger_compiles_within_timeout() {
    const TRIGGER: &str = r"abc~(\w)&(?:aaa)*";
    let (tx, rx) = mpsc::channel();
    thread::Builder::new()
        .name("bug_e_compile".into())
        .stack_size(8 * 1024 * 1024)
        .spawn(move || {
            let _ = resharp::Regex::new(TRIGGER);
            let _ = tx.send(());
        })
        .unwrap();
    assert!(
        rx.recv_timeout(Duration::from_secs(10)).is_ok(),
        "Regex::new({TRIGGER:?}) hung",
    );
}
```

On unmodified `main` the test fails the 10 s timeout; on the
proposed patch it returns in milliseconds. A companion test that
calls `is_match` against `{"", "abc", "aaa", "abcaaa", "aaaaaa",
"abc!", "abcaaab"}` returns `false` for every input, consistent with
the empty language `abc~(\w) & (?:aaa)*` represents.

Stack trace at the hang point (captured 3 s into compile):

```
#0 resharp_algebra::RegexBuilder::collect_der_targets
#1 resharp_algebra::RegexBuilder::collect_der_targets
#2 resharp_algebra::RegexBuilder::collect_der_targets
#3 resharp::prefix::calc_prefix_sets_inner
#4 resharp::prefix::select_prefix
#5 resharp::Regex::from_node_inner
#6 resharp::Regex::with_options
#7 resharp::Regex::new
```

## Suggested fix

The intent of the existing outer check is to detect "the chain wrapped
back to a boundary node," which keeps the accumulated `result`. A
separate "fresh revisit" check is needed to detect "the chain entered
a cycle through previously visited non-boundary nodes," which should
clear `result` (matching the existing `target == node` self-loop
clearing semantics). Keeping these two semantics separate is what
makes the patch additive and non-regressive:

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

A simpler one-line variant (inserting every `target` into the
existing `redundant` set after `node = target`) was prototyped first
and rejected: it conflates the boundary-wrap and fresh-revisit
semantics, breaks 9 of 46 active cases in
`resharp-engine/tests/prefix.toml` (all anchored multi-character
`prefix_rev` cases collapse to their first character, e.g.
`prefix_twain` `"n;i;a;w;T"` -> `"n"`, and `unsat` flips from `""` to
`"o"`).

## Verification

Tested against `main` at
`e0b8aba96f0c1987f9802498e585b5e88966023b` (also validated earlier
against `6f445d7`).

```text
cargo test --workspace --no-fail-fast
# 231 passed; 0 failed; 19 ignored  (identical with and without the patch)
```

The two-hunk diff above applies cleanly to `main` via `git apply`; the
trigger `abc~(\w)&(?:aaa)*` then compiles in milliseconds, and `is_match`
returns `false` for `{"", "abc", "aaa", "abcaaa", "aaaaaa", "abc!",
"abcaaab"}`, consistent with the empty language it represents. Prototype
clone, reproducer, and audit harness are available on request.
````

---

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

Patch: `/tmp/agent/resharp-rev-bot-skip-test-calibration-0.6.8.patch`
(`resharp-engine/tests/engine_test.rs` only).

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

This is file-ready alongside the intersection/alternation fix. Filing stays held
for an explicit go-ahead. Per the Claude Code / out-of-scope exemptions this repo
follows for non-actionable upstream churn, a flaky timing assertion in a
dependency's own test suite would normally just be recorded here; the prototype
exists so the fix can be offered upstream cheaply if wanted.

[resharp]: https://github.com/ieviev/resharp
