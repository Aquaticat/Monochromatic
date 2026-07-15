# Node 26.5.0 `node --eval` bodies with top-level `await` fail as CommonJS when module-syntax detection is disabled

## Symptom

Every mise task whose shell was `node -e` and whose body used top-level `await` failed in one terminal
 while succeeding in another,
 on the same repo,
 commit,
 and Node v26.5.0.
The shared `dispatch_workspace_node` prefix in `mise.no-env.toml` uses top-level `await`,
 so every dispatch task was affected.
The failing terminal printed:

```text
[eval]:1
const { existsSync, readdirSync, statSync } = await import('node:fs')
                                              ^^^^^
Expected ';', '}' or <eof>

SyntaxError: await is only valid in async functions and the top level bodies of modules
    at makeContextifyScript (node:internal/vm:194:14)
    at compileScript (node:internal/process/execution:420:10)
    at evalTypeScript (node:internal/process/execution:292:22)
    at node:internal/main/eval_string:71:3
```

A second variant of the same failure (reproduced locally with `NODE_OPTIONS='--no-experimental-detect-module'`)
 reports frame `evalTypeScript (node:internal/process/execution:302:24)`
 and omits the `Expected ';', '}' or <eof>` line.
The successful terminal ran the identical body as an ES module (stack URLs like `file:///...<pkg>/[eval1]`).

## Root cause

All citations are `nodejs/node` at tag `v26.5.0`.

`--eval` without `--input-type` defaults to CommonJS.
`lib/internal/main/eval_string.js:59-68` picks the eval function;
 with type stripping enabled (`--strip-types`,
 default on) it is `evalTypeScript`,
 and the final fallback comment is explicit:

```js
  } else if (tsEnabled) {
    evalFunction = evalTypeScript;
  } else {
    // Default to commonjs.
    evalFunction = evalScript;
  }
```

`evalTypeScript` only takes the ES-module path when module-syntax detection approves it.
`lib/internal/process/execution.js:438-442`:

```js
function shouldUseModuleEntryPoint(name, body) {
  return getOptionValue('--experimental-detect-module') &&
    getOptionValue('--input-type') === '' &&
    containsModuleSyntax(body, name, null, 'no CJS variables');
}
```

With `--no-experimental-detect-module` the first conjunct is false,
 so `evalTypeScript` compiles the body as a CommonJS contextified script (`lib/internal/process/execution.js:292`),
 where top-level `await` is a `SyntaxError`.
The catch block then strips types and retries the same CommonJS compile (`lib/internal/process/execution.js:295-302`):

```js
      sourceToRun = stripTypeScriptModuleTypes(source, kEvalTag);
      // Retry the CJS/ESM syntax detection after stripping the types.
      if (shouldUseModuleEntryPoint(name, sourceToRun)) {
        return evalTypeScriptModuleEntryPoint(source, print);
      }
      // If the ContextifiedScript was successfully created, execute it.
      // outside the try-catch block to avoid catching runtime errors.
      compiledScript = compileScript(name, sourceToRun, baseUrl);
```

The two symptom variants are the two exits of that catch:
 when the type-stripper itself rejects the source,
 the original error is rethrown with the stripper's message spliced into the stack (`decorateCJSErrorWithTSMessage`,
 `lib/internal/process/execution.js:249-257` called at `:307`),
 producing the `Expected ';', '}' or <eof>` line and frame `:292`;
 when stripping succeeds,
 the second `compileScript` throws the same top-level-await `SyntaxError` at frame `:302`.

A falsified hypothesis,
 recorded so nobody re-derives it:
 the nearest `package.json` `"type": "module"` field does **not** govern `--eval`.
Both the failing package (`packages/claude-code-plugins/source`)
 and a passing one (`packages/pi-plugin/auto-mode`) declare `"type": "module"`;
 the behavior difference tracked the detection flag alone,
 and a bare `node -e` body with top-level `await` ran fine
 from a scratch directory whose `package.json` had no `type` field (detection on).

Why the user's terminal had detection disabled was not identified (candidates:
 `NODE_OPTIONS`,
 a Node config file);
 the repro below is equivalent and deterministic.

## Verification

Version under test:
 Node v26.5.0 (mise-managed).

Fails (detection off,
 bare eval,
 top-level `await`):

```bash
export NODE_OPTIONS='--no-experimental-detect-module'
node -e 'const { existsSync } = await import("node:fs")'
mise run //packages/claude-code-plugins/source:lint:types   # before commit fa20a73a7
```

Works:

```bash
node -e 'const { existsSync } = await import("node:fs")'   # detection on (default)
node --input-type=module -e 'const { existsSync } = await import("node:fs")'
export NODE_OPTIONS='--no-experimental-detect-module'
node --input-type=module-typescript -e 'const t: string = "ok"; await import("node:fs")'
mise run //packages/claude-code-plugins/source:lint:types   # after commit fa20a73a7
```

CommonJS-style bodies (`require(...)`,
 no top-level `await`) keep working under bare `node -e` in every configuration;
 the runbook tasks in `docs/runbook/k8s-playground.md` are that shape and were left unchanged.

## Verified workaround (shipped, commit fa20a73a7)

Pin the input type in every mise task shell:
`shell = "node --input-type=module-typescript -e"` (`mise.no-env.toml`,
 all package `mise.toml` files;
 root `mise.toml` regenerated).
`lib/internal/main/eval_string.js:38` routes that flag through `parseAndEvalModuleTypeScript`,
 which strips types and evaluates as a module unconditionally.

Tradeoffs:

- Bodies must be valid module code:
   no bare `require`,
   `module`,
   `__dirname`;
   use `await import(...)` and `import.meta`.
- The flag depends on type stripping staying enabled:
   with `--no-strip-types`,
   `eval_string.js:38`'s `tsEnabled` conjunct fails and the body silently falls back to CommonJS eval,
   resurfacing the original failure.
   `--strip-types` is default-on in v26.5.0.

Alternatives considered and viable but not shipped:

- `--input-type=module` (same determinism,
   drops the TS-annotation support that `AGENTS.md` rule SCR promises for task bodies).
- Wrapping bodies in an async IIFE (portable to any input type,
   but adds boilerplate to ~40 task bodies and still leaves module/CJS ambiguity for `import` statements).

## What does not work

- Relying on `"type": "module"` in the package's `package.json`:
   `--eval` never consults it (see falsified hypothesis in "Root cause").
- Relying on default-on detection:
   any environment that sets `--no-experimental-detect-module` (via `NODE_OPTIONS` or Node config)
  breaks every task body,
   and nothing in the repo can prevent that environment.
- Setting `NODE_OPTIONS='--experimental-detect-module'` in repo env:
   it repairs only environments the repo controls
  and silently loses to a user-level `--no-experimental-detect-module` appended later in `NODE_OPTIONS`.

## Upstream filing decision

- `.out-of-scope/` was checked;
   no `Node.js` exemption exists (entries cover bun,
   cargo,
   claude-code,
   jsr,
   lightningcss,
   typescript tooling,
   and others).
- Constraint 1 (really upstream's fault?
  ):
   **no**.
   `--eval` defaulting to CommonJS is documented,
   deliberate behavior (`lib/internal/main/eval_string.js:67`,
   comment "Default to commonjs"),
   and detection is an explicitly toggleable option;
   the failure was this repo relying on an environment-dependent default.
   Constraints 2 through 6 are moot once constraint 1 fails.
- Nothing to file;
   no issue or comment draft is kept,
   and there is nothing to add to upstream from this incident.
