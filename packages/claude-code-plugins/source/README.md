# @monochromatic-dev/claude-code-plugins-source

Source-only workspace package that owns the runtime,
per-plugin handler modules,
and CLI used by every Claude Code plugin in the `packages/claude-code-plugins/` cluster.
The per-plugin packages
(`guardrail`,
 `bash-output-filter`,
 `terminal-title`,
 `claude-spawn`,
`stop-reminders`,
 `session-start-housekeeping`,
 `prompt-time`,
 `correction-reminder`)
are thin shims that import a handler trio from here and call the runtime;
the cluster-level README documents that shim pattern and the migration history.

## Layout

```text
src/
  runtime/handler-runtime.ts            Generic stdin parse, dispatch, write shell
  handlers/{plugin}.ts                  Per-plugin handler, parser, writer triple
  handlers/{plugin}/index.ts            Same, when the plugin spans multiple files
  cli/spawn-claude.ts                   CLI bin that spawns child Claude sessions
```

### runtime/

`handler-runtime.ts` exports `runHookPlugin`,
the async shell each plugin entry script calls once at top level.
It reads stdin to EOF,
 runs the parser,
 awaits the handler,
and writes the writer's serialised result to stdout (no trailing newline).
It also exports `parseHookJson` (the trusted-JSON cast used by every plugin parser)
and the `HookHandler`,
 `Parser`,
 `Writer` types.

### handlers/

One handler module per plugin.
Each module exports three named functions following the convention
`{plugin}Handler`,
 `{plugin}Parser`,
 `{plugin}Writer`:

- `Parser` turns the raw stdin string into the typed hook event.
- `Handler` (sync or async) maps the event to the response payload.
- `Writer` serialises the response payload to the stdout string.

Larger plugins split their internal helpers across sibling files under `handlers/{plugin}/`;
only the `index.ts` (or flat `handlers/{plugin}.ts`) is exposed via the package's `exports` map.

### cli/

`spawn-claude.ts` is the package's `bin` entry.
It launches a child Claude Code session in a visible terminal window via `terminal-exec`,
pre-creates the spawn-state file under `~/.claude/spawn-results/spawns/`,
and prints `{"spawnId":"<uuid>"}` on success.
The child's `SessionStart` and `Stop` hooks (registered through the `claude-spawn` plugin)
claim ownership of the spawn file and forward results back to the parent session.

## Consuming from a per-plugin shim

Each per-plugin package's `src/index.ts` imports the handler trio from a subpath export
and calls the runtime:

```ts
#!/usr/bin/env node

import {
  guardrailHandler,
  guardrailParser,
  guardrailWriter,
} from '@monochromatic-dev/claude-code-plugins-source/handlers/guardrail';
import {
  runHookPlugin,
} from '@monochromatic-dev/claude-code-plugins-source/runtime';

await runHookPlugin({
  parser: guardrailParser,
  handler: guardrailHandler,
  writer: guardrailWriter,
},);
```

The standard tsdown build inlines the source-package contents into the shim
via `alwaysBundle: [/^@monochromatic-dev\//]`,
producing a self-contained `bundle/node/index.mjs`
(committed;
 see `docs/decisions/gitignore-negations.md`)
that Claude Code's marketplace install can execute directly.

## Running the CLI

After `pnpm install`,
 the `spawn-claude` bin is hoisted to `node_modules/.bin/spawn-claude`:

```sh
spawn-claude "implement feature X"
spawn-claude --cwd /some/path "fix the bug in module Y"
spawn-claude --extra-arguments "--model sonnet" "refactor this module"
```

`spawn-claude` resolves the calling Claude session by walking the process tree
against PID-to-session mappings written by the `claude-spawn` plugin's `SessionStart` hook,
so the plugin must be installed and active for the CLI to work.

## Public exports

The `exports` map in `package.json` is the package's full public surface:

- `./runtime`:
   the runtime shell and types.
- `./handlers/{plugin}`:
   the per-plugin handler trio for every cluster plugin.
- `./handlers/bash-output-filter/filter`:
   the standalone filter function used by the `ccbof-filter` pipe target.
- `./cli/spawn-claude`:
   the CLI module (also exposed as the `spawn-claude` bin).

External consumers should import only via these subpaths;
the internal layout under `src/handlers/{plugin}/` is private and may change.
