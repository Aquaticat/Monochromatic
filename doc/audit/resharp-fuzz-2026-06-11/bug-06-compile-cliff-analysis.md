# bug-06 revisited: the \w{24} compile cost is one gated safety proof, not UTF-8

> Scratch-path note: `/tmp/agent` paths in this document are historical.
> Use `~/temp/agent` for current work.

Settles ieviev's claim on #21 ("the several seconds of compile time for full
UTF-8 support with \w{24} is to be expected",
issue comment 4685205872,
 2026-06-11).
 Verdict:
 not expected;
 it is a cliff
created by an optional acceleration's safety check,
 and the same engine
compiles bigger repeats of the same class an order of magnitude faster.

All numbers:
 release builds,
 x86-64 host,
 stock v0.6.12 (`3d4ddde`),
 fresh
process per measurement (process reuse distorts:
 an ascending in-process
sweep reproduced the old curve,
 fresh processes exposed the cliff).
Bench crate:
 `/tmp/agent/w24-bench`.

## The cliff (resharp, UnicodeMode::Full)

- `\w{1}` 209ms,
   `\w{8}` 517ms,
   `\w{16}` 938ms,
   `\w{24}` 1.51s,
   `\w{25}` 1.55s
- `\w{26}` 168ms,
   `\w{32}` 176ms,
   `\w{100}` 177ms,
   `\w{500}` 199ms
- `\w{0,500}` 130ms,
   `[0-9]{24}` 68µs

Linear-looking growth ends abruptly between 25 and 26.
 `\w` under Full has
max byte length 4,
 so `max_len` crosses 100 exactly there,
 and
`use_bounded` (`resharp-engine/src/lib.rs:1142`) requires `max_len <= 100`.

## Attribution (instrumented split + pprof)

With timing patches around the two bounded-path costs (patch applied and
reverted in the local clone,
 not committed):

- `BDFA::new`:
   0.7ms at n=24 (the bounded DFA itself is tiny;
   diag
  `bdfa_stats` showed 2 states for `\w{16}`).
- `bounded_safe_find_all` overlap-emptiness proof
  (`is_empty_lang` over `node ∩ (T+ node T+)`-shaped intersection,
  `lib.rs:1158`):
   395ms at n=8,
   916ms at n=16,
   1.45s at n=24,
   which is
  ~90% of total compile.

pprof (997Hz,
 in-process) on a fresh `\w{16}` Full compile agrees:
99.4% inclusive in `RegexBuilder::der`,
 81.5% in `is_empty_lang`,
72% `mk_ite`,
 64% `clean`;
 leaf time is hash-consing churn (34% memcpy,
TSet/TRegex equality,
 table probes).

The UTF-8 class expansion itself (parser,
 `Utf8Sequences` at
`resharp-parser/src/lib.rs:1187`) is not the cost:
 `[0-9]{24}` is 68µs and
the identical class at `\w{26}` compiles in 168ms total.

`bounded_safe_find_all == false` only routes `find_all` away from the
bounded accelerator;
 semantics are unchanged.
 So the entire "several
seconds" buys a 2-state optional accelerator whose safety proof has no work
budget.
 The author's own comment above `use_bounded` reads "lots of
conditions when something else is better.. possibly removing it entirely".

## Reference engines, same pattern

- rust-regex 1.
  x (byte-level UTF-8,
   full-Unicode `\w` by default):
  `\w{24}` 3.5ms,
   ~130µs marginal per repeat.
   Refutes "full UTF-8 in a
  byte-level engine implies seconds".
- resharp-dotnet (net10.0,
   JIT-warmed,
   podman):
   `\w{24}` 8.2ms,
  `\w{100}` 7.9ms,
   `\w{500}` 20.4ms. Same algorithm family,
   milliseconds.
- .
  NET `RegexOptions.NonBacktracking` (SRM lineage):
   `\w{24}` 1.8ms.

The defensible kernel of "expected":
 the ~170-200ms Full-mode floor that
every `\w{n}` pays (minterm/alphabet setup over the wide class) is a real
solver-approach cost vs rust-regex's milliseconds.
 "Several seconds" is not.

## Correction to our own #21 text (bug-06)

The filed text says the cost "reaches ~70s at the {0,500} repeat cap".
 That
was a linear extrapolation (0.14s × 500),
 not a measurement,
 and it is
wrong:
 `\w{0,500}` compiles in 130ms because the bounded path disengages
past max_len 100.
 The linear regime only exists inside n <= 25.
 The
correction is included in the draft reply
(`comment-bug06-compile-cliff.local.md`).

## Fix directions (any one kills the cliff)

- Give the overlap-emptiness check a work budget;
   on exceeding it,
   set
  `bounded_safe_find_all = false` (the safe fallback already exists).
- Or skip `use_bounded` when the body's class/minterm width is large.
- Or defer the proof to the first `find_all` call.
