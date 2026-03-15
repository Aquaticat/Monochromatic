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
