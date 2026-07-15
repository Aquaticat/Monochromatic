# resharp-rust deliberate limits and recommendations

This inventories every construct resharp-rust rejects at compile time that a user
might reasonably expect to work,
 with a recommendation for each.
 The user asked
for this so the limits can be discussed with ieviev,
 on the premise that some
"intentional" limits are really just features that have not been implemented yet.

## Method and reference

The arbiter of "is this construct meaningful" is the verified Lean formalization
in `~/Downloads/extended-regexes` (the reference).
 Its regular-expression algebra
(`Regex/Definitions.lean`,
 the `RE` inductive type) is exactly:

```text
ε, Pred, Alternation (⋓), Intersection (⋒), Concatenation (⬝), Star (*),
Negation (~), Lookahead (?=), Lookbehind (?<=), NegLookahead (?!), NegLookbehind (?<!)
```

A construct that is expressible in this algebra is semantically well-defined in
the reference,
 so a resharp-rust limit on it is an implementation or architecture
gap,
 not a semantic impossibility.
 A construct outside the algebra (anything that
needs backtracking or non-regular power) is fundamental to the leftmost-longest
automaton model and the limit is correct.

The dotnet engine (`ieviev/resharp-dotnet`) is not a reference.
 It is another
implementation to look at,
 and it has its own defects,
 so its behaviour is
reported below only as a secondary data point,
 never as the standard.

Each limit was reproduced on the pristine engine `/tmp/agent/repro` and traced to
its source.
 `REJECT` means `Regex::with_options` returns an error.

## Group A: fundamental to the leftmost-longest model (keep rejected)

These constructs are not in the reference algebra.
 Rejecting them is correct.

### Lazy quantifiers

- Trigger:
   `a*?`,
   `a+?`,
   `a??`,
   `a{1,3}?` all REJECT.
- Source:
   `resharp-parser/src/lib.rs:2275` and `:2363`
  (`ErrorKind::UnsupportedLazyQuantifier`).
- Reference:
   not expressible.
   The reference matches leftmost-longest,
   so there is
  no greedy-versus-lazy choice to make;
   a lazy marker has no meaning.
- dotnet:
   accepts the syntax but ignores the marker,
   returning the greedy result
  (`a+?` on `aaa` gives `0:3`,
   not `0:1`).
- Recommendation:
   keep rejecting,
   and keep the specific error.
   Rejecting is more
  honest than dotnet's silent-ignore,
   which would hand a user who wrote `a+?`
  expecting the shortest match the longest match instead.
   If PCRE-port ergonomics
  matter later,
   accept-and-treat-as-greedy is possible,
   but only with a loud
  diagnostic that the laziness is dropped.

### Backreferences

- Trigger:
   `(a)\1`,
   `(?<x>a)\k<x>` REJECT.
- Source:
   `resharp-parser/src/lib.rs:2621` (`ErrorKind::UnsupportedBackreference`).
- Reference:
   not expressible.
   Backreferences make the language non-regular,
   which
  is outside any derivative or automaton model.
- Recommendation:
   keep rejecting.
   This is a hard boundary of the approach,
   not a
  gap.
   The specific error is good;
   keep it.

### Swap-greed flag

- Trigger:
   `(?U)a+` REJECT.
- Source:
   `resharp-parser/src/lib.rs:1872` (`Flag::SwapGreed` to
  `UnsupportedResharpRegex`).
- Reference:
   not expressible,
   same reason as lazy quantifiers (no greedy notion).
- Recommendation:
   keep rejecting.
   Consider a more specific error than the generic
  `UnsupportedResharpRegex` so the message names the swap-greed flag.

## Group B: expressible in the reference, limited by the engine (candidates to implement)

These constructs are first-class in the reference algebra,
 so the limits are
implementation or architecture gaps.
 These are the ones most likely to be "not
done yet" rather than "cannot be done.
"

### Lookbehind anywhere except the start of a concatenation

