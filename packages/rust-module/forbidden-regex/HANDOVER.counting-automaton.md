# Handover: forbidden-regex counting-automaton rebuild

The crate compiles, lints clean (`lint:rust`, `lint:clippy`), and all tests pass.
The counting back-end for linear patterns is built and the bounded-repetition
blowup is gone for them; intersection and complement still route to the eager DFA.
This file is the source of truth for resuming. Remaining work: layer `&`/`~` onto
the counting model, a counting-aware `RegexSet` gate, the `bench/` crate, and
differential tests vs `resharp`/`regex`.

## What this crate is

A restricted regular-expression engine for the `forbidden-strings` secret
scanner. It must support intersection (`&`) and complement (`~(...)`), which
forces a derivative-based core (NFA/backtracking cannot do those). It matches one
line as raw bytes and answers a boolean, and a whole ruleset is combined into one
`RegexSet`.

## Locked design decisions (from the requirements interview)

Do not relitigate these; they were settled with the user.

- Output: boolean `is_match` only (no offsets). `RegexSet` also reports which rule
  ids matched via `matches`.
- Character model: byte-oriented (`&[u8]`). Classes are 256-bit byte sets.
  `.` = any byte except `b'\n'`. Word set for `\b`/`\w` is ASCII `[A-Za-z0-9_]`.
- Semantics: unanchored search (match any substring). `^ $ \b` anchor to line and
  word boundaries.
- Flags: `multiline` and verbose (`x`) are always on; there is no flags argument.
  Verbose mode ignores unescaped whitespace (including newlines) outside classes,
  so one rule may span many lines. A line whose first character is `#` is a
  comment to end-of-line; a `#` elsewhere is literal. Whitespace and `#` inside
  `[...]` are literal.
- Grammar: operands of `&` and `|` must each be a single atom (a literal, a class,
  `.`, an anchor, a `(?:...)` group, or a `~(...)`). Concatenations and quantified
  atoms must be wrapped in `(?:...)` to be operands, so there is no operator
  precedence. `(?:a|b)` is valid; `(?:ab|cd)` and `\bX\b & ~(Y)` are rejected
  until wrapped. `~(...)` is always parenthesized.
- Supported constructs: `\t`, `[abc]`, `[a-z]`, `[a-zA-Z]`, `[^...]`, `.`,
  `(?:a|b)`, `a?`, `a{3}`, `a{3,6}`, `^`, `$`, `\b`, `&`, `~(...)`, and the
  shorthands `\d \w \s \D \W \S`.
- Strict rejection (`CompileError::Syntax`): `*`, `+`, unbounded `{n,}`, `\xNN`,
  capturing `(`, lookaround and inline flags (`(?` not followed by `:`),
  backreferences, unknown escapes, unbalanced brackets, stacked quantifiers, and
  `{n,m}` with `n > m`.
- Empty-matchable patterns are rejected at compile (`CompileError::EmptyMatchable`)
  because under unanchored search they would match every input.
- Serialization: serde derive plus bincode 1.x (`to_bytes` / `from_bytes`).
  `from_bytes` validates structure before the automaton is ever run.
- Package: `packages/rust-module/forbidden-regex/`, crate `forbidden_regex`,
  edition 2024. New `packages/rust-module/` category for Rust library crates.

## The problem that forced the rebuild

The first back-end compiled patterns to an eager byte-class DFA by desugaring
`{n,m}` into unrolled copies and determinizing. That is correct but explodes
exponentially in the repeat count whenever a pattern's literal prefix overlaps its
repeated class. Measured serialized sizes (release):

- `AKIA[A-Z]{2}` is 670 B, `{8}` is 3.7 KB, `{16}` is 72 KB (exponential).
- `xyzw[A-Z2-7]{16}` (disjoint prefix) is 1 KB; a pure literal is under 0.5 KB.
- A two-rule `RegexSet` already serialized to 1.8 MB.

