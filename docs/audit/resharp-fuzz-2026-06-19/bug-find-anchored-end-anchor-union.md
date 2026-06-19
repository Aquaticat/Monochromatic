# find_anchored phantom/missing span on a union of end anchors (0.6.13, live)

New live soundness bug found by the self-consistency lane and minimized by
`anchored_probe`/`trig`. `find_anchored` returns a wrong span for patterns shaped
like a union of end anchors concatenated with an end anchor. `find_all` and
`is_match` are correct on the same pattern, so the defect is isolated to the
`find_anchored` forward-scan path.

Verified on resharp 0.6.13 (== HEAD `f0ce60a` engine code), on both x86_64 (AVX2)
and Apple M1 (AArch64, NEON), byte-identical, so it is arch-independent.

## Symptom

Minimal trigger: `(\z|$)$`.

```text
/(\z|$)$/  (UnicodeMode::Ascii and Default, multiline on by default)
  ""    : find_all=[(0,0)]            is_match=true  find_anchored=Some(0,0)   ok
  "\n"  : find_all=[(0,0),(1,1)]      is_match=true  find_anchored=Some(0,1)   WRONG
  "\na" : find_all=[(0,0),(2,2)]      is_match=true  find_anchored=None        WRONG
  "\n\n": find_all=[(0,0),(1,1),(2,2)] is_match=true find_anchored=Some(0,1)   WRONG
```

`(\z|$)$` is a concatenation of zero-width assertions only; it cannot consume a
byte, so every match is zero-width. `find_all` reflects this correctly (all spans
are `(k,k)`). `find_anchored` is documented as "the longest match anchored at
offset 0", which for `"\n"` is the zero-width `(0,0)`. Instead:

- on `"\n"` it returns `Some(0,1)`, a phantom width-1 span that consumes `\n`,
  which the pattern's language cannot contain;
- on `"\na"` it returns `None`, missing the real zero-width match at offset 0
  that `find_all` reports.

Both forms contradict `find_all` directly, so the bug is self-evident from
internal inconsistency; no external oracle is required to adjudicate it. It is
the 2026-06-11 bug-02 (find_anchored phantom leading zero-width) and bug-10
(find_anchored non-maximal span vs find_all) family, narrowed but not eliminated.

## Trigger boundary

From `trig` (UnicodeMode::Ascii; Default identical):

```text
(\z|$)$    BUG       ($|\z)$   BUG       (\z|$)\z   BUG       (\z|$)$$  BUG
($)$       ok        (\z|$)    ok        $(\z|$)    ok        \z$       ok
(\z|$)[a]  ok        ((?=\z)|$)$ ok
(a|$)$     compile-rejected (Algebra(UnsupportedPattern))
(\b|$)$    compile-rejected (Algebra(UnsupportedPattern))
```

The trigger is specific: a union whose branches are BOTH end anchors
(`\z`/`$`, which lower to the END nodeid and an end lookahead), concatenated with
a following end anchor (`$`, `\z`, or `$$`). Removing the union (`($)$`), removing
the trailing anchor (`(\z|$)`), replacing the trailing anchor with a byte class
(`(\z|$)[a]`), or writing the anchor as an explicit lookahead (`((?=\z)|$)$`) all
make it correct. Putting a literal in the union (`(a|$)$`) is rejected at compile,
not mis-answered.

## Root cause

`find_anchored` (`resharp-engine/src/lib.rs:1899-1909`):

```rust
pub fn find_anchored(&self, input: &[u8]) -> Result<Option<Match>, Error> {
    if input.is_empty() { return Ok(self.empty_input_match()); }
    let inner = &mut *self.inner.lock().unwrap_or_else(|e| e.into_inner());
    if self.has_lb {
        // ugly scenario for find_anchored, easier to reject it than to special case it
        return Err(Error::Algebra(resharp_algebra::ResharpError::UnsupportedPattern))
    }
    Ok(inner.fwd.scan_fwd_optional(&mut inner.b, 0, input)?.map(|end| Match { start: 0, end }))
}
```

When the pattern has no lookbehind (`has_lb == false`, true here: `$`/`\z` lower
to END / end-lookahead, not lookbehind), `find_anchored` delegates to
`scan_fwd_optional(b, 0, input)` and wraps the returned end as `Match{start:0,end}`.
For the `(\z|$)$` derivative structure this forward optional scan computes the
wrong end: it returns `Some(1)` (a width leak past the satisfied zero-width
assertion) on `"\n"`, and `None` (start-nullability not detected) on `"\na"`. The
`find_all` path uses a different enumeration with correct zero-width seeding (the
`eba778c` NO_END work), which is why `find_all` is right while `find_anchored` is
wrong. The fix surface is the `scan_fwd_optional` start-nullability/zero-width
handling for unions of anchors, or making `find_anchored` delegate to the
`find_all` leftmost-at-0 result (as an earlier `fb82174` revision did before
`f12ff0b` switched to the reject-lb form).

## Adjudication and severity

Real bug, tier "asserted-contract / internal-inconsistency" (see
`method-and-oracles.md`). The pattern is inside the supported subset (no
lookbehind; `find_anchored` accepts the query rather than returning
`UnsupportedPattern`). `find_all` and `is_match` are correct, so a consumer using
those (the `forbidden-strings` scanner uses `find_all`) is unaffected; the impact
is confined to direct `find_anchored` users. It is nonetheless a soundness defect
in a documented production API: it both invents a span that is not in the language
and drops a span that is.

Note the inconsistency in `find_anchored`'s own restriction policy: it returns
`UnsupportedPattern` for `^`-bearing patterns (because `^` lowers to a lookbehind)
yet silently mis-answers the analogous `$`/`\z` shape. Either correct handling or a
matching rejection would resolve it.

## Reproduce

```bash
# /tmp/agent/resharp-denot-oracle, resharp = "=0.6.13"
cargo run --release --bin anchored_probe   # full table across configs
cargo run --release --bin trig             # trigger-boundary minimization
```

## Upstream filing

Not filed. Filing is an outward action requiring explicit authorization, and the
repo's upstream-filing policy (`docs/troubleshooting/resharp.md`) requires a
prototyped, architecture-compatible fix first. This is a strong candidate: it is a
minimal, self-evident internal inconsistency in the bug-02/bug-10 family the
maintainer has been fixing, and ieviev has accepted comparable reports. A prepared
report would include the minimal `(\z|$)$` repro, the `find_all`-is-correct
contrast, the arch parity, and the `scan_fwd_optional` root-cause pointer above.
