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

## Throughput status: BEAT regex on BOTH arches (x86 ~1.31x, arm64/m1 ~1.16-1.22x)

Latest: x86 dev box ~1.31x (full ~93M vs regex ~71M), Apple m1 arm64 (hot,
back-to-back) ~1.16 to 1.22x (full ~51-56M vs regex ~44-46M, win holds at the most
throttled run). Two late tricks got here from the 1.07x single-pass fold:

1. DFA aho-corasick kind for the gate's which-rule matcher (`gate.rs`): the default NFA
   chases failure links per byte on every flagged line, a hidden scalar bottleneck on
   BOTH arches and the reason arm lost before. DFA-kind is one lookup per byte (x86
   candidates 90->118M, full 72->87M, 1.07->1.25x; arm full 41->53M, flipping the loss
   to a win). This was the decisive cross-arch fix.
2. Dedup non-anchored gate checks + skip their redundant prefilter (`regex.rs`,
   `engine.rs`): a non-anchored rule's whole-line check ignores the hit position, so it
   runs once per line via a stack-only `CheckedFull` 256-bit set even when its seed
   recurs; and the gate already proved the seed present, so `matches_only` skips the
   engine's own prefilter rescan. x86 1.25->1.31x, arm 1.16->1.22x.

The historical milestones below trace the journey from 0.20x. Larger remaining levers
(cache-tighten the transition tables to u16 states, the all-rules combined automaton)
are DEFERRED until after fuzzing + mutation testing are set up (in progress, see
`packages/fuzz/forbidden-regex` and the mutation task), so the risky CsA build lands on
a hardened test suite.

## Correctness infrastructure (fuzzing + mutation testing) — IN PROGRESS

Being set up BEFORE the larger builds (cache-tighten, all-rules CsA) so the risky CsA
lands on a hardened suite. User-directed order: fuzzing + mutation testing first.

Fuzzing (`packages/fuzz/forbidden-regex`, mirrors `packages/fuzz/forbidden-strings`,
cargo-fuzz / libFuzzer, nightly from the repo-root toolchain):
- `fuzz_compile`: arbitrary bytes as pattern + ruleset; compile/`compile_lenient` must
  reject, never panic or hang.
- `fuzz_from_bytes`: arbitrary bytes through `Regex`/`RegexSet::from_bytes`; a decoded
  automaton that passes `validate` must run without OOB/panic (the security boundary).
- `fuzz_roundtrip`: a generated valid pattern compiled -> `to_bytes` -> `from_bytes`
  must give the SAME verdict on the generated content (serialization preserves meaning).
- `fuzz_differential`: a generated NON-algebra pattern vs `regex::bytes` with
  `unicode(false)` (so `\d \w \s \b` are ASCII like ours) on single-line content; byte
  verdicts must agree.
- Structured generator in `src/generators.rs` (`PatternAndContent`, bounded depth/
  repeat, records `uses_algebra` so the differential skips `&`/`~`).
- mise tasks mirror the sibling: `list`, `build`, `smoke` (30s each, ASAN), `run`.
- STATUS: targets written; need to build + smoke-run + triage findings. The differential
  may surface benign semantic gaps (verbose/whitespace, anchors) to skip, or real bugs.

Mutation testing (cargo-mutants on the engine crate):
- MUST run inside a Podman container: mutation testing compiles and runs MUTATED code,
  i.e. arbitrary/unpredictable code, which must not execute on the host (host-safety,
  not just resource isolation). cargo-mutants is not yet installed (the repo's existing
  `packages/dev-script/mutation-test` is Stryker for TypeScript, not Rust).
- Plan: `cargo install cargo-mutants` available inside the container image; a mise task
  runs `cargo mutants` in `podman run` over the engine crate; surviving mutants reveal
  weak tests; add tests to kill them.
- STATUS: not started.

## Earlier status: 1.07x of regex on the real-repo corpus (BEAT regex; was 0.20x)

Honest stable bench (16 threads; forbidden-regex SHARED across threads because it is
immutable, regex CLONED per-thread so its lazy-DFA cache scales not contends; both
deployed at their best is the fair comparison). Corpus = EVERY non-gitignored line in
this repo (~747k lines) via `ignore::WalkBuilder`, the same walk the real scanner uses
(`bench/src/corpus.rs`). Ruleset = the shipped rules, ported to our dialect
(`bench/src/port.rs` + `normalize.rs`), compile-filtered to ~251 rules both engines
accept. Build+serialize ~28s (budget 60s; the non-anchorable rules now build DFAs).

