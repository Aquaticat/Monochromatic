# Node 26.4.0 execFileSync ENOBUFS when mise task JSON exceeds default buffer

## Symptom

Package fanout tasks failed while running a package build through mise:

```text
Error: spawnSync mise ENOBUFS
spawnargs: [ 'tasks', '--all', '--hidden', '--json' ]
```

The failing surface was:

```sh
mise run //packages/agent-harness-shared/terminal-title:buildAndTest
```

The failure happened before `tsdown` ran because the task fanout helper could not read
`mise tasks --all --hidden --json` through Node `execFileSync`.

## Root cause

The workspace task graph is large enough that `mise tasks --all --hidden --json` is over
Node's default `execFileSync` stdout buffer.
The measured output size was:

```sh
cd /var/home/user/Monochromatic && mise tasks --all --hidden --json | wc --bytes
# 1060629
```

The default Node behavior was reproduced with a one-byte-over-1-MiB child stdout:

```sh
node --input-type=module --eval "import { execFileSync } from 'node:child_process'; try { execFileSync(process.execPath, ['--eval', 'process.stdout.write(\"a\".repeat(1048577))']); } catch (error) { console.log(error.code); console.log(error.message.split('\n')[0]); }"
# ENOBUFS
# spawnSync /var/home/user/.local/share/mise/installs/node/26.4.0/bin/node ENOBUFS
```

`mise.no-env.toml:302` and `mise.no-env.toml:303` now set a larger buffer for the package-local
fanout helper:

```toml
const MISE_TASKS_JSON_MAX_BUFFER = 16 * 1024 * 1024
const tasks = JSON.parse(execFileSync('mise', ['tasks', '--all', '--hidden', '--json'], { encoding: 'utf8', maxBuffer: MISE_TASKS_JSON_MAX_BUFFER }))
```

`mise.no-env.toml:334` and `mise.no-env.toml:335` apply the same fix to cross-package fanout.
`mise.no-env.toml:766` and `mise.no-env.toml:767` apply it to the `buildAndTest` package lookup.
`mise.no-env.toml:934` and `mise.no-env.toml:935` apply it to `prepare` fanout.

`mise.toml` is generated from `mise.no-env.toml` by file-enforcer,
so `mise run sync:files` must run after edits to `mise.no-env.toml`.

## Verification

The minimal Node reproduction fails without `maxBuffer` and succeeds with the workspace buffer:

```sh
node --input-type=module --eval "import { execFileSync } from 'node:child_process'; const output = execFileSync(process.execPath, ['--eval', 'process.stdout.write(\"a\".repeat(1048577))'], { maxBuffer: 16 * 1024 * 1024 }); console.log(output.length);"
# 1048577
```

The workspace verification that originally failed now passes:

```sh
cd /var/home/user/Monochromatic && mise run buildAndTest -- packages/agent-harness-shared/terminal-title/src/index.unit.test.ts
# Build complete
# PASS truncate, shortPath, stringField, field, pathFormat, quotedFormat, shortCommand,
# stripCommandNoise, lookupToolTitleEntry, formatToolTitle, prefixedTitle
```

## Verified workarounds

### Set `maxBuffer` at every task-list scan

Use a named buffer constant in each Node task body that reads the full mise task graph:

```js
const MISE_TASKS_JSON_MAX_BUFFER = 16 * 1024 * 1024;
const tasks = JSON.parse(execFileSync('mise', ['tasks', '--all', '--hidden', '--json'], {
  encoding: 'utf8',
  maxBuffer: MISE_TASKS_JSON_MAX_BUFFER,
}));
```

Tradeoff:
large task JSON is still buffered in memory.
The current task graph is about 1.01 MiB,
so 16 MiB leaves growth room without making this an unbounded read.

## What does not work

### Leaving `execFileSync` at its default buffer

The default buffer fails once stdout exceeds 1 MiB,
as shown by the minimal Node reproduction in the root cause section.

### Fixing only package-local fanout

The same task-list scan pattern also appears in cross-package fanout,
`buildAndTest` lookup,
and `prepare` fanout.
Leaving any of those at the default buffer keeps a delayed ENOBUFS failure path.

## Upstream filing decision

Nothing to file upstream.

- Is it really upstream's fault?
  No.
  Node exposes `maxBuffer`,
  and the workspace task helper omitted it for a large stdout-producing command.
- Can upstream fix it?
  Not applicable because the workspace script owns the buffer policy.
- Are they supporting this use case?
  Not needed for an upstream issue because this is a caller-side buffer setting.
- Would the repo welcome our contribution?
  Not applicable.
- Will they likely fix it?
  Not applicable.
- Have we prototyped a minimal fix compatible with their architecture?
  Yes,
  the workspace-side fix was applied in `mise.no-env.toml`,
  regenerated into `mise.toml`,
  and verified with `mise run buildAndTest -- packages/agent-harness-shared/terminal-title/src/index.unit.test.ts`.
