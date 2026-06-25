# Handover: forbidden-regex counting-automaton rebuild

The crate compiles, lints clean (`lint:rust`, `lint:clippy`), and all tests pass.
The counting back-end is a Glushkov-style counting NFA (`CountingNfa`): it covers
concatenation, alternation, class repetition, and anchors, and intersection with
complement runs as a synchronized product of such NFAs. So the bounded-repetition
blowup is gone for plain patterns, alternation patterns, and `&`/`~` alike,
including the real AWS rule. Counts live in fixed-width bitsets and the byte step
reuses ping-pong buffers, so matching never allocates per byte. Only a repetition of
a non-class body (e.g. an optional group `(?:ab)?`) and nested set algebra inside an
operand still route to the eager DFA. This file is the source of truth for resuming.

## Throughput status: 0.55x of regex on the real-repo corpus (was 0.20x)

Honest stable bench (16 threads; forbidden-regex SHARED across threads because it is
immutable, regex CLONED per-thread so its lazy-DFA cache scales not contends; both
deployed at their best is the fair comparison). Corpus = EVERY non-gitignored line in
this repo (~747k lines) via `ignore::WalkBuilder`, the same walk the real scanner uses
(`bench/src/corpus.rs`). Ruleset = the shipped rules, ported to our dialect
(`bench/src/port.rs` + `normalize.rs`), compile-filtered to ~251 rules both engines
accept. Build+serialize ~9s (budget 60s).

- forbidden-regex: ~39M lines/s. regex: ~73M lines/s. Ratio ~0.55x.
- This is STABLE across runs, NOT noise. regex got FASTER when the ruleset was
  cleaned (combining marker rules shrank its automaton) and on the full clean-code
  corpus (its prefilter skips clean lines in one pass).

Per-line profile (`prefilter_only` / `candidates` / `anchored_only` / `gate_only` /
`seedless_only` hooks on `RegexSet`, surfaced in the bench):

- prefilter-only (regex-automata SIMD literal prefilter): ~159M (faster than regex).
- anchored-only (gate path, counting-fallback rules skipped): ~95M.
- gate-only (prefilter + per-rule anchored/counting checks on hits): ~80M.
- seedless-only (2 union DFAs over the literal-free rules): ~75M.
- full = gate + seedless run as TWO passes per line: ~39M.

### What got us from 0.20x to 0.55x (all committed)

1. Seedless grouping (`src/group.rs`): the literal-free rules collapse into a few
   union DFAs (greedy, cap-bounded) instead of N scalar scans. 2 groups at cap 6000.
2. SIMD gate (`src/gate.rs`): `regex_automata::util::prefilter::Prefilter` for the
   negative-line fast reject; aho-corasick only maps a hit back to rules.
3. Anchored DFA fast-check: a seeded rule whose seed is its LEADING literal compiles
   to a bare (no-`Σ*`) anchored DFA, run at the gate's hit position instead of the slow
   counting/product sim. `leading_seeds` (gate on the leading literal so the hit
   position is the rule start); `anchored_engine`; `RegexSet.anchored: Vec<Option<Engine>>`;
   gate passes the hit position to `matches_rule`.
4. Leading-literal extension (`prefilter.rs::concat_leading`): extend a leading
   alternation by the mandatory bytes after it, so `(?:sk|rk)_(?:test|live|prod)_...`
   gates on `sk_`/`rk_` (rare, anchorable) not inner `test`/`live`/`prod` (common).
5. DFA-safe routing (`regex.rs`): a non-anchorable seeded rule with only small
   repetitions (`max_repeat <= 3`, e.g. the line-anchored marker alternations) routes
   to the fast eager DFA, not counting.
6. Bench: combined the ~109 shortcode-label marker rules in
   `forbidden-strings.append.txt` into two `^(?:CODE|...):` alternation rules (one fast
   automaton each, not 109 counting rules); porter keeps a leading `^` (line-start
   anchor) and strips a class-repeat nested after a leading `(?:` group.

### Why two passes cannot beat regex, and the one-pass path

`full = 1/(1/gate + 1/seedless)`. seedless is pinned at ~75M: the 2 union DFAs cannot
merge into one (the `{n,m}` overlap blows the eager DFA past any cap; measured at cap
60000 it still needs 2 groups). With seedless fixed at ~75M, NO gate value crosses
regex's ~73M. Both maxed (gate->~95M, seedless->~75M) caps at ~48M. The only way past
is ONE automaton over ALL rules, one lookup/byte, like regex's combined lazy DFA.

### CsA finding (read before building): seedless-only CsA is the WRONG target

The literal-free (seedless) rules are counters AT THE START (`\d{15,16}`, `[..]{32}`,
plus one `^`-anchored marker rule). There is no literal-prefix skeleton to
determinize, so a counting-set automaton over them does per-counter register work
every byte (~5 ops) while the current unrolled 2-group DFAs do 2 table lookups; the
CsA likely REGRESSES seedless (the cache-tightness of a small structural table MIGHT
win, which is why the user said build-and-measure rather than trust this analysis).

