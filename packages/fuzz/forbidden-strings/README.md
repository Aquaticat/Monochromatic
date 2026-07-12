# Fuzzing forbidden-strings

Coverage-guided fuzzing for the scanner's regex routing,
 AC-gate
extractor,
 walker helpers,
 residual-shard partitioner,
 and hit
formatter.
 CI integration is **deferred**;
 targets are exercised
locally and on demand only.
 The rationale and rejected
alternatives are recorded in
[`docs/decisions/forbidden-strings-fuzzing.md`](../../../docs/decisions/forbidden-strings-fuzzing.md).

## Prerequisites

- Nightly Rust toolchain.
   `cargo-fuzz` injects
  `-Cllvm-args=-sanitizer-coverage-*` flags that only work on
  nightly.
   The toolchain is managed repo-wide in the root
  [`mise.no-env.toml`](../../../mise.no-env.toml) `[tools]` entry
  (`rust = { version = "nightly", components = "rust-src,llvm-tools-preview" }`),
  so `mise install` provisions nightly (with std sources and the
  llvm coverage tools) for every crate,
   and tasks run here inherit
  it.
   `llvm-tools-preview` supplies `llvm-cov` / `llvm-profdata` for
  `cargo fuzz coverage`.
- `cargo-fuzz` 0.13.1.
   Installed automatically by `mise install`
  from the root [`mise.no-env.toml`](../../../mise.no-env.toml)
  `[tools]` entry.
- A C++ toolchain (clang or gcc).
   `libfuzzer-sys` builds a small
  C++ runtime that the targets link against.
- `podman` (or `docker`) for the bounded-container wrapper
  described below.
- `resharp = "0.6"` is the pinned engine version (was 0.5.2).
   Replays of every
  0.5.2-era crash are recorded in
  [`docs/decisions/forbidden-strings-fuzzing.md`](../../../docs/decisions/forbidden-strings-fuzzing.md).

## Target list

Each target encodes one invariant.
 Failures are libFuzzer crashes
with a redacted reproducer (pattern source + content SHA-256,
 no
raw bytes).

All seven targets share a single tuned dictionary at
`dictionaries/forbidden-strings.dict` (one dictionary,
 not per-target).
 Each
target has its own per-target seed corpus under `seeds/<target>/`
(tracked),
 separate from the gitignored scratch corpus under
`corpus/<target>/`;
 fuzz invocations pass both as libFuzzer corpus
dirs with scratch first,
 so new discoveries land only in scratch.
 Crash
output uses a Unicode-literal-aware printable renderer (the May 2026 mojibake fix
in commit `099bfe84`).

- **`fuzz_extract_gate_soundness`** -- load-bearing primary.
  For every successful regex match,
   at least one extracted gate
  substring must appear in the content under the gate's
  case-sensitivity flag.
   Catches the AC-gate disable bug class
  behind commits e49d8694 / e100659f / 9b41fca0.
- **`fuzz_ruleset_scan_invariants`** -- hit-format shape,
   UTF-8
  column boundaries,
   position-in-content,
   rayon thread-count
  invariance,
   rule-order invariance.
- **`fuzz_regex_engine_dispatch`** -- routing correctness.
  AST resharp-only features imply `requires_resharp` returns
  true;
   `compile_rule_src`'s chosen `CompiledRegex` variant
  matches the classifier.
- **`fuzz_regex_syntax_walkers`** -- six index-walking helpers:
  panic-freedom,
   UTF-8 boundary on returned offsets,
   returned
  suffixes are address-and-length suffixes of the input.
- **`fuzz_scan_format`** -- line-index monotonicity,
   1-indexed
  cols,
   hit-end clipping,
   redaction (formatted hit never contains
  the matched byte range).
- **`fuzz_residual_shards`** -- partition (every position in
  exactly one shard) and combined-gate non-false-negative (if any
  member matches,
   gate is not `Ok(false)`).
- **`fuzz_literal_roundtrip`** -- `escape_literal` -> walker
  recovers original bytes.

## Local commands (via mise)

All commands run on nightly automatically:
 the repo-root
`rust = nightly` tool applies its toolchain to every task.

```bash
# List every target name.
mise run //packages/fuzz/forbidden-strings:list

# Build every target.
mise run //packages/fuzz/forbidden-strings:build

# 30-second smoke run across every target (uses the dictionary).
mise run //packages/fuzz/forbidden-strings:smoke

# Single-target campaign with passthrough libFuzzer args.
mise run //packages/fuzz/forbidden-strings:run fuzz_extract_gate_soundness -- -max_total_time=120

# Regenerate the curated corpus from rules/<area>_tests.rs.
mise run //packages/fuzz/forbidden-strings:seed
```

## Bounded-container wrapper (resource-exhaustion rule)

The repo's resource-exhaustion-isolation policy applies:
 every
fuzz command must run inside a memory-and-CPU-bounded container.
Past authorisation does not transfer;
 each heavy run requires the
wrapper.

```bash
podman run \
  --memory=2g \
  --cpus=2 \
  --rm \
  -v "$PWD":/work \
  -w /work \
  <rust-nightly-image> \
  mise run //packages/fuzz/forbidden-strings:smoke
```