This is the classic `.*X.{k}` DFA blowup, and AWS-style keys
(`AKIA[A-Z2-7]{16}`) are exactly that shape. Minimization (Moore, implemented)
does not help: those states are genuinely Myhill-Nerode-distinct because the
determinized automaton tracks the set of overlapping active counts.

## The chosen fix: counting automaton (DFA structure + counter registers)

User directive: "do NOT let DFA own the countings." Decision: the resharp/RE#
counting-set approach. Keep a small serializable automaton over byte-classes, but
represent `{n,m}` as a runtime counter register, never as unrolled states. The
overlapping active counts under unanchored search live in a counter-SET register
(updated per byte), not in the structural state, so the structural automaton stays
small and the count cannot blow it up.

Sketch of the target model:

- Structural states form a small DFA over byte-classes. A `Repeat{C, min, max}`
  region is one structural state with a self-loop on bytes in `C`.
- Each repeat owns a counter register holding the SET of active counts. On a byte
  in `C`: increment all counts (cap at `max`, drop above). On entry: add a fresh
  count. The exit transition to the continuation is guarded by
  `register ∩ [min, max] != ∅`.
- Acceptance is a structural accept plus any counter guards, and stays
  position-dependent (the 4-bit mask over `(word_after, line_end)` from the old
  table generalizes).
- `&`: run operands together; the gate accepts when both accept. `~(R)`: the
  complement targets in real rules are simple (fixed strings such as
  `AKIA2{16}` which is the literal "AKIA" then sixteen '2's), so determinize and
  complement that small, counter-free operand and run it alongside.

This is essentially reimplementing the counting core of RE#; build it
incrementally.

## Current code state

Front-end (done):

- `src/charset.rs`: `ByteSet` (256-bit) plus the shorthand sets and
  `is_word_byte`; now derives serde so a counting program can carry byte sets.
- `src/error.rs`: `CompileError`.
- `src/context.rs`: `Ctx` (line_start, line_end, word_before, word_after).
- `src/ast/node.rs`: `Node` algebra including `Repeat { node, min, max }`.
- `src/ast/smart.rs`: smart constructors; `repeat(node, min, max)` and `optional`.
- `src/parse/*`: cursor (verbose-mode skipping), escape, class, repeat (emits a
  `Repeat` node, no longer desugars), grammar, and `parse.rs` (empty-match guard).
- `src/nullable.rs`: handles `Repeat` (`min == 0 || nullable(body)`).
- `src/derivative.rs`: interim countdown derivative for `Repeat` (still used by the
  eager DFA path; correct but blows up, which is why linear patterns now skip it).
- `src/dfa/classes.rs`: `collect_sets` recurses into `Repeat`.

Back-ends:

- Counting back-end (DONE for linear patterns): `src/counting/element.rs`
  (`Element`, `LinearProgram`, `linearize`, `validate`) and `src/counting/run.rs`
  (the counting-set simulation; tests in `src/counting/run_tests.rs`). `linearize`
  returns `Some` only for a concatenation of classes, class repetitions, and
  anchors; everything else returns `None`. The simulation keeps each `{n,m}` count
  in a per-element `BTreeSet` (the counting set), seeds a fresh start at every
  boundary (the `Σ*` search prefix), and matches `is_match` exactly against the
  eager-DFA oracle. `AKIA[A-Z2-7]{16}` serializes to under 2 KB.
- Eager DFA (still used for `&`, `~`, alternation): `src/dfa/build.rs`,
  `src/dfa/table.rs` (`Dfa` table, match loop, `validate`), `src/dfa/minimize.rs`.
  The product-union gate (`src/dfa/union.rs`) and the `Dfa::step`/`start_state`/
  `accept_mask_of` helpers it used were REMOVED; a counting-aware gate replaces it.
- `src/engine.rs`: `Engine { Linear(LinearProgram), Table(Dfa) }` picks the
  back-end (`is_match`, `validate`).
- `src/regex.rs`: `Regex` wraps one `Engine`; `RegexSet` holds `Vec<Engine>` and
  iterates per-rule (no gate yet). `compile`, `new`, `from_ruleset`, `is_match`,
  `matches`, `to_bytes`, `from_bytes`. Public surface unchanged.

