# Lint fix handover

## Current human instructions

- Fix repo-wide `mise run lint` failures until the root lint task passes.
- The earlier `packages/dev-script/catalog-tighten` skip is superseded.
  The human said catalog-tighten work is finished and asked to fix all lint issues.
  Issue #259 is historical context only now.
- Do not stage unrelated human changes.
  Earlier known human-owned files were
  `packages/dev-script/catalog-tighten.matrix/README.md` and
  `packages/dev-script/catalog-tighten.matrix/src/combos.ts`.
  `git status --short` was clean immediately before this handover edit,
  but check again on resume.
- Do not satisfy `catch-binding` with an unused `catch (error)`.
  Log the caught value or rethrow it.
- `packages/module/test` remains a special stdout/stderr case:
  for expected fallback catches,
  use `catch (error: unknown) { if (!Error.isError(error,)) throw error; ... }`
  instead of logging expected failures.
- Keep this handover updated from time to time.
- Current pause request:
  update this handover and pause.

## Current repository state

- Current HEAD before this handover edit:
  `71e49ce78 feat(no-restricted-syntax): catch object tag suffix checks`.
- `git status --short` printed no paths before this handover edit.
- Root lint now reports `475` rules.
  Earlier passing targeted packages may fail again under the newer rule set.

## Commits made during this lint sweep

- `7a0d8c9a7`:
  mutation-test catch bindings and Symbol descriptions.
- `3197fd056`:
  logged expected catch paths in mutation-test and vm-builder,
  added the AGENTS catch-value rule.
- `9d85256c0`:
  vm-builder catch bindings.
- `97a574293`:
  deps-cube lint diagnostics,
  including logged catch paths.
- `359640a17`:
  page-weight lint diagnostics,
  including logged catch paths.
- `61b724390`, `1c459b445`, and `8502d31c4`:
  handover refreshes.
- `f36c3efd3`:
  split figma-kiwi into focused modules,
  replaced sync decompression,
  and refreshed unit seams.
- `ff6490a2a`:
  fixed figma-penpot and mcp/stdio lint.
- `c18f8a975`:
  first module lint batch.
- `9e9c7d340`:
  preserved i18n-compose locale spec inference.
- `2289510b3`:
  next module lint batch.
- `fdc876b5a`:
  kept module-test chai re-export after imports.
- `f279c59c6`:
  parallelized toml-edit fuzz coverage reads.
- `b8a050712`:
  split toml-edit coverage aggregation.

Commits above `b8a050712` were already present when this pause handover was written.
They changed no-restricted-syntax behavior and explain why root lint now surfaces more packages.

## Verified package progress

- `mise run //packages/dev-script/mutation-test:lint` passed after mutation-test fixes.
- `mise run //packages/dev-script/vm-builder:lint` passed after vm-builder fixes.
- `mise run //packages/dev-script/deps-cube:lint` passed after deps-cube fixes.
- `mise run //packages/dev-script/page-weight:lint` passed after page-weight fixes.
- `mise run //packages/figma/kiwi:lint` and
  `node packages/figma/kiwi/src/index.unit.test.ts` passed after `f36c3efd3`.
  Current root lint lists kiwi failing again under newer rules.
- `mise run //packages/figma/to-penpot:lint //packages/mcp/stdio:lint` passed after `ff6490a2a`.
- Targeted module lints passed for dom,
  fs-path,
  i18n-compose,
  image-diff,
  kv-store,
  logger,
  or-throw,
  pipe,
  test,
  toml-edit,
  and zip-writer.
- `mise run //packages/module/toml-edit:lint` passed immediately before commit `b8a050712`.

## Latest root lint results

A full root lint was started after the toml-edit split as process
`root-lint-after-next-module-fixes` (`proc_14`).
It failed.
Visible failures in that run included:

- `//packages/oxlint-plugin/tsdoc:lint`:
  `method-signature-style` and `unicorn/prefer-export-from` warnings.
