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
- Lean ground-truth oracle, built and working: `~/Downloads/extended-regexes`
  (Zhuchko, Veanes, Ebner). Toolchain via elan (`~/.elan/bin`), lean4
  v4.24.0-rc1, mathlib via `lake exe cache get`. Build a module with
  `lake build Regex.MatchingAlgorithm Regex.Examples` (the default `Regex` lib
  target fails because there is no `Regex.lean` root, which is fine). Run evals
  with `lake env lean <file>.lean` from the repo dir; `#eval IO.println (...)`
  prints to stdout. Helper pipeline: `/tmp/agent/re2lean.py` (RE# to Lean term,
  non-anchor subset), `/tmp/agent/gen_lean.py` (emit per-pair `#eval` file plus
  aligned hex pairs), `/tmp/agent/diff_lean.py` (diff vs rust). Sibling repos
  `ereq-derivatives`, `finiteness-derivatives`, `RLTL-derivatives`,
  `re-sharp-smt` are also in `~/Downloads`.
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
10. BUG-12 negative lookahead of a class makes a non-nullable pattern nullable,
    so is_match and find_all both report a spurious empty match. `(?!\w)0+` on
    the empty string. Found only by the Lean ground truth (self-consistent, so
    invisible to the internal oracles); confirmed by dotnet.

Counting note: ten distinct root causes, 22 numbered minimal reproducers, and
hundreds to thousands of distinct triggering patterns across the oracles.

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

## Resume point (2026-06-04 15:05, post-compaction)

Status: 13 root causes (BUG-1, 2, 3, 4, 7, 8, 9, 10, 11, 12, 13, 14, 15) and 27
numbered reproducers are committed under `docs/audit/resharp-fuzz-2026-06-04/`.
Latest commits: `272e8415` (BUG-13 plus a BUG-3 lookbehind trigger), `a8fa9f64`
(BUG-14), `c8fbd22b` (limits inventory), `94ef9d77` (BUG-15 anchor panic),
`9d9fe19e` (unbounded_size config confirm).

Done since the last resume point:

- lean2 round harvested (BUG-13, BUG-14, a BUG-3 lookbehind trigger).
- Anchor round COMPLETE and harvested. Encoding validated 19/19; only 1
  encoding-suspect case in the whole 54000-pair round, so the anchor encoding is
  faithful. Headline: BUG-15, the `\z\A` reversed-anchor DFA panic
  (`engine.rs:550` index out of bounds, all configs) plus the regex-crate-
  corroborated missed empty match.
- Limits inventory written: `limits-and-recommendations.md`. Every compile-time
  limit classified fundamental (lazy quantifiers, backreferences, swap-greed) vs
  implementable (trailing and mid-pattern lookbehind, lookaround as last factor in
  complement or star, special word boundaries) vs tuning (size caps, class
  ranges), with a recommendation each. Uses the Lean algebra
  (`Regex/Definitions.lean`) as the arbiter; dotnet is only a secondary data
  point, not a reference (user directive).
- Config coverage extended. `repro` now sweeps seven `RegexOptions` configs (added
  `unbounded_size(true)`, the one it missed). Full surface: `unicode` (4 modes),
  `multiline`, `hardened`, `unbounded_size`, plus translator flags
  `dot_matches_new_line`, `case_insensitive`, `ignore_whitespace`. BUG-15 panics
  in all seven; no existing trigger produced an unbounded-only violation. Rebuilt
  `repro` binary reflects this (`mk` in `/tmp/agent/repro/src/main.rs`, loop
  `0..7`).

Methodology correction from the user, applied going forward: the Lean
formalization is THE reference. dotnet is not a reference (it is also immature);
use it only as another implementation to look at. The bugs filed this session
(BUG-13, 14, 15) all rest on Lean plus a rust-internal inconsistency or the regex
crate, never on dotnet.

Held back, not filed (translation-faithfulness unverified): the anchor round's
`(?<=$)` cluster (lookbehind containing an anchor), e.g. `(_{0,1}&(?<=$))` on
`\n` (rust 1:1, Lean 0:0) and `(?=(?<=$) *)[^a]*` on `\n` (rust 1:1, Lean 0:1).
First-principles reasoning leans toward rust being wrong, but lookbehind-of-anchor
is the same translator shape that was unfaithful in lean2, so these need RE#
lookbehind-of-anchor semantics confirmed (paper or resharp source) before filing.

