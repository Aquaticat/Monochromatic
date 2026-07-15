# Resharp fuzz campaign 2026-06-04

Findings from a fresh coverage-guided plus directed-differential fuzz campaign
against `ieviev/resharp` at the current `main` (the version with the two
recently merged fuzzing-enablement PRs).
 This is the "full fuzz re-run" listed
as a recommended next step in `doc/troubleshooting/resharp.md`.

Each bug has its own file in this directory with a self-contained reproducer,
observed versus expected behaviour,
 the affected option modes,
 the source
location where known,
 and the relationship to the other findings.

## Scope and method

Three layers were used,
 in increasing yield:

- Coverage-guided `cargo-fuzz` (libFuzzer plus AddressSanitizer,
   nightly,
  debug-assertions and overflow-checks on) over the three in-tree targets:
  `compile`,
   `match_invariants`,
   `diff_regex`.
- A "suppressed fork" of the engine that turns the two re-entrancy-guard panics
  (`attempt_rw_union_2`,
   `attempt_rw_inter_2`) into their release `return None`
  fallback,
   so the fuzzer digs past the dominant crash (BUG-1) into the rest of
  the surface.
   The fork equals release semantics for re-entrancy,
   so any bug it
  surfaces is real for release builds.
- A directed differential oracle (`/tmp/agent/repro`,
   pristine engine,
   same
  build profile as cargo-fuzz) that compiles each pattern under every option
  mode and a fixed haystack set,
   then checks five engine-internal invariants
  plus a cross-engine and a cross-mode differential.
   This lane produced the most
  distinct triggers because it reaches the resharp-only operators that the
  in-tree `diff_regex` grammar deliberately excludes.

The oracles,
 in order of signal quality:

- `PANIC`:
   any panic,
   assertion,
   or abort during compile or match.
- `BOUNDS`:
   a `find_all` match with `start > end` or `end > haystack.len()`.
- `OVERLAP`:
   `find_all` matches that overlap or are out of order.
- `INCONSIST`:
   `is_match` disagrees with `find_all` non-emptiness.
- `ANCHOR`:
   `find_anchored` returns a match whose start is not 0.
- `HARDDIFF`:
   the default engine and the `hardened(true)` engine return
  different `is_match` or `find_all`.
   Hardening only swaps the scan algorithm,
  not the language,
   so any disagreement is a bug in one path.
- `DIVERGE`:
   resharp in `UnicodeMode::Ascii` disagrees with the `regex` crate
  built with `.unicode(false)`.
   Only trustworthy on pure-ascii haystacks (high
  bytes carry legitimate unicode-width differences),
   and only on the shared
  syntax subset (no anchors,
   no resharp-only operators,
   no multiline-sensitive
  constructs).

Every bug below was confirmed on the unmodified pristine engine.
 The fork is a
search accelerator only.

## Verification tooling

- Pristine clone:
   `/tmp/agent/resharp-fuzz-20260604` (kept unmodified).
- Suppressed fork:
   `/tmp/agent/resharp-fork-20260604` (two re-entrancy panics
  neutralised,
   `REPRO=1` self-describe prints added to the three targets).
- Reproducer and oracle:
   `/tmp/agent/repro` (a small crate depending on the
  pristine engine by path).
   Usage:
  - `repro '<pattern>' --sweep` runs every mode over the built-in haystack set
    and prints one line per invariant violation.
  - `repro '<pattern>' <haystack>` or `repro '<pattern>' <hex> --hex` runs a
    single explicit haystack.

## Root-cause bug index

- [BUG-1](bug-01-reentrant-rewrite-panic.md):
   re-entrancy guard panic in the
  union and intersection derivative rewrites.
   Compile time.
   `.*(.+)*.+`.
- [BUG-2](bug-02-correctness-issue-assert.md):
   `correctness issue found`
  assertion when the forward scan returns the `NO_MATCH` sentinel where the
  reverse pass expected an end.
   Match time.
   `\S+b`.
