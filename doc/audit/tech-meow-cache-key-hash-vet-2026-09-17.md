# Technology vet: meow cache key hash

Status:
 in progress.
Lifecycle phase:
 context and rubric refrozen after the workload correction;
 discovery queries executed,
 screening in progress.

Subject:
 meow cache key hash.

Decision scope:
 select a non-cryptographic hash library for the 128-bit content and cache keys of meow
 (placeholder name of the single-file all-Rust monorepo manager),
 replacing the planned `gxhash128`,
 with hardware acceleration on x86_64 and aarch64 Linux.

Start date:
 2026-09-17.

Last updated:
 2026-09-17.

Governing skill:

- Commit `a05818ad70a40e5769a36de669697ba109891b31`
   (last commit touching `.agents/skills/choosing-technology/SKILL.md`;
   `.claude/skills/choosing-technology/SKILL.md` is an ignored mirror with identical bytes).
- SHA-256 `393eb68c5b2b2f7b16c8f7f90c100fb8be43eefa4501511360cd0572e4ae8087`.

Compatibility fingerprint:
 `0c09784add54f3c69ce4d734f0e5a8ffeb0322ef178e4025506c3a173c40fac1`.
Superseded fingerprint:
 `9d52f6e06051398b78178a00ccbf917d5c64a24a9a0f061c4938362985c9ad6e`,
 before the user's workload corrections of 2026-09-17 added HC10 and the input-size deployment facts
 ("Workload correction").
Fingerprint input and lock tooling:
 `~/temp/agent/hashvet-2026-09-17/scripts/vet-fingerprint-lock.ts` and `report-write.ts`.

Active audit owner:
 Claude Code session `e28ad59c-f3f5-46e9-8c8c-59a61c331610` (subagent).

Prior compatible report:
 none.
No file in `doc/audit/` starts with `tech-meow-cache-key-hash-vet-`.
Related but incompatible:
 [`tech-monorepo-manager-vet-2026-09-16.md`](tech-monorepo-manager-vet-2026-09-16.md) selects the tool itself,
 and [`gxhash-owned.md`](../planning/monorepo-manager-route-research/gxhash-owned.md) is a design study of owning gxhash,
 not a vet report.

## Context

Measured or read on 2026-09-17:

- meow is designed but not implemented
   (`doc/planning/monorepo-manager-from-scratch-design.md`, "Status").
  No code consumes a cache key hash yet,
   so the consumer boundary is exercised through a probe binary,
   not product code.
- Planned incumbent:
   `gxhash` 3.5.0 `gxhash128` for cache keys
   (design doc, "Cache").
  The user removed it on 2026-09-17:
   "Pick some other hash that has hardware acceleration on x86 and ARM instead"
   (design doc, "Cache key hash after the collision findings").
- Reason for removal:
   seed-independent full-width `gxhash128` collisions on the one-byte keyset,
   reproduced locally
   (1 collision on a random 4096-byte base, 2 on a zero base)
   and matching SMHasher3 and upstream issues #83 and #124
   (`gxhash-owned.md`, "Quality and collision resistance").
- Cache key contents:
   task definition,
   argument vector,
   input file content hashes,
   declared environment,
   tool versions,
   the package's lockfile slice,
   dependency outputs,
   platform,
   and a salt
   (design doc, "Cache").
  Two input shapes follow:
   whole file contents,
   and short key material that concatenates metadata and per-file hashes.
- Content hashing is the source of truth for change detection;
   the cache is local only,
   with no adversary,
   so no cryptographic hash is needed (user, 2026-09-16).
- Supported release-blocking targets:
   Linux x86_64 and aarch64,
   each glibc-linked and static musl;
   aarch64 musl is a custom static-pie target built with `-Z build-std` and `rust-lld`,
   with no C cross compiler
   (design doc, "Platform probes", "Build matrix").
- Toolchain:
   floating `nightly` in root `mise.toml`;
   the probes used `nightly-2026-09-12` (`rustc 1.100.0-nightly`).
