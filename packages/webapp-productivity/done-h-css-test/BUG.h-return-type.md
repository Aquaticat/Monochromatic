# Bug: `h()` may return generic `HTMLElement` instead of narrowed element types

## Observed behavior

Multiple call sites in `done-h-css-test` cast the return value of `h()` to a specific element type
even though the function's TypeScript signature should narrow the return type automatically:

```ts
// task-detail-render.ts -- h({ tag: 'input' }) should return HTMLInputElement
const titleInput = h({ tag: 'input', class: 'title-input', ... });
// ...but the code needed: titleInput as unknown as HTMLInputElement
```

```ts
// task-detail-render.ts -- h({ tag: 'textarea' }) should return HTMLTextAreaElement
const descInput = h({ tag: 'textarea', class: 'desc-input', ... });
// ...but the code needed: descInput as unknown as HTMLTextAreaElement
```

The oxlint `no-unsafe-type-assertion` rule flagged these as "Unsafe assertion from `any` detected",
meaning the source type was `any` rather than the expected `HTMLInputElement` / `HTMLTextAreaElement`.

## Expected behavior

`$<const TTag extends string>({ tag }: HOptions<TTag>): ElementFromTag<TTag>`
should narrow correctly:

- `h({ tag: 'input' })` -> `HTMLInputElement`
- `h({ tag: 'textarea' })` -> `HTMLTextAreaElement`
- `h({ tag: 'button' })` -> `HTMLButtonElement`
- `h({ tag: 'div' })` -> `HTMLDivElement`

Only custom element tags (not in `HTMLElementTagNameMap`) should fall back to `HTMLElement`.

## Source definition

`packages/module/es/src/types/t object/t htmlElement/f/t string jsx/r s/p n/index.ts`

The function signature is correct -- it uses `<const TTag extends string>` and `ElementFromTag<TTag>`:

```ts
type ElementFromTag<TTag extends string> = TTag extends keyof HTMLElementTagNameMap
  ? HTMLElementTagNameMap[TTag]
  : HTMLElement;

export function $<const TTag extends string>(
  { tag, ... }: HOptions<TTag>,
): ElementFromTag<TTag> { ... }
```

## Suspected root cause

One or more of:

1.  **Import path resolution** --
    the import uses a deep filesystem path
    (`@monochromatic-dev/module-es/ts/types/t object/t htmlElement/f/t string jsx/r s/p n/index.ts`)
    which may resolve to a compiled `.d.ts` that loses the `const` generic or widens `TTag` to `string`

2.  **`const` generic erasure in build output** --
    `tsdown` / `dts` bundling may strip the `const` modifier from
    `<const TTag extends string>`, causing TypeScript to infer `TTag = string` instead of the literal,
    making `ElementFromTag<string>` resolve to `HTMLElement`

3.  **Re-export chain** --
    if the function passes through intermediate barrel files that re-declare the signature
    without `const`, the narrowing is lost

## Verification steps

1.  Check the generated `.d.ts` for the exported `$` function -- does it preserve `<const TTag>`?
2.  In a consuming file, hover over `h({ tag: 'input' })` in the editor -- does the inferred type
    show `HTMLInputElement` or `HTMLElement`?
3.  If the `.d.ts` drops `const`, fix the tsdown/dts config to preserve it

## Impact

Without correct narrowing, every call site that needs a specific element type must use
`as unknown as HTMLInputElement` -- these are flagged by `no-unsafe-type-assertion`
and require inline disable comments.

## Workaround (current)

The affected files in `done-h-css-test` use either:
- `oxlint-disable` comments for the assertion
- `instanceof` checks before accessing element-specific properties
- Assigning to typed `RenderRefs` fields with block-level `oxlint-disable`
