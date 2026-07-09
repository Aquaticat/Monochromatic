# Final-newline normalization plan

## Status

Approved for implementation.

The repository will canonicalize every in-scope,
non-empty text file to exactly one trailing LF before commit.
Git will continue to track that canonical byte;
it will not be configured to hide newline-only changes.

## Goal

Prevent missing final newlines and extra blank lines at end of file from entering commits,
while preserving binary files and text-shaped test data whose exact bytes are part of the test.

The user-facing outcomes are:

- Editing a normal text file and committing it produces exactly one final LF.
- A partially staged file keeps its unstaged edits while the staged version is normalized.
- A repository-wide check reports any in-scope violation without modifying files.
- Generated license copies and built plugin artifacts remain canonical after their normal producers run.
- Fuzz corpora and parser fixtures remain byte-identical.

## Current state and measured scope

The tracked-file scan inspected 7,060 paths in the checkout used for planning.
It found 5,445 compliant text-like files,
67 binary or non-UTF-8 paths,
one empty file,
and 1,547 non-empty text-like violations.

The violations split by ownership:

- 1,344 files under `packages/fuzz/forbidden-strings/corpus/`.
  These are fuzz inputs whose bytes are data,
  not source formatting.
- 52 TOML inputs under `packages/test-fixture/toml-edit/src/`.
  Missing final newlines can be part of parser behavior under test.
- 123 copies of `GPL-3.0-or-later.txt`.
  `file-enforcer.config.ts` copies package-local license texts verbatim from the canonical root source.
- 18 tracked outputs under `packages/claude-code-plugins/*/dist/final/node/`.
  Tsdown 0.22.4 currently emits these JavaScript and declaration files without a final LF.
- 10 ordinary source or configuration files.

The sole empty file is `test/file.txt`.
History says it was added only to retain an otherwise empty `test/` directory.
Nothing references it,
and Git does not otherwise track directories.
It will be deleted rather than turned into a newline-only file.

Counts are evidence from the planning scan,
not permanent constants.
The implementation verification must enumerate the then-current tree again.

## Why Git attributes are insufficient

`.gitattributes` already contains:

```gitattributes
* text=auto eol=lf
```

That policy normalizes line-ending style,
meaning CRLF versus LF.
It does not normalize how many LF bytes terminate a file.
A direct `git hash-object --stdin` check produced three different blob IDs for `x`,
`x\n`,
and `x\n\n`.
Git therefore correctly treats these as different contents.

A Git clean filter could rewrite the content while adding it to the index,
but it is rejected here:

- Filter commands live in Git configuration,
  so a clone without the local driver silently receives pass-through behavior unless the filter is marked required.
- Required filters make ordinary Git operations depend on another configured executable.
- A filter makes the worktree and index intentionally disagree,
  which obscures what `git status` means.
- Applying it broadly risks rewriting byte-sensitive test data.

The repository will normalize before commit instead of asking Git to conceal a real byte difference.

## Chosen mechanism

Use hk's built-in `newlines` step as an interim local fixer and checker.
At hk 1.50.0,
`pkl/builtins/newlines.pkl` delegates to `hk util end-of-file-fixer`:

- Check mode emits a unified diff and fails on missing or multiple final LF bytes.
- Fix mode removes repeated final LF bytes and appends one LF.
- Binary-looking files and empty files are skipped.
- The builtin selects text-like paths,
  then the utility performs its own content check.

The implementation will align the executable and Pkl package at hk 1.50.0.
The current state is version-skewed:
`hk.pkl` imports 1.44.3,
while `mise.lock` contains a legacy backend-keyed 1.47.0 entry plus the active short-name 1.50.0 entry,
and the planning environment activated 1.50.0.
A hook that mutates staged content should not depend on an older Pkl package than its active executable.

The configured step will be equivalent to:

```pkl
local finalNewline = (Builtins.newlines) {
  batch = true
  exclude = List(
    "packages/fuzz/forbidden-strings/corpus/**",
    "packages/test-fixture/toml-edit/src/**",
  )
}
```

`batch = true` is required,
not an optimization.
The full-tree prototype without it reached the operating system's argument-size limit.
The batched prototype split the tree into bounded invocations and completed.

