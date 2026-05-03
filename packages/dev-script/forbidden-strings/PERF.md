# Performance

Measured wall-clock budget for the `forbidden-strings` scanner.
Numbers below are not aspirational targets -- they are reproducible measurements
against the binary built from this package's `src/`.

## Last benched

**2026-05-03 (post-unicode-off + post-greedy-combine + post-source-split)**,
with `hyperfine 1.20.0`. Binary: `target/release/forbidden-strings` built
with `mise run //packages/dev-script/forbidden-strings:build`.

The "realistic" ruleset is the betterleaks-port baseline: 259 regex
rules + 3 literals (851 total lines). **This is a different workload from the
previous "realistic = 17 rules" bench at the bottom of this document; the
two are not comparable.** Numbers from the prior 17-rule corpus are kept
under "Pre-betterleaks-port baseline" for regression detection only.

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

### Superseded -- 2026-05-03 morning (pre-unicode-off)

```text
--all              641.2 ms ± 19.6 ms    (user 4137.3 ms, sys 884.4 ms)
```

The unicode-off compile cut Mono `--all` 17x (641 ms -> 37 ms). Phase 1
dropped from ~440 ms to ~5 ms (90x faster) because the regex-crate
compile no longer pays for unicode-aware case-folding tables and
codepoint-range expansion. Per-byte scan also benefits: smaller DFAs
and no unicode bookkeeping on the hot path. Soundness preserved by
the try-unicode-off-then-on fallback in `src/rules.rs::compile_plain_rule`
(rules with `\p{...}`, multi-byte chars in `[...]`, or `(?u)` flag
fall through to unicode-on).

### Superseded -- 2026-05-02 (pre-hybrid-engine)

```text
startup-only       3.86 s ± 0.15 s    (user 29.65 s, sys 2.37 s)
--all              6.98 s ± 0.96 s    (user 33.99 s, sys 2.76 s)
```

The hybrid-engine commit (6fef4529) cut Mono `--all` 4.5x (6.98 s -> 663 ms);
the split refactor and greedy partition added are no-op on perf
(641 ms post-split is within 1 sigma of 663 ms pre-split).

### Realistic ruleset on Linux kernel (94k files, 1.5 GiB), 3 runs per shard size

```text
INITIAL_SHARD_SIZE=1     startup 4.09 s ± 0.64 s    --all 61.6 s ± 9.3 s
INITIAL_SHARD_SIZE=4     startup 5.22 s ± 0.16 s    --all 61.1 s ± 3.3 s
INITIAL_SHARD_SIZE=16    startup 4.62 s ± 0.24 s    --all 66.4 s ± 9.7 s
INITIAL_SHARD_SIZE=64    startup 4.63 s ± 0.15 s    --all 62.1 s ± 4.6 s
```

`--all` is bench-equivalent across all shard sizes (61-66 s, within noise).
The 40 residual rules in this corpus cannot be combined into a single
Regex on resharp (HIR-translator parse-cliff failure on betterleaks-shape
alternations), so `build_residual_shards` auto-halves to 1-rule shards
regardless of `INITIAL_SHARD_SIZE`. That's why size choice is moot here.
Initial size 1 is marginally faster at startup because it skips the
failed-and-halve attempts; the constant is set to 1 in `rules.rs` for
that reason.

### Bucket distribution on the betterleaks corpus

Set `FORBIDDEN_STRINGS_DEBUG_BUCKETS=1` (env var) to print at startup:

```text
ac_cs_lit=3                  user-authored literal rules
ac_cs_regex_prefix=89        regex rules whose required substring is case-sensitive
ac_ci_regex_prefix=130       regex rules whose required substring is case-insensitive
residual=40 (in 40 shards)   regex rules with no AC-extractable substring
regex_rules_total=259
```

The 40 residual rules are dominated by:
- alternation-bearing capture/non-capture groups (`(?:foo|bar)`) where no
  individual branch is required; preserves soundness;
- scoped flag groups `(?-i:body)` / `(?i:body)` where the body's flag
  context can invert outer ci (the walker skips without extraction);
