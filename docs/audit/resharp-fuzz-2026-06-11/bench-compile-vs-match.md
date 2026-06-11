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
- Our position (comment 4685401033): compile should be "not too much slower than regex crate",
  backed by measurement.

Everything below was measured fresh at upstream main `c1b3b87` (v0.6.12 plus the merged PR #20
`find_all` fix, committed 2026-06-11) against `regex` 1.12.4 (`regex-automata` 0.4.14), on x86-64
(AVX2) and Apple Silicon (NEON). Summary of what the data says:

1. ieviev's match-time claim is **confirmed, strongly**: at default config the regex crate either
   refuses large `\w` repeats outright (`CompiledTooBig` from `\w{256}` up) or, where it still
   compiles, collapses at match time (`\w{100}`: 0.45 s to 3.6 s per 8 MiB pass, 14x to 152x slower
   than resharp; `\w{500}` with only the size cap raised: ~19.5 s per pass, ~600x slower). The
   collapse is lazy-DFA cache thrash: raising `dfa_size_limit` to 256 MiB restores 13 ms to 27 ms
   passes. So the regex crate does pay at match time, with default knobs, exactly as claimed.
2. "RE# pays compile time only" is **not true on non-ASCII input**: resharp `\w{26}`, `\w{100}`,
   `\w{500}` (Full unicode) each spend **27 s to 50 s of lazy-DFA construction on the first
   `find_all` over an 8 MiB multilingual haystack** (warm passes after that: ~45 ms). The bounded
   left-to-right path is immune (`\w{24}` cold on the same haystack: 24 ms), so lowering the
   bounded-path limit would widen this much worse hidden cliff.
3. The compile-side cliff is one unbudgeted safety proof, not the BDFA and not UTF-8: `\w{24}` Full
   costs 1.51 s and **503 MiB peak RSS** to compile; `\w{26}` costs 176 ms and 49 MiB. The
   left-to-right path itself is the better matcher where it engages (16 ms vs 25 ms warm on dense
   input, and no unicode cold cliff), so the data argues for budgeting the overlap proof and keeping
   (or raising) the path's reach, not lowering it.
4. On a real 268-rule secret-scanning corpus (betterleaks), per-rule compile is microseconds to
   single-digit ms under regex and roughly 8x that under resharp (49 ms mean over the rules it
   accepts), with worst rules ~40 ms (regex) vs ~440 ms (resharp). Both engines refuse part of the
   corpus: regex 3 rules (`CompiledTooBig`, all large `\w`-class repeats), resharp 133 (129 of them
   lazy quantifiers, by design).
