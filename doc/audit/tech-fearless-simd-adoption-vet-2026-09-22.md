# Fearless SIMD adoption vet

- Status: in progress; no adoption recommendation or score.
- Lifecycle phase: targeted evidence, not validated.
- Subject: `fearless_simd` adoption for existing Rust packages in this monorepo.
- Scope: identify a concrete consumer and compare retaining its current implementation with SIMD abstraction candidates.
- Started and last updated: 2026-09-22.
- Governing skill: `.agents/skills/choosing-technology/SKILL.md` at `a05818ad70a40e5769a36de669697ba109891b31`.
- Governing skill SHA-256: `393eb68c5b2b2f7b16c8f7f90c100fb8be43eefa4501511360cd0572e4ae8087`.
- Compatibility fingerprint (schema 1): `4d98a75047162e9871d9d05491221898c181feb5467cded2ba5a64d46779ff18`.
- Fingerprint input: `{"baseCategories":["inspectable open-source local technology"],"deployment":{"platforms":["Android arm64","Linux x64","macOS arm64","Windows x64"]},"hardConstraints":["No product mutations without adoption authorization"],"incumbent":null,"overlays":["multi-platform","native"],"schemaVersion":1,"scope":"Rust SIMD abstractions for current monorepo consumers","subject":"fearless_simd adoption","trustBoundary":"native Rust library"}`.
- Active audit owner: current Pi session.
- Prior compatible report: none found at report creation.
- Base category: inspectable open-source local Rust crate; native-code and multi-platform overlays apply.
- Hard constraints: do not mutate product files on evaluation; retain required consumer behavior and supported targets.
- Criteria frozen provisionally before scoring: measured consumer throughput, correctness, safety proof surface, platform fit, maintenance, dependency and build surface, readability. Unspecified priorities have weight 1. No scores before validation.
- Unresolved preferences: none yet. A specific consumer and measured regression threshold must be determined before a candidate ranking.

## Context and initial evidence

- `package/rust-module/forbidden-regex/src/dfa/sheng.rs:226-249,281-303` and `sheng2.rs:248-285,319-345` use a runtime-gated AVX-512VBMI kernel on x86 and NEON on arm64, with scalar fallback. These are architecture-specific `vpermb` and `vqtbl4q` algorithms, not merely a portable lane-wise loop.
- `package/rust-module/forbidden-regex/OPTIMIZATIONS.md:329-391` records measured regressions from a `std::simd` dynamic shuffle and from a cross-line SIMD gather; the latter was removed. This is prior measurement, not a fresh reproduction. It does **not** prove a regression for the different `fearless_simd` shuffle implementation.
- `package/rust-module/forbidden-regex/Cargo.toml:31-57` already delegates literal scanning to `memchr`, `aho-corasick`, and `regex-automata`; replacing their internal SIMD dispatch is not an API-level change to this crate.
- `package/music-player/truepeak-core/src/meter.rs:196-231,310-418` uses a stateful, interleaved, per-channel four-sample interpolation. This is a potential numerical kernel, but SIMD benefit and floating-point policy parity have not been measured. Contrary to stale migration prose in the core manifest, **both consumers are integrated**: `package/music-player/desktop-app/Cargo.toml:138` and `package/music-player/android-app/rust/Cargo.toml:72` depend on the core, while their `src/truepeak.rs` files import it. Android's JNI entry invokes the shared meter at `android-app/rust/src/lib.rs:700-711`.
- Root `mise.toml:81-96` uses nightly Rust repo-wide. The forbidden-regex README describes stable-compatible production SIMD at `:202`.
- The current scanner's public batch path goes through `package/rust-module/forbidden-regex/src/regex/batch.rs:76-79` to `src/engine.rs:318-324`, which selects the two-byte Sheng kernel, then one-byte Sheng or scalar fallback in `src/dfa/sheng2.rs:251-297` and `src/dfa/sheng.rs:222-259`. Replacing a vector kernel alone does not replace the entire scanner pipeline. Because this scanner protects against secret leakage in CI, a targeted replacement must receive the high-trust overlay before adoption; the current compatibility fingerprint models only the broader library-level scope and must be revised if a scanner-specific vet becomes the decision scope.

