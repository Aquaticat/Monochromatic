# HANDOVER.resharp-panic-fix

State of the fix for two upstream `resharp` panics surfaced by
`fuzz_extract_gate_soundness`. Originally written against resharp 0.5.x;
post-compact verification against resharp 0.6.0 (2026-05-16) confirmed
**both panic shapes still exist unchanged at the same source lines**.
The pre-validators and `catch_unwind` net both remain load-bearing.

## Post-compact verification (resharp 0.6.0, 2026-05-16)

- Bumped `resharp = "0.5.2"` → `resharp = "0.6"` in
  `packages/cli/forbidden-strings/Cargo.toml`. Clean build (19s),
  no API breakage; `Regex::new` / `find_all` / `is_match` / `Match`
  signatures unchanged across the 0.5.x → 0.6.0 bump.
- 121 unit + 19 integration tests all pass against 0.6.0.
- Direct probe at `/tmp/probe-resharp-06` (resharp 0.6, RUSTFLAGS
  matching cargo-fuzz defaults) reproduces BOTH crashes at the SAME
  source lines:
  - Shape 1 (compile, `attempt to add with overflow`):
    `resharp-algebra/src/lib.rs:2470`
  - Shape 2 (runtime, `unexpected end 0 > N`):
    `resharp/src/engine.rs:1020`
- Discovered during 0.6.0 probing: shape 2's panic is behind a
  `debug_assert!`. With `debug_assertions` OFF (release default,
  which is our build config), the path does NOT panic; instead it
  returns corrupted matches. The probe shows 62 spurious matches on
  a 64-byte input. **This means `catch_unwind` cannot help in
  release for shape 2; the pre-validator is the only defense.**
- Decision: KEEP both layers (pre-validators + catch_unwind +
  profile settings). All three are load-bearing for at least one
  shape; none are now-redundant.
- Updated `TROUBLESHOOTING.resharp.md` to add Bug B (intersection
  with lookbehind, silent-corruption-in-release) and Bug C
  (intersection with `\w` and `$`, overflow-checks-load-bearing).
- Version-pinned comments in
  `packages/cli/forbidden-strings/src/{rules.rs,rules/engine.rs,
  rules/engine_tests.rs,lib.rs}` updated to read "resharp 0.5.x
  through 0.6.x" so future readers know the bugs are not fixed.

Verified post-fix against the preserved crash artifacts:

- `crash-aba4ef4e00b9a1cde5962347c98cccd0b29b9174` (shape 1, runtime
  panic in 0.5.x): runs in 0ms against the 0.6.0+fix binary; no crash.
- `crash-ecaf28b2bdba9b7ae1f7b465ea6ff2bc77b8458a` (shape 2, compile
  panic in 0.5.x): runs in 0ms against the 0.6.0+fix binary; no crash.

Both artifacts now exit cleanly. Combined with the direct probe showing
0.6.0 still panics on the same source lines when invoked without our
guards, this is the proof that the pre-validators + catch_unwind +
profile settings handle the 0.5.x crash inputs correctly against 0.6.0.

Bounded fresh fuzz run: 4714 iterations of `fuzz_extract_gate_soundness`
in ~45 seconds against resharp 0.6.0, zero new crashes.

cargo-fuzz infrastructure note: cargo-fuzz 0.13.1 defaults to the musl
target which is incompatible with the ASAN flags it sets via RUSTFLAGS
(`sanitizer is incompatible with statically linked libc`). The
workaround is `--target x86_64-unknown-linux-gnu` explicitly on
`cargo fuzz build` / `cargo fuzz run`. Threaded through the mise
tasks (`fuzz:build`, `fuzz:smoke`, `fuzz:run`) in commit `7b2caf88`.

Still outstanding:

