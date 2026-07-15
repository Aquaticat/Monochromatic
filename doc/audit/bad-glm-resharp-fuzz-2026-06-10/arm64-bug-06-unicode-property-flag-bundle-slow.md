# ARM64-BUG-6 Unicode property class + literal in flag-bundle config slow compile

## Classification

- Type:
   performance,
   compile-time slow.
- Phase:
   compile time.
- Severity:
   slow-unit (>1s compile) for `\p{L}` followed by mixed bytes
  under `ignore_whitespace` + `case_insensitive` flag-bundle config.

## Minimal reproducer

From nosimd-compile artifact `nosimd_compile_timeout-e8edf24f52ed9cbc965ece54733375738be9f082`:

```text
full_hex: 535c707b4c7d1e687600000000000048753f6e746572323032340000287829
option_byte: 0x53 -> config index 5 (flag-bundle)
pattern (lossy): \p{L}\x1ehv...Hu?nter2024...(x)
```

## Root cause

Under the `ignore_whitespace(true)` + `case_insensitive(true)` +
`dot_matches_new_line(true)` flag bundle,
 the pattern parser may interpret
more of the input as valid regex tokens (whitespace is ignored,
 case is
folded).
 This causes the Unicode property class `\p{L}` to be followed by
a longer effective pattern,
 increasing the derivative computation cost.

## Artifact

```text
/work/artifacts/nosimd-compile/nosimd_compile_timeout-e8edf24f52ed9cbc965ece54733375738be9f082
/work/artifacts/nosimd-compile/nosimd_compile_timeout-e8edf24f52ed9cbc965ece54733375738be9f082.txt
```
