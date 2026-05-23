# HANDOVER.prefer-readonly-parameter-types

State of the `typescript/prefer-readonly-parameter-types` cleanup at compaction. Resume from
here. Most of the work is committed and verified; one bulk package (mvm) is still being
finished by a re-launched child, after which two coordinator steps remain.

## Task

User: "This repo has many prefer-readonly-parameter-types errors. Fix only these. Yes I know
other lint issues exist. You might want to spawn-claude."

Repo-wide cleanup of one rule. Original estimate 176 violations / 8 packages was stale; the
true scope was 167 / 9 packages (the `//packages/...` mise glob silently excludes
`rolldown-plugins/import-attributes`, which is why the original sweep missed it).

## Approach (settled, do not relitigate)

1.  External AST/SDK types that cannot be readonly: allow-list centrally in
    `packages/config/oxlint/src/rules/prefer-readonly-parameter-types.allow-pkg.ts`. Never
    inline-suppress an external type.
2.  Our own params: source fixes. Destructured object param `{ x }: { x: T }` becomes
    `{ x }: { readonly x: T }`; arrays become `readonly T[]`; own data types get `readonly`
    fields or `ReadonlyDeep<T>` from `type-fest`.
3.  A param the function genuinely mutates: prefer refactoring to a return-based immutable
    shape (leaf accumulators). Only when that is infeasible (shared-recursive visited-set,
    injected memo cache) use a justified block `oxlint-disable` matching the repo precedent
    (`packages/webapp-edu/paper2vn/src/client/router.ts` `root`).

## Allow-list families (all committed, all verified)

The matcher (tsgolint, oxlint 1.65) keys on the declaring package and the resolved symbol
name, neither of which is the surface form. Full write-up in
`TROUBLESHOOTING.oxlint-prefer-readonly-estree.md` (updated this session).

- `@oxlint/plugins` ESTree: `ESTree.Node/Function/PropertyKey` resolve to bundler-renamed
  `Node$1/Function$1/PropertyKey$1`; added those plus `Statement/Directive/FunctionBody`, and
  removed a dead `estree`-package block. Commit `0e589bab`. Also `Variable` (scope-manager
  type) commit `e57ff587`.
- `@oxc-project/types` ESTree (used via `rolldown/utils` in import-attributes, a different
  declaring package, no `$1` renaming): commit `918c3283`, plus `StringLiteral` `3dcc9c5c`.
- `postcss`: `Root`/`AtRule` are empty `export =` subclasses, so tsgo resolves them to the
  base symbols `Root_`/`AtRule_`; allow-listed both forms plus `ChildNode`. Commit `295e0f79`.

## Per-package source fixes

Done, committed, and independently re-verified (0 of this rule + `lint:types` exit 0):

- `config/oxlint-no-restricted-syntax` `ee5d828a` (widened reportIfLet union to `ESTree.Node`;
  readonly wrapper/destructure fields).
- `build-tool/css` `541338db` (readonly fields + BuildOptions; justified disable for the
  mutated `imported` Set in inlineImports, a shared-recursive visited-set).
- `rolldown-plugins/import-attributes` `6c9f6866` (refactored collectStaticReplacements to
  return its replacements; justified disable for the injected `importerSourceCache` memo Map).
- `cli/fy` `cebc9bfd` · `cli/rgffplay` `b885d79e`.
- Children: `cli/terminal-exec` `b28e4915` (21) · `cli/vmsync` `72cba746` (19) ·
  `claude-code-plugins/source` `789a9f59` (38). All three re-verified by the coordinator.

The 10 `claude-code-plugins/*` shim packages type-check clean against ccp/source's new
`ReadonlyDeep` handler signatures (`mise '//packages/claude-code-plugins/...:lint:types'`
exit 0).

## In flight: cli/mvm (58 violations)

The first child (`ad1948b2`) died with 7 files partially edited (uncommitted in
`packages/cli/mvm/src/`). Re-launched as `fedc0501` to finish from the partial state, with the
heads-up that `template-windows.ts` uses a `ReturnType<typeof tagged>` Logger param the
allow-list `Logger` entry does not match through; the fix is to mirror
`packages/cli/vmsync/src/log.ts` (redefine `Logger = Readonly<ModuleLogger>`) in
`packages/cli/mvm/src/log.ts`. It commits only `packages/cli/mvm/` paths.

A background poller (`b1hm43g47`) watches for the `fix(cli-mvm)` commit (or ~25min timeout)
and will re-invoke the session. If it times out, mvm stalled again: either re-launch once more
or finish mvm in-session (the partial edits are sound to build on; re-lint
`mise run //packages/cli/mvm:lint:oxlint` for the remaining sites).

## Remaining coordinator steps (after mvm commits), in order

1.  Verify mvm: `mise run //packages/cli/mvm:lint:oxlint` shows 0
    `prefer-readonly-parameter-types`, and `mise run //packages/cli/mvm:lint:types` exits 0.
2.  Commit `pnpm-lock.yaml`. It currently has a 3-line uncommitted addition: the `type-fest`
    entry under the `packages/claude-code-plugins/source` importer (that child added
    `type-fest: catalog:` to its `package.json` (committed) but its scope excluded the root
    lockfile, so `pnpm install --frozen-lockfile` would reject). mvm has NO `type-fest` as of
    compaction; re-check `git diff -- pnpm-lock.yaml` after mvm in case its child added one,
    then commit the lockfile (`build` or `chore` scope). Verify with
    `mise run` of a frozen-lockfile install if practical.
3.  Final whole-repo verification. Do NOT use `mise '//packages/...:lint:oxlint'` for the
    pass/fail gate: it silently excludes `rolldown-plugins/import-attributes`. Loop the
    explicit 9-package list and confirm each is 0:

    ```bash
    for p in cli/mvm claude-code-plugins/source cli/terminal-exec cli/vmsync \
      config/oxlint-no-restricted-syntax build-tool/css rolldown-plugins/import-attributes \
      cli/fy cli/rgffplay; do
      echo -n "$p: "; OXLINT_THREADS=1 mise run //packages/$p:lint:oxlint 2>&1 \
        | rg -c "prefer-readonly-parameter-types" || echo 0
    done
    ```

    All must be 0. Then the task is complete.

## Operational notes

- `lint:oxlint` exits non-zero whenever any warning remains (other rules are out of scope), so
  a non-zero exit is normal; gate on the `prefer-readonly-parameter-types` count, not exit code.
- `config/oxlint` is consumed from `src` (no build); allow-pkg.ts edits take effect on next lint.
- Child completion is injected as PreToolUse hook context on the next tool call. Abnormal child
  death does not notify (that is why the poller exists; the user flagged the first mvm death).
- General-purpose agents are banned; use `spawn-claude` for any further fan-out.
- `/tmp` artifacts (clones, repros, the postcss probe at `/tmp/prerod-postcss-probe`) stay; the
  user cleans `/tmp`.

## Task list state

- #4 in_progress: bulk fan-out; only mvm (`fedc0501`) outstanding.
- #5 pending: final whole-repo verification (explicit 9-package list).
- All allow-list families (#1/#6/#7), the re-sweep (#3), and the tricky packages (#8) complete.
