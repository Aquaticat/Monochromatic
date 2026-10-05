# Mold linker vet report

Status:
in progress;
hard-gate confirmation and targeted evidence are complete for the candidate;
finalist validation (execution phases) is running.

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
The incumbent (GNU ld via the cc driver) is carried as the status-quo baseline candidate required
by the replacement parity overlay, with evidence depth equal to its production use plus the
measurements recorded in this report, not a fresh source audit.

Start date:
2026-10-05.

Last updated:
2026-10-05.

Governing skill commit:
`37117e36397e30233062828581a5e38217da9458`.

Governing skill SHA-256:
`552ac9955299b65a9f921a4e836b60a3fabc15d3477eeb8ec2bfb3f400647f9b`.

Compatibility fingerprint:
`89c9982ac41072cc6c17e84414f8a1f7bf9a903306c86a87e622f3a37e24b746`.
Fingerprint input (schema 1, RFC 8785 canonicalization, SHA-256 over 1497 UTF-8 bytes):
subject, decision scope, hard constraints, deployment, trust boundary, incumbent
(GNU ld via cc driver, 2.46.1-1.fc44), base categories, overlays.

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

- incumbent dependency replacement (replaces GNU ld as the linker invoked by the cc driver on Linux);
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
  on the host (`command -v` sweep).
- Linker configuration today:
  - repository root `.cargo/config.toml` sets environment only (Zig cache dir, Slint flag),
    no linker or rustflags;
  - `package/music-player/desktop-app/.cargo/config.toml` sets per-target rustflags
    (`target-feature=+aes`) for linux-gnu, both darwin triples, and windows-msvc, and pins
    `linker = "lld-link.exe"` for `x86_64-pc-windows-msvc` only;
  - all Linux linking therefore goes through the default cc driver to GNU ld;
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

#### Incumbent baseline: GNU ld 2.46.1 via cc driver

- Discovery source: repository incumbent class (class 1).
- Base category: inspectable open-source local technology (binutils), consumed today as the
  distro-packaged default.
- Role: status-quo baseline required by the replacement parity overlay; kept as a candidate.
- Evidence depth note: daily production use in this repository plus the measurements in this
  report; no fresh binutils source audit (deviation recorded in "Evidence limits and deviations").

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
  comments (opened 15:42Z, sampled 18:2xZ). Relevant to building mold, not to mold's linking.
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
  fetching at build time; `--features system-allocator` removes it. `libz-sys`, `zstd-sys`,
  `blake3`, `crc32fast`, `libmimalloc-sys`, `cc` are expected build-script (C-compiling) crates;
  the exact enumeration runs after `cargo fetch` in the execution phase.
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

## Execution manifests

Default isolation for all phases: podman container, `--cpus 4 --memory 8g --pids-limit 1024`
(recorded deviation from the 2 CPU / 2 GiB default: the host has 16 cores with ~25 GiB available;
rustc links of the mold-cli debug binary are memory-heavy per upstream issue #1708, and the 649-test
suite plus a 20-arch release build under 2 CPUs would exceed reasonable wall-clock bounds;
all phases remain in a disposable container with no ambient credentials, no real home mount, and a
private scratch volume), network enabled only during the fetch phase, `--network=none` afterwards.

- Phase N (fetch, network on): image `registry.fedoraproject.org/fedora:44` (digest recorded on
  pull); `dnf install` per `install-test-deps.sh` fedora branch (curl, gcc-c++, glibc-static,
  libstdc++-static, diffutils, util-linux, tar) plus gcc, git, zlib-devel; rustup stable per the
  clone's `rust-toolchain.toml` (channel stable, from static.rust-lang.org);
  `cargo fetch --locked` (crates.io and static.crates.io; plus `git fetch` of the pinned
  mimalloc_rust rev from github.com with `CARGO_NET_GIT_FETCH_WITH_CLI=true`).
  Expected writes: container overlay plus named volumes for `CARGO_HOME` and `CARGO_TARGET_DIR`.
  Expected subprocesses: dnf, rustup, cargo, git, cc. Success condition: `cargo fetch --locked`
  exits 0; then enumerate build-script crates from the fetched registry sources.