- [BUG-3](bug-03-ismatch-findall-disagree.md):
   `is_match` disagrees with
  `find_all`.
   `(\z|(?=a)\w)`,
   `((?=0)\S|\z)`,
   `\BU`.
   (The `\z\A` empty-match cases
  once filed here are now BUG-26,
   a compile-time empty-language reduction where
  `is_match` and `find_all` actually agree.
  )
- [BUG-4](bug-04-nomatch-sentinel-leak.md):
   `find_all` emits a match with
  `end = usize::MAX`.
   `~(_*$)`,
   `\Bb+`,
   `(?<=[^a])b+`.
- [BUG-7](bug-07-negated-perl-class-nullable.md):
   the negated perl classes
  `\D`,
   `\S`,
   `\W` match the empty string.
   `\D`.
- [BUG-8](bug-08-default-vs-hardened-findall.md):
   hardened `find_all` differs
  from default;
   hardened is the wrong side.
   `~(_a+)`,
   `~(\D+)`.
- [BUG-9](bug-09-stream-drops-matches.md):
   the `stream` path under-reports
  matches that `is_match` and `find_all` see.
   `\A\z?`,
   `(^|b)`,
   `(?<!b)`.
- [BUG-10](bug-10-default-findall-drops-trailing-zerowidth.md):
   default
  `find_all` drops a trailing zero-width match that hardened and dotnet report.
  `(?<=^)~(0+)`.
- [BUG-11](bug-11-compile-time-blowup.md):
   super-linear compile time on small
  intersection plus class-repeat patterns.
   `[\w]{3,5}[\w]([^a]&a+)`.
   Confirmed to be
  the same root cause as BUG-17:
   the cost is entirely the bracketed `[\w]` (replacing
  it with bare `\w` drops the same pattern from 2.79 s to 0.0068 s),
   the intersection
  is incidental.
   Counted once with BUG-17.
- [BUG-12](bug-12-neg-lookahead-nullable.md):
   a negative lookahead of a class
  makes a non-nullable pattern wrongly nullable,
   so is_match and find_all both
  report a spurious empty match.
   `(?!\w)0+`.
   Found only by the Lean ground truth.
- [BUG-13](bug-13-lookahead-width-leak.md):
   a top-level lookahead leaks its body
  width into the (zero-width) match span,
   so `find_all` returns spans one unit too
  long.
   `(?=(?=c)c{1,3})`.
   Found by the Lean leftmost-longest position round;
  fires no internal oracle.
- [BUG-14](bug-14-alternation-drops-lookbehind-gate.md):
   a nullable alternation
  sibling drops the lookbehind gate on the longer branch,
   so `find_all` returns a
  span the lookbehind forbids.
   `(|(?<=[a-z])b)`.
   Same defect as the BUG-3
  lookbehind trigger seen from the other side;
   ground-truth-only at the span
  level.
- [BUG-15](bug-15-stream-dfa-construction-panic.md):
   the `stream` API's lazy DFA
  construction panics (`engine.rs:550` index out of bounds) on a broad pattern
  class,
   28688 of 159257 corpus patterns in every config.
   Minimal `a&b` then
  `stream(b"aaa")`.
   Triggers:
   intersection (1688),
   lookarounds (413),
   and anchors.
  The reversed-anchor `\z\A` that first surfaced it also drops its empty match
  (regex-crate corroborated),
   a separate compile-time defect now filed as BUG-26.
- [BUG-16](bug-16-lookbehind-of-lookahead-superlinear-match.md):
   a lookbehind of
  a positive lookahead that fails at the tested position is super-linear
  (about O(n^3)) at match time.
   A six-character pattern matches 512 bytes in 13
  seconds and 1 KB in over two minutes,
   with the size limits enabled,
   violating
  the project's own "nothing over 10 seconds with limits on" invariant.
   `(?<=$)`
  `find_all` (`$` desugars to a positive lookahead under multiline).
   Match-time
  analogue of BUG-11's compile-time blowup,
   found by the timing oracle.
