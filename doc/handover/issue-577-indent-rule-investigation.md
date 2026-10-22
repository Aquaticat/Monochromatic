# Issue 577 indent rule investigation: handover

## Purpose

Close out the question "how hard is it to actually check indentation in our oxlint plugin"
(issue [#577](https://github.com/Aquaticats/Monochromatic/issues/577)), and leave the implementation
queue in a state a fresh session can resume.

## What changed

The investigation is complete and recorded in `doc/troubleshooting/oxlint-typescript-indent-rule.md`
(measurements, retracted hypotheses, workaround tradeoffs, upstream filing decision).
No source code changed.

## Findings

The check plus autofix rule measures 2,000 to 3,400 LoC (central estimate about 2,700) on the user's
directed scope: the simplest indent model, template-literal content exempt, autofix included, and
formatter parity out of scope.
That clears the user's 10,000 LoC decision threshold by about 3.7 times, so issue #577 stays open.

The model is four routes (template exemption, ancestor plus two, closer at the bracket base with
body-owner remap, suffix keyword at the owner line).
It matches 99.01% of the repository's 1,052,277 code lines (7,091 `.ts` files, measured 2026-10-22),
and converges by construction with the existing fixers, which all emit anchor-line plus two
(`item-per-line-fix.ts:195`, `chain-per-line.ts:180`, `invocation-depth-fix.ts:293`).

## Assumptions and limits

- Sweeping normalization is accepted (user: "I don't care about huge sweeping changes"):
  the first autofix run would rewrite 10,380 corpus lines (0.99% of code lines).
- Corpus continuation styles that write binary operands, union bars, and hanging function-expression
  bodies flat are treated as drift to normalize, not as conventions to preserve.
- The scratch probe at `~/temp/agent/indent-probe-2026-10-22/probe.mjs` (413 LoC) and the dprint-oracle
  artifacts at `~/temp/agent/indent-dprint-oracle-2026-10-22/` are disposable; the troubleshooting doc
  carries everything needed to rebuild them.

## Queue

1.  Awaiting the user's choice, asked in the question tool: implement the rule now, keep the issue open
    and implement later, or close the issue as not planned anyway.
    Ranking given to the user: implement now, then later, then close.
1.  If implementation is chosen: add rule `indentation` to `package/oxlint-plugin/stylistic` with the
    four-route engine, per-line whitespace fixer, valid/invalid fixtures, and convergence tests against
    the per-line, chain, invocation-depth, and block-body fixers; run
    `mise run //package/oxlint-plugin/stylistic:lint:types` and the package tests; then run one
    `--fix` sweep and review the normalization diff.

## Commits

- `docs(troubleshooting): record the oxlint TypeScript indent rule feasibility investigation`
- `docs(handover): queue the issue 577 indent rule decision`
