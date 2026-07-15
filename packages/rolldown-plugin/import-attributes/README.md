# @monochromatic-dev/rolldown-plugin-import-attributes

Rolldown plugin that transforms [import attributes][mdn] (`with { type: 'text' }`)
into bundler-compatible module loads.

Rolldown parses import attributes and preserves them in ESM output,
but does not use them to influence module loading ([rolldown#2758][issue]).
This plugin bridges the gap.

[mdn]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import/with
[issue]: https://github.com/nicolo-ribaudo/tc39-proposal-import-attributes/issues/2758

## Usage

```ts
// rolldown.node.config.ts
import {
  importAttributesPlugin,
} from '@monochromatic-dev/rolldown-plugin-import-attributes/ts';
import { defineConfig, } from 'rolldown';

export default defineConfig({
  plugins: [importAttributesPlugin(),],
},);
```

Source files can then use import attributes:

```ts
// Static import
import query from './schema.sql' with { type: 'text', };

// Re-export
export { default as query, } from './schema.sql' with { type: 'text', };

// Dynamic import
const mod = await import('./schema.sql', { with: { type: 'text', }, });
```

All three forms produce a module whose default export is the file content as a string.

## Supported types

- **`text`**:
   exports raw file content as a default string export

## How it works

The plugin uses two mechanisms to intercept imports before rolldown tries to parse
non-JavaScript files:

1. **`transform` hook**:
    rewrites `with { type: '...' }` clauses into query parameters
   on the specifier (e.g. `'./file.sql?__importattr=text'`).
   Handles static imports and re-exports reliably.

2. **`resolveId` hook**:
    for dynamic imports,
    rolldown's Rust scanner discovers
   dependencies from the original AST before `transform` runs.
   The plugin reads the importer's source to detect the attribute clause
   and tags the resolved ID with the appropriate query parameter.

The `load` hook then intercepts tagged IDs,
 reads the file,
and returns the handler's output as a JavaScript module.
