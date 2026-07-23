# TypeScript constant-loop ban handover

Last updated:
`2026-07-22T22:06:35-04:00`.

Current repository HEAD when this file was created:
`2c0d0c52ff02f8e700673ecf40128d8e56029527`.

## User requirements

- Ban TypeScript `while (true)` through option 1 from the policy review.
- Option 1 is Oxlint's built-in `eslint/no-constant-condition` rule with
  `checkLoops: 'all'`.
- Do not add a literal-only custom `while (true)` rule.
- Create this handover now and update it from time to time during implementation.

## Settled design

Configure the shared rule in
`package/config/oxlint/src/rule/correctness.ts`:

```ts
// package/config/oxlint/src/rule/correctness.ts
'eslint/no-constant-condition': [
  'error',
  { checkLoops: 'all', },
],
```

Use explicit continuation state or bounds for ordinary loops:

- Token scans use array bounds and preserve EOF or absent-token behavior after the loop.
- Ancestor-directory scans use an inclusive ancestor iterator that yields the filesystem root.
- AST cursor walks use node-shape or parent-boundary conditions.
- Pagination records whether another page exists.
- Polling records the current completion state or uses the real deadline where semantics permit.
- Storage retries record whether another owned entry permits a retry.
- Stream reads record the current `done` state or use async iteration when behavior is equivalent.

The two scripts whose purpose is deliberate nontermination or exhaustion may use `for (;;)`,
which `no-constant-condition` intentionally accepts:

- `package/runtime-error/bun/src/infinite-loop.ts`
- `package/runtime-error/bun/src/oom.ts`

The existing production `for (;;)` at
`package/ssg/aquati.cat/src/lib/content.ts:110`
is a known gap in option 1.
Do not expand this task into a custom conditionless-`for` rule unless the user separately requests it.

## Verified Oxlint behavior

Oxlint version under test:
`1.74.0`.

The installed source and a disposable Mise-run probe established:

- Default `checkLoops: 'allExceptWhileTrue'` accepts `while (true)`.
- `checkLoops: 'all'` rejects `while (true)`.
- `checkLoops: 'all'` rejects `for (; true;)`.
- `checkLoops: 'all'` rejects `do {} while (true)`.
- `checkLoops: 'all'` rejects `while (1)`.
- `checkLoops: 'all'` accepts `for (;;)`.
- Dynamic conditions such as `while (keepGoing())` remain accepted.

Durable source trace and reproduction:
`doc/troubleshooting/oxlint-no-constant-condition-loop-options.md`.

That troubleshooting document passes:

```bash
mise run lint:markdown -- doc/troubleshooting/oxlint-no-constant-condition-loop-options.md
```

## Current inventory

The last complete scan found 25 lint-scoped `while (true)` statements.

### Parser and analysis loops

- `package/module/css-edit/src/parse-contents.ts`:
  three.
- `package/module/css-edit/src/parse-classify.ts`:
  two.
- `package/oxlint-plugin/tsdoc/src/ast-access.ts`:
  one.
- `package/oxlint-plugin/prefer-readonly-parameter-type/src/prefer-readonly-parameter-types/`:
  eight across ancestor and AST walks.

### Retry, polling, stream, and fixture loops

- `package/module/logger/src/sink/local-storage-store.ts`:
  one.
- `package/module/logger/src/sink/session-storage-store.ts`:
  one.
- `package/cli/mvm/src/exec.ts`:
  one.
- `package/cli/mvm/src/virsh-wait.ts`:
  two.
- `package/cli/mvm/src/template-windows.ts`:
  one.
- `package/cli/mvm/src/backend/hetzner/api.ts`:
  one.
- `package/dev-script/file-enforcer/src/io/staleness-manifest-lock.ts`:
  one.
- `package/config/tofu/src/fetch_ips.ts`:
  one.
- `package/runtime-error/bun/src/infinite-loop.ts`:
  one.
- `package/runtime-error/bun/src/oom.ts`:
  one.

Re-run the inventory after every migration group:

```bash
rg --line-number --multiline \
  --glob '*.ts' \
  --glob '*.tsx' \
  --glob '!package-paused/**' \
  --glob '!package-deprecated/**' \
  --glob '!**/test-fixture/**' \
  --glob '!**/perf-test-data/**' \
  --glob '!**/*.generated.ts' \
  'while\s*\(\s*true\s*\)' \
  .
```

## Concurrent worktree state

At handover creation,
these unrelated changes existed and must not be staged,
restored,
or rewritten:

- Modified:
  `doc/handover/css-edit.md`.
- Untracked under
  `package/oxlint-plugin/prefer-readonly-parameter-type/src/`:
  - `csstools-css-tokenizer-package-effect-catalog.unit.test.ts`.
  - `prefer-readonly-parameter-types/csstools-css-tokenizer-package-effect-catalog.ts`.

The concurrent files may change or be committed while this task proceeds.
Re-run `git status --short` before every scoped commit,
and stage only explicit paths owned by this task.

## Task state

- Task 6,
   enable constant-loop linting:
  pending.
- Task 7,
   migrate parser and analysis loops:
  pending after task 6.
- Task 8,
   migrate retry and polling loops:
  pending after task 7.
- Task 9,
   verify constant-loop ban:
  pending after task 8.
- Task 10,
   create this handover:
  completed.

Only one task may be actively implemented at a time.
Update this section whenever a task changes state.

## Verification plan

For every changed TypeScript package:

- Run its focused unit tests when a `test:unit` task exists.
- Run `mise run //package/<path>:lint:oxlint`.
- Run `mise run //package/<path>:lint:types` manually.

Required package tasks include:

- `//package/config/oxlint:lint:oxlint`
- `//package/config/oxlint:lint:types`
- `//package/module/css-edit:test:unit`
- `//package/module/css-edit:lint:oxlint`
- `//package/module/css-edit:lint:types`
- `//package/oxlint-plugin/prefer-readonly-parameter-type:test:unit`
- `//package/oxlint-plugin/prefer-readonly-parameter-type:lint:oxlint`
- `//package/oxlint-plugin/prefer-readonly-parameter-type:lint:types`
- `//package/oxlint-plugin/tsdoc:test:unit`
- `//package/oxlint-plugin/tsdoc:lint:oxlint`
- `//package/oxlint-plugin/tsdoc:lint:types`
- package-equivalent lint and test tasks for logger,
  mvm,
  file-enforcer,
  tofu,
  and runtime-error.

Final boundary checks:

- The lint-scoped inventory command returns no `while (true)` matches.
- A disposable Oxlint fixture proves `while (true)` fails under the shared config.
- The two runtime-error scripts still express deliberate unbounded execution as `for (;;)`.
- No unrelated worktree paths appear in task commits.

## Commits and evidence

Research and troubleshooting commits already on `main`:

- `eb0e00071`,
   initial Oxlint behavior document.
- `1be1e84c5`,
   semantic line-break fixes.
- `0566088cf`,
   reproducible probe and inventory.
- `9ee37aa29`,
   pinned source and compact inventory.
- `ba84ca9e8`,
   initial constant-loop migration handover.
- `397b24a44`,
   handover Markdown formatting.

No implementation commit existed when this handover was created.

## Next action

Enable `eslint/no-constant-condition` with `checkLoops: 'all'` in
`package/config/oxlint/src/rule/correctness.ts`,
commit that scoped config change,
then begin parser and analysis migrations without staging concurrent files.
