# Handover: resharp rust fuzz campaign (2026-06-04)

Living handover for the resharp fuzzing effort. Context is expected to compact
repeatedly, so this file is the source of truth for resuming. Update it as state
changes. The detailed per-bug writeups live in
`docs/audit/resharp-fuzz-2026-06-04/`.

## Mission and goal

Find as many real bugs as possible in `ieviev/resharp` (the Rust engine) at
current `main` (the version with the two recently merged fuzzing-enablement
PRs). Active goal: at least 20 distinct bugs. The user has a fork
(`Aquaticat/resharp`) and prior bug tracking in `docs/troubleshooting/resharp.md`
and `docs/handover/resharp-panic-fix.md`.

## Environments and paths (all under /tmp/agent, recreate if missing)

- Pristine rust clone (do not modify): `/tmp/agent/resharp-fuzz-20260604`.
- Suppressed rust fork (two re-entrancy panics turned into `return None`, plus
  `REPRO=1` self-describe prints in the fuzz targets):
  `/tmp/agent/resharp-fork-20260604`.
- Rust reproducer and oracle crate (depends on the pristine engine by path,
  built with debug-assertions and overflow-checks on to match cargo-fuzz):
  `/tmp/agent/repro`, binary `/tmp/agent/repro/target/release/repro`.