5. A concrete answer to "how long is acceptable" is in
   [the budget recommendation](#the-answer-how-long-of-a-compile-time-is-acceptable).

## Head-to-head: the disputed pattern family

`\w{n}` under full Unicode, fresh process per measurement, mean of 5 runs (stddev under 2% unless
noted). Compile is `Regex::new`/`with_options`; match is warm `find_all` over 8 MiB. The regex
crate is byte-mode (`regex::bytes`), Unicode `\w` on, default config unless marked.

<table>
  <thead>
    <tr><th>Aspect</th><th>regex 1.12.4 (default)</th><th>resharp c1b3b87 (Full)</th></tr>
  </thead>
  <tbody>
    <tr><td>compile <code>\w{24}</code></td><td>5.1 ms, 7 MiB RSS</td><td>1 511 ms, 503 MiB RSS</td></tr>
    <tr><td>compile <code>\w{26}</code></td><td>5.5 ms</td><td>176 ms, 49 MiB RSS</td></tr>
    <tr><td>compile <code>\w{500}</code></td><td>refused: <code>CompiledTooBig(10485760)</code> after 68 ms</td><td>203 ms, 47 MiB RSS</td></tr>
    <tr><td>match <code>\w{24}</code>, 8 MiB dense ASCII</td><td>12.0 ms</td><td>16.3 ms</td></tr>
    <tr><td>match <code>\w{100}</code>, 8 MiB dense ASCII</td><td><b>3 640 ms</b></td><td>31.4 ms</td></tr>
    <tr><td>match <code>\w{500}</code>, 8 MiB dense ASCII</td><td><b>19 435 ms</b> (size cap raised; default refuses)</td><td>33.3 ms</td></tr>
    <tr><td>first match <code>\w{26}</code>, 8 MiB multilingual</td><td>12.8 ms</td><td><b>27 309 ms</b> (then 49 ms warm)</td></tr>
    <tr><td>first match <code>\w{100}</code>, 8 MiB multilingual</td><td>1 270 ms</td><td><b>43 410 ms</b> (then 54 ms warm)</td></tr>
    <tr><td>first match <code>\w{500}</code>, 8 MiB multilingual</td><td>n/a (refused)</td><td><b>49 564 ms</b> (then 50 ms warm)</td></tr>
  </tbody>
</table>

Neither engine escapes the underlying problem (full-Unicode `\w` times large bounded repeat is a
huge automaton state space). They bill it in different places: regex caps compiled size and lets
the lazy DFA degrade (or refuses outright); resharp either pays an unbudgeted compile-time proof
(bounded path, n <= 25) or defers an unbudgeted determinization bill to the first match on inputs
that exercise the wide part of the class (n >= 26).

## Environment

<table>
  <tbody>
    <tr><th>x86-64 host</th><td>AMD Ryzen 7 8700F (8c/16t, up to 5.06 GHz), 62 GiB RAM, Fedora 44, Linux 7.0.9, governor "performance" (81% scaling at capture)</td></tr>
    <tr><th>arm64 host</th><td>Apple Silicon ("m1", 8 cores), macOS 26.5.1, exercises resharp's NEON SIMD paths</td></tr>
    <tr><th>rustc</th><td>1.98.0-nightly (6bdf43094, x86) / 1.98.0-nightly (cb46fbb8c, arm)</td></tr>
    <tr><th>resharp</th><td>upstream main <code>c1b3b87788c89bbeb1c8be53a849902d28433747</code> (v0.6.12 + PR #20), path dependency, <code>diag</code> feature</td></tr>
    <tr><th>regex</th><td>1.12.4 (regex-automata 0.4.14, regex-syntax 0.8.11, aho-corasick 1.1.4)</td></tr>
    <tr><th>profile</th><td>release, <code>debug = true</code> for symbols</td></tr>
  </tbody>
</table>

## Methodology

- **Fresh process per compile measurement.** Process reuse distorts resharp numbers badly (interned
  algebra state); an earlier in-process ascending sweep showed smooth growth where fresh processes
  expose a cliff. Every compile cell is 5 separate process invocations.
- **Engines.** `regex` = `regex::bytes::Regex::new` (default config: `size_limit` 10 MiB,
  `dfa_size_limit` 2 MiB). `regex-big` = default except `size_limit(1 << 30)`. `regex-bigdfa` =
  `size_limit(1 << 30)` + `dfa_size_limit(1 << 28)`. `resharp-full` =
  `RegexOptions::default().unicode(UnicodeMode::Full)`; `resharp-default` = `Regex::new` (1-to-2
  byte `\w`, narrower class, different semantics on non-Latin word chars).
- **Haystacks**, 8 MiB each, deterministic (fixed-seed LCG, byte-identical across machines):
  `ascii_text` (3-to-11-char words, prose-like), `ascii_long` (30-to-60-char identifier runs),
  `run1k` (1000-char word runs: dense matches for every n <= 1000), `adv23`/`adv499` (runs of 23 /
  499 word chars: candidates everywhere, zero matches for `\w{24}` / `\w{500}`), `uni_mixed` (ASCII
  words + CJK runs of 5-to-40 three-byte chars + Cyrillic + punctuation), `nonword` (no word chars
  at all). Plus `twain.txt` (Tom Sawyer + Huckleberry Finn, Gutenberg, replicated to 8 MiB) and
  `corpus-code.txt` (9.9 MiB of real Rust source) for the rule-corpus and feature suites.
- **Match timing**: compile once, then 4 timed `find_all` passes; the first pass is reported as
  "cold" (it includes lazy-DFA construction in both engines), the median of the rest as "warm".
- **Count parity as correctness check**: every match cell reports the match count from both
  engines. All 35 main-grid cells agree exactly, as do the corpus totals (zero secrets in the code
  corpus under both engines) and the line-classifier counts once resharp patterns are whole-line
  anchored (see the feature suite section).
- **Additive model validated**: separately measured one-shot (compile + single scan in one fresh
  process) equals compile + cold-scan within 2% on every spot check, so crossover analysis composes
  the two grids.
- Peak RSS via `/usr/bin/time -v`, fresh process, on the compile-only binary.

## Compile time

Fresh process, mean ± stddev of 5 runs. "REFUSED" = `Regex::new` returned
`CompiledTooBig(10485760)`; time shown is time-to-refusal.

<table>
  <thead>
    <tr><th>Pattern</th><th>regex (default)</th><th>regex-big (1 GiB cap)</th><th>resharp Default</th><th>resharp Full</th></tr>
  </thead>
  <tbody>
    <tr><td><code>\w{1}</code></td><td>433 ± 49 µs</td><td>-</td><td>1.2 ms</td><td>189.7 ± 2.2 ms</td></tr>
    <tr><td><code>\w{2}</code></td><td>637 µs</td><td>-</td><td>1.6 ms</td><td>207.2 ms</td></tr>
    <tr><td><code>\w{4}</code></td><td>1.1 ms</td><td>-</td><td>2.7 ms</td><td>317.3 ms</td></tr>
    <tr><td><code>\w{8}</code></td><td>1.9 ms</td><td>-</td><td>4.7 ms</td><td>528.3 ms</td></tr>
    <tr><td><code>\w{12}</code></td><td>2.7 ms</td><td>-</td><td>7.1 ms</td><td>774.2 ms</td></tr>
    <tr><td><code>\w{16}</code></td><td>3.5 ms</td><td>-</td><td>9.0 ms</td><td>968.3 ms</td></tr>
    <tr><td><code>\w{20}</code></td><td>4.5 ms</td><td>-</td><td>10.2 ms</td><td>1 154 ms</td></tr>
    <tr><td><code>\w{24}</code></td><td>5.1 ms</td><td>5.0 ms</td><td>13.6 ms</td><td>1 512 ± 10 ms</td></tr>
    <tr><td><code>\w{25}</code></td><td>5.5 ms</td><td>-</td><td>14.0 ms</td><td>1 562 ms</td></tr>
    <tr><td><code>\w{26}</code></td><td>5.5 ms</td><td>-</td><td>14.3 ms</td><td>176.0 ms</td></tr>
    <tr><td><code>\w{32}</code></td><td>6.8 ms</td><td>-</td><td>17.6 ms</td><td>175.4 ms</td></tr>
    <tr><td><code>\w{48}</code></td><td>9.9 ms</td><td>-</td><td>27.8 ms</td><td>176.7 ms</td></tr>
    <tr><td><code>\w{64}</code></td><td>13.3 ms</td><td>-</td><td>1.7 ms</td><td>176.1 ms</td></tr>
    <tr><td><code>\w{100}</code></td><td>20.3 ms</td><td>19.9 ms</td><td>1.9 ms</td><td>184.5 ms</td></tr>
    <tr><td><code>\w{128}</code></td><td>25.5 ms</td><td>25.5 ms</td><td>1.9 ms</td><td>183.8 ms</td></tr>
    <tr><td><code>\w{256}</code></td><td>42.4 ms REFUSED</td><td>50.3 ms</td><td>2.3 ms</td><td>187.7 ms</td></tr>
    <tr><td><code>\w{500}</code></td><td>67.6 ms REFUSED</td><td>98.1 ms</td><td>2.8 ms</td><td>203.2 ms</td></tr>
    <tr><td><code>\w{0,500}</code></td><td>66.9 ms REFUSED</td><td>99.1 ms</td><td>15.1 ms</td><td>122.5 ms</td></tr>
    <tr><td><code>\w+</code></td><td>437 µs</td><td>-</td><td>1.2 ms</td><td>123.5 ms</td></tr>
    <tr><td><code>[0-9]{24}</code></td><td>152 µs</td><td>-</td><td>132 µs</td><td>128 µs</td></tr>
    <tr><td><code>[a-f0-9]{64}</code></td><td>93 µs</td><td>-</td><td>229 µs</td><td>245 µs</td></tr>
    <tr><td><code>[A-Za-z0-9+/]{40}</code></td><td>76 µs</td><td>-</td><td>207 µs</td><td>208 µs</td></tr>
  </tbody>
</table>

Reading this table:

- **The resharp Full cliff sits exactly at the bounded-path gate.** `\w` under Full has max byte
  length 4, and `use_bounded` requires `max_len <= 100`, so n = 25 (4 x 25 = 100) is the last
  bounded repeat: 1.56 s, then n = 26 drops to 176 ms. The cost inside the gate is the
  `bounded_safe_find_all` overlap-emptiness proof (per the instrumented split in
  [the bug-06 analysis][bug06]), not `BDFA::new` itself.
- **resharp Default has the same cliff scaled by byte length.** Default `\w` is at most 2 bytes, so
  the gate flips between n = 50 and n = 51: 27.8 ms at n = 48, 1.7 ms at n = 64. Same mechanism,
  milder because the class is far narrower.
- **The proof is cheap for narrow ASCII classes.** `[a-f0-9]{64}` and `[A-Za-z0-9+/]{40}` take the
  bounded path too (max_len <= 100) and compile in ~200 to 250 µs. The 1.5 s case needs both the
  bounded path and a wide Unicode class. Wide-class cost without the proof is the ~120 to 200 ms
  Full-mode floor visible from `\w{1}` up.
- **The regex crate enforces its compile budget structurally.** Default config spends at most ~67 ms
  before *refusing* (`CompiledTooBig`); nothing is allowed to stall. With the cap raised it will
  compile `\w{500}` in 98 ms. Its per-repeat compile slope is ~0.13 ms.
- **Peak RSS** (fresh process, compile only): regex `\w{24}` 7 MiB, `\w{128}` 21 MiB, regex-big
  `\w{500}` 70 MiB; resharp Full `\w{24}` **503 MiB**, `\w{26}` 49 MiB, `\w{500}` 47 MiB; resharp
  Default `\w{48}` 19 MiB; `[a-f0-9]{64}` under 4 MiB in both engines. The proof costs ~10x the
  memory of everything else combined.

## Match time

Warm = median of passes 2 to 4 over 8 MiB; cold = pass 1 (includes lazy-DFA construction). Counts
agreed exactly between engines in every cell. regex is default config; `\w{500}` rows use
regex-big because default config refuses the pattern.

### Where both engines are fine (n <= 26)

<table>
  <thead>
    <tr><th>Pattern</th><th>Haystack</th><th>regex warm</th><th>resharp warm</th><th>regex cold</th><th>resharp cold</th><th>matches</th></tr>
  </thead>
  <tbody>
    <tr><td><code>\w{8}</code></td><td>ascii_text</td><td>19.4 ms</td><td>18.3 ms</td><td>20.0 ms</td><td>21.5 ms</td><td>449 624</td></tr>
    <tr><td><code>\w{8}</code></td><td>run1k</td><td>18.0 ms</td><td>22.0 ms</td><td>18.3 ms</td><td>36.2 ms</td><td>1 047 625</td></tr>
    <tr><td><code>\w{24}</code></td><td>ascii_long</td><td>15.0 ms</td><td>16.6 ms</td><td>15.2 ms</td><td>19.6 ms</td><td>258 884</td></tr>
    <tr><td><code>\w{24}</code></td><td>run1k</td><td>12.0 ms</td><td>16.3 ms</td><td>12.1 ms</td><td>19.3 ms</td><td>343 621</td></tr>
    <tr><td><code>\w{24}</code></td><td>uni_mixed</td><td>12.2 ms</td><td>16.3 ms</td><td>13.6 ms</td><td>24.3 ms</td><td>43 226</td></tr>
    <tr><td><code>\w{26}</code></td><td>run1k</td><td>11.4 ms</td><td>25.2 ms</td><td>11.7 ms</td><td>116.6 ms</td><td>318 478</td></tr>
    <tr><td><code>\w{26}</code></td><td>uni_mixed</td><td>11.9 ms</td><td>45.6 ms</td><td>12.8 ms</td><td><b>26.0 s</b></td><td>38 122</td></tr>
    <tr><td><code>\w+</code></td><td>ascii_text</td><td>36.1 ms</td><td>45.3 ms</td><td>36.6 ms</td><td>74.3 ms</td><td>1 012 472</td></tr>
    <tr><td><code>\w+</code></td><td>uni_mixed</td><td>20.5 ms</td><td>37.2 ms</td><td>21.3 ms</td><td>1.14 s</td><td>311 810</td></tr>
  </tbody>
</table>

Warm, the regex crate is 0.45x to 1.06x of resharp's time on every n <= 26 cell: both engines scan
8 MiB in 10 to 46 ms, regex usually slightly ahead. The story is in the cold column and below.

### Where the regex crate collapses (n >= 100): the claim, confirmed

<table>
  <thead>
    <tr><th>Pattern</th><th>Haystack</th><th>regex warm</th><th>resharp warm</th><th>ratio</th><th>matches</th></tr>
  </thead>
  <tbody>
    <tr><td><code>\w{100}</code></td><td>ascii_text</td><td>446 ms</td><td>11.8 ms</td><td>38x</td><td>0</td></tr>
    <tr><td><code>\w{100}</code></td><td>ascii_long</td><td>1.82 s</td><td>12.0 ms</td><td>152x</td><td>0</td></tr>
    <tr><td><code>\w{100}</code></td><td>run1k</td><td>3.64 s</td><td>31.4 ms</td><td>116x</td><td>83 810</td></tr>
    <tr><td><code>\w{100}</code></td><td>adv23</td><td>1.09 s</td><td>11.8 ms</td><td>93x</td><td>0</td></tr>
    <tr><td><code>\w{100}</code></td><td>adv499</td><td>3.60 s</td><td>28.7 ms</td><td>125x</td><td>67 112</td></tr>
    <tr><td><code>\w{100}</code></td><td>uni_mixed</td><td>1.27 s</td><td>43.9 ms</td><td>29x</td><td>0</td></tr>
    <tr><td><code>\w{100}</code></td><td>nonword</td><td>165 ms</td><td>11.8 ms</td><td>14x</td><td>0</td></tr>
    <tr><td><code>\w{500}</code> (regex-big)</td><td>ascii_text</td><td>456 ms</td><td>12.0 ms</td><td>38x</td><td>0</td></tr>
    <tr><td><code>\w{500}</code> (regex-big)</td><td>run1k</td><td>19.4 s</td><td>33.3 ms</td><td>584x</td><td>16 762</td></tr>
    <tr><td><code>\w{500}</code> (regex-big)</td><td>adv499</td><td>19.7 s</td><td>14.1 ms</td><td>1 396x</td><td>0</td></tr>
  </tbody>
</table>

This is steady-state, not warmup: cold and warm regex passes are within noise of each other. The
mechanism is the lazy DFA exhausting its default 2 MiB cache and the meta engine degrading to
slower fallbacks; with `dfa_size_limit` raised to 256 MiB (`regex-bigdfa`), `\w{100}` on run1k
drops from 3.64 s to **24.9 ms** and `\w{500}` to **26.9 ms**, slightly faster than resharp. So
ieviev's "regex turns very slow with large `\w` patterns" is true at default config, and it is a
cache-budget artifact rather than anything fundamental to byte-level engines, with the fix being a
non-default knob plus 256 MiB of cache memory.

### Where resharp's "compile time only" breaks: first match on multilingual input

resharp Full, `find_all` over the 8 MiB `uni_mixed` haystack (45% ASCII words, 25% CJK runs, 15%
Cyrillic), two fresh-process repetitions each:

<table>
  <thead>
    <tr><th>Pattern</th><th>compile</th><th>first pass</th><th>warm passes</th><th>regex (default) warm, same haystack</th></tr>
  </thead>
  <tbody>
    <tr><td><code>\w{24}</code> (bounded path)</td><td>1 512 ms</td><td>24.3 ms</td><td>16.3 ms</td><td>12.2 ms</td></tr>
    <tr><td><code>\w{26}</code></td><td>176 ms</td><td>27.3 s / 29.0 s</td><td>49 / 47 ms</td><td>11.9 ms</td></tr>
    <tr><td><code>\w{100}</code></td><td>184 ms</td><td>43.4 s / 47.2 s</td><td>54 / 45 ms</td><td>1.27 s</td></tr>
    <tr><td><code>\w{500}</code></td><td>203 ms</td><td>49.6 s</td><td>49.6 ms</td><td>n/a (refused)</td></tr>
    <tr><td><code>\w+</code></td><td>124 ms</td><td>1.14 s</td><td>37.2 ms</td><td>20.5 ms</td></tr>
  </tbody>
</table>

The bill that n <= 25 pays at compile time (eagerly, via the overlap proof over the whole class)
does not disappear at n >= 26; it moves to the first `find_all` that actually feeds 3-to-4-byte
word characters to the lazy right-to-left DFA, and it gets ~20x bigger there (27 to 50 s vs 1.5 s).
ASCII-only haystacks never trigger it (cold `\w{26}` on `ascii_long` is 105 ms), which makes it a
production landmine: a service that compiles fine and runs fine on English traffic stalls for half
a minute on its first CJK document. `is_match`/`find_all` during that stall also holds the
`Mutex<RegexInner>` resharp wraps around lazy-DFA growth, so concurrent callers on other threads
queue behind it.

This bears directly on the "adjust the upper limit of which patterns use the left-to-right path"
idea from comment 4685383860: at these pattern shapes the bounded path is the *better* matcher
(16.3 ms vs 25.2 ms warm on run1k, 24 ms vs 27 s cold on multilingual). Lowering the limit so
`\w{24}` skips it would remove the 1.5 s compile but hand users the 27 s first-match cliff instead.
The expensive part of the bounded path at these shapes is not `bdfa.rs` state space (the BDFA here
is 2 states; `BDFA::new` was 0.7 ms in the instrumented split) but the unbudgeted
overlap-emptiness proof guarding it.

## One-shot use and the amortization crossover

One-shot (compile + single scan, the CLI/grep shape) equals compile + cold-scan within 2%
(validated directly: e.g. resharp `\w{24}` over `ascii_long` one-shot 1 536 ms vs 1 512 + 20 ms
predicted; regex 20.6 ms vs 20.0 ms predicted). Composing the grids:

- **n <= 26**: no crossover exists on ASCII input; regex is faster at compile and at match, so it
  wins one-shot and long-running alike. resharp's one-shot penalty is the compile delta (~170 ms to
  1.5 s depending on which side of the gate).
- **n = 100**: regex still compiles (20 ms) but matches at 0.45 to 3.6 s per 8 MiB; resharp's extra
  ~165 ms of compile amortizes after roughly **0.7 MiB of ASCII scanning** (or one pass over any
  file bigger than that). On multilingual input the comparison inverts again until ~50 s of resharp
  lazy-DFA construction is amortized.
- **n >= 256**: regex default config refuses; there is nothing to cross over. resharp (or regex
  with raised caps) is the only option.

## Realistic consumer corpus: betterleaks secret-scanning rules

268 rules extracted from [betterleaks][bl]'s default config (the dataset shipped with this repo's
`forbidden-strings` scanner), with resharp-only metacharacters (`_`, `~`, `&`) escaped outside
character classes exactly the way the `forbidden-strings` port script does. Caveats on
representativeness, both directions:

