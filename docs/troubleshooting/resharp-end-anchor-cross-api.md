# resharp 0.6.13: find_anchored and is_match disagree with find_all on end-anchor shapes

Two cross-API soundness bugs in `ieviev/resharp` 0.6.13 (== repo HEAD `f0ce60a`,
behaviorally identical to the published 0.6.13 commit `d89964b`). `find_all` is
correct; `find_anchored` and `is_match` each return a wrong answer on certain
end-anchor shapes, violating the documented cross-API contract. Found by the
2026-06-19 fuzz campaign (`docs/audit/resharp-fuzz-2026-06-19/`); this doc adds
the root-cause trace, the upstream-filing check, and the prototyped fix.

## Symptom

Bug 1, `find_anchored` phantom/missing span. Pattern `(\z|$)$` (a union of end
anchors concatenated with an end anchor), `UnicodeMode::Ascii` and `Default`:

```text
/(\z|$)$/  "\n"  : find_all=[(0,0),(1,1)]  find_anchored=Some(0,1)  WRONG (phantom width-1)
/(\z|$)$/  "\na" : find_all=[(0,0),(2,2)]  find_anchored=None       WRONG (missing match at 0)
```

The pattern is zero-width only, so `Some(0,1)` is an impossible span and `None`
drops the real `(0,0)` that `find_all` reports.

Bug 2, `is_match` false positive. Pattern `_&(?:[ab]|$)?` (any-byte intersected
with an optional union of a class and the end anchor), on `"\n"`:

```text
/_&(?:[ab]|$)?/  "\n" : is_match=true  find_all=[]   WRONG (false positive)
```

`_` forces width 1; `([ab]|$)?` matches width 1 only via `[ab]`; `\n` is not in
`[ab]`, so the language is empty on `"\n"`. `find_all=[]` is correct; `is_match`
over-accepts.

Both violate api.md's asserted contract: `is_match` is true exactly when
`find_all` is non-empty, and `find_anchored=Some(m)` means `m` is the longest
`find_all` match at offset 0. Both are arch-independent (identical on x86_64 AVX2
and Apple M1 NEON). They are the 2026-06-11 bug-02 / bug-08 / bug-10 families,
narrowed across versions but not eliminated.

## Root cause

Both bugs route a non-lookbehind anchor pattern through the forward optional scan
instead of the authoritative `find_all` enumeration.

`find_anchored` (`resharp-engine/src/lib.rs:1899-1909`):

```rust
pub fn find_anchored(&self, input: &[u8]) -> Result<Option<Match>, Error> {
    if input.is_empty() { return Ok(self.empty_input_match()); }
    let inner = &mut *self.inner.lock().unwrap_or_else(|e| e.into_inner());
    if self.has_lb {
        return Err(Error::Algebra(resharp_algebra::ResharpError::UnsupportedPattern))
    }
    Ok(inner.fwd.scan_fwd_optional(&mut inner.b, 0, input)?.map(|end| Match { start: 0, end }))
}
```

For a non-lookbehind pattern it delegates to `scan_fwd_optional(b, 0, input)`,
which for the `(\z|$)$` derivative structure returns `Some(1)` (a width leak past
the satisfied zero-width assertion) or `None` (start-nullability not detected).

`is_match` (`resharp-engine/src/ismatch.rs:30-50`) dispatches the
`Bounded`/`FwdPrefix`/`FwdLbPrefix` kinds to `is_match_fwd_ts`
(`ismatch.rs:19-25`), which calls the same `scan_fwd_optional`:

```rust
pub(crate) fn is_match_fwd_ts(&self, input: &[u8]) -> Result<bool, Error> {
    let inner = &mut *self.inner.lock().unwrap_or_else(|e| e.into_inner());
    Ok(inner.fwd_ts.scan_fwd_optional(&mut inner.b, 0, input)?.is_some())
}
```

The deeper sub-cause for `is_match` on `_&(?:[ab]|$)?`: the `has_anchors` guard
that would route anchor patterns away from the fast path is computed on the
forward-SIMPLIFIED node, not the original:

```rust
// resharp-engine/src/lib.rs:1035
let node_fwd_simpl = b.simplify_fwd_initial(node);
// resharp-engine/src/lib.rs:1177
let has_anchors = b.contains_anchors(node_fwd_simpl);
```

`simplify_fwd_initial` proves the `$` branch dead under the width-1 `_`
intersection and drops it, so `b.contains_anchors(node_fwd_simpl)` is `false` for
`_&(?:[ab]|$)?` even though `$` alone and `(\z|$)$` both report `true` (confirmed
with a `dbg_flags` probe: `has_anchors=false kind=FwdPrefix` for
`_&(?:[ab]|$)?`). With `has_anchors` false the fast `scan_fwd_optional` path is
taken and over-accepts. So the anchor-routing flag and the runtime path disagree.

