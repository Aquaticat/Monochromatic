# Technology vet: meow cache key hash, cryptographic hashes eligible

Status:
 in progress.
Lifecycle phase:
 context and rubric frozen;
 query schedule frozen.
Not adopted:
 no decision record exists.

Subject:
 meow cache key hash.

Decision scope:
 select a hash library,
 cryptographic or non-cryptographic,
 for the 128-bit content and cache keys of meow
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
 `600031ed7bd9ab0edfbfac262a89d7e9891f8f075742fb33fdad9d1d858d4000`.
Fingerprint input and write tooling:
 `~/temp/agent/hashvet2-2026-09-17/scripts/fingerprint.ts` and `report-write.ts`.

Active audit owner:
 Claude Code session `e28ad59c-f3f5-46e9-8c8c-59a61c331610` (subagent).

Prior report and reason for a new one:
 [`tech-meow-cache-key-hash-vet-2026-09-17.md`](tech-meow-cache-key-hash-vet-2026-09-17.md)
 (fingerprint `0c09784add54f3c69ce4d734f0e5a8ffeb0322ef178e4025506c3a173c40fac1`)
 has the same subject slug and date but a different fingerprint,
 because the user changed its hard constraints, deployment, and trust boundary
 ("Premise changes").
It is incompatible,
 so this report takes the same-day qualifier `600031ed`,
 the first eight fingerprint characters,
 which no other report occupies.
No compatible report exists.
Measurements from the prior report are reused only where "Reuse of prior evidence" says why they still apply.

## Context

Measured or read on 2026-09-17:

- meow is designed but not implemented
   (`doc/planning/monorepo-manager-from-scratch-design.md`, "Status");
   no code consumes a cache key hash,
   so the consumer boundary is exercised through probe binaries.
- Planned incumbent:
   `gxhash` 3.5.0 `gxhash128`,
   removed by the user on 2026-09-17 after seed-independent one-byte collisions
   (design doc, "Cache key hash after the collision findings").
- The prior vet recommended `twox-hash` 2.1.4 XXH3-128;
   the design recorded it as adopted and then withdrew it,
   because the user had not seen the brief and their answers changed its premises
   (design doc, "Cache key hash vet result").
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
  Every declared output is recorded with a content hash,
   and dependency output hashes feed downstream keys.
- Workload,
   measured:
  - git-tracked files at `93ec584bf`:
     8,107 files,
     152,883,316 bytes,
     median 4,052 bytes,
     90th percentile 19,395,
     99th percentile 238,507,
     maximum 22,908,459
     (`git ls-files -z | xargs --null stat --format=%s`);
     the design doc records p50 4,043 and p90 19,244 for an earlier commit,
     and files of 64 KiB and above holding 66.15% of tracked bytes.
  - The benchmark corpus is the prior vet's snapshot of all 8,101 tracked files at `88cf6c0e4`
     (152,231,070 bytes,
     `~/temp/agent/hashvet-2026-09-17/data/files.bin`),
     whose distribution matches within a few bytes at every percentile.
  - Outputs up to 3,966,238,720 bytes
     (`package/dev-script/vm-builder/output/qcow2/disk.qcow2`)
     and music player debug binaries of 520 to 663 MB.
  - Short-string key composition carries weight 1 (user, 2026-09-17).
- Hashing premises,
   from the design doc "Hashing" and "Platforms and builds",
   as changed by the user on 2026-09-17:
   see "Premise changes".
- Toolchain:
   floating `nightly` in root `mise.toml:94`;
   this audit builds with `nightly-2026-09-12` (`rustc 1.100.0-nightly (0fc141305 2026-09-11)`),
   the same toolchain as the prior vet,
   and uses `nightly-2026-09-16` only for Miri.
- Target features,
   printed by `rustc --print cfg` with that toolchain:
  - `-Ctarget-cpu=x86-64-v4` enables `avx512f`, `avx512bw`, `avx512cd`, `avx512dq`, `avx512vl`
     on top of `avx2`, `bmi1`, `bmi2`, `fma`, `lzcnt`, `movbe`, `sse4.2`, and the lower levels;
     it does not enable `aes`, `pclmulqdq`, `sha`, `vaes`, `vpclmulqdq`, or `gfni`.
    AES-NI and SHA extension paths in an `x86-64-v4` build therefore come from run-time detection
     or from extra target features beyond the level.
  - `aarch64-unknown-linux-musl` enables `neon` only;
     `aes`, `pmull`, `sha2`, `sha3`, and `crc` are not baseline,
     so crypto-extension paths on the release-blocking aarch64 builds need run-time detection
     or a raised aarch64 build with the startup check.
- Repository license for Rust crates:
   `LGPL-3.0-or-later` (`package/cli/forbidden-strings/Cargo.toml:21`).
- Development host:
   AMD Ryzen 7 8700F (Zen 4),
   8 cores and 16 hardware threads (`lscpu`),
   CPU flags including `avx512f`, `avx512bw`, `avx512vl`, `aes`, `vaes`, `pclmulqdq`, `vpclmulqdq`, `sha_ni`, and `gfni`,
   no SHA-512 instructions;
   62 GiB RAM;
   btrfs on LUKS on an NVMe drive;
   Fedora Atomic,
   kernel `7.2.0-ogc6.1.fc44.x86_64`.
- aarch64 hardware:
   none reachable.
  `ssh m1` is powered off and is not contacted by this audit;
   QEMU user mode checks output equality only.

## Premise changes

Relayed by the coordinator from the user on 2026-09-17,
 after the prior vet finished,
 and recorded in the design doc ("Hashing", "Platforms and builds"):

1.  "non-crypto isn't a requirement.
    I only said we don't necessarily need a crypto hash."
    Cryptographic hashes and MACs are eligible candidates,
     not controls.
2.  Weighting,
     answered "A",
     speed first:
     cryptographic hashes compete under the existing weights,
     whole-file throughput at weight 5 and quality beyond the one-byte gate at weight 1.
    The reasoning the user accepted:
     the cache is local and rebuildable,
     a repository able to craft collisions already runs its own tasks,
     and changing the hash later costs one cache rebuild.
3.  Builds:
     "We're planning to ship as many builds as possible.
     Shipping x86-64-v3 and x86-64-v4 as separate builds is fine."
    Then "v4 block only":
     among x86-64 builds only `x86-64-v4` is release-blocking;
     the baseline, `x86-64-v2`, and `x86-64-v3` builds ship without blocking.
    aarch64 glibc and static musl
     (the musl build a static-pie binary from a custom target)
     stay release-blocking.
    Every build raised above its target baseline gets meow's own startup check for its compiled target features
     (design doc, "Missing CPU capabilities"),
     so compile-time kernel selection is not a defect in a raised build.
4.  SIMD kernels count as hardware acceleration,
     and so do dedicated instructions
     (AES-NI, SHA extensions, PMULL, the Arm Cryptography Extension).
    The prior vet's two readings of the phrase collapse into one:
     either kind of path satisfies HC1.

Unchanged requirements:
 hardware acceleration on both x86_64 and aarch64,
 128-bit keys (a longer digest truncated to 128 bits is acceptable),
 stable output for persisted keys,
 streaming with chunking-independent output and bounded memory,
 and static musl builds on both architectures.

Effect on this report,
 against the prior report:

- HC1 now names both kinds of acceleration.
- HC2 admits truncation of a longer digest;
   concatenating two 64-bit hashes still does not qualify,
   because their collisions are correlated by construction.
- HC5 is met by meow's startup check in a raised build as well as by run-time dispatch.
- The decision scope,
   deployment,
   and trust boundary name cryptographic hashes,
   the build tiers,
   and the accepted collision reasoning,
   which changes the fingerprint.
- Soft criteria are refrozen ("Frozen soft criteria"):
   x86_64 throughput is decided on the `x86-64-v4` build,
   aarch64 throughput is reweighted,
   the lower builds get their own criterion,
   crafted-collision resistance joins quality at weight 1,
   and the CPU capability criterion is retired.

## Classification

- Base category for every library candidate:
   inspectable open-source local technology.
- Overlays:
  - Incumbent dependency replacement:
     the planned `gxhash` 3.5.0 `gxhash128` is replaced;
     keeping it is a candidate that exits on HC9.
  - High-trust execution:
     the library runs inside meow,
     which runs tasks locally and in CI with repository access;
     human-auditability measurements apply.
  - Native and generated-code boundary:
     SIMD, AES, and SHA intrinsics are `unsafe` native paths,
     and any build script, C, or assembly source is a provenance boundary.
  - Multi-platform claim:
     identical output on x86_64 and aarch64 and across dispatch paths.
- Not applicable:
   SaaS gates (no hosted component)
   and the sensitive-data overlay (inputs are repository files already on the machine, and nothing leaves it).

## Frozen hard constraints

A candidate must satisfy every constraint.
Hard gates stay outside score arithmetic.
Candidates are library and function pairs:
 one library exposing two functions with different speed or quality
 (for example SHA-256 and SHA-512)
 gives two candidates that share library-level evidence.

- HC1 hardware acceleration:
   a hardware-accelerated code path on both x86_64 and aarch64,
   either a designed SIMD kernel or dedicated instructions
   (AES, SHA, carry-less multiply, CRC).
  Scalar multiply-and-fold designs and compiler auto-vectorization without a designed vector path do not qualify.
- HC2 128-bit keys:
   a native 128-bit output,
   or a longer digest truncated to 128 bits.
  Concatenating two 64-bit hashes does not qualify.
- HC3 stability:
   output of the used function is documented or specified as stable across library releases
   (a published standard counts),
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
  This follows today's build
   (design doc, "Build matrix": the static-pie aarch64 musl binary is built with `rust-lld` and no C cross compiler).
  Whether a C toolchain would be acceptable is an unresolved preference;
   "C toolchain branch" evaluates it conditionally.
- HC5 CPU capabilities:
   a missing required CPU capability yields a clear diagnostic instead of a crash,
   through run-time dispatch with a fallback
   or through meow's startup check for the compiled target features of a raised build.
- HC6 license:
   permits distribution inside an `LGPL-3.0-or-later` binary.
- HC7 provenance:
   inspectable source,
   a crates.io package that maps to repository source,
   and no prebuilt or downloaded artifacts.
- HC8 collision gate:
   zero full-width 128-bit collisions on the one-byte keysets
   (every single-byte variant of a zero 4096-byte base and of a random 4096-byte base,
   under several seeds or keys),
   checked after a positive control shows the harness finds known collisions.
- HC9 not gxhash:
   neither `gxhash` nor output derived from it.
- HC10 streaming:
   an incremental API whose output does not depend on chunking and equals the one-shot result,
   with memory bounded independent of input size.

### C toolchain branch

HC4-C is HC4 with a C compiler and assembler allowed for all four targets,
 including a C cross compiler for the aarch64 musl static-pie target.
Candidates that fail only HC4,
 or fail HC1 only because their accelerated path is C or assembly,
 are carried as branch candidates:
 they receive the speed measurements that decide their possible rank
 and bounded ratings for the rest.
If any branch candidate could enter the ranking above a finalist under the frozen weights,
 the question goes to the user with options;
 otherwise it closes with the bound that rules it out.

## Frozen soft criteria

Frozen before any candidate rating in this report.
Each rating uses 0 through 4 with a confidence;
 low-signal ratings carry a range.

### Criteria and weights

- S1 key-composition speed, weight 1:
   `x86-64-v4` build,
   workloads `fp` (70 to 242 byte fingerprint material)
   and `keymat` (per-package key material of 50 bytes to 50 KiB).
- S2 whole-file throughput, KiB to tens of MiB, weight 5:
   `x86-64-v4` build,
   workloads `files` (one call per tracked file),
   `files-stream64k` (a streaming hasher per file fed 64 KiB slices),
   and `hot16k` (one cache-resident 16 KiB buffer).
- S3 multi-GB throughput from disk, weight 5:
   `x86-64-v4` build,
   single-threaded streaming of the 3.97 GB image and the 663 MB debug binary,
   page-cache cold and warm,
   against read-only throughput of the same files.
- S4 multi-core hashing of one large input with stable output, weight 1.
- S5 aarch64 throughput, weight 5:
   in-memory whole-file and large-stream speed of each candidate's aarch64 path,
   from upstream-published or independent aarch64 measurements and from source analysis of that path;
   low-signal ranges,
   because no aarch64 hardware run happens here.
- S6 quality beyond HC8,
   including resistance to crafted collisions,
   weight 1.
- S7 stability assurance, weight 1:
   documented freeze or standard,
   golden vectors,
   tests comparing dispatch paths,
   and local cross-architecture equality.
- S9 auditability and dependency surface, weight 1:
   non-test lines on the used path,
   `unsafe` occurrences,
   runtime dependencies,
   build scripts and native code.
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
- S12 throughput on the non-blocking x86-64 builds, weight 1:
   the S2 workloads on the baseline, `x86-64-v2`, and `x86-64-v3` builds.

Weights sum to 23,
 so the maximum is 92 points.

### Why these weights

- S2 and S3 stay at 5:
   the user's speed-first answer kept whole-file throughput at weight 5.
  They are decided on the `x86-64-v4` build because it is the only release-blocking x86-64 build.
- S5 rises from 1 to 5.
  aarch64 builds are release-blocking exactly as the `x86-64-v4` build is,
   and the user's weight 5 is for whole-file throughput,
   not for one architecture.
  The prior weight 1 described source-level evidence of what the aarch64 path accelerates;
   this criterion rates aarch64 throughput itself.
  It is one criterion rather than a mirror of both S2 and S3,
   because no aarch64 storage or page cache can be measured here,
   and the only aarch64 evidence is kernel speed,
   which would otherwise be counted twice
   (the skill counts overlapping evidence once under a primary criterion).
  So x86_64 carries 10 points of weight and aarch64 5;
   sensitivity raises S5 to 10 as a defined extra test.