- [BUG-17](bug-17-bracketed-perl-class-repeat-compile-blowup.md):
   a perl shorthand
  written inside a character class (`[\w]` instead of bare `\w`) misses the
  single-predicate fast path,
   so bounded-repeat compilation is super-linear.
  `[\w]{3,5}` compiles in 1.76 s and `([\w]{3,5}){3,3}` in 15.3 s,
   while the
  identical bare `(\w{3,5}){3,3}` is 20 ms. Mode-independent;
   the size cap does
  not bound it.
   Likely the real root cause of BUG-11.
- [BUG-18](bug-18-findall-nullable-complement-quadratic.md):
   `find_all` is O(n^2)
  on a nullable complement (`~(a+)`,
   `~(\w+)`) because the nullable fallback
  `find_all_nullable_slow` restarts a forward scan from every position.
   `~(a+)`
  takes 10.5 s on 96 KB and 18 s on 128 KB;
   `is_match`/`find_anchored` are O(1).
  Quadratic under every limits-enabled config except `hardened`,
   which takes the
  linear DFA driver,
   so the quadratic is avoidable.
- [BUG-19](bug-19-fullmode-anchor-word-class-construction-cost.md):
   an anchor in
  front of a full-mode word class (`$?\w`,
   `$\w`,
   `$?\W`) costs 1 to 3 seconds to
  match 16 KB of diverse bytes under `unicode(Full)`,
   a fixed match-time DFA
  construction cost.
   Full mode only;
   `\w` alone,
   `\d`/`\s`,
   and ascii/js modes are
  all sub-millisecond.
   The mode-independent bracketed analogue `$[\w]` (~1.15 s) is
  documented as the match-time face of BUG-17.
- [BUG-20](bug-20-findanchored-ignores-leading-begin-assertion.md):
   `find_anchored`
  reports a match at offset 0 that a leading zero-width assertion forbids there.
   On
  `"00"`,
   `\B0` returns `0:1` (wrong;
   `\B` is false at the start) and `(?<=0)0`
  returns `0:1` (wrong;
   nothing precedes offset 0),
   while `find_all` correctly
  matches at `1:2` in both.
   `find_anchored` does not seed the begin-of-input context
  its scan needs (`engine/src/lib.rs:1847`).
   Found by the new find_anchored-versus-
  find_all consistency oracle (`FANDIFF`).

- [BUG-21](bug-21-lazy-dfa-cache-contamination-across-queries.md):
   a reused `Regex`
  returns history-dependent,
   wrong answers.
   Repeating an identical `is_match("ba")`
  on `\Bb` flips `false` to `true`;
   a prior query makes `find_all` leak the
  `NO_MATCH` `usize::MAX` sentinel into a returned `Match.end`.
   The reverse lazy-DFA
  cache (`rev_ts`) shares states across queries without the begin-of-input boundary
  context in their identity (`handle_rev_end`,
   `engine/src/engine.rs:1478`).
   Can also
  escalate to the `engine.rs:960` abort (then BUG-25).
   Config-independent.
- [BUG-22](bug-22-fwd-prefix-rescan-quadratic-is-match.md):
   `is_match`/`find_all`/
  `stream` are O(n^2) on a repetitive single-byte prefix with a failing suffix
  (`(a+)+b`,
   `(a|a)*b` over an all-`a` run:
   4.4 s at 64 KiB,
   stream ascii > 25 s).
  The DFA is bounded (5 states),
   so it is not state explosion:
   `is_match_fwd_prefix`/
  `find_all_fwd_prefix` re-scan from every prefix occurrence,
   advancing `search_start`
  by one byte after a failed scan (`fwd.rs:92`,
   `:51`).
   Not mitigated by hardened.
- [BUG-23](bug-23-full-unicode-word-class-bounded-repeat-compile-blowup.md):
  full-unicode `\w` bounded-repeated blows up compile time super-linearly
  (`\w{16}` = 15.6 s,
   `\w{12}` = 9.6 s in full;
   ~0.03 s in default/ascii).
   Specific to
  `\w`/`\W`;
   `\d`/`\s`/`.`/ASCII are instant.
   The parser unrolls `{n,m}` via
  `mk_repeat` (`parser/lib.rs:2030`,
   `algebra/lib.rs:3710`) instead of the native
  `Kind::Counted`,
   materializing one DFA state per count over the large `\w` set.
