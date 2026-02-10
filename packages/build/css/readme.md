# @monochromatic-dev/build-css

CSS build tool that bundles `@import` statements across monorepo packages and processes custom `@mixin`/`@apply` syntax into expanded CSS.

## Why this exists

No single CSS tool handles all three requirements at once:

1. **Monorepo-aware `@import` resolution** -- LightningCSS bundles CSS but only resolves relative paths, not `node_modules` or package.json `exports`
2. **Custom `@mixin`/`@apply` processing** -- LightningCSS's `customAtRules` breaks when CSS contains `var()` ([lightningcss#1081](https://github.com/parcel-bundler/lightningcss/issues/1081))
3. **Framework-agnostic pre-build** -- Vite/Astro CSS pipelines are opaque and don't reliably run PostCSS on all generated CSS

This package stitches together three tools to cover the gaps:

- **LightningCSS** -- fast CSS bundling (`@import` inlining)
- **oxc-resolver** -- Node.js-compatible module resolution (package.json `exports`, `node_modules`, monorepo workspaces)
- **PostCSS** -- AST walking for `@mixin` collection and `@apply` expansion

See [TROUBLESHOOTING.css-tooling.md](../../../TROUBLESHOOTING.css-tooling.md) for the full chronicle.

## Usage

### CLI

```bash
bun packages/build/css/src/index.ts src/main.css dist/bundle.css
bun packages/build/css/src/index.ts src/main.css dist/bundle.css --watch
```

### Programmatic

```ts
import { build } from '@monochromatic-dev/build-css';

const css = await build({
  input: 'src/main.css',
  output: 'dist/bundle.css',
});
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
The build expands nested references in multiple passes until stable, with a safety limit to detect circular references.

```css
@mixin --card {
  @apply --flex-center;
  padding: 1rem;
  border: 1px solid gray;
}
```

### Cross-package imports

Imports resolve through `node_modules` using oxc-resolver, supporting both package.json `exports` mappings and direct file paths (for packages without `exports`):

```css
/* Via exports field */
@import '@monochromatic-dev/style-monochromatic/index.css';

/* Via direct file path (package has no exports field) */
@import '@some-package/src/tokens.css';
```

## Build pipeline

1. **Resolve and bundle** -- LightningCSS walks `@import` statements, oxc-resolver maps specifiers to absolute paths, LightningCSS inlines the resolved files
2. **Collect mixins** -- PostCSS walks the bundled AST, extracts `@mixin` definitions into a registry, removes them from the tree
3. **Expand mixin bodies** -- nested `@apply` rules inside mixin definitions are resolved via fixed-point iteration
4. **Inline `@apply`** -- remaining `@apply` rules in the document are replaced with cloned mixin body nodes
5. **Write output** -- final CSS string written to disk

## Module structure

| File | Purpose |
|------|---------|
| `index.ts` | CLI entry point with argument parsing and watch mode |
| `build.ts` | Orchestrates the full pipeline, re-exports public API |
| `resolve.ts` | oxc-resolver factory and `@import` specifier resolution |
| `mixin.ts` | `collectMixins` and `expandApplyRules` (PostCSS walkers) |
| `mixin-registry.ts` | Mixin storage, nested `@apply` expansion, type guards |

## Testing

```bash
bun test packages/build/css/
```

Integration tests exercise two CSS import resolution strategies using fixture packages:

- **`exports` field** -- `test-css-importing` imports from `test-css-imported` (has `exports` in package.json)
- **Direct file path** -- `test-css-importing-filepath` imports from `test-css-imported-no-exports` (no `exports` field)

Both strategies run identical assertions: import resolution, mixin removal, `@apply` expansion, nested mixin inlining, and output file writing.
