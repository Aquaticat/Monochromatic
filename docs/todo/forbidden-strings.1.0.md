# Forbidden strings: road to 1.0

Release-readiness checklist for promoting `packages/cli/forbidden-strings` from `0.1.8` to a
`1.0` we would be comfortable publishing and asking others to pin against.

This complements the original design rationale in [forbidden-strings.md](./forbidden-strings.md);
that document covers why the tool exists and how it works. This one covers what is missing
before a `1.0` semver commitment is honest.

Current measured baseline (2026-05-28): `cargo test --release` passes (190 unit plus 19
integration, 0 failures), `cargo clippy --release -- -D warnings` is clean, the crate publishes
via the OIDC trusted-publishing workflow, and performance is roughly two orders of magnitude
under the stated budget.

A `1.0` tag is a promise: stable CLI surface, stable output contract, a redaction guarantee that
actually holds, gated correctness, and a crate that installs and documents cleanly for someone
outside this monorepo. Items are tiered by how load-bearing they are for that promise. Tier 0 is
a security defect that breaks the package's headline claim and blocks any 1.0 on its own.

## Tier 0: rule-content disclosure on the load path (security blocker)

The README's central promise is that the matched substring, the surrounding line, and the rule
pattern are never printed in failure output, so a sensitive rule body (a customer name, an
unreleased codename, a pre-disclosure partner ID) can live in the gitignored appendix or the
`FORBIDDEN_STRINGS_LIST` CI secret without leaking on public CI logs. The scan-time path honors
this (`emit_hit` and the `rule={N} engine error` lines print only path, line/column, and the
opaque rule index). The rule-load path does not. It runs on every invocation, local and CI,
before any file is scanned, and reproduces as follows (verified 2026-05-28 against the
`0.1.8` release binary with a throwaway rules file):

```text
$ forbidden-strings --rules sensitive.txt target.txt
forbidden-strings: pre-validator nested_complement rejected rule "SECRET_CODENAME_NimbusFalcon&~(~(a))"
forbidden-strings: rule on line 1 (resharp): nested complement `~(~(...))` at byte offset 31: ...

$ forbidden-strings --rules other.txt target.txt
forbidden-strings: rule on line 1 (resharp): Parse(ParseError { kind: ClassUnclosed, pattern: "PartnerID_(unclosed_[group", ... })
```

Both lines go to stderr, the exact stream the README markets as leak-safe and the stream CI
captures. Three distinct emission paths leak:

1.  Redact the rule source from the pre-validator diagnostics. Eleven sites in `src/rules.rs`
    (lines 567, 613, 653, 660, 694, 723, 754, 790, 818, 846, 875) emit
    `eprintln!("forbidden-strings: pre-validator <name> rejected rule {:?}", src)`, printing the
    full rule pattern. None of these are documented; the README only documents the redacted
    `rule on line N (resharp): <static reason>` form. Replace `src` with the rule index, or gate
    the source echo behind an explicitly-unsafe debug env var that is off by default and
    documented as not-for-CI. The static `reason` strings themselves are safe (they describe the
    shape, for example "complement body contains \b", and do not quote the pattern); the byte
    offset in some reasons ("at byte offset 31") is a minor structural leak to reconsider while
    fixing.
2.  Stop echoing the pattern through engine compile-error Debug. `compile_rule_src` formats
    resharp failures as `format!("(resharp): {:?}", e)` (`src/rules.rs:946`) and the regex-crate
    path formats failures as `format!("(regex): {:?}", e)` (`src/rules.rs:1061`). Both
    `resharp::Error` and `regex::Error` embed the offending pattern text in their `Debug` and
    `Display` output (reproduced above: `pattern: "PartnerID_..."`). Most rules (257 of 259 in
    the ported corpus) take one of these two paths, so a single malformed sensitive rule dumps
    its body. Map these errors to a redacted message that keeps the error kind and offset but not
    the pattern bytes.
3.  Reconcile the line-number disclosure with the documented contract. Load errors are prefixed
    `rule on line N` (`src/rules.rs:1324`), a direct index into the secret file, whereas the
    README and the hit format promise only an "opaque rule index". Decide whether the line
    number is acceptable for the load path and align the documentation, or switch to the same
    opaque index used at scan time.

The systemic fix that prevents recurrence: add a redaction regression test. Feed a rules file
containing a distinctive sentinel token through every error path (each pre-validator shape, a
resharp compile error, a regex-crate compile error, an empty/comment-only file, a read error)
and assert the sentinel bytes never appear on stdout or stderr. The invariant the entire
security model rests on currently has no automated guard, which is why this regressed unnoticed.

