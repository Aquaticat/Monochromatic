# Performance

Measured wall-clock budget for the `forbidden-strings` scanner.
Numbers below are not aspirational targets; they are reproducible measurements
against the binary built from this package's `src/`.

## Last benched

**2026-05-03 (post-unicode-off + post-greedy-combine + post-source-split)**,
with `hyperfine 1.20.0`. Binary: `target/release/forbidden-strings` built
with `mise run //packages/dev-script/forbidden-strings:build`.

The "realistic" ruleset is the betterleaks-port baseline: 259 regex
rules + 3 literals (851 total lines).

The current numbers reflect the hybrid engine (`CompiledRegex::{Resharp,Plain}`
in `src/rules/engine.rs` -- 257 of 259 rules compile via the standard `regex`
crate, ~100x faster than resharp; 2 rules use resharp's set-algebra
operators), the regex-crate `unicode(false)` mode with try-and-fallback
to `unicode(true)` for rules that need unicode-property classes (a 17x
wall-time win on its own), the file-split refactor (every source file
under 500 lines), and greedy combine-partition for residual shards (see
Architecture summary).

### Realistic ruleset (259 rules, betterleaks port) on Monochromatic, 15 runs

```text
--all              37.2 ms ± 3.6 ms    (user 239.4 ms, sys 71.8 ms)
```

Range 30.9 ms .. 43.5 ms. Effective parallelism = ~6.4x cores.

Phase-timing breakdown (`FORBIDDEN_STRINGS_DEBUG_TIMING=1`):

```text
phase 0 read_rules_file:           0.0 ms
phase 1 classify+regex_compile:    ~5 ms    (unicode-off plain + 2 resharp)
phase 2 extract_gating_substrings: ~0.3 ms
phase 3 ac_build:                  ~0.4 ms
phase 4 residual_shards:           ~0.0 ms  (4 residuals, below greedy threshold)
```

Bucket distribution:

```text
ac_cs_lit=0
ac_cs_regex_prefix=157           (case-sensitive AC; substring-extracted from regex rules)
ac_ci_regex_prefix=171           (case-insensitive AC; substring-extracted from regex rules)
residual=4 (in 4 single shards)  (L114 beamer, L251 facebook, L769 twitch, L796 vercel-ai)
regex_rules_total=259
```

### Linux kernel corpus (93,694 files, 1799.2 MiB tracked bytes)

Startup-only, 30 runs each:

```text
example ruleset (851 rules)        8.5 ms ± 0.8 ms    (user 35.8 ms, sys 11.9 ms)
synth-1k ruleset (1000 rules)      9.0 ms ± 0.6 ms    (user 18.0 ms, sys 32.9 ms)
```

`--all` (full corpus walk + scan), 5 runs each:

```text
example ruleset    (851 rules; 4 residuals)   2153 ms ± 367 ms   (user 22.5 s, sys 0.9 s, 10.5x parallelism, ~836 MiB/s wall)
runtime ruleset    (860 rules; 4 residuals)   2012 ms ± 336 ms   (user 22.7 s, sys 0.9 s, 11.3x parallelism, ~894 MiB/s wall)
synth-residual-20  (20 hard residuals)        640  ms ±  55 ms   (user  5.9 s, sys 0.8 s,  9.2x parallelism, ~2.8 GiB/s wall)
synth-1000-0pct    (1000 rules; 0 residuals)  139  ms ±   9 ms   (user 0.55 s, sys 0.8 s,  4.0x parallelism, ~12.9 GiB/s wall)
```

Observations:

- The production-shape ~2 s headline is bounded by **4 betterleaks-shape
  residuals** (L114 beamer, L251 facebook, L769 twitch, L796 vercel-ai)
  each running per-rule `find_all` across 1.8 GiB. Linux kernel source
  triggers many false-positive prefix hits on these rules
  (`SK`, `Q~`, `\d{15,16}`, `hvs.`), so the regex crate's literal-prefix
  fast path runs on the prefixes but the full regex is then evaluated
  on every prefix hit. With 4 rules × 1.8 GiB workload distributed
  over 10.5x cores, the floor is the regex engine's per-byte throughput
  on the captured prefix-hit windows.
