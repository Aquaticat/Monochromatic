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

## Discovery results

Executed 2026-09-17.
Raw pages:
 `~/temp/agent/hashvet-2026-09-17/data/crates/`,
 `data/github/`,
 and the saved web results;
 source archives under `data/crate-src/`.

### Source class 1: crates.io

Every query used `per_page=100` and the User-Agent `hash-library-survey/1.0`.
No result was filtered out before screening.
A result counts as reviewed when it is a hash, checksum, MAC, or hash adapter crate;
 every other result is screened by the source scan and listed in the appendix.

Source-scan method and control:

- Each result's newest stable `.crate` archive was downloaded from `static.crates.io` and extracted, never built.
- Non-test Rust files were searched for x86 intrinsics (`_mm*_` calls, AES, CLMUL, CRC32, and SHA intrinsics),
   aarch64 intrinsics (NEON `v*q` calls, `vaeseq_u8`, `vmull_p64`, `__crc32*`, SHA intrinsics),
   SIMD abstractions (`std::simd`, `wide`, `safe_arch`, `pulp`, `multiversion`),
   128-bit outputs,
   build scripts,
   and C, C++, or assembly files
   (`scripts/crates-scan.ts`).
- Control:
   crates known to carry accelerated paths were flagged on both architectures
   (`gxhash` x86 46/7 and aarch64 48/3 general/dedicated matches, `highway` 131 and 44, `twox-hash` 16 and 27, `sha2` 58/4 and 178/72),
   and crates known to be scalar had zero matches
   (`rapidhash`, `museair`, `komihash`, `wyhash`, `foldhash`, `seahash`, `siphasher`, `polymur-hash`).
  `blake3` 1.8.7 matched on x86 only,
   consistent with its NEON path being C (`c/blake3_neon.c`, compiled in `build.rs`).
- Limit:
   a crate that delegates acceleration to a dependency shows no matches of its own;
   dependents of the candidate crates were listed and are adapters or applications.
- Totals:
   3,322 distinct crates,
   158 with matches on both architectures,
   85 with a SIMD abstraction,
   47 without a downloadable stable version
   (mostly `0.0.0` placeholders).

Query ledger,
 in schedule order,
 with the expansion round (XR) after the initial schedule:

- CR01 `q=non-cryptographic hash`:
   170 reported,
   2 page(s) and 170 results read,
   exhausted;
   new reviewed candidates: `noncrypto-digests`, `wyhash`, `gxhash`, `mwhash`, `fasthash`, `drtahash`, `ahash`, `hashkit`, `polymur-hash`, `t1ha`, `tenthash`, `hashcrew`, `rscrypto`, `axhash-core`, `foldhash`, `rapidhash`, `whasher`, `rotohash-rs`, `blazehash-core`;
   new screening survivors: `hashcrew`.
- CR02 `q=128-bit hash`:
   749 reported,
   5 page(s) and 500 results read,
   two-page rule met;
   new reviewed candidates: `museair`, `siphasher`, `kangarootwelve`, `rustc-stable-hash`, `polyval`, `twox-hash`, `lockstitch`, `highway`, `ghash`, `hashcodecs`, `argon2-rust`;
   new screening survivors: `twox-hash`, `highway`.
- CR03 `q=simd hash`:
   724 reported,
   3 page(s) and 300 results read,
   two-page rule met;
   new reviewed candidates: `seq-hash`, `cubehash`, `crc32fast`, `thread-utilities`, `keccak-batch`, `autobahn-hash`, `gearhash`, `pocx_hashlib`, `simd-adler32`, `tape-sha256`, `blake3-std`, `adler32-simd`, `mm3h`, `halftime`, `blake3`;
   new screening survivors: `autobahn-hash`.
- CR04 `q=aes hash`:
   878 reported,
   3 page(s) and 300 results read,
   two-page rule met;
   new reviewed candidates: `sponge-hash-aes256`, `purecrypto`;
   new screening survivors: none.
- CR05 `q=neon hash`:
   243 reported,
   3 page(s) and 243 results read,
   exhausted;
   new reviewed candidates: `sha3-selkie`, `xxh3`, `graviola`, `polyhash`, `xxhash-rust`;
   new screening survivors: `xxhash-rust`.
- CR06 `q=hardware accelerated hash`:
   266 reported,
   3 page(s) and 266 results read,
   exhausted;
   new reviewed candidates: `verify-beacon`, `crc32c`, `lib-q-keccak`;
   new screening survivors: none.