- Phase B (build and test, network off): CI distro-job equivalent for Fedora x86_64:
  `cargo build --locked -p mold-cli --no-default-features --features x86_64` then
  `cargo test --locked -p mold-cli --no-default-features --features x86_64 --test integration --
  --native`. Wall-clock ceiling 60 minutes (matches upstream `timeout-minutes: 60`).
  Success: exit 0; failures diagnosed individually.
- Phase R (release build, network off): `cargo build --release --locked` (default features,
  all 20 arches, the distributed configuration). Wall-clock ceiling 90 minutes. Output:
  `target/release/mold` and `mold-wrapper.so`, used for consumer-boundary tests.
  Known risk: rust-lld default-driver failure per issue #1708; if reproduced, the fallback driver
  flag is recorded and the failure is diagnosed, not silently worked around.
- Phase C (prebuilt verification, network on): download
  `mold-3.0.0-x86_64-linux.tar.gz` from the v3.0.0 release, `sha256sum` against the published
  digest `6c90d4a474c7c0409dfb575be03a5345878ac14fdba18de8b40fa58c60121189`, extract, run
  `--version`, link a hello-world with both the prebuilt and the source-built binary, compare
  `readelf -p .comment` identification.
- Phase D (reproducibility attempt, network on, optional): `./dist.sh x86_64` in a full clone on
  the host under podman (pinned Debian snapshot image, pinned Rust toolchain, `--locked` deps),
  comparing the resulting tarball's mold binary digest with the published asset. If skipped, the
  reason and the evidence that HC4 is nevertheless met are recorded.
- Phase E (consumer boundary, host, incumbent tooling): disposable git worktree of this repository
  at HEAD (`~/temp/agent/wt-mold-eval`), isolated `CARGO_TARGET_DIR`/build dir under
  `~/temp/agent`, mold binary from phase R exposed as `ld.mold` on `PATH`,
  `RUSTFLAGS="-C link-arg=-fuse-ld=mold"`. Crates: `package/cli/forbidden-strings`,
  `package/linter/monochromatic-lint`, `package/git-policy/cli`. Steps: hello-world driver check
  (GCC 16.2.1 accepts `-fuse-ld=mold`), full `cargo build` and test-suite runs under both linkers,
  interleaved relink timing (5 runs per linker after `touch` of the crate root, medians and
  spread reported per the noise rule), `readelf -p .comment` verification, and one real CLI
  invocation per built binary. No repository file is modified; no shared cargo build-dir
  fingerprints are churned. Deviation note: raw `cargo` is used instead of `mise run` tasks
  because the experiment requires environment overrides that tasks do not accept, and the
  evaluation must not modify task configuration; recorded per the skill's omission rules.
  `package/music-player/desktop-app` cannot receive env `RUSTFLAGS` because its
  `.cargo/config.toml` sets target-table rustflags that take precedence; that crate's mold
  integration is an adoption-time config edit, recorded as SC3 evidence instead of a test run.

Undeclared command, write, or network endpoint discovered during any phase stops that phase for
manifest update and inspection before continuing.

## Validation results

Pending. This section is filled in as phases N, B, R, C, D, and E complete.

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

- Run phases N, B, R, C, E; decide on phase D after C.
- Check whether rustc 1.100-nightly on this host uses rust-lld or cc by default for the hello
  world probe (bears on issue #1708 relevance and on phase R).
- Freeze ratings, run the one-at-a-time sensitivity matrix, and if an input controls the order
  between speed benefit and maturity risk, ask the user for that preference with options before
  finalizing.
- Update and commit this report after each phase per the skill's update cadence.
