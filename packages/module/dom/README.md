# module-dom

Browser DOM utilities that require a live `document` context.

Each helper either reads from or writes to the page that already exists.
None of them construct or own a document;
they reach into one that is already mounted
(`document.body`, `document.documentElement`, an element looked up by selector,
or an element handed in by the caller).
Importing this package from a non-DOM runtime
(Node without a `document` shim, a service worker, a Bun script with no JSDOM)
compiles, but every helper throws at call time.

The package is source-only.
`./ts` resolves to `./src/index.ts` (the barrel).
`./ts/*` resolves to individual modules for consumers that only need one helper.

## Exports

### `prompt(message, defaultValue?)`

Async replacement for `window.prompt` that uses an HTML `<dialog>`,
so the dialog can be styled with CSS instead of locked to the browser's native chrome.
Resolves to the entered string,
or `null` when the user cancels (Esc, backdrop click, or the Cancel button).
Unlike `window.prompt`, it never blocks the main thread;
the returned promise lets other work continue while the dialog is open.

It is not a true drop-in: `window.prompt` returns `''` when the user
clicks OK with an empty field, but this helper resolves to `null`
for both cancellation and empty-OK.
Callers that need to distinguish "submitted blank" from "cancelled"
should use a different control.

```ts
import { prompt, } from '@monochromatic-dev/module-dom/ts/prompt.ts';

const newApiKey = await prompt('Change api key',);
if (newApiKey !== null) {
  applyApiKey(newApiKey,);
}
```

The dialog elements receive class names
(`prompt-polyfill-dialog`, `prompt-polyfill-cancel`, `prompt-polyfill-ok`)
so the consumer's stylesheet can theme them;
no styles are bundled.

### `replicateElementAsParentContent(templateElement, targetCount)`

Replaces the parent's children with `targetCount` deep clones of `templateElement`.
The original template element is itself removed
(it is replaced along with its siblings);
the parent is inferred from `templateElement.parentElement`,
and the function throws when the template is detached.
Use when the template element you already hold a reference to
is the one whose container you want to fill.

```ts
import { replicateElementAsParentContent, } from '@monochromatic-dev/module-dom/ts/duplicateElement.ts';

// Before:
// <ul id="list">
//   <li>placeholder</li>
//   <li class="row">template</li>
// </ul>

const template = document.querySelector<HTMLElement>('.row',)!;
replicateElementAsParentContent(template, 3,);

// After:
// <ul id="list">
//   <li class="row">template</li>
//   <li class="row">template</li>
//   <li class="row">template</li>
// </ul>
```

`targetCount` of `0` empties the parent.

### `replicateElementAsContentOf(templateElement, parentElement, targetCount)`

Replaces `parentElement`'s children with `targetCount` deep clones of `templateElement`.
The parent is passed in explicitly;
the template element does not need to live inside it,
and is not removed from wherever it currently sits.
Use when the template lives in one tree
(a `<template>` element, an off-DOM scratch element, a fixture in another container)
and you need to fill a separate parent with copies.

```ts
import { replicateElementAsContentOf, } from '@monochromatic-dev/module-dom/ts/duplicateElement.ts';

// <template id="row-template"><li class="row">…</li></template>
// <ul id="list"></ul>

const template = (document.querySelector<HTMLTemplateElement>('#row-template',)!).content
  .firstElementChild as HTMLElement;
const list = document.querySelector<HTMLElement>('#list',)!;

replicateElementAsContentOf(template, list, 3,);
// #list now holds three independent clones; the <template> is untouched.
```

#### Choosing between the two

The two helpers differ only in how the parent is supplied:

- `replicateElementAsParentContent(template, n)` infers the parent
  from the template's existing position in the tree,
  and **removes the template** along with its siblings.
- `replicateElementAsContentOf(template, parent, n)` takes the parent explicitly
  and **leaves the template alone**,
  so the same template can fill several parents.

When in doubt, reach for `replicateElementAsContentOf`:
it is the more explicit shape,
and works for the cases the other one cannot (detached templates, cross-container reuse).

### `deepCloneNode(node)`

