# HANDOVER.forbidden-strings-fuzzing

State of the implementation of `~/.claude/plans/setup-fuzzing-for-forbidden-strings-merged.md`
when context approached compaction. Resume from here after compact.

## Overall task

Implement coverage-guided fuzzing for `packages/cli/forbidden-strings`
using cargo-fuzz, a `fuzz_api` Cargo feature, a structured generator,
curated seeds, a dictionary, and bounded local verification. CI is
deferred. Final criterion is **soundness-by-revert** — confirm
`fuzz_extract_gate_soundness` catches a real bug when run against a
reverted commit.

Plan path: `/home/user/.claude/plans/setup-fuzzing-for-forbidden-strings-merged.md`.

## Environment notes (verified, important)

- Nightly Rust toolchain installed locally:
  `nightly-x86_64-unknown-linux-gnu` (rustc 1.97.0-nightly, d7f14d3d8 2026-05-15).
  Active default toolchain is still 1.95.0 stable; use `cargo +nightly` for fuzz commands.
- `cargo-fuzz 0.13.1` installed via `cargo install cargo-fuzz --version 0.13.1 --locked`.
  Binary lives at `/home/user/.cargo/bin/cargo-fuzz`.
- `cargo +nightly fuzz build` succeeds on the bare scaffold (verified — 18s cold).
- `mise run lint`, `mise run lint:clippy`, and `mise run test` for
  `packages/cli/forbidden-strings` all pass with the lib extraction and
  fuzz_api in place.

## Commits landed (in order, most recent first)

```text
4a1fe951 build(forbidden-strings): scaffold cargo-fuzz workspace
4225d7ef feat(forbidden-strings): expose internals to fuzz targets via fuzz_api feature
cfc33f68 refactor(forbidden-strings): extract library boundary with run_cli_from_env
5ebe3ed1 docs(forbidden-strings): record fuzzing-tool decision
```

## Plan phases — status

| Phase | Plan §                                         | Status  | Notes                                                                                                                                                                                                                                                                                                                                                                                             |
| ----- | ---------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Prepare editing context                        | DONE    | dum-dum-non-ts SKILL.md read; package scouted.                                                                                                                                                                                                                                                                                                                                                    |
| 2     | Decision doc                                   | DONE    | `docs/decisions/forbidden-strings-fuzzing.md` committed (5ebe3ed1).                                                                                                                                                                                                                                                                                                                               |
| 3     | Library extraction                             | DONE    | `src/lib.rs` + `run_cli_from_env()` committed (cfc33f68). Integration tests pass.                                                                                                                                                                                                                                                                                                                 |
| 4     | Fuzz-only API surface                          | DONE    | `[features] fuzzing = []`, `src/fuzz_api.rs`, `compile_rule_src`, `load_ruleset_from_source`. Committed (4225d7ef). `cargo check --features fuzzing` passes.                                                                                                                                                                                                                                      |
| 5     | Scaffold cargo-fuzz                            | PARTIAL | Workspace materialized via `cargo +nightly fuzz init --fuzzing-workspace=true`. Cargo.toml wired for the `fuzzing` feature + arbitrary + sha2 + panic=unwind. `fuzz/.gitignore` ignores corpus growth, keeps `seed-*` files. Root `.gitignore` re-includes `fuzz/Cargo.lock`. Committed (4a1fe951). **PLACEHOLDER `fuzz_targets/fuzz_target_1.rs` STILL PRESENT** — delete it when phase 7 lands. |
| 6     | Shared structured generator                    | TODO    | `fuzz/src/generators.rs` (the file does not exist yet — `src/` dir is unmaterialized).                                                                                                                                                                                                                                                                                                            |
| 7     | Prioritized fuzz targets                       | TODO    | None of the 7 targets written. Each goes in `fuzz/fuzz_targets/`.                                                                                                                                                                                                                                                                                                                                 |
| 8     | Dictionary and curated seeds                   | TODO    | `fuzz/dictionaries/forbidden-strings.dict` + `fuzz/src/bin/seed-from-tests.rs`.                                                                                                                                                                                                                                                                                                                   |
| 9     | Tooling integration                            | TODO    | Root `mise.toml` `[tools]` `cargo:cargo-fuzz = "0.13.1"` not yet added. Per-package nightly pinning not yet added. Package `mise.toml` tasks not yet added.                                                                                                                                                                                                                                       |
| 10    | Documentation                                  | TODO    | README/FUZZING/PERF updates.                                                                                                                                                                                                                                                                                                                                                                      |
| 11    | Final verification (incl. soundness-by-revert) | TODO    | The soundness validation is the load-bearing Done criterion — proves `fuzz_extract_gate_soundness` is real. Use a disposable worktree, revert `e49d8694`, run for 120s, confirm failure with a redacted reproducer.                                                                                                                                                                               |