- These rules were ported defensively (resharp metacharacters escaped, no set algebra used)
  because of resharp fragility at the time the scanner was built, so the corpus exercises resharp
  only on regex-shaped patterns, not on its native features (those are benchmarked in the next
  section).
- Much of what a betterleaks rule *means* is deliberately not in the regex at all, because
  mainstream engines cannot express it in one pattern: every rule carries scanner-side stopword and
  allowlist filters (negation), and some carry `required` co-occurrence patterns (conjunction).
  The architecture exists because PCRE/RE2-class engines lack `&` and `~`; an engine that has them
  could fold rule + filters into one pattern.

### Compile, all 268 rules, fresh process, 3 runs

<table>
  <thead>
    <tr><th>Engine</th><th>Total wall</th><th>Accepted</th><th>Refused</th><th>Mean per accepted rule</th><th>Slowest rule</th></tr>
  </thead>
  <tbody>
    <tr><td>regex (default)</td><td>1.67 s</td><td>265</td><td>3 (CompiledTooBig)</td><td>6.3 ms</td><td>39 ms</td></tr>
    <tr><td>resharp Default</td><td>2.93 s</td><td>135</td><td>133</td><td>21.7 ms</td><td>320 ms</td></tr>
    <tr><td>resharp Full</td><td>6.69 s</td><td>135</td><td>133</td><td>49.5 ms</td><td>440 ms</td></tr>
  </tbody>