- [BUG-25](bug-25-mutex-poison-bricks-regex.md):
   a panic inside the locked region
  poisons the `inner` `std::sync::Mutex`,
   so every later `.lock().unwrap()` (16 sites)
  panics with `PoisonError`.
   One bad input permanently bricks a shared compiled
  `Regex` for all methods and threads even if the caller catches the first panic.
  Minimal:
   `\w+b` default,
   `find_all(["ab","ba"])`.
- [BUG-26](bug-26-end-then-begin-anchor-reduced-to-empty-language.md):
   `\z\A` is
  compiled to the empty language (BOT) and fails to match the empty string it should
  match (`\A\z` is correct).
   `mk_concat` reduces an `End` head before a non-END-
  nullable tail to BOT (`algebra/lib.rs:3232`),
   ignoring that on the empty input the
  end position is also the begin position,
   so a begin-nullable tail (`\A`) still
  matches `""`.
   Reclassifies the prior `\z\A` findings (numbered 8 and 27) from BUG-3.
- [BUG-27](bug-27-word-boundary-nullability-flipped-on-empty-under-composition.md):
  a word boundary composed with a nullable filler flips on the empty string:
   `\b a{0}
  \b` matches `""` (should not) and `\B a{0} \z` fails on `""` (should match),
   all
  configs.
   `\b` lowers to boundary lookarounds over `~(\w)`,
   which is nullable,
   so on
  the empty string both sides are satisfied and the "word char on one side" rule is
  lost under composition.
   Bare `\b`/`\B` are correct.

BUG-5 and BUG-6 from the working notes are folded in:
 BUG-5 (`\S+b`) is the
shared trigger for BUG-2 and a real ascii `DIVERGE`;
 BUG-6 (`\BU`) is a second
trigger for BUG-3.
 An earlier draft of this round filed the ascii `\W`/`\D`/`\S`
language-complement defect as BUG-24 before noticing it is the same root cause as
BUG-7;
 BUG-24 was merged into BUG-7 (where the exact line,
 `parser/lib.rs:1373`,
 is
now pinned) and removed,
 so there is no BUG-24.

## Numbered findings (39 distinct minimal reproducers)

Each line is a distinct,
 verified,
 minimal reproducer on the pristine engine,
grouped by the root cause above.
 Self-consistency findings (a single engine
contradicting itself) need no external oracle;
 the rest are adjudicated against
the dotnet reference and plain semantic reasoning.