- short leading literals (under `MIN_PREFIX_LEN = 4`) such as `A3-`,
  `pat`, `gho_` (currently still treated case-sensitively from the
  group body, which doesn't always recover them).

The Linux-kernel `--all` floor of ~60 s is bounded by these 40 residual
rules each running `is_match` on every file via resharp's per-rule
`Mutex<RegexInner>`. With 16 threads scanning 94k files, threads
serialize through whichever shard's gate they're currently on. User-CPU
~150 s vs wall ~62 s = 2.5x parallelism, well below the ~10x rayon
achieves on AC-only workloads.

### Comparison with earlier numbers

The previous bench block at the bottom of this document captured the
17-rule "realistic" workload. Direct delta against the current 259-rule
workload is not meaningful (the rule corpus changed by 15x in size and
took on a fundamentally different shape from the historic generic
"AWS/PEM/Slack" baseline).

For reference, on the betterleaks corpus the **regression** when first
encountered (2026-05-02 evening, before this round of fixes) was:

```text
Mono --all       41.6 s    Linux --all  ~60.7 s
```

The fixes shipped in this round (case-insensitive AC bucket, group
recursion in extractor, escape-character fix, scoped-flag-group skip,
alternation-soundness bail) reduced Mono `--all` to 6.98 s (~6x better)
and held Linux `--all` near its mutex-bound floor; the residual gate is
the remaining bottleneck on Linux-scale corpora. See `## Open
opportunities` for what would move this further.

## Open opportunities (not yet shipped)

- **Multi-substring AC gating per rule.** The current extractor returns
  at most one substring per rule. For alternation `(?:foo|bar)`, every
  branch has its own required substring; emitting `foo` AND `bar` as
  separate AC patterns gating the same rule is sound and would drain
  another ~30 of the 40 residual rules onto the AC fast path. Estimated
  Linux `--all` after this: well below 60 s.
- **Per-file residual contention reduction.** Even after the AC
  improvements above, residual scanning runs `gate.is_match` per file
  per shard. Parallelizing across shards within a file (rayon
  par_iter on `residual_shards`) would convert the `Mutex<RegexInner>`
  contention into a different shape -- worth measuring whether the
  shorter critical section actually wins.
- **Walker pseudo-required quantifier detection.** The walker doesn't
  detect `={0,3}` as making the preceding `=` optional; minor unsoundness
  hazard but no observed false negatives in the betterleaks corpus.

## Pre-betterleaks-port baseline (historical, 2026-05-02 morning, 17-rule realistic)

The blocks below were measured against `forbidden-strings.local.example.txt`
when it contained ~17 rules (PEM, AWS, Slack, GitHub PAT plus a few
set-algebra demonstrations). The example file has since been regenerated
from the betterleaks default config (851 lines, 259 regex rules); the
"realistic" definition changed under us. Keep these numbers for trend
detection only -- they ARE NOT a budget against which the current
betterleaks-port is measured.

## Architecture summary

The hot path runs **two** Aho-Corasick `find_overlapping_iter` passes per file:

1. **Case-sensitive AC** -- emits user-authored literal-rule hits AND queues
   regex-rule prefix matches whose required substring is case-sensitive
   (e.g. `\b(p8e-(?i)[a-z0-9]{32})` -- the leading `p8e-` is case-sensitive).
2. **Case-insensitive AC** (`AhoCorasickBuilder::ascii_case_insensitive(true)`) --
   queues regex-rule prefix matches whose required substring is case-insensitive
   (e.g. the betterleaks shape `(?i)[\w.-]{0,50}(?:adafruit)...` puts `adafruit`
   here). Literal rules NEVER live in this bucket -- user literals are always
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
  bytes-mode without unicode -- the parser treats them as the matching
  byte sequence -- so they take the fast path. Lives in
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

Two corpora were used:

- **Monochromatic** (this repo): 2699 tracked files, 21.4 MiB total bytes -- typical CI workload.
- **Linux kernel** (`torvalds/linux`, shallow clone): 93693 tracked files, ~1.5 GiB total bytes -- chosen as the largest plausible repo to stress the scanner. Cloned to `/tmp/claude/linux` via `git clone --depth=1 --single-branch https://github.com/torvalds/linux.git`.

Three rulesets were used:

- **realistic** (`forbidden-strings.local.example.txt`): 17 rules.
- **synthetic 1k** (`/tmp/claude/synth-rules.txt`): 500 literals + 500 prefixed regex.
- **synthetic 10k worst-case** (`/tmp/claude/synth-rules-10k.txt`): 5000 literals + 3000 prefixed regex + 1000 prefixed set-algebra regex (each rule a `prefix_[0-9]{5}&~(prefix_0{5})` shape exercising resharp's `&` intersection and `~(...)` complement) + 1000 residual-bucket regex (leading character class so the AC prefix walker finds nothing and the rule lands in `residual_combined`).

## Results

Realistic ruleset (17 rules) on Monochromatic, 30 runs:

```text
startup-only       1.2 ms ±  0.2 ms   (user 0.7 ms,  sys 2.1 ms)
--all              15.6 ms ±  1.1 ms  (user 21.7 ms, sys 53.2 ms)
```

Synthetic 1k-rule ruleset on Monochromatic, 30 runs:

```text
startup-only         11.0 ms ±  1.0 ms   (user 58.6 ms,  sys 31.7 ms)
--all                27.1 ms ±  1.7 ms   (user 112.6 ms, sys 88.1 ms)
```

Synthetic 10k-rule ruleset (worst case, includes set-algebra and residual
bucket) on Monochromatic, 30 runs:

```text
startup-only        106.1 ms ±  3.4 ms   (user 580.3 ms, sys 294.6 ms)
--all               120.7 ms ±  2.5 ms   (user 645.7 ms, sys 349.0 ms)
```

Synthetic residual sweep at fixed total = 10000 rules, varying residual %, on the
Linux kernel (93693 files, ~1.5 GiB), 5 runs, 2 warmup:

```text
residual=0     (0%):    627.4 ms ±  21.8 ms   (user 6.676 s, 10.6x parallelism)
residual=100   (1%):    772.6 ms ± 135.3 ms   (user 7.044 s,  9.1x parallelism)
residual=500   (5%):    772.2 ms ± 175.6 ms   (user 7.020 s,  9.1x parallelism)
residual=1000  (10%):   732.9 ms ± 111.7 ms   (user 7.080 s,  9.7x parallelism)
residual=2000  (20%):   680.0 ms ±  26.8 ms   (user 7.212 s, 10.6x parallelism)
```

Every variant lands under 1 s. Parallelism stays at 9-10x cores across the full sweep,
because the substring-extracted residual rules now ride AC instead of the shared
`residual_combined` mutex. The previously parser-rejected residual=2000 case
(`UnsupportedResharpRegex`) now loads via try-and-halve sharding -- and on this
ruleset the bucket is empty post-substring-extraction, so no shard ever runs at all.

Headline numbers compared to original budgets:

Headline numbers vs. original budgets:

- **Original full-repo budget: 5 s.** Realistic `--all` on Monochromatic is 15.6 ms (~320x under). Worst-case 10k rules on Linux kernel ranges 627-773 ms across 0%-20% residual mix (~6-8x under).
- **Original pre-commit budget: 500 ms.** Realistic startup-only is 1.2 ms (~417x under). Worst-case 10k startup is 106 ms (~5x under).
- **End-to-end throughput**, 10k rules on Linux: 1.5 GiB / ~700 ms = **~2.1 GiB/s** sustained. Effective parallelism = ~9-10x cores across all variants.
- **Substring extraction effectiveness:** for the synthetic 10k+10%residual case the residual bucket is fully drained -- every "residual" rule had `_RESID_<tag>_` extractable as a required substring, so `residual_shards` is empty and resharp never runs on the hot path.

Cost shape under the current architecture:

- **Startup is roughly linear in rule count once residual sharding is in place.** 1k rules -> 11 ms; 10k rules -> 106 ms. ~10x cost for ~10x rules. The previous super-linear blow-up came from compiling one giant combined-alternation Regex over the residual bucket; that step is gone for rulesets where the substring walker drains the bucket entirely.
- **Set-algebra and residual paths exercise correctly under load.** `sk_live_81ex_12345` matches the set-algebra rule in the worst-case ruleset; `sk_live_81ex_00000` is correctly excluded by `~(...)`. The residual-shape regex `[a-z]{4}_RESID_<tag>_[A-Za-z0-9]{12}` still matches `random_RESID_<tag>_aBcDeFgHiJkL` correctly via AC-substring fast path -- AC fires on the substring, the rule's own `Regex::find_all` runs on the file and returns the full match.
- **Residual-bucket parallelism restored.** Residual=0/100/500/1000/2000 all hold ~9-10x cores on Linux. The previous architecture collapsed to 4-6x parallelism at the same residual counts because every file went through one shared `Mutex<RegexInner>`; now the residual rules have their own per-rule mutexes (when fired via AC), and the residual_shards bucket is empty for these synthetic cases.

Per-byte scan cost on Linux:
- 10k Linux `--all` minus startup ≈ 700 - 106 ≈ **~600 ms over 1.5 GiB ≈ ~2.5 GiB/s**, consistent across all residual percentages.
- The constant `--all wall ≈ startup + bytes / throughput` now holds across the entire residual-percentage sweep, because the only mutex on the hot path is the per-rule `Mutex<RegexInner>` which is only contended on the rare match path.

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

## When to re-bench

Re-run the commands above and append a dated block to **Last benched** /
**Results** (do not overwrite -- regressions need history) when **any** of:

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
Do not re-derive that analysis on every session -- read the plan, then decide.

Items already resolved in this code base:

- **L2 (line-start index for `line_and_col`)**: shipped 2026-05-02 evening.
  See `## L2 line-start index (shipped)` above.
- **E2 (`mmap` for `--all`)**: tested and rejected 2026-05-02 evening with
  apples-to-apples bench data. See `## Mmap experiment (rejected)` above.
  Do not re-attempt without input file sizes shifting to >> 1 MiB averages.
- **E1 (extension/size pre-filter)**: rejected by user policy
  (rule must scan files regardless of extension/size to catch
  accidentally renamed files and adversarial agent-generated content).

## Pre-substring-extraction baseline (historical, 2026-05-02 morning)

Before the substring-extraction patch, `extract_required_prefix` only handled
leading literals, and the residual bucket was fed into a single
`residual_combined` Regex. This held the architecture back from sub-1 s on
the 10k-rule Linux benchmark and made the 2000-residual case fail to load.
The numbers below are kept for regression detection -- if a future change
moves any of them in the bad direction, that's a signal something regressed.

Synthetic 10k-rule on Monochromatic, 30 runs (15 for `--all`):

```text
startup-only         565.7 ms ± 20.3 ms
+1 tiny clean file   549.9 ms ±  9.5 ms
+1 violating file    559.0 ms ± 15.8 ms
--all                569.5 ms ±  8.3 ms
```

Synthetic 10k-rule (10% residual) on Linux kernel, 5 runs:

```text
--all              1.515 s ± 0.086 s
```

Synthetic residual sweep at fixed total = 10000 rules on Linux, before patch:

```text
residual=0     (0%):    756.5 ms ± 136.5 ms   (9.5x parallelism)
residual=100   (1%):   1087.0 ms ±  46.0 ms   (5.9x parallelism)
residual=500   (5%):   1212.0 ms ± 177.0 ms   (5.3x parallelism)
residual=1000  (10%):  1592.0 ms ± 149.0 ms   (4.2x parallelism)
residual=2000  (20%):  -- resharp parser rejected combined pattern
```

The cliff at the first residual rule (757 ms -> 1087 ms going from 0 -> 100
residual) was the single shared `Mutex<RegexInner>` on the residual gate
serializing all 16 threads' `is_match` calls per file. The 2000-residual
parser rejection was `regex_syntax::hir::translate` refusing the
~470 KB combined alternation source.

The current architecture eliminates both: substring extraction routes those
rules onto AC (per-rule mutexes, no shared contention), and what little
remains in the residual bucket is sharded at runtime so no single combined
alternation crosses the parser cliff.
