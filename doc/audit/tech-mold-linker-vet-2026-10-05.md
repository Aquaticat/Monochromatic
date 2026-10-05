# Mold linker vet report

Status:
in progress;
hard gates, targeted evidence, upstream-side validation (phases N2, B, C1, C2), and the phase E
consumer-boundary first pass are complete;
phase E2 supplemental controls are running under documented host-load saturation;
scoring and sensitivity follow.

Lifecycle phase:
finalist validation.

Subject:
mold linker.

Decision scope:
Evaluate mold v3.0.0 (`rui314/mold`, the Rust rewrite) as the ELF linker for Monochromatic Linux
cargo builds on the dev host, containers, and CI.
Sole external candidate per the user instruction of 2026-10-05
("Evaluate this specific candidate only").
macOS, Windows MSVC, and Android targets keep their existing linkers because mold links ELF only.
The incumbent (rust-lld 23.1.1, the rustc self-contained linker reached through the cc driver)
is carried as the status-quo baseline candidate required by the replacement parity overlay, with evidence depth equal to its production use plus the
measurements recorded in this report, not a fresh source audit.

The ranking in this report orders mold against the per-environment status quo only;
no other external linker was evaluated, per the user restriction.

Start date:
2026-10-05.

Last updated:
2026-10-05.

Governing skill commit:
`37117e36397e30233062828581a5e38217da9458`.

Governing skill SHA-256:
`552ac9955299b65a9f921a4e836b60a3fabc15d3477eeb8ec2bfb3f400647f9b`.

Compatibility fingerprint:
`6427299613fd2e86e7773be2e7fec33f43c325f7994c181d8335b09ef0784d0e`.
Fingerprint input (schema 1, RFC 8785 canonicalization, SHA-256 over 1535 UTF-8 bytes):
subject, decision scope, hard constraints, deployment, trust boundary, incumbent
(rust-lld, LLD 23.1.1 with rustc 1.100.0-nightly), base categories, overlays.
Superseded fingerprints, newest first:

- `89c9982ac41072cc6c17e84414f8a1f7bf9a903306c86a87e622f3a37e24b746`,
  recorded before a hello-world link-driver probe showed that rustc's self-contained rust-lld,
  not GNU ld, is the linker this host's cargo builds consume;
  the incumbent input changed accordingly on 2026-10-05.

Active audit owner:
pi session `01a10d3d-dcca-70df-8a23-041ebf12cd66`, lock record at
`~/temp/agent/technology-vet-locks/var-home-user-Monochromatic-doc-audit-tech-mold-linker-vet-2026-10-05.md.lock/owner.json`.

Prior compatible report:
none. `doc/audit/` contains no earlier mold or linker vet report (checked by `ls doc/audit`
filtered for `mold` on 2026-10-05, result empty).

## Hard constraints

Frozen before candidate ratings:

- HC1: links rustc 1.100-nightly output for `x86_64-unknown-linux-gnu` correctly, proven at the
  consumer boundary (crate test suites pass on mold-linked binaries).
- HC2: license permits proprietary use of the tool and distribution of its linked output.
- HC3: source is inspectable at the pinned revision.
- HC4: build provenance of prebuilt release binaries is verifiable (source-to-artifact mapping,
  published checksums, inspected release workflow).
- HC5: required platforms within scope are supported: Linux ELF `x86_64` (consumed) and `aarch64`
  (available for future Linux VM use). Non-ELF targets are out of scope by classification.
- HC6: no network access and no undeclared subprocess behavior at link time.

## Base components and overlays

Candidate components and classification:

- mold v3.0.0 executable plus `mold-wrapper.so` preload library:
  inspectable open-source local technology (build tool, local executable).
- Prebuilt release tarballs: same component, consumed as native prebuilt binaries.

Active overlays:

- incumbent dependency replacement (replaces rust-lld as the linker rustc reaches through the cc
  driver on Linux; GNU ld remains for non-rustc links);
- high-trust execution (runs in every Linux build on the dev host, in containers, and in CI, and
  writes shipped native artifacts);
- native and prebuilt binary boundary (release tarballs, distro packages, `mold-wrapper.so`,
  statically linked mimalloc, dlopen of compiler LTO plugins);
- multi-platform claim (upstream builds and tests 20 ELF architectures plus Windows/macOS/FreeBSD
  host builds; this decision consumes Linux x86_64 only).

SaaS gates: not applicable, no hosted component.
Proprietary gates: not applicable, source is public and inspectable.

## Context

Measured on 2026-10-05 on the dev host (Fedora 44, kernel 7.2.7, x86_64, 16 cores, 62 GiB RAM):

- Rust toolchain: rustc and cargo `1.100.0-nightly (1303417c4 2026-09-21)`, host
  `x86_64-unknown-linux-gnu`, LLVM 23.1.1. No `rust-toolchain.toml` in the repository.
- C toolchain: GCC 16.2.1 (`cc`), GNU ld 2.46.1-1.fc44. No mold, lld, or gold binary is installed
  on the host PATH (`command -v` sweep).
- Actual rustc link path, measured with `rustc -C link-arg=-Wl,--version` on a hello world
  (2026-10-05): collect2 invokes
  `~/.rustup/toolchains/nightly-2026-09-22-x86_64-unknown-linux-gnu/lib/rustlib/x86_64-unknown-linux-gnu/bin/gcc-ld/ld.lld`
  through a `-B` directory rustc adds, and the linker reports
  `LLD 23.1.1 (compatible with GNU linkers)`. The incumbent for cargo builds is therefore rustc's
  self-contained rust-lld; GNU ld 2.46.1 handles only non-rustc cc links. The initial incumbent
  record in this report named GNU ld from PATH inspection alone and is superseded by this probe.
