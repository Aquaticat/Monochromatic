# Task shell: nushell for file iteration

Mise tasks in this monorepo use nushell as the task shell.
File iteration (running a command against files matching a glob) uses nushell's built-in `glob` command
rather than mise-specific or runtime-specific features.

## The problem

Running a command against every file matching a pattern is a common task operation:
lint all `.ts` files, run all migration scripts, execute all test fixtures.
Mise does not have a built-in `run_each` or per-file execution directive.

## Alternatives considered

### Mise `task_source_files()` with Tera templates

Mise's `task_source_files()` Tera function (added October 2025, PR #6180)
resolves a task's `sources` globs into file paths.
Iteration still requires a Tera `{% for %}` loop:

```toml
[tasks.example]
sources = ["src/**/*.ts"]
run = """
{%- for file in task_source_files() -%}
bun run {{ file }}
{%- endfor -%}
"""
```

Rejected:

- **No less boilerplate** than the nushell equivalent
- **Couples iteration logic to mise's template engine**, a Tera-specific construct
  that does not transfer to other task runners or shell contexts
- **Mixes two languages**: the task body becomes Tera template syntax wrapping shell commands,
  making it harder to read and test independently

### Bun-specific features

`bun run` accepts a single file path. No glob expansion or multi-file execution syntax exists.
`Bun.Glob` is a runtime API that requires writing a wrapper TypeScript file.

Rejected:

- **Adds a layer of indirection**: a `.ts` file whose only job is to glob and spawn child processes
- **Couples to Bun**: the iteration mechanism stops working if the runtime changes

### `fd --exec`

`fd` supports `--exec` (per-file, parallel) and `--exec-batch` (all files as arguments):

```bash
fd -e ts -g '*.script.ts' -x bun run {}
```

Not rejected outright, but nushell is preferred because:

- Mise already configures nushell as the task shell; `fd` would be an additional tool dependency
- Nushell's pipeline model composes better with subsequent processing steps

## Decision: nushell `glob` + iteration

### Serial execution

```nushell
glob "src/**/*.ts" | each { |file| bun run $file }
```

Runs each file one at a time, in glob order.
Use when execution order matters or when commands share a resource (stdout, a database, a lockfile).

The `for` loop form is equivalent:

```nushell
for file in (glob "src/**/*.ts") { bun run $file }
```

Both produce the same behavior. The pipeline form (`glob | each`) is preferred
because it composes with filters (`where`, `sort-by`) without restructuring.

### Parallel execution

```nushell
glob "src/**/*.ts" | par-each { |file| bun run $file }
```

Runs files concurrently across worker threads.
Use when files are independent and order does not matter.

To limit concurrency:

```nushell
glob "src/**/*.ts" | par-each --threads 4 { |file| bun run $file }
```

### Filtering and sorting

Nushell pipelines compose without switching languages:

```nushell
# Only files modified in the last day, sorted by size
glob "src/**/*.ts" | where { ($in | path expand | ls $in | get 0.modified) > (1day ago) } | each { |file| bun run $file }

# Exclude test files
glob "src/**/*.ts" | where { not ($in | str contains ".test.") } | each { |file| bun run $file }

# Alphabetical order
glob "src/**/*.ts" | sort | each { |file| bun run $file }
```

### Watch mode

For tasks that support a `--watch` flag (e.g. `bun --watch`),
append the flag to each execution rather than wrapping with an external watcher like `watchexec`.
This lets the runtime handle file watching natively with faster restarts and proper cleanup.

```nushell
# Watch mode: append --watch to each bun invocation
glob "**/*.unit.test.ts" | par-each { |file| bun --watch $file }
```

Use external watchers (`watchexec`, `mise watch`) only when the underlying command
has no built-in watch support.

### Why this works

- **Depends only on the task shell**: no mise template functions, no runtime APIs, no extra CLI tools
- **Reads as plain code**: a pipeline over a glob, no template delimiters or escaping
- **Transfers unchanged**: the same line works in any nushell context, not just mise tasks
- **Composes naturally**: filtering, sorting, and parallel execution use standard nushell operations
  without switching languages
