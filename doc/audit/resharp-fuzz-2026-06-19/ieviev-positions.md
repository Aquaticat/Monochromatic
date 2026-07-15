# Maintainer (ieviev) stated positions, for adjudication

Verbatim positions gathered from the resharp issue/PR history and source/docs
(commit hashes and issue numbers cited).
 These decide which campaign observations
are real bugs vs by-design,
 and which findings are worth filing.
 Note:
 ieviev left
no PR-conversation or inline review comments on the merged Aquaticat PRs
(#12/#14/#15/#16/#20/#24/#25/#26/#28);
 his recorded views live in the linked
issues (#17/#21/#22) and the two non-merged PRs (#13/#23).

## On the reachable "panics" (kept by design)

Issue #22:
 "i would keep both of these,
 these are harmless in release and only
prevent an optimization,
 but they do reveal something that should not be in the
engine in the first place,
 it's good if it appears in debug runs.
" So the
re-entrancy guard and the debug-asserts are intentional debug-only tripwires,
 not
removable defects.
 This campaign found 0 reachable panics regardless.

## On the full-Unicode \w compile cost (acknowledged, deferred)

Issue #17 (BUG-23):
 "This one is slightly better but not fixed,
 will need to have a
separate builder optimization pass.
" Issue #21:
 "the several seconds of compile
time for full UTF-8 support with `\w{24}` is to be expected";
 "one important
contract that RE# should meet is that 'warm' match time is always fast,
 with all
costs shifted to lazy compilation ... 27s compile is a bit too much but something
like ~5s is acceptable if repeated warm use is fast";
 "the real solution is to
suggest pre-compiling and serializing for huge patterns";
 "optional loops are
generally MUCH cheaper in RE#,
 eg `\w{0,50}` is vastly smaller than `\w{50}`".
 This
campaign's measured curve (peak ~4.7s near N=24,
 `\w{0,N}` ~0.1s) matches this
account exactly (`compile-cost-recheck.md`).

## On stream (gated experimental)

Issue #21:
 "i decided to pull stream feature entirely for now and later support it
with a restricted feature set";
 "the other issues are fixed".
 Issue #22:
 "regarding
stream ... currently it's hard to reason about how the matches relate to is_match
or find_all".
 Implementation:
 gated behind an off-by-default `stream` Cargo feature
(`f12ff0b`),
 documented "do not enable in production".
 So the C5 phantom matches are
by design (`stream-experimental.md`).

## On is_match using a separate path (relevant to this campaign's is_match finding)

Issue #17:
 "is_match could use a separate forward path using fwd_ts node,
 that one
is guaranteed linear.
" This is the architectural reason is_match can diverge from
find_all:
 they are different code paths.
 This campaign's is_match false positive
(`bug-is-match-false-positive-inter-optional-end-anchor.md`) is a soundness defect
in that separate path,
 not a deliberate divergence (the api.
md contract requires
is_match and find_all to agree).

## On find_anchored (relevant to this campaign's find_anchored finding)

`f12ff0b` made find_anchored reject lookbehind patterns:
 "ugly scenario for
find_anchored,
 easier to reject it than to special case it"
(`resharp-engine/src/lib.rs:1905`).
 For non-lookbehind patterns it delegates to a
forward optional scan.
 This campaign's finding
(`bug-find-anchored-end-anchor-union.md`) is that this forward path mis-answers an
all-end-anchor union shape;
 the same reject-or-fix choice the maintainer already
applied to lookbehind would resolve it.

## On the accepted superset (the threat model)

`doc/features.md`:
 "A pattern compiling here is not evidence it is inside the
formally verified RE# fragment ... The accepted-superset region is newer and has
less formal backing ... recent fuzzing found most of its soundness issues exactly
there.
 If you need maximum confidence,
 staying inside the fragment (no
lookaround-in-union,
 no anchors under complement) is the conservative choice.
" Both
of this campaign's findings are in the accepted superset (intersection plus end
anchors),
 consistent with this warning.

## On fuzzing contributions (receptiveness to filing)

Issue #17:
 "These would've been very hard to catch without proper fuzzing.
 If you
find some more you can reopen or add a new issue.
" Issue #21:
 "excellent job!
 i
will have a look at these soon.
" So upstream is receptive to well-formed reports,
which informs the (authorization-gated) filing decision for the two new findings.