- CR07 `q=fast hash function`:
   1,862 reported,
   3 page(s) and 300 results read,
   two-page rule met;
   new reviewed candidates: `seahash`, `umash`, `hud-slice-by-8`;
   new screening survivors: none.
- CR08 `q=gxhash`:
   24 reported,
   1 page(s) and 24 results read,
   exhausted;
   new reviewed candidates: none;
   new screening survivors: none.
- CR09 `q=fingerprint hash`:
   1,117 reported,
   5 page(s) and 500 results read,
   two-page rule met;
   new reviewed candidates: none;
   new screening survivors: none.
- CR10 `q=crc simd checksum`:
   83 reported,
   1 page(s) and 83 results read,
   exhausted;
   new reviewed candidates: `crc64fast`, `crc-fast`, `crc64fast-nvme`, `librscrc`, `oxiarc-core`;
   new screening survivors: none.
- CR11 `keyword=hash&sort=downloads`:
   919 reported,
   3 page(s) and 300 results read,
   two-page rule met;
   new reviewed candidates: `sha2`, `sha1`, `bitcoin_hashes`, `k12`, `meowhash`, `sha2ni`, `xxhash-c-sys`, `cyfs-sha2`;
   new screening survivors: none.
- CR12 `keyword=hasher&sort=downloads`:
   46 reported,
   1 page(s) and 46 results read,
   exhausted;
   new reviewed candidates: `slice-by-8`, `axhash`;
   new screening survivors: none.
- CR13 `keyword=non-cryptographic&sort=downloads`:
   6 reported,
   1 page(s) and 6 results read,
   exhausted;
   new reviewed candidates: none;
   new screening survivors: none.
- CR14-xxh3 `undefined`:
   115 reported,
   2 page(s) and 115 results read,
   exhausted;
   new reviewed candidates: none;
   new screening survivors: none.
- CR14-xxhash `undefined`:
   143 reported,
   2 page(s) and 143 results read,
   exhausted;
   new reviewed candidates: none;
   new screening survivors: none.
- CR14-highwayhash `undefined`:
   7 reported,
   1 page(s) and 7 results read,
   exhausted;
   new reviewed candidates: `highwayhash`;
   new screening survivors: none.
- CR14-museair `undefined`:
   3 reported,
   1 page(s) and 3 results read,
   exhausted;
   new reviewed candidates: none;
   new screening survivors: none.
- CR14-rapidhash `undefined`:
   36 reported,
   1 page(s) and 36 results read,
   exhausted;
   new reviewed candidates: none;
   new screening survivors: none.
- CR14-komihash `undefined`:
   3 reported,
   1 page(s) and 3 results read,
   exhausted;
   new reviewed candidates: `komihash`;
   new screening survivors: none.
- CR14-wyhash `undefined`:
   35 reported,
   1 page(s) and 35 results read,
   exhausted;
   new reviewed candidates: `wyhash2`;
   new screening survivors: none.
- CR14-t1ha `undefined`:
   4 reported,
   1 page(s) and 4 results read,
   exhausted;
   new reviewed candidates: none;
   new screening survivors: none.
- CR14-meowhash `undefined`:
   1 reported,
   1 page(s) and 1 results read,
   exhausted;
   new reviewed candidates: none;
   new screening survivors: none.
- CR14-ahash `undefined`:
   193 reported,
   2 page(s) and 193 results read,
   exhausted;
   new reviewed candidates: none;
   new screening survivors: none.
- CR14-foldhash `undefined`:
   30 reported,
   1 page(s) and 30 results read,
   exhausted;
   new reviewed candidates: none;
   new screening survivors: none.
- CR14-blake3 `undefined`:
   1,447 reported,
   3 page(s) and 300 results read,
   two-page rule met;
   new reviewed candidates: `chacha20-blake3`, `spg-crypto`;
   new screening survivors: none.
- CR14-umash `undefined`:
   2 reported,
   1 page(s) and 2 results read,
   exhausted;
   new reviewed candidates: none;
   new screening survivors: none.
- CR14-clhash `undefined`:
   2 reported,
   1 page(s) and 2 results read,
   exhausted;
   new reviewed candidates: none;
   new screening survivors: none.
- CR14-crc32c `undefined`:
   176 reported,
   2 page(s) and 176 results read,
   exhausted;
   new reviewed candidates: `bitcoin-crc32c`, `turbo_crc`;
   new screening survivors: none.
