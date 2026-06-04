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

## Current status (2026-06-04 15:33)

13 distinct root causes (BUG-1, 2, 3, 4, 7, 8, 9, 10, 11, 12, 13, 14, 15; 5 and 6
folded) and 27 numbered reproducers committed under
`docs/audit/resharp-fuzz-2026-06-04/`. Distinct triggering patterns run to the
thousands (BUG-15 alone: 2396+ in the 12k corpus, 110k+ panic lines in the 159k
hunt). All work is committed. The user wants maximum yield ("poke resharp until
it's a honeycomb").

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

## The 13 bugs (files in docs/audit/resharp-fuzz-2026-06-04/)

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
  engine.rs:550, 2396 of 12000 corpus patterns (intersection 1688, lookarounds
  413, anchors), ALL 7 configs. Minimal `Regex::new("a&b").unwrap().stream(b"aaa")`
  (3+-byte input; not via is_match/find_all/find_anchored). Root cause
  engine.rs:1249 (missing ensure_capacity). The 159k panic hunt confirms only two
  crash sites total (engine.rs:550 and engine.rs:960/BUG-2).

The README in the audit dir has the root-cause index, the 27 numbered findings,
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

- Full-corpus panic hunt, task id `bcscku23a`. Streams all 159257 patterns x 7
  configs through `--panicbatch` (16 chunks `Fpat_*.fp` -> `Fpan_*.txt`), done
  marker `/tmp/agent/fullpanhunt.done`, combined `/tmp/agent/fullpanhunt_all.txt`.
  Interim: only two crash sites (engine.rs:550 ~110k lines, engine.rs:960 87),
  confirming no third panic site. When done, tally distinct patterns per site for
  the final BUG-15 / BUG-2 trigger counts and update BUG-15's scope if larger.

## Held back, NOT filed

The anchor round's `(?<=$)` cluster (lookbehind containing an anchor), e.g.
`(_{0,1}&(?<=$))` on `\n` (rust 1:1, Lean 0:0) and `(?=(?<=$) *)[^a]*` on `\n`
(rust 1:1, Lean 0:1). First-principles reasoning leans toward rust being wrong,
but lookbehind-of-anchor is the translator shape known to be unfaithful, and these
show no internal-consistency violation (only `(?<=$)a` panics, which is BUG-15).
Need RE# lookbehind-of-anchor semantics from the paper or source before filing.

## Remaining avenues (for more root causes)

- Finish/triage the full panic hunt (in flight); confirm two crash sites and final
  counts.
- Deepen any other stream-correctness mining: BUG-15 blocks stream RESULTS on 2396
  patterns, so more stream bugs may hide behind the crash once it is fixed; for
  now mine STREAMINCONSIST on the non-crashing remainder.
- Per-mode Lean rounds (ascii, flags, hardened) since BUG-4/7/8 are config
  specific; the Lean encoding must match that config's class semantics.
- Resolve the `(?<=$)` cluster by pinning RE# lookbehind-of-anchor semantics.
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