Wrong earlier hypothesis worth recording: the first prototype gated the
defer-to-`find_all` fix on `has_anchors`. That fixes `find_anchored` and the
`is_match` cases where `has_anchors` is correctly set (e.g. `_&(?:[ab](?!\A)|$)?`,
which has a `\A`), but it does NOT fix the minimal `_&(?:[ab]|$)?`, because the
gate is the very flag that is wrong. The fix must use anchor presence in the
ORIGINAL node, not the simplified one.

## Verification

Version under test: resharp 0.6.13, repo HEAD `f0ce60a` (`origin`
`https://github.com/ieviev/resharp.git`). Harness: the campaign's
`anchored_probe`, `trig`, `c1probe`, `c1min` binaries
(`/tmp/agent/resharp-denot-oracle`), each compiling `resharp = "=0.6.13"` and
calling the APIs directly.

Patterns that fail (find_anchored): `(\z|$)$`, `($|\z)$`, `(\z|$)\z`, `(\z|$)$$`.
Patterns that are correct (find_anchored): `($)$`, `(\z|$)`, `(\z|$)[a]`,
`((?=\z)|$)$`, `\z$`. Compile-rejected (not mis-answered): `(a|$)$`, `(\b|$)$`.

Patterns that fail (is_match): `_&(?:[ab]|$)?`, `_&(?:[ab](?!\A)|$)?`,
`_&(?:[a](?!\A)|$)?`, `_&(?:(?:_&[ab]?)(?!\A)|$)?`. Correct: `_&(?:_(?!\A)|$)?`,
`_&(?:[ab](?!\A)|\z)?` (uses `\z` not `$`), `[ab]&(?:[ab](?!\A)|$)?` (left operand
a class, not `_`). Full catalogs:
`docs/audit/resharp-fuzz-2026-06-19/bug-find-anchored-end-anchor-union.md` and
`bug-is-match-false-positive-inter-optional-end-anchor.md`.

## Verified workarounds

Consumer-side, at our boundary: use `find_all` and derive the needed answer from
it, never `find_anchored`/`is_match` directly, for anchor-bearing patterns.

```rust
// instead of re.is_match(input)
let any = !re.find_all(input)?.is_empty();
// instead of re.find_anchored(input)
let at0 = re.find_all(input)?.into_iter().next().filter(|m| m.start == 0);
```

Tradeoff: `find_all` enumerates all matches, so it is slower than the
single-forward-scan `is_match`/`find_anchored` fast paths; for anchor-free
patterns the fast paths are correct and cheaper, so only route anchor-bearing
patterns through `find_all`. The `forbidden-strings` scanner already uses
`find_all` exclusively, so it is unaffected by either bug.

## What does not work

- Gating the defer-to-`find_all` fix on `self.has_anchors`. `has_anchors` is
  computed on the forward-simplified node and is `false` for `_&(?:[ab]|$)?`, so
  the gate misses the minimal case. Use anchor presence in the original node.
- Rejecting these at `find_anchored` like the lookbehind case. `find_anchored`
  already returns `UnsupportedPattern` for `^`-bearing patterns (which lower to a
  lookbehind), but `$`/`\z` lower to lookahead/END, so they are accepted and then
  mis-answered. Rejecting all anchor patterns would be a larger behavior change
  than restoring correctness via `find_all`.

## Upstream filing decision

All six constraints hold; the prototype below closes constraint 6. The matching
upstream issue is the open #22, so the artifact is an additive comment, not a new
issue.

1. **Upstream's fault?** Yes. Two of resharp's own APIs contradict a third
   (`find_all`) and violate the api.md asserted contract. Behavior bug, not
   wording, not an architectural restriction.