</table>

- The 3 rules regex refuses at default config are all large `\w`-class repeats from real vendors:
  `pypi-AgEIcHlwaS5vcmc[\w-]{50,1000}`, `\b(hvb\.[\w-]{138,300})...`, and a generic
  `(?i)[\w.-]{0,50}?...` keyword rule. The disputed pattern shape is not synthetic; it ships in
  production rulesets. On `[\w-]{138,300}` regex spends ~38 ms then refuses, while resharp Full
  compiles it in ~205 ms.
- resharp's 133 refusals: 129 lazy quantifiers (`{0,50}?` etc., unsupported by design), 3
  `Algebra(UnsupportedPattern)`, 1 repeat above its own `{,500}` cap. A scanner adopting resharp
  as its only engine loses half this corpus as written.
- resharp Full's per-rule mean of 49.5 ms is ~8x regex's. Its slowest rules (~200 to 440 ms) are
  exactly the wide-class bounded repeats (`[\w=\.-]{32,64}`-shaped); ASCII-class rules compile in
  hundreds of µs (see the grid above).

### Match, 9.9 MiB of real Rust source

Over the 134-rule subset both engines accept (fair comparison), warm pass, zero matches found by
both (clean corpus):

<table>
  <thead>
    <tr><th>Engine</th><th>Cold pass</th><th>Warm pass</th><th>Shape</th></tr>
  </thead>
  <tbody>
    <tr><td>regex (default)</td><td>321 ms</td><td><b>314 ms</b></td><td>one suffix-literal-only rule costs 275 ms; the other 133 rules ~0.3 ms each (literal prefilter)</td></tr>
    <tr><td>resharp Default</td><td>2.82 s</td><td>1.33 s</td><td>flat ~10 ms per rule, no literal acceleration</td></tr>
    <tr><td>resharp Full</td><td>5.92 s</td><td><b>1.34 s</b></td><td>flat ~10 to 17 ms per rule; cold pays lazy-DFA build per rule</td></tr>
  </tbody>