- The synth-residual-20 case is **faster than the 4-residual production
  case** despite having 5x more residual rules. The synthetic residuals
  use `_RESID_<tag>_` substrings that fire rarely on real source, so
  the residual-bucket combined gate triggers per-rule scans only on a
  handful of files. The production residuals have shorter, more common
  prefixes that fire on hundreds of files.
- The 0-residual case (synth-1000-0pct) shows the no-residual ceiling:
  12.9 GiB/s end-to-end on the Linux corpus, single-AC-pass dominated.
- Per-byte slowdown vs Mono: Mono `--all` is 37 ms over 21.4 MiB
  (~580 MiB/s), Linux `--all` is ~2 s over 1799 MiB (~900 MiB/s).
  Linux is faster per-byte because fixed setup amortizes over more
  files and the AC + regex hot path benefits from longer contiguous
  scans per file.

## Ceiling analysis (2026-05-03, post-Linux-bench)

After the Linux corpus bench (above), the question "is more optimisation
worth pursuing?" was investigated. The conclusion: **production-shape
rulesets are at the practical floor on Linux scale**, bounded by rule-
grammar realities (false-positive rate of literal anchors against kernel
source), memory bandwidth (AC fast path), and the regex engine's
per-byte throughput on betterleaks-shape patterns. Mono (the actual
CI workload) is at 37 ms, ~14x under any reasonable budget.

### The 4 production residuals: source-pattern analysis

`forbidden-strings.local.example.txt` lines 114, 251, 769, 796:

```text
L114  /(?:[\\'"`\s>=:(,)])([a-zA-Z0-9_~.]{3}\dQ\~[a-zA-Z0-9_~.-]{31,34})(?:$|[\\'"`\s<),])/
L251  /(?i)\b(\d{15,16}(\||%)[0-9a-z\-_]{27,40})(?:\\?['"`]|[\s;]|\\[nr]|$)/
L769  /SK[0-9a-fA-F]{32}/
L796  /\b((?:hvs\.[\w-]{90,120}|s\.(?i:[a-z0-9]{24})))(?:\\?['"`]|[\s;]|\\[nr]|$)/
```

Per-rule promotion analysis:

- **L114** -- single required substring `Q~` (2 chars, below
  `MIN_PREFIX_LEN = 4`), no top-level alternation. The regex crate's
  literal-prefix optimisation already memchr-scans for `Q~` internally.
  Promoting to AC moves the same filter earlier in the pipeline; the
  expensive part (full regex verification on each candidate window) is
  unchanged. Not promotable without lowering MIN_PREFIX_LEN, which
  would create AC false-positive storms on `Q~` in arbitrary source.
- **L251** -- no usable literal substring at all. The required content
  is `\d{15,16}` (numeric only) followed by `|` or `%`. Not promotable.
- **L769** -- single required substring `SK` (2 chars). Same conclusion
  as L114.
- **L796** -- top-level alternation between `hvs\.[\w-]{90,120}` and
  `s\.(?i:[a-z0-9]{24})`. Branch 1 has the 4-char anchor `hvs.`;
  Branch 2 has only `s.` (2 chars before flag scope). Multi-substring
  AC gating could route Branch 1 to AC, but the regex crate is already
  internally memchr-optimising on `hvs.` -- the gain is moving the
  filter from regex-internal to our AC bucket, not changing the work.
  Branch 2 stays on the regex engine regardless.

The actual bottleneck on Linux: **the production residuals' literal
anchors are too common in Linux kernel source.** Hundreds of
`SK`/`hvs.`/`Q~`/`\d{15,16}` occurrences in test fixtures, hex
constants, sample payloads. Each occurrence triggers a full regex
verification on the surrounding window. That cost is bounded by the
regex engine's per-byte throughput, not by anything optimiser-side.

### Rayon batching tested and rejected (2026-05-03)

Hypothesis: `synth-1000-0pct --all` on Linux gets 4.0x parallelism on
16 cores (139 ms wall, 553 ms user) because per-file AC work is
~1 us at 19 KB/file and rayon's task-creation overhead is comparable.
`with_min_len(N)` would amortise that overhead by batching N files
per task.

Tested by adding `.with_min_len(64)` to the outer `par_iter` in
`main.rs` (single-line change, rebuilt, measured, reverted).

Apples-to-apples results, hyperfine 5 runs per Linux config, 15 runs
for Mono:

```text
                              baseline           with_min_len(64)
Linux synth-1000-0pct --all   139 ms ± 9         140 ms ± 8           within sigma
Linux example --all           2153 ms ± 367      2204 ms ± 111        within sigma
Mono example --all            43 ms ± 3          44 ms ± 4            within sigma
```

No measurable change on any workload. Reverted; not shipped.

The hypothesis was wrong because the synth-1000-0pct's 4.0x
parallelism is **memory-bandwidth bound, not scheduler-overhead
bound**. Aggregate AC throughput at 12.9 GiB/s is in striking
distance of practical commodity-machine memory bandwidth (DDR5
sequential-read ~10-20 GB/s when L3-cold). With 16 threads each
streaming bytes through SIMD AC, the memory bus saturates well
before scheduler overhead becomes the bottleneck. Batching frees
scheduler capacity, but there's no scheduler-capacity bottleneck
to relieve.

### Combine-residuals-on-Linux: not tested, math-rejected

Combining the 4 residual rules into one Combined-shard gate was
tested on Mono earlier (handover round 1) and regressed +86 ms (650
ms -> 736 ms). The mechanism: each individual rule has a strong
literal-prefix anchor that the regex crate accelerates with
memchr/Teddy; combined into one alternation, the union of disparate
prefixes loses that optimisation, and per-byte scan cost goes up by
~32 us per file.

Per-file overhead × Linux file count: 32 us × 93,694 files =
**3.0 s of additional cost on Linux**. The current Linux --all is
2.0 s; combining would push it to ~5 s. Not worth running.

A per-corpus heuristic to choose between Combined and All-Singles
(based on file count or byte volume) would itself need a stat-walk
pass to gather metadata before scanning starts, adding ~30 ms tax
on Linux. The current code's "all-Singles below threshold, Combined
above" decision is bench-derived for Mono's residual count (4 < 16,
all-Singles); it would be incorrect to apply the same threshold to
Linux without knowing whether the corpus is Mono-like or kernel-like.
The simplest correct rule is "all-Singles when total residual count
is small," which is what we have.

### Genuinely still open (low priority)

- **Multi-substring AC gating per rule.** Would help if a future
  ruleset has alternation-bearing residuals where each branch's
  required literal is >= MIN_PREFIX_LEN. The current 4 production
  residuals do not match this profile (analysed above). Not worth
  building speculatively.
- **Per-file residual contention reduction.** Currently the residual
  scan runs each shard's `is_match` sequentially within a file. With
  4 single-shards on Mono and 4 on Linux, parallelising across shards
  inside a file might win on Linux (4 shards × per-rule find_all
  could fan out across cores). Bench-untested. Marginal ceiling
  since wall is already at 2 s with 10.5x parallelism across files.
- **Walker pseudo-required quantifier detection.** The walker doesn't
  detect `={0,3}` as making the preceding `=` optional; minor
  unsoundness hazard but no observed false negatives in the
  betterleaks corpus.

## Architecture summary

The hot path runs **two** Aho-Corasick `find_overlapping_iter` passes per file:

1. **Case-sensitive AC**: emits user-authored literal-rule hits AND queues
   regex-rule prefix matches whose required substring is case-sensitive
   (e.g. `\b(p8e-(?i)[a-z0-9]{32})`: the leading `p8e-` is case-sensitive).
2. **Case-insensitive AC** (`AhoCorasickBuilder::ascii_case_insensitive(true)`):
   queues regex-rule prefix matches whose required substring is case-insensitive
   (e.g. the betterleaks shape `(?i)[\w.-]{0,50}(?:adafruit)...` puts `adafruit`
   here). Literal rules NEVER live in this bucket; user literals are always
   case-sensitive.

Shipped optimisations in load order:

- **Substring-extracting prefix walker.** `rules.rs::extract_required_prefix`
  walks the regex source past optional/required atoms (character classes,
  perl-classes, `(?:...)` groups), recursing into required group bodies to
  pull out literal substrings that must appear in any match. Examples:
  `[a-z]{4}_RESID_<tag>_[A-Za-z0-9]{12}` extracts `_RESID_<tag>_`;
  `(?i)[\w.-]{0,50}(?:adafruit)...` extracts `adafruit` (ci=true).
- **`(?i)` flag handling.** Leading `(?i)` flag groups and `(?i)` inline
  flag changes set the extracted substring's case-insensitive bit; the
  loader routes the substring onto the case-insensitive AC bucket.
- **Escape-character soundness.** The walker treats `\<non-alphanumeric>`
  as a literal of the second char (`\_` -> `_`, `\=` -> `=`, etc.).
  Previously `\_` ended the walk; ~25 betterleaks-shape rules with
  `doo\_v1\_` style bodies now route onto AC.
- **Alternation-soundness bail.** When the walker encounters a top-level
  `|` (alternation in the current scope), it returns `None`. Without
  this, `/foobar|barfoo/` would extract "foobar" and AC-gate on it,
  silently missing files that contain only "barfoo".
- **Scoped flag-group skip.** `(?flags:body)` and `(?-flags:body)` are
  skipped without extraction (the body's flag context may invert outer
  ci; merging into the outer accumulator would require multi-ci
  tracking). Rules whose only required substring lives inside a scoped
  flag group land in residual.
- **Hybrid engine (`CompiledRegex::{Resharp, Plain}`).** Each rule
  compiles via the standard `regex` crate when its source contains no
  set-algebra operators (`A&B` intersection, `~(A)` complement, class-
  level `[A&&B]` / `[A~~B]`). Rules using set-algebra fall back to
  resharp. The combined gate for residual shards picks the engine per
  chunk via `uses_set_algebra`, a shallow string scan over the chunk's
  rules. On the betterleaks corpus this routes 257 of 259 rules to
  the regex crate; phase 1 (classify + per-rule compile) drops from
  ~2 s on resharp-only to ~440 ms on hybrid. Live in
  `src/rules/engine.rs`.
- **Unicode-off compile with try-and-fallback.** Each non-set-algebra
  rule compiles first with `unicode(false)`; on failure the loader
  retries with `unicode(true)`. Disabling unicode strips case-folding
  tables, codepoint-range expansion, and unicode-aware `\b`/`\d`/`\w`
  semantics from the compile and per-byte scan. Bench-verified 90x
  Phase 1 speedup AND 17x Mono `--all` wall-time speedup (641 ms ->
  37 ms). Soundness preserved: rules using unicode-property classes
  (`\p{Han}`, etc.), multi-byte chars inside `[...]` classes, or the
  `(?u)` flag transparently fall through to unicode-on. Literal
  multi-byte UTF-8 sequences in the regex source compile fine in
  bytes-mode without unicode: the parser treats them as the matching
  byte sequence, so they take the fast path. Lives in
  `src/rules.rs::compile_plain_rule` and the matching combined-gate
  fallback in `src/rules/shards.rs::try_compile_combined`.
- **Greedy combine-partition for residual shards.**
  `src/rules/shards.rs::build_residual_shards` now uses divide-and-
  conquer: try compiling all positions into one combined-alternation
  gate; on success emit one Combined shard; on failure split in half
  and recurse via `rayon::join`. Bottom-out at len=1 emits a Single
  shard reusing the Phase-2a-compiled per-rule regex (no fresh
  Regex::new). Threshold guard `GREEDY_COMBINE_THRESHOLD=16`: below
  it, all positions are emitted as Singles directly. The threshold
  is bench-derived on Mono's 4-residual case, where each rule has a
  strong literal-prefix anchor (`SK`, `Q~`, `\d{15,16}`, `hvs.`) that
  the regex crate accelerates with memchr/Teddy; combined into one
  gate, that optimisation is lost and per-byte scan cost rises
  ~24 us per file (+86 ms across 2700 files). For larger residual
  buckets where individual rules already lack a usable literal
  prefix, the trade flips and Combined wins.

## L2 line-start index (shipped)

`scan.rs` builds a `Vec<usize>` of newline byte offsets via
`memchr::memchr_iter` the first time any hit fires, and shares it through
a `OnceLock` across the AC literal-emit path, the prefix-matched
`par_iter`, and every residual-shard `par_iter`. `line_and_col` and
`end_in_line` are now `partition_point` lookups on that vec instead of
walks from byte 0.

Why this matters in the worst case: a single file with **N hits**
previously paid 2 walks per hit, each O(file_size), so total cost was
O(N * file_size). The pathological case "rogue agent wrote one forbidden
literal a million times in one 43 MB file" would have taken ~18 minutes
of pure column-counting at 10 GiB/s memory bandwidth.

With L2:

```text
1M hits in a 43 MB file:    1.48 s wall  (99% CPU)
                            outputs 1M correct redacted lines
```

The clean-path numbers are unchanged: in 99% of files no hit fires, so
`build_line_index` never runs and the pre-L2 cost shape holds. The L2
build itself is SIMD memchr + an `i + 1` push per newline, and lookups
are `partition_point` (O(log L)).

## Mmap experiment (rejected)

The plan's E2 entry hypothesised that swapping `fs::read` for
`memmap2::Mmap::map` in the per-thread fused scan loop would save one
alloc + memcpy per file and let the kernel readahead-pipeline page
faults across `--all`. Tested apples-to-apples against `fs::read`
(both binaries built from the same source modulo the read-vs-mmap
swap) on **2026-05-02**:

Monochromatic, 30 runs each:

```text
                    fs::read              mmap                  delta
example-all         15.7 ms ± 1.6 ms      21.2 ms ± 1.0 ms      mmap +35% wall
synth1k-all         26.5 ms ± 2.3 ms      32.8 ms ± 1.2 ms      mmap +24% wall
```

Linux kernel (93693 files, 1.5 GiB), 5 runs each:

```text
                    fs::read              mmap                  delta
10k+0% residual     687 ms ± 81 ms        986 ms ± 103 ms       mmap +43% wall
10k+20% residual    729 ms ± 130 ms       947 ms ± 7 ms         mmap +30% wall
```

System CPU (kernel time) is the smoking gun:

```text
Linux 10k+0% residual:
  fs::read:  user 6640 ms,  sys 1195 ms,  wall 687 ms
  mmap:      user 6326 ms,  sys 3491 ms,  wall 986 ms
                                       ^^^^^^^^^^
  mmap nearly tripled kernel time, +2300 ms aggregate sys time.
```

Why mmap loses for our workload: per-file mmap setup creates a
`vm_area_struct` and corresponding page table entries; per-file
unmap tears them down. The Linux kernel corpus hits this path 93693
times, the Mono repo 2699 times. With files averaging 16 KB, the
saved alloc + memcpy (≈ tens of microseconds per file) is dwarfed
by the VMA bookkeeping and page-fault handling. `madvise(SEQUENTIAL)`
made the regression worse, not better, because each `madvise` is an
extra syscall per file.

Rejection criteria: every measured workload regressed by ≥ 24% wall;
no workload showed any improvement. The dependency (`memmap2`) and
the `unsafe { Mmap::map(...) }` block were removed. Don't re-attempt
on this code base unless input file sizes shift to averages well
above ~1 MiB per file (the threshold where saved memcpy outweighs
VMA setup is roughly that order on Linux).

This is the kind of optimisation that "should" win on paper and
empirically does not. Future "mmap is faster, just use mmap" PRs
should be challenged with the apples-to-apples bench reproduced
in `## Reproduce`.

## Reproduce

```sh
BIN=target/release/forbidden-strings
EX=../../../forbidden-strings.local.example.txt   # adjust path as needed
RU=/tmp/claude/synth-rules.txt                    # regen with bun /tmp/claude/gen-fs-rules.ts

# realistic ruleset
hyperfine --warmup 3 --runs 30 \
  --command-name 'example-startup' "$BIN --rules $EX" \
  --command-name 'example-all'     "$BIN --rules $EX --all"

# synthetic 1k ruleset on Monochromatic
hyperfine --warmup 3 --runs 30 --ignore-failure \
  --command-name '1k-startup'   "$BIN --rules $RU" \
  --command-name '1k-all-mono'  "$BIN --rules $RU --all"

# synthetic 10k ruleset on Monochromatic (regen with bun /tmp/claude/gen-fs-rules-10k.ts)
RU10=/tmp/claude/synth-rules-10k.txt
hyperfine --warmup 3 --runs 30 --ignore-failure \
  --command-name '10k-startup'  "$BIN --rules $RU10" \
  --command-name '10k-all-mono' "$BIN --rules $RU10 --all"

# residual sweep on the Linux kernel
# Clone (one-time): git clone --depth=1 --single-branch https://github.com/torvalds/linux.git /tmp/claude/linux
# Generate variants (one-time): bun /tmp/claude/gen-residual-sweep.ts
cd /tmp/claude/linux && hyperfine --warmup 2 --runs 5 --ignore-failure \
  --command-name 'r=0'    "$BIN --rules /tmp/claude/sweep-resid0000.txt --all" \
  --command-name 'r=100'  "$BIN --rules /tmp/claude/sweep-resid0100.txt --all" \
  --command-name 'r=500'  "$BIN --rules /tmp/claude/sweep-resid0500.txt --all" \
  --command-name 'r=1000' "$BIN --rules /tmp/claude/sweep-resid1000.txt --all" \
  --command-name 'r=2000' "$BIN --rules /tmp/claude/sweep-resid2000.txt --all"

# L2 pathological case (1M-hit single file)
bun -e 'const fs = await import("node:fs"); const line = "PLACEHOLDER_DOES_NOT_EXIST_IN_THIS_REPO_XX\n"; const buf = Buffer.alloc(line.length * 1_000_000); for (let i = 0; i < 1_000_000; i++) buf.write(line, i * line.length); fs.writeFileSync("/tmp/claude/million-hits.txt", buf);'
/usr/bin/time -v $BIN --rules $EX /tmp/claude/million-hits.txt > /dev/null

# Mmap A/B (only relevant if reconsidering the mmap rejection above)
# Build two binaries:
#   1. fs::read variant: src/main.rs uses `fs::read(p).unwrap_or_default()`
#   2. mmap variant: src/main.rs uses `unsafe { Mmap::map(&File::open(p)?) }`
#                    plus `memmap2 = "0.9"` in Cargo.toml
# Then bench:
hyperfine --warmup 3 --runs 30 --ignore-failure \
  --command-name 'fs-read' "/path/to/fs-read-binary --rules $EX --all" \
  --command-name 'mmap'    "/path/to/mmap-binary    --rules $EX --all"
```

`/tmp/claude/clean.txt` is a single-line plain-text file;
`/tmp/claude/violating.txt` contains one literal taken from `synth-rules.txt`;
`/tmp/claude/violating-10k.txt` contains one set-algebra hit and one residual hit
for the 10k ruleset. Generators for synthetic rulesets and the sweep variants live
under `/tmp/claude/gen-*.ts` (Bun TypeScript).

## Engine constraint

The scanner uses [resharp][] for regex matching.
Resharp is **load-bearing for the rule grammar**, not just a performance choice:

- `A&B` set intersection
- `~(A)` complement
- Class-level `[A&&B]` intersection and `[A~~B]` symmetric difference

These operators have no equivalent in `regex` / `regex-automata` / PCRE.
The package README documents the worked example `/key_[0-9]{5}&~(key_0{5})/`,
which flags any five-digit `key_` value except the all-zeros placeholder
without lookaround. Switching engines would require either dropping support
for these rule shapes or maintaining two parsers and routing rules between them.

Concretely: any plan or rationale that proposes "swap the combined gate to
`regex-automata` to enable DFA serialization" is rejected.
The combined-regex compile cost is bounded by sharding (see Architecture summary)
and is now a small fraction of overall runtime.

[resharp]: https://github.com/ieviev/resharp

## Comparison with betterleaks v1.1.2

Betterleaks is the upstream source for the ported rule corpus (see
`src/mise.port-betterleaks.ts`). Measuring against it is informative
because both tools scan for secrets, but the comparison is not a
horse race; the tools serve different use cases and the numbers
reflect architectural choices, not engine quality in the abstract.

**Betterleaks v1.1.2**, Go binary, RE2 engine, Aho-Corasick keyword
prefilters, CEL-based post-match filtering, `dir` mode (no git history).
Installed via mise/aqua. Tested 2026-05-03 on the same machine as all
other benches (AMD Ryzen 7 8700F, 16 threads).

### Same-content comparison (git-tracked files only)

To isolate engine throughput from file-walking differences, both tools
were run on identical file sets: Monochromatic's git-tracked content
(~21 MiB, ~2700 files) and the Linux kernel (torvalds/linux, ~1.58 GiB,
~93k files).

Monochromatic, git-tracked content via `/tmp` copy (betterleaks) and
`--all` (forbidden-strings), 5 runs each:

```text
forbidden-strings   startup-only     7.3 ms ±  0.6 ms
forbidden-strings   --all            28 ms           (1 run, /tmp copy)
betterleaks         startup-only   174 ms             (scanned 0 bytes)
betterleaks         dir              557 ms             (6.61 MiB in 557 ms)
```

Startup ratio: **~24x**. Full-scan ratio: **~20x**.

Linux kernel, `--all` vs `dir` (betterleaks `dir` also walks git-tracked
files in this corpus since there are no node_modules-like subtrees), single
run each:

```text
forbidden-strings   --all          1.6 s    (user 22 s,  sys 0.8 s, 13x parallelism)
betterleaks         dir            5.3 s    (user 66 s,  sys 1.8 s, 12x parallelism)
```

Scan ratio: **~3.3x**. Per-byte throughput: forbidden-strings ~1.0 GB/s,
betterleaks ~0.3 GB/s.

### Why the gap widens on monorepos

Betterleaks `dir` walks the entire directory tree; it does not respect
`.gitignore`. On the Monochromatic monorepo (which contains
`node_modules/`, `dist/`, `target/`, etc.), this means scanning 4.28 GB
of content instead of the 21 MiB of git-tracked source:

```text
forbidden-strings   --all            43 ms    (git ls-files; 21 MiB)
betterleaks         dir              86.5 s   (full tree walk; 4.28 GB)
```

Wall-clock ratio: **~2000x**. The ratio is dominated by the 200x data
volume difference, not the engine; but the data volume difference is
real and user-observable. Forbidden-strings uses `git ls-files` (via the
`ignore` crate's parallel walker, which honours `.gitignore`) so it
skips generated and vendored content by design. Betterleaks' `git`
command scans git history (patches), which is a different (and more
expensive) workflow; its `dir` command is the closest comparable mode
for working-tree-only scanning.

### Why forbidden-strings is faster per byte

Three architectural choices account for most of the per-byte gap:

1. **Dual AC gate with lazy regex dispatch.** On the 99%-clean file
   path, forbidden-strings runs two Aho-Corasick passes and, finding
   zero hits, skips the regex engine entirely. RE2 (betterleaks' engine)
   also uses Aho-Corasick keyword prefilters, but the RE2 match path
   is heavier per file even on no-match content because the prefilter
   hit must be verified against the full DFA. Forbidden-strings' AC
   only queues a `find_all` when the prefix is seen; on a clean file,
   no `find_all` runs at all.

2. **Hybrid engine dispatch.** 257 of 259 ported rules compile via the
   `regex` crate (which applies memchr/Teddy literal-prefix acceleration
   per-rule). RE2 compiles all rules into a shared DFA that cannot
   apply per-rule literal-prefix fast paths. The per-rule acceleration
   matters on large corpora where many files contain a short prefix hit
   but don't match the full rule.

3. **Native binary startup.** The Rust binary (LTO + `panic = "abort"` +
   stripped) starts in ~7 ms. The Go binary starts in ~174 ms (GC init,
   goroutine scheduler, config parse). For the pre-commit hook use case
   (scan a handful of staged files, sub-5 ms budget), the startup gap
   alone makes betterleaks unsuitable regardless of per-byte throughput.

### What betterleaks does that forbidden-strings does not

The speed gap is not free. Betterleaks provides capabilities that
forbidden-strings deliberately omits (see README "When to pick
something else"):

- **CEL-based filtering.** Post-match filters evaluate entropy, BPE
  token efficiency, git author, file path, and string-allowlist
  membership. Forbidden-strings has no post-match filtering; the port
  drops these filters and documents the resulting false-positive
  increase.
- **Async HTTP validation.** `validate` blocks call provider APIs to
  check if a detected secret is live. No equivalent in
  forbidden-strings.
- **Git history scanning.** `betterleaks git` walks every diff in
  every commit. Forbidden-strings only scans the working tree.
- **SARIF/JSON/CSV output.** Machine-readable reports for GitHub code
  scanning upload, CI dashboards, etc. Forbidden-strings only emits
  `path:line:cols rule=N` to stderr.
- **Per-rule path scoping.** `path = '''(?i)\.ya?ml$'''` restricts a
  rule to matching files. Forbidden-strings scans every file
  unconditionally (by policy).
- **Allowlists.** Per-rule `[[rules.allowlists]]` with regex-based
  exceptions. No equivalent.

These features are part of why betterleaks is slower per byte: CEL
evaluation, entropy/token-efficiency scoring, and validation all add
per-match cost that forbidden-strings avoids by not having them.

### When the comparison is not relevant

- If the rule set can ship in the repo and set-algebra is unnecessary,
  betterleaks is the better tool (larger ecosystem, real validation,
  SARIF output). Forbidden-strings' niche is rules that cannot be
  committed.
- Betterleaks' `git` command (scanning commit history) has no
  forbidden-strings equivalent. The per-byte comparison only covers
  working-tree scanning.
- The rule corpora are not identical: the port is lossy (CEL filters,
  entropy, allowlists, path scoping all dropped). Betterleaks produces
  fewer false positives on the same rules because it has more filtering.

### Reproduce

```sh
# Install betterleaks (e.g. via mise/aqua or brew)
# Build forbidden-strings
mise run //packages/dev-script/forbidden-strings:build
FS=packages/dev-script/forbidden-strings/target/release/forbidden-strings
RULES=forbidden-strings.local.txt

# Startup-only (0 bytes scanned)
hyperfine --warmup 2 --runs 5 "$FS --rules $RULES"
betterleaks dir /dev/null   # reports startup time in "scanned 0 bytes in Nms"

# Same-content Monochromatic (git-tracked only)
git ls-files -z | xargs -0 -I{} cp --parents "{}" /tmp/fs-bench-mono/
hyperfine --warmup 2 --runs 5 "$FS --rules $RULES --all"
cd /tmp/fs-bench-mono && time betterleaks dir .

# Same-content Linux kernel
cd /tmp/claude/linux && hyperfine --warmup 2 --runs 3 "$FS --rules $RULES --all"
cd /tmp/claude/linux && time betterleaks dir .

# Full-directory Monochromatic (betterleaks scans everything; fs scans git-tracked only)
hyperfine --warmup 2 --runs 5 "$FS --rules $RULES --all"
cd /path/to/monochromatic && time betterleaks dir .
```

## When to re-bench

Re-run the commands above and append a dated block to **Last benched** /
**Results** (do not overwrite: regressions need history) when **any** of:

- A change touches `src/main.rs` (file dispatch / parallelism), `src/scan.rs`
  (per-file scan logic), or `src/rules.rs` (rule loading and bucketing)
- A change touches `Cargo.toml` profile or dependency versions
- The repo grows past ~5000 tracked files or ~50 MiB total
- Realistic `--all` exceeds **150 ms** in casual use (10x current ceiling),
  startup-only exceeds **20 ms** (16x current), or synthetic-1k `--all`
  exceeds **300 ms** (10x current)

If none of the above hold, the numbers in this file are still trustworthy.

The deferred opportunity catalog (extension/size pre-filter, chunked-concat,
bucketed alternation) lives in `~/.claude/plans/dapper-coalescing-horizon.md`.
Do not re-derive that analysis on every session: read the plan, then decide.

Items already resolved in this code base:

- **L2 (line-start index for `line_and_col`)**: shipped 2026-05-02 evening.
  See `## L2 line-start index (shipped)` above.
- **E2 (`mmap` for `--all`)**: tested and rejected 2026-05-02 evening with
  apples-to-apples bench data. See `## Mmap experiment (rejected)` above.
  Do not re-attempt without input file sizes shifting to >> 1 MiB averages.
- **E1 (extension/size pre-filter)**: rejected by user policy
  (rule must scan files regardless of extension/size to catch
  accidentally renamed files and adversarial agent-generated content).