- Soundness-by-revert phase 11 validation: **partially resolved 2026-05-16**.
  - The original slow-unit (`(?iu)\D{5,11}{5,11}{5,11}{5,11}{5,11}\D*****aa`,
    bare-stacked nested bounded quantifiers) is fixed by commit `cd9b2dbf`
    (stacked-quantifier pre-validator). The 60s fuzz on main now completes
    cleanly (9561 iterations, zero halt). The user's task description
    ("content of many identical bytes (e.g. `a` * N, `r` * N)") was
    inaccurate -- the actual trigger is the regex's nested-quantifier
    shape, not content size; bare `a*a` on 100,000 `a`-bytes runs in
    0.3 ms in the probe.
  - Commit `2f4d27b0` widens the fuzz literal alphabet
    (`gen_literal_bytes`) to emit Unicode lowercase letter UTF-8 byte
    pairs (`é`, `ñ`, `ü`, `ö`, `ç`) so the generator can produce the
    non-ASCII-letter source shape the e49d8694 case-fold bug requires.
    The previous alphabet was ASCII-only; even with the slow-unit fix,
    the generator could never produce a bug-triggering literal without
    this widening.
  - Soundness-by-revert run with both fixes (worktree at HEAD, revert
    e49d8694, `-max_total_time=300`): the fuzz did NOT panic on the
    soundness assertion. Instead it hit:
    a. A new slow-unit shape (NOT bare-stacked but
       `(?:(?:(?:(?:[X]){N,M}){N,M}){N,M}){N,M}` nested grouped
       quantifiers, ~19s per iteration). The grouped-via-`(?:...)`
       form is functionally equivalent NFA explosion but is NOT
       caught by `stacked_quantifier` because `)` resets the
       just-consumed-quantifier state. Preserved as
       `slow-unit-baeaa70577c1281936c5ba737555026e04fb8231`.
    b. A resharp `engine.rs:1020` panic on shapes with `&`
       (intersection) + lookahead `(?=` / `(?!` (not lookbehind).
       The existing `intersection_with_lookbehind` pre-validator
       only catches the lookBEHIND variant; the lookAHEAD variant
       slips through and triggers the same code path in debug
       builds. In release the path returns corrupted matches (Bug
       B in TROUBLESHOOTING.resharp.md) -- documented but
       previously unreachable from the fuzz target due to the
       slow-unit halt blocking exploration.
  - Phase 11 success criteria (a SOUNDNESS PANIC with redacted
    reproducer) is NOT achieved by the current fixes alone. The
    blocker is no longer the slow-unit but the resharp lookahead+
    intersect panic, which fires before libFuzzer reaches a
    soundness-violating shape. Follow-ups needed:
    1. Extend `stacked_quantifier` (or add a sibling pre-validator)
       to catch grouped-via-`(?:...)` nested quantifiers at depth 4+.
    2. Generalise `intersection_with_lookbehind` to also catch
       `&` + lookahead, OR add a sibling for that shape.
    3. Re-run soundness-by-revert with both follow-ups in place.
  - Manually probed soundness: `(?iu)café` vs content `CAFÉ`
    triggers the expected soundness violation in the reverted
    worktree (probe at `/tmp/probe-slow-unit/`). The bug class is
    real; the fuzz target just cannot reach it yet without further
    pre-validator coverage.
- `/tmp/fs-fuzz-validate`, `/tmp/fs-soundness-revert`,
  `/tmp/fs-crash-artifacts/`, and `/tmp/probe-resharp-06/` all
  removed during cleanup. `/tmp/probe-slow-unit/` retained for the
  soundness-shape probe and the timing measurements that confirmed
  the original slow-unit's compile-time blowup (1.4 s unicode-off
  + 1.5 s unicode-on retry = 2.9 s per `compile_rule_src` call).
- `fuzz:run` arg-spread fixed in commit `202ed6b6`: mise's `usage_args`
  arrives shell-quoted (`'-a' '-b'`); the previous `split row ' '`
  kept the surrounding quotes as part of each element, so libfuzzer
  treated `'-max_total_time=10'` as a corpus directory. Now splits on
  the inter-arg `"' '"` boundary and trims the lone outer quotes.

---

## Original session notes (against resharp 0.5.x, pre-compact)

## What the user asked for

1. Fix two upstream resharp panics by **both** mechanisms:
   - `std::panic::catch_unwind` wrapping (defense in depth)
   - Pre-validator pre-flight rejection of known-bad shapes
2. **Do NOT** file upstream issues yet -- only update
   `TROUBLESHOOTING.resharp.md`.
3. Per their later note: do not skip when probing fails to reproduce;
   document any cargo-fuzz-vs-`cargo run` discrepancies in a separate
   TROUBLESHOOTING doc.
4. Per their final note: resharp 6.0 was released mid-task; finish
   current logical unit, write handover, commit, defer everything else.

## Status of the original task list