## What's in the scaffolded fuzz/ directory right now

```
packages/cli/forbidden-strings/fuzz/
├── .gitignore          # ignores target, artifacts, coverage, corpus/*/* (except seed-*)
├── Cargo.lock          # ✅ tracked via root .gitignore re-include
├── Cargo.toml          # wired with libfuzzer-sys (arbitrary-derive), arbitrary, sha2,
│                       # forbidden-strings (features=["fuzzing"]), panic=unwind override
└── fuzz_targets/
    └── fuzz_target_1.rs  # cargo-fuzz placeholder; delete in phase 7
```

The `src/` and `src/bin/` and `dictionaries/` and `corpus/` subdirectories do NOT exist yet.

## Next session — concrete steps to resume

### Step A — Add the structured generator (phase 6)

Create `fuzz/src/generators.rs`. The file must define `Arbitrary`-deriving
types that bound the generated pattern source. Plan §6 lists the exact
caps: literal atoms ≤16 B, concats ≤4 elements, alternations ≤3 branches,
depth ≤6, set-algebra nodes ≤2, content ≤4 KiB. Constructs the generator
must be able to reach are also listed in §6 (inline/scoped flags,
non-capturing groups, classes, quantifiers, lookarounds, resharp algebra,
the bare `_` triad, escaped lookalikes, Unicode WS bytes).

Suggested module layout: a `RuleSrc` type that derives `Arbitrary` and
serialises to a regex source string, plus a `Content` type that derives
`Arbitrary` and bounds at 4 KiB. Bias content toward rendered literals
plus single-byte mutations (per §6 final bullet).

Reference this file from every fuzz target via
`use forbidden_strings_fuzz::generators::*;` once the lib target is
declared in `fuzz/Cargo.toml`. (Currently `fuzz/Cargo.toml` only has
[[bin]] entries; you'll need to add `[lib] path = "src/lib.rs"` and a
`src/lib.rs` that re-exports the generators module.)

### Step B — Write the 7 fuzz targets (phase 7)

For each target listed in plan §7, create `fuzz/fuzz_targets/<name>.rs`
and add a matching `[[bin]]` block to `fuzz/Cargo.toml`. Order by
priority:

1. **`fuzz_extract_gate_soundness`** — primary. Per §7.1: assert that for
   every regex match in haystack, at least one extracted gate substring
   from `extract_gating_substrings` is present in the haystack under the
   gate's case-sensitivity mode. Use `compile_rule_src` so the fuzzer and
   production share the compile path. Reject oversized patterns, compile
   failures, and zero-match cases. Panic message: pattern source +
   content length + SHA-256 hex digest only (never raw bytes).
2. **`fuzz_ruleset_scan_invariants`** — build a bounded ruleset, run
   `scan_content`, assert: every hit re-checks via regex on raw bytes,
   no column counter crosses UTF-8 boundary, hit set invariant to rayon
   thread count, hit set invariant to rule order, hit format matches the
   `path:line:cols rule=N` shape.
3. **`fuzz_regex_engine_dispatch`** — assert resharp-only constructs
   route to resharp; plain constructs route to `regex` crate. For the
   feature subset both engines agree on, compare `is_match` and non-empty
   `find_all` on bounded haystacks. Gate the comparison via
   `both_engines_agree(src)` so the target stays sound as either engine
   evolves.
4. **`fuzz_regex_syntax_walkers`** — panic-freedom + index invariants for
   `group_body_start`, `find_matching_close_paren`, `skip_any_quantifier`,
   `quantifier_is_required`, `skip_class_body`, `walk_literal_bytes`.
5. **`fuzz_scan_format`** — line-index construction, byte-to-line/column,
   hit-end clipping, `format_hit` redaction. Negative invariant: the
   formatted hit never contains any matched byte from the content slice.
6. **`fuzz_residual_shards`** — each input regex appears exactly once
   across shards; if any member regex matches a haystack, the combined-
   shard gate returns `Ok(true)` or `Err(())`, never `Ok(false)`.
7. **`fuzz_literal_roundtrip`** — keep only if cheap.