- Trigger:
   a lookbehind that is not leftmost in its concatenation REJECTs,
   while a
  leading one is accepted.

  ```text
  (?<=a)b      ok     (?<!b)a    ok      (lookbehind at start)
  a(?<!b)      REJECT  .(?<!b)   REJECT   ab(?<!c)  REJECT   b(?<!b)  REJECT
  a^b          REJECT                     (mid-pattern ^, which compiles to a lookbehind)
  ```

  Lookahead has no such restriction:
   `a$b` and `a\bc` (a trailing or mid lookahead)
  compile.
   The asymmetry is the tell.
- Source:
   `resharp-parser/src/lib.rs:479` `ensure_lookbehind_at_start`,
   which
  returns `Err(g.span)` for any lookbehind reached with `at_start == false` (a
  preceding factor may consume).
   Variable-length lookbehind bodies are fine at the
  start:
   `(?<=a+)b`,
   `(?<=a|bb)c`,
   `(?<=a*)b` all compile,
   so the restriction is
  purely positional.
- Reference:
   `Lookbehind` and `NegLookbehind` are first-class constructors usable
  in any position,
   so trailing lookbehind is well-defined.
- Architecture note:
   the engine takes forward derivatives and resolves a lookbehind
  with a reverse scan anchored at the match start,
   which makes a leading lookbehind
  natural and a trailing one hard,
   since a trailing lookbehind would need the
  consumed prefix tracked through the forward pass.
   This is the reason the limit
  exists,
   and it is an architecture constraint,
   not a semantic one.
- Recommendation:
   this is the highest-value limit to lift.
   It is expressible in
  the reference and dotnet handles it,
   so users porting real patterns will hit it
  constantly (`\w+(?<!ing)`,
   `foo(?<!bar)`).
   Two paths:
   implement trailing
  lookbehind by carrying the consumed-prefix automaton state through the forward
  pass,
   or,
   if that is too costly,
   at minimum replace the generic error with one
  that says "lookbehind is only supported at the start of an expression" so users
  are not left guessing.
   The lookahead-anywhere versus lookbehind-start-only
  asymmetry should be documented either way.

### Lookaround or anchor inside a complement or a star

- Trigger:
   complementing or starring a sub-expression that is,
   or ends in,
   a
  zero-width lookaround.

  ```text
  ~((?=a))   REJECT  ~((?!a))  REJECT  ~((?<=a)) REJECT  ~((?<!a)) REJECT
  ~(b(?=a))  REJECT  ~(b(?<=a)) REJECT  ~(a|(?=b)) REJECT
  ((?=x+))*  REJECT  ((?<!\d))* REJECT  ((?<! )\W)+ REJECT
  ~((?=a)b)  ok      ~((?!a)b) ok       ~(a(?=b)c) ok      ~((?=a)&b) ok
  ~(a)       ok      ~(ab)     ok
  ```

  The implemented rule is more nuanced than a blanket ban:
   a lookaround inside a
  complement or star is accepted when a consuming factor follows it (so the
  expression does not end in an assertion),
   and rejected when the lookaround is
  standalone or trailing.
- Source:
   `resharp-algebra/src/lib.rs:39`,
   error text "unsupported pattern:
   eg.
  lookaround,
   `\b`/`^`/`$` inside a complement `~(...)` or a star `*`".
- Reference:
   `Negation`,
   `Star`,
   and the lookaround constructors are all in the
  algebra,
   so every one of these terms is well-defined.
   The reference even proves
  the relevant rewrite:
   `Regex/EliminationNegLookarounds.lean` shows negative
  lookarounds are unnecessary once start and end anchors are primitive.
- Recommendation:
   expressible and partly implemented already,
   so this is a
  completion task,
   not a fundamental wall.
   `EliminationNegLookarounds.lean` is a
  ready-made roadmap for the rejected cases:
   eliminate the trailing or standalone
  lookaround via the proven rewrite,
   then complement or star the result.
   If full
  support is deferred,
   sharpen the error to state the actual rule (a lookaround
  may not be the last factor inside a complement or star),
   since the current
  message implies a stricter ban than the code enforces.