</table>

Two engine-level lessons, not specific to either engine's algebra: the regex crate's literal
prefilter (Teddy/memmem) is worth ~40x on prefix-anchored secret rules, and it degrades sharply
when the only literal is a suffix (`[A-Za-z0-9]{6}_[A-Za-z0-9]{29}_mmk`: 275 ms of the 314 ms
total). resharp currently scans every byte for every rule (~620 MiB/s per rule), so 134 rules cost
134 full scans.

For completeness: regex over its full 265 accepted rules takes **85.8 s warm** on the same corpus,
with the top rules at 1.1 to 1.35 s *each*; those are precisely the `(?i)[\w.-]{0,50}?keyword...`
no-prefix-literal rules that resharp refuses (lazy quantifier). Neither engine handles that rule
family well as written: resharp won't compile them, regex runs them ~100x slower than the rest of
the corpus combined.

The production scanner this corpus comes from (`packages/cli/forbidden-strings`) sidesteps all of
this: aho-corasick prefilters literals, rules are sharded, and per its PERF.md the whole-repo scan
is 9.4 ms cold / 56.6 ms full. An engine swap is invisible behind that architecture for literal
rules; the engine only matters for the residual regex rules, where the numbers above apply.

## resharp-native features: what the compile budget buys

Patterns the regex crate cannot express in one pattern, against the practical decompositions a
regex-crate user actually writes (multiple patterns + host logic). Twain corpus (8 MiB, 167 k
lines) for the prose cases; counts shown agreed exactly between the resharp pattern and the
decomposition unless noted. Per-line classification = `is_match` per line; resharp negation
patterns are whole-line anchored (`^...$`), without which `is_match`'s any-span semantics silently
flips negations to near-always-true (a real usability trap: our first unanchored attempt
overcounted `~(_*the_*)` lines by 67%).