The exclusions are deliberately narrow.
A generic `**/corpus/**` exclusion would silently exempt future corpora that may contain ordinary text.
A broad `packages/test-fixture/**` exclusion would exempt source and metadata that are not byte-sensitive.

## Hook behavior

### Pre-commit

Add `finalNewline` to the existing `pre-commit` hook and set:

```pkl
fix = true
stash = "git"
```

Fix mode makes normalization automatic.
Git stashing is essential for partial staging:
hk temporarily removes unstaged edits,
normalizes and stages the selected content,
then reapplies the unstaged patch.

Actual disposable-repository commits with hk 1.47.0 and 1.50.0 verified that:

- A missing final LF became one LF in the committed blob.
- Multiple final LF bytes became one LF in the committed blob.
- A NUL-containing binary stayed byte-identical.
- Excluded paths stayed byte-identical.
- A file with invalid staged content plus a separate unstaged line committed only the normalized staged content.
- The unstaged line returned to the worktree after the commit.

### Pre-push and explicit check

Add the same step to `pre-push` and `check` without fix mode.
These surfaces fail when an in-scope violation remains;
they do not rewrite content.

### Explicit fix

Add a `fix` hook containing the newline step with `fix = true`.
This makes the repository-wide cleanup available as:

```sh
hk fix --all --step final-newline --no-stage
```

`--no-stage` is required for baseline cleanup.
It lets the implementer inspect the changes and stage explicit path groups,
rather than letting a bulk fixer sweep unrelated concurrent work into the index.
A disposable repository verified that this option normalized the worktree while leaving the staged blob untouched.

Full-tree verification uses:

```sh
hk check --all --step final-newline
```

The explicit step selection avoids coupling this policy's verification to unrelated hk steps.

## Generated-file ownership

A one-time normalization commit is insufficient when a generator recreates the old ending.
Each generated family must be fixed at its source.

### License copies

Normalize `LICENSES/GPL-3.0-or-later.txt`,
then run the repository file-enforcer task.
`file-enforcer.config.ts` will propagate the canonical bytes to package-local `LICENSES/` directories.
The package copies are not edited as independent sources.

`LGPL-3.0-or-later.txt` and `CC-BY-SA-4.0.txt` already have compliant endings;
they need no content change.

### Tsdown Node outputs

Tsdown 0.22.4 with the current minifier emits the tracked `.mjs` and `.d.mts` files with no final LF.
Adding `footer: '\n'` is not a valid fix:
the prototype emitted two final LF bytes because Rolldown inserts its own separator around footer content.
Disabling minified code generation fixed JavaScript but not declaration output,
and it changed output formatting beyond this policy's scope.

Add a focused post-build normalizer to `packages/config/tsdown/src/` and register it through the shared Node config's
`build:done` hook.
It will:

- Visit emitted JavaScript and declaration files under the resolved Node output directory.
- Leave empty generated files empty.
- Scan backward over final LF bytes without a regular expression.
- Skip writing when content already has exactly one final LF.
- Preserve all bytes before the final LF run.
- Log entry,
  skip,
  normalization,
  and error paths through a tagged logger.

The helper will be separate from `index.node.ts`
so the pure byte-normalization rule and filesystem behavior can be tested directly.
The hook must also work for `perEntryNodeConfig`,
where multiple builds share one output directory,
and in watch mode,
where `build:done` runs after each rebuild.

Tests will cover:

- Missing final LF.
- Exactly one final LF.
- Multiple final LF bytes.
- Empty content.
- Interior blank lines preserved.
- Generated extension inclusion and non-generated asset exclusion.
- Idempotence across repeated normalization.
- A representative tsdown build producing one final LF in both `.mjs` and `.d.mts` outputs.

## Baseline cleanup

After hook and generator changes are in place:

1. Delete `test/file.txt`.
2. Normalize the canonical GPL source and run file-enforcer.
3. Rebuild every tracked Claude Code plugin Node artifact through its package mise task.
4. Run the newline fixer with `--no-stage` to catch the remaining ordinary files.
5. Inspect the complete diff.
6. Confirm no excluded corpus or TOML parser fixture changed.
7. Stage explicit path groups and commit checkpoints according to repository policy.

The ordinary files identified during planning were:

