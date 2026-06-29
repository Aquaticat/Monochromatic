# ARM64-BUG-7 Bracketed ASCII range + Unicode property class timeout

## Classification

- Type:
   performance,
   compile-time denial-of-service.
- Phase:
   compile time.
- Severity:
   `A-Z\p{L}5]8...` exceeds 10s timeout under ASAN on ARM64 in
  hardened config.

## Minimal reproducer

From nosimd-compile artifact `nosimd_compile_timeout-d2776dc29a1061f40ca8fd91565327275f531f7c`:

```text
full_hex: 5b412d5a5c707b4c7d355d38072c7d1e000000000000002a2c12015d5f2a
option_byte: 0x5b -> config index 1 (hardened)
pattern (lossy): A-Z\p{L}5]8\x07,}\x1e...*,\x12\x01]_*
```

## Root cause

Combines two known cost factors:
 the bracketed ASCII range `A-Z` and the
Unicode property class `\p{L}` inside a character class structure.
 This
combines the bracketed-class cost (BUG-11/17 from 06-04,
 partially fixed)
with the property-class cost (ARM64-BUG-1,
 not fixed).
 The two large
minterm sets interact in the derivative construction,
 causing super-linear
cost.

## Artifact

```text
/work/artifacts/nosimd-compile/nosimd_compile_timeout-d2776dc29a1061f40ca8fd91565327275f531f7c
/work/artifacts/nosimd-compile/nosimd_compile_timeout-d2776dc29a1061f40ca8fd91565327275f531f7c.txt
```
