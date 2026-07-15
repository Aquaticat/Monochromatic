# dotnet reference cross-check (supported-subset classification)

The rust crate and the C#/F# `resharp-dotnet` are both ieviev's implementations
of RE#.
 Running every finding's minimal pattern through the dotnet reference
(`Resharp.Regex(pat).Matches(input)` / `.IsMatch`,
 library built from
`~/Downloads/resharp-dotnet/src/Resharp`) reveals that the dotnet engine
explicitly REJECTS several construct classes at compile time that the rust crate
ACCEPTS and then mishandles.
 This splits the findings into two tiers.

## Raw results

```txt
pattern                         input   dotnet result
^$                              \n      [(0,0),(1,1)]                       accepted
(?<=a)                          b       im=false []                         accepted
(?=c)                           c       im=true [(0,0)]                     accepted
a(?=b)                          ab      [(0,1)]                             accepted
~(a)                            b       [(0,1),(1,1)]                       accepted
~(\w)                           b       [(0,0),(1,1)]                       accepted
a&.                             a       [(0,1)]                             accepted
(?=a)&a                         a       []                                  accepted
\w{8}                           ...     [(0,8)]                             accepted
.n....n.n (bug09 unit)          x       im=false []                         accepted
(.*.+)*.+                       aaa     [(0,3)]                             accepted   <- rust PANICS (bug-04)
_*(?!_)                         aa      [(0,2),(2,2)]                       accepted   <- rust PANICS (bug-05)

(?!a)|b                         b       REJECT: Lookarounds inside union not supported
((?!b)|ba)&(aa)?  (bug-12)      ab      REJECT: Lookarounds inside union not supported
((?!a)|b)&(~((c))) (bug-11)     abca    REJECT: Lookarounds inside union not supported
[0-9]{2}~(\z..|^..)+ (bug-08)   00      REJECT: Lookarounds inside union not supported
a?&(?=a)?  (bug-13)             ab      REJECT: this pattern is unsupported because of nested lookarounds
(?!a)b                          cb      REJECT: this pattern contains unsupported anchors/lookarounds
~(\z)                           a       REJECT: anchors inside complement are unsupported
~(.{1,3}\z)                     ab      REJECT: anchors inside complement are unsupported
~(.{1,3}\z){2,4}  (bug-10)      ab      REJECT: anchors inside complement are unsupported
~(\A|\n+){2}      (bug-07)      \n\n    REJECT: anchors inside complement are unsupported
(?!\A)            (bug-03c)     ab      REJECT: anchors inside complement are unsupported
\b                (bug-03b)     ab      REJECT: \b is only supported when next to word/non-word chars
\BU               (bug-02b)     U       REJECT: Failed to parse word non-boundary
```

The rust crate compiles every one of the REJECT rows successfully (no
`Regex::with_options` error) and then crashes or returns a wrong result.

## Two tiers

### Tier 1: within the reference's supported subset (clean)

The reference accepts the pattern;
 rust diverges from it (and from the verified
Lean ground truth):

- bug-04,
   bug-05 -- CRASHES.
   dotnet returns `[(0,3)]` / `[(0,2),(2,2)]` with no
  crash;
   rust panics (`algebra:2724` / `lib.rs:1824`).
   Unambiguous rust-specific
  crashes.
- bug-02 (the `(?<=a)` trigger) -- dotnet `find_all=[]`,
   `im=false`;
   rust
  `find_anchored=Some(0:0)` is a phantom match where the reference and Lean agree
  no match exists.
- bug-03 (the `(?=c)` trigger) -- dotnet `find_all=[(0,0)]` (correct zero-width at
  0);
   rust's `stream` reports `1:1`.
   The stream/find_all disagreement is internal
  to rust and the reference confirms `0:0` is right.
- bug-06,
   bug-09 -- compile-time cost the reference does NOT share.
   dotnet
  compiles `\w{24}` in 6ms and the bug-09 unit `.n.................  n.  n` in
  21ms;
   rust takes ~3.3s and ~40-71s respectively (1000x+).
   The bug-09 dot-and-
  literal case is the cleanest comparison (no unicode-mode dependency).
- arm-bug-01 -- a rust-internal SIMD on/off differential;
   the reference accepts
  `^$`.
   Independent of the reference either way.

### Tier 2: outside the supported subset (rust accepts and mishandles)

The reference REJECTS the pattern at compile (lookaround-in-union,
 nested
lookarounds,
 anchor-in-complement,
 `\b`/`\B` away from word boundaries);
 rust
accepts it and then crashes or miscomputes:

- bug-11 -- rust accepts a lookaround-in-union pattern and PANICS at match time.
  A compile-accepted pattern that panics is still a defect (rust should reject at
  compile,
   as the reference does,
   or not crash),
   but it is outside the supported
  language,
   unlike bug-04/05.
- bug-12,
   bug-13 -- rust accepts and returns a wrong span (silent drop / width
  leak) for patterns the reference rejects.
- bug-07,
   bug-08,
   bug-10 -- same:
   rust accepts anchor-in-complement /
  lookaround-in-union patterns the reference rejects and returns a wrong result.
- the `\BU` / `\b` / `(?!\A)` triggers of bug-02 / bug-03 -- rejected by the
  reference;
   the CLEAN triggers above carry those findings instead.

## Does rust intend to reject these? (it is more permissive on purpose)

rust carries the same rejection machinery dotnet does:
 `ensure_supported_rec`
(`resharp-engine/src/lib.rs:772`) with a `Compatibility::LookaroundUnion` path
(`lib.rs:762`),
 and the algebra error literally reads "unsupported pattern:
 eg.
lookaround,
 `\b`/`^`/`$` inside a complement `~(...)` or a star `*`"
(`resharp-algebra/src/lib.rs:39`).
 But `ensure_supported_rec` deliberately
ACCEPTS some lookaround-in-union patterns (returning `LookaroundUnion` rather than
`UnsupportedPattern`) so rust supports a SUPERSET of the dotnet reference -- the
comment at `lib.rs:803` says it distributes `(A|B)&C` "to unlock some patterns
outside of RE# fragment".
 So rust does not merely fail to reject;
 it chooses to
support these,
 and its guard passes the Tier 2 patterns (they compile with no
`UnsupportedPattern`).
 The defect is therefore in rust's handling of patterns its
OWN guard blessed:
 bug-11 panics,
 bug-12/bug-13 return wrong spans,
 for inputs
`ensure_supported_rec` deemed supported.
 dotnet's stricter rejection is the safer
alternative rust chose not to take.

## Consequence for the writeups

Tier 1 are clean bugs against both the reference and the formalization.
 Tier 2
are real divergences too -- the Lean formalization defines a correct answer and
rust returns a wrong one,
 and a compile-accepted-then-crashing pattern (bug-11)
is never acceptable -- but the honest framing is "rust accepts and mishandles
patterns the reference engine rejects;
 the fix is most likely to reject them at
compile (as dotnet does) rather than to compute them.
" The crash findings are the
load-bearing ones;
 bug-04 and bug-05 are clean,
 and bug-11 is a crash even though
its pattern is out-of-subset.