- CR14-crc64 `undefined`:
   41 reported,
   1 page(s) and 41 results read,
   exhausted;
   new reviewed candidates: none;
   new screening survivors: none.
- XR01 `q=incremental hash simd`:
   144 reported,
   2 page(s) and 144 results read,
   exhausted;
   new reviewed candidates: none;
   new screening survivors: none.
- XR02 `q=high-bandwidth checksum`:
   12 reported,
   1 page(s) and 12 results read,
   exhausted;
   new reviewed candidates: none;
   new screening survivors: none.
- XR03 `q=parallel tree hash`:
   899 reported,
   3 page(s) and 300 results read,
   two-page rule met;
   new reviewed candidates: none;
   new screening survivors: none.
- XR04 `q=universal hash`:
   931 reported,
   3 page(s) and 300 results read,
   two-page rule met;
   new reviewed candidates: none;
   new screening survivors: none.

Pagination:
 CR02 and CR09 had a survivor on page 3,
 so pages 4 and 5 were fetched;
 neither added a survivor.
Result:
 source class 1 is saturated.

### Source class 2: GitHub

`gh api search/repositories` and `search/code`,
 best-match order,
 `per_page=100`;
 every query ran until GitHub reported fewer than 100 items on a page,
 so no query reached the 1,000-result cap.

- GH01 `topic:hash-function language:Rust`:
   10 results,
   exhausted;
   hash libraries already in class 1 (`museair`) plus cryptographic and Murmur3 repositories;
   no new survivor.
- GH02 `topic:hashing language:Rust`:
   174 results over 2 pages,
   exhausted;
   `aHash`,
   `gxhash`,
   `twox-hash`,
   `rapidhash`,
   `wyhash-rs`,
   `metrohash-rs` (scalar, HC1),
   `fastmurmur3` (scalar, HC1),
   `autobahn-hash`,
   `cityhash-sys` (C bindings, HC4),
   and applications;
   no new survivor.
- GH03 `topic:non-cryptographic-hash-function`:
   0 results.
- GH04 `hash simd neon language:Rust`:
   2 results
   (a hash table and `keccak-batch`, cryptographic);
   no survivor.
- GH05 `aes hash neon language:Rust`:
   0 results.
- GH06 `128-bit hash language:Rust`:
   1 result
   (`forrus`, a fixed 128-bit-input function, category mismatch).
- GH07 `non-cryptographic hash in:name,description`:
   215 results over 3 pages,
   exhausted;
   families in other languages
   (xxHash C, komihash, a5hash, pengyhash, SMHasher forks),
   Rust repositories not published on crates.io
   (`s0uthview/fernhash`, `hwadii/hache`, `yescallop/mixhash`, `AlyssaRoseDev/cmhash`, `101shaan/BlitzHash`;
   crates.io API returned no crate for each, HC7),
   and `meow-land/mwhash` and `cessen/tenthash` (published, scalar, HC1);
   no new survivor.
- GH08 `gxhash alternative`:
   0 results.
- GC01 code `vaeseq_u8 _mm_aesenc_si128 language:Rust`:
   110 results in 119 repositories over 2 pages;
   vendored `ahash` copies,
   `haraka-rs` (fixed-length cryptographic),
   RandomX and proof-of-space application code,
   an AES random generator,
   and a MeowHash attack tool;
   no hash library with both paths beyond `ahash` (HC2, HC3) and `gxhash` (HC9).
- GC02 code `vmull_p64 _mm_clmulepi64_si128 language:Rust`:
   97 results;
   carry-less multiply utilities,
   GF(2^128) field arithmetic,
   CRC libraries,
   and SIMD parsers;
   no 128-bit hash library.
- GC03 code `__crc32cd _mm_crc32_u64 language:Rust`:
   28 results;
   CRC32C libraries (HC2) and application-internal hash-table hashers;
   no 128-bit hash library.
- XG01 `rotohash` (expansion):
   2 results,
   `jandrewrogers/RotoHash` (C++ reference, x86-64 only per its README, HC4 as a Rust candidate)
   and `int08h/rotohash-rs` (already in class 1).
- XG02 `incremental hash simd language:Rust` (expansion):
   0 results.
- XG03 `parallel hash tree language:Rust` (expansion):
   1 result
   (`dupefind`, an application).