- [x] Identify exact regex source strings from crash inputs
- [x] Wrap `Regex::new` in `catch_unwind` inside `compile_rule_src`
- [x] Wrap resharp `find_all`/`is_match` in `catch_unwind` inside
      `CompiledRegex` methods
- [x] Add pre-validation for the two specific shapes
- [x] Add tests for both crash shapes (6 new tests in
      `src/rules/engine_tests.rs`)
- [x] Verify with mise tasks (build, test, lint, lint:clippy -- all pass)
- [x] Commit fixes (committed as `23ca7a1f` -- single commit, not the
      two-commit split originally planned, due to time pressure)
- [x] Bump to resharp 0.6.0 and re-verify (post-compact 2026-05-16)
- [x] Update `TROUBLESHOOTING.resharp.md` with 0.6.0 verification
      and the two new Bug B / Bug C sections
- [ ] Re-run both fuzz crash artifacts against the fix
      **(deferred to post-bump cleanup pass)**
- [ ] Soundness-by-revert validation **(deferred)**
- [ ] Update `HANDOVER.forbidden-strings-fuzzing.md` and clean up
      worktree/artifacts **(deferred)**

## What's landed in the working tree (uncommitted)

### `packages/cli/forbidden-strings/Cargo.toml`

`[profile.release]` changed:

- `panic = "abort"` → `panic = "unwind"`. `catch_unwind` cannot
  intercept under "abort" -- the process aborts before the unwind
  barrier runs.
- Added `overflow-checks = true`. Rust's default release profile
  silences integer-overflow panics, but resharp-algebra's
  `attempt_rw_concat_2` panic IS an overflow panic. Without
  overflow-checks the `add` wraps silently in production, building
  the wrong DFA → fail-open. With it the wrap becomes a real panic
  the wrapper intercepts.
- Long header comment above the profile block explains both
  load-bearing reasons.

This is the **critical** part of the fix. If only the catch_unwind
wrappers landed, crash 2 would still silently corrupt rules in
production builds.

### `packages/cli/forbidden-strings/src/rules.rs`

- Added `use std::panic::{catch_unwind, AssertUnwindSafe};` import
  with the rationale block above it.
- Re-export bundle widened:
  `pub use engine::{intersection_with_lookbehind,
   intersection_with_word_end_alternation, lookaround_in_complement,
   requires_resharp, CompiledRegex};`
- `compile_rule_src` now runs the two new pre-validators after
  `lookaround_in_complement`, and wraps the `Regex::new` call in
  `catch_unwind(AssertUnwindSafe(|| Regex::new(src)))`. Outer-`Err`
  arm of `catch_unwind` formats as:
  `"(resharp): panic during compile (upstream resharp 0.5.x bug). See TROUBLESHOOTING.resharp.md."`
- The crate-wide error shape is preserved: every error is still
  prefixed with `rule on line N (resharp): ...` by the outer loader.

### `packages/cli/forbidden-strings/src/rules/engine.rs`

- Added `use std::panic::{catch_unwind, AssertUnwindSafe};`. The
  import-site comment is the long-form primer explaining
  `UnwindSafe`, `AssertUnwindSafe`, `RefUnwindSafe`, mutex
  poisoning, soundness rationale.
- `CompiledRegex::find_all` and `CompiledRegex::is_match` both
  wrap their resharp branch in
  `catch_unwind(AssertUnwindSafe(|| re.<method>(content)))`. The
  match flattens `Result<Result<T, resharp::Error>, Panic>` into
  the existing `Result<T, ()>` contract. `Plain` branches are
  unchanged.
- Two new public pre-validators alongside `lookaround_in_complement`:
  - `intersection_with_lookbehind(src: &str) -> Option<String>`:
    fires when intersection `&` (outside class) AND a lookbehind
    `(?<=` or `(?<!` both appear in the source. Returns an
    actionable error message ending in the standard
    `TROUBLESHOOT_REF` ("See TROUBLESHOOTING.resharp.md ...").
  - `intersection_with_word_end_alternation(src: &str) -> Option<String>`:
    fires when intersection `&`, `\w` shorthand, and `$` end-anchor
    all appear in the source (all outside character classes).

Both detectors are single-pass byte walkers, mirror the style of
`lookaround_in_complement`, and skip escaped sequences and
character-class interiors.

### `packages/cli/forbidden-strings/src/rules/engine_tests.rs`

6 new tests at the end of the file:

- `intersection_with_lookbehind_fires_on_minimal_shape`
- `intersection_with_lookbehind_skips_safe_shapes`
- `intersection_with_word_end_alternation_fires_on_minimal_shape`
- `intersection_with_word_end_alternation_skips_safe_shapes`
- `compile_rule_src_does_not_panic_on_known_bad_shapes`
  (end-to-end -- drives `compile_rule_src` on every minimum
  reproducer; asserts `Err` rather than process panic)
- `find_all_catches_runtime_panic_via_catch_unwind`
  (bypasses pre-validators by calling `resharp::Regex::new` then
  `CompiledRegex::find_all`; asserts no panic propagates)

`mise run //packages/cli/forbidden-strings:test` reports 121 unit
tests passing (was 115 pre-patch). `cargo check` + `clippy --release
-- -D warnings` both clean.

## Bisection notes (worth saving even after resharp 6.0)

Reproducing requires `RUSTFLAGS="-C overflow-checks=on -C
debug-assertions=on"` (`cargo fuzz` sets these by default; plain
`cargo run --release` does NOT). This was the load-bearing clue --
without it both shapes silently return `Ok` instead of panicking
during ad-hoc probing.

### Crash 1 (runtime, `resharp/src/engine.rs:1020` "unexpected end")

Minimum reproducer: `(?:(?=a)&(?<=_))` with content ≥ 64 bytes.
Trigger: intersection where one side has a lookahead and the other
has a lookbehind (specifically `(?<=_)` -- bare `_` wildcard inside
the lookbehind matters; `(?<=b)` does NOT crash).

### Crash 2 (compile, `resharp-algebra/src/lib.rs:2470` "attempt to add with overflow")

Minimum reproducer: `(?:\w|$)(?:(?![1g]\_X)& a)` (no scoped flag
required). Trigger combination: alternation containing both `\w`
and `$`, concatenated with intersection `&` whose operand contains
a negative lookahead with a character class followed by additional
literal bytes.

Many minor variations PANIC; many superficially similar shapes
return `Algebra(UnsupportedPattern)` (clean Err, no panic):

- `(?:(?=a)&(?=b))` → Err (two lookaheads, not panic)
- `(?:(?<=a)&b)` → Err (lookbehind on left, plain on right)
- `(?:\w|$)&a` → Err (no neg-lookahead-with-class on either side)
- `(?u:~(\_))` → Ok (scoped-flag + escaped-_ + complement is fine
  in isolation -- the issue is the COMBINATION above)

So pre-validators 1 & 2 are **conservative supersets** of the
actual panic surface. They will reject some patterns that would
have returned `Err(UnsupportedPattern)` upstream -- which we
consider a wash, because both routes refuse the rule.

## What remains in `/tmp/`

- `/tmp/fs-crash-artifacts/crash-aba4ef4e...` (crash 1 artifact)
- `/tmp/fs-crash-artifacts/crash-ecaf28b2...` (crash 2 artifact)
- `/tmp/fs-fuzz-validate/` — disposable worktree at commit
  `c6792310` (the pre-fix state). The probe-shapes helper binary
  has been cleaned up. The worktree is no longer load-bearing;
  remove with `git worktree remove /tmp/fs-fuzz-validate --force`
  if the resharp-6.0 bump invalidates the 0.5.x crash artifacts.

## Resume after compact

**Step 1 (highest priority): bump resharp to 6.0.**

```bash
cd packages/cli/forbidden-strings
# Read upstream changelog before bumping; the API surface may have
# changed (Regex::new signature, find_all return shape, error type).
cargo update -p resharp --precise 6.0.0   # or `cargo add resharp@6` if needed
mise run //packages/cli/forbidden-strings:build
mise run //packages/cli/forbidden-strings:lint:clippy
mise run //packages/cli/forbidden-strings:test
```

Likely fallout to expect:
- `resharp::Error` variants may have moved or been renamed
  (used in `engine.rs` via `.map_err(|_| ())` -- which is
  variant-agnostic, so probably fine).
- `Regex::new` API stayed put in 0.5.x → 6.0 transitions is the
  typical Rust crate norm; verify before assuming.
- The two panic shapes MAY be fixed upstream. If `cargo +nightly
  fuzz run fuzz_extract_gate_soundness <artifact>` against the
  preserved crash artifacts no longer reproduces against
  resharp 6.0, the pre-validators are now unnecessary churn:
  consider removing them or keeping as defense-in-depth.

