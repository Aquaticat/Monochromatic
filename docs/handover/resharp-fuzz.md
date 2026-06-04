# Handover: resharp rust fuzz campaign (2026-06-04)

Living handover for the resharp fuzzing effort. Context compacts repeatedly, so
this file is the single source of truth for resuming with zero rediscovery. The
per-bug writeups live in `docs/audit/resharp-fuzz-2026-06-04/`. Update this file
as state changes.

## Mission and goal

Find as many real bugs as possible in `ieviev/resharp` (the Rust engine) at
current `main` (the version with the two recently merged fuzzing-enablement PRs).
The user maintains a fork (`Aquaticat/resharp`). resharp is a derivative-based
automaton regex engine with intersection `&`, complement `~`, lookarounds, and
leftmost-longest (POSIX) semantics, multiline on by default.

## Current status (2026-06-04 15:55)

16 distinct root causes (BUG-1, 2, 3, 4, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17,
18; 5 and 6 folded) and 30 numbered reproducers committed under
`docs/audit/resharp-fuzz-2026-06-04/`. Distinct triggering patterns run to the
thousands (BUG-15: 28688 distinct patterns in the full 159k hunt). All work is
committed. The user wants maximum yield ("poke resharp until it's a honeycomb").

A bug is not only a panic or a wrong answer. ieviev's invariant: with the size
limits NOT disabled, nothing should take >= 10s. So under any limits-enabled config
(0..5; the `unbounded` config 6 disables limits and is EXEMPT), a single
compile/match op taking >= 10s is a bug, and >= 1s is suspicious and must be
documented (a clearly-pathological >= 1s case counts as a full bug). This produced
the timing oracle (`--time1`) and three performance bugs:

- BUG-16: lookbehind of a positive lookahead is ~O(n^3) at match time. `(?<=$)`
  find_all is 13s on 512 bytes (`$` desugars to a lookahead; the inner lookahead
  never reaches a fixpoint so the lazy DFA mints a state per offset).
- BUG-17: a perl shorthand inside a character class (`[\w]` vs bare `\w`) makes
  bounded-repeat compile super-linear. `([\w]{3,5}){3,3}` compiles in 15s; bare
  `(\w{3,5}){3,3}` is 20ms. Likely the real root cause of BUG-11.
- BUG-18: `find_all` is O(n^2) on a nullable complement (`~(a+)`, `~(\w+)`) because
  `find_all_nullable_slow` restarts a forward scan per position. `~(a+)` is 10.5s
  on 96KB; hardened (different driver) is linear, so the quadratic is avoidable.

Caveat that shaped the method: timing flagged under CPU contention is INFLATED
(the timing hunt ran -P4 alongside the panic hunt), so it over-flags. Re-measure
every candidate SOLO before filing: contention can inflate a 0.3s op past 1s but
cannot fake a >25s hang, and it cannot turn a linear op super-linear. The three
filed bugs are all solo-confirmed with clean scaling curves.

### The reference is Lean, not dotnet (user directive, 2026-06-04)

The Lean formalization is THE reference (verified ground truth). The dotnet engine
(`ieviev/resharp-dotnet`) is NOT a reference; it is immature too. Use dotnet only
as a secondary "another implementation to look at," never as an arbiter. Every bug
filed rests on Lean plus a rust-internal inconsistency or the `regex` crate, never
on dotnet alone.

## Environments, clones, and key paths

All scratch lives under `/tmp/agent` (recreate with `mkdir -p /tmp/agent; chmod 700
/tmp/agent` if missing). Do not delete audit artifacts there; the user cleans up.

- Pristine rust clone (do not modify, all reproducers confirmed here):
  `/tmp/agent/resharp-fuzz-20260604`. Engine crate
  `resharp-engine/src/engine.rs`, parser `resharp-parser/src/lib.rs`, algebra
  `resharp-algebra/src/lib.rs`.
- Suppressed rust fork (two re-entrancy panics turned into `return None` to dig
  past BUG-1; equals release semantics): `/tmp/agent/resharp-fork-20260604`.