Delete `fuzz/fuzz_targets/fuzz_target_1.rs` when the first real target
lands.

### Step C — Dictionary and seeder (phase 8)

- Write `fuzz/dictionaries/forbidden-strings.dict` per plan §8.1. Token
  list is exhaustive there.
- Write `fuzz/src/bin/seed-from-tests.rs` per §8.2. It extracts byte
  literals from `src/rules/extract_tests.rs`, `atom_tests.rs`,
  `engine_tests.rs`, `algebra_tests.rs` and writes them to
  `fuzz/corpus/<target>/seed-<sha>` (the `seed-*` prefix matches the
  `.gitignore` re-include). At runtime, verify with `git check-ignore`
  that the seeder never reads `forbidden-strings.local.txt`.

### Step D — Tooling integration (phase 9)

1. Root `mise.toml` `[tools]` — add `"cargo:cargo-fuzz" = "0.13.1"`
   next to the existing `"cargo:fastmod"`.
2. Per-package nightly pinning — either add to
   `packages/cli/forbidden-strings/mise.toml` `[tools]` (preferred per
   plan), or set `RUSTUP_TOOLCHAIN=nightly` per fuzz task as the
   fallback. The simpler fallback is fine; nightly is currently
   installed system-wide.
3. Add to `packages/cli/forbidden-strings/mise.toml` `[tasks.fuzz:list]`,
   `[tasks.fuzz:build]`, `[tasks.fuzz:smoke]`, `[tasks.fuzz:run]`,
   `[tasks.fuzz:seed]`. Plan §9.3 spells out the command bodies.
4. **DO NOT** add a `fuzz:install` task — mise's tool system handles
   installation (per plan §9.4).
5. Document the bounded container wrapper in README:
   `podman run --memory=2g --cpus=2 --rm -v "$PWD":/work -w /work <image> mise run //packages/cli/forbidden-strings:fuzz:build`.

### Step E — Documentation (phase 10)

Update `packages/cli/forbidden-strings/README.md` with the sections in
plan §10.1. Split into a dedicated `FUZZING.md` only if README exceeds
120 lines after the additions.

PERF.md: only add findings if fuzzing surfaces a compile-time or
scan-time cliff during smoke runs. If smoke is clean, no PERF.md edit
needed.

### Step F — Final verification (phase 11)

Run in order:

1. `mise run //packages/cli/forbidden-strings:build`
2. `mise run //packages/cli/forbidden-strings:test`
3. `mise run //packages/cli/forbidden-strings:lint`
4. `mise run //packages/cli/forbidden-strings:lint:clippy`
5. Release binary CLI smoke (any temp file with a known rule).
6. `mise run //packages/cli/forbidden-strings:fuzz:build` inside the
   container wrapper.
7. `mise run //packages/cli/forbidden-strings:fuzz:smoke` inside the
   container wrapper.
8. `git check-ignore -v packages/cli/forbidden-strings/fuzz/Cargo.lock`
   must report the re-include rule (verified — currently passes).
9. Sentinel commands from AGENTS.md "Git cleanup and worktree safety
   reviews" to confirm no fuzz output escapes the ignore set.
10. **Soundness-by-revert (load-bearing!)**:
    - Create a disposable worktree from current `main`.
    - In the worktree, `git revert --no-commit e49d8694` (the `(?u)`
      extraction skip fix).
    - Run `mise run //packages/cli/forbidden-strings:fuzz:run -- fuzz_extract_gate_soundness -max_total_time=120`.
    - Confirm the target reports a soundness failure with a redacted
      reproducer (no raw secret-like bytes).
    - Remove the worktree.

### Phase 11 partial status (post resharp 0.6.0 bump, 2026-05-16)

- Steps 1-4 PASS against resharp 0.6.0 (121 unit + 19 integration tests,
  zero lint warnings, zero clippy warnings).
- Step 6 (fuzz:build) PASSES against resharp 0.6.0. Resolved a
  cargo-fuzz 0.13.1 vs musl-vs-ASAN incompatibility by threading
  `--target x86_64-unknown-linux-gnu` through `fuzz:build`,
  `fuzz:smoke`, and `fuzz:run` in commit `7b2caf88`.