<table>
  <thead>
    <tr><th>Task</th><th>resharp pattern (one pass)</th><th>resharp warm</th><th>regex decomposition</th><th>regex warm</th><th>counts</th></tr>
  </thead>
  <tbody>
    <tr><td>lines with Tom AND Sawyer</td><td><code>_*Tom_*&amp;_*Sawyer_*</code></td><td>10.4 ms</td><td>2 patterns, 2 x is_match</td><td>3.9 ms</td><td>584 = 584</td></tr>
    <tr><td>lines with Tom, NOT Sawyer</td><td><code>^(_*Tom_*&amp;~(_*Sawyer_*))$</code></td><td>13.7 ms</td><td>2 patterns, AND NOT</td><td>3.9 ms</td><td>7 648 = 7 648</td></tr>
    <tr><td>lines NOT containing "the"</td><td><code>^~(_*the_*)$</code></td><td>17.7 ms</td><td>1 pattern, negate result</td><td>4.9 ms</td><td>100 025 = 100 025</td></tr>
    <tr><td>password-policy token present</td><td><code>[A-Za-z0-9]{8,}&amp;_*[0-9]_*&amp;_*[A-Z]_*</code></td><td>32.3 ms</td><td>3 patterns, 3 x is_match</td><td>9.1 ms</td><td>86 454 vs 87 508 (decomposition overcounts: not equivalent)</td></tr>
    <tr><td>extract word after "Mr. "</td><td><code>(?&lt;=Mr\. )\w+</code></td><td>11.3 ms</td><td><code>Mr\. \w+</code> + strip prefix</td><td>0.15 ms</td><td>360 = 360</td></tr>
    <tr><td>40-char base64 span containing a digit</td><td><code>[A-Za-z0-9+/]{40}&amp;_*[0-9]_*</code></td><td>15.3 ms</td><td>find + per-span second match</td><td>17.5 ms</td><td>75 426 vs 75 389 (span semantics differ slightly)</td></tr>
    <tr><td>hex secret w/ stopword negation, sparse corpus</td><td><code>[a-f0-9]{40}&amp;~(_*(?:0{8}|deadbeef)_*)</code></td><td>5.3 ms</td><td>find + filter</td><td>12.0 ms</td><td>equal (0 hits)</td></tr>
    <tr><td>same, dense hex corpus (171 k tokens)</td><td>same</td><td>53 ms</td><td>find + filter</td><td>23.3 ms</td><td>128 297 = 171 197 - 42 900 (exact semantic agreement)</td></tr>
  </tbody>