- `//packages/oxlint-plugin/stylistic:lint`:
  one `method-signature-style` warning and seven `catch-binding` errors in
  `src/oxlint-stylistic.unit.test.ts`.
- `//packages/pi-plugins/linkup:lint`:
  many `unicorn/prefer-export-from` warnings,
  `readFileSync` in `src/config.ts`,
  and an unbound catch in `src/domain-policy.ts`.

Process logs for that run:

- `/tmp/pi-processes-1782759438972/proc_14-stdout.log`
- `/tmp/pi-processes-1782759438972/proc_14-stderr.log`

The human then reran `mise run lint`.
That command failed with full output at:

```txt
/tmp/pi-bash-f1a6058111d0bdff.log
```

The aggregate failed package list from that run was:

```txt
//packages/config/tofu:lint
//packages/figma/kiwi:lint
//packages/oxlint-plugin/tsdoc:lint
//packages/pi-shared/model-selection:lint
//packages/pi-plugins/current-time-context:lint
//packages/oxlint-plugin/stylistic:lint
//packages/pi-plugins/morph-compact:lint
//packages/pi-plugins/auto-mode:lint
//packages/pi-plugins/terminal-title:lint
//packages/pi-plugins/statusline:lint
//packages/pi-plugins/spawn:lint
//packages/rust-module/forbidden-regex.bench:lint
//packages/rolldown-plugin/import-attributes:lint
//packages/pi-plugins/linkup:lint
//packages/pi-plugins/thinking-defaults:lint
//packages/typeface/aquaticat:lint
//packages/ssg/aquati.cat:lint
//packages/webapp-productivity/done-postcss:lint
//packages/webapp-productivity/done:lint
//packages/webapp-productivity/rss:lint
//packages/webapp-productivity/doodle-widget:lint
```

Visible diagnostic themes in the human run:

- New `catch-binding` errors in many packages.
  Bind caught values and either log them through the package logger or rethrow unexpected values.
- New `no-sync` errors for APIs such as `readFileSync`,
  `writeFileSync`,
  `existsSync`,
  `mkdirSync`,
  `rmSync`,
  `statSync`,
  `symlinkSync`,
  and `zstdCompressSync`.
- New `no-low-information-symbol-description` warnings.
  Symbol descriptions must be self-explanatory phrases,
  not short tags such as `discard`, `no-timer`, or `task-not-found`.
- `unicorn/prefer-export-from` warnings for import-then-re-export patterns.
- `packages/webapp-productivity/done` and `done-postcss` have both oxlint and type failures.
  The visible type errors come from calling `.get`, `.all`, or `.run` on `db.prepare(...)`
  where `prepare` is now typed as returning `Promise<Statement>`.
  Await the prepared statement before calling statement methods.
- `packages/webapp-productivity/rss` has unbound catches,
  sync filesystem checks,
  and low-information Symbol descriptions.
- `packages/webapp-productivity/doodle-widget` has unbound catches,
  low-information Symbol descriptions,
  and `prefer-number-coercion` warnings for `Number.parseFloat`.

## Suggested resume plan

1. Run `git status --short` and protect any unrelated human changes.
2. Fix failing packages in small batches with targeted package lint after each batch.
   Start with the plugin and Pi package failures already visible in `proc_14`,
   then work through the webapp-productivity packages from the human rerun.
3. For database calls where `prepare` returns a Promise,
   introduce named prepared statement constants before `.get`, `.all`, or `.run`.
   That should address both `TS2339` and downstream unsafe-call diagnostics.
4. For catch blocks that intentionally tolerate a failure,
   narrow `error: unknown` and rethrow unexpected values.
   Do not leave unused bindings.
5. Commit after each meaningful batch with explicit pathspecs.
6. Rerun `mise run lint` only after targeted failures pass,
   because the root fanout is large and currently reports many independent packages.
