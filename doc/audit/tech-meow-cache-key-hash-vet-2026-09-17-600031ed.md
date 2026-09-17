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
 they carry 25 candidate functions into hard-gate confirmation,
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
