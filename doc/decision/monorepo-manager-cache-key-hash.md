# The monorepo manager's cache keys use XXH3-128 from `twox-hash`

## Status

Accepted 2026-09-17.
The user delegated the choice
("Pick some other hash that has hardware acceleration on x86 and ARM instead.")
and then confirmed the reading the recommendation relies on,
answering "By 'hardware acceleration on x86 and ARM',
 did you mean SIMD vector kernels,
or dedicated instructions like AES-NI and SHA extensions?"
with "SIMD counts".
Vet:
[`doc/audit/tech-meow-cache-key-hash-vet-2026-09-17.md`](../audit/tech-meow-cache-key-hash-vet-2026-09-17.md).
Design:
"Cache key hash after the collision findings" and "Cache key hash vet result" in
[`doc/planning/monorepo-manager-from-scratch-design.md`](../planning/monorepo-manager-from-scratch-design.md).
Supersedes the `gxhash` hashing line in
[`monorepo-manager-all-rust.md`](monorepo-manager-all-rust.md).

## Context

- `gxhash` 3.5.0 produced seed-independent full 128-bit collisions between inputs differing by one byte
   (upstream ogxd/gxhash#83 and #124,
   open),
   and Miri reports undefined behavior for 1 to 16 byte inputs.
- The user said a non-cryptographic hash would do,
   asked for hardware acceleration on x86 and ARM,
   and earlier chosen requirements carried over:
   128-bit keys,
   stable output for persisted keys,
   static musl builds on both architectures,
   and a clear warning on CPUs lacking required capabilities.
- The workload is whole files and multi-GB outputs:
   tracked files have p50 4,043 bytes and p90 19,244,
   files of 64 KiB and above hold 66.15% of tracked bytes,
   and outputs reach 3,966,238,720 bytes,
   so hashing must stream with bounded memory.

## Decision

- Cache keys and content hashes use XXH3-128 through `twox-hash` 2.1.4 (`XxHash3_128`).
- "Hardware acceleration" means designed SIMD kernels:
   AVX2 or SSE2 on x86_64 and NEON on aarch64,
   selected at run time.

## Consequences

- Dependency:
   `twox-hash = { version = "=2.1.4", default-features = false, features = ["std", "xxhash3_128"] }`;
   the exact pin keeps persisted keys stable across upgrades,
   and `std` enables run-time AVX2 and NEON detection.
- meow's tests keep golden output vectors,
   such as the empty input `99aa06d3014798d86001c324468d497f`,
   so an output change fails a test.
- Hashing uses the default seed only,
   with salts and domain tags in the hashed bytes,
   because SMHasher3 finds full-width XXH3 collisions when seeds vary.
- Files stream through a fresh `XxHash3_128::new()` each,
   in reads of 64 KiB to 1 MiB,
   in parallel across files rather than within one file;
   the `u128` is serialized in one fixed byte order.
- The default x86_64 and aarch64 targets guarantee SSE2 and NEON,
   so default builds need no startup CPU check;
   the AES check designed for `gxhash` is dropped.
  A build raised above the default target needs the check from "Missing CPU capabilities" in the design,
   because `is_x86_feature_detected!` evaluates to `true` at compile time for enabled target features.
- Accepted risks:
   XXH3-128 fails 36 SMHasher3 tests at partial width or with varying seeds,
   none a full-width collision at a fixed seed,
   and `twox-hash` has one maintainer.

## Rejected

Evidence for each is in the vet report.

- `gxhash`:
   the one-byte collisions and Miri findings.
- `xxhash-rust` 0.8.18 (second):
   selects its kernel at compile time,
   so a default build hashes files at 29.1 GiB/s against 49.3,
   and reaching AVX2 needs a raised build plus a startup check.
- `hashcrew` 0.3.0 (third):
   calls its AVX2 kernel once per 64-byte stripe,
   16.0 GiB/s on files in a default build.
- `highway` 1.3.0 (fourth):
   about 12.4 GiB/s on files in every build,
   despite passing all SMHasher3 tests.
- Dedicated-instruction hashes:
   no non-cryptographic library passes the hard gates,
   and the cryptographic ones measured 1.86 GiB/s (SHA-256) and 1.43 GiB/s (AES-CMAC) on files;
   the user chose the SIMD reading.
- `rotohash-rs`:
   no streaming API and no stability statement.