- `.idea/modules.xml`
- `.remarkignore`
- `packages-paused/webapp-content/messages-demo/src/server.ts`
- `packages/cli/mutation-test/src/host/cli-options.ts`
- `packages/linter/kotlin/build.gradle.kts`
- `packages/module/toml-edit/src/fuzz/coverage-v8.ts`
- `packages/module/toml-edit/src/values.ts`
- `packages/pi-plugins/auto-mode/src/git-worktree-read-allowlist.ts`
- `packages/ssg/aquati.cat/public/manifest.webmanifest`
- `packages/ssg/aquati.cat/src/content/en/on-humanity.mdx`

The implementation must trust the fresh scan over this historical list if the tree has changed.

## Architecture tradeoff and migration

The current architecture decision in `docs/decisions/cli-git-policies-platform.md` plans to retire hk and Pkl after the
first-party cli-git policies platform exists.
That platform is designed but not built.

Current ranking:

1. hk builtin.
   It already implements the exact transformation,
   has verified partial-staging behavior,
   and adds no dependency.
   Its cost is future migration and local hook installation.
2. Future cli-git policy.
   It is the durable architectural home and avoids a separate hook installation,
   but implementing the platform plus safe staged-blob rewriting would expand this newline task substantially.
3. Git clean filter or formatter-only enforcement.
   Clean filters have local configuration and index-transparency problems.
   Dprint covers only configured formats and cannot protect every in-scope text file.
   EditorConfig remains useful editor guidance but is not enforcement.

The implementation will update the existing cli-git decision
to record `final-newline` as another hk behavior that must reach parity before hk retirement.
It will not add hk back to CI:
the existing decision requires CI to remain independent,
and the previous generic `mise exec -- hk check` workflow installed unrelated root tools.
Local hooks are therefore fast feedback,
not an unbypassable authority.
A future cli-git policy and independent CI checker remain the durable destination.

## Limitations

- hk must be installed and its Git hooks enabled on a contributor's machine.
- Git hooks can be bypassed by clients that do not invoke them or by explicit verification bypasses.
- hk's text detection is heuristic.
  New exact-byte fixtures must receive a narrow exclusion when introduced.
- Empty files are accepted by hk.
  This implementation removes the only current empty placeholder but does not forbid future intentional empty files.
- Only LF runs are collapsed.
  The existing `.gitattributes` policy remains responsible for CRLF-to-LF normalization.
- The local hook is temporary infrastructure because hk is scheduled for retirement.
- Generated-file normalization must stay attached to every producer;
  post hoc cleanup alone cannot prevent rebuild drift.

## Documentation

Implementation updates:

- `docs/decisions/cli-git-policies-platform.md`:
  record the interim third hk behavior and migration obligation.
- `docs/troubleshooting/tsdown-final-newline.md`:
  record the tsdown 0.22.4 symptom,
  source trace,
  reproduction,
  rejected footer and codegen approaches,
  verified post-build workaround,
  and upstream-filing decision.
- This plan:
  update status and any measured details that change during implementation.

## Verification and acceptance criteria

The work is complete only when all of these hold:

- `hk.pkl` evaluates with the pinned hk executable and Pkl package version.
- An actual Git commit proves missing and multiple final LF cases are normalized.
- The same commit fixture proves partial unstaged edits are restored.
- Binary and excluded fixture hashes remain unchanged.
- `hk check --all --step final-newline` passes.
- A fresh tracked-file scan reports no in-scope non-empty text violations.
- Fuzz corpus and TOML fixture paths have no diff.
- File-enforcer regeneration is idempotent after the canonical GPL change.
- Rebuilding tracked plugin artifacts produces exactly one LF in JavaScript and declarations.
- Repeating the representative build produces no newline-only drift.
- Config-tsdown lint,
  type checking,
  and unit tests pass with zero warnings or errors.
- The representative plugin build and end-user executable invocation pass.
- The plan,
  decision,
  and troubleshooting documents match the implemented behavior.

## Reference sources

- Git attributes documentation:
  <https://git-scm.com/docs/gitattributes>
- hk 1.50.0 newline builtin:
  <https://github.com/jdx/hk/blob/v1.50.0/pkl/builtins/newlines.pkl>
- hk 1.50.0 end-of-file fixer:
  <https://github.com/jdx/hk/blob/v1.50.0/src/cli/util/end_of_file_fixer.rs>
- hk hook behavior:
  <https://hk.jdx.dev/hooks.html>
