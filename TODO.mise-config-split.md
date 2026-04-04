# Split root mise.toml into smaller files

## Problem

`mise.toml` is 529 lines and growing.
Three concerns are interleaved: infrastructure config, task templates, and root task definitions.

## Approach: `[task_config].includes`

The only project-level splitting mechanism mise provides.
Moves root task definitions (~320 lines) into a separate TOML file,
keeping `mise.toml` at ~200 lines.

Other mechanisms considered and ruled out:

- **Top-level `includes`**: does not exist in mise
- **File-based tasks (`mise/tasks/*.nu`)**: `vars` not supported in file tasks,
  which breaks `{{vars.fanout}}` and `{{vars.monorepo_root}}` used by task templates
- **`conf.d` directory**: only works at user/system level (`~/.config/mise/conf.d/`), not project level
- **Hierarchical config (`mise/config.toml`)**: merges with precedence rules rather than cleanly splitting;
  would create confusion about which file owns what

## Plan

### Step 1: add `[task_config]` to `mise.toml`

```toml
[task_config]
includes = ["mise-tasks.toml"]
```

### Step 2: extract tasks to `mise-tasks.toml`

Move everything between `#region tasks` and `#endregion tasks` (lines 205-528)
into `mise-tasks.toml` using the **task-only format** (no `[tasks]` prefix).

The included file format differs from `mise.toml`:
- Top-level keys are task names directly (not nested under `[tasks]`)
- Sections like `[tasks."test:unit"]` become `["test:unit"]`
- `[tasks."lint".env]` becomes `["lint".env]`

Example transformation:

```toml
# In mise.toml (current)
[tasks.build]
description = "Build all packages"
run = "mise '//packages/...:build'"

[tasks."lint"]
description = "Lint"
run = ["mise '//packages/...:lint'", { tasks = ["lint:dprint", "lint:stylelint"] }]
[tasks."lint".env]
OXLINT_THREADS = "1"
```

```toml
# In mise-tasks.toml (after split)
[build]
description = "Build all packages"
run = "mise '//packages/...:build'"

["lint"]
description = "Lint"
run = ["mise '//packages/...:lint'", { tasks = ["lint:dprint", "lint:stylelint"] }]
["lint".env]
OXLINT_THREADS = "1"
```

### Step 3: keep in `mise.toml`

These stay because they are not tasks or because included files cannot define them:

- `experimental_monorepo_root`, `[monorepo]`
- `[tools]`
- `[settings]`
- `[hooks]`
- `[env]`
- `[vars]` (template variables only work in TOML, not included files -- **verify this**)
- `[task_templates.*]` (**verify** whether templates can live in included files)

### Step 4: verify

- `mise tasks` lists all tasks as before
- `mise run build`, `mise run test`, `mise run lint` all work
- Tasks using `{{vars.fanout}}` resolve correctly from the included file
- Task templates still apply to package-level tasks

## Open questions

1.  **Do `vars` resolve in included task TOML files?**
    Tasks like `[try]` use `{{vars.fanout}}` which is defined in `[vars]` in the root `mise.toml`.
    If included files cannot reference vars from the parent config, the fanout-based tasks must stay in `mise.toml`.

2.  **Can `task_templates` live in included files?**
    If yes, those ~50 lines could move too.
    If no (likely, since templates are not tasks), they stay in `mise.toml`.

3.  **File naming**: `mise-tasks.toml` vs `tasks.toml` vs `mise/tasks.toml`.
    `mise-tasks.toml` is unambiguous at root level; `tasks.toml` is shorter but generic.
