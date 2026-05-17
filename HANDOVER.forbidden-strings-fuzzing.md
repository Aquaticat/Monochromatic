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
- Step 6 (fuzz:build) PASSES if `--target x86_64-unknown-linux-gnu` is
  passed explicitly; cargo-fuzz 0.13.1 defaults to musl which conflicts
  with ASAN (`sanitizer is incompatible with statically linked libc`).
  The `fuzz:build` / `fuzz:smoke` / `fuzz:run` mise tasks need to be
  updated to thread the target flag through. Workaround for ad-hoc
  runs: `cd <package>; RUSTUP_TOOLCHAIN=nightly cargo fuzz run <target>
  --target x86_64-unknown-linux-gnu -- <libfuzzer-args>`.
- Step 5, 7-9 NOT YET RUN against 0.6.0.
- Step 10 (soundness-by-revert) PARTIAL: a 2026-05-16 attempt against a
  disposable worktree (`/tmp/fs-soundness-revert`, reverted `e49d8694`)
  hit a pre-existing slow-unit (input shape `a` * N, takes >60s per
  input even with `-timeout=60`) before reaching the (?u)-shape that
  would trigger the soundness panic. The slow-unit lives in our
  scanner/extractor path, NOT in resharp; unrelated to the 0.5.x→0.6.0
  bump. To complete the validation: (a) seed the fuzz corpus with a
  small (?u)-shape input so libfuzzer reaches the bug fast, or (b) fix
  the slow-unit so the fuzz has budget to explore Unicode patterns.
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