- Repository Rust crates are `LGPL-3.0-or-later`
   (`package/cli/forbidden-strings/Cargo.toml:21`).
- Repository parallel systems:
   the music player calls `gxhash64` for peak-cache fingerprints
   (`package/music-player/desktop-app/src/peakcache.rs`,
   `package/music-player/android-app/rust/src/fingerprint.rs`);
   `twox-hash` 2.1.2 and `rapidhash` 4.4.x arrive transitively through `turso_core`
   in `package/music-player/truepeak-core/Cargo.lock` and `package/music-player/desktop-app/Cargo.lock`;
   file-enforcer uses SHA-256 in TypeScript for its staleness manifest
   (`package/dev-script/file-enforcer/src/io/staleness-hash.ts:20`).
- Development host:
   AMD Ryzen 7 8700F (Zen 4),
   Fedora Atomic.
  Real aarch64 hardware (`ssh m1`) is powered off;
   aarch64 speed is not measured in this audit,
   and QEMU user mode is used for output equality only.

## Two readings of hardware acceleration

The user's wording,
 "hardware acceleration on x86 and ARM",
 has two readings.
Both are recorded and applied to every candidate.

- Reading R1, dedicated instructions:
   instructions that implement a specific primitive in silicon.
  On x86_64:
   AES-NI (`aesenc`),
   carry-less multiply (`pclmulqdq`, `vpclmulqdq`),
   SSE4.2 `crc32`,
   SHA extensions.
  On aarch64:
   the Cryptography Extension (`aese`, `aesmc`, `pmull`, SHA)
   and the CRC32 extension.
- Reading R2, SIMD vectorization:
   general-purpose vector instructions used by a designed vector path.
  On x86_64:
   SSE2 through AVX-512.
  On aarch64:
   NEON (Advanced SIMD) and SVE.
- Under neither reading:
   scalar 64-bit multiply-and-fold designs (wyhash family, rapidhash, komihash, MuseAir)
   and compiler auto-vectorization without a designed vector path.
  They use ordinary integer instructions every 64-bit CPU has.

Screening applies HC1 when each architecture has a path under R1 or under R2.
The ledger records R1 and R2 separately,
 and the recommendation names the reading it relies on.
For reference,
 gxhash satisfies R1 on both architectures (AES rounds)
 and uses wide vectors only in its x86 `hybrid` build.

## Classification

- Base category for every library candidate:
   inspectable open-source local technology.
- Overlays:
  - Incumbent dependency replacement:
     the planned `gxhash` 3.5.0 `gxhash128` is replaced.
    Keeping it is recorded as a candidate and exits on HC9 (user decision).
  - High-trust execution:
     the library runs inside meow,
     which runs tasks locally and in CI with repository access.
    Human-auditability measurements apply.
  - Native and generated-code boundary:
     SIMD and AES intrinsics are `unsafe` native code paths,
     and any build script or C source is a provenance boundary.
  - Multi-platform claim:
     identical output on x86_64 and aarch64 and across dispatch paths.
- Not applicable:
   SaaS gates (no hosted component)
   and the sensitive-data overlay (inputs are repository files already on the machine, and nothing leaves it).

Scope boundary for cryptographic functions:
 the decision scope names a non-cryptographic hash,
 and the user stated none is needed.
Cryptographic hashes and MACs therefore exit screening as outside the decision scope.
BLAKE3 (requested as a control)
 and any cryptographic construction that is the only kind of function meeting R1 on both architectures
 are still measured as controls,
 so the user can see what widening the scope would buy.
Controls are not ranked finalists.

## Workload correction

Relayed by the coordinator from the user on 2026-09-17,
 after the query schedule was frozen and before any candidate was rated.
Two corrections:

- meow hashes huge inputs:
   the cache records every declared task output with a content hash,
   and dependency output hashes feed downstream keys.
  The user asked for streaming hashing whose output does not depend on chunking,
   with memory bounded independent of file size;
   throughput on multi-GB inputs read from disk,
   page-cache cold and warm,
   in the bounded container with the run-to-run band first;
   whether a candidate can use several cores on one large input with stable output;
   and whether I/O or the hash limits throughput at those sizes.