- `fuzz:run` arg-spread bug fixed in commit `202ed6b6`. Root cause:
  mise/usage formats the `[args]` variadic env var as a shell-quoted
  concatenation (`'-a' '-b'`) so a downstream POSIX shell can re-split
  safely; the nushell `split row ' '` split on every space and kept
  the surrounding quotes inside each element, so cargo forwarded them
  to libfuzzer as `'-max_total_time=10'` (literal). libfuzzer treated
  anything not starting with `-` as a corpus directory and errored.
  Fix: split on the inter-arg separator `"' '"` and trim the lone
  outer quotes off the first and last elements.
- Step 5, 7-9 NOT YET RUN against 0.6.0.
- Step 10 (soundness-by-revert) STILL BLOCKED, and the 60 s fuzz
  gate on main is now BROKEN. Late-2026-05-16 session findings, in
  the order they crystallised:

  - `cd9b2dbf` (stacked-quantifier pre-validator) catches
    bare-stacked source (`a**`, `\D{5,11}{5,11}`) but the fuzz
    target's `Node::Quant` renderer at
    `fuzz/src/generators.rs:1292-1300` always wraps the
    quantified atom in `(?:...)`. So the fuzz NEVER emits
    bare-stacked; the pre-validator is a no-op for the fuzz
    target. Its unit tests pass because they hand-write
    bare-stacked sources the fuzz cannot produce. The actual
    slow shape the fuzz hits is **grouped-via-`(?:)` nested
    quantifiers** at depth 4+. `compile_rule_src` on
    `(?iu)(?:(?:(?:(?:(?:\d){5,11}){5,11}){5,11}){5,11}){5,11}(?:(?:(?:(?:(?:\d)*)*)*)*)*aa`
    (the rendered form of the original slow-unit) takes ~3.26 s
    and errors with `CompiledTooBig`. The pre-validator must
    catch this grouped shape, not just bare-stacked.

  - `2f4d27b0` (Unicode literal alphabet widening) is necessary
    for phase 11's case-fold path. It also exposed two
    pre-existing crashes the fuzz now reaches within ~30 s on
    main:
    1. resharp `engine.rs:1020` `debug_assert!` panic on `&` +
       lookahead (`(?=`, `(?!`); covered today only for
       lookBEHIND by `intersection_with_lookbehind`.
    2. The grouped-quantifier slow-unit (above) re-saved at
       `slow-unit-0cfbc4b8b9945074fe5214a96c503f6e994e3b97`.

  - 60 s `fuzz:run fuzz_extract_gate_soundness` on main:
    BEFORE widening (commits through `cd9b2dbf`), TWO
    consecutive runs completed cleanly (9561 + 3858
    iterations). AFTER widening (`2f4d27b0` / re-applied as
    `4d5563cb`), the same command exits with libfuzzer
    status 77 within ~60 s on the new crash and slow-unit.
    The user explicitly chose to keep the widening
    ("Don't revert it") and continue fixing the exposed
    issues in a follow-up session. Revert commit `1976d0b9`
    is superseded by `4d5563cb`.

  - Manual probe (`/tmp/probe-slow-unit/`) against the
    reverted worktree confirms the e49d8694 soundness bug
    class IS reachable: `(?iu)café` vs content `CAFÉ`
    panics with the expected redacted reproducer.
    `synth_content`'s uniform-random byte mutations do not
    reliably converge on the `0xA9` -> `0x89` flip that turns
    `é` into `É`, which is why libfuzzer doesn't naturally
    find the shape even after widening. A bias in
    `synth_content`, or a deterministic seed in
    `fuzz/corpus/fuzz_extract_gate_soundness/`, would unblock.

  **Resume work for next session, in priority order:**
  1. Add a `nested_grouped_quantifier` pre-validator (or
     extend `stacked_quantifier`) so the fuzz's
     grouped-quantifier source shape rejects in microseconds
     instead of taking ~3 s + ASAN overhead. Algorithm: walk
     paren depth; count chains of `){quant}` adjacency;
     flag at depth 4+. Test against
     `fuzz/artifacts/fuzz_extract_gate_soundness/slow-unit-0cfbc4b8b9945074fe5214a96c503f6e994e3b97`.
  2. Generalise `intersection_with_lookbehind` to fire on
     intersection + lookaround in either direction (lookahead
     OR lookbehind). Test against
     `fuzz/artifacts/fuzz_extract_gate_soundness/crash-8cba104f0805ccb567513aff895398a4f652200c`.
  3. Confirm 60 s fuzz on main is clean again. This is the
     load-bearing gate.
  4. Re-run 120 s soundness-by-revert in the disposable
     worktree (recipe in commit `cd9b2dbf`'s body). If a
     SOUNDNESS PANIC still does not fire, the remaining gap
     is `synth_content` mutation coverage -- bias it to
     emit Unicode-case-flipped variants of any non-ASCII
     bytes in the rule's literals.

  The user's original task description ("content of many
  identical bytes (e.g. `a` * N, `r` * N)" as the slow-unit
  trigger) was inaccurate: the trigger is the regex's
  nested-quantifier shape; content size is incidental. Probe
  shows bare `a*a` on 100,000 `a`-bytes runs in 0.3 ms.
