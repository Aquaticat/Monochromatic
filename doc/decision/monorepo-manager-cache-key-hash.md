# meow's cache keys use XXH3-128 from `twox-hash`

## Status

Accepted 2026-09-17,
after the brief on the re-run vet and the m1 measurement:
the user answered "Accept twox-hash".
Every decision here applies to meow 0.x only (user,
 2026-09-17).
Vet:
[`tech-meow-cache-key-hash-vet-2026-09-17-600031ed.md`](../audit/tech-meow-cache-key-hash-vet-2026-09-17-600031ed.md),
which supersedes the first pass in
[`tech-meow-cache-key-hash-vet-2026-09-17.md`](../audit/tech-meow-cache-key-hash-vet-2026-09-17.md).
Design:
"Cache key hash after the collision findings" and "Cache key hash re-run vet result" in
[`doc/planning/monorepo-manager-from-scratch-design.md`](../planning/monorepo-manager-from-scratch-design.md).
Supersedes the `gxhash` hashing line in
[`monorepo-manager-all-rust.md`](monorepo-manager-all-rust.md).

An earlier record of this same choice was written on 2026-09-17 before the user saw a brief,
then withdrawn and deleted;
rule `DRR` now requires the brief and acceptance first.

## Context

- `gxhash` 3.5.0 produced seed-independent full 128-bit collisions between inputs differing by one byte
   (upstream ogxd/gxhash#83 and #124,
   open),
   and Miri reports undefined behavior for 1 to 16 byte inputs.
- Requirements carried into the selection:
   hardware acceleration on x86 and aarch64,
   128-bit keys,
   stable output for persisted keys,
   streaming with chunking-independent output and bounded memory,
   and static musl builds on both architectures.
- Cryptographic hashes were eligible
   ("non-crypto isn't a requirement",
   user,
   2026-09-17)
   and competed under speed-first weights ("A",
   user,
   2026-09-17).
- Release-blocking builds are `x86-64-v4` and both aarch64 targets ("v4 block only",
   user,
   2026-09-17).
- The workload is whole files and multi-GB outputs:
   files of 64 KiB and above hold 66.15% of tracked bytes,
   and outputs reach 3,966,238,720 bytes.

## Decision

- Cache keys and content hashes use XXH3-128 through `twox-hash` 2.1.4,
   one-shot for in-memory files and its streaming state for larger inputs.
- "Hardware acceleration" means designed SIMD kernels:
   AVX2 or SSE2 on x86_64 and NEON on aarch64.

## Evidence

- On the release-blocking `x86-64-v4` build,
   one call per tracked file:
   `hashcrew` 47.74 GiB/s,
   `rscrypto` 47.45,
   `twox-hash` 47.42,
   `xxhash-rust` 47.03,
   `highway` 15.28,
   against BLAKE3 4.64 and SHA-256 2.24 to 2.27.
- On the user's M1 with NEON only:
   `hashcrew` 30.91,
   `twox-hash` 30.73,
   `xxhash-rust` 29.86,
   `rscrypto` 29.74,
   `highway` 7.17,
   against SHA-256 2.14 and BLAKE3 1.52.
- Scores out of 92:
   `twox-hash` 85,
   `rscrypto` 83.5,
   `hashcrew` 79,
   `xxhash-rust` 77,
   `highway` 36;
   no sensitivity test of 96 changes the winner.
- Correctness,
   each with a control that failed as expected:
   82,200 C-reference comparisons with no mismatch on aarch64,
   4,261 on x86_64,
   no collisions in any one-byte keyset,
   no streaming mismatches,
   and 60 of 60 accumulated digest lines identical across machines.

## Consequences

- Dependency:
   `twox-hash = { version = "=2.1.4", default-features = false, features = ["std", "xxhash3_128"] }`;
   the exact pin keeps persisted keys stable,
   and `std` enables run-time AVX2 and NEON selection.
- meow's tests keep golden output vectors,
   such as the empty input `99aa06d3014798d86001c324468d497f`.
- The seed is fixed as part of the key format and the full 128 bits are kept;
   salts and domain tags go into the hashed bytes,
   because XXH3 collides when seeds vary.
- Files stream through a fresh hasher each,
   in reads of 64 KiB to 1 MiB,
   parallel across files rather than within one file.
- Every build raised above its target baseline runs meow's startup capability check before hashing.
- The cache has no resistance to crafted collisions:
   accepted because the cache is local,
   a repository that can craft inputs already runs meow's tasks,
   and changing the hash later costs one cache rebuild.
- Remaining proxy:
   the aarch64 measurement is Darwin on an Apple core.
  A Linux aarch64 core where `twox-hash` ran more than 9% slower relative to the others would favor `rscrypto`.

## Rejected

- `gxhash`:
   one-byte collisions and Miri findings.
- `rscrypto` (second,
   83.5):
   published 2026-05-02 with about 1,100 recent downloads,
   one maintainer,
   and a 7,496-line audit path inside a 177,154-line crate.
- `hashcrew` (third,
   79):
   two weeks old,
   half speed on short inputs,
   and weak in the non-blocking builds.
- `xxhash-rust` (fourth,
   77):
   compile-time kernel selection,
   and the slowest of the four XXH3 crates when streaming on the M1.
- `highway` (fifth,
   36):
   0.28 of XXH3 on whole files despite passing every SMHasher3 test.
- Cryptographic and AES-based candidates:
   8 to 15 times slower on the weight-5 criteria on both architectures.
- A rented Arm Linux run to close the Darwin proxy:
   the user accepted the measured evidence instead.
