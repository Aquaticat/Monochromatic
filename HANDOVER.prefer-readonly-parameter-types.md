# HANDOVER.prefer-readonly-parameter-types

State of the `typescript/prefer-readonly-parameter-types` cleanup when context approached
compaction. Resume from here.

## Overall task

User: "This repo has many prefer-readonly-parameter-types errors. Fix only these. Yes I know
other lint issues exist. You might want to spawn-claude."

Mid-session the user redirected to deep-dive one sub-problem (why the ESTree allow-list entry
does not work) and capture it in a troubleshooting doc. That deep-dive is done and committed.
The broad cleanup itself has not started yet; the user paused it ("the actual task would be
secondary until we finish with this").

## Approved plan

`/home/user/.claude/plans/this-repo-has-many-dreamy-pebble.md` (approved via ExitPlanMode).
Shape: fix our own params in source with `readonly`; allow-list the external AST families
centrally; do the shared config change first, then fan out per package.

## Scope

176 violations across 8 packages, from
`OXLINT_THREADS=1 mise '//packages/...:lint:oxlint'` captured to `/tmp/prerod-all.txt`
(re-run to refresh; it may be stale):

- `cli/mvm` 58
- `claude-code-plugins/source` 38
- `cli/terminal-exec` 21
- `config/oxlint-no-restricted-syntax` 20
- `cli/vmsync` 19
- `build-tool/css` 15
- `cli/fy` 4
- `cli/rgffplay` 1

All production code; the rule is `off` for test files (`config/oxlint` `overrides.ts`
`testOverride`).

## Decision boundary (how each violation is fixed)

1.  Destructured named-param objects (dominant): `{ x }: { x: T }` becomes
    `{ x }: { readonly x: T }`.
2.  Arrays and our own data types: `readonly T[]`, `readonly` fields, or `ReadonlyDeep<T>`
    from `type-fest` (already used repo-wide).
3.  External AST families (ESTree, postcss): allow-list centrally. Never inline-suppress
    external types (explicit user directive).
4.  Wrapper object holding an external type: `{ node }: { node: ESTree.X }` becomes
    `{ node }: { readonly node: ESTree.X }`. Still a source fix even after the type is
    allow-listed, because the anonymous wrapper field is mutable.

No DOM/`Event`/`HTMLElement` one-off params exist in the flagged CLI packages (verified).

## Done this session

ESTree allow-list root cause: COMPLETE, committed `3a416e4a` as
`TROUBLESHOOTING.oxlint-prefer-readonly-estree.md`.

`@oxlint/plugins` re-exports `ESTree.Node`/`Function`/`PropertyKey` from internal
`Node$1`/`Function$1`/`PropertyKey$1` (a `$1` bundler rename, because the package also
declares an oxc-style top-level `Node`/`Function`). tsgolint's `allow` matcher compares
`symbol.escapedName` (`Node$1`), so `name: ['Node']` never matches; the rule then recurses
into the ~200-member union and flags the param. typescript-eslint's own matcher
(`specifierNameMatches.ts`) shares this design, so the audit lands on do-not-file. Verified
in a throwaway repro, not by editing the real config.

## Verified ESTree fix (lever 1), NOT YET APPLIED

Edit `packages/config/oxlint/src/rules/prefer-readonly-parameter-types.allow-pkg.ts`, the
`@oxlint/plugins` entry, adding the `$1` names alongside the existing plain names:

```typescript
"Node", "Node$1",
"Function", "Function$1",
"PropertyKey", "PropertyKey$1",
```

Keep the plain names too, so the list self-heals if a future `@oxlint/plugins` stops
renaming. Then verify the drop:

```bash
mise run //packages/config/oxlint-no-restricted-syntax:lint:oxlint
```

The 3 `ESTree.Node` and 1 `ESTree.Function` reports should disappear from the package's
current 20-warning total. The old "lever 2" (filtering in the `task-oxlint` wrapper) is
unnecessary because lever 1 works; that task was deleted.

## Next steps, in order

1.  Apply the ESTree allow-list fix above, verify the drop, commit. The shared `config/oxlint`
    change affects all packages' linting, so it must land before the `css` and
    `oxlint-no-restricted-syntax` source work.
2.  postcss `Root` in `build-tool/css` is NOT verified. Build the same throwaway-repro shape
    (`import { Root } from 'postcss'`, a `root: Root` param) and confirm
    `{ from: 'package', package: 'postcss', name: ['Root', ...] }` actually silences it before
    trusting it; postcss may or may not share oxc's dual-AST `$1` collision. Add the postcss
    node-type names to `allow-pkg.ts` if it works.
3.  Per-package source fixes (categories 1, 2, 4) across the 8 packages. Plan suggests
    `spawn-claude` fan-out, one child per package. `css` and `oxlint-no-restricted-syntax`
    children must run after steps 1 and 2 (they depend on the allow-list). Each child: fix
    only `prefer-readonly-parameter-types`, run `mise run //packages/<path>:lint:oxlint` to
    zero of this rule, run `mise run //packages/<path>:lint:types`, commit only its own paths
    (`git commit -o <paths>`).
4.  Whole-repo verify: re-run the capture and confirm
    `rg -c prefer-readonly-parameter-types` is 0.

## Key file locations

- `/home/user/.claude/plans/this-repo-has-many-dreamy-pebble.md` (approved plan)
- `TROUBLESHOOTING.oxlint-prefer-readonly-estree.md` (committed `3a416e4a`)
- `packages/config/oxlint/src/rules/prefer-readonly-parameter-types.allow-pkg.ts` (file to edit)
- `/tmp/prerod-all.txt` (full lint output, 176 violations, per-package; may be stale)
- `/tmp/prerod-repro.YRhGHt/` (throwaway repro: `test.ts` plus config variants
  `baseline/pkg/nameonly/file/allnames/span/suffix/pkgsuffix.json`)
- `/tmp/tsgolint/` at commit `78f9a83` (matcher: `internal/utils/type_matches_specifier.go`,
  `internal/rules/prefer_readonly_parameter_types/`)
- `/tmp/tseslint/` (typescript-eslint clone;
  `packages/type-utils/src/typeOrValueSpecifiers/specifierNameMatches.ts`)

## Operational notes

- `lint:oxlint` = `task-oxlint --type-aware` (`task-util/src/oxlint-wrapper.ts`). oxlint exits
  non-zero when warnings exist, so a "task failed" line is normal while violations remain.
- `config/oxlint` is consumed from `src` (no dist build), so edits to `allow-pkg.ts` take
  effect on the next lint with no rebuild.
- The bash-output-filter hook collapses long rule names in displayed output (e.g.
  `prefer-readonly-parameter-types` may show as `n`); it is display-only.
- General-purpose agents are banned; use `spawn-claude` for the per-package fan-out.
- Leave the `/tmp` clones and repro in place; the user cleans up `/tmp` artifacts.

## Task list state

- #1 in_progress: ESTree investigation done, fix known but not applied; postcss unverified.
- #2 deleted: lever-2 wrapper fallback moot.
- #3 pending: commit shared allow-list change.
- #4 pending: per-package source fixes.
- #5 pending: whole-repo verification.