- Incumbent per environment (this matters for SC1): the dev host uses rust-lld 23.1.1 (link-path
  probe); the Fedora 44 build container uses GNU ld, proven by the control runs' `.comment`
  output (no LLD marker on default-driver builds, mold marker on mold builds, in "Validation
  results"); GitHub Actions ubuntu runners were not measured (open item), and their
  rustup-toolchain default is inferred to be the self-contained rust-lld from the host probe
  plus upstream issue #1708 (rustup rustc 1.99 on Ubuntu 26.04 defaults to rust-lld);
  the inference is labeled, not measured.
- Toolchain refinement measured during phase E: cargo builds inside the repository and its
  worktrees resolve through mise's nightly Rust, whose self-contained linker reports
  `Linker: LLD 22.1.8` in output `.comment` sections; a bare `rustc` invocation outside mise used
  the rustup default nightly with LLD 23.1.1. Repository-scoped builds therefore consume
  rust-lld 22.1.8; both are the same self-contained-linker mechanism.
- Linker configuration today:
  - repository root `.cargo/config.toml` sets environment only (Zig cache dir, Slint flag),
    no linker or rustflags;
  - `package/music-player/desktop-app/.cargo/config.toml` sets per-target rustflags
    (`target-feature=+aes`) for linux-gnu, both darwin triples, and windows-msvc, and pins
    `linker = "lld-link.exe"` for `x86_64-pc-windows-msvc` only;
  - all Linux cargo linking therefore goes through the default cc driver, which rustc steers to
    its self-contained rust-lld via `-B` (measured by the link-path probe in "Context");
  - host-level `~/.cargo/config.toml` sets `build.build-dir` into the cargo cache
    (`doc/decision/cargo-build-dir-host-cache.md`), so experiments must override the build dir to
    avoid churning shared fingerprints.
- Rust consumers (main worktree, 19 `Cargo.toml` manifests excluding worktrees and vendored trees):
  CLIs (`package/cli/forbidden-strings`, `package/git-policy/cli`,
  `package/cli/nested-wayland-session`, `package/cli/wg-quicker-exempt`), linters
  (`package/linter/monochromatic-lint`, `package/linter/rust`,
  `package/rust-linter-plugin/builtin`), rust modules (`package/rust-module/*` including fuzz and
  bench sidecars), desktop apps (`package/desktop-app/ide`, `package/desktop-app/terminal`,
  `package/desktop-app/file-manager` gtk/qt/sticky variants), music player
  (`package/music-player/desktop-app`, `truepeak-core` plus bench sidecar,
  `android-app/rust` via `cargo-ndk`).
- Release profile facts relevant to linking: `package/cli/forbidden-strings` uses `lto = true`
  (rustc-internal fat LTO, the linker receives plain objects, no linker LTO plugin),
  `panic = "unwind"`; `package/git-policy/cli` uses `panic = "unwind"`.
- Where Linux links happen: this Fedora dev host, the Fedora 41 dev container
  (`package/desktop-app/terminal/Containerfile`), music-player build containers, the root
  `Dockerfile` (ubuntu:latest), and GitHub Actions ubuntu runners (`cargo-publish.yml`,
  `forbidden-strings.yml`, `logger-fuzz.yml`, `toml-edit-fuzz.yml`).
- Non-Linux link surfaces that mold cannot serve: `aarch64`/`x86_64-apple-darwin` (Apple ld),
  `x86_64-pc-windows-msvc` (lld-link, already configured), `*-linux-android` (NDK clang with its
  own lld), Zig-built terminal components (Zig toolchain linker).

Candidate identity resolution:
the user request said "new shiny rusty mold linker".
Evidence resolves this to `rui314/mold`, whose GitHub description is now
"mold 🦠: A Modern Linker in Rust 🦀" with primary language Rust
(`gh repo view rui314/mold --json description,primaryLanguage`, 2026-10-05).
The C++ implementation (releases through v2.42.1) was rewritten in Rust, announced in the v2.42.1
release notes of 2026-09-11, and v3.0.0, published 2026-10-05T10:23:19Z, is the first Rust release.
The "rusty" descriptor matches the implementation language; mold remains ELF-only, so the
evaluation scope is Linux linking.

## Frozen soft criteria and weights

No explicit user priority statement exists for this decision, so every criterion carries the
default weight 1 (skill rule: unspecified priority gets weight 1). Criteria will be refrozen if
the sensitivity matrix shows an order-controlling preference, in which case the controlling
preference is asked before finalizing.

- SC1: measured link-speed benefit for this repository's Linux cargo builds (weight 1).
- SC2: correctness and compatibility risk on the consumed surface (weight 1).
- SC3: integration and operational cost across host, containers, and CI (weight 1).
- SC4: supply-chain and auditability posture (weight 1).
- SC5: release maturity and track record (weight 1).
- SC6: documentation and ecosystem support (weight 1).

Rating anchors for SC1, frozen before any phase E result was read (2026-10-05):

- 4: mold is at least 2x faster than the environment's incumbent on the median relink cycle of a
  typical repository crate, or saves at least 2 s per median relink.
- 3: at least 25 percent faster and at least 0.3 s saved on the median relink cycle, or a
  clearly measured cold-build saving of the same proportion.
- 2: a real benefit beyond run-to-run spread but below the 25 percent or 0.3 s thresholds.
- 1: within run-to-run spread (no measurable benefit).
- 0: measurably slower than the incumbent beyond spread.

The incumbent baseline is scored on SC1 as the complement of the measured mold result.
Disclosure: this rubric has one benefit axis (SC1) against five risk and cost axes (SC2 through
SC6). Under the default equal weights that structure encodes a burden of proof for adopting a
build-critical tool; it is disclosed here rather than redesigned, and the sensitivity matrix
names which weight controls the order.

Maximum per finalist: `6 * 4 = 24` points, normalized to 100.

## Discovery

### User restriction

The user instruction "Evaluate this specific candidate only" fixes the external candidate set to
mold. Required source classes were still searched for the candidate's own identity, registry
presence, provenance, and repository incumbents, but no breadth enumeration of alternative linkers
(lld, wild, gold) was performed beyond what mold's own README cites as comparison points.
Terminal discovery result: single candidate by user restriction; alternatives not enumerated.
This is a recorded deviation from the skill's default breadth requirement.

### Query schedule and log

Frozen schedule (executed 2026-10-05):

1. Repository incumbent class: `rg` sweeps for `Cargo.toml`, `.cargo/config.toml`,
   `linker|link-arg|fuse-ld|mold|lld` across the main worktree; `mise.toml`, `Dockerfile`,
   Containerfiles, `.github/workflows`.
   Result: no configured Linux linker override; GNU ld is the incumbent; Windows MSVC pinned to
   `lld-link.exe`.
2. Category registry class (distro): `dnf -q info mold` on Fedora 44.
   Result: `mold 2.40.4-4.fc44`, license `MIT AND (Apache-2.0 OR MIT)`, repository fedora,
   URL `https://github.com/rui314/mold`. Fedora's package predates v3.0.0.
3. Category registry class (crates.io): `GET https://crates.io/api/v1/crates?q=mold&per_page=5`.
   Result: only an unrelated yanked dependency-injection crate `mold 0.0.1` (2019).
   The linker is not distributed through crates.io; upstream issue #1661 asks for that.
4. Repository host class: `gh repo view rui314/mold` (metadata), `gh release list`/`gh release
   view v3.0.0` (assets, digests, notes), `gh api repos/rui314/mold/languages`
   (Rust 1745951, Shell 478085, C 4129 bytes), `gh api .../readme`, `gh api .../commits`,
   `gh api .../contributors?per_page=8`, `gh issue list --search "sort:updated-desc" --limit 10
   --state all`, `gh pr list` likewise, `gh run list --limit 12`,
   `gh api repos/google/oss-fuzz/contents/projects/mold` (404, not covered).
5. Broader web class: web search
   `mold linker rui314 "A Modern Linker" implementation language C++ ELF Mach-O support 2026`
   (Exa). Result: repository, README, man page, historical releases v2.0.0 (2023-07-26, the MIT
   relicense release), v2.35.0, v2.39.0, March 2026 C++-era commits, issue #1551 (LTO symbol
   lookup). No Mach-O support in mold itself; the README architecture list is ELF-only.