```text
 1. .*(.+)*.+                 compile panic, reentrant union rewrite        BUG-1
 2. (?:(?:(?:(?:1)+){1,2})+){2,2}  compile panic, same site, nested quant   BUG-1
 3. \S+b on "b'_"             match-time assert engine.rs:960               BUG-2
 4. (\d|_)b(?:a)* full mode   match-time assert engine.rs:960               BUG-2
 5. (\z|(?=a)\w)              is_match false, find_all one match            BUG-3
 6. ((?=0)\S|\z) on "a"       is_match false, find_all one match            BUG-3
 7. \BU on "Uii\"             is_match true, find_all empty                 BUG-3
 8. \z\A(?:a){0,1} on ""      is_match false, empty match exists            BUG-26
 9. ~(_*$) flags mode         find_all end = usize::MAX                     BUG-4
10. \Bb+ on "ba"             find_all end = usize::MAX, default mode        BUG-4
11. (?<=[^a])b+ on "ba"      find_all end = usize::MAX, default mode        BUG-4
12. \D on ""                 negated perl class nullable (ascii)            BUG-7
13. \S on ""                 negated perl class nullable (ascii)            BUG-7
14. ~(_a+) on "aaa"          hardened find_all wrong                        BUG-8
15. ~(\D+)                   default vs hardened find_all differ            BUG-8
16. \A\z? on "a"             stream returns empty, match exists             BUG-9
17. (?<!b) on "b"            stream returns empty, match exists             BUG-9
18. (^|b) on "a"             stream returns empty, is_match true            BUG-9
19. (?<=^)~(0+) on "\n"      default find_all drops trailing (1,1)          BUG-10
20. [\w]{3,5}[\w]([^a]&a+)   compile takes about 4 seconds                  BUG-11
21. (?!\w)0+ on ""           spurious empty match (Lean ground truth)       BUG-12
22. (?!\D)\D{2,2} on ""      spurious empty match (Lean ground truth)       BUG-12
23. (?=(?=c)c{1,3}) on "c"   find_all span 0:1, must be zero-width 0:0      BUG-13
24. (?<=\D?[a-c]+0?)b on "ba" find_all 1:2 while is_match false             BUG-3
25. (|(?<=[a-z])b) on "b"    find_all 0:1, lookbehind gate dropped          BUG-14
26. a&b then stream("aaa")   panic engine.rs:550, stream API, all configs    BUG-15
27. \z\A.* on ""             missed empty match, regex crate confirms        BUG-26
28. (?<=$) find_all 'a'*512  ~13s match-time blowup, lookbehind-of-lookahead  BUG-16
29. ([\w]{3,5}){3,3}         ~15s compile blowup, bracketed perl-class repeat  BUG-17
30. ~(a+) find_all 'a'*98304 ~10.5s O(n^2) find_all, nullable complement       BUG-18
31. $?\w is_match cyc(16384) ~3s full-mode anchor+\w construction cost         BUG-19
32. \B0 on "00"              find_anchored 0:1 vs find_all 1:2 (correct)        BUG-20
33. \Bb is_match("ba") x2    false then true: reused-Regex cache contamination  BUG-21
34. (a+)+b is_match 'a'*65536 ~4.4s O(n^2) prefix re-scan, hardened no help     BUG-22
35. \w{16} compile full mode ~15.6s full-unicode bounded-repeat unroll          BUG-23
36. \W is_match("") ascii    spurious true: mk_compl not neg_class (was BUG-24)  BUG-7
37. \w+b find_all ["ab","ba"] panic then PoisonError bricks the Regex           BUG-25
38. \z\A is_match("")        false; compiled to empty language (BOT)             BUG-26
39. \ba{0}\b is_match("")    true; word-boundary nullability flips on empty      BUG-27
```

The campaign covers twenty-three distinct root causes and 39 numbered reproducers
(BUG-1 through BUG-27;
 numbers 5 and 6 folded,
 BUG-11 confirmed to be the same root
cause as BUG-17,
 the bracketed perl class,
 and BUG-24 confirmed to be the same root
cause as BUG-7,
 the ascii negated-shorthand language complement,
 so each counts once;
there is no BUG-24).
 The Lean ground truth added BUG-12,
 BUG-13,
 and BUG-14 (all
self-consistent at the span level and so invisible to every internal oracle).
 A
panic hunt over the streamed corpus then found BUG-15,
 a single `stream()` DFA
construction crash that hits 28688 of 159257 patterns (intersection,
 lookaround,
and anchor families) in every config;
 the full-corpus hunt confirmed only one
other crash site,
 BUG-2's assert.

A later round added six more distinct root causes.
 Reusing one compiled `Regex`
across queries exposed BUG-21 (lazy-DFA cache contamination:
 history-dependent,
wrong answers,
 escalating to the `engine.rs:960` abort) and BUG-25 (that panic
poisons the `inner` mutex and permanently bricks the instance).
 A timing sweep over
structurally diverse patterns added BUG-22 (O(n^2) `is_match` from forward-prefix
re-scan,
 not hardened-mitigated) and BUG-23 (full-unicode `\w` bounded-repeat compile
blowup).
 A plain-pattern differential round and a focused anchor-composition round
added BUG-26 (`\z\A` reduced to the empty language,
 reclassifying the prior `\z\A`
findings from BUG-3) and BUG-27 (word-boundary nullability flipping on the empty
string under nullable composition),
 and pinned BUG-7's exact line.

## Distinct-trigger counts

The oracles cluster into the root causes above,
 but each has many distinct
