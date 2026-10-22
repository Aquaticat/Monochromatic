# Issue 577 indent rule investigation: handover

## Purpose

Close out the question "how hard is it to actually check indentation in our oxlint plugin"
(issue [#577](https://github.com/Aquaticats/Monochromatic/issues/577)),
ship the rule,
and leave the
follow-up queue in a state a fresh session can resume.

## What changed

The rule `stylistic/indentation` now ships in `package/oxlint-plugin/stylistic` with check and per-line
whitespace autofix,
engine and autofix tests covering every route,
and corpus-verified convergence.
The full record (model,
measurements,
retracted hypotheses,
workarounds,
upstream decision) is
`doc/troubleshooting/oxlint-typescript-indent-rule.md`.
The chain renderer was unified with the indent model in the same effort to stop a measured `--fix`
oscillation;
that history is in "Queue" and the troubleshooting doc's "Root cause".

## Findings

Implementation size landed at 3,395 insertions and 165 deletions across 16 files (commits in "Commits"),
inside the 2,000 to 3,400 LoC estimate and about 3 times under the user's 10,000 LoC close-as-not-planned
threshold,
so issue #577 stayed open and was implemented on the user's go-ahead.

The four-route model (template exemption,
ancestor plus two with body-owner remap,
closer at the bracket
base with brace remaps,
suffix keyword at the owner line) matches 99.04% of the repository's 1,052,606 code
lines (7,091 `.ts` files,
probe `full4.json`,
2026-10-22).
A first `--fix` sweep with the rule alone rewrites 20,722 leading-whitespace runs in 1,792 files,
touches
nothing but leading whitespace,
reaches the fixed point in one pass,
and leaves zero diagnostics.
Of the changed lines,
9,921 are direct model disagreements and 10,801 are cascade followers of a moved
anchor line.

## Assumptions and limits

- Sweeping normalization is accepted (user:
  "I don't care about huge sweeping changes").
- Corpus continuation styles that write binary operands,
  union bars,
  and hanging function-expression
  bodies flat are treated as drift to normalize,
  not as conventions to preserve.
- `package/config/oxlint/src/rule/style.ts` does not enable `stylistic/indentation` yet;
  repository lint
  still passes mis-indented TypeScript.
  Enablement plus one normalization sweep commit is queued in
  "Queue",
  not done here,
  because concurrent sessions hold uncommitted work in the same tree and a
  corpus-wide autofix would rewrite their files.
- Scratch assets under `~/temp/agent/indent-probe-2026-10-22/` (`probe4.mjs`,
  `probe4b.mjs`,
  `sweep.mjs`,
  `full4.json`,
  `full4b.json`,
  `sweep-report.txt`,
  `gfp-mutation-1.patch`,
  `gfp-mutation-2.patch`) are
  disposable;
  the troubleshooting doc carries everything needed to rebuild them.
- Test-helper lesson for future engine tests:
  an `offsetOf`-style `after` parameter must mean "strictly
  after",
  or chained marker lookups re-find the previous marker and stub trees collapse (this cost one
  false engine failure;
  see `package/oxlint-plugin/stylistic/src/utility/indent-expectation.unit.test.ts`).

## Queue

1.  Enable `stylistic/indentation` in `package/config/oxlint/src/rule/style.ts` (the sibling rules there sit
    at `warn`),
    then run one `--fix` sweep over the repository and commit the normalization separately from
    the enablement.
    Do this when the tree is quiet:
    the sweep rewrites ~20k lines in 1,792 files.
1.  Post the results-only comment on issue #577 naming the shipped commits (the `Closes #577` in `bee2e27eb7`
    auto-closed it on push).

## Commits

- `docs(troubleshooting): record the oxlint TypeScript indent rule feasibility investigation`
- `docs(handover): queue the issue 577 indent rule decision`
- `feat(oxlint-plugin-stylistic): add indentation checker and autofix` (`bee2e27eb7`,
  engine,
  rule,
  registration;
  its `Closes #577` auto-closed the issue on push)
- `test(*): add indentation fixtures and engine exports` (`2b4b5cefd1`)
- `fix(oxlint-plugin-stylistic): anchor unanchored root lines at column zero` (`1e6f2c0db3`)
- `fix(*): nest chain continuations on their anchor lines` (`310a3fa94c`,
  chain-per-line unification with
  the indent model,
  mixed-fixture convergence tests)