### Special word boundary assertions

- Trigger:
   `\b{start}`,
   `\b{end}`,
   and the half and angle variants REJECT.
- Source:
   `resharp-parser/src/lib.rs:1942` to `:1958`
  (`AssertionKind::WordBoundaryStart` and siblings to `UnsupportedResharpRegex`),
  while plain `\b` and `\B` are implemented via
  `rewrite_word_boundary_in_concat`.
- Reference:
   expressible.
   A start-of-word boundary is `(?<!\w)(?=\w)` and an
  end-of-word boundary is `(?<=\w)(?!\w)`,
   both lookaround combinations in the
  algebra.
   resharp already encodes plain `\b` as exactly this kind of combination.
- dotnet:
   accepts the syntax.
- Recommendation:
   implement by desugaring each special word boundary to its
  lookaround pair,
   reusing the existing `\b` machinery,
   or document them as
  unsupported sugar with the one-line lookaround equivalent.
   Low risk,
   since the
  plain `\b` path already proves the encoding works.

## Group C: pragmatic and parsing choices (tune or align)

### Counted-repetition and size caps

- Trigger:
   `a{1,1000}` REJECT (the upper bound exceeds the repeat cap).
- Source:
   `resharp-parser/src/lib.rs:56` to `:59`:
   `DEFAULT_MAX_REPEAT = 500`,
  `DEFAULT_EXPANDED_AST_LIMIT = 50_000`,
   `DEFAULT_MAX_LIST_LEN = 4_000`,
  `DEFAULT_MAX_DEPTH = 1_000`.
   These are configurable on the parser.
- Reference:
   expressible (`a{1,n}` is just nested concatenation and alternation),
  so the cap is a resource guard,
   not a semantic limit.
- Relevance:
   BUG-11 in this audit is a super-linear compile blowup on small
  intersection-plus-class-repeat patterns,
   so caps like these are defensively
  important;
   lifting them naively would widen that blowup surface.
- Recommendation:
   keep the caps,
   but two improvements.
   First,
   `max_repeat = 500`
  is low for real patterns (timestamps,
   fixed-width fields);
   consider raising it
  or,
   better,
   compiling large bounded repeats without fully expanding the AST so
  the limit is on real cost rather than on the literal bound.
   Second,
   surface the
  specific cap that was hit in the error so a user can raise the right knob.

### Character-class range with a class endpoint

- Trigger:
   `[\d-a]` REJECT.
- Source:
   `resharp-parser/src/lib.rs:305` (`ErrorKind::ClassRangeLiteral`):
   a range
  boundary must be a single literal codepoint,
   and `\d` is a class.
- Reference:
   the intended class is expressible (`Pred`);
   this is purely a parsing
  decision about an ambiguous form.
- dotnet:
   reads the `-` literally,
   matching `\d`,
   `-`,
   or `a`.
   PCRE and the Rust
  `regex` crate also treat `-` as a literal when an endpoint is a class.
- Recommendation:
   low priority.
   Either align with the common convention (treat the
  `-` literally when an endpoint is a class) for portability,
   or keep rejecting but
  make the error name the offending `-` and suggest escaping it as `\-`.

## Summary

- Keep rejecting (fundamental,
   outside the reference algebra):
   lazy quantifiers,
  backreferences,
   swap-greed flag.
- Implement or complete (expressible in the reference,
   gated by the engine):
  trailing and mid-pattern lookbehind (highest value),
   lookaround or anchor as the
  last factor inside a complement or star (a roadmap exists in
  `EliminationNegLookarounds.lean`),
   special word boundary assertions.
- Tune or align (pragmatic or parsing):
   counted-repeat and size caps (raise or
  expand lazily,
   and name the cap hit),
   class-endpoint ranges (align with the
  literal-hyphen convention or improve the error).
- Cross-cutting:
   several limits share the generic `UnsupportedResharpRegex` error.
  Giving each a specific message would tell users which limit they hit and whether
  it is fundamental or just not implemented yet.
