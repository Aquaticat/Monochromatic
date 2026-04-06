# module-hyperscript

Type-safe hyperscript factories for declarative HTML, CSS, DOM, and XML generation.

Each factory function builds strings (or DOM elements) from a named-parameter
options object, replacing manual template literals with composable, type-checked calls.

## Exports

The package provides two entry points:

- **`.`** -- built JavaScript (bundled, minified)
- **`./ts`** -- raw TypeScript source for workspace consumers

Both expose the same named exports:

| Export  | Returns       | Environment    | Description                                                           |
| ------- | ------------- | -------------- | --------------------------------------------------------------------- |
| `hHtml` | `string`      | Any JS runtime | Server-side HTML with automatic XSS escaping                          |
| `hCss`  | `string`      | Any JS runtime | CSS rules and at-rules with strict property/value types via `csstype` |
| `hDom`  | `HTMLElement` | Browser only   | Live DOM elements via `document.createElement`                        |
| `hXml`  | `string`      | Any JS runtime | Well-formed XML with namespace support and self-closing tags          |

All `css*` value constructors (`cssRem`, `cssVar`, `cssOklch`, etc.) are also
top-level named exports.

## Usage

```ts
// TypeScript source (workspace)
import {
  cssRem,
  cssVar,
  hCss,
  hHtml,
} from '@monochromatic-dev/module-hyperscript/ts';

// Built JavaScript (external consumers)
import {
  cssRem,
  cssVar,
  hCss,
  hHtml,
} from '@monochromatic-dev/module-hyperscript';
```

```ts
import { hHtml as h, } from '@monochromatic-dev/module-hyperscript/ts';

const card = h({
  tag: 'div',
  class: 'card',
  children: [h({ tag: 'p', text: 'hello', },),],
},);
// '<div class="card"><p>hello</p></div>'
```

```ts
import {
  cssRem,
  cssVar,
  hCss as $,
} from '@monochromatic-dev/module-hyperscript/ts';

const styles = $({
  rule: '.card',
  decls: { display: 'flex', gap: cssRem(1,), color: cssVar('fg',), },
},);
// '.card{display:flex;gap:1rem;color:var(--fg)}'
```

## CSS value constructors

Branded value constructors replace raw strings,
preventing invalid units and disallowed color functions at the type level:

- **Lengths:** `cssRem`, `cssEm`, `cssCh`, `cssLh`, `cssVi`, `cssVb`, `cssCqi`, `cssCqb`, `cssDvi`, `cssDvb`, `cssFr`, `cssPercent`
- **Time:** `cssS`
- **Angle:** `cssTurn`
- **Color:** `cssOklch`, `cssColorFn`
- **Reference:** `cssVar`, `cssCalc`, `cssMin`
- **Number:** `cssNum`, `cssInt`
- **Transform:** `cssTranslateX`, `cssTranslateY`, `cssRotate`, `cssScale`
- **Anchor:** `cssAnchor`
- **Composition:** `cssCubicBezier`, `cssCommaList`, `cssCompounded`

## Design decisions

- **No cross-dependencies:** Each factory module is fully self-contained with zero imports
  from sibling modules or external packages (except `csstype` for h-css type definitions).
- **Split from module-es:** These factories were originally subpath exports of
  `@monochromatic-dev/module-es`. They were extracted because they have zero coupling
  to the type utilities and general-purpose helpers in that package.
- **Named factory exports:** Each module's `$` function is re-exported with a distinct name
  (`hCss`, `hDom`, `hHtml`, `hXml`) so all four coexist in a single namespace.
  Consumers typically alias on import: `import { hHtml as h } from '...'`.