- forbidden-regex: ~72M lines/s. regex: ~68-73M lines/s (noisy). Ratio ~1.07x on the
  winning run; gate-only ~76M is robustly above regex's range. Confirm robustness with
  repeated runs (regex noise band is ~67-73M; full must stay above it).

The win came from collapsing the TWO-pass design (gate + a second literal-free pass,
which capped at ~39M) into ONE gate pass, then making that pass faster than regex.

Per-line profile (`prefilter_only` / `candidates` / `anchored_only` / `gate_only` /
`seedless_only` / `csa_union_only` hooks on `RegexSet`, surfaced in the bench):

- prefilter-only (regex-automata SIMD literal prefilter): ~160M (faster than regex).
- candidates (prefilter + aho-corasick enumeration, no per-rule check): ~94M.
- anchored-only (gate, counting-fallback rules skipped): ~92M.
- gate-only (the one real pass: prefilter + per-rule checks): ~76M.
- full (gate + the near-free line-start first-byte reject): ~72M.
- seedless-only: empty (every literal-free rule folded into the gate).
- csa-union-only: ~0.8M (the counting union, kept only as the fold's oracle).

### What got us from 0.55x to 1.07x: the single-pass fold (all committed)

The seedless second pass was the whole gap (gate alone already beat regex). Folding
all literal-free rules into the one gate pass, then three perf fixes, crossed regex.
See the "fold" section below for the full account; in short: weak/leading/line-start
seeds put every rule in the gate; non-anchorable rules use the eager DFA (not the slow
counting NFA) for their on-hit full-line check; the DFA match loop early-exits on the
dead sink; and the line-start marker checks are skipped by a first-byte set.

### Cross-arch: WIN on both (the arm loss was the AC NFA, now fixed)

The arm loss was diagnosed and FIXED. Diagnosis (m1 profile, before the fix):
prefilter-only 95M (2.08x regex, our SIMD prefilter wins on arm), but candidates 49M
(the aho-corasick `find_overlapping` NFA walk ate the whole lead, a 95->49 cliff),
gate-only 38M, full 41M (0.90x, LOSE). The scalar AC failure-link walk on every flagged
line was the bottleneck (worst on arm, but it cost ~15M on x86 too). Fix: force the DFA
aho-corasick kind (one lookup per byte). After: m1 candidates 66-75M, gate 46-50M, full
49-53M, 1.11-1.16x (WIN, hot, across 3 back-to-back runs); x86 candidates 118M, full
87M, 1.25x. So the same trick fixed both arches.

Methodology note: m1 is not sufficiently cooled, so keep it maximally HOT (no cooldown
between runs) and read the back-to-back ratio, which is stable (~1.11-1.16x) even as
absolute throughput throttles down over consecutive runs. The m1 clone is at
`/Volumes/MacData/Monochromatic-bench` (cloned from origin, which the auto-pushing `git`
wrapper keeps current, including FORCE pushes; m1's own `git` is stock `/usr/bin/git`,
updated with `git fetch --depth 1 origin main && git reset --hard origin/main`).

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

### CsA finding (MEASURED, settled): a seedless second pass cannot win, at all

Built and measured a single counting NFA over the union of all 5 seedless rules
(`RegexSet.seedless_union`, `csa_only_is_match` hook, corpus-wide oracle check in the
bench). Result: the union pass is 0.82M lines/s (90x SLOWER than the 75M DFA groups),
and it agreed with the DFA groups on all 747479 corpus lines (correct, just slow). The
46-position union is dominated by the per-byte closure over the `^`-anchored marker
rule's ~25 literal positions.

The determinized CsA would remove the closure-recompute but not the per-byte counter
work, so at absolute best it MATCHES the DFA groups (a DFA is 1 lookup/byte; a CsA is 1
lookup + counter ops/byte). And that ceiling is irrelevant, because the arithmetic
forbids ANY second-pass win: with the measured gate at 82M and
`full = 1/(1/gate + 1/seedless)`, beating regex (72M) needs
`1/seedless < 1/72 - 1/82 = 0.001694`, i.e. seedless > 590M lines/s (~15.8 GB/s). No
byte-scanning automaton reaches that (the SIMD literal prefilter, which only SKIPS,
peaks at 5.6 GB/s; a real per-byte DFA tops ~3 GB/s). So the seedless CsA is a
dead end for the goal, and so is a single union DFA, and so is any second pass.

### The winning lever (DONE): fold every literal-free rule into the ONE gate pass

The gate path alone (the seeded rules with the SIMD prefilter) already ran at ~82M,
above regex. The entire deficit was the second literal-free pass. Folding every
literal-free rule into the single gate pass (`src/build.rs`, `route_rule`/`fold_seedless`)
deleted that pass; three perf fixes then made the one pass faster than regex. The 5
literal-free rules and how each folds in (signals measured by `rg` over the repo):

- azure `[delim][..]{3}\dQ~[..]{31,34}`: gated on required inner literal `Q~` (8 lines);
  no leading literal, so the full rule engine runs on a hit. `seeds_from_node_min(.,1)`.
- SK `SK[hex]{32}`: leading `SK` (393 lines) -> anchored-at-hit. `leading_seeds_min(.,2)`.
- vault `(hvs\.[..]{90,120})|(s\.[..]{24})`: leading `hvs.`/`s.` (35650) -> anchored-at-hit.
- facebook `\d{15,16}(\||%)[..]{27,40}`: gated on its 1-char `|`/`%` (~8000 lines), full
  DFA on a hit. `WEAK_INNER_SEED_LEN = 1` (only literal-free rules reach this floor).
- RULE_A `^(?:INF|...):` and RULE_B `^(?:PR|...)[0-9]:`: `^`-anchored deny-code markers.
  Routed to a LINE-START check (`route_rule` handles `starts_with_line_anchor` FIRST,
  before seeds), gated by a first-byte set so the check is skipped on almost every line.

The three fixes that made `full = gate'` clear regex (all in the perf commit
"beat regex on the bench"):

1. Non-anchorable rules build the eager DFA (`build_table_kind`, fallback to counting on
   blowup), not the counting NFA. Their engine runs over the whole line on every hit, and
   the inner-keyword rules hit common keywords; a per-byte DFA beats the counting scan.
   Gate 70M -> 75M. Cost: build+serialize 9s -> 28s (the inner-keyword DFAs).
2. `Dfa::is_match` early-exits on the dead sink (`Dfa::dead`, found at build, validated on
   decode so a hostile blob cannot name an accepting state dead). Without it every
   anchored/line-start check walked the whole line after dying. Full 47M -> 66M.
3. Line-start first-byte reject: `RegexSet.line_start_first: ByteSet` (rebuilt in
   `prepare`, via `Dfa::mark_first_bytes`) is the union of the markers' possible first
   bytes; `line_start_candidate` skips the anchored marker checks unless `line[0]` is in
   it. The markers begin almost no lines, so this is near-free. Full 68M -> 72M.

Oracle (kept): `RegexSet.seedless_union` is the counting NFA over the original 5
literal-free rules; the bench asserts `seedless_union.is_match(line) => is_match(line)`
on all 747k lines (no literal-free match missed). The 246 seeded rules are unchanged by
construction (adding other rules' seeds to the shared gate never changes a rule's own
check). Parity vs regex stays 15/15 on the sample.

### Still in the tree (cleanup candidates)

- `RegexSet.seedless_union` + `csa_only_is_match` + `seedless_union_size`: now only the
  fold's oracle (serialized, ~adds to size). Keep while validating, or drop once settled.
- `forbidden_regex::debug_seedless` (doc-hidden) + bench `bin/seedless.rs`: one-shot
  diagnostics for the literal-free shapes. Removable.
- bench `csa-union-only` row: measures the oracle pass (0.8M), not a real path.

### If more headroom is wanted (not required; we already win)

- Combine the two marker line-start DFAs into one engine (one call instead of two on a
  first-byte candidate line). Closes the small remaining `full` (72M) vs `gate` (76M) gap.
- The all-rules single-pass CsA (AC literal skeleton + counter registers on prefix-complete
  states) remains the theoretical ceiling, but is unneeded now. The user is holding
  additional tricks for further gains.

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