## Discovery query schedule and ledger

Frozen initial schedule for this scope, prior to candidate ratings:

- crates.io, exact/category queries: `portable SIMD`, `SIMD runtime dispatch`, `fearless_simd`, `pulp`, `wide`.
- GitHub repositories and code: `Rust portable SIMD runtime dispatch`, `fearless_simd`, `pulp`, `wide`, `safe_arch`.
- Web: `Rust stable portable SIMD runtime dispatch alternatives fearless_simd pulp wide safe_arch multiversion crates.io 2026` and `fearless_simd alternative Rust SIMD`.
- Local: `fearless_simd|std::simd|portable_simd|core::arch|is_x86_feature_detected|target_feature|pulp|wide::|simdeez|simd|vectoriz` in Rust packages and associated decision/optimization records.

Completed searches so far:

- Local `rg` over Rust packages, unfiltered after an initial overbroad capped prose search: current owned SIMD code appeared in `forbidden-regex`; Cargo locks for file-manager packages include `pulp` transitively. No package manifest searched had `fearless_simd`.
- Web search with literal query in schedule, Exa fast with fallback: found the Linebender release, crate documentation, `pulp`, and `simply-simd`; provider output had no pagination metadata. This does not saturate a source class.
- Direct provided URLs, primary documentation: Linebender v1.0 post dated 2026-09-22, docs.rs 1.0.0 and companion macros 0.1.0. Cached crates.io page/API still described 0.6.0/0.7.0; direct `curl` against `/api/v1/crates/fearless_simd/1.0.0` returned HTTP 403 on 2026-09-22. The 1.0 version claim uses docs.rs and the tagged repository; published artifact checksum and resolver availability remain unverified.
- GitHub repository clone: `~/temp/agent/fearless-simd-2026-09-22`, commit `dcbd824a897a098ec0124c088f971ac6d890d0cd`, tag `fearless_simd-v1.0.0`.
- Expansion round and registry pagination: pending. Source-class saturation: pending, not blocked or complete.

Candidates and discovery sources:

### Retain current implementation

- Discovered from local `forbidden-regex` source and optimization record.
- Category: existing owned implementation, native/multi-platform overlays.
- Screening: pass for current consumer; it does not directly replace unrelated libraries' internals.

### `fearless_simd` 1.0.0, optional `fearless_simd_macros` 0.1.0

- Discovered from supplied URLs, docs.rs and the Linebender GitHub tag.
- Category: inspectable open-source local library, native/multi-platform overlays.
- Screening: pending targeted verification, no known hard-gate failure. Core and companion macro require distinct audits.

### `pulp`

- Discovered from docs.rs/web search and transitive Cargo locks under file-manager packages.
- Category: inspectable open-source local library, native/multi-platform overlays.
- Screening: pending metadata/source audit.

### `wide` and `safe_arch`

- Discovered from existing SIMD notes in `doc/audit/tech-meow-cache-key-hash-vet-2026-09-17.md:553`.
- Category: inspectable open-source local libraries, native/multi-platform overlays.
- Screening: pending category fit and source audit.

### `simply-simd`

- Discovered from web search for runtime-dispatch alternatives.
- Category: inspectable open-source local library, native/multi-platform overlays.
- Screening: pending metadata/source audit.

## Targeted `fearless_simd` evidence records

