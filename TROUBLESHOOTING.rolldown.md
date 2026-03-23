# Rolldown troubleshooting

## Import attributes are parsed but not used for module loading

**Date**: 2026-03-15
**Rolldown version**: 1.0.0-rc.9
**Upstream issue**: [rolldown/rolldown#2758](https://github.com/rolldown/rolldown/issues/2758) (open, on hold)

Rolldown's Rust AST scanner correctly parses `with { type: 'text' }` clauses
and stores them in an `import_attribute_map` keyed by `ImportRecordIdx`.
However, the scanner does **not** set `asserted_module_type` on the import record
based on the `type` attribute value.

**What works**: Import attributes are preserved in ESM output formatting
(`crates/rolldown/src/ecmascript/format/esm.rs:261-290`).

**What does not work**:

- `resolveId` hook receives no `attributes` field in its options
  (unlike Rollup 4's `options.attributes`).
  The `ResolveIdExtraOptions` type only has `custom`, `isEntry`, and `kind`.
- `.sql` files imported with `with { type: 'text' }` are parsed as JavaScript,
  causing `PARSE_ERROR` because rolldown does not map the `type` attribute
  to its native `ModuleType::Text`.
- The only place `asserted_module_type` is set is in `new_url.rs`
  for `new URL()` patterns (`ModuleType::Asset`).

**Source locations** (rolldown `main` as of 2026-03-15):

- `crates/rolldown/src/ast_scanner/mod.rs:674-676` -- stores attributes but does not set module type
- `crates/rolldown/src/ast_scanner/new_url.rs:68` -- only place `asserted_module_type` is set
- `crates/rolldown_common/src/types/import_record.rs:31` -- `asserted_module_type: Option<ModuleType>`
- `packages/rolldown/src/plugin/index.ts:132-157` -- `ResolveIdExtraOptions` lacks `attributes`

**Workaround**: The `@monochromatic-dev/rolldown-plugin-import-attributes` plugin
bridges this gap by using the `transform` hook to rewrite specifiers
(appending `?__importattr=<type>` query params) and the `load` hook to serve
the file content as a JS module. For dynamic imports where rolldown's scanner
discovers dependencies before `transform` runs, the `resolveId` hook
re-parses the importer source with `parseSync` to find the attribute type.

**Alternative**: Rolldown's `moduleTypes` input option maps file extensions
to module types globally (`{ ".sql": "text" }`), avoiding the need for a plugin
when all files of an extension should be treated the same way.
This does not respect per-import `with` clauses.

## `parseSync` runtime AST uses ESTree node type names

**Date**: 2026-03-15
**Rolldown version**: 1.0.0-rc.9
**Upstream issue**: [oxc-project/oxc#10139](https://github.com/oxc-project/oxc/issues/10139) (closed, wontfix)

Rolldown re-exports `parseSync` from `rolldown/utils` and ESTree types
via `export type * as ESTree from '@oxc-project/types'`.
The `@oxc-project/types` package declares OXC-native type names:

- `StringLiteral` with `type: "StringLiteral"`
- `IdentifierName` with `type: "Identifier"` (this one matches runtime)

But the **runtime** AST from `parseSync` uses ESTree-compatible names:

- String literals have `type: "Literal"` (not `"StringLiteral"`)
- All literal types (string, number, boolean, null, regexp) share `type: "Literal"`

This means TypeScript discriminated union narrowing does not work:

```ts
// Does NOT narrow -- "Literal" is not a discriminant in the declared union
if (node.source.type === 'Literal') {
  node.source.value; // TypeScript error: 'value' does not exist on type 'Expression'
}

// Workaround: use runtime typeof checks
if ('value' in node && typeof node.value === 'string') {
  // safely access string value
}
```

The OXC team has stated this is intentional --
they do not aim to align `@oxc-project/types` with ESTree.
Their recommendation is to use types from another ESTree-compatible implementation
(e.g. Acorn or TS-ESLint) if ESTree compatibility is needed.

**Affected code**: Any rolldown plugin using `parseSync` + `Visitor` from `rolldown/utils`
with TypeScript that needs to inspect literal values or narrow node types.

## `platform: 'neutral'` defaults `mainFields` to empty, breaking package resolution

**Date**: 2026-03-22
**Rolldown version**: 1.0.0-rc.9
**tsdown version**: 0.x (using rolldown as bundler)

When `platform` is set to `'neutral'`, rolldown defaults `resolve.mainFields` to `[]` (empty array).
This means **neither `module` nor `main`** fields in `package.json` are consulted
when resolving bare specifiers.
Packages that rely on these fields for entry point resolution silently fail
with `UNRESOLVED_IMPORT` warnings and are treated as external dependencies.

For comparison, the defaults per platform
(from `rolldown/dist/shared/define-config-*.d.mts`):

- **`node`**: `['main', 'module']`
- **`browser`**: `['browser', 'module', 'main']`
- **`neutral`**: `[]`

**Symptoms**:

- Build warnings: `Could not resolve '<package>'` followed by
  `"The 'main' field here was ignored. Main fields must be configured explicitly
  when using the 'neutral' platform."`
- Packages are left as bare specifier imports in the output bundle
- At runtime in the browser: `TypeError: The specifier "<package>" was a bare specifier,
  but was not remapped to anything`
- Transitive dependencies of bundled packages also fail
  (e.g. bundling `jspdf` leaves `fast-png`, `canvg`, `stackblur-canvas` unresolved)

**Root cause**: The `mainFields` option controls which `package.json` fields rolldown
checks to find a package's entry point. With `[]`, rolldown only resolves packages
that have an `exports` field with matching conditions. Packages without `exports`
(or whose `exports` conditions don't match the neutral platform) become unresolvable.

**Fix**: Set `resolve.mainFields` explicitly. In tsdown, `resolve` is a rolldown
`InputOptions` property, **not** a top-level tsdown config option.
It must be passed through `inputOptions`:

```ts
// tsdown config
export default defineConfig({
  platform: 'neutral',
  inputOptions: {
    resolve: {
      mainFields: ['module', 'main'],
    },
  },
});
```

**What does not work**:

- Setting `resolve` at the top level of the tsdown config -- tsdown's `UserConfig`
  type does not include `resolve`, so it is silently dropped
- Adding every transitive dependency to `deps.alwaysBundle` --
  `alwaysBundle` controls whether a package is bundled vs externalized,
  but if the package cannot be **resolved** in the first place,
  it is treated as external regardless of `alwaysBundle`

**Source locations** (rolldown 1.0.0-rc.9):

- `dist/shared/define-config-*.d.mts:3338-3347` -- `mainFields` type and per-platform defaults
- `dist/shared/binding-*.d.mts:559` -- native binding `mainFields` field

**Source locations** (tsdown):

- `dist/types-*.d.mts:880-882` -- `inputOptions` pass-through to rolldown `InputOptions`
- `dist/types-*.d.mts:763` -- `platform` option definition
