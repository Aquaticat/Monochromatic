# BUG-2 "correctness issue found" assertion at engine.rs:960

## Classification

- Type: internal correctness assertion fires during matching.
- Phase: match time, inside the bounded or reverse-collect `find_all` path.
- Severity: panic (abort under the fuzzer). The assertion exists precisely
  because the engine knows this state should be unreachable. See BUG-4 for the
  sibling path that hits the same bad state without an assertion and leaks it.

## Minimal reproducer

```rust
use resharp::Regex;
// panics in the default option mode on a two byte input:
let re = Regex::new(r".\W*b+").unwrap();
let _ = re.find_all(b"ba"); // panics at engine.rs:960
```

Command line:

```sh
repro '.\W*b+' 6261 --hex
repro '\S+b'   62275f --hex   # also panics, in default/full/js/flags modes
```

`.\W*b+` on `ba` is the cleanest trigger: default option mode, a two byte ascii
input. The dotnet reference returns `no match` for it.

A second independent trigger:

```sh
repro '(\d|_)b(?:a)*' --sweep   # panics in mode=full on haystack "ba"
```

## Observed behaviour

```text
thread panicked at engine.rs:960:
assertion `left != right` failed: correctness issue found
  left: 18446744073709551615   (== usize::MAX == NO_MATCH)
  right: <the same>
```

For `\S+b` on `b'_` the assertion fires in the default, full, js, and flags
modes. In the hardened mode the same pattern and haystack instead produce an
`is_match` versus `find_all` disagreement (see BUG-3 class), and in ascii mode it
produces a real cross-engine `DIVERGE` (`is_match` true in resharp, false in the
`regex` crate; see notes).

## Expected behaviour

`find_all` returns the correct match set without aborting.

## Root cause

`resharp-engine/src/engine.rs:960`:

```rust
assert_ne!(NO_MATCH, l_max_end, "correctness issue found");
matches.push(Match { start: 0, end: l_max_end });
```

The reverse pass identified a candidate match start, but the forward scan from
that start returns `NO_MATCH` (`usize::MAX`, defined at `engine.rs:12`) for the
end. The forward and reverse views of the language disagree, so the sentinel
reaches the point where a `Match` end is required. The assertion catches it
here; the path in BUG-4 does not.

## Notes

- The `\S+b` trigger is also a genuine ascii-mode soundness bug on its own: on
  the pure-ascii haystack `b'_`, resharp reports `is_match = true` while the
  `regex` crate with `.unicode(false)` reports false. `\S+b` requires a non-space
  run ending in a literal `b`, and `b'_` has its only `b` at offset 0 with
  nothing before it, so there is no match. This overlaps BUG-7 (the `\S` family).
- Distinct triggers: 21 panic hits at this site in the first 80k sweep, all at
  `engine.rs:960`.