triggering patterns (counts from the 159k-pattern directed sweep):

- `STREAMINCONSIST`:
   707 distinct patterns (BUG-9).
- `HARDDIFF_FA`:
   196 distinct patterns (BUG-8 and BUG-10).
- `BOUNDS`:
   10 distinct patterns (BUG-4).
- `INCONSIST`:
   9 distinct patterns (BUG-3).
- `DIVERGE` on pure-ascii haystacks:
   about 108 distinct patterns,
   almost all
  BUG-7.
- `RUST_TIMEOUT` in the dotnet differential:
   dozens of distinct slow-compile
  patterns (BUG-11).

## Deliberate compile-time limits

The Lean leftmost-longest round left 8055 of 54000 pairs where rust returned a
compile error (895 distinct patterns).
 These are deliberate restrictions,
 not
soundness bugs,
 but some are expressible in the reference algebra and so are
implementation gaps rather than fundamental limits.
 The full inventory,
 with each
limit classified as fundamental,
 implementable,
 or a tuning choice,
 plus a
recommendation for each,
 is in
[limits-and-recommendations.md](limits-and-recommendations.md).
 The three most
common families seen in this round:

- Lookbehind not at the start of its concatenation.
   rust rejects `a(?<!b)`,
  `.(?<!b)`,
   `ab(?<!c)`,
   `b(?<!b)`,
   and the mid-pattern `^` in `a^b`,
   while
  accepting a leading lookbehind (`(?<!b)a`).
   Explicit check
  `ensure_lookbehind_at_start`,
   `resharp-parser/src/lib.rs:479`.
   Lookbehind is
  first-class in the reference algebra and usable in any position,
   so this is an
  engine-architecture gap (forward derivative plus reverse scan from the match
  start),
   not a fundamental limit.
   Highest-value limit to lift.
- Lookaround or anchor as the last factor inside a complement or a star.
  Structure-dependent:
   `~((?=a)b)` compiles but `~((?=a))`,
   `~(b(?=a))`,
  `((?=x+))*` do not.
   Source `resharp-algebra/src/lib.rs:39`.
   Expressible in the
  reference;
   `Regex/EliminationNegLookarounds.lean` gives a rewrite roadmap.
- Class ranges with a class endpoint.
   `[\d-a]` rejected (`ClassRangeLiteral`,
  `resharp-parser/src/lib.rs:305`).
   A parsing-strictness choice;
   PCRE and the Rust
  `regex` crate read the `-` literally here.

See the limits doc for the full set (lazy quantifiers,
 backreferences,
 swap-greed
flag,
 special word boundaries,
 size caps),
 each classified fundamental versus
implementable with a recommendation,
 using the Lean algebra as the arbiter and the
dotnet engine only as a secondary data point.

## Code quality

Two companion docs record source-level issues found while reading the engine,
algebra,
 and parser,
 split by whether any reasonable Rust author would rewrite the
code on sight.
 The bar is read in the context of a young,
 high-churn crate:
 an
unenforced invariant or a host-aborting "cannot happen" guard does not get the
benefit of the doubt,
 because the next feature breaks it.

- [code-quality.md](code-quality.md):
   the definitely-rewrite tier.
   A library
  aborting the host on user input (`engine.rs:960`,
   BUG-2) and the sibling
  unproven-reachable aborts;
   the in-band `usize::MAX` sentinel (shown to be a
  scalar-local-only value,
   so `Option<usize>` is free and the tradeoff is sour);
  the `unsafe` unchecked pointer indexing in `fwd_update` and the narrowing `as u16`
  / `as u8` casts (invariant-protected today,
   but the invariant is not in the type);
  `.ok()` discarding a fallible result the next line depends on (`engine.rs:1249`,
  BUG-15);
   the O(n^2) `find_all` path beside the O(n) one in the same file (BUG-18);
  and one class with three representations spanning a 300x cost (BUG-17).
- [code-quality.recommendations.md](code-quality.recommendations.md):
   the short
  residue a maintainer could reasonably keep,
   chiefly the two `find_all`
  implementations to converge (a fast-path-plus-fallback structure whose divergence
  is the separately filed BUG-8).

