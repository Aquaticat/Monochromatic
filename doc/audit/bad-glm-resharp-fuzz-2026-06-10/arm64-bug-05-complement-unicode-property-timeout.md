# ARM64-BUG-5 Complement of Unicode property class compile timeout

## Classification

- Type:
   performance,
   compile-time denial-of-service.
- Phase:
   compile time.
- Severity:
   complement `~(\p{L}iv>_*)` combined with trailing literal causes
  compile timeout on ARM64.

## Minimal reproducer

From fork-compile artifact `fork_compile_timeout-792f20210014a8fc0c7795b4457be0517890673f`:

```text
full_hex: 3c6469763e7e285c707b4c7d69763e5f2a29432f6469763e
option_byte: 0x3c -> config index 0 (default)
pattern: div>~(\p{L}iv>_*)C/div>
```

To reproduce:
```sh
cargo +nightly fuzz run compile <artifact> --fuzz-dir fuzz \
  --target aarch64-unknown-linux-gnu -- -timeout=10 -runs=1
```

## Root cause

The complement `~(...)` over a body containing `\p{L}` triggers the same
derivative blowup as ARM64-BUG-1.
 The complement negation requires computing
the full character class complement of the Unicode Letter set,
 which
materializes a very large minterm set.
 The `attempt_rw_union_2` rewrite
then recurses on this large set.

## Artifact

```text
/work/artifacts/fork-compile/fork_compile_timeout-792f20210014a8fc0c7795b4457be0517890673f
/work/artifacts/fork-compile/fork_compile_timeout-792f20210014a8fc0c7795b4457be0517890673f.txt
```
