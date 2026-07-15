# @monochromatic-dev/build-css

CSS build tool that bundles `@import` statements across monorepo packages and processes custom `@mixin`/`@apply` syntax into expanded CSS.

## Why this exists

No single CSS tool handles all three requirements at once:

1. **Monorepo-aware `@import` resolution**:
    PostCSS only resolves relative paths out of the box,
    not `node_modules` or package.
   json `exports`
2. **Custom `@mixin`/`@apply` processing**:
    no standard PostCSS plugin provides the mixin semantics this monorepo needs
3. **Browser-compatible**:
    the entire pipeline runs in both Node.
   js and browser environments (no native binary dependencies)

The package uses only **PostCSS** for all CSS processing:
 AST walking for `@import` inlining,
 `@mixin` collection,
 and `@apply` expansion.
A custom `@import` plugin handles monorepo-aware resolution (package.
json `exports`,
 `node_modules`,
 workspace packages).

See [doc/troubleshooting/css-tooling.md](../../../doc/troubleshooting/css-tooling.md) for the full chronicle.

## Usage

### CLI

```bash
build-css src/main.css dist/bundle.css
```

### Programmatic

```ts
import { build, } from '@monochromatic-dev/build-css';

const css = await build({
  input: 'src/main.css',
  output: 'dist/bundle.css',
},);
```

## CSS syntax

### Mixin definitions

```css
@mixin --flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
}
```

Definitions are removed from the output.

### Mixin application

```css
.component {
  @apply --flex-center;
  background: var(--primary);
}
```

`@apply` rules are replaced with the referenced mixin's body.

### Nested mixins

Mixins can reference other mixins via `@apply`.
The build expands nested references in multiple passes until stable,
 with a safety limit to detect circular references.

```css
@mixin --card {
  @apply --flex-center;
  padding: 1rem;
  border: 1px solid gray;
}
```

### Cross-package imports

Imports resolve through a custom PostCSS plugin,
 supporting package.
json `exports` mappings,
 `node_modules` lookup,
 and direct file paths:

```css
/* Via exports field */
@import '@monochromatic-dev/style-monochromatic/index.css';

/* Via direct file path (package has no exports field) */
@import '@some-package/src/tokens.css';
```

## Using mixins in JavaScript (Shadow DOM, runtime)

The `build()` function processes standalone `.css` files on disk.
For consumers that already have CSS text in memory (such as web components with Shadow DOM styles defined as JavaScript strings),
 use `applyMixins()`:

```ts
import { applyMixins, } from '@monochromatic-dev/build-css/ts';
import mixinSource from './mixins.css' with { type: 'text', };

const expanded = applyMixins({
  cssText: `
    .close { @apply --reset-button; @apply --touch-target; }
    .pill  { @apply --pill; }
  `,
  mixinCssText: mixinSource,
},);
```

`applyMixins({ cssText, mixinCssText })` encapsulates the full pipeline (parse mixin definitions,
 expand nested mixin bodies,
 inline `@apply` rules,
 serialize) and returns the expanded CSS string.
No filesystem access,
 no postcss import needed by the caller.

### Browser environments

PostCSS references `process.env` without guards.
Import the provided shim before any build-css import:

```ts
import '@monochromatic-dev/build-css/ts/process-shim';
import { applyMixins, } from '@monochromatic-dev/build-css/ts';
```

## Build pipeline

1. **Resolve and bundle**:
    a custom PostCSS plugin walks `@import` statements,
    resolves specifiers (relative paths,
    package.
   json `exports`,
    bare `node_modules`),
    and inlines the resolved files
2. **Collect mixins**:
    PostCSS walks the bundled AST,
    extracts `@mixin` definitions into a registry,
    removes them from the tree
3. **Expand mixin bodies**:
    nested `@apply` rules inside mixin definitions are resolved via fixed-point iteration
4. **Inline `@apply`**:
    remaining `@apply` rules in the document are replaced with cloned mixin body nodes
5. **Write output**:
    final CSS string written to disk

## Module structure

<table>
<thead>
<tr>
<th>File</th>
<th>Purpose</th>
</tr>
</thead>
<tbody>
<tr>
<td>`index.ts`</td>
<td>CLI entry point with argument parsing</td>
</tr>
<tr>
<td>`build.ts`</td>
<td>Orchestrates the full pipeline; exports `build()` and `applyMixins()`</td>
</tr>
<tr>
<td>`import.ts`</td>
<td>Custom PostCSS `@import` plugin with monorepo-aware resolution</td>
</tr>
<tr>
<td>`mixin.ts`</td>
<td>`collectMixins` and `expandApplyRules` (PostCSS walkers)</td>
</tr>
<tr>
<td>`mixin-registry.ts`</td>
<td>Mixin storage, nested `@apply` expansion, type guards</td>
</tr>
<tr>
<td>`fs.ts`</td>
<td>Adaptive file reader (in-memory registry with `node:fs` fallback)</td>
</tr>
<tr>
<td>`fs-registry.ts`</td>
<td>In-memory `Map` for browser-side file storage</td>
</tr>
<tr>
<td>`process-shim.ts`</td>
<td>Minimal `globalThis.process` shim for browser environments</td>
</tr>
</tbody>
</table>

## Testing

```bash
# Run all module-test files in this package
mise run //package/build-tool/css:test:unit
```

Integration tests exercise two CSS import resolution strategies using fixture packages:

- **`exports` field**:
   `test-css-importing` imports from `test-css-imported` (has `exports` in package.
  json)
- **Direct file path**:
   `test-css-importing-filepath` imports from `test-css-imported-no-exports` (no `exports` field)

Both strategies run identical assertions:
 import resolution,
 mixin removal,
 `@apply` expansion,
 nested mixin inlining,
 and output file writing.
