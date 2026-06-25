# forbidden-regex: further optimizations and speculation

Where the engine stands and where it can go next. The matcher beats the `regex` crate
on the honest real-repo throughput benchmark (~1.01 to 1.07x across runs on the x86
dev box; `gate-only` ~76M is robustly above regex's ~68 to 73M band). This doc records
the levers not yet pulled and speculates, explicitly as guesses, about the tricks the
maintainer has said they are holding in reserve.

See `HANDOVER.counting-automaton.md` for the architecture and the journey to the win.
The one-line model: there is a single per-line pass, the gate (SIMD literal prefilter,
then per-rule anchored or full checks on a hit), plus a near-free first-byte-gated
line-start check for the `^`-anchored marker rules. Beating regex came from deleting
the old second literal-free pass and then making the one pass leaner than regex's
combined lazy DFA.

## Concrete optimizations not yet done

Ranked by expected payoff for effort. Each is measurable against the existing bench.

### Combine the marker line-start rules into one DFA

Today each `^`-anchored marker rule is its own anchored DFA, checked in a loop when the
first byte clears the `line_start_first` set. There are two markers, so a candidate line
pays two engine calls. Combining them into one DFA over `^(?:markerA|markerB)` is one
call per candidate line and closes the small remaining `full` (~72M) versus `gate`
(~76M) gap, which makes the margin over regex less noise-sensitive. Low effort. The
only wrinkle is `matches` attribution: keep the per-rule engines for the rare
attribution path and add the combined engine only for the boolean `is_match`.

### Shrink the build, or the serialized matcher

Routing the non-anchorable rules to the eager DFA raised build and serialize from ~9s
to ~28s (the inner-keyword rules now determinize whole forward structures). It is under
the 60s budget, but it is the main cost left and it grows the serialized blob. Options:
only take the DFA route when the rule's gate seed is common enough that the on-hit
counting scan would dominate (selectivity is not known at build time, so this needs a
heuristic or a corpus sample), or lower the per-rule DFA cap for the fallback so a rule
that would build a large table stays on counting. Counting is build-fast but slow per
hit, so this is a direct build-time versus per-hit-speed trade.

### Cache-tighten the transition tables

`candidates` (prefilter plus aho-corasick, no per-rule work) runs ~94M while `gate`
(with per-rule checks) runs ~76M. Part of that gap is the large inner-keyword DFAs
thrashing cache on the lines their keyword hits. Narrowing state ids to `u16` where the
state count allows, or packing the byte-class transition rows, would shrink the working
set. The byte-class compression already exists; the win here is memory layout, not
algorithm.

### Intra-line skip with the prefilter

The SIMD prefilter already rejects whole non-matching lines. Inside a line that does
contain a seed, the gate still feeds every byte to the per-rule automaton from the hit.
A regex-style prefilter-driven skip (advance the automaton to the next candidate
position rather than stepping byte by byte) would cut work on long lines with sparse
hits. This is the technique regex leans on; matching it removes one of regex's
remaining advantages.

### Rare-byte fast path

The prefilter is a multi-literal Teddy scan. regex's single strongest heuristic is a
memchr for the one rarest byte of the pattern. A rare-byte pre-pass over the union of
every rule's rarest required byte could reject clean lines even faster than Teddy, since
the deny-list's required bytes are uncommon in ordinary source. Worth measuring against
the current `prefilter-only` ~160M ceiling.

### Remove the oracle scaffolding from the shipped matcher

`RegexSet.seedless_union` (the counting NFA over the original literal-free rules),
`debug_seedless`, the bench `seedless` bin, and the `csa-union-only` row exist only to
validate the fold. Once the fold is trusted, dropping the serialized `seedless_union`
shrinks the blob and the build. Keep the corpus-wide `seedless_union => is_match` oracle
as a test, not as a serialized field.

## Speculation on the reserved tricks

The maintainer has said they are holding additional tricks until after the fold, and
dropped these hints: many rules can be rewritten into a functionally identical but
faster-for-us form; a lot of `~(...)` is just a fixed string once desugared; and short
marker rules can be combined. The items below are this author's guesses at what those
could be, not statements of what the maintainer intends. They are starting points to
test, not a plan.

### Rule canonicalization at the porter or config layer

Rewrite each rule into the shape this engine gates best before it is compiled. Hoist the
rarest literal to the front so it becomes the leading seed (anchored at the hit beats a
full-line scan); factor shared literal prefixes across sibling rules so they collapse
into one automaton; normalize bounded gaps so a `{0,n}` before a keyword does not force
a counting back-end when the keyword alone is the real filter. The win is fewer, more
selective seeds and fewer rules in the gate.

### Desugaring `~(fixed)` instead of building a product

When the complement operand is a fixed string, `X & ~(lit)` is exactly X minus one
string. The shipped AWS rule is `(?:A3T|AKIA|...)[A-Z2-7]{16} & ~(AKIA2{16})`, that is,
the key shape excluding one documented placeholder. Rather than running a synchronized
product, match X and reject the single literal with a cheap equality or a negative
seed. If most `~(...)` operands desugar to fixed strings, the product back-end becomes
rare and the common path stays a plain DFA.

### A combined rare-byte reject for the whole ruleset

The deny-list is mostly absent from clean code, so the union of every rule's rarest
required byte is itself a rare set. One SIMD pass that rejects any line containing none
of those bytes would short-circuit almost every line before the gate even consults its
literals. This is the gate's prefilter taken to its logical end: one scan that answers
"could any rule match this line at all".

### Merging rules that share structure

Many ported credential rules share the `[\w.-]{0,50}keyword...value` skeleton with only
the keyword and value class differing. Compiling the shared skeleton once with the
keywords as an alternation, rather than as N near-identical rules, shrinks the gate's
pattern set and the per-rule check count. This is the rule-count analogue of the marker
combination the maintainer already did by hand.

### Profile-guided ordering and tiering

Order the per-rule checks by how often each seed actually hits, cheapest and rarest
first, so the common case exits early. A two-tier gate (a tiny rare-byte filter, then
the full Teddy plus aho-corasick only on survivors) would keep the hot path to a single
SIMD scan on the overwhelming majority of lines.

## SIMD opportunities

Today SIMD lives only in the prefilter (the `regex-automata` Teddy and `memchr`
scans). The hot per-byte automaton loops, the counting back-end, and the per-line
boundary checks are scalar. There is real headroom here, listed from most tractable to
most ambitious.

### Vectorized byte-class mapping in the DFA loop

The match loop does, per byte: load, map byte to class, index the transition row,
update state. The map step is a 256-entry table lookup. When a DFA has few classes (the
anchored and marker DFAs often have well under sixteen), the byte-to-class map fits a
`PSHUFB` / `tbl` shuffle, so sixteen or thirty-two bytes map to classes in one
instruction. The state stepping stays sequential because each state depends on the last,
but pre-mapping a chunk's classes ahead of the dependent walk hides the load latency.
Gate this on `nclasses <= 16` at build time and keep the scalar path otherwise.

### Bit-parallel counting back-end

The counting simulation already stores each counted position's live counts as a bitset
(`CountSet`), and the active-position set is a bitset too. Advancing all positions on a
byte is a set of shifts and masks, which is exactly what SIMD does well: hold the active
set and the per-counter sets in vector registers and advance every position in parallel
per byte, Glushkov / Hyperscan style. This vectorizes the one back-end that is currently
the slowest per byte (the counting `run` the oracle measures at ~0.8M), which matters if
any rule ever has to stay on counting rather than the DFA.

### Vertical SIMD across lines (a batch API)

The biggest throughput lever, and the biggest change. The scanner calls `is_match` one
line at a time, so each call is a scalar walk. A batch entry point that takes many lines
and runs the DFA on, say, sixteen lines at once, one line per SIMD lane, steps all lanes
per byte position and retires a lane when its line ends or accepts. Lines have uneven
length, so lanes finish at different times and need refilling, which is the hard part,
but this is how the highest-throughput scanners turn a sequential automaton into
data-parallel work. It would also amortize the line-start first-byte check and the
prefilter across the batch. This needs an `is_match_batch` on `RegexSet` and a scanner
that feeds it line blocks.

### A combined rare-byte SIMD reject

Covered above under the rare-byte fast path: one SIMD scan over the union of every
rule's rarest required byte, rejecting any line that contains none of them. This is pure
SIMD and rejects the overwhelming majority of clean lines before any automaton runs. It
is the cheapest SIMD win to try next after combining the marker DFAs.

### SWAR where vectors are not worth it

Short inputs (most scanner lines are tens of bytes) can lose to SIMD setup cost. For
those, SWAR (operating on `u64` lanes with ordinary integer ops) gives much of the
parallelism with no vector-register or feature-detection overhead, and stays portable
across the x86 dev box and the arm64 target without `cfg(target_feature)` fences. The
counting advance and the first-byte gating are natural SWAR candidates.

## What is deliberately not pursued

The all-rules single-pass counting-set automaton (an Aho-Corasick literal skeleton with
counter registers on the prefix-complete states) is the theoretical ceiling, one lookup
plus sparse counter work per byte, like regex's combined lazy DFA but eager and leaner.
It is a large build and is not needed now that the fold wins. It stays on the table only
if the cheaper levers above stop short on a harder ruleset or on slower hardware.