- Short strings under 1 KiB are not meow's main workload,
   and about 20 KiB files are not small inputs.
  The user asked to weight the ranking by where hashed bytes and hashing time go:
   whole-file hashing from KiB to multi-GB,
   streamed;
   short-input speed matters only for composing cache keys from already-hashed parts.

Measured here on 2026-09-17:

- `package/dev-script/vm-builder/output/qcow2/disk.qcow2`:
   3,966,238,720 bytes,
   3,954,937,856 bytes allocated (`du --block-size=1`),
   so reading it exercises real storage rather than holes.
- Music player debug binaries under `package/music-player/desktop-app/target/debug/`:
   520,131,792 to 662,710,296 bytes (`find -size +400M`).
- Git-tracked files at `88cf6c0e4`:
   8,101 files,
   152,231,070 bytes,
   median 4,051 bytes,
   90th percentile 19,301,
   99th percentile 238,507,
   maximum 22,908,459 (`package/music-player/design/questions/current.html`);
   937 files are 240 bytes or shorter,
   the lengths where XXH3 has no vector path.
  The coordinator's byte shares for the same tree:
   files under 1 KiB are 22.0% of files but 0.39% of bytes,
   1 KiB to 64 KiB hold 33.46% of bytes,
   and 64 KiB and above hold 66.15%.
- Storage under `~/temp/agent` and the repository:
   btrfs on LUKS on an NVMe drive (`SPCC M.2 PCIe SSD`),
   62 GiB RAM.

What changed in this report:

- HC10 added ("Frozen hard constraints").
- Soft criteria re-weighted and split,
   so short-input speed carries weight 1
   and whole-file streamed throughput from KiB to multi-GB carries weight 5
   ("Frozen soft criteria").
- The fingerprint changed;
   the superseded one is listed in the header.
- No ranking existed yet,
   so no adjacent pair had been decided on fingerprint-sized inputs.
  The earlier gxhash study ranked on 70 to 242 byte material
   (`gxhash-owned.md`, "Benchmarks");
   none of its fingerprint-sized orderings is reused here.

## Frozen hard constraints

A candidate must satisfy every constraint.
Hard gates stay outside score arithmetic.

- HC1 hardware acceleration:
   a hardware-accelerated code path on both x86_64 and aarch64 under R1 or R2
   ("Two readings of hardware acceleration").
- HC2 width:
   a native 128-bit output defined by the algorithm.
  Concatenating two 64-bit hashes does not qualify,
   because their collisions are correlated by construction.
  The width is carried over from the `gxhash128` choice of 2026-09-16;
   the audit reports any evidence that argues for another width.
- HC3 stability:
   output of the used function is documented or specified as stable across library releases,
   and is identical on x86_64,
   aarch64,
   and every dispatch path.
- HC4 build:
   builds for `x86_64-unknown-linux-gnu`,
   `x86_64-unknown-linux-musl`,
   `aarch64-unknown-linux-gnu`,
   and the aarch64 musl static-pie target
   with the repository's nightly toolchain,
   the accelerated paths compiled by rustc alone
   and linked by `rust-lld` on aarch64 musl,
   without a C or assembly toolchain.
- HC5 CPU capabilities:
   a missing required CPU capability yields a clear diagnostic instead of a crash,
   either because the library dispatches at run time with a fallback
   or because every required feature can be checked at startup before hashing.
- HC6 license:
   permits distribution inside an `LGPL-3.0-or-later` binary.
- HC7 provenance:
   inspectable source,
   a crates.io package that maps to repository source,
   and no prebuilt or downloaded artifacts.
- HC8 collision gate:
   zero full-width 128-bit collisions on the one-byte keysets,
   meaning every single-byte variant of a zero 4096-byte base and of a random 4096-byte base,
   under several seeds.
  An ideal 128-bit function expects about 1.6 × 10^-27 collisions among 1,044,480 keys,
   so any collision marks a structural flaw.
  Checked during finalist validation,
   after a positive control shows the harness finds known collisions;
   a failure removes the finalist.
