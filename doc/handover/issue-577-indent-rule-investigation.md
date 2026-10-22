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
Both corpus sweeps are recorded there,
and the results-only comment landed on issue #577 as `issuecomment-6339427646`.
The separate `stylistic/comma-dangle` type-literal corruption found during the sweeps is now fixed
(`0a49269a48`),
recorded in `doc/troubleshooting/oxlint-stylistic-comma-dangle-type-literal-fix.md`.
The queue's remaining items then landed:
`package/config/oxlint/src/rule/style.ts` enables `stylistic/indentation` at `warn` (`a0de3e051f`),
and one normalization sweep (`68415aeb53`) rewrote 21,441 leading-whitespace lines
in 1,845 git-clean files,
whitespace only.
The sweep's rules-only config pitfall is recorded in
`doc/troubleshooting/oxlint-config-default-categories.md`,
and one new queue item remains
(the format catch-up under "Queue").

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
A second sweep with every fixture rule enabled reaches a fixed point at pass 12
(an eight-pass cap reads `stable=false` only because a few files need three cascade layers),
with zero `stylistic/indentation` or `stylistic(chain-per-line)` diagnostics in parseable files.
Of the changed lines,
9,921 are direct model disagreements and 10,801 are cascade followers of a moved
anchor line.

The landed normalization sweep (`68415aeb53`,
2026-10-22) ran over 7,333 candidates
(the corpus had grown from 7,091),
changed 1,845 files and 21,441 leading-whitespace lines with zero content-line
edits and zero line-count changes
(verified per file against `HEAD`),
and converged in one fix pass.
It ran the indentation rule alone with
`categories: { "correctness": "off" }`,
so the default-category fixes that a rules-only config would also apply
stayed out of the commit
(see `doc/troubleshooting/oxlint-config-default-categories.md`).

## Assumptions and limits

- Sweeping normalization is accepted (user:
  "I don't care about huge sweeping changes").
- Corpus continuation styles that write binary operands,
  union bars,
  and hanging function-expression
  bodies flat are treated as drift to normalize,
  not as conventions to preserve.
- `package/config/oxlint/src/rule/style.ts` enables `stylistic/indentation` at `warn` (`a0de3e051f`)
  and the one normalization sweep is committed (`68415aeb53`).
  The sweep snapshot `git status --porcelain` immediately before running and
  skipped the three concurrently dirty paths
  (`mise.toml`,
  `package/config/pnpr/config.yaml`,
  `scratchpad/`),
  so concurrent sessions' uncommitted work stayed untouched.
  Remaining limit:
  files that drifted under other already-enabled rules are queued for a
  format catch-up under "Queue",
  not normalized here.
- Scratch assets under `~/temp/agent/indent-probe-2026-10-22/` (`probe4.mjs`,
  `probe4b.mjs`,
  `sweep.mjs`,
  `spot.mjs`,
  `probe-render.mjs`,
  `pass-probe.mjs`,
  `full4.json`,
  `full4b.json`,
  `residuals.json`,
  `residuals-2.json`,
  `sweep-report.txt`,
  `sweep-report-2.txt`,
  `issue-577-comment.md`,
  `comma-repro/`,
  `pass-probe/`,
  `gfp-mutation-1.patch`,
  `gfp-mutation-2.patch`) are
  disposable;
  the troubleshooting docs carry everything needed to rebuild them.
- Measurement lesson:
  a lint-based corpus run is only as current as the built `dist` bundle it loads
  (a stale bundle once reported a false `stylistic(indentation)` versus `stylistic(chain-per-line)`
  oscillation;
  see "Measurement correction" in
  `doc/troubleshooting/oxlint-typescript-indent-rule.md`).
  Rebuild with `mise run //package/oxlint-plugin/stylistic:test:unit` before measuring.
- Test-helper lesson for future engine tests:
  an `offsetOf`-style `after` parameter must mean "strictly
  after",
  or chained marker lookups re-find the previous marker and stub trees collapse (this cost one
  false engine failure;
  see `package/oxlint-plugin/stylistic/src/utility/indent-expectation.unit.test.ts`).

## Queue

1.  Done:
    the `stylistic/comma-dangle` type-literal corruption is fixed (`0a49269a48`),
    before any enablement or whole-set `--fix` sweep as required.
    The trigger,
    root cause,
    and landed fix live in
    `doc/troubleshooting/oxlint-stylistic-comma-dangle-type-literal-fix.md`.
1.  Done:
    `stylistic/indentation` is enabled at `warn` in
    `package/config/oxlint/src/rule/style.ts` (`a0de3e051f`),
    and the normalization sweep is committed separately (`68415aeb53`):
    21,441 leading-whitespace lines in 1,845 of 7,333 git-clean candidates,
    whitespace only,
    one fix pass.
1.  Format catch-up under the full repository config.
    A mirror run of `oxlint --fix` with the root config additionally rewrites
    at least 292 content lines in 48 same-line-count files
    and rewraps line counts in 145 more files:
    pre-existing drift under already-enabled rules,
    for example TSDoc `* ` prefixes in `oxlint.config.ts` and `.pnpmfile.mjs`,
    `String.raw` and numeric-separator fixes in `package/desktop-app/ide/bin/`,
    and per-line splits in `doc/audit/regex-necessity/*.mjs`.
    Run `mise run format:oxlint` when the tree is quiet
    (or one filtered sweep on git-clean paths),
    review the non-whitespace diffs,
    and commit the catch-up separately from anything else.

## Commits

- `docs(troubleshooting): record the oxlint TypeScript indent rule feasibility investigation` (`48308b493b`)
- `docs(handover): queue the issue 577 indent rule decision` (`59cc14bb65`)
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
- `docs(troubleshooting): update the indent rule record to the shipped implementation` (`5edda3c34d`)
- `docs(handover): record the shipped indent rule and remaining queue` (`b3cad61ec6`)
- `docs(troubleshooting): apply semantic line breaks to the indent rule record` (`c9daef5380`)
- `docs(handover): apply semantic line breaks to the indent rule handover` (`68822cf102`)
- `docs(troubleshooting): record the comma-dangle type-literal fix corruption` (`3f1759034f`)
- `docs(handover): queue the comma-dangle fix and record the stale-bundle lesson` (`b5b6c17431`)
- `fix(*): stop comma-dangle inserting inside type-annotated pattern annotations` (`0a49269a48`,
  red-first fixtures,
  close-delimiter lookup skips the pattern's type annotation)
- `chore(config-oxlint): enable stylistic/indentation at warn` (`a0de3e051f`)
- `style(*): normalize leading indentation to the indent model` (`68415aeb53`,
  1,845 git-clean files,
  leading whitespace only,
  one fix pass)