Hash-family indexes:

- SMHasher3 `results/README.md`
   (fetched 2026-09-17 from `gitlab.com/fwojcik/smhasher3/-/raw/main/results/README.md`, 546 lines).
  Families with hardware-specific paths:
   XXH3 (vector, both architectures),
   HighwayHash (vector, both),
   UMASH (CLMUL and PMULL, C),
   MeowHash (x86 AES),
   falkhash, aesnihash, and t1ha0.aes (x86 AES),
   CLhash (x86 CLMUL),
   CityHashCrc and MetroHashCrc (CRC32 instructions, C++),
   FARSH (x86 vector),
   HalftimeHash, VHASH, NMHASH, khashv (outputs of 64 bits or fewer),
   gxhash (HC9),
   and BLAKE3 (cryptographic).
  Pure-Rust implementations with streaming exist only for XXH3 and HighwayHash;
   UMASH, CityHashCrc, and MetroHashCrc exist for Rust only as C or C++ bindings or scalar ports (HC4 or HC1),
   and the x86-only families fail HC1.
- `rurban/smhasher` README
   (fetched 2026-09-17, 486 lines):
   adds `crc32_hw`, `crc64_hw`, and `crc32_pclmul` (32 and 64-bit, HC2),
   `metrohash128crc` (CRC32 instructions on SSE4.2 and NEON, C++, flagged "UB"),
   and `pearsonhash128` (SSSE3 only, HC1).

Result:
 source class 2 and the family indexes are saturated.

### Source class 3: broader web

Linkup search,
 `depth` standard,
 no domain filter,
 no page cursor;
 each query returned one result list of about 10 to 20 entries.

- W01 `non-cryptographic 128-bit hash with hardware acceleration on x86 and ARM`:
   `JohanLindvall/haste` (Go XXH3 with generated SSE2, AVX2, AVX-512, NEON, and SVE2 kernels; not Rust),
   xxHash,
   SHA extension and AES instruction references,
   and a Cryptography Stack Exchange question "What is the fastest stable 128-bit non-cryptographic hash function?"
   (read through the Stack Exchange API because the page returned HTTP 403;
   it has no answers).
- W02 `gxhash alternative`:
   comparison-site pages and gxhash articles;
   no new candidate.
- W03 `fastest non-cryptographic hash NEON AVX2 128-bit output`:
   `haste`,
   a Go XXH3 package,
   Ash Vardanian's post on AWS Graviton checksums
   (StringZilla: 64-bit AES-based hashing in C, HC2 and HC4).
- W04 `AES-NI and ARMv8 crypto extensions based non-cryptographic hash function`:
   instruction-set references and the RustCrypto `aes` crate description;
   no new hash library.
- W05 `Rust hash crate stable output SIMD aarch64`:
   `highway-rs`,
   `crc32fast`,
   and `xxhash-rust` ("Neon - Enabled by default on aarch64 targets");
   no new candidate.
- W06 `XXH3 vs HighwayHash vs MuseAir vs rapidhash comparison`:
   MuseAir,
   rapidhash,
   and xxHash issue #257 comparing 128-bit hashes;
   no new candidate.
- W07 `CRC32 instruction based 128-bit hash function`:
   MatrixOne's AES and CRC32 hash-table hashers in Go assembly,
   CityHash CRC variants;
   no Rust library.
- W08 `SMHasher3 results hardware accelerated hash functions`:
   SMHasher3,
   rapidhash,
   rainstorm (scalar);
   no new candidate.
