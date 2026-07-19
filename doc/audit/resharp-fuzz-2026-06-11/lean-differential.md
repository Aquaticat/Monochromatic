# Lean position-level differential (method and yield)

> Scratch-path note:
> `/tmp/agent` paths in this document are historical.
> Use `~/temp/agent` for current work.

The internal oracles (self-consistency,
 SIMD-on-vs-off,
 default-vs-hardened) can
only catch resharp disagreeing with ITSELF.
 They cannot catch resharp agreeing
with itself on a wrong answer.
 The Lean lane adds an external ground truth:
 the
Zhuchko/Veanes formalization of RE# (`~/Downloads/extended-regexes`,
 the
`Regex.MatchingAlgorithm` module),
 whose `llmatch` is the leftmost-longest first
match,
 the same thing rust's `find_all(w)[0]` returns.

## AST-first construction (removes parser-precedence risk)

A random RE# AST is serialized to BOTH targets from the same tree:

- fully-parenthesized RE# source for the rust crate (`to_re`),
- a Lean term over the formalization's notations for ground truth (`to_lean`).

Because both come from one AST,
 a parser-precedence mismatch cannot manufacture a
false divergence:
 the two engines are fed the same structure by construction.
Generator:
 `/tmp/agent/lean/gen_lean_ast.py`.
 Rust side:
 `leanrust/` (reads
`cases.tsv`,
 prints `R{idx} i:j` for `find_all` first span,
 stock engine,
 default
config).
 Lean side:
 `lake env lean` over `cases.lean`.
 Diff:
 `diff_lean.py`
buckets SPANDIFF / RUST_PHANTOM / RUST_MISS / RUST_PANIC,
 split by trust class.

## trust0 vs trust1 (translation faithfulness, NOT dotnet subset)

trust0 means the Lean term faithfully encodes the same pattern rust parsed,
 so a
divergence is a real rust-vs-formalization fault.
 trust1 means the translation
carries a known risk (context-dependent anchor semantics `^`/`$`/`\b`/`\B`,
 or
`\A`/`\z` inside a complement or lookbehind,
 or lookbehind-of-lookaround) and a
divergence needs the dotnet adjudicator before it counts.
 The classifier is
context-aware (`trust_walk`):
 bare `\A`/`\z` is trust0,
 the same anchor inside a
complement or lookbehind is trust1.
 This is ORTHOGONAL to the dotnet
supported-subset split in `dotnet-adjudication.md`:
 a pattern can be trust0
(faithful translation) yet out-of-subset (dotnet rejects it),
 e.g. a
lookaround-in-union whose Lean translation is exact.

## Yield

The broad seeded rounds (seed-1001,
 seed-3003,
 seed-4004) surfaced three root
causes the internal oracles could not reach,
 all trust0,
 all confirmed on the
unmodified stock crate and against Lean:

- bug-11 (case R1612):
   reverse pass proposes a null start the forward pass
  rejects;
   PANIC at `ldfa.rs:906`.
   Third distinct crash site.
- bug-12 (case R2280):
   `find_all` silently drops the leftmost match,
   no panic.
- bug-13 (case R48):
   intersection with an optional lookahead leaks the consuming
  width;
   span returned too long.

## Focus round (inter/neg/lookaround-biased, 3199 cases): no new root cause

A focused generation pass (the FOCUS flag biases the AST toward intersection,
complement,
 and lookaround,
 the constructs most likely to expose RE#-specific
faults) was run over 3199 cases (`focus.tsv` / `focus.out.txt` / `focus.rust.txt`
under `/tmp/agent/lean/`):

```txt
total=3199  agree=2067  rust_reject=1127
SPANDIFF     1   (trust0=0  trust1=1)
RUST_PHANTOM 2   (trust0=1  trust1=1)
RUST_MISS    2   (trust0=0  trust1=2)
RUST_PANIC   0
```

`RUST_PANIC=0`:
 the focused round found no new crash site (the three known sites
are bug-04,
 bug-05,
 bug-11).
 The single trust0 disagreement is R292,
`((\W|((?!c)))&((_&[acd])&a))` on `"a"`:
 Lean says no match,
 rust returns `0:1`.
That is bug-13 form B (a zero-width lookaround-in-union side `&`-intersected with
a consuming side;
 rust leaks the consuming span),
 not a new root cause.
 The other
four disagreements are trust1 (anchor or lookbehind translation risk) and require
the dotnet adjudicator,
 which rejects their patterns at compile.
 The 1127
`rust_reject` cases are patterns rust itself declined to compile.

Net:
 the focused Lean round,
 the generation pass most likely to expose a 14th
root cause,
 confirmed nothing beyond the documented 13.

## ARM

All three Lean-found findings reproduce byte-identically on aarch64 (Apple M1)
via the `armprobe` harness (stock engine,
 debug-assertions on);
 see the
Architecture note in each of `bug-11`,
 `bug-12`,
 `bug-13`.
 The faults live in the
scalar ldfa / forward / reverse paths,
 not in a SIMD path,
 so the ARM result
matches x86 exactly.