6. Vulnerability class: OSV `POST https://api.osv.dev/v1/query` with
   `{"commit":"8de38c35a2df16a25f7ff87ac3ad07156a925beb"}`. Result: `{}`, no advisories affect
   the pinned commit.

Expansion round: taxonomy terms collected from results were `sold`, `wild`, `rust-lld`,
`lld-link`, `setup-mold`. Per the user restriction, no expansion queries were run for alternative
linkers; `wild` and `lld` appear only as mold README benchmark comparisons. `setup-mold` (the
GitHub Action by the same author) is recorded as an integration option, not a separate candidate.

### Candidate ledger

#### mold v3.0.0 (`rui314/mold`)

- Discovery source: named by the user; confirmed through classes 2 through 6.
- Base category: inspectable open-source local technology.
- Overlays: incumbent replacement, high-trust execution, native/prebuilt boundary,
  multi-platform claim.
- Screening result: pass, no screening hard gate failed; promoted to serious alternative, then to
  hard-gate confirmed (section "Hard-gate outcomes"), then finalist.
- Pinned revision: tag `v3.0.0` = commit `8de38c35a2df16a25f7ff87ac3ad07156a925beb`
  (verified by `git ls-remote . refs/tags/v3.0.0` inside the clone and `git tag --points-at HEAD`).
- Clone: `~/temp/agent/mold-2026-10-05` (shallow, tag checkout).

#### Incumbent baseline: rust-lld 23.1.1 (rustc self-contained) via cc driver

- Discovery source: repository incumbent class (class 1) plus the hello-world link-path probe
  recorded in "Context".
- Base category: inspectable open-source local technology (binutils), consumed today as the
  distro-packaged default.
- Role: status-quo baseline required by the replacement parity overlay; kept as a candidate.
- Evidence depth note: daily production use in this repository plus the measurements in this
  report; no fresh LLVM lld source audit (deviation recorded in "Evidence limits and deviations").

#### Not evaluated (user restriction)

lld, wild, gold, and the `setup-mold` action as an independent subject: excluded from evaluation
by the user instruction; recorded here so the ledger is complete.

## Hard-gate outcomes

- HC1 (correct linking): pending consumer-boundary validation (section "Validation results").
- HC2 (license): pass. `LICENSE` at v3.0.0 is the MIT License, copyright 2023 Rui Ueyama
  (clone `LICENSE:1-3`). MIT is compatible with proprietary distribution of linked output;
  a linker imposes no license on its output. Fedora's compound string
  `MIT AND (Apache-2.0 OR MIT)` reflects bundled Rust dependency licensing, all permissive.
- HC3 (inspectability): pass. Public repository, cloned at the pinned tag; 97 `src/*.rs` files,
  44371 lines of core Rust plus per-arch crates, readable build system.
- HC4 (build provenance): pass. Release assets carry GitHub-computed sha256 digests
  (x86_64-linux tarball: `6c90d4a474c7c0409dfb575be03a5345878ac14fdba18de8b40fa58c60121189`);
  `release-assets.yml` builds each tarball in CI from the pushed tag via `dist.sh` inside pinned
  podman images; `dist.sh` documents pinned Debian snapshot images, pinned Rust toolchain with
  SHA-256, `--locked` cargo dependencies, pinned file timestamps, and a bit-for-bit reproducibility
  goal with one recorded exception (loongarch64 uses live Debian sid). CI runs on the v3.0.0 tag
  completed successfully (`gh run list`, 2026-10-05). Independent local rebuild is scheduled as
  bonus evidence (phase D in "Execution manifests"); the gate itself is met by the inspected
  mapping.
- HC5 (platforms): pass within scope. ELF-only by design; 20 target arches including x86_64 and
  aarch64 (`arch/` listing at v3.0.0; README architecture sentence). macOS, Windows PE, and
  Android link surfaces are explicitly out of this decision's scope and keep their current linkers;
  this is a scope fact, not a candidate failure, because the user's usage question is Linux cargo
  builds. The `mold-3.0.0-x86_64-windows.zip` asset is a Windows-hosted cross-linker for ELF
  output and is not consumed here.