</table>

Compile time for every feature pattern above is 108 µs to 722 µs under resharp Full (these are
ASCII classes plus algebra; no wide-Unicode class, no bounded-path proof), except the lookbehind
`(?<=Mr\. )\w+` at ~120 ms (it contains `\w`). The compile-budget question is therefore almost
orthogonal to the features: set algebra is cheap to compile; wide Unicode classes are what cost,
with or without algebra.

On speed, the honest summary is a split decision: where the haystack is dominated by
literal-findable anchors, the regex decomposition wins by 2 to 4x (prefilters again); where the
constraint is class-shaped (no literal to find), the single resharp pattern wins (5.3 vs 12.0 ms;
15.3 vs 17.5 ms). What the single pattern buys unconditionally is semantics: the password-policy
decomposition is *wrong* (overcounts by 1 054 lines here; "a line containing an 8-char token, a
digit somewhere, and an uppercase somewhere" is not "a token satisfying the policy"), and the
stopword-negation rule needs no host-side filter pass at all, which is exactly the part of the
betterleaks architecture (scanner-side filters, `required` co-occurrence) that exists only because
mainstream engines cannot express conjunction and negation.

## ARM (Apple Silicon, NEON paths)

ARM-PENDING

## The answer: how long of a compile time is acceptable

The question from comment 4685383860, answered with the numbers above:

1. **The reference point the ecosystem sets.** At default config the regex crate compiles typical
   real-world rules in 0.1 to 6 ms, the worst accepted pattern in this entire campaign in ~67 ms,
   and *refuses* anything it cannot compile within its 10 MiB size budget rather than stalling.
   resharp is already inside "not too much slower than regex" on everything except wide-Unicode
   bounded repeats: ASCII classes compile at parity (µs), ordinary rules at ~8x (tens of ms), the
   Full-mode wide-class floor is ~120 to 200 ms.
2. **A concrete default budget: ~200 ms hard ceiling per pattern, sub-ms typical.** 200 ms is
   resharp's existing Full-mode floor for any `\w`-bearing pattern, so it is achievable today by
   construction; everything measured above it (the 1.5 s / 503 MiB proof) guards an optional
   accelerator with a safe `false` fallback. Like `CompiledTooBig`, the budget should be enforced
   structurally (count algebra/DFA construction work and bail to the fallback), not tuned per
   pattern shape: the proof cost is invisible to any per-shape heuristic (compare `[a-f0-9]{64}` at
   245 µs vs `\w{24}` at 1.5 s, both bounded-path).
3. **Whatever the number, it must cover first-match too.** Moving work out of `Regex::new` does not
   discharge the budget: the n >= 26 patterns compile in 176 ms and then spend 27 to 50 s inside
   the first `find_all` on multilingual input, 20x the compile-time bill they avoided, behind a
   mutex. A compile-time budget paired with an unbudgeted lazy determinizer just relocates the
   stall to production. The same applies to the regex crate in reverse: its compile budget is
   honest only because the lazy DFA degrades gracefully (slow but bounded) instead of stalling.
4. **On "adjust the upper limit of the left-to-right path": the data says budget the proof, don't
   shrink the path.** The bounded path is the better matcher where it engages (16 vs 25 ms warm on
   dense ASCII; 24 ms vs 27 s cold on multilingual) and its BDFA was 2 states / 0.7 ms here;
   the only pathological component is the unbudgeted overlap-emptiness proof. Shrinking the path's
   reach trades a visible 1.5 s compile for a hidden 27 s first match. With the proof budgeted
   (work-capped, falling back to `bounded_safe_find_all = false`), the gate could plausibly be
   *raised*, extending the path that avoids the Unicode cold cliff.

## Caveats and threats to validity

- Two machines, one run of the suite each. Absolute numbers are machine-specific; the structural
  conclusions (the gate cliff, the refusals, the two lazy-DFA cliffs, count parity) are large
  enough to travel, and reproduced on both architectures.
- The x86 governor reported 81% scaling at capture; compile stddevs were under 2% of mean, so the
  noise floor does not affect any conclusion drawn.
- `uni_mixed` is synthetic (LCG-driven CJK/Cyrillic/ASCII mix). Real multilingual text will hit
  the same lazy-DFA construction (the trigger is byte-class coverage, not realism), but the 27 to
  50 s magnitudes scale with how much of the class's 3-to-4-byte range the input touches.
- The regex full-set corpus-match number (85.8 s) is dominated by rules resharp cannot run at all,
  so it is a statement about those rules under regex, not an engine comparison.
- The mechanism behind the regex crate's per-rule 1.1 to 1.35 s on `(?i)[\w.-]{0,50}?keyword`
  rules was not isolated (plausibly inner-literal extraction failing through the lazy prefix);
  the number is reported as measured.
- resharp's `is_match` any-span semantics make unanchored negation patterns silently wrong for
  line classification; all published negation numbers use whole-line anchors. This is a
  documentation hazard for resharp more than a performance fact.
- Single-threaded measurements. resharp's `Regex` serializes lazy-DFA growth behind a mutex, so
  the cold-pass cliffs are worse under concurrency than shown here; the regex crate's compiled
  regexes are freely shareable.

## Reproduction

The bench rig is a scratch crate at `/tmp/agent/w24-bench` (ephemeral); its full source is small
enough to rebuild from this description: a single `main.rs` with subcommands `gen` (LCG haystack
generator, seed `0x5eed_0001`, kinds as listed in Methodology), `compile <engine> <pattern>`,
`match <engine> <pattern> <file> <reps>`, `oneshot`, `corpus-compile`, `corpus-match`,
`lines`/`lines-and`/`lines-and3`/`lines-andnot`/`lines-not` (per-line `is_match` classifiers), and
`find-filter` (find under pattern A, filter spans by pattern B). Engines map to
`regex::bytes::Regex::new`, `RegexBuilder` with `size_limit(1 << 30)` (and `dfa_size_limit(1 <<
28)` for `regex-bigdfa`), and `resharp::Regex::with_options` with `UnicodeMode::Full`/default.
Dependencies: `resharp = { path = "<clone>/resharp-engine", features = ["diag"] }` at `c1b3b87`,
`regex = "1"` (1.12.4). Release profile with `debug = true`. The betterleaks rule corpus is
regenerated from `packages/cli/forbidden-strings/data/betterleaks-default-config.toml` by
extracting every `rules[].regex` and escaping `_`, `~`, `&` outside character classes (preserving
`(?P<...>` group names). Twain corpus: Gutenberg #74 + #76 concatenated and doubled to 8 MiB.
Every timing in this document is tab-separated in the rig's `results/` directory.

[i21]: https://github.com/ieviev/resharp/issues/21
[bug06]: bug-06-compile-cliff-analysis.md
[bl]: https://github.com/betterleaks/betterleaks