## Caveats and relationship to known bugs

- The `reentrant-assert` feature is a default feature and is the project's own
  diagnostic guard.
   BUG-1 is that guard firing on a union-rewrite re-entrancy,
  a sibling of the already-tracked "intersection over alternation" recursion.
- BUG-8 is the same class as the already-tracked "hardened find_all drops
  zero-width matches",
   but the triggers here are complement-based and reproduce
  on current `main`,
   so the prior fix does not cover them.
- BUG-2 and BUG-4 share one underlying defect:
   the `NO_MATCH` sentinel
  (`usize::MAX`,
   `engine.rs:12`) reaches a `Match`.
   One path asserts on it
  (`engine.rs:960`),
   another pushes it silently (`engine.rs:1009`,
   `:1022`).

## The dotnet reference has its own bugs

The dotnet differential is a candidate generator,
 not an oracle.
 The dotnet
engine is older and was the basis for the rust rewrite,
 but it has systematic
defects of its own,
 so its `is_match` / `find_all` disagreements with rust are
often the dotnet side being wrong.
 Confirmed dotnet defects found while
adjudicating:

- lookahead followed by an empty-matching star:
   `(?=1)[a-c]*` on `1` and
  `(?=[a-c])1*` on `a` both match (the lookahead holds and the star matches
  empty),
   but dotnet reports no match.
   rust is correct here.
- anchor intersection:
   `(\A&$)` on `a` and `(a&\A\S)` on `ba` have no match
  (a single span cannot satisfy both anchor constraints at the required
  position),
   but dotnet reports a match.
   rust is correct here.

Because of this,
 the `IM_DIFF`,
 `FA_DIFF`,
 and `LE_DIFF` differential classes are
heavily contaminated with dotnet bugs and were not used to file rust bugs except
where the regex crate or plain semantic reasoning independently confirms rust is
wrong (for example BUG-3's `\z\A(?:a){0,1}`,
 confirmed by the regex crate).
 The
20 findings rest on the self-consistency oracles (a single engine contradicting
itself,
 which is unambiguous) plus the two confirmed differential classes
`RUST_PANIC` (BUG-2) and `RUST_TIMEOUT` (BUG-11).

## Lean ground-truth oracle

The Lean formalization in `~/Downloads/extended-regexes` (Zhuchko,
 Veanes,
Ebner,
 the verified ERE semantics) is now built and wired up as a bulk oracle.
A Python translator (`/tmp/agent/re2lean.py`) turns a non-anchor RE# pattern
into a Lean `RE (BA Char)` term;
 `/tmp/agent/gen_lean.py` emits one
`#eval (llmatch term input).isSome` per (pattern,
 input) pair;
 the results are
diffed against rust default-mode is_match by `/tmp/agent/diff_lean.py`.
 The
formalization has no anchor primitives,
 so this covers the non-anchor space
(literals,
 classes,
 `.`/`_`,
 `&`,
 `~`,
 `|`,
 quantifiers,
 lookarounds).

Result:
 over 6185 non-anchor pairs,
 rust disagreed with the ground truth on
exactly one class,
 BUG-12 (11 distinct triggers).
 This both found a new bug and
gave positive evidence that rust's non-anchor is_match is otherwise correct on
the sampled space.

A second,
 larger round then compared match positions,
 not just existence:
 a
54000-pair leftmost-longest span round (`lean2`,
 default-mode `find_all` first
span versus Lean `llmatch` span).
 Of 45928 comparable pairs (8055 rust compile
rejections excluded),
 49 position and 100 existence disagreements survived,
 which
a three-way adjudicator (`/tmp/agent/adj_full.py`,
 rust versus dotnet versus
Lean) sorted into:

- 8 where dotnet and Lean both contradict rust (genuine rust bugs):
   six more
  BUG-12 triggers,
   one BUG-13 (the lookahead width leak),
   and one BUG-3 trigger
  (`(?<=\D?[a-c]+0?)b`).