## Tier A: release engineering and packaging

4.  Add a Rust CI workflow that gates merges on `cargo test`, `cargo clippy -- -D warnings`,
    and `cargo fmt --check`. Today the only workflow touching cargo is
    `.github/workflows/cargo-publish.yml`, and it runs `cargo package` (compile-verify) only;
    tests and lint never run in CI, so a regression lands green. Tracked as issue #122
    (open, ready-for-human), not yet done.
5.  Run the test suite cross-platform, not just on the dev machine. `cargo-publish.yml` builds
    seven target triples (linux gnu/musl, arm gnu/musl, macOS x86/arm, windows-msvc) but never
    runs `cargo test` on any of them. Path canonicalization, symlink handling, the `gix-index`
    read, and Windows path separators are all claimed-supported in the README yet exercised only
    under Linux.
6.  Ship a license file inside the crate. `Cargo.toml` sets `license = "LGPL-3.0-or-later"` but
    its `include` list is `src/**/*.rs`, `Cargo.toml`, `Cargo.lock`, `README.md` only, so the
    published `.crate` carries no license text. The text exists at repo-root
    `LICENSES/LGPL-3.0-or-later.txt`; copy it into the package and add it to `include`.
7.  Declare and test a minimum supported Rust version. `Cargo.toml` has no `rust-version`, so
    there is no stated MSRV and nothing pins it. Pick a floor, add `rust-version`, and add an
    MSRV job to the CI matrix from item 4. While editing metadata, fill the empty `authors` and
    `documentation` fields.
8.  Write a `CHANGELOG.md`. The `0.1.0` through `0.1.8` history is undocumented outside git log.
    A 1.0 release with a semver commitment needs release notes a consumer can read before
    bumping.
9.  Write a stability policy and state it in the README. Declare which surfaces are stable under
    semver (CLI flags, the exit-code contract `0`/`1`/`2`, the `PATH:LINE:COL_START..COL_END
    rule=N` output line, and the redaction guarantee once Tier 0 is fixed) and which are
    explicitly not (the `forbidden_strings` lib API: `run_cli_from_env`, the `fuzzing`-gated
    `fuzz_api`). Without this, every internal refactor risks looking like a breaking change.

## Tier B: correctness and UX foot-guns

Each of these is already admitted in the README as a known quirk. For 1.0 they should be fixed,
or, where intentional, kept and documented with rationale rather than as a surprise.

10. Uppercase or otherwise invalid regex flags silently degrade to a literal scan. `/foo/i` is a
    regex; `/foo/I` is a literal match for the six-byte string `/foo/I`, with no load-time error
    (the classifier rejects non-`[a-z]` flags at `src/rules/parse.rs:150` and falls through to
    literal handling at `:209`). A rule author who fat-fingers a capital flag gets silently wrong
    behavior. Warn or error at load.
11. `--all` plus positional file arguments silently discards the positional list (the walker
    output overwrites it). Fix: reject the combination with a usage error (exit 2).
12. A bare `//` rule compiles to `(?-flags:)` and matches the empty string at every position,
    flagging every file. Fix: detect and reject this shape at load.
13. A UTF-8 BOM at the start of the rules file is not stripped, so the first rule silently
    carries a leading `\u{FEFF}` and never matches as intended. Fix: strip the BOM on load.
14. The rules file and `--all` resolve relative to the current working directory, not the git
    repository root (default `./forbidden-strings.local.txt`; the walker calls `list_files(".")`
    at `src/lib.rs:705`). Run the tool from a subdirectory and the default rules file is not
    found and `--all` scans only that subtree, which is surprising for a tool described as a
    git-repo scanner. Walk up to the repository root, or keep cwd-relative and emit an explicit
    "no rules file found at <cwd>" error plus a documented note.
15. Identical rules are not deduplicated; each fires its own `rule=N` hit. Decision needed: dedup
    at load, or keep current behavior and document it as intentional.

## Tier C: documentation and distribution

16. Fix the stale README pointer. README lines 258 through 264 reference
    `TROUBLESHOOTING.resharp.md` "in the repository root"; the file now lives at
    `docs/troubleshooting/resharp.md` (the `--help` text already points there correctly). The
    root file does not exist, so the pointer is dead.
17. Fix README relative links for the published crate. `PERF.md`, `FUZZING.md`, and
    `docs/troubleshooting/resharp.md` are not in the `include` set, so every relative link to
    them 404s on the crates.io and docs.rs rendered README, which is the first page a prospective
    user sees. Either bundle those files or rewrite the links to absolute repository URLs in the
    shipped README.
