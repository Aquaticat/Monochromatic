# BUG-8 default and hardened find_all return different results

## Classification

- Type: correctness, the two find_all algorithms disagree.
- Phase: match time.
- Severity: soundness. At least one of the two paths is wrong, and the default
  path is the one used unless the caller opts into hardening.

## Minimal reproducer

```rust
use resharp::{Regex, RegexOptions, Match};
let pat = r"~(_a+)";
let def = Regex::new(pat).unwrap();
let hard = Regex::with_options(pat, RegexOptions::default().hardened(true)).unwrap();
let hay = b"aaa";
assert_eq!(def.find_all(hay).unwrap(), hard.find_all(hay).unwrap()); // FAILS
// default:  [(0,1),(1,2),(2,3),(3,3)]
// hardened: [(0,2),(2,3),(3,3)]
```

Command line:

```sh
repro '~(_a+)' --sweep | grep HARDDIFF
```

## Observed behaviour

```text
HARDDIFF_FA|def=[(0,1),(1,2),(2,3),(3,3)]|hard=[(0,2),(2,3),(3,3)]|hay=616161|pat="~(_a+)"
```

On `aaa`, the default engine starts its first match as `(0,1)` and the hardened
engine as `(0,2)`. Under leftmost-longest these must be identical.

## Expected behaviour

Hardening only swaps the scan algorithm (`FindAll::Hardened` forces the general
`find_all_dfa` path; the default selects an optimised `Bounded`, `FwdPrefix`, or
`FwdLbPrefix` path). The language and therefore the match set are unchanged, so
`find_all` must be identical between the two.

## Root cause

`resharp-engine/src/lib.rs`, `compute_find_all` and the `find_all` dispatcher.
The default build picks an optimised forward path
(`find_all_fwd_bounded`, `find_all_fwd_prefix`, `find_all_fwd_lb_prefix`); the
hardened build forces `find_all_dfa` (the `FindAll::Hardened` arm). The
disagreement means one of the optimised paths computes a wrong match end or
start for these shapes. The hardened general path is the more trustworthy
reference.

## Distinct triggers

14 distinct patterns in the first 80k-pattern sweep. They split into groups that
matter for triage because they implicate different optimised paths and are
distinct from BUG-7:

- Complement only: `~(_a+)`, `~(aa*a)` (minimised from
  `~(([a-c](?:a)*|_\S))`), `~((b{0}[^a]{2,2}(()|[^\w]+)|c*))`.
- Anchor only: `^{2,2}(?=())[^\w]{0,1}`, `^{2,2}[\w]\W{0,2}` (double start
  anchor), `((?![\w])()|_*\A{0,2}c)`.
- Mixed with perl classes (overlaps BUG-7): several containing `\S`, `\D`, `\W`.

## Notes

- This is the same class as the already-tracked "hardened find_all drops
  zero-width matches at input boundaries", but these triggers are
  complement-based and anchor-based and reproduce on current `main`, so the
  prior zero-width fix does not cover them.
- `~(a+)`, `~(aa)`, `~(a)` do not trigger; the leading `_` (any byte) before the
  quantified run is required: `~(_a+)`.
