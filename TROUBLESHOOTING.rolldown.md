# Rolldown 1.0.0-rc.9: import-attributes not applied, ESTree-mismatched `parseSync` types, `platform: 'neutral'` empties `mainFields`, and `node:` subpath imports fail under non-Node platforms

This file groups four independent rolldown 1.0.0-rc.9 issues
that bite client-side and isomorphic workspace builds. Each
has its own canonical section.

---

## Bug 1: `with { type: 'text' }` parsed but not used for module loading

Upstream issue:
[rolldown/rolldown#2758](https://github.com/rolldown/rolldown/issues/2758)
(open, on hold). Date 2026-03-15.

### Symptom

A static import using import attributes:

```ts
import sql from './schema.sql' with { type: 'text' };
```

emits `PARSE_ERROR` because rolldown parses `.sql` as
JavaScript. The `with` clause is stored but does not affect
how the module is loaded.

### Root cause

Rolldown's Rust AST scanner parses `with { type: 'text' }`
clauses and stores them in an `import_attribute_map` keyed by
`ImportRecordIdx`. The scanner does not set
`asserted_module_type` on the import record based on the
`type` attribute value.

What works:

- Import attributes are preserved in ESM output formatting
  (`crates/rolldown/src/ecmascript/format/esm.rs:261-290`).

What does not work:

- `resolveId` hook receives no `attributes` field in its
  options (unlike Rollup 4's `options.attributes`). The
  `ResolveIdExtraOptions` type only has `custom`, `isEntry`,
  and `kind`.
- `.sql` files imported with `with { type: 'text' }` are
  parsed as JavaScript, causing `PARSE_ERROR` because
  rolldown does not map the `type` attribute to its native
  `ModuleType::Text`.
- The only place `asserted_module_type` is set is in
  `new_url.rs` for `new URL()` patterns
  (`ModuleType::Asset`).

Source citations (rolldown `main` as of 2026-03-15):

- `crates/rolldown/src/ast_scanner/mod.rs:674-676` — stores
  attributes but does not set module type.
- `crates/rolldown/src/ast_scanner/new_url.rs:68` — only
  place `asserted_module_type` is set.
- `crates/rolldown_common/src/types/import_record.rs:31` —
  `asserted_module_type: Option<ModuleType>`.
- `packages/rolldown/src/plugin/index.ts:132-157` —
  `ResolveIdExtraOptions` lacks `attributes`.

### Verification

Version under test: rolldown 1.0.0-rc.9. Reproduce by
importing any non-JS asset with `with { type: 'text' }` in a
client-side bundle.

### Verified workarounds

#### `@monochromatic-dev/rolldown-plugin-import-attributes`

Bridges the gap by using the `transform` hook to rewrite
specifiers (appending `?__importattr=<type>` query params)
and the `load` hook to serve the file content as a JS
module. For dynamic imports where rolldown's scanner
discovers dependencies before `transform` runs, the
`resolveId` hook re-parses the importer source with
`parseSync` to find the attribute type.

Tradeoff: requires a custom plugin; the specifier rewrite
shows up in the dependency graph as a query-suffixed module.

#### `moduleTypes` input option

Maps file extensions to module types globally:

```ts
inputOptions: { moduleTypes: { '.sql': 'text' } }
```

Tradeoff: extension-wide; does not respect per-import `with`
clauses. Use only when all files of an extension are the
same module type.

### What does not work

- Marking `.sql` as external: rolldown still tries to parse
  it before the external decision is made.
- Implementing a custom `resolveId` that returns module type:
  the `ResolveIdExtraOptions` type does not pass through
  attributes, so the plugin cannot tell which type the
  import requested.

### Why we do not file this upstream (already filed; on hold)

Already represented by rolldown/rolldown#2758. 5 constraints:

1. **Is it really upstream's fault?** Yes; the scanner stops
   short of applying the parsed `type` attribute.
2. **Can upstream fix it?** Yes; thread the attribute through
   to `asserted_module_type`.
3. **Are they supporting this use case?** Documented goal.
4. **Will they likely fix it?** Issue is on hold; no PR
   merged yet.
5. **Have we prototyped a minimal fix?** External plugin is
   the prototype.

Decision: no new upstream report; the existing issue is the
right venue.

---

## Bug 2: `parseSync` runtime AST uses ESTree node-type names but `@oxc-project/types` declares OXC-native names

Upstream issue:
[oxc-project/oxc#10139](https://github.com/oxc-project/oxc/issues/10139)
(closed, wontfix). Date 2026-03-15.

### Symptom

Rolldown re-exports `parseSync` from `rolldown/utils` and
ESTree types via
`export type * as ESTree from '@oxc-project/types'`. The
`@oxc-project/types` package declares OXC-native type names:

- `StringLiteral` with `type: "StringLiteral"`
- `IdentifierName` with `type: "Identifier"` (this one
  matches runtime)

The **runtime** AST from `parseSync` uses ESTree-compatible
names:

- String literals have `type: "Literal"` (not
  `"StringLiteral"`).
- All literal types (string, number, boolean, null, regexp)
  share `type: "Literal"`.

TypeScript discriminated-union narrowing does not work:

```ts
// Does NOT narrow — "Literal" is not a discriminant in the declared union
if (node.source.type === 'Literal') {
  node.source.value;  // TypeScript error: 'value' does not exist on type 'Expression'
}
```

### Root cause

The OXC team has stated this is intentional; they do not aim
to align `@oxc-project/types` with ESTree. Recommendation:
use types from another ESTree-compatible implementation
(Acorn or TS-ESLint) when ESTree compatibility is needed.

### Verification

Version under test: rolldown 1.0.0-rc.9 (re-exports
`@oxc-project/types`). Reproduce by writing a plugin that
inspects literal values via narrowed types; observe the type
errors.

### Verified workaround

Use runtime `typeof` checks instead of type discrimination:

```ts
// Workaround: runtime checks
if ('value' in node && typeof node.value === 'string') {
  // safely access string value
}
```

Tradeoff: loses compile-time guarantees that type
discrimination would provide. For plugin code that operates
on small AST surfaces, the runtime check is acceptable. For
larger plugins, switch the type imports to Acorn or
TS-ESLint types.

### What does not work

- Casting to ESTree types: works at the type level but loses
  any guarantee about the actual runtime shape; OXC may
  diverge further over time.
- Filing the issue with OXC: already closed wontfix.

### Why we do not file this upstream (closed wontfix)

Already represented by oxc-project/oxc#10139. Decision:
adapt to upstream's choice by switching type sources if
needed.

---

## Bug 3: `platform: 'neutral'` defaults `mainFields` to empty, breaking package resolution

Date 2026-03-22.

### Symptom

When `platform: 'neutral'`, rolldown defaults
`resolve.mainFields` to `[]`. Neither `module` nor `main` is
consulted; packages relying on these fields silently fail
with `UNRESOLVED_IMPORT` warnings and are treated as
externals.

```text
Could not resolve '<package>'
"The 'main' field here was ignored. Main fields must be configured explicitly when using the 'neutral' platform."
```

At runtime in the browser:

```text
TypeError: The specifier "<package>" was a bare specifier, but was not remapped to anything.
```

Transitive dependencies fail too (bundling `jspdf` leaves
`fast-png`, `canvg`, `stackblur-canvas` unresolved).

### Root cause

Per-platform `mainFields` defaults (from
`rolldown/dist/shared/define-config-*.d.mts:3338-3347`):

- `node`: `['main', 'module']`
- `browser`: `['browser', 'module', 'main']`
- `neutral`: `[]`

With `[]`, rolldown only resolves packages that have an
`exports` field with matching conditions. Packages without
`exports` (or whose `exports` conditions don't match the
neutral platform) become unresolvable.

### Verification

Version under test: rolldown 1.0.0-rc.9 (via tsdown).
Reproduce: set `platform: 'neutral'` in a tsdown config
without overriding `resolve.mainFields`; bundle a project
that depends on a package without `exports`.

### Verified workaround: set `resolve.mainFields` explicitly via `inputOptions`

In tsdown, `resolve` is a rolldown `InputOptions` property,
not a top-level tsdown config option:

```ts
export default defineConfig({
  platform: 'neutral',
  inputOptions: {
    resolve: {
      mainFields: ['module', 'main'],
    },
  },
});
```

Tradeoff: must be remembered for every neutral-platform
config. The override duplicates the defaults of the
`browser` platform; consider whether `platform: 'browser'` is
actually wanted instead.

### What does not work

- Setting `resolve` at the top level of the tsdown config:
  tsdown's `UserConfig` type does not include `resolve`, so
  it is silently dropped.
- Adding every transitive dependency to `deps.alwaysBundle`:
  `alwaysBundle` controls whether a package is bundled vs
  externalised, but if the package cannot be **resolved** in
  the first place, it is treated as external regardless of
  `alwaysBundle`.

### Source locations

Rolldown 1.0.0-rc.9:

- `dist/shared/define-config-*.d.mts:3338-3347` —
  `mainFields` type and per-platform defaults.
- `dist/shared/binding-*.d.mts:559` — native binding
  `mainFields` field.

tsdown:

- `dist/types-*.d.mts:880-882` — `inputOptions` pass-through
  to rolldown `InputOptions`.
- `dist/types-*.d.mts:763` — `platform` option definition.

### Why we do not file this upstream

1. **Is it really upstream's fault?** Borderline; the
   neutral default is documented but the silent
   externalisation is a UX wart.
2. **Can upstream fix it?** Yes; emit a stronger warning,
   or default `mainFields` to a sensible value.
3. **Are they supporting this use case?** Yes; `neutral` is
   documented.
4. **Will they likely fix it?** Worth proposing as a UX
   improvement.
5. **Have we prototyped a minimal fix?** No.

Decision: no upstream report from us yet.

---

## Bug 4: `node:` subpath imports produce `UNRESOLVED_IMPORT` under non-Node platforms

Date 2026-04-04.

### Symptom

Static imports like
`import { parse } from 'node:path/posix'` or
`import { posix } from 'node:path/posix'` emit
`[UNRESOLVED_IMPORT] Warning: Could not resolve
'node:path/posix'` when `platform` is `'neutral'` or
`'browser'`. The bare parent specifier `node:path` resolves
fine under all platforms.

Other affected specifiers: `node:path/win32`,
`node:stream/promises`, `node:stream/consumers`,
`node:stream/web`, `node:dns/promises`,
`node:readline/promises`, `node:timers/promises`, and any
other `node:` subpath export.

### Root cause

oxc-resolver's builtin-module detection is gated on a
`builtin_modules` flag. Rolldown only sets this flag to
`true` when `platform` is `Node`
(`crates/rolldown_resolver/src/resolver_config.rs:133`:
`builtin_modules: matches!(platform, Platform::Node)`). On
`neutral` or `browser`, `builtin_modules` is `false`, so the
resolver never short-circuits `node:` specifiers as
builtins.

The top-level `node:path` still resolves because rolldown
externalises bare `node:` specifiers separately from
oxc-resolver's builtin check. But subpath specifiers like
`node:path/posix` bypass that externalisation; the resolver
treats `/posix` as a filesystem path under the `node:path`
package, tries to find it on disk, and fails.

Source locations:

- `crates/rolldown_resolver/src/resolver_config.rs:133` —
  `builtin_modules` gated on `Platform::Node`.
- `crates/rolldown/src/utils/prepare_build_context.rs:157-160` —
  ESM defaults to `Browser` platform.

oxc-resolver:

- `src/lib.rs:478-488` — `require_core()` checks
  `starts_with("node:")` but only when `builtin_modules` is
  enabled.
- `nodejs-built-in-modules` crate — includes `path/posix`,
  `path/win32`, `stream/promises`, etc. in `BUILTINS`.

### Verification

Version under test: rolldown 1.0.0-rc.9. Reproduce by
importing any `node:` subpath under `platform: 'neutral'`.

### Verified workaround: import from the parent module

```ts
// Before — breaks under platform: 'neutral'
import { parse } from 'node:path/posix';
parse(somePath);

// After — resolves on all platforms
import { posix } from 'node:path';
posix.parse(somePath);
```

Tradeoff: imports the entire parent module's surface; loses
the narrower import that subpath imports were designed for.
For tree-shaken bundles the cost is minimal.

For code that must also run in browsers (where `node:path`
does not exist), use a computed specifier to prevent static
resolution:

```ts
const specifier = `node${':path'}`;
const nodePath = hasNodeRuntime
  ? (await import(specifier) as typeof import('node:path')).posix
  : undefined;
```

This pattern is already used in
`packages/module/es/src/path/index.ts`.

### What does not work

- Adding `node:path/posix` to rolldown's `external` array:
  externalisation applies after resolution, and the
  specifier fails during resolution.
- Setting `resolve.builtinModules` manually: this option is
  not exposed in rolldown's public `InputOptions`; it is
  derived internally from `platform`.

### Why we do not file this upstream

1. **Is it really upstream's fault?** Yes; the resolver's
   builtin check should fire for `node:` subpaths regardless
   of platform when the source code spells the prefix.
2. **Can upstream fix it?** Yes; flip the gate or add a
   distinct flag for `node:` recognition.
3. **Are they supporting this use case?** Yes; cross-runtime
   bundles are a documented goal.
4. **Will they likely fix it?** Plausible; the change is
   small.
5. **Have we prototyped a minimal fix?** No.

Decision: worth filing as a follow-up; not filed yet.