18. Add install and distribution docs for consumers outside the monorepo. The README documents
    only the in-repo `mise run ...:build` path. A 1.0 should document `cargo install
    forbidden-strings`, downloading a prebuilt release archive, and verifying its SLSA build
    provenance with `gh attestation verify` (the publish workflow already produces these
    attestations).
19. Decide the rustdoc story. There are zero `///` doc comments in `src/` (confirmed: 0
    doc-tests), so the docs.rs page renders effectively empty. Either add crate-level and API
    rustdoc, or mark the lib `#[doc(hidden)]` and configure docs.rs to surface the README, so the
    published documentation page is not blank.

## Tier D: dependency and soundness stability

20. Resolve the pre-1.0 dependency exposure. `resharp = "0.6"`, `gix-hash = "0.25"`, and
    `gix-index = "0.51"` are all `0.x` crates that break on minor bumps, and the `gix` family
    churns frequently. A 1.0 inherits their instability and the known resharp panic shapes
    documented in `Cargo.toml`. Decide an explicit policy: pin tightly, keep `Cargo.lock`
    committed for the binary (already done), and decide whether 1.0 should wait on the upstream
    resharp fix tracked in issue #158.
21. Close the open-endedness of the resharp pre-validators. `src/rules.rs:931` notes shapes "the
    pre-validator does not yet know," with the `catch_unwind` fail-closed net as backstop. For
    1.0, formally adopt the fail-closed contract as a permanent guarantee (upstream resharp fixes
    are not assured), add a regression test for every known-bad shape currently listed in
    `Cargo.toml` and `docs/troubleshooting/resharp.md`, and document it as part of the stability
    promise from item 9.
22. Add fuzzing to CI. `FUZZING.md` states "CI integration is deferred." The tool's core safety
    claims (linear-time matching, no catastrophic backtracking, fail-closed on a panicking rule)
    rest on fuzz coverage that currently runs only on-demand locally. Add a scheduled or nightly
    bounded fuzz-smoke job that exercises the seven soundness targets, so a regression in those
    invariants surfaces without a manual run.
23. Add a dependency-advisory scan (`cargo audit` or `cargo deny`) to CI. For a security tool,
    an unguarded known-vulnerable transitive dependency directly undercuts the value proposition,
    and there is currently nothing watching for one.

## Tier E: scope lock

24. Lock the non-goals and reconsider the highest-value ones. The README's "When to pick
    something else" lists SARIF/JSON output, stdin/streaming input, git-history scanning, per-rule
    path scoping, per-rule allowlists, and CEL post-match filtering as deliberately omitted. For a
    1.0, commit these formally as non-goals or pull the adoption-blocking ones into scope.
    Machine-readable output (SARIF or JSON for GitHub code-scanning upload) is the most
    adoption-relevant. Also resolve the still-open scope questions in
    [forbidden-strings.md](./forbidden-strings.md) (which file classes are scanned, whether
    commit messages are scanned, whether a path-exclude list is needed).
25. Add a deterministic output mode and a performance-regression guard. Cross-file hit ordering
    is rayon-scheduler-determined (stable on a given input but not sorted), which makes CI
    snapshot-diffing awkward; offer a sorted-output mode. Separately, the numbers in `PERF.md` are
    maintained by hand with no automated guard, so a future change could silently blow the
    sub-100ms pre-commit budget; add a lightweight perf-regression check.

## Suggested sequencing

Tier 0 is the gate: until the load path stops printing rule bodies and a redaction regression
test guards it, the tool actively breaks the guarantee it is sold on, so no 1.0 ships. The Tier
A items are the next true blockers: without CI gating (4, 5), a license (6), and a stated
stability contract (9), the version number is the only thing that would change at 1.0. Tier B
foot-guns are cheap, individually small, and each removes a documented surprise. Tier C is a day
of documentation work. Tier D and the scope lock in Tier E carry the most judgment and should be
decided deliberately rather than rushed, since they define what the 1.0 promise actually covers.

## A note on completeness

This list was revised after a reviewer caught that the original 22 items missed the Tier 0
disclosure defect: the first pass verified redaction only on the scan path and trusted the
README's claim for the load path instead of reading the load, pre-validate, and compile-error
code. The redaction invariant now has a dedicated regression-test item (Tier 0) precisely
because the failure mode was "an unverified assumption about a security-critical guarantee." If
further auditing surfaces more gaps, append them rather than assuming this enumeration is final.