Type-preserving wrapper around `Node.prototype.cloneNode(true)`.
`Node.cloneNode` returns `Node`, which forces a cast at every call site;
`deepCloneNode<T extends Node>(node: T): T` preserves the concrete element type,
so a cloned `HTMLAnchorElement` stays an `HTMLAnchorElement` without a manual `as`.

```ts
import { deepCloneNode, } from '@monochromatic-dev/module-dom/ts/duplicateElement.ts';

const link = document.querySelector<HTMLAnchorElement>('a.primary',)!;
const linkClone = deepCloneNode(link,);
// linkClone has type HTMLAnchorElement, not Node.
linkClone.href = '/secondary';
```

### `onLoadRedirectingTo(delayTime?)`

Looks up `document.querySelector('a.redirectingTo')`,
and after `delayTime` milliseconds (default `5000`),
calls `location.replace(anchor.href)`.
`location.replace` is used instead of `location.assign`,
so the redirect does not add a history entry;
users pressing Back skip past the intermediate page.
When no element matches, the function is a no-op,
so it is safe to call unconditionally on every page.

Expected markup:

```html
<a href="https://example.com/dashboard" class="redirectingTo">
  Taking you to the dashboard…
</a>
```

```ts
import { onLoadRedirectingTo, } from '@monochromatic-dev/module-dom/ts/redirectingTo.ts';

// At module top level on a landing page.
// Default 5s delay:
onLoadRedirectingTo();

// Or specify a 2s delay:
onLoadRedirectingTo(2_000,);
```

The anchor stays in the DOM,
so the page remains a working manual link if the user clicks before the timer fires,
or if JavaScript fails to run.
Only the first match is honoured;
additional `a.redirectingTo` elements are ignored.

### `onLoadSetCssFromUrlParams(allowedProperties?)`

Reads `location.search` and calls
`document.documentElement.style.setProperty(key, value)`
verbatim for every query-string pair.
When `allowedProperties` is supplied,
only keys present in that iterable are applied;
everything else is dropped.

Each key passes through unchanged.
A `--`-prefixed key (`--brand`) sets a CSS custom property on `:root`,
visible to every `var(--brand)` read on the page.
A standard CSS property name (`color`, `background-image`) sets an inline style on
`<html>` itself, the same as writing it in a `<style>` block on the root element.
A key that is neither a valid custom property nor a known CSS property is silently
discarded by `setProperty`.

The function is a thin bridge from
"URL is the source of truth for theme"
to
"CSS state is the source of truth for styles",
and is useful for shareable theme links,
A/B-style configuration toggles,
and quick visual debugging without a code change.
Pass an allowlist whenever the URL is user-controllable;
an open-ended call accepts every key in the query string,
and is therefore an attack surface for crafted links
that overwrite layout-critical properties on `:root`
(custom properties used by stylesheets, or standard properties like `display`
that affect the entire document).

```ts
import { onLoadSetCssFromUrlParams, } from '@monochromatic-dev/module-dom/ts/set/cssFromParam.ts';

// URL: /?--brand=oklch(0.7 0.15 250)&--radius=0.5rem
onLoadSetCssFromUrlParams([
  '--brand',
  '--radius',
],);

// :root now has --brand and --radius set;
// CSS rules referencing var(--brand) update.
```

## Design decisions

- **Source-only.** No build step; consumers import directly from `src/`.
- **One file per concern.**
  `prompt.ts`, `redirectingTo.ts`, `duplicateElement.ts`, `set/cssFromParam.ts`;
  `index.ts` re-exports.
- **`document` is the contract.**
  Every helper assumes a live document at call time.
  Helpers do not feature-detect or fall back to a stub;
  calling them in a non-DOM runtime is a bug in the consumer,
  not a case the package handles.
- **`onLoad*` naming.**
  Helpers that scan the document on call
  (`onLoadRedirectingTo`, `onLoadSetCssFromUrlParams`)
  are named for their intended call site:
  a script run after the document is parsed,
  typically at the end of `<body>` or inside a `DOMContentLoaded` listener.
  They do not attach their own listeners;
  the timing is the consumer's responsibility.
