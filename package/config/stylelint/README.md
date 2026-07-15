# @monochromatic-dev/config-stylelint

Shared [Stylelint](https://stylelint.io/) configuration for Monochromatic stylesheet projects.

Extends [`stylelint-config-standard`](https://github.com/stylelint/stylelint-config-standard) and layers monorepo-specific rules on top:
 a curated property and unit denylist,
 a legacy color-function ban,
 a strict media-query shape,
 and an Astro/HTML override that routes embedded styles through `postcss-html`.

## What it configures

- **Error-avoidance**:
   `no-descending-specificity` (ignores selectors-within-list),
   `at-rule-no-unknown` (ignores `mixin`,
   `apply`),
   `unit-no-unknown` (ignores CSS custom-property regex units).
- **At-rule denylist**:
   bans `@charset` and `@font-palette-values`.
- **Color**:
   `color-named: never` and `function-disallowed-list` that bans `hsl`,
   `hwb`,
   `lab`,
   `lch`,
   `oklab`,
   `rgb`,
   `rgba`,
   `color-contrast`,
   `light-dark`,
   `saturate`,
   `element`,
   `paint`,
   `palette-mix`.
   Use `oklch()` or `color()` instead.
- **Media queries**:
   forbids `min-*` and `max-*` features (use `<=` / `>` range syntax),
   and pins media-feature units to `rem`.
- **Property denylist**:
   pulled from `property-disallowed-list.mjs`.
   Bans legacy properties (`float`,
   `clear`),
   deprecated/non-standard properties (`clip`,
   `font-smooth`),
   every axis-combining shorthand (`background`,
   `border`,
   `flex`,
   `font`,
   `grid`,
   `inset`,
   `mask`,
   `outline`,
   `overflow`,
   `transition`,
   plus `margin`/`padding` shorthands),
   and the physical box properties (`width`,
   `height`,
   `*-top`,
   `*-left`,
   `*-right`,
   `*-bottom`) in favour of logical equivalents.
- **Unit denylist**:
   pulled from `unit-disallowed-list.mjs`.
   Bans angle units other than `turn`,
   font-relative units that depend on the font face (`ch`,
   `ex`,
   `cap`,
   `ic`,
   and their `r*` variants),
   viewport units (`vh`,
   `vw`,
   `cqw`,
   `cqh`) in favour of logical equivalents,
   absolute lengths (`px`,
   `cm`,
   `mm`,
   `Q`,
   `in`,
   `pc`,
   `pt`),
   and `ms` in favour of `s`.
- **Notation**:
   `font-weight-notation: named-where-possible`,
   `import-notation: string`,
   `value-keyword-case: lower` (ignores `font-family`,
   `initial-value`,
   and custom properties).
- **Whitespace**:
   blank line before every declaration except after a comment or as the first nested declaration.
- **Disable hygiene**:
   every `stylelint-disable` comment must include a description,
   scope correctly,
   and be needed;
   unscoped disables are reported.
- **Astro and HTML overrides**:
   `*.astro` and `*.html` files are parsed via `postcss-html`.

## Usage

Create a `stylelint.config.mjs` in your project root:

```js
// stylelint.config.mjs
/** @type {import('stylelint').Config} */
export default {
  extends: '@monochromatic-dev/config-stylelint',
};
```

See [`example.stylelint.config.mjs`](./example.stylelint.config.mjs) for the published-package reference,
 and [`pnp.example.stylelint.config.mjs`](./pnp.example.stylelint.config.mjs) for the in-repo path reference that resolves without going through the package name.

## Ignoring files

`ignoreFiles` paths resolve relative to the consuming config's location,
 not to this shared config,
 so file-ignore patterns must live in the root `stylelint.config.mjs`.
 Stylelint also accepts a `.gitignore` directly via its CLI argument,
 which is faster than a `.stylelintignore` file.
 The [`example..stylelintignore`](./example..stylelintignore) file in this directory documents the historical ignore patterns for reference.