- 18 where dotnet agrees with rust against Lean.
   These flag the translator's
  encoding of a lookbehind whose body contains a lookahead (`(?<=(?=...)...)`) as
  unfaithful,
   not a rust bug;
   they were discarded.
- 123 where dotnet throws `UnsupportedPatternException` and cannot adjudicate.
  These are Lean-versus-rust only;
   the clearly-BUG-12-shaped ones corroborate
  BUG-12,
   and the `(?<=(?=...)...)` ones are the same suspect-encoding family.

The adjudicator pattern (never trust a Lean-only disagreement on a construct
where dotnet silently agrees with rust) is what keeps the translator's own
encoding bugs out of the rust bug count.

A third round encoded anchors as lookarounds (`\A`,
 `\z`,
 `^`,
 `$`,
 `\b`,
 `\B`)
and ran 54000 anchor pairs.
 The encoding was validated first against 19
known-answer cases (`leanval2.lean`,
 all 19 match),
 and the round bore that out:
the three-way adjudicator put only 1 case in the encoding-suspect bucket (against
18 for the nested-lookbehind lean2 round),
 so the anchor encoding is faithful.
 The
round produced 10 Lean-disagreement rust bugs,
 the headline being BUG-15 (the
`\z\A` reversed-anchor crash and missed match).
 A second anchor cluster,
`(?<=$)`-style lookbehind-of-an-anchor position errors,
 is held back pending a
direct check of RE# lookbehind-of-anchor semantics,
 since lookbehind-of-lookaround
is exactly the translator shape that proved unfaithful in the lean2 round.

## Re-run against the v0.6.9 cleanup commit (264e85b)

After the campaign baseline (`a7ab016`),
 upstream landed `4ffe1cc` "cleaning up and
simplifying edge cases" (on `main` as `264e85b` "bump version",
 tag `v0.6.9`).
 The
full campaign was re-run against it.

- None of the 23 filed bugs are fixed.
   Every reproducer (BUG-1 through BUG-27,
   no
  BUG-24) returns byte-identical results on the parent and on v0.6.9,
   verified by
  the full reproducer harness across all configs.
- The commit's behavioural footprint is narrow:
   a before/after `find_all`
  differential over the 6426-pattern hard corpus (96390 pairs,
   default config)
  found zero differences.
   All change is confined to the zero-width
  negative-lookahead-of-anchor and `\b\B`-anchor-composition family.
- It introduces one regression,
   filed alongside the bugs as
  [REG-1](regression-01-neg-lookahead-zerowidth-duplicate-findall-spans.md):
   a
  zero-width negative lookahead such as `(?!\A)` makes `find_all` emit the same
  zero-width span twice (`(?!\A)` on `"ab"` returns `1:1,1:1,2:2`,
   was `1:1,2:2`).
  Root-caused by single-hunk bisection to the new `mk_neg_lookahead` zero-width
  branch (`resharp-algebra/src/lib.rs:3554`),
   which lowers `(?!body)` to
  `EPS & ~body` and double-registers interior nullable positions in the reverse
  null collector.
   Config-independent;
   regresses patterns the parent compiled
  correctly.
   The internal oracle does not catch equal-span duplicates,
   an oracle
  gap recorded in the regression file.
- The same commit also makes genuine improvements in that family:
   zero-width
  negative lookaheads composed with other factors (`(?!\A)a`,
   `(?!\A)*`,
  `(?!\A)(?=[A-Z])`,
   `(?!\A){2}`) now compile and match correctly where the parent
  rejected them or wrongly returned no match,
   and the parent's compile-time panic
  on `\A((?<=a)B+|x)` becomes a clean `UnsupportedPattern`.

## Status

Campaign in progress.
 Twenty-three distinct root causes confirmed (BUG-1 through
BUG-27;
 BUG-11 folds into BUG-17 and BUG-24 folds into BUG-7,
 so there is no BUG-24),
plus one regression (REG-1) introduced by the v0.6.9 cleanup commit.
 None of the 23
bugs are fixed as of v0.6.9 (`264e85b`).
 This index and the per-bug files are updated
as new distinct root causes are confirmed.
