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

The initial complete scan found 25 lint-scoped executable `while (true)` statements.
After parser and analysis migration,
11 executable statements remain.
The text inventory also finds the explanatory config comment that names the forbidden syntax.

### Parser and analysis loops

All 14 parser and analysis occurrences are migrated.
No `while (true)` remains in:

- `package/module/css-edit/src/`.
- `package/oxlint-plugin/tsdoc/src/`.
- `package/oxlint-plugin/prefer-readonly-parameter-type/src/`.

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
  completed.
- Task 7,
   migrate parser and analysis loops:
  implementation complete,
  blocked on task 11 verification.
- Task 8,
   migrate retry and polling loops:
  pending after task 7.
- Task 9,
   verify constant-loop ban:
  pending after task 8.
- Task 10,
   create this handover:
  completed.
- Task 11,
   clear concurrent CSS test blocker:
  completed after source migration settled.
- Task 12,
   resolve PostCSS catalog test drift:
  pending and blocking task 7.

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
- `f4c02781b`,
   final handover creation state.
- `0abe1ea7d`,
   shared Oxlint `checkLoops: 'all'` configuration.
- `f901fe2de` and `4cbf886f1`,
   bounded CSS parser loops and narrowed trivia cursors.
- `8aaff507e` and `0c8d0a367`,
   root-inclusive ancestor traversal plus explicit AST conditions.
- `fc6535276`,
  `7af601fbe`,
  and `dd30f430d`,
   explicit TSDoc wrapper traversal.

Config verification passed:

```bash
mise run //package/config/oxlint:build
mise run //package/config/oxlint:lint:oxlint
mise run //package/config/oxlint:lint:types
```

Parser verification passed for `module-css-edit` and `oxlint-plugin-tsdoc`:
unit tests,
Oxlint,
and TypeScript lint are green.

`oxlint-plugin-prefer-readonly-parameter-type` build,
Oxlint,
and TypeScript lint are green.
Its traversal,
cache,
intrinsic,
and diagnostics unit suites passed during the full run.
The full task failed only two PostCSS tests because concurrent `package/build-tool/css` edits removed or rewrote
source those tests inspect.
Do not change those unrelated files without explicit scope authorization.

The `package/build-tool/css` source migration later settled,
but a second full unit rerun produced the same two PostCSS failures:

- Callback summaries no longer match the old expected overload effects.
- `package/build-tool/css/src/mixin.ts` no longer contains a TypeScript node at the old query offset.

All suites exercising the constant-loop traversal changes passed in both full runs.

## Next action

Obtain scope direction for the unrelated PostCSS catalog test drift.
If its owning work updates the tests,
rerun the full prefer-readonly suite and complete task 7.
If the user authorizes this task to absorb the drift,
inspect the new build-tool API and update only the affected catalog tests before starting retry and polling migration.