- HC6 (no network, no undeclared subprocesses): pass on source inspection. `rg` over `src/` finds
  no `std::net`, socket, or HTTP usage (the only `hyper` hits are the HyperLogLog utility).
  `src/subprocess.rs` exists solely for `mold -run`, which execs the user-supplied command with
  `LD_PRELOAD=mold-wrapper.so` (documented in README section "mold -run"; wrapper source is
  `c/mold-wrapper.c`). `src/lto.rs` dlopens only the compiler-provided linker plugin passed via
  `--plugin` (same trust model as GNU ld and lld); rustc-internal LTO in this repository never
  engages that path. `build.rs` runs `git` at build time to embed the commit hash (declared in the
  build script source, build-time only).

Screening hard gates (category fit, license, source availability, provenance, security boundary,
platform): no failure. Security advisories: OSV commit query empty; repository has no published
security advisories (`gh api` security-advisories endpoint not populated; no SECURITY.md regression
found in clone root listing).

## Targeted evidence records

Access date for all URLs and API calls: 2026-10-05. Clone path for all `path:line` citations:
`~/temp/agent/mold-2026-10-05` at commit `8de38c35`.

### Project identity and history

- Claim: mold is a production ELF linker since 2021 by the original LLVM lld developer, now
  rewritten in Rust. Relevance: maturity and provenance. Gate: SC5 input. Status: pass.
  Source: README (`README.md`, "Why does linking speed matter" and "Stability" sections);
  v2.42.1 release notes (2026-09-11) announcing the rewrite and stating 2.42.1 is the last C++
  release; v3.0.0 release notes (2026-10-05) stating drop-in parity with 2.42.1, bounds-checked
  input handling replacing segfaults, and verification via per-target test suites, output
  comparison across real workloads, and full Gentoo package rebuilds with GNU ld as control.
  Corroboration: 17392 stars, 569 forks (`gh repo view`); ASPLOS 2027 paper
  `https://arxiv.org/abs/2608.23228` cited by README.

### Release cadence and timeline

- Claim: releases v2.40.1 (2025-06-09), v2.40.2 (2025-07-12), v2.40.3 (2025-07-30),
  v2.40.4 (2025-08-17), v2.41.0 (2026-04-13), v2.42.0 (2026-08-12), v2.42.1 (2026-09-11),
  v3.0.0 (2026-10-05). Relevance: maintenance activity. Gate: maintenance audit. Status: pass.
  Source: `gh release list --repo rui314/mold --limit 8`. Note: v3.0.0 was published roughly
  8 hours before this evaluation started; the Rust codebase itself is older than the release
  (external PRs merged into it during September 2026, see maintenance sample).

### Maintenance sample (10 most recently updated issues, 10 most recently updated PRs)

- Issues (`gh issue list --state all --search "sort:updated-desc" --limit 10`):
  #1708 open today, "rust-lld cannot link mold-cli": a from-source `cargo build --release` failure
  on Ubuntu 26.04 with rustc 1.99 whose default driver links with rust-lld; at sample time zero
  comments (opened 15:42Z, sampled around 18:20Z). Relevant to building mold from source, not to
  mold's linking behavior; the link-path probe shows this host's rustc also defaults to the
  self-contained rust-lld, so the failure mode is reachable for host from-source builds, while
  the container build uses Fedora rustc 1.98.1 (phase B outcome in "Validation results").
  #1706, #1707, #1661, #1704, #1703: feature requests and packaging feedback, all open,
  updated within the last two days.
  #1701 open: "mold silently ignores --no-mmap-output-file" (a silent-ignore bug report).
  #1699 opened by rui314 (big-endian PPC64 ELFv2 support).
  #1671 closed: single-dash long option parsing fixed in 3.0.0.
  #1668 closed 2026-09-21: incorrect `R_X86_64_GOTOFF64` relocation against shared-library
  symbols, reported with assembly repro by a distro toolchain developer, fixed in 3.0.0
  (release notes cite the issue). Relevance: correctness risk class and fix latency
  (report 2026-09-21 or earlier, fix released 2026-10-05). Status: low-signal to moderate
  concern for SC2, mitigated by release-notes verification claims.
- PRs (`gh pr list --state all --search "sort:updated-desc" --limit 10`):
  #1702 merged 2026-10-04 (external FreeBSD `-B` semantics fix, merged within a day);
  #1690, #1691, #1692 merged 2026-09-29 within minutes of each other (external contributor
  bitemyapp, batch-merged by the maintainer); #1694, #1695 closed unmerged with follow-up issue
  #1696 open (thread-pool tuning discussion); #1705, #1590 open feature PRs.
  Maintainer actions observed: merges, closures, issue opening; labels are not used.
- Maintainer concentration (`gh api repos/rui314/mold/contributors?per_page=8`):
  rui314 7963 contributions; next contributors ishitatsuyuki 63, sicherha 56, marxin 42, ksco 30,
  bitemyapp 22, llunak 21, ZhongRuoyu 21. Extreme single-maintainer concentration (~98%),
  sustained over five years, with corporate sponsorship disclosed in README (Mercury and others,
  $128/month+ tier). Relevance: bus-factor risk. Gate: SC4/SC5 input. Status: scored concern,
  not a hard failure; the skill treats tracker and concentration data as score-level evidence for
  a project with strong source, release, and test evidence.

### Dependency and build surface

