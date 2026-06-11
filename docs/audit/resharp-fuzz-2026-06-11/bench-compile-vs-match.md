<!--
This document uses HTML <table> elements for every numeric grid, by explicit
precedent (docs/decisions/zstd-cli-to-node-zlib.md), overriding the repo's
usual MD5 "no markdown tables" convention. The data is dense and tabular;
HTML tables render it far more legibly than nested lists or code fences.
This is a deliberate, documented exception.
-->

# resharp vs the regex crate: compile time, match time, and where the budget should sit

Benchmarks settling the open questions on [ieviev/resharp#21][i21]:

- ieviev (comment 4685383860): "perhaps i just need to adjust the upper limit of which patterns use
  the left-to-right matching path, bdfa.rs is much more expensive state space wise ... how long of a
  compile time should be acceptable with default config?"
- ieviev (comment 4685434957): "also bear in mind regex crate pays for it in match time, while RE#
  pays compile time only. regex turns very slow with large `\w` patterns"

Measured fresh at upstream main `c1b3b87` (v0.6.12 plus the merged PR #20 `find_all` fix, committed
2026-06-11) against `regex` 1.12.4 (`regex-automata` 0.4.14), on x86-64 (AVX2) and Apple Silicon
M1 (NEON). The decision-relevant conclusions, in order of weight:

1. ieviev's match-time claim is **confirmed strongly** at default config: the regex crate either
   refuses large `\w` repeats (`CompiledTooBig` from `\w{256}` up) or collapses at match time
   (`\w{100}`: 0.45 s to 3.6 s per 8 MiB pass, 14x to 152x slower than resharp; `\w{500}` with the
   size cap raised: ~19.5 s, ~600x). The collapse is lazy-DFA cache thrash, fixable with a
   non-default `dfa_size_limit` (256 MiB restores 25 ms passes) but real out of the box.
2. "RE# pays compile time only" is **false on non-ASCII input**: resharp Full `\w{26}`..`\w{500}`
   each spend **27 s to 50 s of lazy-DFA construction on the first `find_all` over an 8 MiB
   multilingual haystack** (warm passes after that: ~45 ms). The bounded left-to-right path that
   protects n <= 25 (`\w{24}` cold-multilingual: 24 ms) is exactly the path ieviev is considering
   shrinking; the data says shrinking it makes this worse.
3. The compile cliff is one unbudgeted safety proof, priced precisely below: `\w{24}` Full costs
   1.51 s and **503 MiB** to compile; `\w{26}` costs 176 ms and 49 MiB. The cliff tracks
   class byte-width, not `\w` (it appears for `\p{L}`, `[\w\s]`, `\W`; not for `\d`, `\s`,
   `[a-f0-9]`), and it is **entirely absent in `UnicodeMode::Ascii`** (`\w{24}` Ascii: 160 µs).
4. At real-tree scale, a 259-rule secret scanner's startup goes from 10 ms (regex) to 4.2 s under
   **resharp's default config** (`UnicodeMode::Default`), but **that gap is mostly the Unicode mode,
   not the engine**: resharp in `UnicodeMode::Ascii` (correct for ASCII secret tokens) starts in
   86 ms (~6x regex) and scans the Linux kernel in 6.0 s / 0.40 GB, vs Default's 12.3 s / **4.95 GB**.
   The engine's true sole-use cost is ~6x at load and ~3x at scan; the rest is Default mode making
   `\w` a wide 2-byte class. Behind a literal prefilter the engine is invisible at scan time and only
   load differs.
5. The concrete budget answer is in [the recommendation](#the-answer-how-long-of-a-compile-time-is-acceptable):
   **a ~200 ms per-pattern ceiling, enforced structurally**, plus the observation that any compile
   budget is meaningless unless first-match determinization is budgeted too.

## Head-to-head: the disputed pattern family

`\w{n}` under full Unicode, fresh process per measurement, x86-64. Compile is
`Regex::new`/`with_options`; match is over 8 MiB.

<table>
  <thead>
    <tr><th>Aspect</th><th>regex 1.12.4 (default)</th><th>resharp c1b3b87 (Full)</th></tr>
  </thead>
  <tbody>
    <tr><td>compile <code>\w{24}</code></td><td>5.1 ms, 7 MiB RSS</td><td>1 511 ms, 503 MiB RSS</td></tr>
    <tr><td>compile <code>\w{26}</code></td><td>5.5 ms</td><td>176 ms, 49 MiB RSS</td></tr>
    <tr><td>compile <code>\w{500}</code></td><td>refused: <code>CompiledTooBig</code> after 68 ms</td><td>203 ms, 47 MiB RSS</td></tr>
    <tr><td>compile <code>\w{24}</code>, Ascii mode</td><td>n/a</td><td>160 µs</td></tr>
    <tr><td>match <code>\w{24}</code>, 8 MiB dense ASCII (warm)</td><td>12.0 ms</td><td>16.3 ms</td></tr>
    <tr><td>match <code>\w{100}</code>, 8 MiB dense ASCII (warm)</td><td><b>3 640 ms</b></td><td>31.4 ms</td></tr>
    <tr><td>match <code>\w{500}</code>, 8 MiB dense ASCII (warm)</td><td><b>19 435 ms</b> (size cap raised)</td><td>33.3 ms</td></tr>
    <tr><td>first match <code>\w{24}</code>, 8 MiB multilingual</td><td>12.2 ms</td><td>24.3 ms (bounded path)</td></tr>
    <tr><td>first match <code>\w{26}</code>, 8 MiB multilingual</td><td>12.8 ms</td><td><b>27 309 ms</b> (then 49 ms warm)</td></tr>
    <tr><td>first match <code>\w{500}</code>, 8 MiB multilingual</td><td>n/a (refused)</td><td><b>49 564 ms</b> (then 50 ms warm)</td></tr>
  </tbody>
</table>

Neither engine escapes the underlying state space (full-Unicode `\w` times a large bounded repeat
is a huge automaton). They bill it differently: regex caps compiled size and degrades the lazy DFA
(or refuses); resharp pays an eager compile-time proof for n <= 25, and defers an unbudgeted
determinization to first-match for n >= 26 on inputs that exercise the wide class.

## Environment

<table>
  <tbody>
    <tr><th>x86-64 host</th><td>AMD Ryzen 7 8700F (8c/16t, up to 5.06 GHz), 62 GiB RAM, Fedora 44, Linux 7.0.9, governor "performance"</td></tr>
    <tr><th>arm64 host</th><td>Apple M1 (8 cores), macOS 26.5.1; exercises resharp's NEON SIMD paths</td></tr>
    <tr><th>rustc</th><td>1.98.0-nightly (x86 6bdf43094 / arm cb46fbb8c)</td></tr>
    <tr><th>resharp</th><td>upstream main <code>c1b3b87788c89bbeb1c8be53a849902d28433747</code> (v0.6.12 + PR #20), path dep, <code>diag</code> feature</td></tr>
    <tr><th>regex</th><td>1.12.4 (regex-automata 0.4.14, regex-syntax 0.8.11, aho-corasick 1.1.4)</td></tr>
    <tr><th>profile</th><td>release, <code>debug = true</code> for symbols</td></tr>
  </tbody>
</table>

## Methodology

- **Fresh process per compile measurement** (5 invocations each). Process reuse distorts resharp
  numbers via interned algebra state; an in-process ascending sweep smooths over the cliff that
  fresh processes expose.
- **Engines.** `regex` = `regex::bytes::Regex::new` (defaults: `size_limit` 10 MiB,
  `dfa_size_limit` 2 MiB). `regex-big` = `size_limit(1<<30)`. `regex-bigdfa` = also
  `dfa_size_limit(1<<28)`. `regex-ascii` = `unicode(false)`. resharp engines map to
  `UnicodeMode::{Full,Default,Ascii,Javascript}`, with optional `.hardened(true)` and
  `.unbounded_size(true)`, and a `max_dfa_capacity` override for the cache sweep.
- **Haystacks**, 8 MiB each, deterministic (fixed-seed LCG, byte-identical across machines):
  `ascii_text`, `ascii_long` (30-60-char identifier runs), `run1k` (1000-char word runs),
  `adv23`/`adv499` (runs of 23 / 499 word chars: zero matches for `\w{24}` / `\w{500}`),
  `uni_mixed` (45% ASCII words, 25% CJK 3-byte runs, 15% Cyrillic, punctuation), `nonword`. Plus
  Twain (Gutenberg #74+#76 to 8 MiB) and 9.9 MiB of real Rust source for corpus/feature suites.
- **Match timing**: compile once, then 4 timed `find_all` passes; pass 1 = "cold" (includes
  lazy-DFA construction), median of the rest = "warm".
- **Count parity** as a correctness check on every match cell: all 35 main-grid cells agree exactly
  between engines, as do the A/B/C scanner findings at full scale.
- Peak RSS via `/usr/bin/time -v`, fresh process.

## Compile time

Fresh process, mean of 5 runs, x86-64. "REFUSED" = `CompiledTooBig`.

<table>
  <thead>
    <tr><th>Pattern</th><th>regex (default)</th><th>regex-big</th><th>resharp Default</th><th>resharp Full</th><th>resharp Ascii</th></tr>
  </thead>
  <tbody>
    <tr><td><code>\w{8}</code></td><td>1.9 ms</td><td>-</td><td>4.7 ms</td><td>528 ms</td><td>120 µs</td></tr>
    <tr><td><code>\w{16}</code></td><td>3.5 ms</td><td>-</td><td>9.0 ms</td><td>968 ms</td><td>148 µs</td></tr>
    <tr><td><code>\w{24}</code></td><td>5.1 ms</td><td>5.0 ms</td><td>13.6 ms</td><td><b>1 512 ms</b></td><td>160 µs</td></tr>
    <tr><td><code>\w{25}</code></td><td>5.5 ms</td><td>-</td><td>14.0 ms</td><td>1 562 ms</td><td>156 µs</td></tr>
    <tr><td><code>\w{26}</code></td><td>5.5 ms</td><td>-</td><td>14.3 ms</td><td>176 ms</td><td>146 µs</td></tr>
    <tr><td><code>\w{48}</code></td><td>9.9 ms</td><td>-</td><td>27.8 ms</td><td>177 ms</td><td>203 µs</td></tr>
    <tr><td><code>\w{64}</code></td><td>13.3 ms</td><td>-</td><td>1.7 ms</td><td>176 ms</td><td>261 µs</td></tr>
    <tr><td><code>\w{100}</code></td><td>20.3 ms</td><td>19.9 ms</td><td>1.9 ms</td><td>184 ms</td><td>471 µs</td></tr>
    <tr><td><code>\w{256}</code></td><td>42 ms REFUSED</td><td>50 ms</td><td>2.3 ms</td><td>188 ms</td><td>373 µs</td></tr>
    <tr><td><code>\w{500}</code></td><td>68 ms REFUSED</td><td>98 ms</td><td>2.8 ms</td><td>203 ms</td><td>702 µs</td></tr>
    <tr><td><code>\w{0,500}</code></td><td>67 ms REFUSED</td><td>99 ms</td><td>15.1 ms</td><td>123 ms</td><td>529 µs</td></tr>
    <tr><td><code>[0-9]{24}</code></td><td>152 µs</td><td>-</td><td>132 µs</td><td>128 µs</td><td>146 µs</td></tr>
    <tr><td><code>[a-f0-9]{64}</code></td><td>93 µs</td><td>-</td><td>229 µs</td><td>245 µs</td><td>256 µs</td></tr>
  </tbody>
</table>

- **The resharp Full cliff sits at the bounded-path gate.** `\w` under Full has max byte length 4,
  and `use_bounded` requires `max_len <= 100`, so n = 25 (4 x 25 = 100) is the last bounded repeat:
  1.56 s, then n = 26 drops to 176 ms. resharp Default (2-byte `\w`) has the same cliff scaled by
  byte length: it flips between n = 48 (27.8 ms) and n = 64 (1.7 ms).
- **`UnicodeMode::Ascii` eliminates the cliff** (`\w{24}` = 160 µs, flat across all n). So does
  `Javascript` mode (`\w` stays ASCII). The cliff is a wide-Unicode-class phenomenon only.
- **The regex crate enforces its compile budget structurally**: at most ~67 ms before refusing;
  per-repeat slope ~0.13 ms.
- **Peak RSS**: regex `\w{24}` 7 MiB, regex-big `\w{500}` 70 MiB; resharp Full `\w{24}` **503 MiB**,
  `\w{26}` 49 MiB; resharp Ascii / narrow ASCII classes under 4 MiB.

### The cliff tracks class byte-width, not `\w`

resharp Full compile, n = 24, x86-64:

<table>
  <thead><tr><th>Class</th><th>Full</th><th>Default</th><th>Note</th></tr></thead>
  <tbody>
    <tr><td><code>\w{24}</code></td><td>1 539 ms</td><td>14.6 ms</td><td>wide in Full (3-4 byte word chars)</td></tr>
    <tr><td><code>\W{24}</code></td><td>1 655 ms</td><td>9.8 ms</td><td>negated word: very wide in Full</td></tr>
    <tr><td><code>\p{L}{24}</code></td><td>1 179 ms</td><td>1 162 ms</td><td>all Unicode letters: wide regardless of mode</td></tr>
    <tr><td><code>[\w\s]{24}</code></td><td>1 527 ms</td><td>1 528 ms</td><td>wide union</td></tr>
    <tr><td><code>\p{Lu}{24}</code></td><td>13 ms</td><td>12.6 ms</td><td>uppercase letters: narrower</td></tr>
    <tr><td><code>\d{24}</code></td><td>2 ms</td><td>0.2 ms</td><td>narrow</td></tr>
    <tr><td><code>\s{24}</code></td><td>1 ms</td><td>0.2 ms</td><td>narrow</td></tr>
    <tr><td><code>(?i)[a-z]{24}</code></td><td>1 ms</td><td>1 ms</td><td>ASCII</td></tr>
    <tr><td><code>.{24}</code></td><td>3 ms</td><td>0.2 ms</td><td>codepoint step, not a class expansion</td></tr>
  </tbody>
</table>

The trigger is the number of distinct byte-sequences the class admits combined with the bounded
repeat, not the `\w` spelling. `\p{L}` hits the cliff even in Default mode, confirming it is about
class width rather than `UnicodeMode`.

## Match time

Warm = median of passes 2-4; cold = pass 1. Counts agreed exactly between engines. `\w{500}` rows
use regex-big (default refuses).

### Where both engines are fine (n <= 26)

<table>
  <thead><tr><th>Pattern</th><th>Haystack</th><th>regex warm</th><th>resharp warm</th><th>regex cold</th><th>resharp cold</th></tr></thead>
  <tbody>
    <tr><td><code>\w{24}</code></td><td>ascii_long</td><td>15.0 ms</td><td>16.6 ms</td><td>15.2 ms</td><td>19.6 ms</td></tr>
    <tr><td><code>\w{24}</code></td><td>run1k</td><td>12.0 ms</td><td>16.3 ms</td><td>12.1 ms</td><td>19.3 ms</td></tr>
    <tr><td><code>\w{24}</code></td><td>uni_mixed</td><td>12.2 ms</td><td>16.3 ms</td><td>13.6 ms</td><td>24.3 ms</td></tr>
    <tr><td><code>\w{26}</code></td><td>run1k</td><td>11.4 ms</td><td>25.2 ms</td><td>11.7 ms</td><td>116.6 ms</td></tr>
    <tr><td><code>\w{26}</code></td><td>uni_mixed</td><td>11.9 ms</td><td>45.6 ms</td><td>12.8 ms</td><td><b>26.0 s</b></td></tr>
  </tbody>
</table>

Warm, the two engines are within 2x on every n <= 26 cell. The stories are in the cold column (the
`\w{26}` uni_mixed cell is 26 s) and below.

### Where the regex crate collapses (n >= 100): claim confirmed

<table>
  <thead><tr><th>Pattern</th><th>Haystack</th><th>regex warm</th><th>resharp warm</th><th>ratio</th></tr></thead>
  <tbody>
    <tr><td><code>\w{100}</code></td><td>ascii_text</td><td>446 ms</td><td>11.8 ms</td><td>38x</td></tr>
    <tr><td><code>\w{100}</code></td><td>ascii_long</td><td>1.82 s</td><td>12.0 ms</td><td>152x</td></tr>
    <tr><td><code>\w{100}</code></td><td>run1k</td><td>3.64 s</td><td>31.4 ms</td><td>116x</td></tr>
    <tr><td><code>\w{100}</code></td><td>adv499</td><td>3.60 s</td><td>28.7 ms</td><td>125x</td></tr>
    <tr><td><code>\w{500}</code> (big)</td><td>run1k</td><td>19.4 s</td><td>33.3 ms</td><td>584x</td></tr>
    <tr><td><code>\w{500}</code> (big)</td><td>adv499</td><td>19.7 s</td><td>14.1 ms</td><td>1 396x</td></tr>
  </tbody>
</table>

Steady-state (cold and warm within noise). The mechanism is lazy-DFA cache exhaustion: with
`dfa_size_limit` raised to 256 MiB (`regex-bigdfa`), `\w{100}` on run1k drops from 3.64 s to
**24.9 ms** and `\w{500}` to **26.9 ms**, slightly faster than resharp. So the collapse is a
default-cache-budget artifact (fix: a non-default knob plus 256 MiB of cache), not anything
fundamental to byte-level engines.

### Where resharp's "compile only" breaks: first match on multilingual input

resharp Full, `find_all` over 8 MiB `uni_mixed`:

<table>
  <thead><tr><th>Pattern</th><th>compile</th><th>first pass</th><th>warm</th><th>regex (default) warm, same haystack</th></tr></thead>
  <tbody>
    <tr><td><code>\w{24}</code> (bounded path)</td><td>1 512 ms</td><td>24.3 ms</td><td>16.3 ms</td><td>12.2 ms</td></tr>
    <tr><td><code>\w{26}</code></td><td>176 ms</td><td>27.3 s</td><td>49 ms</td><td>11.9 ms</td></tr>
    <tr><td><code>\w{100}</code></td><td>184 ms</td><td>43.4 s</td><td>54 ms</td><td>1.27 s</td></tr>
    <tr><td><code>\w{500}</code></td><td>203 ms</td><td>49.6 s</td><td>50 ms</td><td>n/a (refused)</td></tr>
  </tbody>
</table>

The bill that n <= 25 pays eagerly at compile time moves, for n >= 26, to the first `find_all` that
feeds 3-4-byte word characters to the lazy right-to-left DFA, and grows ~20x there. ASCII-only
input never triggers it (`\w{26}` cold on ascii_long: 105 ms), making it a production landmine: a
service that compiles and runs fine on English traffic stalls for half a minute on its first CJK
document, holding the `Mutex<RegexInner>` that serializes lazy-DFA growth so concurrent callers
queue behind it.

**The cold cliff saturates** (it is a one-time automaton-construction tax, not throughput).
`\w{26}` Full first pass over `uni_mixed` at increasing size: 1 MiB 26.6 s, 2 MiB 27.4 s, 4 MiB
28.0 s, 8 MiB 28.0 s, 16 MiB 27.2 s. It is fully paid by ~1 MiB of multilingual input.

This is the crux of "adjust the upper limit of the left-to-right path": at these shapes the bounded
path is the *better* matcher (16.3 ms vs 25.2 ms warm on run1k at the n=25/26 boundary; **24 ms vs
27 s cold on multilingual**), and its BDFA is 2 states. Shrinking the path's reach so `\w{24}` skips
it trades a visible 1.5 s compile for the hidden 27 s first-match cliff (measured directly below).

## Pricing the fix options

Each option ieviev is weighing, measured by patching the scratch clone (patch applied, measured,
reverted to `c1b3b87`; the clone is clean).

### Option P1: skip the overlap-emptiness proof (`bounded_safe_find_all = false`)

Setting the proof result to a constant `false`:

<table>
  <thead><tr><th>Metric</th><th>stock</th><th>P1 (skip proof)</th></tr></thead>
  <tbody>
    <tr><td>compile <code>\w{8..25}</code> Full</td><td>0.5 s to 1.56 s (rising)</td><td><b>flat ~180 ms</b> (cliff gone)</td></tr>
    <tr><td>compile <code>\w{24}</code></td><td>1 512 ms</td><td>176 ms</td></tr>
    <tr><td><code>\w{24}</code> cold match, uni_mixed</td><td>24 ms (accelerator on)</td><td><b>25.8 s</b> (accelerator off)</td></tr>
    <tr><td><code>\w{24}</code> warm match, run1k</td><td>16.3 ms</td><td>25.4 ms</td></tr>
  </tbody>
</table>

P1 confirms the proof **is** the entire compile cliff, and reveals the proof is not waste: when it
succeeds it enables the bounded accelerator that makes `\w{24}` match in 24 ms instead of 25.8 s on
multilingual input. Skipping it unconditionally drags the 27 s cold cliff down to n <= 25. So
"fall back to false on a budget" is not free; on the patterns where the proof would have succeeded,
it forfeits the accelerator and inherits the first-match cliff. The real fix is making the
**normal-path lazy-DFA construction** not cost 27 s, which is what the accelerator is papering over.

### Option P2: raise the `max_len <= 100` gate

Raising it to 200 (admitting `\w` up to n = 50 under Full):

<table>
  <thead><tr><th>Pattern</th><th>stock compile</th><th>P2 compile (gate 200)</th></tr></thead>
  <tbody>
    <tr><td><code>\w{24}</code></td><td>1 512 ms</td><td>1 579 ms</td></tr>
    <tr><td><code>\w{32}</code></td><td>175 ms</td><td>1 970 ms</td></tr>
    <tr><td><code>\w{48}</code></td><td>177 ms</td><td>3 170 ms</td></tr>
    <tr><td><code>\w{50}</code></td><td>176 ms</td><td>3 300 ms</td></tr>
    <tr><td><code>\w{51}</code></td><td>176 ms</td><td>180 ms (gate disengages)</td></tr>
  </tbody>
</table>

Raising the gate extends the bounded path's protection to larger n but moves the cliff to the new
boundary at a proportionally higher cost (3.3 s at n = 50). The proof cost scales with the admitted
repeat count.

### Option P3: cap the lazy-DFA cache (`max_dfa_capacity`)

Sweeping the cap against the `\w{26}` multilingual cold cliff:

<table>
  <thead><tr><th>max_dfa_capacity</th><th>first pass</th><th>result</th></tr></thead>
  <tbody>
    <tr><td>256</td><td>26 ms</td><td><code>CapacityExceeded</code> error (rule unusable on this input)</td></tr>
    <tr><td>1 024</td><td>102 ms</td><td><code>CapacityExceeded</code></td></tr>
    <tr><td>4 096</td><td>461 ms</td><td><code>CapacityExceeded</code></td></tr>
    <tr><td>16 384</td><td>4 642 ms</td><td><code>CapacityExceeded</code></td></tr>
    <tr><td>65 535 (default)</td><td>30 183 ms</td><td>matches (38 122 hits)</td></tr>
  </tbody>
</table>

Capping the cache low enough to be fast converts the 30 s stall into a hard `CapacityExceeded`
error: the rule cannot match wide-Unicode content at any cap small enough to be quick. The cap
trades stall-time for capability, it does not buy a fast correct match.

### Option P4 (user-side): `UnicodeMode::Ascii`

Not an engine change, but the cleanest mitigation when the consumer does not need Unicode word
characters: `\w{24}` compiles in 160 µs (vs 1.51 s), and the whole 268-rule secret corpus compiles
in **24.5 ms** (regex-ascii) / **77.6 ms** (resharp-ascii) vs 1.96 s / 5.85 s in Unicode mode. The
trade is semantics (ASCII `\w` does not match non-Latin word characters).

### Hardened mode is the wrong lever

`UnicodeMode::Full` with `.hardened(true)` does **not** avoid either cliff (compile `\w{24}` still
1 753 ms; `\w{26}` multilingual cold still 28.7 s) and is much slower at match on adversarial
repeats (`\w{100}` adv499 warm: 1 720 ms vs 28 ms). Hardened is an O(N·S) match-time safety mode,
orthogonal to the compile question.

## Realistic consumer corpus: betterleaks secret-scanning rules

268 rules from [betterleaks][bl]'s default config (the dataset shipped with this repo's
`forbidden-strings` scanner), resharp metacharacters escaped the way the port script does. Caveats:
these rules were ported defensively (no set algebra) because of past resharp fragility, so they
exercise resharp only on regex-shaped patterns; and much of what a betterleaks rule *means*
(stopword/allowlist filters, `required` co-occurrence) is deliberately not in the regex, because
mainstream engines cannot express conjunction and negation in one pattern.

### Compile, all 268 rules, 3 runs, x86-64

<table>
  <thead><tr><th>Engine / mode</th><th>Total wall</th><th>Accepted</th><th>Refused</th><th>Mean / rule</th></tr></thead>
  <tbody>
    <tr><td>regex-ascii</td><td><b>24.5 ms</b></td><td>268</td><td>0</td><td>0.09 ms</td></tr>
    <tr><td>regex (default, Unicode)</td><td>1.67 s</td><td>265</td><td>3 (CompiledTooBig)</td><td>6.3 ms</td></tr>
    <tr><td>resharp-ascii</td><td><b>77.6 ms</b></td><td>135</td><td>133</td><td>0.6 ms</td></tr>
    <tr><td>resharp Default</td><td>2.93 s</td><td>135</td><td>133</td><td>21.7 ms</td></tr>
    <tr><td>resharp Full</td><td>6.69 s</td><td>135</td><td>133</td><td>49.5 ms</td></tr>
  </tbody>
</table>

- regex refuses 3 rules at default config, all real vendor large-`\w` repeats
  (`pypi-AgEIcHlwaS5vcmc[\w-]{50,1000}`, `\b(hvb\.[\w-]{138,300})...`, a generic keyword rule). The
  disputed pattern shape ships in production rulesets.
- resharp refuses 133: 129 lazy quantifiers (`{0,50}?`, unsupported by design), 3
  `Algebra(UnsupportedPattern)`, 1 over its own `{,500}` cap. A scanner adopting resharp as its only
  engine loses half this corpus as written.
- The slowest resharp Full rules (~200-440 ms) are the wide-class bounded repeats; ASCII-class
  rules compile in hundreds of µs.

### Match, 9.9 MiB of real Rust source (134-rule subset both engines accept), warm

<table>
  <thead><tr><th>Engine</th><th>Warm pass</th><th>Shape</th></tr></thead>
  <tbody>
    <tr><td>regex (default)</td><td><b>314 ms</b></td><td>one suffix-literal-only rule costs 275 ms; the other 133 ~0.3 ms (literal prefilter)</td></tr>
    <tr><td>resharp Default</td><td>1.33 s</td><td>flat ~10 ms/rule, no literal acceleration</td></tr>
    <tr><td>resharp Full</td><td>1.34 s</td><td>flat ~10-17 ms/rule</td></tr>
  </tbody>
</table>

Two engine-level lessons: the regex crate's literal prefilter (Teddy/memmem) is worth ~40x on
prefix-anchored secret rules and degrades sharply when the only literal is a suffix; resharp scans
every byte for every rule. The production scanner fronts both engines with aho-corasick, so the
engine only matters for residual non-prefilterable rules. For completeness, regex over its full 265
accepted rules takes **85.8 s warm** on the same corpus, dominated by the
`(?i)[\w.-]{0,50}?keyword...` rules resharp refuses, which run ~100x slower than the rest combined
under regex; neither engine handles that family well.

## End-to-end scanner: A / B / C over Monochromatic and the Linux kernel

Four `forbidden-strings` variants on the same 259-rule ported ruleset, isolating engine choice at
real-tree scale. A = production mixed routing (regex crate for plain rules, resharp only for the 4
`BASE&~(E)` set-algebra rules). B = regex crate as sole engine, with those 4 rules decomposed in
user space (find base spans, drop any matching an excluded placeholder shape). C-Default = resharp
as sole engine in its **default `UnicodeMode::Default`** (2-byte `\w`). C-Ascii = resharp as sole
engine in `UnicodeMode::Ascii` (1-byte `\w`), the semantically correct mode for ASCII secret
tokens. **Findings are identical across A / B / C-Ascii** at full scale, exactly (both ASCII `\w`);
C-Default differs only in that its 2-byte `\w` would match non-Latin word characters the ASCII
corpora never contain.

<table>
  <thead><tr><th>Workload</th><th>A (mixed, prod)</th><th>B (all-regex)</th><th>C-Ascii (resharp, Ascii)</th><th>C-Default (resharp, default config)</th></tr></thead>
  <tbody>
    <tr><td>cold start (ruleset load)</td><td>10.1 ms</td><td>13.6 ms</td><td>85.6 ms</td><td><b>4 234 ms</b></td></tr>
    <tr><td>Monochromatic <code>--all</code></td><td>76.8 ms</td><td>76.5 ms</td><td>187 ms</td><td>5 441 ms</td></tr>
    <tr><td>Linux kernel <code>--all</code> (88 k files)</td><td>1.88 s</td><td>2.03 s</td><td>5.95 s</td><td>12.31 s</td></tr>
    <tr><td>kernel peak RSS</td><td>439 MiB</td><td>428 MiB</td><td>397 MiB</td><td><b>4 951 MiB</b></td></tr>
    <tr><td>ruleset coverage (rules compiled)</td><td>259/259</td><td>259/259</td><td>258/259</td><td>258/259</td></tr>
  </tbody>
</table>

**The headline gap is mostly Unicode mode, not engine.** Decomposing the cold start with the same
binary, env-forced, on the identical 259-rule ruleset:

<table>
  <thead><tr><th>Config</th><th>cold start</th><th>factor</th><th>what it isolates</th></tr></thead>
  <tbody>
    <tr><td>regex crate (ASCII-first, = A/B path)</td><td>14.2 ms</td><td>baseline</td><td>-</td></tr>
    <tr><td>resharp Ascii</td><td>85.6 ms</td><td>6x</td><td>the engine cost (same ASCII semantics)</td></tr>
    <tr><td>resharp Default (default config)</td><td>4 140 ms</td><td>48x more</td><td>the Unicode-mode cost (2-byte <code>\w</code> hits the wide-class compile cliff)</td></tr>
  </tbody>
</table>

- **Engine choice is invisible at scan time behind the literal prefilter** (A == B on Monochromatic,
  76.8 vs 76.5 ms); the engine's true sole-use cost is ~6x at load and ~3x at scan (C-Ascii vs
  A/B), which is real but not prohibitive.
- **C-Default's 4.2 s startup and 4.95 GiB kernel peak are the Unicode mode, not the engine.**
  Switching to Ascii mode (correct for ASCII secret tokens) brings startup to 86 ms and kernel RSS
  to 397 MiB, in line with regex. The betterleaks rules trip Default mode because they carry `\w`
  repeats (`[\w=\.-]{32,64}`, `\w{82}`, ...) that become wide 2-byte classes; in Ascii mode those
  are 1-byte and the compile cliff disappears. This is exactly ieviev's lever: whether
  `UnicodeMode::Default` should pay the wide-class compile eagerly, and whether Default (rather than
  Ascii) is the right library default for the common ASCII case. The 4.2 s legitimately answers his
  literal "default config" question, but reads as a mode choice, not engine overhead.
- **B is viable but lossy in expressiveness**: routing the `BASE&~(E)` rules verbatim to the regex
  crate compiles (it reads `&~(` as literal bytes) but silently changes semantics and loses the
  detection; a correct B must decompose those rules into base-find + host-side exclusion, exactly
  what betterleaks/gitleaks do. C expresses them in one pattern but cannot compile the pypi rule.

## resharp-native features: what the compile budget buys

Patterns the regex crate cannot express in one pattern, vs the decompositions a regex-crate user
writes (multiple patterns + host logic). Compile for every feature pattern is 108-722 µs under
resharp Full (ASCII classes plus algebra; no wide-Unicode class), except the lookbehind case at
~120 ms (it contains `\w`). So set algebra is cheap to compile; wide Unicode classes are what cost,
with or without algebra.

<table>
  <thead><tr><th>Task</th><th>resharp (one pass) warm</th><th>regex decomposition warm</th><th>note</th></tr></thead>
  <tbody>
    <tr><td>lines with Tom AND Sawyer</td><td>10.4 ms</td><td>3.9 ms</td><td>regex prefilter wins on literal anchors</td></tr>
    <tr><td>lines with Tom, NOT Sawyer</td><td>13.7 ms</td><td>3.9 ms</td><td>both correct</td></tr>
    <tr><td>password-policy token</td><td>32.3 ms</td><td>9.1 ms</td><td>decomposition <b>overcounts by 1 054</b>: not equivalent</td></tr>
    <tr><td>40-char base64 span containing a digit</td><td>15.3 ms</td><td>17.5 ms</td><td>resharp wins (no literal to prefilter)</td></tr>
    <tr><td>hex secret w/ stopword negation, dense corpus</td><td>53 ms</td><td>23.3 ms</td><td>exact agreement (128 297 hits)</td></tr>
  </tbody>
</table>

A split decision on speed (literal-anchored: regex prefilter wins 2-4x; class-shaped with no
literal: the single resharp pattern wins), but the single pattern buys *semantics*: the
password-policy decomposition is wrong (a line containing an 8-char token, a digit somewhere, and an
uppercase somewhere is not a token satisfying the policy), and the stopword-negation rule needs no
host-side filter pass. That is the half of the betterleaks architecture (scanner-side filters,
`required` co-occurrence) that exists only because mainstream engines lack conjunction and negation.

## ARM (Apple M1, NEON paths)

The structure is architecture-independent; absolute times ~20% faster than x86.

<table>
  <thead><tr><th>Measurement</th><th>x86-64</th><th>Apple M1</th></tr></thead>
  <tbody>
    <tr><td>resharp Full compile <code>\w{24}</code></td><td>1 512 ms</td><td>1 240 ms</td></tr>
    <tr><td>resharp Full compile <code>\w{26}</code></td><td>176 ms</td><td>142 ms</td></tr>
    <tr><td>regex compile <code>\w{500}</code></td><td>refused</td><td>refused</td></tr>
    <tr><td>resharp Full <code>\w{26}</code> multilingual cold</td><td>27.3 s</td><td>22.7 s</td></tr>
    <tr><td>resharp Full <code>\w{100}</code> multilingual cold</td><td>43.4 s</td><td>36.7 s</td></tr>
    <tr><td>betterleaks corpus compile, resharp Full</td><td>6.69 s</td><td>5.85 s</td></tr>
    <tr><td>betterleaks corpus compile, regex-ascii</td><td>24.5 ms</td><td>24.5 ms</td></tr>
  </tbody>
</table>

The same gate cliff, the same regex refusals, and the same multilingual first-match cliff reproduce
on NEON.

## The answer: how long of a compile time is acceptable

1. **The reference the ecosystem sets.** At default config the regex crate compiles typical rules
   in 0.1-6 ms, the worst accepted pattern in this campaign in ~67 ms, and *refuses* rather than
   stalls. resharp is already inside "not too much slower than regex" everywhere except
   wide-Unicode bounded repeats: ASCII classes at parity (µs), ordinary rules at ~8x (tens of ms),
   the Full-mode wide-class floor at ~120-200 ms.

2. **A concrete default budget: ~200 ms per pattern, enforced structurally.** 200 ms is resharp's
   own Full-mode floor for any `\w`-bearing pattern, so it is achievable today by construction;
   everything above it (the 1.5 s / 503 MiB proof) guards an optional accelerator. Like
   `CompiledTooBig`, the budget must be enforced by counting construction work and bailing, not by
   a per-shape heuristic: the proof cost is invisible to any shape heuristic (`[a-f0-9]{64}` at
   245 µs vs `\w{24}` at 1.5 s, both bounded-path).

3. **Whatever the number, it must cover first-match too.** Moving work out of `Regex::new` does not
   discharge the budget: the n >= 26 patterns compile in 176 ms and then spend 27-50 s inside the
   first `find_all` on multilingual input, 20x the bill they avoided, behind a mutex, saturating by
   1 MiB of input. A compile budget paired with an unbudgeted lazy determinizer just relocates the
   stall to production. (The regex crate's compile budget is honest only because its lazy DFA
   degrades gracefully instead of stalling.)

4. **On "adjust the upper limit of the left-to-right path": budget the proof, do not shrink the
   path.** P1 shows the path's accelerator is what protects n <= 25 from the 27 s first-match cliff
   (24 ms vs 25.8 s); P2 shows raising the gate extends that protection at proportional cost (3.3 s
   at n = 50); P3 shows capping the DFA converts the stall into a hard error. The durable fix is
   making the normal-path determinization over wide classes cheap (or incremental), so the
   accelerator and its expensive proof stop being load-bearing. Until then, the single highest-value
   change for resharp's own consumers is documenting `UnicodeMode::Ascii`/`Javascript` as the
   default for ASCII-token workloads, where the entire problem disappears (160 µs compile, no cold
   cliff). The end-to-end scanner makes this concrete: the same sole-engine scanner goes from a
   4.2 s startup and 4.95 GiB kernel scan under `UnicodeMode::Default` to 86 ms and 0.40 GiB under
   `UnicodeMode::Ascii` (~48x of the gap is the mode). So the most consequential default-config
   decision is arguably the **default `UnicodeMode` itself**: `Default` (2-byte `\w`) silently opts
   every `\w`-bearing rule into the wide-class compile, while the common consumer wants ASCII.

## Caveats and threats to validity

- Two machines, one suite run each. Absolute numbers are machine-specific; the structural
  conclusions (gate cliff, refusals, both lazy-DFA cliffs, A/B/C ratios, count parity) are large
  and reproduce on both architectures.
- `uni_mixed` is synthetic; real multilingual text hits the same construction (the trigger is
  byte-class coverage), and the 27-50 s magnitudes scale with how much of the class's 3-4-byte
  range the input touches.
- The regex full-set corpus number (85.8 s) is dominated by rules resharp cannot run, so it is a
  statement about those rules under regex, not an engine comparison.
- The mechanism behind regex's per-rule 1.1-1.35 s on `(?i)[\w.-]{0,50}?keyword` rules was not
  isolated (plausibly inner-literal extraction failing through the lazy prefix); reported as
  measured.
- resharp's `is_match` any-span semantics make unanchored negation patterns silently wrong for line
  classification; all published negation numbers use whole-line anchors.
- A/B/C numbers are single-threaded scanner runs with warm page cache; resharp's per-rule mutex
  makes the cold cliffs worse under concurrency than shown.

## Reproduction

The bench rig is a scratch crate at `/tmp/agent/w24-bench` (ephemeral): one `main.rs` with
subcommands `gen` (LCG haystacks, seed `0x5eed_0001`), `compile`, `match`, `oneshot`,
`corpus-compile`, `corpus-match`, `imatch`, the `lines*` per-line classifiers, and `find-filter`.
Engines map to `regex::bytes` builders (with `size_limit`/`dfa_size_limit`/`unicode` knobs) and
`resharp::Regex::with_options` (the `resharp_opts` helper parses `-full`/`-default`/`-ascii`/`-js`,
`-hardened`, `-unbounded`, `-dfaN`). Dependency: `resharp = { path = "<clone>/resharp-engine",
features = ["diag"] }` at `c1b3b87`, `regex = "1"` (1.12.4). Fix-option measurements patched the
clone's `resharp-engine/src/lib.rs` (P1: `bounded_safe_find_all = false`; P2: `max_len <= 200`),
each reverted after measuring. The A/B/C scanner variants are git worktrees under
`.cache/agent-worktrees/fs-{enhanced,B,C}` on branches `bench/fs-{enhanced-ruleset,B,C}`, differing
by the `FS_FORCE_ENGINE` knob (`regex` / `resharp` / `resharp-ascii`) and a baked engine default;
C-Default and C-Ascii are the same C binary under `FS_FORCE_ENGINE=resharp` vs `resharp-ascii`. The
betterleaks corpus regenerates from
`packages/cli/forbidden-strings/data/betterleaks-default-config.toml`. Linux kernel: depth-1 clone
of torvalds/linux (88 k indexed files). Twain corpus: Gutenberg #74 + #76 doubled to 8 MiB. Every
timing is tab-separated under the rig's `results/` (x86) and `m1-results/` (ARM).

[i21]: https://github.com/ieviev/resharp/issues/21
[bl]: https://github.com/betterleaks/betterleaks