The real one-pass win is a CsA over ALL rules: the seeded rules' literal prefixes form
an Aho-Corasick skeleton (one structural lookup/byte) with counter registers hung off
the prefix-complete states for the counted value parts. On clean code that is ~1
lookup + sparse counter ops/byte, matching regex's one combined pass. `&`/`~` rules
(few) can stay anchored/gated outside the CsA. This is the major build.

### NEXT (user-directed): build the seedless CsA and MEASURE it anyway

User decision: build the seedless CsA, benchmark against the 2 DFAs (do not trust the
"it regresses" analysis), then decide. Build as `src/counting/csa.rs`, oracle-gated:
differential-test `is_match` against the counting-NFA `run` (the trusted oracle, see
`run_tests.rs`) over the seedless union on a probe grid; only wire it into `RegexSet`
(replacing the seedless group DFAs) if it AGREES with the oracle (no missed secrets,
this is security-critical) AND beats the 2 DFAs. The seedless union has multiple
counters and one `^`-anchored member; the simplest correct route is to determinize the
anchor-free seedless rules into the CsA and leave the `^`-anchored marker rule on its
small DFA. Determinization keeps counts in `CountSet` registers and branches
transitions on the runtime exit guard (`CountSet::has_at_least(min)`); enumerate the
guard outcomes per transition (few in-scope counters, so few combos). The user is
holding additional tricks until after the CsA.

### Constraints (do not violate)

- Immutable / `Send + Sync`: NO per-thread mutable state for our engine (the bench
  shares one instance across threads; regex is cloned per-thread). A lazy DFA with a
  per-thread cache is therefore disallowed; the CsA must be eager (built at compile,
  serialized).
- Win requirement: beat regex on this bench, on this machine and `ssh m1`, when
  neither is under heavy load. Quiet-system regex is ~73M on the full corpus.
- Build+serialize <= 60s. Bench is hard-bounded (10s/engine, bounded parity sample).
- The forbidden-strings pre-commit hook is TEMPORARILY DISABLED repo-wide; AKIA-style
  fixtures in the corpus are deliberate, not real secrets.

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

- Leaf and bitset: `src/counting/element.rs` holds `Element` (the position kinds
  `Class`, `Counted`, `LineStart`, `LineEnd`, `WordBoundary`) and `validate_element`.
  Counts live in `src/counting/countset.rs` (`CountSet`): a fixed-width bitset
  indexed by count (`bit i` set means count `i` is live), sized to the element's
  `max`. Entry is a bit-or, the exit guard a shift-and-test, and a matched byte
  advances every live count at once with one multi-word left shift.
- Shared simulation core: `src/counting/sim.rs` holds `State` (active positions
  `0..=len`, where `len` is the virtual accept, plus per-position count bitsets),
  `closure`, `step_into` (fills a reused destination, no allocation), and
  `boundary_ctx`. It walks follow sets, not an implicit chain, so it serves any NFA.
- Counting NFA (DONE): `src/counting/nfa.rs` (`CountingNfa { elements, follow,
  start }`, `is_match`, `validate`) and `src/counting/build.rs` (`build_nfa`, a
  Glushkov first/last/follow walk; tests in `src/counting/run_tests.rs`). Covers
  concatenation, alternation, class repetition, and anchors; returns `None` for
  intersection, complement, `Top`, or a repetition of a non-class body. The search
  in `src/counting/run.rs` ping-pongs two `State` buffers and re-seeds `start` every
  boundary (the `Σ*` prefix). `AKIA[A-Z2-7]{16}` is under 2 KB.
- Synchronized-product back-end (DONE): `src/counting/product.rs` (`ProductProgram`,
  `build_product`, `validate`; tests in `src/counting/product_tests.rs`). A
  `Node::Inter` whose operands each `build_nfa` splits into positives (must match the
  same span) and negatives (the `~(...)` operands, none may match that span). One
  thread per start runs every operand NFA in lockstep over the same bytes, so the
  same-span set algebra holds; each thread reuses a spare buffer side, pruned in
  place via `retain_mut`. The real AWS rule
  `(?:\b(?:(?:A3T[A-Z0-9])|(?:AKIA)|(?:ASIA))[A-Z2-7]{16}\b) & ~(AKIA2{16})` is under
  4 KB and decides keys exactly per prefix branch.
- Eager DFA (still used for a repetition of a non-class body, e.g. an optional group
  `(?:ab)?`, and nested set algebra inside an operand): `src/dfa/build.rs`,
  `src/dfa/table.rs` (`Dfa` table, match loop, `validate`), `src/dfa/minimize.rs`.
  The product-union gate (`src/dfa/union.rs`) and the `Dfa::step`/`start_state`/
  `accept_mask_of` helpers it used were REMOVED; a counting-aware gate replaces it.
