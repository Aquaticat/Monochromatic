# ARM64-BUG-4 `\B` timeout under full-unicode config

## Classification

- Type:
   performance,
   compile-time denial-of-service.
- Phase:
   compile time.
- Severity:
   `\B` compiles in ~831µs on x86_64 but exceeds 10s timeout under
  ASAN on ARM64 in full-unicode mode.

## Minimal reproducer

From nosimd-compile artifact `nosimd_compile_timeout-3e3e92a888f94423bd1a6f79f1d7acfd682adb2e`:

```text
full_hex: ff5c42
option_byte: 0xff -> config index 3 (full-unicode)
pattern: \B
```

To reproduce:
```sh
cargo +nightly fuzz run compile <artifact> --fuzz-dir fuzz \
  --target aarch64-unknown-linux-gnu -- -timeout=10 -runs=1
```

## Root cause

The `\B` (non-word-boundary) assertion desugars to a lookahead over a large
character class.
 Under `UnicodeMode::Full`,
 the character class expands to the
full Unicode Letter set (thousands of codepoints).
 On ARM64,
 the derivative
construction for this large class under the `Kind::Inter` branch at
`resharp-algebra/src/lib.rs:1370` recurses deeply,
 same root as ARM64-BUG-1.

On x86_64,
 the same pattern compiles in ~831µs;
 on ARM64 without ASAN it
compiles in ~817µs.
 The ASAN instrumentation adds ~12x overhead on ARM64,
pushing the compile time past the 10-second timeout.
 This suggests the raw
compile cost is acceptable but ASAN amplification makes it a DoS surface.

## Artifact

```text
/work/artifacts/nosimd-compile/nosimd_compile_timeout-3e3e92a888f94423bd1a6f79f1d7acfd682adb2e
/work/artifacts/nosimd-compile/nosimd_compile_timeout-3e3e92a888f94423bd1a6f79f1d7acfd682adb2e.txt
```