- Rust reproducer and oracle crate (depends on the pristine engine by path, built
  release with debug-assertions and overflow-checks on to match cargo-fuzz):
  `/tmp/agent/repro`, binary `/tmp/agent/repro/target/release/repro`. Rebuild
  after editing: `cd /tmp/agent/repro && cargo build --release` (raw `cargo` is
  correct here; this crate is NOT part of the Monochromatic workspace, so the
  no-raw-tools rule does not apply).
- Dotnet clone (secondary, not a reference): `/tmp/agent/resharp-dotnet-20260604`.
- Dotnet harness (F#), a NATIVE binary (not a dll):
  `/tmp/agent/dnharness/bin/Release/net10.0/dnharness`. Reads `<hexpat> <hexhay>`
  lines on stdin, prints `im=..|fa=..|le=..` or `err=UnsupportedPatternException`
  or `err=...`. REQUIRES `export
  DOTNET_ROOT=/home/user/.local/share/mise/installs/dotnet/10.0.300` in any fresh
  shell, or it prints "You must install .NET". Rebuild: `cd /tmp/agent/dnharness
  && DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_ROOT=... <dotnet> build -c Release`.
- Lean reference: `/var/home/user/Downloads/extended-regexes` (Zhuchko, Veanes,
  Ebner). Toolchain via elan; need `export PATH="$HOME/.elan/bin:$PATH"`. lean4
  v4.24.0-rc1, mathlib already cached. The `RE` algebra is in
  `Regex/Definitions.lean` (constructors: `ε Pred Alternation(⋓) Intersection(⋒)
  Concatenation(⬝) Star(*) Negation(~) Lookahead(?=) Lookbehind(?<=)
  NegLookahead(?!) NegLookbehind(?<!)`). `llmatch` (in
  `Regex/MatchingAlgorithm.lean`) is leftmost-longest. `EliminationNegLookarounds
  .lean` proves negative lookarounds are eliminable with primitive anchors (a
  rewrite roadmap for the complement-of-lookaround limit). Run an eval file:
  `cd /var/home/user/Downloads/extended-regexes && export PATH="$HOME/.elan/bin:$PATH"
  && lake env lean <file>.lean` (prints `#eval IO.println` lines to stdout).
- Paper: `/var/home/user/Downloads/3704837.pdf`, text at `/tmp/agent/paper.txt`.

## Tooling: exact invocations

### repro (the rust oracle)

`mk(idx)` in `/tmp/agent/repro/src/main.rs` defines SEVEN configs swept by
`--sweep` (config-affectedness matters; BUG-4/7/8 are config-specific):
`0 default, 1 ascii (unicode=Ascii), 2 full (unicode=Full), 3 js
(unicode=Javascript), 4 hardened, 5 flags (case_insensitive + ignore_whitespace +
dot_matches_new_line + multiline=false), 6 unbounded (unbounded_size=true)`. Full
`RegexOptions` surface: `unicode`x4, `multiline`, `hardened`, `unbounded_size`,
plus translator flags `dot_matches_new_line`, `case_insensitive`,
`ignore_whitespace`.

- `repro '<pattern>' --sweep`: builds the pattern in all 7 configs, runs
  is_match, find_all, find_anchored, AND `re.stream` over a built-in haystack set,
  prints one line per oracle violation. Oracle prefixes below.
- `repro '<pattern>' <hex> --hex`: single explicit haystack.
- `repro --pair <hexpat> <hexhay>`: DEFAULT config only; builds fresh, runs
  is_match + find_all + find_anchored (NOT stream); prints `<hexpat>\t<hexhay>\t
  im=<0/1>|fa=<s:e,...>|le=<n>` (or `err=compile`/`err=panic`). `le` is
  `find_anchored(hay).end` (anchored at offset 0), NOT a general longest-end; it
  is only comparable to find_all's first span when that span starts at 0. This is
  the workhorse for single-case checks.
- `repro --batch < pairs.txt`: stdin `<hexpat> <hexhay>` lines, DEFAULT config,
  prints `im=|fa=|le=` per line, with a 2000ms-per-pattern watchdog thread that
  prints `err=timeout` on slow-compile patterns. Used for the Lean-round rust side.
- `repro --panicbatch < hexpats.txt`: stdin one `<hexpat>` per line; for each
  pattern and all 7 configs, streams the built-in haystack set under
  catch_unwind; prints ONLY `PANIC|<file:line msg>|mode=..|hay=..|pat=<hexpat>`.
  This is the crash hunter; it MUST call `re.stream` (BUG-15 only fires via
  stream).
- `repro --stream1 <hexpat> <hexhay>`: builds a fresh regex, calls `re.stream`
  once on the one haystack, prints `ok` or `PANIC <loc msg>`. Isolates
  single-call stream panics.
- `repro --time1 <hexpat>`: the TIMING ORACLE. Times compile across configs 0..5
  (limits-enabled; skips 6/unbounded) and is_match/find_all/find_anchored/stream
  under default(0)+hardened(4) over a 3-haystack battery (`a1k`, `cyc16k`, `a64k`).
  Prints `SLOW|<secs>|op=..|mode=..|hay=..|pat=<hexpat>` for any op >= 1.0s. A
  watchdog thread fires at 25s, printing `TIMEOUT|>25|op=..|mode=..|hay=..|
  pat=<hexpat>` then `process::exit` (so a hard hang is attributed to the op in
  flight). NOTE: match-op timing currently runs all six configs 0..5 (the
  `if midx != 0 && midx != 4` skip was removed per the all-config request). Run
  the corpus with `xargs -P<n> -n1 -I{} timeout 35 repro --time1 {}`; lower `-P`
  to avoid contention inflating times.
- `repro --bench1 <hexpat> <hexhay> <op> [cfgidx]`: one config, one op
  (is_match/find_all/find_anchored), prints seconds. For solo confirmation. Hay on
  argv, so keep it small.
- `repro --benchrep <hexpat> <bytehex> <N> <op> [cfgidx]`: builds hay = byte*N
  INTERNALLY (argv cannot carry a 64KB+ hex hay; "Argument list too long"). This is
  the scaling workhorse: vary N to read off O(n)/O(n^2)/O(n^3).
- `repro --compile1 <hexpat> [cfgidx]`: prints `<secs>|ok=<bool>` for compile only.
  Used to isolate BUG-17 (compile-time blowup).

### dnharness (dotnet, secondary)

`export DOTNET_ROOT=/home/user/.local/share/mise/installs/dotnet/10.0.300` first.
`echo '<hexpat> <hexhay>' | /tmp/agent/dnharness/bin/Release/net10.0/dnharness`.
Throws `err=UnsupportedPatternException` on constructs it cannot parse (nested
lookarounds, some complements, alternation-with-lookbehind). Useful only as a hint.

### Lean oracle pipeline

- `/tmp/agent/re2lean.py`: translates an RE# pattern to a Lean `RE (BA Char)`
  term. Encodes anchors as lookarounds: `\A`=`(?<! _)`, `\z`=`(?! _)`,
  `^`=line-start lookbehind, `$`=line-end lookahead, `\b`/`\B`=word-boundary
  lookaround pairs. Validated 19/19 against known answers (see below). KNOWN
  UNFAITHFUL for lookbehind whose body contains a lookahead or anchor
  (`(?<=(?=...)...)`, `(?<=$)`); do not trust Lean disagreements on those shapes.
- The `sp` helper used in generated files:
  `def sp (r) (s) : String := match llmatch r s.toList with | some x =>
  toString x.i ++ ":" ++ toString x.j | none => "none"`. Output line format is
  `R<idx> <i:j>` or `R<idx> none`.
- Generators: `/tmp/agent/gen_lean2.py` (non-anchor leftmost-longest position
  round), `/tmp/agent/gen_lean_anchor.py` (anchor round). Each emits a `.lean`
  file (header + 54000 `#eval` lines) plus an aligned `<...>_pairs.txt`
  (`<hexpat> <hexhay>` per line, index-aligned to the `R<idx>` lines).
- Encoding validator: `/var/home/user/Downloads/extended-regexes/leanval2.lean`
  (19 known-answer anchor cases) vs `/tmp/agent/val_expected.txt`. Run before
  trusting any anchor round; all 19 must match.
- Chunked Lean run recipe (the only way a 54k-eval round finishes in reasonable
  time; ~0.2s/eval non-anchor, slower for anchor terms; do not exceed ~16
  concurrent `lake env lean` since each reloads mathlib oleans):

  ```sh
  cd /var/home/user/Downloads/extended-regexes
  export PATH="$HOME/.elan/bin:$PATH"
  head -3 /tmp/agent/<round>.lean > /tmp/agent/hdr.txt
  tail -n +4 /tmp/agent/<round>.lean > /tmp/agent/ev.txt
  split -n l/16 -d --additional-suffix=.e /tmp/agent/ev.txt /tmp/agent/Chunk_
  for f in /tmp/agent/Chunk_*.e; do n=$(basename "$f" .e|sed 's/Chunk_//'); cat /tmp/agent/hdr.txt "$f" > "<round>_chunk_$n.lean"; done
  for f in <round>_chunk_*.lean; do n=$(basename "$f" .lean|sed 's/<round>_chunk_//'); timeout 1800 lake env lean "$f" 2>/dev/null | grep '^R' > "<round>_out_$n.txt" & done; wait
  ```

  The `<round>_out_*.txt` files land in the extended-regexes dir, NOT /tmp/agent.

- Rust side of a round (parallelize; single-process `--batch` is the bottleneck):
  `split -n l/16 -d --additional-suffix=.p <round>_pairs.txt /tmp/agent/Rp_`;
  run `repro --batch < Rp_NN > /tmp/agent/Rr_NN` in parallel; then
  `cat /tmp/agent/Rr_*.txt > <round>_rust.txt` (glob sorts numerically, preserving
  index alignment).

### Adjudication scripts

- `/tmp/agent/adj_full.py <out_prefix> <rust_file> <pairs_file>`: the three-way
  harvester. Loads Lean `<out_prefix>*.txt` from the extended-regexes dir, rust
  results, and pairs; for every (pattern,haystack) where valid rust disagrees with
  Lean, batches it through dnharness and buckets: `RUST_WRONG` (dotnet AND Lean
  contradict rust; strongest), `ENCODING_SUSPECT` (dotnet agrees with rust against
  Lean; translation likely unfaithful, discard), `UNADJUDICATED` (dotnet threw),
  `3WAY` (all differ). Treat RUST_WRONG as candidates, verify translation is a
  faithful shape (not lookbehind-of-lookaround), then minimize.
- `/tmp/agent/diff_lean_span.py <leandir> <out_prefix> <rust_file> <pairs_file>`:
  Lean-vs-rust only; reports POSITION_DIFF and EXIST_DIFF counts and distinct
  patterns.
- `/tmp/agent/adj.py`, `adj2.py`, `adj3.py`: focused minimal-case probes; edit the
  `CASES` list and run with `DOTNET_ROOT` exported. Template for new probes.

## Oracle prefixes emitted by repro --sweep

- `PANIC|<file:line msg>|mode=..|hay=..|pat=..` any panic, assert, or abort.
- `BOUNDS` find_all match with end>len or start>end. `OVERLAP` overlapping or
  out-of-order find_all. `INCONSIST` is_match disagrees with find_all
  non-emptiness. `ANCHOR` find_anchored start not 0.
- `HARDDIFF_FA`/`HARDDIFF_IM` default vs hardened differ. `HARDPANIC_*` default
  panics where hardened does not. `STREAMBOUNDS`/`STREAMOVERLAP`/`STREAMINCONSIST`
  the `re.stream` path is out of bounds, overlapping, or disagrees with is_match.
- `DIVERGE` resharp ascii mode vs the `regex` crate built `.unicode(false)` (trust
  only pure-ascii haystacks, no anchors, no resharp-only operators). The `regex`
  crate is a second independent oracle for the shared syntax subset.

Self-consistency oracles (INCONSIST, BOUNDS, OVERLAP, HARDDIFF, STREAM*,
find_anchored-vs-find_all) need no external reference: a single engine
contradicting itself is unambiguous.

## Source-code map (pristine clone)

- `resharp-engine/src/engine.rs:12` `NO_MATCH = usize::MAX` sentinel; must never
  reach a Match (BUG-2, BUG-4).
- `engine.rs:550` `create_state` reads `state_nodes[state_id]`; panics when the
  caller passed an unregistered id (BUG-15 crash site).
- `engine.rs:960` `assertion left != right: correctness issue found` (BUG-2).
- `engine.rs:1249` `scan_rev_from` reverse-scan loop calls `create_state(b, curr)`
  with NO preceding `ensure_capacity(curr)`, unlike `lazy_transition_slow`
  (`:414`-`:415`) and the block matchers (`:415`-`:416`, `:441`-`:442`). This is
  BUG-15's root cause; reached only via `stream` -> `try_emit_step`
  (`stream.rs:247`). Audit siblings at `engine.rs:1098` and `:1185`.
- Parser limits: `ensure_lookbehind_at_start` `resharp-parser/src/lib.rs:479`
  (lookbehind must be leftmost); `ClassRangeLiteral` `:305` (`[\d-a]`);
  `UnsupportedLazyQuantifier` `:2275`,`:2363`; `UnsupportedBackreference` `:2621`;
  swap-greed flag `:1872`; special word boundaries `:1942`-`:1958`. Algebra
  `resharp-algebra/src/lib.rs:39` complement/star + lookaround/anchor limit. Size
  caps `lib.rs:56`-`:59` (`DEFAULT_MAX_REPEAT=500`, `EXPANDED_AST_LIMIT=50_000`,
  `MAX_LIST_LEN=4_000`, `MAX_DEPTH=1_000`).

## The 16 bugs (files in docs/audit/resharp-fuzz-2026-06-04/)

- BUG-1 `bug-01-...`: re-entrancy guard panic in union/intersection rewrites,
  compile time. `.*(.+)*.+`.
- BUG-2 `bug-02-...`: `correctness issue found` assert at engine.rs:960 (NO_MATCH
  reaches a Match). `\S+b` on `b'_`.
- BUG-3 `bug-03-...`: is_match disagrees with find_all. Triggers `(\z|(?=a)\w)`,
  `\BU`, `\z\A(?:a){0,1}`, `(?<=\D?[a-c]+0?)b` on `ba`, `\z\A.*` on `` (reversed
  anchors; regex-crate corroborated).
- BUG-4 `bug-04-...`: find_all emits `end=usize::MAX`. `~(_*$)`, `\Bb+`,
  `(?<=[^a])b+`.
- BUG-7 `bug-07-...`: negated perl classes `\D \S \W` nullable (ascii). `\D`.
- BUG-8 `bug-08-...`: hardened find_all differs from default; hardened wrong.
  `~(_a+)`, `~(\D+)`.
- BUG-9 `bug-09-...`: stream path under-reports. `\A\z?`, `(^|b)`, `(?<!b)`. 707+
  STREAMINCONSIST triggers.
- BUG-10 `bug-10-...`: default find_all drops a trailing zero-width match.
  `(?<=^)~(0+)`.
- BUG-11 `bug-11-...`: super-linear compile time. `[\w]{3,5}[\w]([^a]&a+)` ~4s.
- BUG-12 `bug-12-...`: negative lookahead of a class makes a non-nullable pattern
  nullable; spurious empty match. `(?!\w)0+`. Lean-only find (self-consistent).
- BUG-13 `bug-13-lookahead-width-leak.md`: a top-level lookahead leaks its body
  width into the zero-width span. `(?=(?=c)c{1,3})` -> `0:1`. Lean + find_anchored
  vs find_all internal disagreement.
- BUG-14 `bug-14-alternation-drops-lookbehind-gate.md`: a nullable alternation
  sibling drops a lookbehind gate in find_all. `(|(?<=[a-z])b)` -> `0:1`. Lean
  (with a longest-pref control) + rust isolation argument.
- BUG-15 `bug-15-stream-dfa-construction-panic.md`: broad `stream()` DFA crash at
  engine.rs:550. Full 159k panic hunt (DONE): 28688 distinct patterns, 165515 panic
  lines, ALL 7 configs. Minimal `Regex::new("a&b").unwrap().stream(b"aaa")`
  (3+-byte input; not via is_match/find_all/find_anchored). Root cause
  engine.rs:1249 (missing ensure_capacity). The hunt confirms only two crash sites
  total (engine.rs:550 = 165515 lines, engine.rs:960/BUG-2 = 137 lines).
- BUG-16 `bug-16-lookbehind-of-lookahead-superlinear-match.md`: lookbehind of a
  positive lookahead is ~O(n^3) at match time. `(?<=$)` find_all 13s on 512 bytes,
  >2min on 1KB; `(?<=(?=z))` (inner lookahead that FAILS) is the general trigger.
  is_match short-circuits when an early match exists, else it blows up too. Root
  cause: Lookbehind derivative arm `resharp-algebra/src/lib.rs:1378` re-derives the
  inner lookahead each step without fixpoint. Blows up under every limits-enabled
  config except where a flag incidentally removes the trigger (flags: multiline-off
  drops `$`'s newline-lookahead; ignore_whitespace eats `(?= )`'s space). Resolves
  the PERFORMANCE angle of the held-back `(?<=$)` cluster.
- BUG-17 `bug-17-bracketed-perl-class-repeat-compile-blowup.md`: a perl shorthand
  inside a character class (`[\w]` vs bare `\w`) misses the single-predicate fast
  path; bounded-repeat compile is super-linear. `[\w]{3,5}` = 1.76s,
  `([\w]{3,5}){3,3}` = 15.3s, bare `(\w{3,5}){3,3}` = 20ms. NOT class size
  (`[\x00-\xff]` and explicit `[A-Za-z0-9_]` are instant); the perl-to-union
  lowering (`resharp-parser/src/lib.rs:186`) feeding `mk_repeat`'s unroll
  (`resharp-algebra/src/lib.rs:3710`). Mode-independent; max_repeat cap does not
  bound it. Likely the real root cause of BUG-11 (whose trigger also brackets
  `[\w]{3,5}`).
- BUG-18 `bug-18-findall-nullable-complement-quadratic.md`: `find_all` is O(n^2) on
  a nullable complement (`~(a+)`, `~(\w+)`). `find_all_nullable_slow`
  (`resharp-engine/src/lib.rs:1794`) restarts `scan_fwd_slow` from every position;
  a complement that matches empty everywhere gives N positions x O(n) scan each.
  `~(a+)` = 10.5s on 96KB, 18s on 128KB; is_match/find_anchored are O(1). Quadratic
  under every limits-enabled config except hardened, which uses the linear
  `find_all_dfa` driver (`:1713`), proving it avoidable.

The README in the audit dir has the root-cause index, the 30 numbered findings,
the limits inventory pointer, and the Lean-round writeups. A separate
`limits-and-recommendations.md` documents every deliberate compile-time limit
(fundamental vs implementable vs tuning) with recommendations for ieviev.

## Pattern corpora (in /tmp/agent)

- `patterns_all.txt`: 159257 RAW RE# patterns (one per line) from the directed
  sweeps. `fullpats.hex`: same 159257 as distinct hexpats (for `--panicbatch`).
- `pairs_all.txt`, `sweep_combined.txt`: pair/sweep outputs.
- `lean2_pairs.txt`, `leanA_pairs.txt`: 54000 `<hexpat> <hexhay>` each (non-anchor
  position round, anchor round). Aligned rust sides `lean2_rust.txt`,
  `leanA_rust.txt`; Lean outputs `lean2_out_*.txt`, `leanA_out_*.txt` in the
  extended-regexes dir. Both rounds harvested.
- Distinct-trigger lists from prior mining: `diverge_ascii_pats.txt`,
  `harddiff_pats.txt`, `inconsist_pats.txt`, `bounds_pats.txt`.

## Throughput gotchas (learned the hard way)

- `DOTNET_ROOT` is NOT set in fresh shells; export it before any dnharness call.
- Lean `<round>_out_*.txt` land in `/var/home/user/Downloads/extended-regexes`,
  not /tmp/agent.
- `le` in repro output is `find_anchored().end` (anchored at 0), not longest-end.
- A stray `dnharness`/`lean` process can hang an hour on one pathological pattern
  and steal a core. Check `ps -eo pid,pcpu,comm --sort=-pcpu`, kill by PID.
  `ffmpeg` in that list is the user's VideoDownloader; leave it.
- `pkill -f '<pattern>'` matches its own shell. Kill via a script reading
  `/proc/*/cmdline` (`/tmp/agent/killsweep.py`) or by explicit PID.
- Parallelize heavy sweeps 16-way with `split -n l/16 -d` + per-chunk `timeout`.
- BUG-15 panics ~20% of patterns via stream, so `--panicbatch` output is huge;
  grep/uniq the `engine.rs:NNN` site, not the full lines.

## In-flight background jobs (poll .done, do not restart)

- Full-corpus panic hunt: DONE (`/tmp/agent/fullpanhunt.done` exists). Final: two
  crash sites only, engine.rs:550 (28688 distinct patterns, 165515 lines) and
  engine.rs:960/BUG-2 (137 lines), across `Fpan_*.txt`. BUG-15 scope updated.
- Timing hunt over the full corpus, output `/tmp/agent/timehunt2_all.txt` (no
  `.done` marker written by the relaunch; it was `&`-detached inside a bash call).
  Each line is `SLOW|<secs>|...` or `TIMEOUT|>25|...`. Heavily BUG-16 (lookbehind-
  of-lookahead, ~100+ distinct) plus BUG-17 (op=compile, bracketed perl class) and
  BUG-18 (op=find_all, `~(...)` complement). Distinct flagged hexpats extracted to
  `/tmp/agent/flagged_pats.hex`.
- Clean SOLO re-measurement, output `/tmp/agent/timeclean_all.txt`, marker
  `/tmp/agent/timeclean.done`. Waits for the timing hunt to quiesce, then runs
  `--time1` SEQUENTIALLY (no contention) over `flagged_pats.hex`. THIS is the
  authoritative source for which 1-6s flags are real vs contention artifacts. When
  it finishes, scan for any solo op >= 10s NOT already covered by BUG-16/17/18
  (that would be a new root cause); 1-6s solo flags are "suspicious" clusters worth
  a note. Bare-`$`-in-intersection/alternation flags (e.g. `(${0,1}&(\s|\b))`) were
  already spot-checked solo on all-`a` and are NOT superlinear (fixed ~0.1s cost or
  instant); confirm whether any are genuinely slow on diverse-byte (cyc16k) input.

## Held back, NOT filed

The anchor round's `(?<=$)` cluster (lookbehind containing an anchor), e.g.
`(_{0,1}&(?<=$))` on `\n` (rust 1:1, Lean 0:0) and `(?=(?<=$) *)[^a]*` on `\n`
(rust 1:1, Lean 0:1). First-principles reasoning leans toward rust being wrong,
but lookbehind-of-anchor is the translator shape known to be unfaithful, and these
show no internal-consistency violation. Need RE# lookbehind-of-anchor semantics
from the paper or source before filing the CORRECTNESS angle. NOTE: the PERFORMANCE
angle of this exact shape is now filed as BUG-16 (the `(?<=$)` superlinear match),
which needs no oracle; only the position-correctness question remains held back.

## Remaining avenues (for more root causes)

- Harvest the clean solo timing re-measurement (`/tmp/agent/timeclean_all.txt`,
  marker `timeclean.done`): any solo op >= 10s outside BUG-16/17/18 is a new root
  cause; document 1-6s solo clusters as suspicious.
- Timing oracle has only sampled the directed corpus. Generate NEW adversarial
  patterns aimed at the three known mechanisms (lookbehind-of-lookahead nesting,
  bracketed-class repeats, nullable-complement find_all) to find sibling triggers,
  and run `--time1` with a longer/diverse haystack to surface match-time blowups
  that the a1k/cyc16k/a64k battery misses.
- Deepen other stream-correctness mining: BUG-15 blocks stream RESULTS on 28688
  patterns, so more stream bugs may hide behind the crash once it is fixed; for
  now mine STREAMINCONSIST on the non-crashing remainder.
- Per-mode Lean rounds (ascii, flags, hardened) since BUG-4/7/8 are config
  specific; the Lean encoding must match that config's class semantics.
- Resolve the `(?<=$)` CORRECTNESS cluster by pinning RE# lookbehind-of-anchor
  semantics (the performance angle is now BUG-16).
- find_anchored correctness vs Lean as a new oracle dimension (BUG-13 showed
  find_anchored can disagree with find_all).

## Conventions for the writeups

Repo prose rules: no em-dashes or en-dashes as em-dashes, sentence-case headings,
ATX headers, fenced code with language tags, lines under 120, no tables, no
emojis. Each bug file: self-contained reproducer (rust snippet plus `repro`
command), observed vs expected, affected configs, source location, relationship to
other bugs. Commit eagerly with `docs(resharp-fuzz): ...`, explicit pathspec (the
working tree has concurrent external "unbash" changes in `packages/` and
`AGENTS.md`; never stage those, they are not ours).