- `fearless_simd` 1.0.0, license and dependency surface, primary `fearless_simd/Cargo.toml:1-43` and root `Cargo.toml:1-25` at pinned tag, accessed 2026-09-22: Apache-2.0 OR MIT, MSRV 1.89; core has an optional `libm` dependency and defaults to `std`. License appears compatible with current crates but has not received a complete dependency or provenance audit.
- Optional macro 0.1.0, primary `fearless_simd_macros/Cargo.toml:1-23` and [macro documentation](https://docs.rs/fearless_simd_macros/0.1.0/fearless_simd_macros/), accessed 2026-09-22: uses `proc-macro2`, `quote`, and `syn` 3; rejects async and const functions, and limits target-feature scope to execution inside the annotated function. This extends the audit surface. The core crate does not depend on the macro.
- Dispatch behavior, primary `fearless_simd/src/lib.rs:286-369,639-650` at pinned tag: the `Avx512` auto-detection requires the full Ice Lake feature group including VBMI2, VAES, SHA, and other features, while current Sheng kernels gate only F, BW, and VBMI. Thus automatic `Avx512` dispatch can select a lower level on some CPUs supporting the existing kernel; this is a source-derived conditional, not a measured regression. `as_avx512` only returns an existing proof token; constructing one from the narrower guard without meeting its full contract would be unsound.
- Exact shuffle mapping, primary `fearless_simd/src/generated/avx512.rs:13009-13021` and `generated/neon.rs:6383-6404` at pinned tag: the fast 64-byte dynamic shuffle directly uses `_mm512_permutexvar_epi8` on AVX-512 and four `vqtbl4q_u8` operations on NEON. The current Sheng NEON kernel in `package/rust-module/forbidden-regex/src/dfa/sheng.rs:326-343` uses one `vqtbl4q_u8` for a broadcast 16-byte state. A portable rewrite may therefore duplicate shuffles on arm64 unless optimized; its code generation and speed have not been measured.
- Provenance, primary tag and [security policy](https://github.com/linebender/fearless_simd/blob/main/fearless_simd/SECURITY.md), accessed 2026-09-22: upstream promises security backports to newest releases for each supported MSRV for at least three years from MSRV release. Its exact policy is not a promise to patch every 1.0.x version independently.
- Test matrix, primary `.github/workflows/ci.yml` at pinned tag, accessed 2026-09-22: CI includes stable MSRV, native Linux/Windows/macOS, emulated SSE2/AVX2/AVX-512 and baseline arm64, wasm, sanitizer and macro UI jobs. Their presence is not proof of a passing run at this revision.
- Public tracker sample, `gh issue list --repo linebender/fearless_simd --state all --limit 12` and corresponding `gh pr list`, accessed 2026-09-22: issues #381 (open SSE2 rounding performance), #364 (closed NEON `fract` edge correctness), and #353 (open swizzle operand shape) illustrate active maintenance and remaining behavior gaps. PR #389 merged for the v1.0 release on 2026-09-21. Maintainer comments versus actions and full issue/PR review remain pending; activity alone is not a quality verdict.
- Core source quality, fuzzing and mutation evidence, complete dependency tree, all CI commands, release build provenance, and consumer-boundary execution: pending. A text search for `fuzz|proptest|quickcheck|mutation` in owned Rust source and `.github` found no hits; this does not prove absence of external fuzz campaigns. No third-party code executed in this evaluation.

## Validation, scores and decision status

- Execution manifest: none yet; no candidate build, test, install, macro expansion, or benchmark was run.
- Hard-gate exits: none established. Unknowns are pending, not failures.
- Finalists: none promoted after complete discovery and targeted audit. No equal-depth validation performed.
- Scoring, sensitivity, pros/cons ranking: not applicable yet. Do not infer a winner from publication or README claims.
- Current decision: no adoption authorization, no product changes, and no recommendation until discovery, audit, and consumer-boundary comparisons are complete.
- Next actions: finish registry and GitHub discovery, audit each serious alternative, inspect execution trees, run upstream and bounded throwaway consumer tests, compare both real kernels against existing behavior and noise-banded timing, then score and perform sensitivity analysis.
