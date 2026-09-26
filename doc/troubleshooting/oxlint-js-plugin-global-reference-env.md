# Oxlint 1.85.0 JavaScript plugins lose `Array` and `Object` globals when a config sets `env` without `builtin`

## Symptom

A JavaScript plugin rule that asks `context.sourceCode.isGlobalReference(identifier,)` gets `false`
for `Array` and `Object` whenever the config declares an explicit `env` map without `"builtin": true`,
while `Set`,
`Promise`,
and `Buffer` still read as global.
No diagnostic is printed;
rules that guard on "is this the global `Array`" silently stop reporting.

In this repository it disabled the `Array.from`,
`Object.keys`,
and `new Array` checks of `no-restricted-syntax/no-useless-spread`
and the `Array.from` arm of `no-restricted-syntax/prefer-spread` under the shared config,
whose `env` was `{ browser, node, es2026, serviceworker, webextensions, worker }`.
Isolated test configs without `env` passed,
so the defect only showed when linting through the real config.

## Root cause

### An explicit root `env` replaces the default `builtin` env

The default environment holds only `builtin`,
`crates/oxc_linter/src/config/env.rs:65-71`:

```rust
impl Default for OxlintEnv {
    fn default() -> Self {
        let mut map = FxHashMap::default();
        map.insert("builtin".to_string(), true);

        Self(map)
    }
}
```

`Oxlintrc` deserializes with `#[serde(default, …)]` (`crates/oxc_linter/src/config/oxlintrc.rs:174`),
so a present `env` map replaces that default rather than merging into it.
Oxc's own test pins this,
`crates/oxc_linter/src/config/env.rs:111`:

```rust
assert!(!env.contains("builtin"));
```

### Rust rules still see builtin globals

The Rust side treats builtin globals as always enabled,
`crates/oxc_linter/src/context/mod.rs:206-210` and `:248-251`:

```rust
fn get_env_global_entry(&self, var: &str) -> Option<GlobalValue> {
    // builtin is always readonly
    if GLOBALS_BUILTIN.contains_key(var) {
        return Some(GlobalValue::Readonly);
    }
```

```rust
fn env_contains_var(&self, var: &str) -> bool {
    if GLOBALS_BUILTIN.contains_key(var) {
        return true;
    }
```

### The JavaScript plugin scope manager only adds the listed envs

`addGlobals` in `apps/oxlint/src-js/plugins/scope.ts:149-182` creates global variables for each serialized env
and never adds the builtin preset:

```ts
for (const envName in envs) {
  const preset = ENVS.get(envName);
  if (preset === undefined) continue;
  const { readonly, writable } = preset;
  for (let i = 0, len = readonly.length; i < len; i++) {
    const varName = readonly[i];
    if (!Object.hasOwn(globals, varName)) createGlobalVariable(varName, globalScope, false);
  }
```

The `es20xx` presets are difference lists over ES5.
`ENV_BUILTIN` (`apps/oxlint/src-js/generated/envs.ts:1337`) lists `Array` and `Object`;
`ENV_ES_2024` (`apps/oxlint/src-js/generated/envs.ts:1842-1874`) lists only later additions such as `Map`,
`Promise`,
and `Set`.
`isGlobalReference` (`apps/oxlint/src-js/plugins/scope.ts:334-360`) requires a global-scope variable with no definitions:

```ts
const variable = globalScope.set.get(node.name);
// Global variables are not defined by any node, so they should have no definitions
if (variable === undefined || variable.defs.length > 0) return false;
```

With `builtin` absent,
`Array` never enters the global scope,
so the lookup returns `false`.

### The config reference misdescribes `builtin`

The environment list in the config reference
(<https://oxc.rs/docs/guide/usage/linter/config-file-reference.html>,
generated from `crates/oxc_linter/src/config/env.rs:17`) says:

```rust
/// - builtin - Latest ECMAScript globals, equivalent to es2026.
```

