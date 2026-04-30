# `[hidden] { display: none }` order matters when other rules set `display`

## Symptom

An element with `hidden` set as an HTML attribute kept rendering visually even though `getComputedStyle(el).display` reported nothing unusual and `el.hidden` reported `true`. Specifically: paper2vn's chapter card overlay (`.chapter-card { display: grid }`) stayed visible after a beat advance set `chapterCard.hidden = true`.

## Root cause

The browser's `[hidden]` HTML attribute does not have intrinsic styling priority. It is exposed via the user-agent stylesheet rule:

```css
[hidden] {
  display: none;
}
```

When you set `hidden` on an element that also matches a user-defined rule with the same specificity (0,1,0) like `.chapter-card { display: grid }`, the **later rule wins** under CSS specificity tie-breaking by source order.

Most resets put their `[hidden]` rule near the top of the stylesheet so layout-style rules placed afterwards silently outrank it. The element's `hidden` attribute stays `true`, the JS state machine reads it correctly, and yet the element keeps painting.

## Fix

Place `[hidden] { display: none }` **after** any layout-defining rules that target the same elements. Author order is the only lever when specificities tie.

In paper2vn, the `[hidden]` rule lives at the very end of `packages/webapp-edu/paper2vn/src/styles.ts`:

```ts
$({
  rule: '.chapter-card',
  decls: { display: 'grid', /* ... */ },
}),
// ... all other layout rules ...
$({
  rule: '[hidden]',
  decls: { display: 'none' },
}),
```

## Why not `!important`?

Project conventions ban `!important`. Source-order ordering achieves the same outcome with the natural cascade and stays maintainable -- a future contributor reading the stylesheet top-down sees layout rules first, then the late `[hidden]` reset.

## Why not CSS layers?

`@layer reset { [hidden] { display: none } }` works too and is arguably cleaner, because layered rules always win against unlayered rules regardless of source order. Worth considering when the stylesheet grows. The codebase does not currently use `@layer` so we kept the source-order approach for consistency.

## How to verify

Set the attribute and check both DOM state and computed style:

```js
el.hidden = true;
console.log(el.hidden, getComputedStyle(el,).display,);
// Should log: true, "none"
// If it logs: true, "grid"  -- the [hidden] rule is being outranked
```

If the second value is anything other than `none`, you have a specificity or source-order conflict.