Panic hunt complete (big result). A new `repro --panicbatch` mode (reads hexpats
on stdin, streams the builtin haystack set across all 7 configs under
catch_unwind, prints only PANIC lines) swept the 12000-pattern corpus. BUG-15 is
not `\z\A`-specific: 2396 distinct patterns panic at `engine.rs:550` via the
`stream` API (intersection 1688, lookarounds 413, anchors the rest). Minimal:
`Regex::new("a&b").unwrap().stream(b"aaa")` (fresh regex, one `stream` call,
3+-byte input; `is_match`/`find_all`/`find_anchored` never reach it). The hunt
found only two crash sites total: `engine.rs:550` (BUG-15) and `engine.rs:960`
(BUG-2, 16 patterns). New debug mode `repro --stream1 <hexpat> <hexhay>` builds a
fresh regex and streams one haystack, for isolating single-call panics.

No in-flight background jobs. All Lean rounds complete. To run a new round, reuse
the recipe below and harvest with `adj_full.py` (treat Lean as ground truth, dotnet
as a hint).

Remaining avenues (for more root causes): deepen the stream-panic root cause (read
the `stream` DFA driver and `create_state` allocation in
`resharp-engine/src/engine.rs`); the held-back `(?<=$)` lookbehind-of-anchor
cluster (needs RE# semantics confirmed); per-mode Lean rounds (ascii, flags,
hardened) since BUG-4/7/8 are mode-specific; the stream crash blocks stream-result
checking on 2396 patterns, so more stream-correctness bugs may hide behind it.

Adjudication tooling now in place (reusable for any future round):

- `/tmp/agent/adj_full.py <out_prefix> <rust_file> <pairs_file>`: full three-way
  bucket sort (RUST_WRONG, ENCODING_SUSPECT, UNADJUDICATED, 3WAY).
- `/tmp/agent/adj.py`, `adj2.py`, `adj3.py`: focused minimal-case probes (edit the
  CASES list). All set `DOTNET_ROOT` via the env (see below).
- dotnet harness needs `DOTNET_ROOT=/home/user/.local/share/mise/installs/dotnet/10.0.300`
  exported (fresh shells do not have it). Binary
  `/tmp/agent/dnharness/bin/Release/net10.0/dnharness`, reads `<hexpat> <hexhay>`
  per line, prints `im=..|fa=..|le=..` or `err=UnsupportedPatternException`.

Rust side for any Lean round: parallelise `repro --batch` 16-way (single-process
is the bottleneck). Split pairs with `split -n l/16 -d --additional-suffix=.p`,
run `repro --batch < chunk > Arust_NN`, then `cat Arust_*.txt > rust.txt` (glob
sorts numerically, preserving index alignment).

Throughput gotchas learned:

- A stray `dnharness`/`lean` process can hang for an hour on one pathological
  pattern and steal a core. Check `ps -eo pid,pcpu,comm --sort=-pcpu` and kill
  the stray by PID. `ffmpeg` in that list is the user's VideoDownloader, leave it.
- `pkill -f '<pattern>'` matches its own shell. Kill via a script file that
  reads `/proc/*/cmdline` (see `/tmp/agent/killsweep.py`) or by explicit PID.
- Lean elaboration is about 0.2s per `#eval` for non-anchor terms but slower for
  anchor terms (big nested-lookaround `\b` encodings), so the anchor round is
  roughly 60 minutes not 20. Each `lake env lean` reloads mathlib oleans, so do
  not run more than about 16 concurrently.
- `le` in `repro` output is `find_anchored(hay).end` (anchored at offset 0), not a
  general longest-end. It is only comparable to `find_all`'s first span when that
  span also starts at 0.

Further avenues not yet done: harvest the anchor round (in flight); full
41445-pattern non-anchor sweep (only 1200 and 6000 sampled so far); longer
haystacks for deeper position bugs; per-mode Lean rounds (ascii, flags, hardened)
since BUG-4/7/8 are mode-specific.

## Conventions for the writeups

Follow repo prose rules: no em-dashes or en-dashes used as em-dashes, sentence
case headings, ATX headers, fenced code with language tags, lines under 120
chars, no tables, no emojis. Each bug file has a self-contained reproducer
(rust snippet plus `repro`/`dnharness` command), observed vs expected, affected
modes, source location when known, and the relationship to other bugs.
