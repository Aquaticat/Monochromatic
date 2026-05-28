# Forbidden strings: road to 1.0

Release-readiness checklist for promoting `packages/cli/forbidden-strings` from `0.1.8` to a
`1.0` we would be comfortable publishing and asking others to pin against.

This complements the original design rationale in [forbidden-strings.md](./forbidden-strings.md);
that document covers why the tool exists and how it works. This one covers what is missing
before a `1.0` semver commitment is honest.

Current measured baseline (2026-05-28): `cargo test --release` passes (190 unit plus 19
integration, 0 failures), `cargo clippy --release -- -D warnings` is clean, the crate publishes
via the OIDC trusted-publishing workflow, and performance is roughly two orders of magnitude
under the stated budget. The gaps below are about contract, coverage, distribution, and
foot-guns, not about the core matching engine, which is solid.

A `1.0` tag is a promise: stable CLI surface, stable output contract, gated correctness, and
a crate that installs and documents cleanly for someone outside this monorepo. The items are
tiered by how load-bearing they are for that promise.

## Tier A: release engineering and packaging

1.  Add a Rust CI workflow that gates merges on `cargo test`, `cargo clippy -- -D warnings`,
    and `cargo fmt --check`. Today the only workflow touching cargo is
    `.github/workflows/cargo-publish.yml`, and it runs `cargo package` (compile-verify) only;
    tests and lint never run in CI, so a regression lands green. Tracked as issue #122
    (open, ready-for-human), not yet done.
2.  Run the test suite cross-platform, not just on the dev machine. `cargo-publish.yml` builds
    seven target triples (linux gnu/musl, arm gnu/musl, macOS x86/arm, windows-msvc) but never
    runs `cargo test` on any of them. Path canonicalization, symlink handling, the `gix-index`
    read, and Windows path separators are all claimed-supported in the README yet exercised only
    under Linux. A 1.0 that ships Windows and macOS binaries needs those binaries' behavior under
    test, not just their compilation.
3.  Ship a license file inside the crate. `Cargo.toml` sets `license = "LGPL-3.0-or-later"` but
    its `include` list is `src/**/*.rs`, `Cargo.toml`, `Cargo.lock`, `README.md` only, so the
    published `.crate` carries no license text. The text exists at repo-root
    `LICENSES/LGPL-3.0-or-later.txt`; copy it into the package and add it to `include`.
4.  Declare and test a minimum supported Rust version. `Cargo.toml` has no `rust-version`, so
    there is no stated MSRV and nothing pins it. Pick a floor, add `rust-version`, and add an
    MSRV job to the CI matrix from item 1. While editing metadata, fill the empty `authors` and
    `documentation` fields.
5.  Write a `CHANGELOG.md`. The `0.1.0` through `0.1.8` history is undocumented outside git log.
    A 1.0 release with a semver commitment needs release notes a consumer can read before
    bumping.
6.  Write a stability policy and state it in the README. Declare which surfaces are stable under
    semver (CLI flags, the exit-code contract `0`/`1`/`2`, the `PATH:LINE:COL_START..COL_END
    rule=N` output line) and which are explicitly not (the `forbidden_strings` lib API:
    `run_cli_from_env`, the `fuzzing`-gated `fuzz_api`). Without this, every internal refactor
    risks looking like a breaking change to a downstream pinner.

## Tier B: correctness and UX foot-guns

Each of these is already admitted in the README as a known quirk. For 1.0 they should be fixed,
or, where intentional, kept and documented with rationale rather than as a surprise.

7.  Uppercase or otherwise invalid regex flags silently degrade to a literal scan. `/foo/i` is a
    regex; `/foo/I` is a literal match for the six-byte string `/foo/I`, with no load-time error
    (the classifier rejects non-`[a-z]` flags at `src/rules/parse.rs:150` and falls through to
    literal handling at `:209`). A rule author who fat-fingers a capital flag gets silently wrong
    behavior. Warn or error at load.
8.  `--all` plus positional file arguments silently discards the positional list (the walker
    output overwrites it). Reject the combination with a usage error (exit 2) instead of picking
    one arm quietly.
9.  A bare `//` rule compiles to `(?-flags:)` and matches the empty string at every position,
    flagging every file. Detect and reject this shape at load.
10. A UTF-8 BOM at the start of the rules file is not stripped, so the first rule silently
    carries a leading `\u{FEFF}` and never matches as intended. Strip the BOM on load.
11. The rules file and `--all` resolve relative to the current working directory, not the git
    repository root (default `./forbidden-strings.local.txt`; the walker calls `list_files(".")`
    at `src/lib.rs:705`). Run the tool from a subdirectory and the default rules file is not
    found and `--all` scans only that subtree, which is surprising for a tool described as a
    git-repo scanner. Walk up to the repository root, or keep cwd-relative and emit an explicit
    "no rules file found at <cwd>" error plus a documented note.