Tests (all green; `cargo nextest run` ~0.01s):

- `tests/integration.rs`: end-to-end (literals, anchors, classes/shorthands,
  repetition bounds, alternation/intersection/complement, empty-match rejection,
  `RegexSet` + serialize round-trip, `from_ruleset`).
- `src/counting/run_tests.rs`: differential vs the eager DFA oracle, the
  serialized-size proof, and exact `{16}` bound checks.

## How to work from here: TDD, debug builds

Difficulty is high, so go test-driven. Write a failing test for each counting
behavior, then implement.

- Use `cargo nextest` but with DEBUG builds for fast iteration. The existing
  `test` mise task is `cargo nextest run --release`; release LTO is slow. During
  this rebuild, add and use a debug task, for example in `mise.toml`:
  `[tasks."test:debug"]` running `cargo nextest run` (no `--release`). Run it via
  `mise run //packages/rust-module/forbidden-regex:test:debug`. Direct
  `cargo nextest run` in the package dir is acceptable for iteration here.
- Keep `cargo build` (debug) green at every step.
- Stage scoped pathspecs (`git commit packages/rust-module/forbidden-regex ...`),
  never `-A`/`.` (per AGENTS.md CLG). The `forbidden-strings` pre-commit hook,
  which would otherwise flag this crate's own test fixtures (AWS-style keys like
  `AKIA...`, rule 111) as secrets, is currently disabled repo-wide, so commits
  here need no `--no-verify`. If that hook is re-enabled, those fixtures are
  deliberate test inputs, not leaks, so bypass it for this package.
- Before declaring any milestone done: `mise run //packages/rust-module/forbidden-regex:lint:rust`
  (max-lines 300 per file, rustdoc on every item) and `:lint:clippy`.

TDD targets:

1. DONE. Front-end: `Repeat` flows through parser/nullable/derivative;
   `tests/integration.rs` green.
2. DONE (oracle is the eager DFA). The counting simulation is diffed against it in
   `run_tests.rs::linear_agrees_with_oracle`.
3. DONE. Counting back-end for linear `class{n,m}` under search; the size proof
   (`counted_key_stays_small`, under 2 KB) and exact-bound checks pass.
4. NEXT. Layer `&` and `~` onto the counting model. The hard constraint: under
   `Σ*·(A & B)` the SAME substring must satisfy both operands, so the operands
   cannot be run as independent search automata (that would match different spans).
   Run a synchronized product seeded jointly at every position: a counting
   simulation for the counting operand alongside a small DFA for the
   counter-free `~(...)` operand (the real complement targets are fixed strings
   like `AKIA2{16}`), accepting only when both accept at the same boundary.
5. `RegexSet` gate over counting automata without the product blowup (the removed
   `union.rs` did a product of per-rule DFAs and exploded). Likely a per-rule
   counting simulation run in parallel with an any-accept check, or a shared
   structural automaton with per-rule accept sets.

## Lint and style reminders specific to this crate

- 300 code-line budget per `.rs` (`monochromatic-rust-linter`); split into sibling
  modules, never disable. Comments do not count, so verbose docs are free.
- Rustdoc on every documentable item (`use`, fields, variants, impl blocks,
  modules, the file). Write the `What:`/`Why:` explainer as `///`; the documented
  fixture density (one to three lines) is enough.
- No recursion over flat input; recursion only over the node tree (structural).
- Functional style, `const`/immutable where reasonable.

## Verification end state (unchanged from the plan)

- Lint clean (`lint:rust`, `lint:clippy`), all nextest tests pass.
- `tests/integration.rs` crosses the crate boundary: build a `RegexSet`,
  serialize, reload via `from_bytes`, and match.
- Differential correctness vs `resharp`/`regex` in a throwaway worktree on the
  set-algebra rules.
- Throughput: a `bench/` (its own detached crate, kept off this crate's test
  graph) measuring lines/second on a pre-serialized `RegexSet` for
  `forbidden_regex` vs `regex` vs `resharp`.