**Step 2: re-fuzz with resharp 6.0.**

Run the existing fuzz target for 120s (or 600s if no panic at 120s).
The artifacts under `/tmp/fs-crash-artifacts/` may no longer
reproduce; if they don't, generate fresh ones via a clean fuzz run
and document any NEW panic shapes.

**Step 3: TROUBLESHOOTING.resharp.md.**

Write against **resharp 6.0** shapes, not 0.5.x. If resharp 6.0
genuinely fixed both shapes, the doc shrinks to a one-line
"defense-in-depth catch_unwind + overflow-checks were added in
[commit] in case any future regression reintroduces this class."
If new panics appear, document each per the `troubleshooting-doc`
skill.

**Step 4: keep the load-bearing infrastructure.**

Regardless of resharp 6.0's bug fixes, **do NOT revert**:
- The `panic = "unwind"` + `overflow-checks = true` profile
  settings. These cost ~5% binary size for the safety net every
  future resharp release deserves.
- The `catch_unwind` wrappers in `engine.rs` and `rules.rs`.
  These are version-agnostic defense in depth.
- The 6 new unit tests (some will need their case lists trimmed
  if 6.0 changes which shapes are accepted vs error).

The pre-validators (`intersection_with_lookbehind`,
`intersection_with_word_end_alternation`) are the 0.5.x-specific
parts. Decide their fate based on the resharp 6.0 fuzz run:
- If 6.0 fixes both shapes → consider removing the pre-validators
  (smaller surface area, less to maintain). Keep their tests as
  "shapes that used to crash 0.5.x and now compile/error cleanly".
- If 6.0 leaves either shape broken → keep the pre-validator that
  matches the still-broken shape; remove the other.

**Step 5: soundness-by-revert (deferred from the original task).**

Once resharp 6.0 is wired up and the test suite passes, run the
soundness-by-revert validation per the plan (revert e49d8694, run
fuzz_extract_gate_soundness for 120s, expect the ORIGINAL soundness
panic). The point is unchanged: prove the primary fuzz target's
load-bearing claim.

## Verification commands that pass right now (against resharp 0.5.x)

```bash
mise run //packages/cli/forbidden-strings:build          # 18s clean compile
mise run //packages/cli/forbidden-strings:lint           # 0.2s
mise run //packages/cli/forbidden-strings:lint:clippy    # 0.2s, no warnings
mise run //packages/cli/forbidden-strings:test           # 121 unit + 19 integration, 0 fail
```

## Files touched (uncommitted)

```
modified:   packages/cli/forbidden-strings/Cargo.toml
modified:   packages/cli/forbidden-strings/src/rules.rs
modified:   packages/cli/forbidden-strings/src/rules/engine.rs
modified:   packages/cli/forbidden-strings/src/rules/engine_tests.rs
new file:   HANDOVER.resharp-panic-fix.md
```

## Recommended commit split (before compact, per CLAUDE.md eager-commit)

Two commits feel right:

1. `fix(forbidden-strings): make scanner panic-safe against resharp engine`
   - `Cargo.toml` profile (panic=unwind, overflow-checks=true)
   - `src/rules.rs` catch_unwind wrap on `Regex::new`
   - `src/rules/engine.rs` catch_unwind wraps on `find_all`/`is_match`
   - Subset of the new tests covering the catch_unwind paths
2. `fix(forbidden-strings): pre-validate resharp 0.5.x panic shapes`
   - `src/rules/engine.rs` two new pre-validators + their re-exports
   - `src/rules.rs` wiring `compile_rule_src` to call them
   - Remaining tests (pre-validator units + end-to-end
     `compile_rule_src_does_not_panic_on_known_bad_shapes`)

If the resharp 6.0 bump in the next session ends up removing the
pre-validators entirely, splitting the commits like this means a
single `git revert <commit 2>` cleans up without disturbing the
defense-in-depth changes. If they land as one commit, the bump
becomes a manual surgery.

## Open question / deferred decision

User said "do both fixes" (= catch_unwind + pre-validate). With
resharp 6.0 fixing the bugs upstream, the pre-validators become
0.5.x-only complexity. Should they be reverted as part of the
resharp bump, or kept as a belt-and-braces guard?

My read: revert if 6.0 demonstrably fixes both shapes. Keep the
catch_unwind + Cargo profile work always. But this is the user's
call -- surface it in the resharp-6.0-bump session.