12. Identical rules are not deduplicated; each fires its own `rule=N` hit. Decide whether to
    dedup at load or to keep the current behavior and document it as intentional.

## Tier C: documentation and distribution

13. Fix the stale README pointer. README lines 258 through 264 reference
    `TROUBLESHOOTING.resharp.md` "in the repository root"; the file now lives at
    `docs/troubleshooting/resharp.md` (the `--help` text already points there correctly). The
    root file does not exist, so the pointer is dead.
14. Fix README relative links for the published crate. `PERF.md`, `FUZZING.md`, and
    `docs/troubleshooting/resharp.md` are not in the `include` set, so every relative link to
    them 404s on the crates.io and docs.rs rendered README, which is the first page a prospective
    user sees. Either bundle those files or rewrite the links to absolute repository URLs in the
    shipped README.
15. Add install and distribution docs for consumers outside the monorepo. The README documents
    only the in-repo `mise run ...:build` path. A 1.0 should document `cargo install
    forbidden-strings`, downloading a prebuilt release archive, and verifying its SLSA build
    provenance with `gh attestation verify` (the publish workflow already produces these
    attestations).
16. Decide the rustdoc story. There are zero `///` doc comments in `src/` (confirmed: 0
    doc-tests), so the docs.rs page renders effectively empty. Either add crate-level and API
    rustdoc, or mark the lib `#[doc(hidden)]` and configure docs.rs to surface the README, so the
    published documentation page is not blank.

## Tier D: dependency and soundness stability

17. Resolve the pre-1.0 dependency exposure. `resharp = "0.6"`, `gix-hash = "0.25"`, and
    `gix-index = "0.51"` are all `0.x` crates that break on minor bumps, and the `gix` family
    churns frequently. A 1.0 inherits their instability and the known resharp panic shapes
    documented in `Cargo.toml`. Decide an explicit policy: pin tightly, commit `Cargo.lock` for
    the binary (already done), and decide whether 1.0 should wait on the upstream resharp fix
    tracked in issue #158.
18. Close the open-endedness of the resharp pre-validators. `src/rules.rs:931` notes shapes "the
    pre-validator does not yet know," with the `catch_unwind` fail-closed net as backstop. For
    1.0, formally adopt the fail-closed contract as a permanent guarantee (upstream resharp fixes
    are not assured), add a regression test for every known-bad shape currently listed in
    `Cargo.toml` and `docs/troubleshooting/resharp.md`, and document it as part of the stability
    promise from item 6.
19. Add fuzzing to CI. `FUZZING.md` states "CI integration is deferred." The tool's core safety
    claims (linear-time matching, no catastrophic backtracking, fail-closed on a panicking rule)
    rest on fuzz coverage that currently runs only on-demand locally. Add a scheduled or nightly
    bounded fuzz-smoke job that exercises the seven soundness targets, so a regression in those
    invariants surfaces without a manual run.
20. Add a dependency-advisory scan (`cargo audit` or `cargo deny`) to CI. For a security tool,
    an unguarded known-vulnerable transitive dependency directly undercuts the value proposition,
    and there is currently nothing watching for one.

## Tier E: scope lock

21. Lock the non-goals and reconsider the highest-value ones. The README's "When to pick
    something else" lists SARIF/JSON output, stdin/streaming input, git-history scanning, per-rule
    path scoping, per-rule allowlists, and CEL post-match filtering as deliberately omitted. For a
    1.0, commit these formally as non-goals or pull the adoption-blocking ones into scope.
    Machine-readable output (SARIF or JSON for GitHub code-scanning upload) is the most
    adoption-relevant. Also resolve the still-open scope questions in
    [forbidden-strings.md](./forbidden-strings.md) (which file classes are scanned, whether
    commit messages are scanned, whether a path-exclude list is needed).
22. Add a deterministic output mode and a performance-regression guard. Cross-file hit ordering
    is rayon-scheduler-determined (stable on a given input but not sorted), which makes CI
    snapshot-diffing awkward; offer a sorted-output mode. Separately, the numbers in `PERF.md` are
    maintained by hand with no automated guard, so a future change could silently blow the
    sub-100ms pre-commit budget; add a lightweight perf-regression check.

## Suggested sequencing

The Tier A items are the true blockers: without CI gating (1, 2), a license (3), and a stated
stability contract (6), the version number is the only thing that would change at 1.0. Tier B
foot-guns are cheap, individually small, and each removes a documented surprise. Tier C is a day
of documentation work. Tier D and the scope lock in Tier E carry the most judgment and should be
decided deliberately rather than rushed, since they define what the 1.0 promise actually covers.