2. **Can upstream fix it?** Yes. Prototyped below; passes the full test suite.
3. **Supporting this use case?** Yes. `find_anchored` and `is_match` are
   documented production APIs and the cross-API agreement is asserted intent the
   maintainer is converging on (issue #22).
4. **Would the repo welcome it?** Yes. No CONTRIBUTING.md, issue/PR template, or
   AI-assistance ban exists (the absent `.github/` policy was checked for the
   06-04 filing; unchanged), and ieviev explicitly invited more findings (issue
   #17: "If you find some more you can reopen or add a new issue"; issue #21:
   "excellent job"). No ban found.
5. **Likely to fix?** Yes. ieviev fixed the bug-02/08/10 family across 0.6.9 to
   0.6.13 and opened #22 himself to unify the drivers; these are tail triggers of
   exactly that work.
6. **Prototyped a minimal fix?** Yes. See "Auto-prototype" below.

`.out-of-scope/` checked: no exemption for resharp (`cargo-workspace.md` mentions
resharp's Cargo settings only).

### Auto-prototype (constraint 6)

Prototyped in a disposable upstream clone (`mktemp --directory` under
`/tmp/agent/`, `origin` and commit verified `f0ce60a` before editing). The
minimal fix defers anchor-bearing patterns (detected from the ORIGINAL node) to
the authoritative `find_all`, keeping the fast path for anchor-free patterns:

- add an `anchors_orig` flag computed as `b.contains_anchors(node)` (original
  node) alongside the existing `has_anchors` from `node_fwd_simpl`;
- `find_anchored`: when `anchors_orig && find_all != Anchored`, return the
  leftmost-longest `find_all` match at offset 0 (the maintainer's own pre-`f12ff0b`
  approach), else the existing fast path;
- `is_match`: in the `Dfa/Hardened` and `Bounded/FwdPrefix/FwdLbPrefix` arms, when
  `anchors_orig`, return `!find_all(input)?.is_empty()`, else the existing fast
  path.

Full diff: [resharp-end-anchor-cross-api.patch](resharp-end-anchor-cross-api.patch)
(2 files, 36 insertions). Verification, in the prototype clone:

- Both repros fixed: `find_anchored(\z|$)$` now returns `Some(0,0)`/`None`
  matching `find_all`; `is_match _&(?:[ab]|$)?` on `"\n"` now `false`. The
  campaign repro harness prints `RESULT: ALL FIXED`.
- No regression: the upstream test suite passes in a credential-free container
  (`podman run --rm --memory=6g --cpus=4 --volume <clone>:/work
  docker.io/rustlang/rust:nightly cargo test -p resharp`): **279 passed, 0
  failed**, including `cross_api_prop.rs` and `engine_test.rs` (which exercise the
  touched contracts).

The fix restores correctness conservatively; the maintainer may prefer to instead
correct `has_anchors` detection (so the existing flag is reliable) or land the
full driver unification of #22. The prototype demonstrates a working minimal fix
exists and gives a tested starting point.

### Duplicate: issue #22 (open)

`gh search` found [ieviev/resharp#22](https://github.com/ieviev/resharp/issues/22)
"Unify the find_all / find_anchored / stream drivers behind one match-enumeration
core" (open, authored by this project). Both bugs are concrete instances of the
driver divergence #22 proposes to fix. The thread does not yet contain these two
minimal reproductions, the `has_anchors`-on-simplified-node root cause, or a
prototyped fix, so an additive comment advances it. Do not open a new issue.

Additive comment draft (post to #22 only with authorization; discloses AI
assistance per a conservative reading of constraint 4):

~~~md
Two concrete instances of the driver divergence this issue is about, found
fuzzing 0.6.13 (HEAD f0ce60a), both with `find_all` correct and a sibling API
wrong. Reproductions are minimal and arch-independent (AVX2 and NEON identical).

find_anchored phantom/missing span on a union of end anchors:

```rust
// (\z|$)$ , UnicodeMode::Ascii (Default identical)
"\n"  : find_all=[(0,0),(1,1)]   find_anchored=Some(0,1)  // phantom width-1
"\na" : find_all=[(0,0),(2,2)]   find_anchored=None       // missing match at 0
```
`(\z|$)$` is zero-width only, so `Some(0,1)` cannot be in the language.
`find_anchored` delegates non-lookbehind patterns to `scan_fwd_optional`
(lib.rs:1908), which mis-answers this shape.

is_match false positive on intersection with an optional end anchor:

```rust
// _&(?:[ab]|$)? , UnicodeMode::Ascii
"\n" : is_match=true   find_all=[]   // false positive; no match exists
```
Root cause: `has_anchors` is computed on the forward-simplified node
(`b.contains_anchors(node_fwd_simpl)`, lib.rs:1177), and `simplify_fwd_initial`
drops the `$` branch as dead under the width-1 `_` intersection, so
`has_anchors=false` for this pattern (it is `true` for `$` alone). With the flag
false, is_match takes the `scan_fwd_optional` fast path (ismatch.rs:23) and
over-accepts.

A minimal fix that restores correctness and passes `cargo test -p resharp`
(279 passed, 0 failed): detect anchors from the ORIGINAL node (an `anchors_orig`
flag) and, when set, defer `find_anchored`/`is_match` to `find_all` (the
pre-f12ff0b find_anchored approach), keeping the fast path for anchor-free
patterns. The other directions are correcting `has_anchors` detection so the
existing flag is reliable, or the full driver unification this issue proposes.
Investigation and patch were AI-assisted; the reproductions, the source trace,
and the test run were verified.
~~~
