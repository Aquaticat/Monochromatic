# is_match false positive vs find_all on intersection with optional end-anchor (0.6.13, live)

> Scratch-path note: `/tmp/agent` paths in this document are historical.
> Use `~/temp/agent` for current work.

Second new live soundness bug,
 found by the self-consistency lane (check C1:
is_match is true exactly when find_all is non-empty) and minimized by `c1min`.
`is_match` returns true where `find_all` is empty and where the language genuinely
has no match.
 `find_all` is correct;
 `is_match` over-accepts.
 Verified on 0.6.13
(== HEAD `f0ce60a`),
 byte-identical on x86_64 (AVX2) and Apple M1 (NEON),
 so
arch-independent.

## Symptom

Minimal trigger:
 `_&(?:[ab]|$)?` (any-byte intersected with an optional union of a
byte class and the end-line anchor).

```text
/_&(?:[ab]|$)?/  (UnicodeMode::Ascii and Default)
  ""     : is_match=false find_all=[]            ok
  "\n"   : is_match=true  find_all=[]            C1 VIOLATION (false positive)
  "a"    : is_match=true  find_all=[(0,1)]       ok
  "\n\n" : is_match=true  find_all=[]            C1 VIOLATION (false positive)
  "ab"   : is_match=true  find_all=[(0,1),(1,2)] ok
```

`is_match` and `find_all` must agree (api.
md:
 "is_match is true exactly when
find_all is non-empty";
 this is one of the three invariants the `match_invariants`
fuzz target asserts).
 On `"\n"` they disagree,
 and `find_all` is the correct one.

## Why find_all is correct and is_match is the bug

`_&(?:[ab]|$)?` = `_` (any single byte,
 width 1) intersected with
`([ab] | $)?` (optional).
 For a span `[i,j]` to be in the language,
 both operands
must match `[i,j]`:

- `_` forces `j = i+1` (width exactly 1).
- `([ab]|$)?` at width 1 can only be the `[ab]` branch (`$` is zero-width;
   the
  optional empty is zero-width).
   So the intersection equals "one byte that is `a`
  or `b`".

`"\n"` has no `a`/`b` byte,
 so the language matches nothing in it.
 `find_all = []`
is correct,
 and the true `is_match` is `false`.
 resharp returns `is_match = true`:
a false positive.
 (The bug is not specific to `[ab]`;
 `_&(?:[a]|$)?` triggers it
too,
 and additionally on `"b\n"`.
)

## Trigger boundary

From `c1min` (Ascii;
 Default identical;
 M1 identical):

```text
_&(?:(?:_&[ab]?)(?!\A)|$)?   C1-BUG   (original fuzzer shape)
_&(?:[ab](?!\A)|$)?          C1-BUG
_&(?:[ab]|$)?                C1-BUG   (minimal)
_&(?:[ab](?!\A)|$)           C1-BUG   (the outer ? is not required)
_&(?:[a](?!\A)|$)?           C1-BUG
_&(?:(_(?!\A))|$)?           ok       (left branch = any-byte, not class)
_&(?:[ab](?!\A)|\z)?         ok       ($ replaced by \z)
[ab]&(?:[ab](?!\A)|$)?       ok       (left operand a class, not _)
```

Two ingredients are essential:
 the left operand of the intersection is `_`
(full any-byte),
 and the optional union on the right contains the line anchor `$`
(replacing it with `\z` removes the bug).
 The trailing `(?!\A)` and the outer `?`
are incidental.
 So the trigger is `_ & ( <class> | $ )` (optionally wrapped):
any-byte intersected with a union containing `$`.

## Root cause

`is_match` uses a forward path distinct from `find_all`
(`resharp-engine/src/ismatch.rs`:
 `is_match` at `:30` dispatches to `is_match_dfa`
`:5` / `is_match_fwd_ts` `:19`).
 The maintainer has stated the intent that
"is_match could use a separate forward path using fwd_ts node,
 that one is
guaranteed linear".
 That separate path mis-handles the `_ & (class | $)` shape:
the `$` (EndLine) lowering under the intersection with the universal `_` makes the
forward acceptance test report a match at a `\n` position where the actual
intersected language is empty.
 `find_all` uses the full enumeration path and is
correct.
 The fix surface is the is_match forward path's treatment of an end-line
anchor inside a union intersected with any-byte;
 alternatively,
 having is_match
agree with find_all by construction would close the whole bug-08 family.

## Adjudication and severity

Real bug,
 tier "asserted-contract / internal-inconsistency".
 It is the 06-11
bug-08 family (is_match vs find_all inconsistent),
 narrowed but not eliminated.
The pattern is inside the accepted superset (intersection + anchors),
 compiles
cleanly,
 and is answered (not rejected).
 `find_all` being correct means a consumer
using `find_all` (the `forbidden-strings` scanner) is unaffected;
 the impact is on
`is_match` callers,
 for whom this is a false positive (claims a match that does not
exist).
 A secret scanner that gated on `is_match` would fire on content that does
not actually match:
 a fail-toward-noise direction here,
 but still wrong.

## Reproduce

```bash
# ${HOME}/temp/agent/resharp-denot-oracle, resharp = "=0.6.13"
cargo run --release --bin c1min      # trigger-boundary minimization, both arches
cargo run --release --bin c1probe    # full per-config table
```

## Upstream filing

Minimal fix prototyped and verified,
 with a sharper root cause than this doc's
first read:
 `has_anchors` is computed on the forward-simplified node
(`lib.rs:1177`),
 which drops the `$` proven dead under the `_` intersection,
 so the
anchor-routing guard is `false` and the fast path is taken.
 The fix detects
anchors from the original node and defers to `find_all`;
 it passes the full
upstream suite (279/0).
 The 6-constraint check,
 the patch,
 and the additive-comment
draft for the duplicate (open issue #22) live in
`doc/troubleshooting/resharp-end-anchor-cross-api.md` (+ `.patch`).
 Not yet
posted:
 outward filing requires explicit authorization.
