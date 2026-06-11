# ARM64-BUG-1 Unicode property class compile blowup (ARM NEON path)

## Classification

- Type: performance, compile-time blowup (denial-of-service relevant).
- Phase: compile time, inside `Regex::new` / `with_options`.
- Severity: a 6-character pattern takes 7.25 seconds to compile on ARM64,
  versus 162ms on x86_64 (45x slower). Multiple distinct Unicode property
  class patterns cause timeouts under all option configurations.

## Minimal reproducers

```rust
use resharp::Regex;
use std::time::Instant;

// ARM64: ~7.25s, x86_64: ~162ms
let start = Instant::now();
let _ = Regex::new(r"\P{L}2");
eprintln!("{:?}", start.elapsed());

// ARM64: slow-unit (compile > 1s)
let _ = Regex::new(r"\p{L}");

// ARM64: timeout
let _ = Regex::new(r"\p{L}*&_*[A-Za-z]");
```

The fuzz campaign's `compile` target found these patterns across all three
build variants (pristine, nosimd, fork), confirming the defect is not
SIMD-specific but is amplified by the ARM64 compilation path.

## Observed behaviour

Compile time measured from the ARM64 cargo-fuzz `compile` target (single
`Regex::with_options` call, `-timeout=10`):

| Pattern | Variant | Option config | Compile time |
|---------|---------|---------------|-------------|
| `\P{L}2` | pristine | default (0x2a % 6 = 0) | 7252 ms (timeout) |
| `\P{L}2` | pristine | flag bundle (0x2a) | 7252 ms (timeout) |
| `{8,}\b\w+\r` | pristine | flag bundle (0x7b % 6 = 5) | ~6986 ms (slow-unit) |
| `\w+\b*` | pristine | flag bundle (0x5d % 6 = 5) | timeout |
| `\p{L}*&_*[A-Za-z]` | nosimd | ascii (0x5b % 6 = 5) | timeout |
| `\P{L}.[[^a-z]0l:]]` | nosimd | ascii (0x37 % 6 = 1) | slow-unit |
| `\p{L}` | fork | ascii (0x3d % 6 = 3) | slow-unit |
| `Sherl\P{L}ock|Holmes` | fork | ascii (0x53 % 6 = 5) | slow-unit |
| `Script(?m)\P{L}_:._**` | fork | default (0x28 % 6 = 4) | timeout |

## Expected behaviour

Compilation of a small pattern completes in well under a second. The dotnet
reference compiles all these patterns instantly. On x86_64, `\P{L}2` compiles
in 162ms (still slow for a 6-character pattern, but not a timeout).

## Root cause

The derivative/minterm construction for Unicode property classes (`\p{L}`,
`\P{L}`) under the ARM64 compilation path has a much steeper cost curve than
the x86_64 AVX2 path. The v0.6.12 fix for BUG-11/17 (bracketed perl class
repeat compile blowup) addressed the `[\w]`-bracketed class case but did not
cover Unicode property classes, which take a different compilation path.

On ARM64, the property-class minterm enumeration appears to enumerate a much
larger state space than on x86_64. The NEON code path (`neon.rs`) is used at
match time, not compile time, so the nosimd variant exhibiting the same
defect confirms the issue is in the algebraic derivative construction
(`resharp-algebra`), not the NEON match path.

## Relationship to 06-04 campaign

This is the ARM64-specific face of **BUG-11/BUG-17** from the 2026-06-04
campaign. The root cause is the same (super-linear derivative/state
construction for large character classes), but the ARM64 path triggers it on
Unicode property class patterns that are fast (or at least much less slow)
on x86_64. The developer's claim that BUG-11/17 were fixed is partially
correct for x86_64 bracketed-perl-class patterns, but the underlying
super-linear cost remains for Unicode property classes and is amplified on
ARM64.

## Source location

The derivative construction is in `resharp-algebra/src/lib.rs`. The Unicode
property class expansion happens in the parser
(`resharp-parser/src/lib.rs`), which converts `\p{L}` to a large character
class that the algebra then processes. The minterm enumeration cost scales
with the size of this class.