- HC9 not gxhash:
   neither `gxhash` nor output derived from it,
   per the user on 2026-09-17.
- HC10 streaming,
   added after the workload correction:
   an incremental or streaming API whose output does not depend on how the input is chunked
   and equals the one-shot result,
   with memory bounded independent of input size.

## Frozen soft criteria

Refrozen after the workload correction,
 before any candidate rating.
Each rating uses 0 through 4 with a confidence;
 low-signal ratings carry a range.

Weights:

- The user's statement to weight the ranking by where hashed bytes and hashing time go
   sets S2 and S3 to weight 5
   and S1 to weight 1.
- Every other criterion has no stated priority and weight 1.

Maximum score:
 weights sum to 19,
 so 76 points.

- S1 key-composition speed, weight 1:
   x86_64 time per hash on short key material
   (70 to 242 byte fingerprint material and per-package key material of 50 bytes to 50 KiB),
   baseline x86-64 and x86-64-v3 builds,
   with differences counted only beyond the measured run-to-run band.
- S2 whole-file throughput, KiB to tens of MiB, weight 5:
   x86_64 time over the contents of every git-tracked file,
   one-shot and streamed in 64 KiB chunks,
   plus a cache-resident 16 KiB buffer,
   both builds,
   same band rule.
- S3 multi-GB throughput from disk, weight 5:
   streamed hashing of a 3.97 GB and a 663 MB file,
   page-cache cold and warm,
   in the bounded container,
   against read-only throughput of the same files,
   so the report states whether I/O or the hash limits.
- S4 multi-core hashing of one large input with stable output, weight 1.
- S5 aarch64 acceleration, weight 1:
   what the aarch64 path accelerates,
   from source,
   plus upstream-published aarch64 measurements;
   low-signal ranges,
   because no aarch64 hardware run happens here.
- S6 quality evidence beyond HC8, weight 1:
   SMHasher3 results and their relevance to a fixed-seed local cache,
   design analysis,
   and additional local keysets.
- S7 stability assurance, weight 1:
   documented freeze,
   upstream golden vectors,
   tests that compare dispatch paths,
   and local cross-architecture equality.
- S8 CPU capability handling, weight 1:
   what meow must add to meet HC5,
   and whether build flags or run-time dispatch are needed.
- S9 auditability and dependency surface, weight 1:
   non-test lines on the used path,
   `unsafe` occurrences,
   runtime dependencies.
- S10 upstream verification, weight 1:
   tests,
   CI matrix,
   fuzzing,
   mutation testing,
   reference-vector comparisons.
- S11 maintenance, weight 1:
   releases,
   issue and pull request handling in the last 12 months,
   maintainer concentration.

Criteria removed from every denominator:

- Price:
   every candidate is free.
- Binary size:
   no size limit is stated beyond rejecting a bundled Node runtime.
- Platforms beyond Linux:
   not release-blocking (user, 2026-09-16).
- Adversarial resistance:
   the cache is local only.

Sensitivity follows the skill:
 each weight-1 criterion is raised through 5 one at a time,
 and S2 and S3 are also lowered to 1 one at a time,
 because their weight is a mapping of the user's words rather than a number the user gave.

## Unresolved preferences

- Which reading of hardware acceleration the user meant.
  Not asked here:
   the coordinator requested both readings with the recommendation's reliance stated.
- Whether a C toolchain for aarch64 musl would be acceptable if it enabled a stronger candidate.
  HC4 follows today's build;
   the report names any candidate that fails only on HC4.
- Whether cryptographic constructions are acceptable,
   now that multi-core hashing of one large input is a scored criterion
   and BLAKE3 is the main library with a tree mode.
  Recorded as a control result,
   not as a finalist.

## Discovery protocol

### Frozen query schedule

Frozen before any query ran.
Result pages are fetched unfiltered;
 screening happens after collection.

#### Source class 1: crates.io registry

Endpoint `https://crates.io/api/v1/crates`,
 `per_page=100`,
 generic User-Agent without personal identifiers,
 at most one request per second.