- Crash artifacts at `/tmp/fs-crash-artifacts/` were re-verified against
  the 0.6.0+fix binary (`128221b7`); both run in 0ms with no crash. See
  `HANDOVER.resharp-panic-fix.md` for details.
- Fresh bounded fuzz run (`fuzz_extract_gate_soundness` for ~45s
  against 0.6.0+fix) completed 4714 iterations with zero new crashes.
- During the 0.6.0 verification, a side-finding was recorded in
  `HANDOVER.resharp-panic-fix.md`: shape 2 (`scan_fwd_all` panic at
  `engine.rs:1020`) is behind a `debug_assert!` that compiles out in
  release. The pre-validator therefore stays as the primary defense for
  shape 2 in production; `catch_unwind` only matters in test/CI builds
  where `debug_assertions` is on. See `TROUBLESHOOTING.resharp.md` Bug B
  for details.

## Open questions / gotchas to remember

- **Soundness-by-revert is non-skippable.** Done criteria explicitly call
  this out. The whole point of the target is to prove it would catch a
  real bug; skipping the revert validation makes the target unproven.
- **Items widened from pub(crate) → pub.** `walk_literal_bytes`,
  `skip_atom_with_extract`, the 5 regex-syntax walkers are now `pub` in
  their submodules, but the submodules are still `mod` (private), so the
  items remain unreachable from outside the crate unless the `fuzzing`
  feature is active and a consumer reaches them via
  `forbidden_strings::fuzz_api::*`. Don't widen the submodules
  themselves to `pub mod`.
- **Refactored compile path.** Production now calls `compile_rule_src`
  exclusively. The old direct `Regex::new` block inside the load loop is
  gone. Error messages still match the previous shape
  (`rule on line N (resharp): ...` / `rule on line N (regex): ...`)
  because `compile_rule_src` returns `(resharp): ...`/`(regex): ...` and
  the loader prepends `rule on line N`.
- **`compile_plain_rule` was removed.** It became dead code after the
  refactor and was deleted. Don't be surprised that the function is
  gone; `compile_plain_rule_to_compiled` is its replacement.
- **`load_ruleset_from_source(content, label)`** has an unused `_label`
  parameter today — present for future error-context use.
- **`fuzz/Cargo.toml` needs a `[lib]` entry** once the generators
  module lands, so each target can `use forbidden_strings_fuzz::generators::*;`.
  Right now there are only `[[bin]]` entries.
- **`mise run` commands use nushell**, not bash. The fuzz:smoke task
  spec in plan §9.3 mentions "nushell loop over fuzz:list output";
  use `;` for sequencing, not `&&`.
- **Resource-exhaustion isolation rule** (AGENTS.md): all fuzz commands
  must run inside the bounded container wrapper. Document it; don't
  remove the wrapper for convenience.
- **Bash piping is unreliable** per AGENTS.md "Visible terminal
  spawning". Don't pipe in mise task bodies; use intermediate files.

## Reference paths

- Plan: `/home/user/.claude/plans/setup-fuzzing-for-forbidden-strings-merged.md`
- Decision doc: `docs/decisions/forbidden-strings-fuzzing.md`
- Lib boundary: `packages/cli/forbidden-strings/src/lib.rs`
- Fuzz API surface: `packages/cli/forbidden-strings/src/fuzz_api.rs`
- Fuzz scaffold: `packages/cli/forbidden-strings/fuzz/`
- Test fixture sources the seeder must read:
  `packages/cli/forbidden-strings/src/rules/{extract_tests,atom_tests,engine_tests,algebra_tests}.rs`
- The bug-fix commits motivating the soundness target:
  `e49d8694` (`(?u)` extraction skip), `e100659f` (bare `_` as wildcard
  in extractor), `9b41fca0` (route bare `_` to resharp), `1463c59b`
  (scoped `(?x:body)`), `0479371a` (unicode for `\s/\w/\d/\b`),
  `4289cdb3` (expand `\s` to Unicode-WS bytes).
