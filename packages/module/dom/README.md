# module-dom

Browser DOM utilities that require a document context.

## Exports

- **`prompt(message, defaultValue?)`** -- modern prompt dialog using `<dialog>` element, polyfill for `window.prompt`
- **`replicateElementAsParentContent(element, count)`** -- replace parent's children with clones of element
- **`replicateElementAsContentOf(element, parent, count)`** -- replace target parent's children with clones
- **`deepCloneNode(node)`** -- type-preserving `cloneNode(true)` wrapper
- **`onLoadRedirectingTo(delay?)`** -- auto-redirect to URL from `a.redirectingTo` element
- **`onLoadSetCssFromUrlParams(allowed?)`** -- set `:root` CSS properties from URL query parameters