The image needs nightly Rust,
 cargo-fuzz 0.13.1,
 and clang.
 A
local builder VM (`mvm`) is the recommended alternative when a
prebuilt image isn't handy.

## Corpus and artifact policy

- `seeds/<target>/seed-*` -- curated seed files committed
  to the repo (tracked plainly;
   no `.gitignore` re-include needed).
   192 unique
  literals per target,
   extracted from
  `rules/{extract,atom,engine,algebra}_tests.rs` by
  `seed-from-tests`.
- `corpus/<target>/` -- libFuzzer's corpus growth (scratch).
  Wholly ignored.
   The smoke and run tasks pass
  `corpus/<target> seeds/<target>` as explicit corpus dirs;
  libFuzzer reads both and writes new discoveries only to the
  first.
- `artifacts/` -- libFuzzer's crash reproducers.
   Always
  ignored.
   Open one with `cat artifacts/<target>/crash-*`
  ONLY in a private session;
   the artifact bytes are the exact
  fuzzer-mutated input that triggered the crash and may contain
  secret-shaped bytes.
- `coverage/` -- coverage data.
   Ignored.
- `Cargo.lock`:
  Committed so the fuzz toolchain stays reproducible.
  Root `.gitignore` does not ignore Cargo lockfiles.

The local deny-list (`/forbidden-strings.local.txt`) must NEVER
enter the corpus,
 dictionary,
 or reproducer text.
 The seeder's
guard is narrower than that policy:
 it runs `git check-ignore -v` on
`../../cli/forbidden-strings/forbidden-strings.local.txt` before reading anything,
 and bails
if the file exists and is NOT gitignored (see
`src/bin/seed-from-tests.rs`).
 The seeder itself only
reads files in `TEST_FILES`,
 so the guard is defence-in-depth against a
future edit that adds the deny-list to that list.
 Hand-curated
corpus / dictionary / reproducer edits remain entirely the
contributor's responsibility — the guard cannot detect a deny-list
byte sequence copied into one of those artifacts by hand.

## Crash reproduction and minimization

When a target reports a crash:

1. The reproducer lives at
   `artifacts/<target>/crash-<sha>`.
    Note its path.
2. Re-run the exact input to confirm:
   ```bash
   mise run //packages/fuzz/forbidden-strings:run \
     <target> -- artifacts/<target>/crash-<sha>
   ```
3. Minimize it via `cargo +nightly fuzz tmin <target>
   artifacts/<target>/crash-<sha>` -- libFuzzer finds the
   smallest input that still reproduces the panic.
4. Format the minimised input for readability via
   `cargo +nightly fuzz fmt <target> <path>` (decodes the bytes
   through the target's `Arbitrary` impl and prints the
   structured form).
5. **Redaction**:
    when filing an issue or commit message about
   the crash,
    NEVER paste raw reproducer bytes.
    The panic
   message printed by every target already includes pattern
   source + content length + SHA-256 -- that is the reproducer
   shape to share.

## Panic filter for known resharp upstream bugs

Each fuzz target installs a `std::panic::set_hook` that catches resharp engine
panics matching known upstream bug shapes (Bug B at `resharp/src/engine.rs:1020`,
Bug F at `resharp-algebra/src/lib.rs:2470`,
 plus the intersection-quant hang
shapes) and lets them unwind quietly so `compile_rule_src`'s `catch_unwind` can
intercept them and the fuzz run can move on to the next input.
 Genuine panics
in our own code still call the default hook and `abort()` so libFuzzer records a
crash.
 The installation is `Once`-guarded so the hook installs exactly once per
process.
 See `fuzz_targets/fuzz_extract_gate_soundness.rs:147-192` for the
implementation and
[`docs/decisions/forbidden-strings-fuzzing.md`](../../../docs/decisions/forbidden-strings-fuzzing.md)
for the full bug list.

The pre-validators added on top of resharp catch most of these shapes before
resharp sees them;
 the panic filter is belt-and-suspenders for new shapes the
pre-validators do not yet cover.

## Corpus refresh trigger

Re-run the seeder whenever a test file under
`packages/cli/forbidden-strings/src/rules/` changes (specifically
the `extract_tests.rs`,
 `atom_tests.rs`,
 `engine_tests.rs`,
`algebra_tests.rs` files):

```bash
mise run //packages/fuzz/forbidden-strings:seed
git add packages/fuzz/forbidden-strings/seeds/
```

Without the refresh,
 the curated seed corpus rots and libFuzzer
loses the fixture-derived coverage starting point.

## Soundness-by-revert validation

The primary target `fuzz_extract_gate_soundness` is meant to fire
on the AC-gate disable bug class.
 To verify it would catch a real
bug:

1. Create a disposable git worktree from current `main`.
2. `git revert --no-commit e49d8694` (the `(?u)` extraction
   skip fix).
3. Run inside the bounded container:
   ```bash
   mise run //packages/fuzz/forbidden-strings:run \
     fuzz_extract_gate_soundness -- -max_total_time=120
   ```
4. Confirm libFuzzer reports a soundness failure with the
   redacted reproducer shape (pattern source,
    content length,
   content SHA-256 -- no raw bytes).
5. Remove the worktree.

This is the final verification step;
 without it the target's
load-bearing claim is unproven.