- W09 `RotoHash alternative high-throughput 128-bit checksum for large files` (expansion):
   RotoHash,
   the XXH3 announcement ("Presenting XXH3", on UMAC's flaw for large checksums),
   BLAKE3 articles;
   no new library.
- W10 `multi-core parallel non-cryptographic hash with stable output for multi-gigabyte files` (expansion):
   Stack Overflow and Stack Exchange threads on parallel and tree hashing
   (BLAKE3, Skein, KangarooTwelve, MD6, and chunk-then-hash constructions,
   all cryptographic or consumer-built);
   no new non-cryptographic library.

Limit:
 the provider exposes no pagination,
 so this class cannot be enumerated.
Registry and repository enumeration,
 which are complete,
 covered every web-found Rust library.

### Source class 4: this repository

`rg --count-matches --ignore-case` over the working tree,
 excluding `node_modules` and lockfiles,
 then reading every match in plans,
 decisions,
 audits,
 manifests,
 and lockfiles:

- RP01 `gxhash`:
   the music player's two call sites and manifests,
   the gxhash study,
   the design doc,
   the troubleshooting doc,
   and `doc/decision/monorepo-manager-all-rust.md`.
- RP02 `xxh3|xxhash|twox`:
   `twox-hash` 2.1.2 through `turso_core` in two music-player lockfiles;
   the handover records that a static musl daemon skeleton with XXH3 built and ran on 2026-09-16
   (`doc/handover/monorepo-manager.md:94`).
- RP03 `highway`:
   only the Highway SIMD C++ library in the package table
   (`package/dev-script/file-enforcer/src/data/packages.generated.ts:5758`),
   unrelated to HighwayHash.
- RP04 `museair|rapidhash|komihash|wyhash|foldhash|ahash`:
   the gxhash study's benchmarks;
   `rapidhash` 4.4.x and `ahash` 0.8.12 as transitive dependencies.
- RP05 `blake3|siphash|siphasher|crc32|crc64|fnv`:
   an earlier all-Rust design that planned `blake3` 1.8.7 content hashes
   (`doc/planning/monorepo-manager-route-research/stack-rust.md:201`, `:547`),
   later replaced by gxhash;
   a TypeScript CRC-32 in `package/module/zip-writer`;
   and transitive `siphasher`.
- RP06:
   no file name in `doc/decision/` or `doc/audit/` contains `hash`
   other than this report.

No hand-rolled 128-bit hash exists in the repository.
The gxhash reimplementation prototype lives in the session scratchpad only.

### Expansion round

New taxonomy terms from the ledger:
 incremental hashing,
 high-bandwidth checksum (RotoHash),
 tree or parallel hashing (BLAKE3, bao),
 universal hashing (HalftimeHash, POLYVAL).
One de-duplicated round ran:
 XR01 to XR04 on crates.io,
 XG01 to XG03 on GitHub,
 W09 and W10 on the web.
The schedule is frozen;
 later terms (Merkle tree, KangarooTwelve) were recorded without new queries.

### Terminal discovery result

Saturated with at least two survivors:
 `xxhash-rust`,
 `twox-hash`,
 `hashcrew`,
 `highway`,
 and `autobahn-hash` passed screening.
The broader-web class has no cursor;
 its results were covered by the complete registry and repository classes.

## Screening

Every result is listed with its outcome in
 [`screening-crates.md`](tech-meow-cache-key-hash-vet-2026-09-17/screening-crates.md)
 (3,322 crates).
This section is the candidate ledger for every hash library reviewed by hand,
 grouped by outcome.
Unless stated otherwise,
 each candidate's base category is inspectable open-source local technology
 with all four overlays from "Classification",
 and evidence comes from its crates.io archive under `data/crate-src/` read on 2026-09-17.

### Result under each reading of hardware acceleration

- R2, SIMD vectorization:
   five screening survivors,
   all XXH3-128 or HighwayHash implementations.
- R1, dedicated instructions:
   no non-cryptographic survivor.
  The functions that meet R1 on both architectures are
   `gxhash` (HC9),
   `ahash` (HC2, HC3),
   `rotohash-rs` (HC10, HC3),
   and the cryptographic `sha2` (SHA extensions) and AES-CMAC through `aes` (AES instructions),
   which are outside the decision scope and measured as controls.
- R1 and R2 together:
   only `rotohash-rs` and `gxhash`,
   both excluded.

So any recommendation relies on R2.

### Screening survivors

#### `xxhash-rust` 0.8.18

- Discovery:
   CR05 first,
   also CR11, CR12, CR14, W05.
- Function:
   XXH3-128 one-shot `xxh3_128` and streaming `Xxh3::digest128` (`src/xxh3.rs:1228`).
- R1:
   no.
- R2:
   yes on both;
   SSE2, AVX2, and AVX-512 paths on x86 and NEON on aarch64,
   chosen by `cfg(target_feature)` at compile time (`src/xxh3.rs:16-55`);
   the vector path covers inputs over 240 bytes.
- Screening gates:
   HC2 pass (128-bit),
   HC3 pending targeted evidence (XXH3 output frozen upstream),
   HC4 pending (no build script, no C),
   HC6 pending (BSL-1.0),
   HC10 pending (streaming API present).
- Result:
   serious alternative.

#### `twox-hash` 2.1.4

- Discovery:
   CR02 first,
   also CR11, CR12, CR14, GH02;
   already a transitive dependency of two music-player lockfiles (2.1.2).
- Function:
   XXH3-128 `XxHash3_128::oneshot` and streaming `write`/`finish_128` (`src/xxhash3_128.rs:35`, `:132`, `:141`).
- R1:
   no.
- R2:
   yes on both;
   run-time AVX2 or SSE2 dispatch on x86 and NEON on aarch64 with the `std` feature (`src/xxhash3/large.rs:100-120`).
- Screening gates:
   HC2 pass,
   HC3 pending (README "Portability": output does not depend on the platform),
   HC4 pending,
   HC6 pending (MIT),
   HC10 pending.
- Result:
   serious alternative.

#### `hashcrew` 0.3.0

- Discovery:
   CR01 first,
   also CR05, CR06, CR09, CR14.
- Function:
   XXH3-128 `xxh3_128` and streaming `Xxh3_128` (`src/xxhash/xxh3.rs:190`, `:1082-1089`).
- R1:
   no for XXH3
   (its CRC family uses CRC and CLMUL instructions but outputs 32 bits).
- R2:
   yes on both;
   NEON, SSE2, and AVX2 kernels for inputs over 240 bytes,
   run-time detection with `std` (`src/xxhash/kernel/mod.rs:58-90`).
- Screening gates:
   HC2 pass,
   HC3 pending,
   HC4 pending,
   HC6 pending (Apache-2.0),
   HC10 pending.
- Result:
   serious alternative.

#### `highway` 1.3.0

- Discovery:
   CR02 first,
   also CR03, CR05, CR07, CR11, CR12, CR14, W05.
- Function:
   HighwayHash-128 through `HighwayHasher::hash128` and streaming `append`/`finalize128` (`src/builder.rs:119-139`).
- R1:
   no.
- R2:
   yes on both;
   SSE4.1 and AVX2 with run-time detection and a portable fallback on x86 (`src/builder.rs:147-185`),
   NEON on aarch64.
- Screening gates:
   HC2 pass,
   HC3 pending (README: "generate consistent 64, 128, and 256bit hashes across all hardware"),
   HC4 pending,
   HC6 pending (MIT),
   HC10 pending.
- Result:
   serious alternative.

#### `autobahn-hash` 0.1.0

- Discovery:
   CR03 first,
   also CR14, GH02.
- Function:
   HighwayHash `hash_128` through nightly `portable_simd` and `multiversion` (`src/lib.rs:1`, `:318`).
- R2:
   yes on both through `core::simd`.
- Result at screening:
   serious alternative;
   exited at targeted evidence on HC4 ("Hard-gate outcomes").

### Exits among named and near-miss candidates

- `gxhash` 3.5.0,
   the incumbent kept as a candidate:
   HC9 (user decision of 2026-09-17).
  Also HC10:
   upstream closed #127 because `Hasher` output differs from the one-shot result and depends on write chunking
   (`gxhash-owned.md`, "`Hasher` streaming API").
- `rotohash-rs` 0.1.2
   (CR01, XR02, XG01),
   RotoHash, 128-bit,
   AES-NI with AVX2 or VAES with AVX-512 on x86 and NEON with the AES extension on aarch64:
   the only candidate meeting R1 and R2 on both architectures.
  HC10:
   the crate offers one-shot `hash` and `hash_with_seed` only (`src/lib.rs:87`, `:158`),
   although the reference README says the algorithm "supports incremental hashing".
  HC3 not established:
   the reference README says "The baseline algorithm is unlikely to change but analysis and verification of hash quality is ongoing",
   and RotoHash is absent from the SMHasher3 results list.
  Without HC10 it would have needed targeted evidence;
   hashing multi-GB outputs through it would require memory-mapping whole files.
- `hashcodecs` 1.4.1 (CR02):
   HC10 for its XXH3-128,
   which has one-shot, prepared-seed, and batch APIs but no streaming state;
   HC1 for its MurmurHash3 x64-128,
   whose aarch64 body is the scalar path (`src/murmur3/x64_128.rs:175-176`).
- `xxh3` 0.1.1 (CR05):
   HC10,
   one-shot `hash128_with_seed` only (`src/xxh3.rs:86`);
   last release 2022-05-20.
- `museair` 0.6.0 (CR02, CR14):
   HC1,
   scalar multiply design with no intrinsics (source scan 0 and 0);
   it passes all SMHasher3 tests,
   which does not offset a hard gate.
- `rapidhash` 4.5.1,
   `komihash` 0.5.0,
   `wyhash` 0.6.0 and its ports,
   `polymur-hash` 0.2.2,
   `seahash` 4.1.0:
   HC1 (scalar) and HC2 (64-bit).
- `foldhash` 0.2.0:
   HC1,
   HC2,
   and HC3 (output not stable by design).
- `ahash` 0.8.12:
   HC2 (64-bit `Hasher`)
   and HC3 (README: output is not stable across versions or platforms).
- `drtahash` 0.0.17:
   HC3 (per-map keys) and HC2.
- `t1ha` 0.1.2:
   HC1 (x86 intrinsics only)
   and HC3 (`t1ha0` output differs by platform).
- `meowhash` 0.3.0:
   HC1 ("aarch64 support has been disabled as of version 0.2", `src/arm.rs:9`)
   and HC3 (MeowHash 0.5 not declared final).
- `axhash-core` 1.0.0,
   `mm3h` 0.1.3:
   HC2 (64-bit outputs).
- `siphasher` 1.0.3,
   `rustc-stable-hash` 0.1.2,
   `tenthash` 1.1.0,
   `metrohash` 1.0.7,
   `cityhasher` 0.1.0,
   `cityhash-rs` 1.0.1,
   `fastmurmur3` 0.2.0,
   `murmur3` 0.5.2,
   `zwohash` 0.1.2,
   `mwhash` 0.1.1:
   HC1 (scalar).
- CRC and Adler crates
   (`crc-fast` 1.10.0, `crc32fast` 1.5.2, `crc32c` 0.6.8, `crc64fast` 1.1.0, `crc64fast-nvme` 1.2.1, `librscrc`, `turbo_crc`,
   `slice-by-8`, `hud-slice-by-8`, `bitcoin-crc32c`, `adler32-simd`, `simd-adler32`):
   HC2,
   outputs of 64 bits or fewer,
   although several meet R1 on both architectures.
- `umash` 0.6.1 through `umash-sys`,
   `highwayhash` 0.0.14,
   `fasthash` 0.4.0,
   `xxhash-c-sys` 0.8.7,
   `cityhash` 0.1.1,
   `clhash-sys`:
   HC4,
   C or C++ sources compiled by build scripts.
- `halftime` 0.1.1,
   `polyval` 0.7.3,
   `polyhash` 0.3.1,
   `ghash`:
   category mismatch,
   universal hashes that need key material and a padding scheme chosen by the consumer.
- `noncrypto-digests` 0.4.0,
   `hashkit` 0.1.5,
   `blazehash-core`,
   `thread-utilities`,
   `whasher`:
   adapters over other hash crates;
   their algorithms are screened through the underlying crates.
- Repositories not on crates.io
   (`fernhash`, `hache`, `mixhash`, `cmhash`, `BlitzHash`):
   HC7.
- Families available only in other languages or as bindings:
   RotoHash C++ reference (x86-64 only),
   UMASH (C),
   MetroHash128CRC and CityHashCrc (C++),
   MeowHash (C, x86 AES),
   `haste` (Go),
   StringZilla (C, 64-bit):
   HC4,
   with HC1 or HC2 where noted.

### Cryptographic functions carried as controls

- `blake3` 1.8.7:
   outside the decision scope.
  On aarch64 its NEON implementation is C (`c/blake3_neon.c`, built in `build.rs` unless `pure`),
   so under HC4 its aarch64 path is portable code:
   it fails HC1 under both readings when no C toolchain is allowed.
  Kept as the requested control
   and because its `update_rayon` tree mode is the one library way to hash one input on several cores.
- `sha2` 0.11.0:
   outside the decision scope;
   meets R1 on both architectures through SHA extensions with run-time detection;
   measured as the R1 control,
   truncated to 128 bits.
- AES-CMAC through `cmac` 0.8.0 and `aes` 0.9.3:
   outside the decision scope;
   meets R1 on both through AES instructions with run-time detection;
   measured as the AES control.
- Other cryptographic crates
   (`sha1`, `k12`, `kangarootwelve`, `blake3-std`, `cubehash`, `keccak-batch`, `graviola`, `rscrypto`, and others in the appendix):
   outside the decision scope,
   not measured.