- Dotnet reference clone (much stabler reference impl of the same RE# semantics):
  `/tmp/agent/resharp-dotnet-20260604`. Builds with .NET 10
  (`mise install dotnet@10.0.300`,
  binary `/home/user/.local/share/mise/installs/dotnet/10.0.300/dotnet`).
- Dotnet differential harness (F#):
  `/tmp/agent/dnharness`, dll `/tmp/agent/dnharness/bin/Release/net10.0/dnharness.dll`.
- Lean ground-truth repos (Zhuchko et al., executable POSIX oracle), available
  under `~/Downloads`: `extended-regexes` (most likely the ERE-with-lookarounds
  formalization used as the paper's oracle), plus `ereq-derivatives`,
  `finiteness-derivatives`, `RLTL-derivatives`, `re-sharp-smt`. Not built yet.
- Paper text: `/tmp/agent/paper.txt` (from
  `/var/home/user/Downloads/3704837.pdf`). Lean paper PDF also in `~/Downloads`.
- Generators and helpers: `/tmp/agent/gen2.py`, `gen3.py`, `minimize.py`,
  `unesc.py`, pattern files `patterns2.txt`, `patterns3.txt`, `patterns_all.txt`.
- Sweep outputs: `/tmp/agent/sweep_combined.txt` (the big 159k-pattern oracle
  sweep), `sweep2.txt`/`sweep_gen2_mixed.txt` (earlier). Working notes:
  `/tmp/agent/findings.md`.

## Tooling and how to run it

Build repro (after editing): `cd /tmp/agent/repro && cargo build --release`.

- Single-pattern oracle sweep (internal invariants + cross-engine + hardened +
  stream), over a built-in haystack set, all 6 option modes:
  `repro '<pattern>' --sweep` then grep the output prefixes.
- Single explicit haystack: `repro '<pattern>' <hex> --hex`.
- Batch differential mode (DEFAULT option mode only), reads stdin lines
  `<hexpattern> <hexhaystack>`, prints `im=<0/1>|fa=<s:e,...>|le=<n>` or
  `err=...` or `err=panic`, one per line:
  `repro --batch < pairs.txt`.

Dotnet reference (same protocol, the trusted oracle):
`DOTNET=/home/user/.local/share/mise/installs/dotnet/10.0.300/dotnet`
`$DOTNET /tmp/agent/dnharness/bin/Release/net10.0/dnharness.dll < pairs.txt`.

Differential: build a pairs file of ASCII patterns and ASCII haystacks (hex of
each, space separated), feed to both, diff line by line. A line where they
differ and neither is a parse/compile error is a candidate bug, with dotnet as
the more trusted side. Both run multiline-on, `_` = any char including newline,
`.` = any except newline, case-insensitive off. Restrict to ASCII so byte
offsets (rust) align with char offsets (dotnet) and `\w` width matches.

Rebuild dnharness: `cd /tmp/agent/dnharness && DOTNET_CLI_TELEMETRY_OPTOUT=1 $DOTNET build -c Release`.

## Oracle prefixes emitted by `repro --sweep`

- `PANIC|<file:line msg>|mode=..|hay=..|pat=..` any panic or abort.
- `BOUNDS` find_all match with end>len or start>end.
- `OVERLAP` find_all matches overlap or out of order.
- `INCONSIST` is_match disagrees with find_all non-emptiness.
- `ANCHOR` find_anchored start is not 0.
- `HARDDIFF_FA`/`HARDDIFF_IM` default vs hardened find_all/is_match differ.
- `HARDPANIC_FA`/`HARDPANIC_IM` default panics where hardened does not (or vice
  versa).
- `STREAMBOUNDS`/`STREAMOVERLAP`/`STREAMINCONSIST` the stream path
  (`re.stream`) is out of bounds, overlapping, or disagrees with is_match.
- `DIVERGE` resharp ascii mode vs the `regex` crate (only trust pure-ascii
  haystacks, no anchors, no resharp-only operators).

## Key semantic facts (from the paper and source)

- RE# semantics: leftmost-longest (POSIX-style). `_` is any char including
  newline; `.` excludes newline; `^`/`$` are line anchors (multiline on by
  default); `\A`/`\z` always anchor the whole input.
- `is_match`, `find_all`, `find_anchored` are substring search (match anywhere),
  not full-string.
- `NO_MATCH = usize::MAX` (`engine.rs:12`). It must never reach a `Match`.
- The bugs are mode-specific. Each oracle mode catches a different class:
  - default mode: catches the BUG-2 panic and any wrong default-mode find_all.
  - ascii mode: catches BUG-7 (negated perl classes nullable).
  - flags mode (multiline off): catches BUG-4 (usize::MAX leak).
  - hardened: catches BUG-8 (optimized vs general find_all). dotnet agrees with
    rust default here, so the hardened path is the wrong side.
  - stream path: catches BUG-9 (stream drops zero-width and other matches).
- The Lean paper notes the engine's historically bug-prone areas are exactly
  input-edge handling and off-by-one in reversal, which matches BUG-2/4/9.

## Bugs found so far (see docs/audit/resharp-fuzz-2026-06-04/ for full writeups)

Nine root causes (BUG-1, 2, 3, 4, 7, 8, 9, 10, 11), each with its own file, and
20 numbered distinct minimal reproducers in that dir's `README.md`.

1. BUG-1 re-entrancy guard panic in union and intersection rewrites (compile
   time). `.*(.+)*.+`.
2. BUG-2 `correctness issue found` assertion at `engine.rs:960` (NO_MATCH
   sentinel reaches a Match). `\S+b` on `b'_`.
3. BUG-3 is_match disagrees with find_all. `(\z|(?=a)\w)`, `((?=0)\S|\z)`, `\BU`,
   `\z\A(?:a){0,1}` on empty.
4. BUG-4 find_all emits `end = usize::MAX`. `~(_*$)` (flags), `\Bb+`,
   `(?<=[^a])b+` (default mode).
5. BUG-7 negated perl classes `\D \S \W` nullable in ascii mode. `\D`.
6. BUG-8 hardened find_all wrong vs default. `~(_a+)`, `~(\D+)`.
7. BUG-9 stream path under-reports. `\A\z?`, `(^|b)`, `(?<!b)`. 707 distinct
   `STREAMINCONSIST` triggers.
8. BUG-10 default find_all drops a trailing zero-width match (hardened and dotnet
   include it). `(?<=^)~(0+)`. Opposite side from BUG-8.
9. BUG-11 super-linear compile time on small patterns. `[\w]{3,5}[\w]([^a]&a+)`
   compiles in about 4 seconds, dotnet is instant. Compile-time, not match-time.

Counting note: hundreds of distinct triggering patterns cluster into these nine
root causes. The dotnet differential is still running and may add more
default-mode find_all correctness bugs after adjudication.

## Current state and next steps

- Done: built all three in-tree fuzz targets, ran fork campaigns (low yield once
  BUG-1 suppressed), built the directed pristine oracle (`repro`), ran an 80k and
  a 159k pattern sweep, built the dotnet differential harness and validated it.
- In progress: run the large rust-default vs dotnet differential over many ASCII
  pairs to enumerate new default-mode correctness bugs; then rust-hardened vs
  dotnet and rust-ascii vs dotnet to enumerate the BUG-8 and BUG-7 clusters with
  dotnet as referee.
- Not started: build the Lean executable oracle (strongest evidence) from
  `~/Downloads/extended-regexes`.
- Persist each new confirmed bug as `docs/audit/resharp-fuzz-2026-06-04/bug-NN-*.md`
  and update that dir's `README.md` index and this handover.

## Dotnet differential status and adjudication

The rust-default vs dotnet differential runs over ASCII (pattern, haystack)
pairs (`/tmp/agent/pairs_all.txt`, 560k pairs from 40k patterns by 14 ascii
haystacks), split into 16 chunks under `/tmp/agent/diffwork`. Dotnet outputs are
`dn_NN.txt`, rust outputs `rs_NN.txt`, both line-aligned with `chunk_NN.txt`. The
classifier is `/tmp/agent/diff.py`, output `/tmp/agent/diffwork/divergences.txt`.

Divergence classes (rust vs dotnet, dotnet is the stabler but not bug-free side):

- `IM_DIFF` is_match differs. Strongest signal. Adjudicate each by reasoning.
- `FA_DIFF` find_all match set differs. Watch for empty-match convention noise.
- `LE_DIFF` find_anchored / LongestEnd differs.
- `RUST_PANIC` rust panics where dotnet returns. Clear rust bug.
- `RUST_TIMEOUT` rust exceeds 2s where dotnet is fast. Compile or match time
  blowup in rust (the engine claims input-linear, so this is a real bug class).
- `RUST_OK_DN_REJECT` and `RUST_REJECT_DN_OK` are acceptance differences (one
  engine supports a shape the other rejects). Lower priority and noisy.

Adjudication is required because dotnet has its own bugs. Confirmed examples of
each direction seen so far:

- Rust wrong: `\z\A(?:a){0,1}` on empty returns no match in rust, but both
  anchors hold at position 0 so the empty match exists (dotnet correct).
- Dotnet wrong: `\w&\zb` is the empty language (a span cannot be a word char and
  also sit after end of input), so rust `im=0` is correct and dotnet `im=1` is
  the dotnet bug. Same for the `\z\z`-branch `LE_DIFF` where dotnet reports an
  anchored match at 0 that cannot exist.

So treat the differential as a candidate generator, not an oracle. Reason out the
correct answer for each distinct pattern (documented semantics: leftmost-longest,
`\z`/`\A` whole-input anchors, multiline `^`/`$`), and only file a rust bug when
rust is demonstrably wrong. The Lean formalization in `~/Downloads/extended-regexes`
is the tie-breaker ground truth and is the next tool to stand up.

## Conventions for the writeups

Follow repo prose rules: no em-dashes or en-dashes used as em-dashes, sentence
case headings, ATX headers, fenced code with language tags, lines under 120
chars, no tables, no emojis. Each bug file has a self-contained reproducer
(rust snippet plus `repro`/`dnharness` command), observed vs expected, affected
modes, source location when known, and the relationship to other bugs.