- Claim: 70 locked packages in `Cargo.lock` at v3.0.0; direct runtime dependencies are blake3,
  bstr, cpp_demangle, crc32fast, flate2 (zlib backend), getrandom, hashbrown, libc, libz-sys,
  memchr, memmap2, portable-atomic, rayon, rustc-demangle, uuid (v4 only), xxhash-rust, zstd;
  build dependency cc. Relevance: human-auditability and supply-chain overlays. Status: pass
  with noted items. Source: clone `Cargo.toml:29-49`, `Cargo.lock` name/version extraction.
  Noted items: mimalloc comes from the author's fork pinned by git rev
  (`cli/Cargo.toml:17-18`, `https://github.com/rui314/mimalloc_rust` rev
  `3979460494f1cd1e7f936cb8e10f41e927c9f698`; lock entries `libmimalloc-sys 0.1.49`,
  `mimalloc 0.1.52`), a same-author package that extends the audit surface and requires git
  fetching at build time; `--features system-allocator` removes it.
  Enumerated after `cargo fetch --locked` in phase N2 (find over the fetched registry sources and
  git checkouts): 16 registry build scripts (`blake3`, `cpp_demangle`, `crc32fast`,
  `crossbeam-deque`, `crossbeam-epoch`, `crossbeam-utils`, `getrandom`, `libc`, `libz-sys`,
  `portable-atomic`, `proc-macro2`, `quote`, `rayon-core`, `serde_core`, `zstd-safe`, `zstd-sys`),
  plus `libmimalloc-sys/build.rs` in the pinned git checkout (it compiles the vendored
  microsoft/mimalloc submodule, fetched at revs `02a2f5df9d7d46d30263b83832eebeeab62dc5fe` and
  `d4881d338125e1cb7c47ba4cfb398d6f7c0c8d45` per the fetch log), plus mold's own `build.rs` and
  `cli/build.rs` (cc compiles `c/mold-wrapper.c` and `c/lto-message.c`; `git` embeds the commit
  hash at build time).
- Source quality indicators: `rustfmt.toml` present; workspace-wide edition 2024,
  `rust-version = 1.95`; release profile `panic = "abort"`; unsafe usage concentrated in
  `src/lto.rs` (69 matches, LLVM plugin C API), `src/elf.rs` (27), `src/symbol.rs` (25),
  `src/util/concurrent_map.rs` (19), `src/util/mod.rs` (14), `src/input_files.rs` (11),
  `src/output_file.rs` (9), `src/gdb_index.rs` (6), `src/mapped_file.rs` (5), consistent with
  mmap, atomics, and C interop in a linker; per v3.0.0 notes, input parsing is bounds-checked
  and panics instead of segfaulting on corrupted input.

### Tests and CI

- Claim: 649 shell-based linker tests under `tests/` plus a Rust integration harness
  (`cli/Cargo.toml` `[[test]] integration`, `harness = false`; `tests/` workspace crate).
  CI (`ci.yml`) runs on every push and PR: all-target build and integration suite on ubuntu-24.04
  with cross toolchains and QEMU for 20 architectures (including 32-bit host checks for armv7,
  i686, powerpc), ASan and TSan sanitizer jobs on nightly with `-Zbuild-std`, an MSan job
  (`run-msan.sh`), a distro matrix (alpine, archlinux, debian:12, fedora, gentoo/stage3,
  opensuse/tumbleweed, ubuntu:22.04, ubuntu:25.04) building and running the x86_64 integration
  suite natively, plus macOS, Windows, MSYS, and FreeBSD host-build jobs.
  Source: clone `.github/workflows/ci.yml`, `install-test-deps.sh`,
  `.github/workflows/install-extras.sh` (pinned cross-toolchain and Intel SDE downloads for
  CET tests). Status: pass; strong breadth.
- Fuzzing: absent. `rg -iln 'fuzz|oss-fuzz|afl|libfuzzer'` over the clone (excluding .git) found
  no fuzzing infrastructure, and `google/oss-fuzz/projects/mold` returns 404. Reported inline as
  required. Compensating evidence: ASan/TSan/MSan CI jobs, the bounds-checked Rust rewrite, and
  pre-release Gentoo-wide differential rebuilds against GNU ld (README "Stability"; v3.0.0 notes).
- CI status at the pinned tag: `gh run list` shows CI, "Build & attach tarballs on tag push", and
  "Build native tarballs" all `completed/success` for branch `v3.0.0` on 2026-10-05T07:13Z, and
  green runs on `main` and `stable` after the tag.

### Distribution and ecosystem

- Fedora 44 packages mold 2.40.4 (C++ era); v3.0.0 is not yet in distro repositories
  (`dnf -q info mold`, 2026-10-05). Relevance: SC3 (containers and CI would install from GitHub
  release tarballs or build from source until distros catch up) and SC6.
- README documents cargo/`.cargo/config.toml` integration for Rust projects
  (`rustflags = ["-C", "link-arg=-fuse-ld=mold"]`, clang driver or GCC >= 12.1; host GCC is
  16.2.1), the `-B` prefix method for older GCC, `mold -run` LD_PRELOAD interception, the
  `setup-mold` GitHub Action, and `.comment`-section verification via `readelf -p .comment`.
- Man page: `docs/mold.md` in the clone, published online and updated by `update-manpage.yml`.
- `mise registry` lists mold as `aqua:rui314/mold`; `mise ls-remote aqua:rui314/mold` on
  2026-10-05 lists up to 2.42.1 only, so installing 3.0.0 through the repository's usual mise
  tooling is not yet possible; a 3.0.0 install today means the GitHub release tarball with a
  sha256 pin, a source build, or waiting for registry and distro propagation (Fedora carries
  2.40.4).
