# Shared mise task bodies

Each `*.toml` here holds the full body of one role's mise tasks, included by
per-package `mise.toml` files through `[task_config] includes`. This replaces the
former per-package `[tasks.X] extends = "X"` boilerplate that referenced the root
`mise.no-env.toml` `[task_templates.*]` (now deleted).

## Why bare full-body format

Included files use the bare task-list format, mapping a task name straight to its
body:

```toml
"build:js:node" = "tsdown --config tsdown.node.config.ts"
"build" = { shell = "node -e", run = "{{vars.fanout}}" }
```

A `[tasks.X]` section header is a TOML parse error inside an included file, and an
`extends`-shim resolves to an empty no-op task. The heavy logic stays in the root
`[vars]` (`fanout`, `dispatch_workspace_node`, `parse_usage_args`, `run_test_files`);
these bodies reference it with `{{vars.X}}`, which interpolates at run time.

## One file per occurrence-signature (parity)

Files are split so that a package includes exactly the tasks it had before. Tasks
that always appeared together in the old `extends` sets share a file
(`watch:build` + `watch:build:js`; `build:js:node` + `watch:build:js:node`);
everything else is on its own, because the packages that used them differ (for
example many packages lint without building, and a few build a browser/client leaf
without its `watch:` variant). Bundling further would add tasks to packages that
never had them and break task-graph parity with `main`.

## Layering `hide`

A package that needs `hide = true` on an included task adds a bodyless override; it
merges onto the included body rather than replacing it:

```toml
[task_config]
includes = ["../../../mise-shared/lint-types.toml"]

[tasks."lint:types"]
hide = true
```

## File-to-task map

- `build.toml` -> `build`
- `build-js.toml` -> `build:js`
- `watch-build.toml` -> `watch:build`, `watch:build:js`
- `node.toml` -> `build:js:node`, `watch:build:js:node`
- `browser.toml` -> `build:js:browser`
- `watch-browser.toml` -> `watch:build:js:browser`
- `client.toml` -> `build:js:client`
- `watch-client.toml` -> `watch:build:js:client`
- `lint.toml` -> `lint`
- `lint-types.toml` -> `lint:types`
- `oxlint.toml` -> `lint:oxlint`
- `test-unit.toml` -> `test:unit`
- `test.toml` -> `test`
- `watch-lint-types.toml` -> `watch:lint:types`
