# Handover: Rust fuzzing for monochromatic-jsonc-edit

State as of 2026-09-26.
The sidecar exists,
builds,
and its unit tests pass.
The first bounded campaign found three crashes.
None is triaged yet.
This document is the resumption point.

## What is built

`package/rust-module/jsonc-edit.fuzz`,
beside the crate it fuzzes,
mirroring the other `<package>.fuzz` sidecars:

- Four libFuzzer targets:
   `fuzz_parse_emit_roundtrip`,
   `fuzz_reject_and_recover`,
   `fuzz_depth_envelope`,
   `fuzz_edit_invariants`.
- A structured `arbitrary` generator (`src/generators.rs`),
   shared invariant checks (`src/invariants.rs`) and an address picker (`src/path_pick.rs`).
- Thirteen unit tests,
   each invariant covered by a negative control that proves it can fail.
- Clippy clean under `-D warnings`,
   house Rust linter clean,
   ASAN binaries build through `mise run build`.
- Committed as `8de177bcf`,
   with the dictionary escape fix in `5c4d114f0`.

Each `[[bin]]` entry in `Cargo.toml` is load-bearing:
`cargo-fuzz` discovers targets through `cargo metadata`,
so a bare `fuzz_targets/` directory is invisible and `cargo fuzz list` prints nothing while
exiting 0.

## How to run a bounded campaign

Resource isolation is required,
and the mount must stay narrow.
Mounting the whole repository with `:z` fails on `lsetxattr` inside `node_modules` and would
relabel real user files,
so mount only the sidecar and disable label confinement instead:

```bash
podman run --rm --memory=2g --cpus=2 --security-opt label=disable \
  -v /var/home/user/Monochromatic/package/rust-module/jsonc-edit.fuzz:/work -w /work \
  localhost/mise-rust-test:fedora44 \
  sh -c 'for t in fuzz_parse_emit_roundtrip fuzz_reject_and_recover fuzz_depth_envelope fuzz_edit_invariants; do
    mkdir -p corpus/$t seed/$t
    ./target/x86_64-unknown-linux-gnu/release/$t corpus/$t seed/$t \
      -max_total_time=120 -rss_limit_mb=1536 -dict=dictionary/jsonc-edit.dict
  done'
```

The binaries are prebuilt on the host;
the container only needs a compatible glibc,
which `localhost/mise-rust-test:fedora44` provides.
`rg` is not installed in that image,
so replay crashes on the host instead of inside it.

## Campaign result, 2026-09-26

Four targets,
120 seconds each,
2 GiB and 2 CPU bounded:

- `fuzz_depth_envelope`:
   **clean**.
   593692 runs in 121 seconds,
   `cov: 284 ft: 1070 corp: 61/183b`,
   peak rss 393 Mb,
   no crashes.
   The nesting boundary and the malformed over-depth refusals held under sustained load.
- `fuzz_parse_emit_roundtrip`:
   **one crash**,
   `artifacts/campaign-2026-09-26/crash-5340dcc12e107cf99550cba3552928e99ef425b7`,
   14 bytes,
   Base64 `bmwA5HVlCg2KAOR1dUE=`.
   Panic at `src/invariants.rs:88`.
- `fuzz_reject_and_recover`:
   **one crash**,
   `artifacts/campaign-2026-09-26/crash-f4d33098b9cd52cfae84835bd188ad854191ec1b`,
   150 bytes,
   containing the literal `false` among binary noise.
   Panic at `src/invariants.rs:37`,
   and the backtrace names `assert_canonical_stability::{closure_env#1}`,
   which is the second closure in that function:
   the one that panics when **emission does not reparse**.
- `fuzz_edit_invariants`:
   **one crash on the empty input**,
   `artifacts/campaign-2026-09-26/crash-da39a3ee5e6b4b0d3255bfef95601890afd80709`
   (that hash is the SHA-1 of the empty string,
   and the file is 0 bytes).
   Panic at `fuzz_targets/fuzz_edit_invariants.rs:89`,
   backtrace through the target's own `unwrap_or_else` on a parse result.

Replay any of them on the host:

```bash
cd package/rust-module/jsonc-edit.fuzz
./target/x86_64-unknown-linux-gnu/release/fuzz_reject_and_recover \
  artifacts/campaign-2026-09-26/crash-f4d33098b9cd52cfae84835bd188ad854191ec1b
```

## Reading of each crash, not yet verified

These are inferences from panic locations and backtraces.
Each needs a minimized reproducer and a decision about whether the defect is in the crate,
the harness or the generator.

1. The empty-input edit crash is most likely a **harness** defect:
   with zero bytes,
   `GeneratedDocument::arbitrary` or `replacement_value` returns `Err(NotEnoughData)` and my
   `.expect(...)` turns that into a panic.
   Harnesses must skip inputs they cannot interpret rather than fail on them.
   Line 89 and the `replacement_value` expect are both candidates.
2. The reject-target crash is the one that matters most if it survives triage:
   `assert_canonical_stability` is only called after `parse_jsonc` succeeded,
   and closure #1 is the "emission must reparse" panic,
   so the crate would have emitted text it then refused to parse.
   That would be a product defect in `emit_jsonc_value`,
   not a harness problem.
   It must be reproduced with the mutated source printed,
   then minimized.
3. The roundtrip crash at `src/invariants.rs:88` needs the assertion message,
   which the replay filtered out.
   Line 88 is inside the comment-collection or preservation region of that file,
   so it is either a dropped comment during emission (product defect) or an over-strong
   expectation about merged or re-rendered comment bodies (harness defect).
   Rerun the replay without filtering to read the message.

## Next steps

1. Replay each artifact unfiltered and record the full panic message and the offending source text.
2. Minimize each:
   `cargo fuzz cmin` or `cargo fuzz tmin` per target,
   then reduce the JSONC source by hand to the smallest document that still fails.
3. Classify each as crate,
   generator or harness,
   and for crate defects write a unit test in `package/rust-module/jsonc-edit` that fails first.
4. Fix the harness so an uninterpretable input is skipped:
   no `.expect` on `Arbitrary` results inside a target.
5. Re-run the campaign until all four targets are clean for a full bounded round,
   then record the run counts here.
6. Task #23 is still open:
   mutation testing with `cargo-mutants`,
   which is not installed.
   A local image `localhost/mutation-test-runtime:ff8da957d5b0` exists and
   `package/rust-module/forbidden-regex/.cargo/mutants.toml` is the precedent to copy.
7. Task #19 is still open:
   no `AGENTS.md` rule states that sidecars live beside their package as `<pkgname>.<kind>`.
   Commit `b9c0e6e48` already moved `package/fuzz/forbidden-strings` to
   `package/cli/forbidden-strings.fuzz`,
   so task #20 is done and only the rule remains.

## Related records

- `doc/troubleshooting/arbitrary-choose-empty-input.md`:
   why the generator's fresh-key retry loop hung,
   and why piping `cargo test` hides a hang.
- `doc/decision/jsonc-comment-line-ownership.md`:
   the ownership rule the invariants assume.
- `doc/decision/jsonc-edit-parser-foundation.md`:
   the adopted foundation,
   including the fast-path removal amendment.
- `doc/runbook/publish-crate-first-time.md`:
   the publication route;
   0.1.0 is published and Trusted Publishing is proven.