Measured on 1.85.0 with the probe in "Verification",
`"env": { "es2026": true }` alone leaves `Array` and `Object` out of the JavaScript plugin global scope,
while `"env": { "builtin": true }` alone includes them.
`builtin` covers ES5 plus later globals;
`es2026` is a difference list,
so the two are not equivalent,
and the reference does not mention that an explicit `env` drops the default `builtin`.

ESLint's eslintrc implementation always prepends the builtin env
(`Object.assign({ builtin: true }, config.env, envInFile)` in `lib/linter/linter.js`,
ESLint 9.39.0),
so the JavaScript side of oxlint diverges from both oxlint's Rust side and ESLint.

## Verification

Oxlint 1.85.0 (`node_modules/.pnpm/oxlint@1.85.0_oxlint-tsgolint@7.0.2002`),
oxc source at commit `f51e678` (2026-09-25).

Probe plugin reporting what the scope manager says:

```js
// probe-plugin.mjs
const rule = {
  create(context) {
    return {
      Identifier(node) {
        if (!['Array', 'Object', 'Set', 'Promise', 'Buffer',].includes(node.name,)) return;
        context.report({ node, message: `${node.name} global=${context.sourceCode.isGlobalReference(node,)}`, },);
      },
    };
  },
};
export default { meta: { name: 'probe', }, rules: { probe: rule, }, };
```

```ts
// probe.ts
export const a = Array.from([1,],);
export const o = Object.keys({},);
export const s = new Set([1,],);
export const p = Promise.all([],);
export const b = Buffer.concat([],);
```

```sh
oxlint --config env.json --format unix probe.ts
```

### Configs that keep `Array` and `Object` global

- No `env` key:
  `Array`,
  `Object`,
  `Set`,
  `Promise` global;
  `Buffer` not global (no Node env).
- `"env": { "builtin": true, "browser": true, "node": true, "es2026": true, … }`
  (the shared config after the fix):
  all five global.

### Configs that drop them

- `"env": { "es2026": true }`:
  `Array global=false`,
  `Object global=false`;
  `Set` and `Promise` global;
  `Buffer` not global.
  Compare `"env": { "builtin": true }`,
  where `Array` and `Object` are global.
- `"env": { "browser": true, "node": true, "es2024": true }`:
  `Array global=false`,
  `Object global=false`;
  `Set`,
  `Promise`,
  `Buffer` global.
- The shared config's `env` without `builtin`
  (`browser`,
  `node`,
  `es2026`,
  `serviceworker`,
  `webextensions`,
  `worker`):
  the same result.

## Verified workarounds

### Add `builtin: true` to every explicit `env`

`package/config/oxlint/src/config-base.ts` now declares `builtin: true` first in `env`;
`oxlint --init` writes the same default (`apps/oxlint/src/mode/init.rs:15`).
Tradeoff:
none observed for Rust rules,
which already treated builtin globals as enabled;
JavaScript plugin rules now see ES5 globals,
which is what their ESLint originals assume.

### Resolve globals by the absence of a file-local declaration

The spread rules ask the scope chain whether any declaration in the file binds the name
(`package/oxlint-plugin/no-restricted-syntax/src/rule/spread-evidence/undeclared-reference.ts`),
falling back from `isGlobalReference`.
Tradeoff:
an implicit global assigned elsewhere at runtime counts as a host global,
which is acceptable because such code has no file-visible binding for the rule to reason about.
The rule tests keep an `env` without `builtin` on purpose
(`package/test-fixture/oxlint-no-restricted-syntax/.oxlintrc.no-useless-spread.fixture.json`),
so this path stays exercised.

## What does not work

- Relying on `isGlobalReference` alone:
  correct only for configs that happen to include `builtin` or omit `env` entirely.
- Testing rules only with an `env`-free config:
  every spread-rule test passed while the shared config silently disabled the `Array` and `Object` checks.

## Upstream filing artifact

### Upstream filing decision

Pending the prototype of the `addGlobals` fix;
this section is completed when it reports.