Default relevance sort for `q=` queries;
 `sort=downloads` for keyword listings.
Pages continue until the registry is exhausted or two consecutive complete pages add no screening survivor.

- CR01 `q=non-cryptographic hash`
- CR02 `q=128-bit hash`
- CR03 `q=simd hash`
- CR04 `q=aes hash`
- CR05 `q=neon hash`
- CR06 `q=hardware accelerated hash`
- CR07 `q=fast hash function`
- CR08 `q=gxhash`
- CR09 `q=fingerprint hash`
- CR10 `q=crc simd checksum`
- CR11 `keyword=hash`
- CR12 `keyword=hasher`
- CR13 `keyword=non-cryptographic`
- CR14 named families,
   one query each:
   `q=xxh3`,
   `q=xxhash`,
   `q=highwayhash`,
   `q=museair`,
   `q=rapidhash`,
   `q=komihash`,
   `q=wyhash`,
   `q=t1ha`,
   `q=meowhash`,
   `q=ahash`,
   `q=foldhash`,
   `q=blake3`,
   `q=umash`,
   `q=clhash`,
   `q=crc32c`,
   `q=crc64`.

Metadata screening is backed by a source scan of each result's newest `.crate` archive from `static.crates.io`:
 intrinsics or SIMD abstractions per architecture,
 128-bit outputs,
 build scripts,
 and C sources.
The scan never builds or runs an archive.

#### Source class 2: GitHub

`gh api search/repositories` with `per_page=100`,
 best-match order,
 pages until exhaustion or two consecutive pages without a new screening survivor;
 the API caps each query at 1,000 results.
`gh api search/code` for the code queries.

- GH01 `topic:hash-function language:Rust`
- GH02 `topic:hashing language:Rust`
- GH03 `topic:non-cryptographic-hash-function`
- GH04 `hash simd neon language:Rust`
- GH05 `aes hash neon language:Rust`
- GH06 `128-bit hash language:Rust`
- GH07 `non-cryptographic hash in:name,description`
- GH08 `gxhash alternative`
- GC01 code `vaeseq_u8 _mm_aesenc_si128 language:Rust`
- GC02 code `vmull_p64 _mm_clmulepi64_si128 language:Rust`
- GC03 code `__crc32cd _mm_crc32_u64 language:Rust`

Hash-family indexes on repository hosts:
 the SMHasher3 results list (`gitlab.com/fwojcik/smhasher3`, `results/README.md`)
 and the `rurban/smhasher` README,
 with every listed family screened at family level.

#### Source class 3: broader web

Linkup search,
 `depth` standard,
 no domain filter.
The provider exposes no page cursor;
 that limit is recorded and covered by registry and repository enumeration.

- W01 `non-cryptographic 128-bit hash with hardware acceleration on x86 and ARM`
- W02 `gxhash alternative`
- W03 `fastest non-cryptographic hash NEON AVX2 128-bit output`
- W04 `AES-NI and ARMv8 crypto extensions based non-cryptographic hash function`
- W05 `Rust hash crate stable output SIMD aarch64`
- W06 `XXH3 vs HighwayHash vs MuseAir vs rapidhash comparison`
- W07 `CRC32 instruction based 128-bit hash function`
- W08 `SMHasher3 results hardware accelerated hash functions`

#### Source class 4: this repository

Uncapped `rg` over the working tree,
 then reading every match in plans,
 decisions,
 audits,
 manifests,
 and lockfiles:

- RP01 `gxhash`
- RP02 `xxh3|xxhash|twox`
- RP03 `highway`
- RP04 `museair|rapidhash|komihash|wyhash|foldhash|ahash`
- RP05 `blake3|siphash|siphasher|crc32|crc64|fnv`
- RP06 `doc/decision/` and `doc/audit/` file names containing `hash`

#### Expansion round

After the initial schedule:

1.  Collect new taxonomy terms from the candidate ledger.
2.  Append one de-duplicated query per applicable source class.
3.  Freeze the schedule.
4.  Record later terms without new queries.
