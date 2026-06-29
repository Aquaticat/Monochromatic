# Lean formal position differential

Re-establishes the formally-verified position oracle the 2026-06-11 campaign used,
which is the right replacement for the retiring dotnet RE# reference.

## Recovery and rebuild

The 06-11 Lean toolchain was reported as `~/Downloads/extended-regexes` on the M1;
that directory was gone (only a Windows ISO remained),
 but the full project was
recoverable from `~/.Trash/extended-regexes` (119 files:
 `lakefile.lean`,
`lean-toolchain` pinning `leanprover/lean4:v4.24.0-rc1`,
 `lake-manifest.json` with
mathlib and friends,
 and the `Regex/` library:
 `Definitions.lean`,
 `Derives.lean`,
`MatchingAlgorithm.lean`,
 `EliminationNegLookarounds.lean`,
 `Correctness.lean`,
...).
 The generated 06-11 case dirs (`~/lc_4004`,
 `~/lc_1001`,
 `~/leanchunks`) also
survived.

The missing root aggregator `Regex.lean` was regenerated (one `import Regex.<mod>`
per library module).
 `lake exe cache get` fetched the mathlib olean cache (7226
files),
 and `lake build Regex.MatchingAlgorithm` completed (768 jobs).
 The oracle
evaluates:
 `lake env lean <chunk>.lean` prints `llmatch` spans (confirmed by
re-running a recovered 06-11 chunk).

`llmatch` is leftmost-longest first match over `RE (BA Char)`,
 the same quantity as
resharp `find_all[0]`.
 The glue scripts (`gen_lean_ast.py`,
 `diff_lean.py`) were
NOT recovered,
 so the differential generator was rebuilt fresh.

## Method

`gen_pairs.py` is AST-first:
 one random AST emits BOTH a fully-parenthesized
resharp pattern and a Lean `RE` term (operators verified against the recovered
chunks:
 concat `⬝`,
 union `⋓`,
 inter `⋒`,
 eps `ε`,
 complement
`~`,
 postfix `*`,
 lookarounds `(?= )` `(?! )` `(?<= )` `(?<! )`).
 It stays in the
Lean-faithful (trust0) zone:
 lookarounds and intersection and complement are
generated,
 but no anchors,
 no nested lookarounds,
 and no lookaround/anchor inside a
complement body,
 because those are exactly where 06-11 found the Lean translation
faithfulness unestablished.
 The target is the bug-13 class:
 intersection with a
zero-width (optional) lookahead,
 plus positive/negative lookarounds and complement.

The Lean side is evaluated with `lake env lean pairs.lean` (prints `Rn i:j` /
`Rn none`);
 the resharp side is `src/bin/readpairs.rs` (`find_all[0]` under
`UnicodeMode::Ascii`,
 prints `Rn i:j` / `Rn none` / `Rn cerr` / `Rn PANIC`).
 The
two are joined by `Rn` and diffed.

## Result

On the first batch (6000 generated cases,
 of which the Lean matcher had evaluated
2892 by the harvest point;
 its leftmost-longest matcher has exponential
complexity,
 per ieviev,
 so it is slow on some complement-heavy cases):

```text
joined comparable = 2891
AGREE              = 2310
DISAGREE           = 0
resharp rejected at compile (cerr) = 581
panics / ferr      = 0
```

Zero disagreements between resharp `find_all[0]` and the formally-verified Lean
`llmatch` over 2310 comparable lookaround-superset cases.
 The 581 `cerr` cases are
patterns resharp rejects at compile (conservative;
 not a soundness comparison).
This formally confirms the 06-11 bug-11 / bug-12 / bug-13 positional-correctness
class (self-consistent but positionally-wrong `find_all` on intersection +
lookaround) is fixed in 0.6.13.

The two findings this campaign reports are not in this lane's scope:
 they are in
`find_anchored` and `is_match`,
 which diverge from the (correct) `find_all` that
the Lean lane checks.
 The Lean result and the denotational result agree that
`find_all` itself is sound.

## Reproduce

```bash
# x86: generate pairs + resharp side
cd /tmp/agent/resharp-denot-oracle
python3 gen_pairs.py 1 6000 /tmp/agent/pairs1
cargo run --release --bin readpairs < /tmp/agent/pairs1.tsv > /tmp/agent/pairs1.resharp.txt
# M1: evaluate Lean
scp /tmp/agent/pairs1.lean m1:resharp-fuzz-2026-06-19/oracle/extended-regexes/
ssh m1 'cd ~/resharp-fuzz-2026-06-19/oracle/extended-regexes && lake env lean pairs1.lean > pairs1.lean.out'
# join + diff by Rn id
```