- Documented compatibility limits (`docs/mold.md`, "Compatibility" and "Build reproducibility"
  sections): mold is a drop-in replacement for the GNU linkers for user-land linking;
  linker-script support is deliberately minimal (sufficient for glibc's `libc.so` linker script)
  with no plans to extend it, while the 3.x goal per release notes is closing remaining GNU ld
  gaps including linker scripts (upstream PR #1590 for `PROVIDE` is open); mold output is
  deterministic and carries no host-specific defaults.
- Issue #1708 rechecked around 19:45 UTC: still open, still zero comments; the prebuilt-tarball
  install path sidesteps it entirely, since it affects only from-source builds under rustup
  toolchains whose default driver is rust-lld.

## Execution manifests

Default isolation for all phases: podman container, `--cpus 4 --memory 8g --pids-limit 1024`
(recorded deviation from the 2 CPU / 2 GiB default: the host has 16 cores with ~25 GiB available;
rustc links of the mold-cli debug binary are memory-heavy per upstream issue #1708, and the 649-test
suite plus a 20-arch release build under 2 CPUs would exceed reasonable wall-clock bounds;
all phases remain in a disposable container with no ambient credentials, no real home mount, and a
private scratch volume), network enabled only during the fetch phase, `--network=none` afterwards.

- Phase N/N2 (fetch, network on): executed. Image `registry.fedoraproject.org/fedora:44`, pulled
  digest
  `sha256:86289176d4a4af5c9b9c9df225eed4489f075bb67549411da2e0d4c121854491`; flags
  `--cpus 4 --memory 8g --pids-limit 1024` (recorded deviation from the 2 CPU / 2 GiB default:
  the host has 16 cores with roughly 25 GiB available, and the rustc links of mold-cli are
  memory-heavy per upstream issue #1708); volumes `mold-eval-root` at `/root` (CARGO_HOME and
  CARGO_TARGET_DIR) and the pinned clone bind-mounted read-only at `/src` with the SELinux shared
  label `:z` (host Enforcing). `dnf install` per the `install-test-deps.sh` fedora branch plus
  gcc, git, zlib-devel, rust, cargo (deviation from the planned rustup-stable: distro packages
  avoid a curl-piped installer; the measured container toolchain is Fedora rustc/cargo 1.98.1,
  which satisfies the manifest `rust-version = 1.95`). `cargo fetch --locked` with
  `CARGO_NET_GIT_FETCH_WITH_CLI=true` downloaded the crates.io index and every locked crate, the
  pinned mimalloc_rust rev `3979460494f1cd1e7f936cb8e10f41e927c9f698`, and its two
  microsoft/mimalloc submodule revs. Success condition met: exit 0 under `set -eux`, marker
  `PHASE_N2_DONE`, elapsed 27.8 s warm. The provisioned container was committed as image
  `localhost/mold-eval:v3.0.0-deps-n2`
  (`sha256:51ad0a3946265912e7aa173b3e2da25e01b3852170dc0f54ad78f45f74e371db`) so every later
  phase runs from a fixed dependency state with the network off.
- Phase B (build and test, `--network=none`, `CARGO_NET_OFFLINE=true`, from the committed image):
  executed. `cargo build --locked -p mold-cli --no-default-features --features x86_64` (debug),
  `cargo build --release --locked -p mold-cli --no-default-features --features x86_64` (the
  parity binary for phase C2), then
  `cargo test --locked -p mold-cli --no-default-features --features x86_64 --test integration --
  --native`. Wall-clock ceiling 60 minutes (matches upstream `timeout-minutes: 60`); actual
  elapsed 151 s. Outcome in "Validation results": pass, 519 pass / 39 skip / 0 fail.
- Phase R (all-arch release build): omitted with evidence. Exact omitted command:
  `cargo build --release --locked` with default features (20 arches). The all-arch artifact class
  is exactly the release tarball whose published digest phase C1 verified and which the inspected
  tag CI built green; this repository consumes x86_64-linux-gnu links only, which the phase B
  release configuration (the fedora distro CI job's feature set) covers.
- Phase C1 (prebuilt verification): executed. Host download with curl of
  `mold-3.0.0-x86_64-linux.tar.gz` from the v3.0.0 release (download and `tar` only, no host
  execution at this step); `sha256sum --check` against the GitHub-published digest
  `6c90d4a474c7c0409dfb575be03a5345878ac14fdba18de8b40fa58c60121189`: OK. First execution of the
  extracted `bin/mold` happened inside the committed container image, `--network=none`, default
  2 CPU / 2 GiB isolation: `--version`, a GCC 16.2.1 hello world linked through
  `-fuse-ld=mold` with `ld.mold` symlinked on PATH, execution of the result,
  `readelf -p .comment`, `ldd`. Elapsed 0.8 s.
- Phase C2 (prebuilt versus source-built parity): executed. One offline container at default
  isolation linked the same C source through the tarball binary and the phase B release binary;
  compared version strings, runtime behavior, `.comment` identification, and output bytes with
  `cmp`. Elapsed 3.6 s. Outcome in "Validation results".
- Phase D (reproducibility attempt, optional): `./dist.sh x86_64` on the host under podman
  (pinned Debian snapshot image, pinned Rust toolchain with SHA-256, `--locked` deps), comparing
  the resulting binary digest with the published asset. Decided after phase E; HC4 is already met
  by the tag-to-commit mapping, the verified asset digest, the matching embedded commit hash in
  both the prebuilt and the source-built binary (phases C1, C2), and the inspected green tag CI.
  If skipped, the reason is recorded.
- Phase E (consumer boundary, host, incumbent tooling): executed, first pass (950 s total,
  driver `~/temp/agent/phase-e.mjs`). Disposable git worktree of this
  repository created at commit `b8ade98f5` (`~/temp/agent/wt-mold-eval`; concurrent sessions
  committed to main during this evaluation, the worktree stays pinned). Isolation probe measured
  first: the `CARGO_TARGET_DIR` environment variable overrides the host-level `build.build-dir`
  setting (probe artifact landed in the scratch directory), so experiments set
  `CARGO_TARGET_DIR` under `~/temp/agent` and never churn shared cargo fingerprints.
  mold binary: the digest-verified prebuilt from phase C1, exposed as `ld.mold` in a scratch PATH
  directory; `RUSTFLAGS="-C link-arg=-fuse-ld=mold"`. Host execution of the prebuilt is a
  recorded deviation from container isolation, justified by: the consumer boundary requires the
  host rustc 1.100-nightly toolchain and the shared cargo registry cache; the binary's command
  tree is audited (no network code anywhere in `src/`; subprocess spawn only under the explicit
  `mold -run` flag, which these tests never pass; writes confined to the linker output paths
  rustc provides); and the exact artifact digest matches the upstream CI output.
  Crates: `package/cli/forbidden-strings`, `package/linter/monochromatic-lint`,
  `package/git-policy/cli`. Steps per crate: full `cargo build` and `cargo test` under the
  incumbent rust-lld and under mold; interleaved relink timing (5 runs per linker after touching
  the crate root, medians and spread reported per the noise rule); `readelf -p .comment`
  verification of a mold-linked binary; one real CLI invocation per built binary. Raw `cargo`
  instead of `mise run` tasks is a recorded deviation: tasks accept no environment overrides and
  the evaluation must not modify task configuration.
  `package/music-player/desktop-app` cannot receive env `RUSTFLAGS` because its
  `.cargo/config.toml` sets target-table rustflags that take precedence; mold integration for
  that crate is an adoption-time config edit, recorded as SC3 evidence instead of a test run.
  Deviations discovered during execution and folded into phase E2: the host `build.build-dir`
  setting shares intermediates across RUSTFLAGS variants and `CARGO_BUILD_DIR` is ignored
  (measured probe: the override directory stayed empty after a forced recompile), so cold-build
  numbers are contaminated (the `git-policy-cli` pair, 21.9 s versus 1.7 s, is excluded as
  uninterpretable) and relink runs can absorb occasional cross-arm recompiles; phase E2 gives
  every arm a private `CARGO_HOME` (registry symlinked, no config file) plus a private
  `CARGO_TARGET_DIR`. The host was also under active load from a concurrent agent session
  throughout (repository reflog shows feature commits landing mid-run); phase E captured no load
  data, phase E2 tags every timing run with before/after `/proc/loadavg`.
- Phase E2 (supplemental controls and boundary probes, host, after phase E to avoid CPU
  contention with timing runs): three-arm relink control on `forbidden-strings` adding
  `-fuse-ld=bfd` (GNU ld) alongside rust-lld and mold, with per-run load-average capture;
  `-Ztime-passes` linking-pass isolation on `forbidden-strings` in dedicated target directories
  (nightly host toolchain); a second alternating cold-build pair on `git-policy-cli`;
  a cargo precedence probe on a synthetic scratch project replicating
  `package/music-player/desktop-app/.cargo/config.toml`'s target-table rustflags, to prove or
  disprove by measurement that env `RUSTFLAGS` is ignored there; one `cargo nextest run` of a
  crate suite under mold (the repository's actual test runner, cargo-nextest 0.9.146);
  one real guard invocation of the mold-linked `cli-git-native` against a scratch commit inside
  the throwaway worktree (the git shim executes
  `@monochromatic-dev/git-policy-cli/dist/final/node/index.mjs`, which drives the native binary;
  the invocation pattern is taken from that source); a `mise registry` check for a mold backend
  (result on 2026-10-05: `aqua:rui314/mold` exists; the `mise latest` query is recorded in E2);
  and a recheck of upstream issue #1708 (still zero comments as of 19:45 UTC) and the release
  list (no 3.0.x patch) before finalization. Execution note: the first E2 cold builds ran at
  host loadavg 50-80 on 16 cores (concurrent session activity); every E2 timing run carries
  load tags, and runs whose load differs materially between arms are filtered or discarded in
  the analysis; non-timing probes (precedence, guard invocation, nextest, markers) are
  load-insensitive.

Undeclared command, write, or network endpoint discovered during any phase stops that phase for
manifest update and inspection before continuing.

## Validation results

- Phase N2 (fetch and lifecycle-surface enumeration, network on): pass, exit 0 under `set -eux`.
- Phase B (offline build and native integration suite): pass. Dev profile finished in 33.07 s,
  release profile in 44.36 s, no compiler warnings; the integration harness reported
  `x86_64: pass=519 skip=39 fail=0`; the source-built binary reports
  `mold 3.0.0 (8de38c35a2df16a25f7ff87ac3ad07156a925beb; compatible with GNU ld)`. Total elapsed
  151 s. The 39 skips are per-script self-skips (`tests/lib.rs:459-463` reads a `skipped` marker
  line from each test log): the fedora dependency set installs no clang, gdb, or cross
  toolchains, so those tests opt out; upstream CI runs the same suite on ubuntu-24.04 with clang,
  gdb, ten cross toolchains, QEMU, and Intel SDE and was green on the v3.0.0 tag
  (`gh run list`, 2026-10-05T07:13Z). Issue #1708's rust-lld failure did not reproduce: Fedora
  rustc 1.98.1's default driver linked mold-cli successfully in both profiles.
- Phase C1 (prebuilt digest, first execution, driver flag, `.comment` identification): pass.
  Digest OK; `--version` embeds the pinned tag commit; the linked hello world ran and links only
  libc.
- Phase C2 (prebuilt versus source-built parity): pass. Byte-identical executables from both
  binaries (`cmp` reported no difference), both ran, both carry the mold `.comment`
  identification.
- Control runs (big-link positive control, offline container, 4 CPUs, 119 s total elapsed):
  rebuilding only the `mold-cli` unit (debug profile, `cargo clean -p mold-cli` between runs)
  took 15.0 s under the container's default driver (Fedora rustc 1.98.1 to GNU ld; the output
  `.comment` carried no LLD or mold marker) and 7.2 s with `-fuse-ld=mold` on the second mold
  run (`.comment` confirmed `mold 3.0.0 (8de38c35a2df16a25f7ff87ac3ad07156a925beb; compatible
  with GNU ld)`). The first mold run (49.8 s), the `-fuse-ld=bfd` run (22.0 s), and the trailing
  default rerun (22.4 s) each followed a RUSTFLAGS change, which invalidates every unit
  fingerprint and forced full-tree rebuilds; they are excluded from the same-scope comparison.
  Same-scope result: GNU ld 15.0 s versus mold 7.2 s on a large debug link. The positive control
  passes (the harness resolves a large link-time difference), and the methodology finding is
  folded into phase E: flags stay constant within a target directory. The bfd arm moves to
  phase E2 on the host, against the real host incumbent.
- Harness failures (mine, invalidating, rerun): the first phase N and phase B payloads ran under
  `set -x` without `set -e`, so their exit 0 came from the trailing marker echo; the first phase
  B run found `cargo: command not found` for all three commands (6 s elapsed, zero work done)
  because the dnf-provisioned packages lived in the `--rm`'d phase N container overlay while only
  the `/root` volume persisted; the first phase N build-script enumeration used
  `find -maxdepth 2`, one level too shallow for `registry/src/<index>/<crate>/build.rs`.
  Fixes: `set -eux` payloads, the committed provisioned image for offline phases, `maxdepth 3`,
  and full reruns. The invalid runs are excluded from evidence.
- Phase E (consumer-boundary first pass, host, 950 s): completed; timing caveats recorded in
  "Execution manifests".
  - Correctness: the full `forbidden-strings` `cargo test --locked` suite passes under mold
    exactly as under rust-lld (2 + 40 + 8 tests, 0 failures, identical summaries in both arms).
    The other two crates fail identically under both linkers, so no failure is attributable to
    mold: `git-policy-cli` shows 312 passed / 10 failed in both arms, and the failures are
    git-differential tests (for example
    `command_add::tests::table_and_bulk_spellings_match_git`,
    `command_branch_create::git_tests::tables_match_git`,
    `command_options::git_tests::keep_dashdash_mode_matches_git`) asserting the crate's option
    tables against the installed git 2.55.0, while the worktree is pinned to `b8ade98f5`,
    which predates concurrent in-flight `feat(git-policy-cli)` work on main;
    `monochromatic-lint` shows 378 passed / 4 failed in both arms, and a clean rerun of the same
    suite passed 382 / 0 (elapsed 173.97 s under host load versus 0.79 s during phase E),
    identifying the 4 as load-sensitive flakes, linker-neutral.
  - Linker markers: every mold-arm binary carries
    `mold 3.0.0 (8de38c35a2df16a25f7ff87ac3ad07156a925beb; compatible with GNU ld)` in
    `.comment`; every incumbent-arm binary carries `Linker: LLD 22.1.8`. This proves
    `-C link-arg=-fuse-ld=mold` overrides rustc's self-contained `-B gcc-ld` shim on the host.
  - Binary sizes (debug): `forbidden-strings` 83,785,504 bytes; `monochromatic-lint`
    541,142,680 bytes; `cli-git-native` 7,679,464 bytes.
  - Relink cycles (touch crate root, rebuild; median of 5 runs per arm; phase E isolation
    caveats apply): `forbidden-strings` rust-lld 472 ms versus mold 591 ms (mold about 25
    percent slower; per-run lld 446/465/472/543 plus a 1169 ms first-run outlier, mold
    481/504/591/665/812); `git-policy-cli` rust-lld 145 ms versus mold 317 ms with
    non-overlapping bands (lld 129-179, mold 264-483), consistent with upstream issue #1696
    (thread-setup overhead on small links, open); `monochromatic-lint` rust-lld 4192 ms versus
    mold 4007 ms, within noise, with two unexplained 21 s mold outliers (21105/21553 ms)
    plausibly contention spikes.
  - Cold builds (n=1 per arm, contaminated by shared intermediates, recorded not scored):
    `forbidden-strings` lld 56.2 s / mold 49.5 s; release fat-LTO profile lld 61.8 s /
    mold 61.9 s, identical within a second and compile-dominated; `monochromatic-lint`
    mold-first 81.4 s / lld 65.3 s; `git-policy-cli` excluded as uninterpretable.
  - CLI boundary: mold-linked `forbidden-strings --version` and `--help` exit 0
    (`forbidden-strings 0.4.1`), `monochromatic-lint` exits 0 (`monochromatic-lint 0.1.0`),
    `cli-git-native --version` exits 0 (prints `git version 2.55.0`). The real guard invocation
    runs in phase E2.
  - Test-suite wall times diverged under load (`forbidden-strings` 160.6 s in the lld arm versus
    232.1 s in the mold arm) while summaries stayed identical; treated as contention noise, not
    a linker effect.

## Score arithmetic

Pending validation.

## Sensitivity

Pending scoring.

## Pros and cons

Pending scoring.

## Ranking

Pending scoring.

## Recommendation

Pending. The recommendation is stated only after validation, scoring, and sensitivity complete.

## Evidence limits and deviations

- Single external candidate by explicit user instruction; breadth discovery of alternative linkers
  was not performed (section "Discovery").
- Incumbent baseline evidence depth is production use plus in-report measurements, not a fresh
  binutils source audit (section "Candidate ledger").
- Upstream sanitizer (ASan/TSan/MSan) and cross-architecture QEMU suites are not re-run locally;
  the pinned tag's successful CI runs (all jobs green on `v3.0.0`) are the primary evidence for
  those suites, and the locally consumed surface is x86_64-linux-gnu only, exercised by phase B's
  native integration suite and phase E. Recorded per the omission rule with exact commands in
  `.github/workflows/ci.yml` of the clone.
- Early context probes (2026-10-05T18:10Z through 18:30Z) recorded commands and outputs but not
  per-command elapsed times; all execution phases from phase N onward record elapsed time.
- Elapsed-time and container digest values are added to this report as each phase completes.

## Open items

- Finish phase E2 and filter its timing runs by load tag; decide on phase D.
- Measure or label the CI ubuntu runner incumbent before any adoption decision (the inference is
  recorded in "Context").
- Freeze ratings against the SC1 anchors, run the one-at-a-time sensitivity matrix, and if an
  input controls the order between speed benefit and maturity risk, ask the user for that
  preference with separable options before finalizing.
- Untested link surfaces to carry into "Evidence limits and deviations": cdylib and plugin
  crates, the terminal crate's Zig and vendored-native link path (Fedora 41 container), CI
  fuzz-target links (libFuzzer and ASan instrumented), and release-profile LTO links beyond
  `forbidden-strings`.
- Cleanup at completion: release the report lock, `git worktree remove` the eval worktree,
  `podman rmi localhost/mold-eval:v3.0.0-deps-n2`, `podman volume rm mold-eval-root`, remove
  scratch probe directories; record what was kept and where.
- Update and commit this report after each phase per the skill's update cadence.