- S12 is weight 1:
   the lower builds "ship but carry lower weight",
   and no number was given,
   so the skill's default for an unspecified priority applies.
  Multi-GB streaming is not repeated for these builds:
   storage and page-cache copy bound it,
   and those ceilings do not depend on the x86-64 level
   (the prior vet's read-only passes were within band between the baseline and `x86-64-v3` builds).
- S1 is weight 1 by the user's statement.
- S6 is weight 1 by the user's speed-first answer,
   which also moves crafted-collision resistance into it;
   the prior report had removed adversarial resistance from every denominator.
- S4, S7, S9, S10, and S11 have no stated priority and weight 1.

### Rating rules

- S1, S2, S3, and S12,
   one mechanical rule for every finalist:
   in each workload and build cell (and file and cache mode for S3),
   a finalist's ratio is its median over the best finalist's median,
   or 1 when its five-run range overlaps the best finalist's range;
   the criterion's value is the geometric mean of its cells,
   mapped to 4 at 0.90 or more,
   3 at 0.70,
   2 at 0.50,
   1 at 0.25,
   else 0.
  A value within 0.03 of a threshold gets medium confidence,
   otherwise high.
  This is the prior vet's rule unchanged.
- S5:
   the same thresholds applied to the evidence-supported range of each candidate's aarch64 speed
   as a ratio to the fastest candidate on the same aarch64 core;
   the rating is the range of mapped values,
   its midpoint the provisional rating.
- S4 anchors:
  - 4:
     a library-provided parallel or tree mode whose output equals the single-threaded function,
     with a measured self-speedup of at least 4× at 8 threads on a 1 GiB in-memory input;
  - 3:
     such a mode with a self-speedup of 2× to 4×;
  - 2:
     such a mode with a self-speedup below 2×;
  - 1:
     no library mode;
     a meow-defined chunk construction would be a new output format meow owns;
  - 0:
     no stable parallel construction is possible.
- S6 anchors:
  - 4:
     no known structural statistical failure,
     and no known attack that crafts collisions below the generic 2^64 cost of a 128-bit truncation;
  - 3:
     no known structural statistical failure,
     but collisions can be crafted cheaply,
     because the function makes no collision-resistance claim when its key is known,
     or because a practical collision attack is published;
  - 2:
     statistical test failures that show no full-width collision at a fixed seed or key;
  - 1:
     full-width collisions at a fixed seed or key in statistical tests;
  - 0:
     structural collisions on simple keysets.
- S7, S9, S10, and S11 are rated from the recorded evidence with the anchors of the prior report,
   and each rating names its evidence.

### Criteria removed from every denominator

- S8 CPU capability handling:
   retired by premise 3;
   every raised build carries meow's startup check,
   and the speed effect of run-time dispatch is already rated by S2, S3, and S12.
- Price:
   every candidate is free.
- Binary size:
   no size limit is stated beyond rejecting a bundled Node runtime.
- Platforms beyond Linux:
   not release-blocking (user, 2026-09-16).

### Sensitivity procedure

- Each weight-1 criterion (S1, S4, S6, S7, S9, S10, S11, S12) raised to 2, 3, 4, and 5, one at a time.
- S2, S3, and S5 each lowered to 4, 3, 2, and 1, one at a time,
   because their weights map the user's words rather than numbers the user gave.
- S5 raised to 10, one extra defined test for full parity of aarch64 with x86_64 throughput.
- Every medium-confidence and low-confidence exact rating moved one step down and up within 0 to 4.
- Both endpoints of every low-signal range.

## Unresolved preferences

- A C toolchain in the build (HC4):
   evaluated through "C toolchain branch" and asked only if it can change the ranking.
- The relative weight of aarch64 and `x86-64-v4` throughput:
   mapped from the user's words ("Why these weights") and tested from S5 weight 1 through 10.

## Reuse of prior evidence

The prior vet ran earlier the same day on the same host,
 toolchains,
 container images,
 and crate versions.
Its scratch root is `~/temp/agent/hashvet-2026-09-17/`,
 and its clones are `~/temp/agent/{xxhash-rust,twox-hash,hashcrew,highway-rs,autobahn-hash,BLAKE3}-2026-09-17`.

Reused,
 with the reason each still applies:

- Discovery pages and results for CR01 to CR14, XR01 to XR04, GH01 to GH08, GC01 to GC03, XG01 to XG03, W01 to W10, and RP01 to RP06:
   fetched between about 05:00 and 06:00 UTC on 2026-09-17;
   registry and repository state within the same day,
   spot-checked by re-running named queries ("Discovery results").
  Their screening outcomes for non-cryptographic candidates are re-examined against the changed premises
   ("Reopened exits").
- Identity, provenance, license, upstream suites, Miri, the `highway` fuzz campaign,
   source-size and maintenance audits,
   and the SMHasher3 records for `xxhash-rust` 0.8.18, `twox-hash` 2.1.4, `hashcrew` 0.3.0, and `highway` 1.3.0:
   the same archives and commits,
   and the same toolchains;
   a changed premise alters how they are rated,
   not what they show.
- HC3 equality runs,
   including the `x86-64-v4` musl probe and aarch64 under QEMU,
   HC8 one-byte results at 8 to 4,096 bytes,
   HC10 streaming results on the baseline and `x86-64-v3` builds,
   and the C reference check,
   for those four crates and for the prior controls `blake3` 1.8.7 (default build), `sha2` 0.11.0 SHA-256, and `cmac` 0.8.0 with `aes` 0.9.3:
   same functions and versions.
  Builds not covered there,
   `x86-64-v4` and BLAKE3's `pure` build,
   are checked again here.

Not reused:

- Throughput numbers enter no rating.
  New candidates must be measured in the same container runs as the prior finalists,
   because a difference counts only against a band measured under the same conditions.
  The prior baseline and `x86-64-v3` medians serve as a reproduction check for the re-run.
- Ratings,
   scores,
   and sensitivity:
   the rubric changed.

## Discovery protocol

### Frozen query schedule

Frozen before any new query ran.
The schedule has three parts:
 the prior vet's executed schedule,
 reused;
 new queries for cryptographic and AES-based constructions;
 and one expansion round appended after the new queries.
Result pages are fetched unfiltered;
 screening happens after collection.

#### Reused schedule

The prior report's "Frozen query schedule" and its expansion round,
 executed with results recorded there:
 crates.io CR01 to CR14 and XR01 to XR04,
 GitHub GH01 to GH08, GC01 to GC03, and XG01 to XG03,
 the SMHasher3 and `rurban/smhasher` family indexes,
 web W01 to W10,
 and repository RP01 to RP06.
CR14-blake3 (`q=blake3`) already covers BLAKE3 crates on crates.io.

#### Source class 1: crates.io registry

Endpoint `https://crates.io/api/v1/crates`,
 `per_page=100`,
 a generic User-Agent with no name or address,
 at most one request per second.
Default relevance sort for `q=` queries;
 `sort=downloads` for keyword and category listings.
Pages continue until the registry is exhausted or two consecutive complete pages add no screening survivor.

- CC01 `q=cryptographic hash`
- CC02 `q=sha256`
- CC03 `q=sha512`
- CC04 `q=sha1`
- CC05 `q=sha-ni`
- CC06 `q=sha3`
- CC07 `q=keccak`
- CC08 `q=kangarootwelve`
- CC09 `q=k12`
- CC10 `q=blake2`
- CC11 `q=cmac`
- CC12 `q=pmac`
- CC13 `q=gmac`
- CC14 `q=polyval`
- CC15 `q=aes mac`
- CC16 `q=message authentication code`
- CC17 `q=md5`
- CC18 `q=digest simd`
- CC19 `q=hash assembly`
- CC20 named families,
   one query each:
   `q=groestl`,
   `q=haraka`,
   `q=areion`,
   `q=skein`,
   `q=sm3`,
   `q=lsh hash`,
   `q=parallelhash`,
   `q=ascon hash`
- CC21 keyword listings:
   `keyword=sha2`,
   `keyword=sha256`,
   `keyword=digest`,
   `keyword=mac`,
   `keyword=blake3`,
   `keyword=keccak`,
   `keyword=crypto`,
   `keyword=cryptography`
- CC22 `category=cryptography`

Metadata screening is backed by the prior vet's source scan
 (`scripts/crates-scan.ts`, never building or running an archive),
 extended in two ways for cryptographic code:

- aarch64 SHA-3 extension intrinsics (`veor3q`, `vrax1q`, `vxarq`, `vbcaxq`) and SM3 intrinsics join the dedicated-instruction patterns.
- A crate without intrinsics of its own is marked as delegating when a runtime dependency is a crate with accelerated paths
   (for example `aes`, `sha2`, `sha1`, `blake3`, `keccak`, `polyval`, `ghash`, `ring`, `aws-lc-rs`, `openssl`, `graviola`),
   and every delegating hash or MAC crate is reviewed by hand;
   the prior scan could not see acceleration held by a dependency.

#### Source class 2: GitHub

`gh api search/repositories` and `search/code`,
 `per_page=100`,
 best-match order,
 pages until exhaustion or two consecutive pages without a new screening survivor;
 each query is capped at 1,000 results by the API.

- GK01 `topic:cryptographic-hash-functions language:Rust`
- GK02 `topic:sha256 language:Rust`
- GK03 `topic:blake3 language:Rust`
- GK04 `topic:keccak language:Rust`
- GK05 `topic:message-authentication-code language:Rust`
- GK06 `sha256 simd neon language:Rust`
- GK07 `hash hardware acceleration aarch64 x86_64 language:Rust`
- GKC1 code `_mm_sha256rnds2_epu32 vsha256hq_u32 language:Rust`
- GKC2 code `vsha512hq_u64 language:Rust`
- GKC3 code `vrax1q_u64 language:Rust`
- GKC4 code `_mm512_aesenc_epi128 language:Rust`

Hash-family indexes:
 the SMHasher3 results list (cryptographic families),
 and the eBACS hash-function measurement list (`bench.cr.yp.to/results-hash.html`),
 with every family that has an x86_64 and an aarch64 accelerated implementation screened at family level.

#### Source class 3: broader web

Linkup search,
 `depth` standard,
 no domain filter;
 the provider exposes no page cursor,
 which is recorded and covered by registry and repository enumeration.

- W11 `fastest cryptographic hash function with hardware acceleration on x86-64 and ARMv8`
- W12 `BLAKE3 vs SHA-256 SHA-NI vs KangarooTwelve throughput AVX-512 NEON`
- W13 `Rust SHA-256 SHA extensions aarch64 x86 runtime detection crate`
- W14 `AES-based hash or MAC VAES VPCLMULQDQ high throughput file checksum`
- W15 `KangarooTwelve Rust SIMD implementation AVX-512 NEON`
- W16 `SHA-512 hardware acceleration ARMv8.2 SHA512 extension x86 SHA512 instructions performance`
- W17 `PMAC parallelizable AES MAC implementation Rust`
- W18 `pure Rust cryptographic library SIMD without C compiler SHA-2 SHA-3 BLAKE3 x86_64 aarch64`

#### Source class 4: this repository

Uncapped `rg` over the working tree,
 then reading every match in plans,
 decisions,
 audits,
 manifests,
 and lockfiles:

- RP07 `sha256|sha-256|sha512|sha3|keccak|kangarootwelve|blake2|blake3|cmac|pmac|polyval|ghash|graviola`
- RP08 lockfile package names `aws-lc-rs`, `ring`, `openssl`, `boring`, `md-5`, `sha1`, `sha2`, `hmac`

#### Expansion round

After the new queries:

1.  Collect new taxonomy terms from the candidate ledger.
2.  Append one de-duplicated query per applicable source class.
3.  Freeze the schedule.
4.  Record later terms without new queries.

## Discovery results

Executed 2026-09-17.
Raw pages:
 `~/temp/agent/hashvet2-2026-09-17/data/crates/` and `data/github/`;
 web results in `data/web/`;
 crate archives under `data/crate-src/` and the prior vet's `crate-src/`.

### Source class 1: crates.io

Every query used `per_page=100` and the User-Agent `hash-library-survey/1.0`.
No result was filtered out before screening.
The prior vet's CR01 to CR14 and XR01 to XR04 results are reused ("Reuse of prior evidence");
 the new queries are listed with their own results.

Source-scan method,
 extending the prior vet's
 (`scripts/crates-scan.ts`, which never builds or runs an archive):

- Each result's newest stable `.crate` archive was downloaded from `static.crates.io` and extracted;
   archives the prior vet had already extracted were reused.
- Non-test Rust files were searched for x86 intrinsics,
   aarch64 intrinsics
   (now including the SHA-3 extension intrinsics `veor3q`, `vrax1q`, `vxarq`, `vbcaxq` and the SM3 intrinsics),
   SIMD abstractions,
   `asm!` and `global_asm!` macros,
   128-bit outputs,
   build scripts,
   and C, C++, or assembly files.
- Every crate's runtime dependencies were parsed from its manifest,
   and a crate whose dependency is itself an accelerated crate
   (`aes`, `sha2`, `sha1`, `blake3`, `keccak`, `polyval`, `ghash`, `ring`, `aws-lc-rs`, `openssl`, `graviola`, and others)
   is marked as delegating,
   because the prior scan could not see acceleration held by a dependency.
- Totals:
   5,092 distinct crates scanned,
   102 with intrinsics for both architectures,
   44 with a SIMD abstraction,
   74 with an `asm!` or `global_asm!` macro,
   226 with C, C++, or assembly sources,
   2,095 delegating to an accelerated dependency,
   63 without a downloadable stable version.
- Triage:
   3,113 crates were listed for review because their name or description names a hash, MAC, digest, or checksum,
   or because they carry one of those signals
   (`scripts/triage.ts`, `data/triage.txt`);
   623 carry a signal and a hash-like name (`data/triage-strong.txt`),
   and every one of those was read by hand.

Query ledger for the new queries,
 in schedule order,
 with the expansion round (XC) last:

- CC01 `q=cryptographic hash`:
   2,156 reported,
   10 page(s) and 1,000 results read,
   two-page rule met;
   new reviewed candidates: `gxhash`, `noncrypto-digests`, `rapidhash`, `highway`, `ahash`, `wyhash`, `sha3`, `rscrypto`, `fasthash-sys`, `fasthash-sys-fork`, `crypto-hashes`, `stringzilla`, `hashkit`, `t1ha`, `sha1-checked`, `iroh-blake3`, `blake3`, `ascon-hash`, `foldhash`, `md-5`, `hmac`, `fluence-blake3`, `lib-q-keccak`, `kangarootwelve_xkcp`, `fleek-blake3`, `ripemd`, `whirlpool`, `sm3`, `groestl`, `streebog`, `skein`, `sha2`, `multihash-codetable`, `hashcrew`, `axhash-core`, `spg-crypto`, `xoodyak`, `sha1`, `sha-1`, `fast-md5`, `cryptoxide`, `museair`, `md5-many`, `gmcrypto-core`;
   new screening survivors: `highway`, `rscrypto`, `blake3`, `sha2`, `hashcrew`, `xoodyak`, `sha1`, `cryptoxide`.
- CC02 `q=sha256`:
   4,020 reported,
   10 page(s) and 1,000 results read,
   two-page rule met;
   new reviewed candidates: `sha256`, `hashtree-rs`, `purecrypto`, `graviola`, `bitcoin_hashes`, `sha2raw`;
   new screening survivors: `purecrypto`, `graviola`, `bitcoin_hashes`.
- CC03 `q=sha512`:
   500 reported,
   6 page(s) and 500 results read,
   exhausted;
   new reviewed candidates: `ckb-opt-sha512`, `tidecoin_hashes`, `scytale`;
   new screening survivors: `scytale`.
- CC04 `q=sha1`:
   689 reported,
   3 page(s) and 300 results read,
   two-page rule met;
   new reviewed candidates: `sha1-asm`, `shaman`;
   new screening survivors: none.
- CC05 `q=sha-ni`:
   30 reported,
   1 page(s) and 30 results read,
   exhausted;
   new reviewed candidates: `tape-sha256`, `sha2ni`;
   new screening survivors: none.
- CC06 `q=sha3`:
   558 reported,
   3 page(s) and 300 results read,
   two-page rule met;
   new reviewed candidates: `sha3-selkie`, `sha3-asm`, `sha3_ce`, `libcrux-sha3`, `crc-fast`, `ckb-opt-fips202`, `tiny-keccak`, `keccak`, `shake`;
   new screening survivors: none.
- CC07 `q=keccak`:
   421 reported,
   3 page(s) and 300 results read,
   two-page rule met;
   new reviewed candidates: `keccak-batch`, `p3-keccak`, `kangarootwelve`, `turboshake`, `cshake`;
   new screening survivors: none.
- CC08 `q=kangarootwelve`:
   55 reported,
   1 page(s) and 55 results read,
   exhausted;
   new reviewed candidates: `k12`, `marsupial-sys`;
   new screening survivors: `k12`.
- CC09 `q=k12`:
   66 reported,
   1 page(s) and 66 results read,
   exhausted;
   new reviewed candidates: none;
   new screening survivors: none.
- CC10 `q=blake2`:
   216 reported,
   3 page(s) and 216 results read,
   exhausted;
   new reviewed candidates: `blake2`, `blake2-rfc`, `blake2_ce`, `blake2_c`, `blake2b_simd`, `blake2s_simd`, `blake2b-rs`, `blake3-std`, `ckb-opt-blake2b`;
   new screening survivors: none.
- CC11 `q=cmac`:
   107 reported,
   2 page(s) and 107 results read,
   exhausted;
   new reviewed candidates: `cmac`;
   new screening survivors: `cmac`.
- CC12 `q=pmac`:
   8 reported,
   1 page(s) and 8 results read,
   exhausted;
   new reviewed candidates: `pmac`;
   new screening survivors: `pmac`.
- CC13 `q=gmac`:
   25 reported,
   1 page(s) and 25 results read,
   exhausted;
   new reviewed candidates: `polyval`;
   new screening survivors: none.
- CC14 `q=polyval`:
   33 reported,
   1 page(s) and 33 results read,
   exhausted;
   new reviewed candidates: `polyhash`, `ghash`;
   new screening survivors: none.
- CC15 `q=aes mac`:
   283 reported,
   3 page(s) and 283 results read,
   exhausted;
   new reviewed candidates: `aes`, `halftime`, `drtahash`;
   new screening survivors: none.
- CC16 `q=message authentication code`:
   3,663 reported,
   3 page(s) and 300 results read,
   two-page rule met;
   new reviewed candidates: none;
   new screening survivors: none.
- CC17 `q=md5`:
   955 reported,
   3 page(s) and 300 results read,
   two-page rule met;
   new reviewed candidates: `md5-asm`;
   new screening survivors: none.
- CC18 `q=digest simd`:
   144 reported,
   2 page(s) and 144 results read,
   exhausted;
   new reviewed candidates: `crc64fast`, `cubehash`, `crc64fast-nvme`, `hashcodecs`;
   new screening survivors: `cubehash`.
- CC19 `q=hash assembly`:
   926 reported,
   3 page(s) and 300 results read,
   two-page rule met;
   new reviewed candidates: none;
   new screening survivors: none.
- CC20-groestl `q=groestl`:
   19 reported,
   1 page(s) and 19 results read,
   exhausted;
   new reviewed candidates: `groestl-aesni`;
   new screening survivors: none.
- CC20-haraka `q=haraka`:
   4 reported,
   1 page(s) and 4 results read,
   exhausted;
   new reviewed candidates: none;
   new screening survivors: none.
- CC20-areion `q=areion`:
   1 reported,
   1 page(s) and 1 results read,
   exhausted;
   new reviewed candidates: `areion`;
   new screening survivors: none.
- CC20-skein `q=skein`:
   20 reported,
   1 page(s) and 20 results read,
   exhausted;
   new reviewed candidates: `skein-ffi`;
   new screening survivors: none.
- CC20-sm3 `q=sm3`:
   106 reported,
   2 page(s) and 106 results read,
   exhausted;
   new reviewed candidates: none;
   new screening survivors: none.
- CC20-lsh `q=lsh hash`:
   51 reported,
   1 page(s) and 51 results read,
   exhausted;
   new reviewed candidates: none;
   new screening survivors: none.
- CC20-parallelhash `q=parallelhash`:
   7 reported,
   1 page(s) and 7 results read,
   exhausted;
   new reviewed candidates: none;
   new screening survivors: none.
- CC20-ascon `q=ascon hash`:
   22 reported,
   1 page(s) and 22 results read,
   exhausted;
   new reviewed candidates: none;
   new screening survivors: none.
- CC21-sha2 `keyword=sha2 sorted by downloads`:
   31 reported,
   1 page(s) and 31 results read,
   exhausted;
   new reviewed candidates: `sha2-asm`, `sha2_ce`;
   new screening survivors: none.
- CC21-sha256 `keyword=sha256 sorted by downloads`:
   91 reported,
   1 page(s) and 91 results read,
   exhausted;
   new reviewed candidates: `lonesha256`, `ckb-opt-sha256`;
   new screening survivors: none.
- CC21-digest `keyword=digest sorted by downloads`:
   176 reported,
   2 page(s) and 176 results read,
   exhausted;
   new reviewed candidates: `meowhash`, `sponge-hash-aes256`, `ringpcx`;
   new screening survivors: none.
- CC21-mac `keyword=mac sorted by downloads`:
   88 reported,
   1 page(s) and 88 results read,
   exhausted;
   new reviewed candidates: `flatline-umac`;
   new screening survivors: none.
- CC21-blake3 `keyword=blake3 sorted by downloads`:
   119 reported,
   2 page(s) and 119 results read,
   exhausted;
   new reviewed candidates: none;
   new screening survivors: none.
- CC21-keccak `keyword=keccak sorted by downloads`:
   53 reported,
   1 page(s) and 53 results read,
   exhausted;
   new reviewed candidates: none;
   new screening survivors: none.
- CC21-crypto `keyword=crypto sorted by downloads`:
   2,660 reported,
   6 page(s) and 600 results read,
   two-page rule met;
   new reviewed candidates: `ring`, `siphasher`, `openssl`, `aws-lc-rs`;
   new screening survivors: none.
- CC21-cryptography `keyword=cryptography sorted by downloads`:
   2,491 reported,
   3 page(s) and 300 results read,
   two-page rule met;
   new reviewed candidates: none;
   new screening survivors: none.
- CC22 `category=cryptography sorted by downloads`:
   10,152 reported,
   3 page(s) and 300 results read,
   two-page rule met;
   new reviewed candidates: none;
   new screening survivors: none.

Pagination:
 CC01, CC02, CC03, and CC21-crypto had a survivor on their third page or later,
 so paging continued;
 CC01 and CC02 ran to the tenth page,
 where two consecutive complete pages added no survivor.
No other query needed more than its first complete pages.
Result:
 source class 1 is saturated.

### Expansion round

New taxonomy terms from the ledger:
 AES-round universal hash (LeMac, PetitMac),
 multi-buffer and batch hashing,
 hash chains,
 Xoodoo and Xoodyak,
 CubeHash,
 sponge hash over AES.
One de-duplicated round ran:
 XC01 to XC04 on crates.io,
 XG04 and XG05 on GitHub (both returned 0 results),
 and one web query.
It found `xoodoo` 0.1.0 (the earlier name of `xoodyak`, x86-only intrinsics),
 `xoofff`,
 `permutation-xoodoo`,
 `sha3-kernel-hasher` (x86-only),
 `oxicrypt-cmac` (over `oxicrypt-aes`, whose AES is portable software with no AES instructions),
 and the LeMac and PetitMac artifact,
 which ships C and Python reference implementations only
 (`github.com/AugustinBariant/Implementations_LeMac_PetitMac`, read 2026-09-17),
 so it has no Rust crate (HC7) and no rustc-only build (HC4).
The schedule is frozen;
 later terms were recorded without new queries.

### Source class 2: GitHub

`gh api search/repositories` and `search/code`,
 best-match order,
 `per_page=100`;
 every query ran until GitHub returned fewer than 100 items on a page,
 so none reached the 1,000-result cap
 (`scripts/gh-query.ts`, pages in `data/github/`).
Libraries found only here were checked against the crates.io API.

- GK01 `topic:cryptographic-hash-functions language:Rust`:
   2 results;
   `RustCrypto/hashes` (its crates are in class 1)
   and `ohsayan/rcrypt` (password hashing, category mismatch).
- GK02 `topic:sha256 language:Rust`:
   119 results over 2 pages;
   applications, educational SHA-256 code, and libraries whose crates are in class 1
   (`baoyachi/sha256-rs` as `sha256`, `DoumanAsh/lhash`, `jedisct1/rust-hmac-sha256`);
   `SongXiaoXi/tachyon-rs` (SIMD cryptography) is not on crates.io
   (API 404 for `tachyon-rs`; the crate named `tachyon` is an unrelated memory-latency tool),
   HC7.
- GK03 `topic:blake3 language:Rust`:
   119 results over 2 pages;
   `orion-rs/orion`, `skerkour/chacha20-blake3`, `loadingalias/rscrypto`, `stelar-labs/fides-rs`, `jamesgober/crypt-io`
   (all on crates.io, class 1),
   `TinoGuo/r_crypto` (not on crates.io, HC7),
   and applications.
- GK04 `topic:keccak language:Rust`:
   20 results;
   `debris/tiny-keccak`, `itzmeanjan/turboshake`, `itzmeanjan/kangarootwelve`, `nxm-rs/keccak-batch` (class 1),
   educational SHA-3 code,
   `codahale/cyclist` and `conradludgate/farfalle` (permutation modes, category mismatch).
- GK05 `topic:message-authentication-code language:Rust`:
   2 results;
   `itzmeanjan/multimixer-128` (keyed universal hash, category mismatch)
   and `KizzyCode/crypto_api` (traits only).
- GK06 `sha256 simd neon language:Rust`:
   1 result,
   `tachyon-rs` (HC7).
- GK07 `hash hardware acceleration aarch64 x86_64 language:Rust`:
   0 results.
- GKC1 code `_mm_sha256rnds2_epu32 vsha256hq_u32 language:Rust`:
   12 results in 10 repositories;
   `purecrypto` and `verify-beacon` (class 1),
   `dong-qiu/openhitls-rs` (`hitls-crypto`, not on crates.io, HC7),
   and application-internal SHA-256 code (makepad, iroha, CryptKeyPer, test corpora).
- GKC2 code `vsha512hq_u64 language:Rust`:
   156 results over 2 pages,
   mostly vendored copies of `sha2`;
   libraries `RustCrypto/hashes`, `typed-io/cryptoxide`, `loadingalias/rscrypto`, `KarpelesLab/purecrypto`,
   `valkyoth/brynja` (`brynja-crypto-cpu`), `sergii-ziborov/blindplane` (`blindplane-crypto`)
   (class 1 or checked there),
   `tachyon-rs` and `openhitls-rs` (HC7).
- GKC3 code `vrax1q_u64 language:Rust`:
   69 results;
   `RustCrypto/sponges` (`keccak`), `cryspen/libcrux` (`libcrux-sha3`), `cryptoxide`, `rscrypto`, `brynja`,
   `Plonky3/Plonky3` (`p3-keccak`, Keccak-f and Keccak-256 for proof systems),
   standard-library copies,
   and vanity-address miners.
- GKC4 code `_mm512_aesenc_epi128 language:Rust`:
   175 results over 2 pages,
   mostly `stdarch` and Miri copies;
   libraries `RustCrypto/block-ciphers` (`aes` VAES backends), `ctz/graviola`, `rscrypto`, `tachyon-rs`,
   AES-GCM and AEGIS implementations (category mismatch),
   and `byt3forg3/Tachyon`,
   an experimental AES-NI and AVX-512 hash with x86 and portable kernels only
   (`algorithms/tachyon/src/kernels/{aesni,avx512,portable}`),
   not on crates.io (HC1, HC7).

Hash-family indexes:

- SMHasher3 `results/README.md`
   (saved by the prior vet at `~/temp/agent/hashvet-2026-09-17/data/smhasher3-results-readme.md`,
   546 lines):
   the "Passing hashes" table (hashes that pass all tests) lists these cryptographic families:
   `blake3`,
   `blake2s` at 128, 160, 224, and 256 bits,
   `blake2b` at 128 to 256 bits,
   `SHA-2-224` and `SHA-2-256`,
   `SHA-1`,
   `MD5`,
   `SHA-3`,
   and the Ascon CXOF instances.
  Every cryptographic entry passes;
   the AES-based non-cryptographic entries
   (`aesnihash-peterrk` with 41 failures, `aesnihash-majek` with 64, `t1ha0.aesA` and `t1ha0.aesB` with 5)
   are in the "Failing hashes" table,
   which is the reason the vet treats an AES-round universal hash as needing its own quality evidence
   rather than inheriting AES's.
  The index reports quality and speed,
   not which instruction sets an implementation uses,
   so acceleration is established per crate in screening, not from this table.
- eBACS `primitives-hash.html` (fetched 2026-09-17, 172 primitives, 1,115 implementations,
   `data/web/ebacs-hash-impls.txt`):
   primitives with both an x86 vector or AES implementation and an Arm NEON or ARMv8 implementation are
   `blake3`, `blake256`, `blake512`, `blake2b`, `bmw512`, `cubehash512`, `cubehash1632`, `groestl256`, `groestl512`,
   `k12`, `keccak` variants, `lsh256`, `lsh512`, `luffa256` to `luffa512`, `romulush`, `round3jh256`, `round3jh512`,
   the SHA-3 and SHAKE instances, and `xoodyakv1`.
  Each family was looked up in the class 1 results:
   Rust crates exist for BLAKE3, BLAKE2, Grøstl, JH, CubeHash, Keccak, SHA-3, K12, LSH, Luffa, Xoodyak, and Romulus
   and are screened there;
   BLAKE-256 and BLAKE-512 (SHA-3 round-3 candidates) and BMW have no accelerated Rust crate.

### Source class 3: broader web

Linkup search,
 `depth` standard,
 no domain filter,
 no page cursor
 (`data/web/W11.txt`, `W12.txt`, `W15.txt`, `W16.txt`, `inline-results.md`):

- W11 (40 results):
   comparison sites,
   Areion512 recommended for short inputs on AES hardware (Cryptography Stack Exchange 84450),
   ARMv8 SHA-256 articles,
   t1ha and komihash (non-cryptographic, prior exits);
   new taxonomy term Areion (AES-based fixed-length hash).
- W12 (78 results):
   BLAKE3 and SHA-256 comparison pages,
   AVX-512 multi-buffer SHA-256 in Go (`minio/sha256-simd`),
   KangarooTwelve papers and `kangarootwelve_xkcp.rs` (C bindings);
   new taxonomy term multi-buffer SHA-256.
- W13 (17 results):
   `sha2` backends and cfg flags,
   `graviola` (no C compiler, SHA-256 with SHA extensions on both architectures, SHA-384 and SHA-512 AVX2 on x86_64),
   `aes` VAES backends;
   no new library beyond class 1.
- W14 (18 results):
   LeMac and PetitMac (AES-round MACs, C artifacts, FSE 2025),
   Go PMAC and CMAC packages;
   new taxonomy term AES-round universal hash (LeMac).
- W15 (70 results):
   `itzmeanjan/kangarootwelve`, XKCP K12, `kangarootwelve_xkcp`, `tiny-keccak` K12,
   general SIMD articles;
   no new library beyond class 1.
- W16 (38 results):
   SHA instruction set references,
   Go and GnuPG SHA-512 ARMv8.2 work,
   Botan hardware acceleration;
   no Rust library beyond class 1.
- W17 (18 results):
   RustCrypto `pmac` and `cmac`,
   Miscreant AES-PMAC,
   PMAC specification pages;
   no new library.
- W18 (17 results):
   `rscrypto` (pure Rust, BLAKE3, SHA-2, XXH3-128, no C),
   `blake2_simd` (x86 only),
   BLAKE3 C and Rust documentation;
   no new library beyond class 1.

### Source class 4: this repository

- RP07 `sha256|sha-256|sha512|sha3|keccak|kangarootwelve|blake2|blake3|cmac|pmac|polyval|ghash|graviola`
   (`rg --count-matches --ignore-case` excluding `node_modules` and lockfiles):
   TypeScript uses of Node's SHA-256 (file-enforcer, `watch-restart`, `aquati.cat`, `kv-store`, `markdown-lint` LFS object ids),
   pnpm SRI SHA-512 notes,
   the stack research documents,
   and `package/cli/forbidden-strings/src/runtime_cache/path.rs:73`,
   which hashes with `gix_hash::hasher(gix_hash::Kind::Sha256)`.
- RP08 lockfile packages
   (every `Cargo.lock` under `package/`):
   `sha2` 0.10.9 (`cli/forbidden-strings`, `fuzz/forbidden-strings`, `cli/nested-wayland-session`),
   `sha2` 0.11.0 (`rust-module/forbidden-regex.bench`),
   `sha1` 0.10.6 and 0.10.7 with `sha1-checked` 0.10.0 (through `gix-hash`),
   `aes` 0.8.4 and `sha1_smol` 1.0.1 (music player, through `turso_core`),
   `twox-hash` 2.1.2 (music player);
   no `ring`, `aws-lc-rs`, `openssl`, `boring`, `blake3`, `blake2`, `sha3`, or `hmac`.
  So `sha2` is already a repository dependency in Rust packages,
   and `twox-hash` a transitive one.

## Screening

Screening applies the category definition and the hard constraints that can be settled from source,
 licence metadata,
 and published documentation.
Gates that need a build or a measurement
 (HC4 build, HC5 diagnostics, HC8 collisions, HC10 chunking independence)
 are settled in "Hard-gate outcomes",
 so a crate can leave screening as a serious alternative and still exit at a gate later.

Every crate reviewed by hand carries its outcome in
 `~/temp/agent/hashvet2-2026-09-17/scripts/review.json`
 (118 entries).
The per-crate outcome for all 5,092 scanned crates is published beside this report as
 [`tech-meow-cache-key-hash-vet-2026-09-17-600031ed/screening-crates.md`](tech-meow-cache-key-hash-vet-2026-09-17-600031ed/screening-crates.md).

### What the changed premises reopen

The premise change makes cryptographic and AES-based constructions candidates rather than controls,
 so the whole cryptographic side of the field enters screening for the first time:
 BLAKE3,
 SHA-256,
 SHA-512,
 SHA-1,
 KangarooTwelve and the Keccak family,
 CubeHash,
 Xoodyak,
 AES-CMAC,
 and AES-PMAC,
 across `rscrypto`, `blake3`, `sha2`, `sha1`, `graviola`, `purecrypto`, `cryptoxide`,
 `bitcoin_hashes`, `scytale`, `k12`, `cubehash`, `xoodyak`, `cmac`, and `pmac`.
The prior vet had carried `sha2` SHA-256 and AES-CMAC only as controls
 ("Cryptographic functions carried as controls" in the prior report).

No previously-excluded non-cryptographic candidate reopens.
Each prior non-cryptographic exit was re-read against the new premises,
 and every one rests on a gate the premises did not touch:

- `gxhash` 3.5.0:
   HC9 is a user decision of 2026-09-17,
   unchanged by the weighting and build premises;
   its `Hasher` output also still depends on write chunking (HC10).
  It is the HC8 positive control.
- `rotohash-rs` 0.1.2,
   the one non-cryptographic function with dedicated-instruction paths on both architectures
   (AES-NI with AVX2 or VAES with AVX-512, NEON with the AES extension):
   HC10, one-shot API only,
   and HC3, no stability statement.
  Neither depends on which build blocks a release or on how speed is weighted.
- `hashcodecs` 1.4.1: HC10 for XXH3-128, HC1 for its scalar aarch64 MurmurHash3.
- `ahash`, `foldhash`, `drtahash`, `t1ha`, `axhash-core`, `mm3h`: HC2 or HC3, width and stability.
- The CRC and Adler crates: HC2, outputs of 64 bits or fewer.
- `museair`, `rapidhash`, `komihash`, `wyhash`, `seahash`, `siphasher`, and the other scalar 64-bit designs:
   HC1 and usually HC2.
  `museair` is carried as the scalar non-cryptographic speed control.
- `meowhash`: HC1 (aarch64 disabled since 0.2) and HC3.
- C-backed crates (`umash-sys`, `xxhash-c-sys`, `stringzilla`, `fasthash`): HC4, and they enter the C toolchain branch only.

The build premise does change one thing inside screening,
 and it helps cryptographic candidates rather than non-cryptographic ones:
 an accelerated path that the compiler selects from raised target features
 (AVX-512 under `-Ctarget-cpu=x86-64-v4`, `+aes`, or a `--cfg` backend)
 now satisfies HC1 on the release-blocking `x86-64-v4` build,
 because meow owns the startup check for a raised build.
That is what keeps `k12` in,
 whose x86 vector backend exists only under `--cfg keccak_backend="simd128|simd256|simd512"`.

### Serious alternatives

Eighteen crates leave screening;
 `aes` enters as the block-cipher backend for two of them rather than as a hash.
Because a candidate is a library and function pair,
 they carry 23 candidate functions into hard-gate confirmation,
 named here by their lab wrapper
 (`~/temp/agent/hashvet2-2026-09-17/lab/src/lib.rs`):

- XXH3-128:
   `xxhash_rust_xxh3_128` (`xxhash-rust` 0.8.18),
   `twox_xxh3_128` (`twox-hash` 2.1.4),
   `hashcrew_xxh3_128` (`hashcrew` 0.3.0),
   `rscrypto_xxh3_128` (`rscrypto` 0.9.0).
- HighwayHash-128:
   `highway_128` (`highway` 1.3.0).
- BLAKE3:
   `blake3_128` (`blake3` 1.8.7, with the C and assembly build note),
   `rscrypto_blake3_128` (`rscrypto`, keyed, `global_asm!` kernels).
- SHA-256:
   `sha2_sha256_128` (`sha2` 0.11.0),
   `rscrypto_sha256_128`,
   `graviola_sha256_128` (`graviola` 0.4.1),
   `purecrypto_sha256_128` (`purecrypto` 0.9.0),
   `cryptoxide_sha256_128` (`cryptoxide` 0.6.5),
   `bitcoin_hashes_sha256_128` (`bitcoin_hashes` 1.2.0),
   `scytale_sha256_128` (`scytale` 0.5.0).
- SHA-512:
   `sha2_sha512_128`,
   `rscrypto_sha512_128`,
   and `graviola_sha512_128`,
   which is measured although `graviola` has no aarch64 SHA-512 kernel (HC1 there).
- SHA-1:
   `sha1_128` (`sha1` 0.11.0).
- Keccak family:
   `k12_128` (`k12` 0.5.1 over `keccak` 0.2.2).
- Sponges and permutations:
   `cubehash512_128` (`cubehash` 0.4.1),
   `xoodyak_128` (`xoodyak` 0.8.4).
- AES-based MACs:
   `aes_cmac_128` (`cmac` 0.8.0 with `aes` 0.9.3),
   `aes_pmac_128` (`pmac` 0.8.0 with `aes`).
- Controls, not candidates:
   `museair_128` (`museair` 0.6.0, scalar non-cryptographic reference)
   and `gxhash_128` (`gxhash` 3.5.0, HC8 positive control, built only in the `v4-gxref` variant).

Screening notes that travel with a survivor into the gates:

- `blake3` 1.8.7:
   Rust SSE2, SSE4.1, and AVX2 kernels;
   AVX-512 and NEON exist only as C and assembly compiled by `build.rs`
   (`c/blake3_neon.c`, `c/blake3_avx512_x86-64_unix.S`).
  A rustc-only build therefore has no aarch64 vector path,
   which is an HC1 and HC4 question settled with measurements,
   and it is the reason the C toolchain branch exists.
- `k12` 0.5.1:
   the `keccak` backends are the aarch64 SHA-3 extension (run-time detected)
   and nightly `portable_simd` lanes under `--cfg keccak_backend`;
   without the cfg the x86 path is scalar.
- `graviola`, `purecrypto`, `cryptoxide`, and `scytale`:
   accelerated on both architectures for SHA-256 only;
   their other functions are single-architecture and exit at HC1.

### Exits

Grouped by reason,
 with the full per-crate list in the published screening appendix:

- HC1, no accelerated path on both architectures:
   `blake2`, `blake2b_simd`, `blake2s_simd`, `blake2-rfc`, `blake2_ce` (x86 only or portable),
   `tiny-keccak`, `kangarootwelve`, `turboshake`, `cshake`, `shake`, `sha3`, `sha3_ce`
   (the `keccak` default x86 backend is scalar),
   `libcrux-sha3` and `p3-keccak` (their SIMD modules hash several messages in parallel,
   while a single message takes the portable or `tiny-keccak` path),
   `lib-q-keccak`,
   `md-5` and `fast-md5` (whose "assembly cores" are scalar unrolled rounds, `src/aarch64.rs:16-20`),
   `shaman`,
   `groestl`, `groestl-aesni` (AES-NI on x86 only), `skein`, `sm3`, `streebog`, `whirlpool`, `ripemd`,
   `ascon-hash`,
   `areion` (x86-only AES-round hash, last release 2023),
   `blake3-std`.
- HC2, output narrower than 128 bits:
   `crc-fast`, `crc64fast`, `crc64fast-nvme`, `stringzilla`, `ahash`, `drtahash`, `axhash-core`,
   and the scalar 64-bit family.
- HC3, output stability not established:
   `sponge-hash-aes256` (a bespoke AES-256 sponge with no published specification or stability statement),
   `meowhash`,
   `ahash`,
   `foldhash`,
   `t1ha`.
- HC4, C or assembly compiled by a build script:
   `ring`, `ringpcx`, `aws-lc-rs`, `openssl`,
   `sha2-asm`, `sha1-asm`, `sha3-asm`, `md5-asm`, `sha2_ce`, `sha2raw`, `sha2ni`,
   `blake2b-rs`, `blake2_c`,
   `kangarootwelve_xkcp`, `marsupial-sys`,
   `hashtree-rs`, `lonesha256`, `skein-ffi`, `flatline-umac`,
   `fasthash-sys`, `fasthash-sys-fork`,
   the four `ckb-opt-*` crates.
  These are the C toolchain branch population;
   only `blake3` among them has a Rust fallback and a plausible rank,
   so the branch measures `blake3` and treats the rest as bounded by it.
- HC6, licence:
   `keccak-batch`, AGPL-3.0-or-later, which cannot be distributed inside an LGPL-3.0-or-later binary.
- HC7, provenance:
   `sha3-selkie` (published only as 0.0.0),
   and the repositories with no crates.io package
   (`tachyon-rs`, `openhitls-rs`, `byt3forg3/Tachyon`, `r_crypto`, the LeMac and PetitMac artifact).
- HC9:
   `gxhash`.
- HC10, no chunking-independent streaming state:
   `hashcodecs`, `xxh3`, `rotohash-rs`, `tape-sha256` (batch and hash-chain APIs only), `gxhash`.
- Category mismatch:
   universal hashes needing consumer-chosen key material and padding
   (`polyval`, `ghash`, `polyhash`, `halftime`),
   fixed-length AES-round compression (`haraka`),
   batch-only designs (`md5-many`),
   adapters and meta crates (`noncrypto-digests`, `hashkit`, `crypto-hashes`, `multihash-codetable`),
   keyed constructions over a candidate hash (`hmac`, evaluated through `sha2`),
   `sha1-checked` (collision detection more than doubles SHA-1's cost, evaluated through `sha1`),
   wrappers (`sha256`, `sha-1`),
   forks and duplicates (`iroh-blake3`, `fluence-blake3`, `fleek-blake3`, `tidecoin_hashes`),
   and `spg-crypto`, `gmcrypto-core`.
- Screened through another crate rather than on its own:
   `aes` (the block cipher behind `cmac` and `pmac`),
   `keccak` (the permutation behind `k12`).

## Identity, provenance, and license

Every crate was taken from its crates.io archive at the version in the lab lockfile,
 extracted under `data/crate-src/`
 (this vet's directory for crates the prior vet had not fetched, the prior vet's for the rest),
 and its repository metadata read through the GitHub API on 2026-09-17
 (`data/crate-meta.tsv`, `data/repo-meta.tsv`, `data/archive-sha256.tsv`, `data/source-audit.tsv`).
No candidate ships a prebuilt or downloaded artifact,
 so HC7 passes for every survivor;
 the crates that failed HC7 exited in "Screening".

Licence outcome (HC6):
 every survivor is distributable inside an `LGPL-3.0-or-later` binary.
The licences are BSL-1.0, MIT, Apache-2.0, MIT OR Apache-2.0, Apache-2.0 OR ISC OR MIT-0,
 BSD-2-Clause, CC0-1.0, and for `blake3`
 CC0-1.0 OR Apache-2.0 OR Apache-2.0 WITH LLVM-exception.
The one AGPL crate found in discovery, `keccak-batch`, exited at screening.

- `xxhash-rust` 0.8.18 (published 2026-07-21):
   licence BSL-1.0,
   MSRV none,
   edition 2018;
   archive sha256 `aee1b19627c7c60102ab80d3a9cbe18de90bfe03bfa6c3715447681f0e8c8af6`;
   repository https://github.com/DoumanAsh/xxhash-rust,
   last commit 2026-07-21,
   15 stable releases since 2021-03-08,
   3 in the last year,
   29,643,829 recent downloads,
   3 open issues,
   296 stars;
   2,335 lines of non-test Rust code,
   33 `unsafe` items,
   88 intrinsic calls,
   0 `asm!` or `global_asm!` macros,
   0 C or assembly files,
   0 inline test items and 4 test files.
- `twox-hash` 2.1.4 (published 2026-08-27):
   licence MIT,
   MSRV 1.81,
   edition 2021;
   archive sha256 `5283634e518fe9e82c7b20520bb4bc209009fd16c82077c802f8111ecbb0117a`;
   repository https://github.com/shepmaster/twox-hash,
   last commit 2026-09-17,
   22 stable releases since 2015-05-09,
   2 in the last year,
   53,419,956 recent downloads,
   25 open issues,
   436 stars;
   3,411 lines of non-test Rust code,
   70 `unsafe` items,
   39 intrinsic calls,
   2 `asm!` or `global_asm!` macros,
   0 C or assembly files,
   74 inline test items and 0 test files.
- `hashcrew` 0.3.0 (published 2026-09-15):
   licence Apache-2.0,
   MSRV 1.89,
   edition 2024;
   archive sha256 `f73782af6df9e45939f4e6206b646f3cbab68c2cc5c0c375dab045800cafb018`;
   repository https://github.com/fast/hashcrew,
   last commit 2026-09-15,
   5 stable releases since 2026-09-02,
   5 in the last year,
   202 recent downloads,
   0 open issues,
   4 stars;
   4,724 lines of non-test Rust code,
   77 `unsafe` items,
   208 intrinsic calls,
   1 `asm!` or `global_asm!` macros,
   0 C or assembly files,
   31 inline test items and 0 test files.
- `highway` 1.3.0 (published 2025-01-11):
   licence MIT,
   MSRV none,
   edition 2021;
   archive sha256 `9040319a6910b901d5d49cbada4a99db52836a1b63228a05f7e2b7f8feef89b1`;
   repository https://github.com/nickbabcock/highway-rs,
   last commit 2026-07-23,
   21 stable releases since 2018-09-19,
   0 in the last year,
   702,710 recent downloads,
   6 open issues,
   183 stars;
   2,955 lines of non-test Rust code,
   207 `unsafe` items,
   164 intrinsic calls,
   0 `asm!` or `global_asm!` macros,
   0 C or assembly files,
   21 inline test items and 1 test files.
- `rscrypto` 0.9.0 (published 2026-08-28):
   licence MIT OR Apache-2.0,
   MSRV 1.91.0,
   edition 2024;
   archive sha256 `edeae3565e70552f033348825873950436631dee240e1cf342d27965818e7b61`;
   repository https://github.com/loadingalias/rscrypto,
   last commit 2026-09-17,
   16 stable releases since 2026-05-02,
   16 in the last year,
   1,108 recent downloads,
   0 open issues,
   38 stars;
   177,154 lines of non-test Rust code,
   3619 `unsafe` items,
   5714 intrinsic calls,
   165 `asm!` or `global_asm!` macros,
   58 C or assembly files,
   1431 inline test items and 8 test files.
- `blake3` 1.8.7 (published 2026-08-20):
   licence CC0-1.0 OR Apache-2.0 OR Apache-2.0 WITH LLVM-exception,
   MSRV none,
   edition 2024;
   archive sha256 `6d9e454fc11f76977dc803893aff6304ed33d6a26efae8696573bea74baa27ae`;
   repository https://github.com/BLAKE3-team/BLAKE3,
   last commit 2026-09-10,
   46 stable releases since 2019-09-17,
   5 in the last year,
   43,986,415 recent downloads,
   201 open issues,
   6439 stars;
   6,522 lines of non-test Rust code,
   226 `unsafe` items,
   227 intrinsic calls,
   0 `asm!` or `global_asm!` macros,
   26 C or assembly files,
   84 inline test items and 1 test files.
- `sha2` 0.11.0 (published 2026-03-25):
   licence MIT OR Apache-2.0,
   MSRV 1.85,
   edition 2024;
   archive sha256 `446ba717509524cb3f22f17ecc096f10f4822d76ab5c0b9822c5f9c284e825f4`;
   repository https://github.com/RustCrypto/hashes,
   last commit 2026-09-01,
   24 stable releases since 2017-06-12,
   1 in the last year,
   254,185,957 recent downloads,
   36 open issues,
   2264 stars;
   2,622 lines of non-test Rust code,
   53 `unsafe` items,
   330 intrinsic calls,
   11 `asm!` or `global_asm!` macros,
   0 C or assembly files,
   0 inline test items and 2 test files.
- `sha1` 0.11.0 (published 2026-03-27):
   licence MIT OR Apache-2.0,
   MSRV 1.85,
   edition 2024;
   archive sha256 `aacc4cc499359472b4abe1bf11d0b12e688af9a805fa5e3016f9a386dc2d0214`;
   repository https://github.com/RustCrypto/hashes,
   last commit 2026-09-01,
   24 stable releases since 2014-11-21,
   2 in the last year,
   143,634,950 recent downloads,
   36 open issues,
   2264 stars;
   806 lines of non-test Rust code,
   7 `unsafe` items,
   121 intrinsic calls,
   1 `asm!` or `global_asm!` macros,
   0 C or assembly files,
   0 inline test items and 2 test files.
- `graviola` 0.4.1 (published 2026-06-24):
   licence Apache-2.0 OR ISC OR MIT-0,
   MSRV 1.89,
   edition 2024;
   archive sha256 `e8596c4fa98466aae2fcf4c72a665bc0e021c0aaab1e47d82044d3dc3e309a76`;
   repository https://github.com/ctz/graviola/,
   last commit 2026-08-24,
   8 stable releases since 2024-09-30,
   3 in the last year,
   158,716 recent downloads,
   23 open issues,
   305 stars;
   119,099 lines of non-test Rust code,
   323 `unsafe` items,
   1171 intrinsic calls,
   149 `asm!` or `global_asm!` macros,
   0 C or assembly files,
   230 inline test items and 3 test files.
- `purecrypto` 0.9.0 (published 2026-09-16):
   licence MIT,
   MSRV 1.89,
   edition 2024;
   archive sha256 `f59c301760fc52960fd32d5d697126f04bca123ed105b1b1db696708375c002f`;
   repository https://github.com/KarpelesLab/purecrypto,
   last commit 2026-09-17,
   55 stable releases since 2026-05-25,
   55 in the last year,
   12,505 recent downloads,
   0 open issues,
   3 stars;
   201,541 lines of non-test Rust code,
   1160 `unsafe` items,
   1156 intrinsic calls,
   16 `asm!` or `global_asm!` macros,
   9 C or assembly files,
   3204 inline test items and 12 test files.
- `cryptoxide` 0.6.5 (published 2026-09-03):
   licence MIT/Apache-2.0,
   MSRV 1.79.0,
   edition 2021;
   archive sha256 `b8bb2a43afb0fd8b53101f79f153795c449ba80762361d8b868f4a75c6d03057`;
   repository https://github.com/typed-io/cryptoxide/,
   last commit 2026-09-17,
   28 stable releases since 2018-09-18,
   8 in the last year,
   341,826 recent downloads,
   4 open issues,
   75 stars;
   25,876 lines of non-test Rust code,
   115 `unsafe` items,
   1009 intrinsic calls,
   0 `asm!` or `global_asm!` macros,
   0 C or assembly files,
   217 inline test items and 2 test files.
- `bitcoin_hashes` 1.2.0 (published 2026-08-05):
   licence CC0-1.0,
   MSRV 1.74.0,
   edition 2021;
   archive sha256 `5304e53726dbe5f93141535e102ed97b5bf4714fbecefdda8f9fb98d7fdaff0e`;
   repository https://github.com/rust-bitcoin/rust-bitcoin,
   last commit 2026-09-17,
   39 stable releases since 2018-12-08,
   11 in the last year,
   13,887,306 recent downloads,
   465 open issues,
   2679 stars;
   7,888 lines of non-test Rust code,
   73 `unsafe` items,
   1343 intrinsic calls,
   0 `asm!` or `global_asm!` macros,
   0 C or assembly files,
   68 inline test items and 0 test files.
- `scytale` 0.5.0 (published 2026-09-13):
   licence BSD-2-Clause,
   MSRV 1.88,
   edition 2024;
   archive sha256 `321dea1bcd9851787682dde346555bf8b832785203e3fce330d3acf51f91637e`;
   repository https://github.com/MichaelPaddon/scytale,
   last commit 2026-09-17,
   5 stable releases since 2024-05-09,
   3 in the last year,
   43 recent downloads,
   0 open issues,
   1 stars;
   46,383 lines of non-test Rust code,
   311 `unsafe` items,
   64 intrinsic calls,
   79 `asm!` or `global_asm!` macros,
   0 C or assembly files,
   703 inline test items and 0 test files.
- `cubehash` 0.4.1 (published 2026-03-08):
   licence MIT,
   MSRV none,
   edition 2021;
   archive sha256 `6afd537bb44529b01063dc0e5ef6216ac72551c94d4f1a86725c839b1d83a784`;
   repository https://github.com/mcrepeau/cubehash,
   last commit 2026-04-08,
   6 stable releases since 2025-08-13,
   1 in the last year,
   105 recent downloads,
   0 open issues,
   0 stars;
   704 lines of non-test Rust code,
   35 `unsafe` items,
   141 intrinsic calls,
   0 `asm!` or `global_asm!` macros,
   0 C or assembly files,
   0 inline test items and 0 test files.
- `xoodyak` 0.8.4 (published 2023-07-17):
   licence MIT,
   MSRV none,
   edition 2018;
   archive sha256 `0dad761b2058d5398041155f51876fd2eb94a20db85ee1ab56c6b8f78d18f16b`;
   repository https://github.com/jedisct1/rust-xoodyak,
   last commit 2026-04-22,
   26 stable releases since 2020-04-05,
   0 in the last year,
   26,210 recent downloads,
   2 open issues,
   30 stars;
   1,136 lines of non-test Rust code,
   2 `unsafe` items,
   71 intrinsic calls,
   0 `asm!` or `global_asm!` macros,
   0 C or assembly files,
   8 inline test items and 1 test files.
- `cmac` 0.8.0 (published 2026-04-10):
   licence MIT OR Apache-2.0,
   MSRV 1.85,
   edition 2024;
   archive sha256 `ac78aa94ce13e432b332a4d1bf2eff167d3a2520188ee05b337180a42fd2e62e`;
   repository https://github.com/RustCrypto/MACs,
   last commit 2026-06-23,
   13 stable releases since 2017-07-22,
   1 in the last year,
   4,929,188 recent downloads,
   5 open issues,
   372 stars;
   152 lines of non-test Rust code,
   0 `unsafe` items,
   0 intrinsic calls,
   0 `asm!` or `global_asm!` macros,
   0 C or assembly files,
   0 inline test items and 2 test files.
- `pmac` 0.8.0 (published 2026-04-10):
   licence MIT OR Apache-2.0,
   MSRV 1.85,
   edition 2024;
   archive sha256 `24ceb90ade0c891295d683cc9c70a798ebdba27b574e7f80b703d40d8b2e9123`;
   repository https://github.com/RustCrypto/MACs,
   last commit 2026-06-23,
   11 stable releases since 2017-07-22,
   1 in the last year,
   5,844 recent downloads,
   5 open issues,
   372 stars;
   216 lines of non-test Rust code,
   0 `unsafe` items,
   0 intrinsic calls,
   0 `asm!` or `global_asm!` macros,
   0 C or assembly files,
   0 inline test items and 2 test files.
- `k12` 0.5.1 (published 2026-05-15):
   licence Apache-2.0 OR MIT,
   MSRV 1.85,
   edition 2024;
   archive sha256 `38a8cc72399dffa4a445bc5f5a84d4af4d441c76604231bc52e9c529c1d47693`;
   repository https://github.com/RustCrypto/XOFs,
   last commit 2026-08-21,
   9 stable releases since 2017-06-04,
   3 in the last year,
   334,289 recent downloads,
   2 open issues,
   3 stars;
   731 lines of non-test Rust code,
   0 `unsafe` items,
   0 intrinsic calls,
   0 `asm!` or `global_asm!` macros,
   0 C or assembly files,
   7 inline test items and 2 test files.
- `aes` 0.9.3 (published 2026-08-28):
   licence MIT OR Apache-2.0,
   MSRV 1.89,
   edition 2024;
   archive sha256 `35f0f96ce78e38c3dc6d8948aa8163d06385be74000f3c7a95bf1eef35d3ea32`;
   repository https://github.com/RustCrypto/block-ciphers,
   last commit 2026-09-14,
   17 stable releases since 2020-06-05,
   3 in the last year,
   78,769,109 recent downloads,
   15 open issues,
   783 stars;
   3,015 lines of non-test Rust code,
   60 `unsafe` items,
   133 intrinsic calls,
   0 `asm!` or `global_asm!` macros,
   0 C or assembly files,
   0 inline test items and 3 test files.
- `keccak` 0.2.2 (published 2026-08-21):
   licence Apache-2.0 OR MIT,
   MSRV 1.85,
   edition 2024;
   archive sha256 `d8f198d1db720e4940b5a493201d199d9f24f568f8f746bd13706243a2f71598`;
   repository https://github.com/RustCrypto/sponges,
   last commit 2026-08-21,
   9 stable releases since 2018-03-27,
   4 in the last year,
   37,905,699 recent downloads,
   1 open issues,
   56 stars;
   489 lines of non-test Rust code,
   10 `unsafe` items,
   45 intrinsic calls,
   0 `asm!` or `global_asm!` macros,
   0 C or assembly files,
   0 inline test items and 3 test files.

Two notes on the counts:

- `rscrypto`'s 58 assembly files are ECC bignum routines under `src/auth/asm/`,
   included with `global_asm!(include_str!(...))` and assembled by rustc.
  Its BLAKE3 assembly lives under `src/hashes/crypto/blake3/{x86_64,aarch64}/asm/`
   and is assembled the same way,
   which is why the aarch64 builds succeed without a C toolchain ("HC4 build").
- `blake3`'s 26 C and assembly files are its AVX-512 and NEON kernels,
   compiled by `cc` from `build.rs`,
   which is the C toolchain question.

## Hard-gate outcomes

Each gate is settled for every serious alternative before any scoring.
Source citations are file paths inside the crate archive under `data/crate-src/`;
 build and run evidence is in `data/hc4-builds.txt`,
 `data/build-variants.txt`,
 `data/correctness.txt`,
 and the container logs under `data/logs/`.

### HC1 hardware acceleration

Kernel inventory,
 from a scan for architecture intrinsics and for dedicated-instruction mnemonics inside `asm!` blocks
 (`scripts/hc1-paths.ts`, `data/hc1-paths.tsv`):

- XXH3-128,
   SIMD kernels on both architectures:
   `xxhash-rust` (`src/xxh3.rs`: SSE2, AVX2, AVX-512, NEON),
   `twox-hash` (`src/xxhash3/large/{sse2,avx2,neon}.rs`),
   `hashcrew` (`src/xxhash/kernel/{x86,neon}.rs`),
   `rscrypto` (`src/hashes/fast/xxh3/{x86_64_avx2,x86_64_avx512,aarch64_neon}.rs`).
  Pass.
- HighwayHash-128:
   `highway` (`src/x86/avx.rs`, `src/x86/v4x64u.rs`, `src/aarch64.rs`).
  Pass.
- BLAKE3:
   `rscrypto` has Rust AVX2, AVX-512, and SSE4.1 kernels plus NEON intrinsics in
   `src/hashes/crypto/blake3/{x86_64/{avx2,avx512,sse41}.rs,aarch64.rs}`,
   with assembly variants in the same tree assembled by rustc.
  Pass.
  `blake3` 1.8.7 has Rust SSE2, SSE4.1, and AVX2 only;
   its AVX-512 and NEON kernels are `c/blake3_avx512_x86-64_unix.S` and `c/blake3_neon.c`,
   compiled by `cc` in `build.rs`.
  With the `pure` feature, or on any target without a C compiler,
   aarch64 gets no vector path.
  Fail on aarch64 under HC4's rustc-only rule;
   carried in the C toolchain branch.
- SHA-256,
   SHA extensions on x86_64 and the Armv8 SHA-2 extension on aarch64:
   `sha2` (`src/sha256/x86_sha.rs`, `src/sha256/aarch64_sha2.rs`),
   `rscrypto` (`src/hashes/crypto/sha256/{x86_64,aarch64}.rs`),
   `graviola` (`src/low/x86_64/sha256.rs`, `src/low/aarch64/sha256.rs`),
   `purecrypto` (`src/hash/sha_hw.rs`),
   `bitcoin_hashes` (`src/sha256/crypto/{x86_shani,avx2,sse41,arm_sha2}.rs`),
   `scytale` (`src/hash/sha2/{x86_64,aarch64}.rs`, dedicated instructions inside `asm!`),
   `cryptoxide` (`src/hashing/sha2/impl256/{avx,sse41,aarch64}.rs`),
   whose x86_64 kernels are AVX and SSE4.1 message-schedule code and whose SHA-NI arm is commented out
   (`src/hashing/sha2/impl256/mod.rs:26`),
   and whose paths are chosen at compile time from `target_feature`,
   so its aarch64 kernel needs a build raised with `+sha2`.
  Pass on both architectures as SIMD, with that build condition.
- SHA-512:
   `sha2` (`src/sha512/x86_avx2.rs` AVX2, `src/sha512/aarch64_sha3.rs` using the Armv8.2 SHA-512 instructions)
   and `rscrypto` (`src/hashes/crypto/sha512/{x86_64_avx2,x86_64_avx512vl,aarch64}.rs`).
  Pass.
  `graviola` has `src/low/x86_64/sha512.rs` and no aarch64 counterpart:
   fail.
  `scytale` states in `src/hash/sha2/x86_64.rs` that SHA-384 and SHA-512 stay portable on x86_64:
   fail.
  `purecrypto`'s SHA-512 hardware path is aarch64 only:
   fail.
- SHA-1:
   `sha1` (`src/compress/x86_sha.rs`, `src/compress/aarch64_sha2.rs`).
  Pass.
- AES-CMAC and AES-PMAC through `aes` 0.9.3:
   AES-NI and VAES on x86_64 (`src/backends/{x86_aes,x86_vaes256,x86_vaes512}/encdec.rs`),
   the Armv8 AES extension on aarch64 (`src/backends/aarch64_aes/encdec.rs`).
  Pass.
- KangarooTwelve through `keccak` 0.2.2:
   the Armv8.2 SHA-3 extension on aarch64 (`src/backends/aarch64_sha3.rs`, run-time detected)
   and, on x86_64, `portable_simd` lanes selected by `--cfg keccak_backend="simd128|simd256|simd512"`.
  Pass on the release-blocking build,
   which sets that cfg;
   without it the x86 path is scalar.
- CubeHash:
   `cubehash` (`src/avx2.rs`, `src/sse2.rs`, `src/neon.rs`).
  Pass.
- Xoodyak:
   `xoodyak` (`src/xoodoo/impl_x86_64.rs`, `src/xoodoo/impl_aarch64.rs`).
  Pass.

### HC2 width

Native 128-bit output:
 XXH3-128,
 HighwayHash-128,
 AES-CMAC,
 AES-PMAC.
Truncation of a longer digest to its first 128 bits,
 which HC2 allows:
 BLAKE3 (256-bit digest and XOF),
 SHA-256,
 SHA-512,
 SHA-1 (160 bits),
 KangarooTwelve (XOF),
 CubeHash-512,
 Xoodyak (XOF squeeze).
All pass.

### HC3 stability

Every candidate function is a published specification or has a documented freeze:

- XXH3-128:
   frozen in xxHash 0.8.0 and specified in the xxHash specification;
   the four implementations agree with each other and with the reference vectors
   ("Reference equality").
- HighwayHash-128:
   the HighwayHash specification and the reference implementation's vectors.
- BLAKE3:
   the BLAKE3 specification and reference vectors.
- SHA-1, SHA-256, SHA-512:
   FIPS 180-4.
- AES-CMAC:
   NIST SP 800-38B.
- AES-PMAC:
   the PMAC specification with its published vectors.
- KangarooTwelve:
   the KangarooTwelve specification and its XKCP vectors.
- CubeHash:
   the CubeHash specification (rev3 parameters `16/32/512`, as the crate names them).
- Xoodyak:
   the Xoodyak specification from the NIST lightweight cryptography process.

`rscrypto` states the rule its accelerated kernels follow explicitly:
 "Portable Rust implementations are the reference path; SIMD and ASM are accelerators tested against that path"
 (`README.md`).
All pass.

### HC4 build

Builds of the lab crate with the repository's nightly (`nightly-2026-09-12`),
 rustc alone,
 no C toolchain in the container
 (`data/hc4-builds.txt`):

- `x86_64-unknown-linux-gnu`, default features: status 0.
- `x86_64-unknown-linux-musl`, default and `-Ctarget-cpu=x86-64-v4`: status 0.
- `aarch64-unknown-linux-gnu`, default features: status 101.
  The failure is `blake3`'s build script:
   "Compiler family detection failed due to error: ToolNotFound: failed to find tool `aarch64-linux-gnu-gcc`"
   (`data/logs/hc4-aarch64-gnu-default.log`).
- `aarch64-unknown-linux-musl` with `rust-lld`, default features: status 101,
   the same `blake3` build-script failure with `aarch64-linux-musl-gcc`.
- `aarch64-unknown-linux-musl` with `rust-lld`, feature `pure` (BLAKE3 without its C kernels): status 0.
- `aarch64-unknown-linux-gnu`, feature `pure`: the compile succeeds and the link fails in the lab harness only,
   because the host `rust-lld` rejects `--fix-cortex-a53-843419` for a non-AArch64 host build;
   rebuilt with `--lib`, status 0 (`data/logs/hc4-aarch64-gnu-pure-lib.log`).
  This is a harness artifact, not a candidate defect,
   and matches the prior vet's compile-only aarch64 evidence.

So every candidate except `blake3` builds for all four targets with rustc alone.
`blake3` fails HC4 as published and passes only with its `pure` feature,
 which costs it HC1 on aarch64.
`rscrypto` passes although its BLAKE3 has assembly,
 because the assembly is inside `global_asm!` and rustc assembles it.

### HC5 CPU capabilities

Run-time detection with a fallback:
 `twox-hash`,
 `hashcrew`,
 `sha2`,
 `sha1`,
 `aes`,
 `bitcoin_hashes`,
 `scytale`,
 `keccak` (aarch64),
 `graviola` (which additionally asserts its required features at construction),
 `rscrypto` (`src/platform/detect`).
Compile-time selection:
 `xxhash-rust`,
 `cryptoxide`,
 `cubehash`,
 `xoodyak`,
 and `keccak`'s x86 lanes.
Under premise 3 both are acceptable:
 meow performs its own startup check on every raised build,
 and the baseline features these crates select at the default target
 (SSE2 on x86_64, NEON on aarch64) are part of both targets' baselines.
All pass.

### HC6, HC7, HC9

Pass for every serious alternative ("Identity, provenance, and license").
No candidate is `gxhash` or derived from it;
 `gxhash` is built only as the collision-harness positive control.

### HC8 one-byte collision gate

Harness:
 `lab/src/bin/onebyte.rs`,
 every single-byte variant of a 4,096-byte base
 (1,044,480 keys per function and seed),
 counted for full 128-bit,
 low 64-bit,
 and high 64-bit equality,
 over a zero base and a random base,
 with seeds 0, 1, and 987654321.

First pass on the `x86-64-v4` build
 (`data/logs/onebyte-zero-v4.log`, `data/logs/onebyte-random-v4.log`):
 57 results per base,
 covering the XXH3-128, HighwayHash, BLAKE3, SHA-256, SHA-512, SHA-1, AES-CMAC, and AES-PMAC candidates
 and the `museair` control,
 with zero collisions at every width.
The `bitcoin_hashes`, `scytale`, `cubehash`, `xoodyak`, and `k12` wrappers were added to the lab after that pass,
 so the gate was re-run for the full table,
 together with the `gxhash` positive control from the `v4-gxref` build
 (`data/correctness.txt`, "Re-run of the correctness gates").

### HC10 streaming

Harness:
 `lab/src/bin/streamcheck.rs`,
 which compares the streaming result with the one-shot result
 for 607 input lengths from 0 to 5,000,011 bytes
 under 14 chunk plans each
 (1, 7, 16, 32, 63, 64, 65, 240, 241, 256, 1024, 4096, 65,536, and random chunk sizes).

First pass on the `x86-64-v4` build:
 19 streaming functions,
 8,548 chunkings compared each,
 0 failures
 (`data/logs/streamcheck-v4.log`).
Positive control,
 the same run with `STREAMCHECK_CONTROL=drop-last`,
 which withholds the last input byte:
 162,146 mismatches
 (`data/logs/streamcheck-control-v4.log`),
 so the harness detects a wrong streaming result.
As with HC8,
 the five wrappers added later are covered by the re-run.

### Re-run of the correctness gates

Both gates were re-run on the current `x86-64-v4` build,
 with the whole candidate table
 (`scripts/correctness.ts`, `data/correctness.txt`):

- HC8,
   4,096-byte bases,
   zero and random,
   seeds 0, 1, and 987654321:
   72 results per base
   (24 functions by three seeds),
   every one with 0 full-width, 0 low-half, and 0 high-half collisions
   (`data/logs/onebyte-v4-zero.log`, `data/logs/onebyte-v4-random.log`).
- HC8 positive control,
   `gxhash` from the `v4-gxref` build:
   2 full-width collisions on the zero base and 1 on the random base under every seed
   (`data/logs/onebyte-v4gxref-zero.log`, `data/logs/onebyte-v4gxref-random.log`),
   which reproduces the finding that removed `gxhash`
   and shows the harness detects collisions when they exist.
- HC10,
   24 streaming functions,
   8,548 chunkings each:
   5,155 failures,
   all of them `xoodyak_128`.
  The run was repeated with a per-function counter to settle the attribution:
   23 of the 24 functions report "0 failed" over 8,548 chunkings each,
   and `xoodyak_128` reports 5,155
   (`data/logs/streamcheck-v4-perfn.log`).
  The positive control run,
   which withholds the last input byte,
   reported 204,816 failures,
   so the harness detects a wrong streaming result.

`xoodyak` is the one HC10 failure,
 and the reason is in its API rather than in the permutation:
 `XoodyakCommon::absorb` absorbs one complete message with domain separation
 (`src/xoodyak/mod.rs:119-123`),
 so calling it once per chunk is not the same operation as one absorb of the whole input,
 while `absorb_more` continues an absorb only at multiples of the absorb rate
 (`src/xoodyak/mod.rs:125-131`).
A consumer could add its own rate-aligned buffer and obtain chunking independence,
 so this is a limit of the crate's incremental API as published,
 not of Xoodyak.
Either way `xoodyak` is rated 0 on S2 and cannot affect the ranking,
 so the gate is recorded as failed for the published API and the candidate is not carried further.

## Execution manifest

Shared by every execution in this vet:

- Host:
   AMD Ryzen 7 8700F,
   8 physical cores and 16 logical,
   62 GiB memory,
   Linux 7.2.0-ogc6.1.fc44.x86_64,
   `podman` 5.8.4.
- Container:
   `docker.io/library/rust:slim`,
   digest `sha256:a2de23e559fd8afd260d22beb00f3987073ea0dcc2ba2646cccdaeda6a62a095`,
   run with `--rm --init --memory=2g --cpus=2 --pids-limit=512 --ulimit nofile=4096 --network=none`
   and `--security-opt label=disable`,
   no credentials mounted,
   no repository mounted.
  The scratch tree is mounted at `/w`;
   the toolchain and the Cargo registry are mounted read-only;
   `CARGO_HOME` points inside the scratch tree
   (`scripts/run-box.ts`).
  Every run appends a record with its command, image digest, bounds, exit status, and log path to
   `data/logs/executions.jsonl`.
- The one exception to the standing bounds is the multi-core scaling test,
   which raises `--cpus` to at most 8
   (half of the host's 16 logical cores)
   with `--memory=8g`;
   each of those records states the raised bounds
   ("S4 multi-core on one large input").
- Toolchains:
   `nightly-2026-09-12` (`rustc 1.100.0-nightly`) for the lab, every lab binary, and the aarch64 builds;
   `nightly-2026-09-16` for Miri;
   `1.98.1` for upstream suites that pin a stable toolchain.
- Lab crate:
   `lab/`,
   `opt-level = 3`,
   fat LTO,
   one codegen unit,
   `panic = "abort"`,
   lockfile generated on 2026-09-17 with `cargo +nightly-2026-09-12 generate-lockfile`
   and fetched on the host,
   because only the host's Cargo may reach `index.crates.io`;
   containers run `--offline --locked`.
- Builds measured
   (`scripts/build-variants.ts`, `data/build-variants.txt`, all status 0):
  - `base`: default target features, `--cfg keccak_backend="simd128"`.
  - `v2`: `-Ctarget-cpu=x86-64-v2`, same Keccak backend.
  - `v3`: `-Ctarget-cpu=x86-64-v3`, `--cfg keccak_backend="simd256"`.
  - `v4`: `-Ctarget-cpu=x86-64-v4`, `--cfg keccak_backend="simd512"`, the release-blocking build.
  - `v4-pure` and `base-pure`: the same with `blake3/pure`, for the C toolchain branch.
  - `v4-par`: the same as `v4` with `rscrypto/parallel`, for the scaling test.
  - `v4-gxref`: the same as `v4` with `-Ctarget-feature=+aes` and `gxhash`, for the HC8 positive control only.
- The release-blocking build enables no SHA or AES instruction feature ("Context", target features).
  Crates that dispatch at run time (`sha2`, `sha1`, `aes`, `bitcoin_hashes`, `scytale`, `graviola`, `rscrypto`)
   still reach those instructions;
   crates that select at compile time (`cryptoxide`) do not,
   which their numbers show.
- Measurement discipline:
   the run-to-run band is measured first on the unchanged `x86-64-v4` build,
   five runs per cell,
   each run its own container,
   load average recorded before and after every run.
  Another agent's build work ran on this host during part of the campaign;
   the affected runs are visible in `data/bench/progress-a.txt`,
   and the per-cell medians over five runs are what the ratings use.

## Hard-gate confirmed

Twenty of the 23 candidate functions pass every gate:

- Confirmed:
   `xxhash-rust` XXH3-128,
   `twox-hash` XXH3-128,
   `hashcrew` XXH3-128,
   `rscrypto` XXH3-128,
   `highway` HighwayHash-128,
   `rscrypto` BLAKE3,
   `sha2` SHA-256 and SHA-512,
   `rscrypto` SHA-256 and SHA-512,
   `sha1` SHA-1,
   `graviola` SHA-256,
   `purecrypto` SHA-256,
   `cryptoxide` SHA-256,
   `bitcoin_hashes` SHA-256,
   `scytale` SHA-256,
   `cmac` with `aes` AES-CMAC,
   `pmac` with `aes` AES-PMAC,
   `k12` KangarooTwelve,
   `cubehash` CubeHash.
- Exited at a gate:
   `blake3` BLAKE3,
   which fails HC4 as published (no aarch64 build without a C cross compiler)
   and fails HC1 on aarch64 with its `pure` feature;
   and `graviola` SHA-512,
   which has no aarch64 kernel (HC1);
   and `xoodyak` Xoodyak,
   whose published incremental API is not chunking independent (HC10, "Re-run of the correctness gates").
  `scytale` SHA-512 and `purecrypto` SHA-512 had already exited at screening for the same reason,
   so they are not candidates here.
  `graviola` SHA-512 is still measured,
   because it bounds what an x86_64-only SHA-512 could contribute,
   and `blake3` is measured in both builds for the C toolchain branch.

### Which confirmed candidates receive equal-depth validation

The deciding criteria are the three weight-5 ones,
 and S2 is already measured for every confirmed candidate on the release-blocking build
 ("S2 whole files").
Applying the frozen rating rule to the three S2 cells:

- 4: `xxhash-rust` 0.997, `twox-hash` 0.979, `hashcrew` 0.963, `rscrypto` 0.944 (XXH3-128).
- 1: `highway` 0.281.
- 0: every other confirmed candidate,
   from `aes_pmac` 0.113 and `rscrypto` BLAKE3 0.097 down to `xoodyak` 0.006.

A candidate rated 0 on S2 scores at most
 0 + 5·(its S3 rating) + 5·(its S5 rating) + 8·4 points.
Its measured S5 evidence caps it further:
 on the one aarch64 core with published numbers,
 SHA-256 through the SHA extensions runs at 1.69 GiB/s and single-threaded BLAKE3 at 1.61,
 against 24.5 for XXH3-128,
 so every cryptographic candidate rates 0 on S5 as well
 ("S5: aarch64 evidence").
That leaves at most 5·(S3 rating) + 32,
 and S3 is bounded by the cold and warm measurements
 ("S3 multi-GB from disk"):
 no candidate rated 0 on S2 can pass 42 of 92 points.
The four XXH3-128 candidates already hold 20 points from S2 alone
 and score at least 45 from the weight-5 criteria,
 so the ranking of the top places cannot include a candidate rated 0 on S2.

Equal-depth validation therefore runs for the five candidates that can reach the top:
 the four XXH3-128 implementations and `highway`.
Every other confirmed candidate is rated from the evidence collected for all candidates alike
 (the same benchmark runs, the same gates, the same source and maintenance audits)
 and carries the bound shown here;
 no rating for them is left unstated,
 and none of them can change the recommendation.
Four of the five validated candidates were validated to this depth in the prior vet earlier the same day,
 on the same host,
 toolchains,
 and crate versions ("Reuse of prior evidence");
 `rscrypto` is new and receives the same treatment here.

## Upstream suites

### Reused for the four prior finalists

The prior vet ran the CI-equivalent suites for `xxhash-rust` 0.8.18, `twox-hash` 2.1.4, `hashcrew` 0.3.0,
 and `highway` 1.3.0 earlier the same day,
 on this host,
 with the same clones,
 crate versions,
 and toolchains
 (its section "Upstream CI inventory and suites run").
Every suite exited 0 with no failed test.
The evidence that matters for the ratings here:

- `xxhash-rust`:
   five suites (debug, release under Valgrind, `+avx2`, `-sse2`, aarch64 under QEMU),
   12 tests each,
   0 Valgrind errors.
  Its XXH3 test compares one-shot and streaming `xxh3_128` against the C library
   for random inputs of every length 0 to 4,095.
- `twox-hash`:
   all-features tests,
   a comparison package with property tests against the C implementation,
   Miri with the scalar kernel forced,
   and two aarch64 QEMU suites;
   one ignored test outside XXH3.
- `hashcrew`:
   workspace tests,
   a no-default-features build,
   a release integration suite,
   Miri with strict provenance,
   and the integration suite on aarch64 under QEMU (43 tests).
- `highway`:
   tests in debug, release, and `no_std`,
   four instruction-set variants,
   Miri,
   a no-panic example,
   aarch64 under QEMU,
   and a fuzz target that compares the 64-bit output with the C implementation.

### New: `rscrypto` 0.9.0

Inventory from the clone at tag `v0.9.0`
 (commit `1ce6a015cb4df8e84b72b997fb2fa50c04af1609`,
 `~/temp/agent/rscrypto-2026-09-17`, push remote disabled):
 six workflows,
 `ci.yml` (cross-build for riscv64, powerpc64le, and s390x, then native jobs per platform),
 `bench.yml`,
 `ct.yml` (constant-time validation),
 `fuzz.yml`,
 `profile.yml`,
 and `release.yml`.
The `ci.yml` native job runs `just ci-check`, `just test --all --release`,
 `just test --all --release --portable`,
 `just test-musl` on x86_64 and aarch64,
 and constant-time, policy, and script suites.
Its runners are AWS instances declared in `.github/runs-on.yml`.

Equivalents run here,
 offline,
 in `localhost/hashvet-rusttest:2`
 with the clone at `/src`
 and `CARGO_TARGET_DIR` inside the scratch tree
 (`scripts/suites.ts`, results in `data/suites.txt`):
 release library tests,
 the same with `portable-only`,
 the integration tests,
 a build with `-Ctarget-cpu=x86-64-v4`,
 a build with `-sha,-aes,-avx2` to exercise the fallback kernels,
 the library tests on `aarch64-unknown-linux-gnu` under QEMU,
 the library tests on `x86_64-unknown-linux-musl`,
 and Miri over the hash modules.

### Suite results

First attempt,
 recorded because it shows a real property of the crate:
 the five stable-toolchain suites exited 1 without running a test,
 because the image's `cargo` is a rustup shim and `rust-toolchain.toml` in the clone pins 1.98.0,
 which rustup then tried to download inside a network-less container
 (`data/logs/rs1-test-release.log`).
The suites were re-run with the mounted toolchain's real `cargo` first on `PATH`,
 which ignores that file,
 and with explicit features,
 because `rscrypto` compiles each algorithm behind a feature and a default-feature test run compiles almost none of them
 (the first aarch64 run passed 89 tests; the Miri run filtered out all 71 it saw).

Suites that ran to completion in the first pass:

- `rs6` `cargo test --release --lib --target aarch64-unknown-linux-gnu` under QEMU,
   default features:
   89 passed, 0 failed.
- `rs8` `cargo miri test --lib hashes::` on `nightly-2026-09-16` with `-Zmiri-strict-provenance`:
   exited 0 with 0 tests matching the filter under default features.
- `rs9` build of the `fast-xxh3` fuzz target with AddressSanitizer and libFuzzer coverage:
   exited 0.
- `rs10` that target run for 600 seconds:
   46,844,896 executions,
   78,398 executions per second,
   coverage 1,437 features,
   139 new corpus units,
   peak RSS 452 MB,
   no crash and no artifact written
   (`data/logs/rs10-fuzz-run.log`).
  Every one of those executions asserted `rscrypto`'s XXH3-64 and XXH3-128 one-shot results,
   and its streaming results under arbitrary partitions,
   against `xxhash-rust` as the oracle.
- `rs7` `cargo test --target x86_64-unknown-linux-musl` exited 101:
   its dev-dependency `aws-lc-sys` needs a C cross compiler for musl,
   which this container does not have.
  Recorded as an omitted job with that reason;
   the musl build of the candidate itself is covered by HC4.

## Reference equality

`lab/src/bin/refcheck.rs`,
 run on the `x86-64-v4` build
 (`data/logs/refcheck-v4.log`):
 4,261 checks,
 0 failures.

What it checks:

- Published digests,
   truncated to the 128-bit key width:
   SHA-256, SHA-1, and SHA-512 of `"abc"` from FIPS 180-4,
   the BLAKE3 hash of the empty input,
   and XXH3-128 of the empty input in its canonical form
   (`99aa06d3014798d86001c324468d497f`).
- Cross-implementation equality over 266 input lengths from 0 to 1,048,577 bytes:
   the four XXH3-128 crates against each other,
   the seven SHA-256 crates,
   the three SHA-512 crates,
   and the two BLAKE3 crates.

Positive control:
 the same binary with `REFCHECK_CONTROL=flip`,
 which flips one input byte before hashing while comparing against the unflipped reference,
 reported 4,261 failures of 4,261 checks
 (`data/logs/refcheck-v4-control.log`),
 so the harness detects a wrong digest.

This is the local half of HC3:
 four independent XXH3-128 implementations agree with each other and with the published digest,
 and the same holds inside the SHA-256, SHA-512, and BLAKE3 families,
 on the release-blocking build's kernels.
The cross-architecture half comes from the aarch64 suites under QEMU
 ("Upstream suites")
 and from the prior vet's aarch64 and musl probes for the four reused finalists.

## Additional validation

### Fuzzing and property tests

Reused from the prior vet for the four crates it validated:
 `xxhash-rust` has no fuzz target and no property tests,
 only a random-input comparison with the C library in `tests/assert_correctness.rs`;
 `twox-hash` has `proptest` comparisons with C in `comparison/`;
 `hashcrew` has seeded random partitions in `tests-integration`;
 `highway` has a `quickcheck` property suite and a libFuzzer target that compares
 its portable, SSE4.1, and AVX2 hashers with the C implementation,
 which the prior vet built and ran for 600 seconds with AddressSanitizer,
 against a control build with an injected defect.
No finalist has mutation testing.

`rscrypto` is the one finalist with a fuzz target for XXH3 itself.
`fuzz-packages/fast-xxh3/fuzz_targets/fast_xxh3.rs` runs
 `fuzz/target_impls/fast_xxh3.rs`,
 which for arbitrary input and seed asserts:

- `Xxh3::hash_with_seed` equals `xxhash_rust::xxh3::xxh3_64_with_seed`;
- `Xxh3_128::hash_with_seed` equals `xxhash_rust::xxh3::xxh3_128_with_seed`;
- streaming through arbitrary partitions,
   including empty writes,
   equals the one-shot oracle for both widths;
- the default-seed and explicit-zero-seed results agree.

So its oracle is another finalist,
 which makes any disagreement between the two visible.
This vet built that target with AddressSanitizer and libFuzzer coverage instrumentation
 and ran it for 600 seconds
 ("Suite results").

### Extra one-byte keysets

The prior vet ran the HC8 harness at key lengths 8, 16, 64, 128, 240, 241, 1,024, and 2,048 bytes,
 zero and random bases,
 seeds 0, 1, and 987654321,
 for its four finalists and `gxhash`:
 every finalist result had zero collisions at every width,
 while `gxhash` collided at 1,024 and 2,048 bytes under every seed.
This vet repeats that sweep with `rscrypto` added and `gxhash` again as the positive control
 ("Re-run of the correctness gates").

### Extra keyset results

The sweep ran on the `v4-gxref` build for the five finalists and `gxhash`
 at lengths 8, 16, 64, 128, 240, 241, 1,024, and 2,048 bytes,
 zero and random bases,
 seeds 0, 1, and 987654321
 (`data/logs/onebyte-len*.log`, 16 runs, 18 results each):

- Every finalist result has 0 full-width, 0 low-half, and 0 high-half collisions at every length, base, and seed.
- `gxhash` collides at 1,024 bytes on the random base and at 2,048 bytes on both bases,
   under every seed,
   for example `30ecc446309af95305f3d807d3b2eec9` from two one-byte variants of the same 2,048-byte base.
  This reproduces the finding that removed it and keeps the harness honest.

## Benchmarks

Workload inputs are the measured repository corpus described in "Context":
 `data/files.bin` and `data/files.idx` hold every tracked file's bytes
 (8,101 files, 152,231,070 bytes),
 `data/keymat.bin` the per-package key material,
 `data/fp-lengths.txt` the fingerprint lengths.
Each run is its own bounded container;
 each container runs two rounds of the workload;
 a cell's value is the median over five runs of the better round.

### Run-to-run band

Measured first on the unchanged release-blocking `x86-64-v4` build,
 five runs per cell,
 213 build and workload cells in the summary
 (`scripts/bench-a-summary.ts`, `data/bench-a-summary.tsv`):
 the median cell spans 1.9% between its slowest and fastest run,
 the 90th percentile 5.4%,
 the widest 18.6%
 (`aes_pmac_128` on `files`).
Among the finalists the widest bands are `hashcrew` on `files-stream64k` (8.7%)
 and `twox-hash` on `keymat` (8.5%).
So a difference under about 5% between two finalists in one cell is not resolved by this harness,
 which is what the frozen overlap rule encodes.

### S2 whole files, KiB to tens of MiB (weight 5)

`x86-64-v4` build,
 medians of five runs, GiB/s:

- `files`, one call per tracked file:
   `hashcrew` 47.74,
   `rscrypto` 47.45,
   `twox-hash` 47.42,
   `xxhash-rust` 47.03,
   (`museair` control 32.01),
   `highway` 15.28,
   AES-PMAC 5.89,
   `blake3` 4.64,
   `rscrypto` BLAKE3 4.33,
   SHA-1 2.43,
   SHA-256 2.24 to 2.27 across `bitcoin_hashes`, `sha2`, `graviola`, `rscrypto`, and `scytale`,
   AES-CMAC 1.78,
   `purecrypto` SHA-256 1.77,
   KangarooTwelve 0.92,
   SHA-512 0.74 to 0.82,
   CubeHash 0.77,
   `cryptoxide` SHA-256 0.47,
   Xoodyak 0.32.
- `files-stream64k`, a streaming hasher per file fed 64 KiB slices:
   `xxhash-rust` 44.38,
   `hashcrew` 44.08,
   `twox-hash` 43.91,
   `rscrypto` 37.38,
   `highway` 15.01,
   AES-PMAC 5.89,
   `blake3` 4.48,
   `rscrypto` BLAKE3 4.46.
- `hot16k`, one cache-resident 16 KiB buffer:
   `rscrypto` 73.70,
   `xxhash-rust` 73.27,
   `twox-hash` 69.38,
   `hashcrew` 65.93,
   `highway` 15.16,
   `blake3` 7.53,
   `rscrypto` BLAKE3 7.45,
   AES-PMAC 6.58,
   SHA-1 2.41,
   SHA-256 2.24 to 2.27.

Geometric means of the three cells against the best finalist in each,
 with the overlap rule applied
 (`scripts/s2-ratios.ts`):
 `xxhash-rust` 0.997,
 `twox-hash` 0.979,
 `hashcrew` 0.963,
 `rscrypto` 0.944,
 all rating 4;
 `highway` 0.281, rating 1;
 every other candidate 0.113 or less, rating 0.

The gap that decides the shape of the ranking:
 the fastest cryptographic candidate on this workload,
 AES-PMAC with AES-NI and VAES,
 runs at 12% of XXH3-128's speed on whole files,
 BLAKE3 at 10%,
 SHA-256 with the SHA extensions at 5%.

### S1 key composition (weight 1)

`x86-64-v4` build,
 medians of five runs, GiB/s:

- `fp`, fingerprint material of 70 to 242 bytes:
   `xxhash-rust` 11.47,
   `rscrypto` 11.31,
   `twox-hash` 10.77,
   `hashcrew` 6.29,
   `highway` 3.81,
   SHA-1 1.83,
   SHA-256 1.46 to 1.71,
   BLAKE3 0.85,
   AES-CMAC 0.83,
   AES-PMAC 0.59.
- `keymat`, per-package key material of 50 bytes to 50 KiB:
   `xxhash-rust` 64.80,
   `rscrypto` 60.63,
   `twox-hash` 59.63,
   `hashcrew` 56.43,
   `highway` 14.26,
   AES-PMAC 4.97,
   SHA-1 2.39.

Geometric means against the best finalist:
 `xxhash-rust` 1.000,
 `rscrypto` 1.000 (its five-run ranges overlap `xxhash-rust`'s in both cells),
 `twox-hash` 0.929,
 `hashcrew` 0.691,
 `highway` 0.270.
Ratings 4, 4, 4, 2, 1.
`hashcrew`'s cost is in its short-input path.
Every XXH3 implementation handles inputs up to 240 bytes with scalar code and no kernel dispatch
 (`hashcrew` in `src/xxhash/xxh3.rs:190-196`),
 so the `fp` workload compares those scalar paths,
 and `hashcrew`'s runs at about half the speed of `xxhash-rust`'s.
This audit did not profile which part of that path costs the difference.

### S12 throughput on the non-blocking x86-64 builds (weight 1)

The same three workloads on the baseline, `x86-64-v2`, and `x86-64-v3` builds,
 medians of five runs, ratios against the best finalist in each cell
 (`scripts/s12-ratios.ts`):

- Baseline build, `files`:
   `twox-hash` 48.78,
   `rscrypto` 48.24,
   `xxhash-rust` 34.23,
   `hashcrew` 20.29,
   `highway` 15.06 GiB/s.
- `x86-64-v2`, `files`:
   `rscrypto` 48.08 best,
   `twox-hash` within band,
   `xxhash-rust` 0.656,
   `hashcrew` 0.336 of it.
- `x86-64-v3`, `files`:
   `xxhash-rust` 50.48 best,
   with `twox-hash`, `hashcrew`, and `rscrypto` between 0.94 and 0.99.

Geometric means over the nine cells:
 `twox-hash` 0.973 (rating 4),
 `rscrypto` 0.959 (4),
 `xxhash-rust` 0.747 (3),
 `hashcrew` 0.509 (2),
 `highway` 0.286 (1).

The split is dispatch style.
`twox-hash` and `rscrypto` detect AVX2 at run time,
 so they keep their speed on a build that enables nothing above the x86-64 baseline.
`xxhash-rust` selects at compile time,
 so the baseline and `x86-64-v2` builds run its SSE2 kernel.
`hashcrew` is the interesting case.
The `backend` probe
 (`lab/src/bin/backend.rs`, run in each build)
 reports `selected_backend=Avx2` in every build,
 baseline included,
 so its deficit is not backend choice.
What changes is the code around the annotated kernel:
 in the baseline and `x86-64-v2` builds only the `#[target_feature(enable = "avx2")]` function is compiled with AVX2,
 and those builds measure 0.400 and 0.336 of the best finalist,
 against 0.981 in the `x86-64-v3` build,
 where the whole crate is compiled with AVX2.
The same probe records that no build enables the SHA or AES features at compile time,
 while all of them are detected at run time on this host.

### S3 multi-GB from disk (weight 5)

`x86-64-v4` build,
 single-threaded streaming with 1 MiB reads,
 five repetitions per file, cache mode, and function,
 180 runs, every one parsed
 (`scripts/bench-b.ts`, `data/bench/bigfile.jsonl`, `data/bench-b-summary.txt`).
The read-only pass runs in the same rotation as a ceiling.
Each function produced one digest per file across every mode and repetition
 (18 file-function pairs, all stable),
 and peak resident memory stayed near 3.5 MB for every function,
 which is the bounded-memory half of HC10 measured on a 3.97 GB input.

- 662,710,296-byte debug binary, page cache cold:
   read-only 1.583,
   `xxhash-rust` 1.586,
   `rscrypto` 1.561,
   `hashcrew` 1.546,
   AES-PMAC 1.529,
   `blake3` 1.514,
   `twox-hash` 1.496,
   `highway` 1.467,
   SHA-256 1.367 GiB/s.
  Every finalist overlaps the read-only pass;
   only SHA-256 falls below it (ratio 0.862).
- 662,710,296-byte debug binary, page cache warm:
   read-only 19.777,
   `hashcrew` 15.360,
   `twox-hash` 15.037,
   `xxhash-rust` 14.740,
   `rscrypto` 13.818,
   `highway` 8.606,
   `blake3` 5.446,
   AES-PMAC 4.905,
   SHA-256 2.032 GiB/s.
  The four XXH3 crates overlap each other;
   `highway` resolves at 0.560,
   `blake3` at 0.355,
   AES-PMAC at 0.319,
   SHA-256 at 0.132.
- 3,966,238,720-byte image, cold:
   0.316 to 0.351 GiB/s for everything including the read-only pass,
   all overlapping.
  Storage bounds this cell completely.
- 3,966,238,720-byte image, warm:
   read-only 16.424,
   `xxhash-rust` 13.627,
   `hashcrew` 13.282,
   `twox-hash` 13.149 (0.965),
   `rscrypto` 12.194 (0.895),
   `highway` 8.087 (0.593),
   `blake3` 5.377 (0.395),
   AES-PMAC 4.594 (0.337),
   SHA-256 2.000 (0.147).

Geometric means over the four cells:
 `xxhash-rust` 1.000,
 `hashcrew` 1.000,
 `twox-hash` 0.991,
 `rscrypto` 0.973,
 all rating 4;
 `highway` 0.759, rating 3;
 `blake3` 0.612 and AES-PMAC 0.573, rating 2;
 SHA-256 0.360, rating 1.
The cold cells tie almost everything,
 so S3's separating power comes from the warm cells,
 where the page cache is the source and the hash is the bottleneck.

### S4 multi-core hashing of one large input (weight 1)

The one campaign that raises the container bounds:
 `--cpus` set to the thread count, at most 8 of the host's 16 logical cores,
 with `--memory=8g`,
 three repetitions,
 warm page cache,
 the 3.97 GB image,
 16 MiB reads
 (`scripts/scaling.ts`, `data/bench/scaling.jsonl`).

- `blake3`'s library parallel mode (`Hasher::update_rayon`):
   3.96 GiB/s at one thread,
   5.87 at two,
   7.63 at four,
   8.48 at eight,
   a self-speedup of 2.14 at eight threads,
   with the same digest at every thread count.
- A lab-defined chunk composition
   (fixed-size chunks hashed in parallel, then their digests hashed in order):
   BLAKE3 6.88 and XXH3-128 7.31 GiB/s at eight threads.
  Its output differs from the sequential digest by construction,
   so it is a format meow would own rather than a library mode.
- Single-threaded XXH3-128 on the same file and cache state:
   13.35 GiB/s,
   above every parallel BLAKE3 configuration measured here.

Ratings:
 every XXH3-128 finalist and `highway` rate 1,
 because none offers a library parallel mode whose output equals its sequential output,
 and a chunk construction would be meow's own format.
`blake3` would rate 3 on this criterion
 (a library mode with a 2.14 self-speedup),
 which is one of the few places a cryptographic candidate scores above the finalists,
 and at weight 1 it does not move the ranking.

One limit of this campaign:
 the harness routed every multi-thread run of `rscrypto_blake3_128` through the lab composition
 rather than through `rscrypto`'s own rayon tree mode,
 so its parallel feature was measured only at one thread (4.21 GiB/s).
Its published CI artifacts show that mode at about six times its single-thread speed on an 8-vCPU runner
 ("S5: aarch64 evidence"),
 which would place it near `blake3`'s `update_rayon`.
No finalist rating depends on this,
 because no XXH3-128 candidate has such a mode.

## S5: aarch64 evidence

No aarch64 hardware ran in this vet
 (the one aarch64 machine in reach is powered off; "What an `ssh m1` run would add").
S5 therefore rests on published third-party measurements,
 on source analysis of each candidate's aarch64 kernel,
 and on the QEMU correctness runs,
 and its ratings are ranges.

### Measured aarch64 numbers from rscrypto's public CI

`rscrypto` publishes criterion artifacts from its benchmark workflow.
Run 34874736834 of 2026-09-14 was downloaded and parsed
 (`scripts/rscrypto-bench-extract.ts`, `data/rscrypto-bench.tsv`, 5,038 rows).
The aarch64 measurement runner is `measure-aarch64-linux`,
 an on-demand AWS `c9g.2xlarge` with 8 vCPUs
 (`.github/runs-on.yml` at `main` in the rscrypto clone);
 the artifacts do not record the CPU model beyond that.
The comparison crates in that run are the versions this vet measures:
 `xxhash-rust` 0.8.18,
 `sha2` 0.11.0,
 and `blake3` 1.8.6 (this vet uses 1.8.7).

Single-message throughput on aarch64, 1 MiB inputs:

- XXH3-128:
   `xxhash-rust` 24.59 GiB/s,
   `rscrypto` 24.53 GiB/s;
   at 64 KiB both are 24.56;
   at 4 KiB `rscrypto` 24.37 and `xxhash-rust` 23.28.
  The two are the same algorithm with separate NEON kernels and land within a percent of each other.
- SHA-256:
   `sha2` 1.687,
   `rscrypto` 1.687,
   `ring` and `aws-lc-rs` 1.957.
- SHA-512:
   `ring` and `aws-lc-rs` 1.185,
   `rscrypto` 1.155,
   `sha2` 1.143.
- SHA-3 and SHAKE through `keccak`-class code:
   0.43 to 0.96,
   which bounds KangarooTwelve on aarch64 in the same region.
- BLAKE3:
   the `blake3` crate 1.613,
   `rscrypto` 13.31.
  These two rows are not comparable as kernels:
   the benchmark binary for the BLAKE3 group is built with the features
   `["std", "blake3", "parallel"]`
   (`.config/benchmark-matrix.json` at `main`),
   so `rscrypto::Blake3::digest` runs its rayon tree mode across the runner's 8 vCPUs
   while `blake3::hash` is single-threaded.
  The same pattern appears in the x86 artifacts from the same run
   (`blake3` 10.21, `rscrypto` 61.75 GiB/s),
   where the ratio is again about the vCPU count.
  Read as single-core evidence,
   the usable number from this source is the `blake3` crate's 1.61 GiB/s on aarch64.

So on aarch64, as on `x86-64-v4`,
 XXH3-128 runs about 15 times the speed of the fastest cryptographic candidate measured there
 (24.5 against 1.69 for SHA-256 through SHA extensions, 1.61 for single-threaded BLAKE3).

### aarch64 kernels by candidate

Reused from the prior vet for the four crates it validated,
 and read in source for the new ones:

- `xxhash-rust`:
   NEON stripe accumulator under `cfg(target_feature = "neon")`,
   which every `aarch64-unknown-linux-*` target enables
   (`src/xxh3.rs:55`, `:252-268`).
  Now also measured: 24.59 GiB/s (above).
- `twox-hash`:
   NEON accumulate and scramble kernels (`src/xxhash3/large/neon.rs`),
   selected at run time.
  Upstream publishes an Apple M1 Max comparison
   (`comparison/README.md`, "xxHash3 (128-bit)", "Oneshot hashing"):
   Rust 34.4 GiB/s,
   C with NEON 34.6,
   C scalar 21.3,
   for 256 KiB to 4 MiB buffers.
- `hashcrew`:
   NEON kernels (`src/xxhash/kernel/neon.rs`),
   selected at compile time because aarch64 enables NEON
   (`src/xxhash/kernel/mod.rs:98-104`),
   so the run-time dispatch it pays on x86_64 does not apply there.
  No published aarch64 throughput.
- `rscrypto`:
   NEON kernel in `src/hashes/fast/xxh3/aarch64_neon.rs` with run-time detection in `src/platform/detect`.
  Measured above.
- `highway`:
   a NEON implementation of the four-lane update with `vmull_u32` multiplies (`src/aarch64.rs`),
   used unconditionally on aarch64.
  The README claims "> 10 GB/s with SIMD (SSE 4.1 AVX 2, NEON)" without naming a machine or input size;
   `assets/highway.csv` holds x86 results only.
- Cryptographic candidates:
   `sha2`, `rscrypto`, `graviola`, `purecrypto`, `bitcoin_hashes`, and `scytale` use the Armv8 SHA-2 extension;
   `sha2` and `rscrypto` use the Armv8.2 SHA-512 instructions;
   `aes` uses the Armv8 AES extension;
   `keccak` uses the Armv8.2 SHA-3 extension;
   `cubehash` and `xoodyak` use NEON.
  The measured aarch64 numbers above cover SHA-256, SHA-512, SHA-3, and BLAKE3,
   and they place every cryptographic candidate between 1 and 2 GiB/s,
   an order of magnitude under XXH3-128 on the same core.

## Quality and stability assurance

### SMHasher3 (S6 evidence)

The SMHasher3 results summary saved by the prior vet
 (`~/temp/agent/hashvet-2026-09-17/data/smhasher3-results-readme.md`)
 and the raw result files it saved for the two non-cryptographic finalist families:

- `XXH3-128`:
   in the "Failing hashes" table with 36 failures out of 250 tests.
  The raw file (`smh3-XXH3-128.txt`) shows the failures are in reduced-width and distribution tests;
   every "all collisions (128-bit)" line reports 0 actual against 0.0 expected,
   so no full-width collision appears at any tested seed.
  The `.regen` variant has 19 failures with the same pattern.
- `HighwayHash-128`:
   in the "Passing hashes" table,
   238 tests, no failures.
- Cryptographic families:
   `blake3`, `SHA-2-224`, `SHA-2-256`, `SHA-1`, `blake2s`, `blake2b`, `MD5`, `SHA-3`, and the Ascon CXOFs
   are all in the passing table.
  The AES-based non-cryptographic entries fail
   (`aesnihash-peterrk` 41, `aesnihash-majek` 64, `t1ha0.aesA` and `t1ha0.aesB` 5 each),
   which is why an AES-round universal hash would have needed its own quality evidence rather than AES's.

Crafted collisions,
 which the changed premises make a scored question rather than a gate:

- XXH3-128 and HighwayHash-128 make no collision-resistance claim once the seed or key is known.
  For meow's cache the seed is a constant in the binary,
   so an adversary who can run code in the repository can craft a pair of file contents with the same key.
  The user's accepted reasoning is that such an adversary already runs meow's tasks,
   and that the cache is local and rebuildable.
- BLAKE3, SHA-256, SHA-512, KangarooTwelve, CubeHash, and Xoodyak have no published collision attack,
   and a 128-bit truncation of any of them costs the generic 2^64 to collide.
- SHA-1 truncated to 128 bits inherits the published SHA-1 collision attacks,
   which are below that generic cost.
- AES-CMAC and AES-PMAC with a key that ships in the binary are not collision-resistant at all:
   their security argument assumes a secret key.

### Stability assurance (S7 evidence)

- Local reference equality:
   `lab/src/bin/refcheck.rs` checks published digests
   (FIPS 180-4 SHA-256, SHA-1, and SHA-512 of `"abc"`,
   the BLAKE3 hash of the empty input,
   and XXH3-128 of the empty input)
   and cross-implementation equality inside each family
   (four XXH3-128 crates, seven SHA-256 crates, three SHA-512 crates, two BLAKE3 crates)
   over 266 input lengths from 0 to 1 MiB,
   with a positive control that flips one input byte and must fail every check.
- Cross-architecture equality:
   the prior vet's QEMU aarch64 runs and its `x86-64-v3` musl probe showed the NEON and x86 paths agreeing
   for the four reused finalists;
   this vet adds the `x86-64-v4` build and the aarch64 suites for `rscrypto`.
- Upstream vectors:
   every candidate's own test suite carries the published vectors of its algorithm,
   and the upstream suites that ran here executed them ("Upstream suites").
- Documentation:
   the XXH3 specification freeze,
   FIPS 180-4,
   NIST SP 800-38B,
   the BLAKE3, KangarooTwelve, CubeHash, and Xoodyak specifications,
   and `rscrypto`'s statement that its SIMD and assembly kernels are tested against its portable reference path.

## Source quality, dependencies, and maintenance

### Audit surface (S9 evidence)

Non-test Rust code lines on the path that computes the used function,
 counted over the modules that implement it
 (`scripts/audit-surface.ts`, `data/audit-surface.tsv`):

- `xxhash-rust` XXH3-128: 1,396 lines in 3 files.
- `hashcrew` XXH3-128: 1,511 lines in 6 files.
- `twox-hash` XXH3-128: 1,533 lines in 8 files.
- `highway` HighwayHash-128: 2,955 lines in 16 files.
- `rscrypto` XXH3-128: 7,496 lines in 23 files,
   which includes its platform detection module
   and kernels meow never compiles
   (s390x 329 lines, PowerPC 290);
   its x86_64 and aarch64 kernels are 225, 210, and 279 lines,
   its streaming state 594,
   and its dispatch 406 plus 68 lines of tables.
  Most of its `unsafe` blocks on that path carry a `SAFETY` comment
   (for example 11 of 19 occurrences in `x86_64_avx2.rs`, 13 of 22 in `aarch64_neon.rs`,
   counting every occurrence of the word, including the `unsafe fn` signatures).
- For scale, the cryptographic candidates on the same measure:
   `sha2` SHA-256 985 lines,
   `graviola` SHA-256 446,
   `sha1` 806,
   `blake3` 6,224 plus 26 C and assembly files,
   `rscrypto` BLAKE3 18,280 Rust lines plus 20,286 assembly lines.

Whole-crate figures,
 `unsafe` items,
 and native files are in "Identity, provenance, and license".
The contrast that matters for a weight-1 criterion:
 `xxhash-rust`, `hashcrew`, and `twox-hash` are single-purpose crates of a few thousand lines,
 `highway` is one algorithm with four architecture backends,
 and `rscrypto` is a 177,154-line cryptography suite of which the XXH3 path is a small part,
 so auditing its XXH3 means auditing a module inside a much larger crate
 whose other parts compile into the same library.

Runtime dependencies of the finalists:

- `xxhash-rust`, `hashcrew`, `highway`: none.
- `twox-hash`: `rand` and `serde`, both optional and off by default.
- `rscrypto`: `getrandom`, `rayon`, and `serde`, all optional;
   the hash paths need none of them,
   and `rayon` is what its `parallel` feature turns on.

### Maintenance (S11 evidence)

From the crates.io API and the GitHub API on 2026-09-17
 (`data/crate-meta.tsv`, `data/repo-meta.tsv`):

- `xxhash-rust` 0.8.18,
   published 2026-07-21,
   15 stable releases since 2021-03-08,
   3 in the last year,
   29.6M recent downloads,
   3 open issues,
   last commit 2026-07-21.
- `twox-hash` 2.1.4,
   published 2026-08-27,
   22 stable releases since 2015-05-09,
   2 in the last year,
   53.4M recent downloads,
   25 open issues,
   last commit 2026-09-17.
- `hashcrew` 0.3.0,
   published 2026-09-15,
   5 stable releases,
   all since 2026-09-02,
   202 recent downloads,
   0 open issues,
   4 stars,
   last commit 2026-09-15.
- `highway` 1.3.0,
   published 2025-01-11,
   21 stable releases since 2018-09-19,
   none in the last year,
   702K recent downloads,
   6 open issues,
   last commit 2026-07-23.
- `rscrypto` 0.9.0,
   published 2026-08-28,
   16 stable releases,
   all since 2026-05-02,
   1,108 recent downloads,
   0 open issues,
   38 stars,
   last commit 2026-09-17,
   and six CI workflows (`ci.yml`, `bench.yml`, `ct.yml`, `fuzz.yml`, `profile.yml`, `release.yml`).

Two of the five are young crates with almost no dependent base
 (`hashcrew` two weeks old, `rscrypto` four months old),
 two are long-lived with millions of downloads,
 and `highway` is stable but quiet:
 no release in the last year,
 while its repository still receives commits.

## C toolchain branch

The branch asks whether allowing a C compiler and assembler in meow's build
 (HC4-C in "Frozen hard constraints")
 could change the ranking.
Only one candidate is affected:
 `blake3` 1.8.7,
 whose AVX-512 and NEON kernels are C and assembly compiled by `cc`.
Every other HC4 exit is an FFI wrapper around a C library
 (`ring`, `aws-lc-rs`, `openssl`, the `*-asm` crates, `kangarootwelve_xkcp`, and the rest),
 and each wraps an algorithm that a Rust candidate already implements here,
 so their speed is bounded by the same algorithms' measurements.

Measured, `x86-64-v4` build, medians of five runs, GiB/s
 (`data/bench-a-summary.tsv`):

- `blake3` with its C and assembly kernels:
   `files` 4.64,
   `files-stream64k` 4.48,
   `hot16k` 7.53.
- `blake3` with the `pure` feature, Rust kernels only:
   `files` 3.79,
   `files-stream64k` 3.70,
   `hot16k` 6.40.
  So the C kernels buy it 18% to 22% on this host.
- `rscrypto` BLAKE3, pure Rust with `global_asm!` kernels rustc assembles:
   `files` 4.33,
   `files-stream64k` 4.46,
   `hot16k` 7.42,
   within a few percent of `blake3` with C,
   and faster than `blake3` without it.
- On the baseline build the gap is larger
   (`blake3` with C 4.31 against `pure` 3.07),
   because the C build selects AVX-512 at run time while the Rust `pure` build has AVX2 at most.

Decision:
 the branch closes,
 and no user question is raised.
The reason is a measured bound rather than a preference:
 BLAKE3 with its C kernels reaches 0.097 of XXH3-128's throughput on whole files
 and 0.10 on the streaming and hot-buffer workloads,
 which is rating 0 on S2,
 and its measured aarch64 single-thread speed is 1.61 GiB/s against XXH3-128's 24.5
 ("S5: aarch64 evidence"),
 which is rating 0 on S5.
By the bound in "Which confirmed candidates receive equal-depth validation",
 a candidate rated 0 on S2 and S5 cannot pass 42 of 92 points,
 while every XXH3-128 candidate scores at least 45 from the weight-5 criteria alone.
Allowing C would also not improve any other candidate's rank,
 because `rscrypto` already delivers BLAKE3 at C speed without it.

## Risks and usage rules for XXH3-128

These apply to whichever XXH3-128 crate meow adopts.

Risks:

- No collision resistance against an adversary who knows the seed.
  The seed is a constant in the binary,
   so a repository that can run meow's tasks can also craft two file contents with the same cache key.
  The user's accepted reasoning is that such a repository already runs its own code under meow,
   and that the cache is local and rebuildable.
  The risk that remains is a repository that ships crafted files without running tasks,
   for example one whose build is fully cached;
   a wrong cache hit there produces a wrong artifact rather than code execution.
- SMHasher3 failures.
  XXH3-128 fails 36 of 250 SMHasher3 tests
  ("Quality and stability assurance"),
   none of them a full-width 128-bit collision.
  For a cache key of a 128-bit width the practical exposure is the birthday bound,
   about 2^64 keys,
   which meow's repositories do not approach.
- Crate-level risk rather than algorithm risk.
  The algorithm is frozen and identical across implementations
   (checked here by cross-implementation equality),
   so a bug would be in one crate's kernel,
   and the cost of switching crates is a rebuild of the local cache.

Usage rules:

- Use the one-shot function for whole files that fit in memory
   and the streaming state for anything larger,
   because the streaming output equals the one-shot output for every chunking tested
   ("HC10 streaming").
- Fix the seed as a constant and treat it as part of the cache-key format:
   changing it invalidates every key,
   which is a cache rebuild,
   not a correctness problem.
- Keep the key at the full 128 bits.
  Truncating further re-enters the birthday bound much sooner.
- Every raised build (`x86-64-v2`, `v3`, `v4`, or any `-Ctarget-feature`)
   needs meow's startup capability check before any hashing,
   because a raised build may contain instructions the running CPU lacks.
  This is independent of the crate:
   `x86-64-v4` enables `avx512f`,
   and the prior vet measured an illegal-instruction death for a raised build under an older QEMU CPU model.
- If meow ever needs a key that resists an adversary who knows the seed,
   that is a different decision:
   the cryptographic candidates measured here run at 4% to 10% of XXH3-128's speed on both architectures,
   and the fastest of them on this host was AES-PMAC at 5.9 GiB/s against 47.7.

## Confidence and limits

- No aarch64 hardware ran.
  S5 rests on third-party measurements
   (rscrypto's public CI artifacts, upstream's Apple M1 Max comparison for `twox-hash`)
   and on source analysis,
   so its ratings are ranges and the sensitivity matrix tests both endpoints.
  This is the largest single source of uncertainty in the ranking,
   because S5 carries weight 5 under the changed premises.
- The aarch64 correctness evidence is QEMU,
   not silicon.
  A hard-gate failure that only real NEON hardware would show cannot be excluded.
- Another agent was building and testing on this host during part of the benchmark campaign.
  Load average is recorded before and after every run
   (`data/bench/progress-a.txt`),
   the ratings use per-cell medians of five runs,
   and the run-to-run band is measured on the unchanged release-blocking build,
   but individual runs are noisier than they would be on an idle host.
- The cold multi-GB numbers are storage-bound on this host,
   so they separate candidates only where a candidate is slower than the storage path.
- `rscrypto`'s published aarch64 and x86 BLAKE3 rows are multi-threaded on the rscrypto side
   and single-threaded on the `blake3` side,
   which is why this vet uses them only for XXH3-128, SHA-2, and SHA-3,
   and treats the BLAKE3 pair as evidence about the parallel mode rather than about kernels.
- Upstream suites for the four reused finalists were run by the prior vet earlier the same day,
   not re-run here;
   the crate versions,
   host,
   toolchains,
   and images are the same.
- Two finalists are young crates with small dependent bases
   (`hashcrew` first published 2026-09-02, `rscrypto` 2026-05-02),
   so their maintenance ratings rest on weeks or months of history rather than years.