- `src/engine.rs`: `Engine { Nfa(CountingNfa), Product(ProductProgram), Table(Dfa) }`
  picks the back-end (`is_match`, `validate`).
- `src/regex.rs`: `Regex` wraps one `Engine`; `RegexSet` holds `Vec<Engine>` and
  iterates per-rule (no gate yet). `build_engine` tries `build_nfa`, then
  `build_product`, then the eager DFA. `compile`, `new`, `from_ruleset`, `is_match`,
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
4. DONE (linear operands). `&` and `~` are layered onto the counting model via the
   synchronized product in `src/counting/product.rs`. The hard constraint held:
   under `Σ*·(A & B)` the SAME substring must satisfy both operands, so the operands
   are not run as independent search automata (that would match different spans);
   instead one thread per start runs every operand in lockstep and accepts only when
   all positives and no negatives accept at the same boundary.
   `product_tests.rs::product_agrees_with_oracle` diffs it against the eager DFA.
5. DONE. The operand IR is a counting NFA (`build_nfa`), so alternation costs only
   follow edges and the real AWS rule
   `(?:\b(?:(?:A3T[A-Z0-9])|(?:AKIA)|(?:ASIA))[A-Z2-7]{16}\b) & ~(AKIA2{16})` leaves
   the eager DFA (`product_tests.rs::aws_rule_with_alternation_stays_small`, under
   4 KB). Standalone alternation patterns are diffed against the oracle in
   `run_tests.rs::linear_agrees_with_oracle`. Note the grammar requires each `&`/`|`
   operand to be a single atom, so every multi-character alternation branch must be
   wrapped: `(?:(?:AKIA)|(?:ASIA))`, not `(?:AKIA|ASIA)`. A repetition of a non-class
   body (an optional group `(?:ab)?`, `(?:ab){2,4}`) is the remaining shape that
   `build_nfa` rejects; it routes to the eager DFA. To lift that, `build_repeat`
   would unroll a small-bound non-class body into fresh position copies (mandatory
   copies for `min`, optional copies up to `max`), falling back to the eager DFA when
   the bound is large; the counter-set trick does not apply to a multi-position body.
6. NEXT. `RegexSet` gate over counting automata without the product blowup (the
   removed `union.rs` did a product of per-rule DFAs and exploded). `RegexSet` today
   holds `Vec<Engine>` and iterates per rule, which is already correct and
   blowup-free; the open question is whether a shared structural automaton with
   per-rule accept sets beats the per-rule loop on throughput. Measure before
   building: the per-rule loop may already win, in which case this is just the bench.

## Lint and style reminders specific to this crate

- 300 code-line budget per `.rs` (`monochromatic-rust-linter`); split into sibling
  modules, never disable. Comments do not count, so verbose docs are free.
- Rustdoc on every documentable item (`use`, fields, variants, impl blocks,
  modules, the file). Write the `What:`/`Why:` explainer as `///`; the documented
  fixture density (one to three lines) is enough.
- No recursion over flat input; recursion only over the node tree (structural).
- Functional style, `const`/immutable where reasonable.

## Benchmark scope and target hardware

The throughput goal is narrow and explicit: beat the `regex` crate on the bench
sidecar (`packages/rust-module/forbidden-regex.bench`), on two machines, measured
only when each is otherwise idle. We do NOT need to beat `regex` universally.

- This machine: AMD Ryzen 8700F, 64 GB RAM.
- `ssh m1`: Apple M1, 16 GB RAM.
- Both CPUs have many hardware threads, and the bench is only meaningful when the
  machine is not under heavy load. Many threads plus the immutable, `Send + Sync`
  `RegexSet` (no `Mutex`, unlike resharp) mean a parallel scan is a legitimate lever;
  a fair bench parallelizes both engines, so threading alone does not move the ratio.
- `resharp` is deferred indefinitely as a baseline: its serialized matcher is too
  slow to be a useful comparison. Bench only against `regex`.
- The bench loads the real shipped ruleset (`forbidden-strings.local.example.txt`
  plus `forbidden-strings.append.txt`), ports each rule into this dialect, and
  compile-filters to the subset both engines accept; our scanner gets the `&`/`~`
  versions, `regex` gets the complement-stripped positives. Each engine is timed for
  a fixed wall-clock budget (10 s) and reported in lines/s and MB/s.

## Verification end state (unchanged from the plan)

- Lint clean (`lint:rust`, `lint:clippy`), all nextest tests pass.
- `tests/integration.rs` crosses the crate boundary: build a `RegexSet`,
  serialize, reload via `from_bytes`, and match.
- Differential correctness vs `regex` in a throwaway worktree on the plain rules
  (set-algebra rules have no `regex` equivalent).
- Throughput: the `bench/` sidecar measuring lines/second on a pre-serialized
  `RegexSet` for `forbidden_regex` vs `regex`, beating `regex` on both machines.
