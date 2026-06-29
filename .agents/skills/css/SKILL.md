---
name: css
description: Use when editing CSS, writing component styles, or reviewing CSS in this repo.
---

# CSS in Monochromatic

Fires when editing CSS files,
 writing component styles,
 picking between CSS approaches,
reviewing CSS in a PR,
 choosing sizing units,
 deciding on a selector strategy,
or adding inline styles to a component.

Other surface phrases that should trigger the skill:
"edit this CSS",
 "style this",
 "write a stylesheet",
 "add CSS to",
"review CSS",
 "what's the right CSS for",
 "this component needs styles".
The skill applies to `.css` files,
 CSS-in-JS,
 inline `style` attributes,
and any styling work in the repo.

Single source of truth for the browser baseline:
see `PHILOSOPHY.browser-support.md` at the repo root.

The skill encodes the platform-feature defaults,
browser baseline,
 sizing rules,
 logical properties,
 shorthand rules,
design-token colors,
 declaration discipline,
 accessibility minima,
 mixin shape,
nesting depth,
 and state-attribute conventions.

## Browser baseline

Firefox ESR 140 (June 2025).
All CSS features must be supported by this baseline.
Newer features that the baseline lacks need a feature query (`@supports`) and a fallback,
or they need to be deferred.

When in doubt about a feature,
 check the Firefox ESR 140 caniuse percentage
before reaching for it.
Anything supported in evergreen Firefox but not ESR 140
is off-limits without a feature query.

## Native platform features first

Pick the native option before reaching for a library:

- `<dialog>` for modals.
- Popover API (`popover` attribute,
   `::backdrop` pseudo-element).
- CSS nesting (native,
   not Sass).
- `@layer` for cascade control.
- `@scope` for scoped selectors.
- Container queries (`@container`).

A library or framework that wraps these features adds weight without adding capability.
Use the native form;
reach for a library only when the native form has a documented incompatibility
with the browser baseline.

## Sizing

Use `rem` for all sizing.
Derive related sizes with `calc()`:

```css
.card {
  padding-inline: calc(1rem + 0.5rem);
  border-radius: calc(0.5rem - 1px);
}
```

Never use `px` except in device-pixel-dependent contexts
(1px borders,
 hairline dividers,
 sub-pixel positioning).
Even those cases should be audited;
a 0.0625rem hairline is usually the right call.

## Logical properties

Logical properties everywhere:

- `margin-inline-start` instead of `margin-left`.
- `margin-inline-end` instead of `margin-right`.
- `inset-block-start` instead of `top`.
- `inset-inline-end` instead of `right`.
- `text-align: start` instead of `text-align: left`.
- `padding-inline`,
   `padding-block`,
   `margin-inline`,
   `margin-block`.

Logical properties adapt to writing direction and language
without per-locale overrides.
Physical properties are forbidden in new code.

```css
/* Wrong */
.card {
  margin-left: 1rem;
  text-align: left;
}

/* Right */
.card {
  margin-inline-start: 1rem;
  text-align: start;
}
```

## Shorthand rules

No shorthand properties that combine unrelated axes or sub-properties:

- Forbidden:
   `margin`,
   `padding`,
   `border`,
   `background`.
- Reason:
   longhand is easier to scan and diff.
  `margin: 1rem 2rem 3rem 4rem` hides which value lands on which axis;
  four longhand declarations make it explicit.

Single-axis or single-concept shorthands are fine:

- `padding-inline`,
   `margin-block` (single-axis).
- `border-radius`,
   `inset`,
   `gap` (single-concept).

## Colors via design tokens

All colors come from CSS custom properties in the design token system.
No inline color literals.

```css
/* Wrong */
.card {
  background-color: #f5f5f5;
}

/* Right */
.card {
  background-color: var(--color-surface-1);
}
```

No `var()` fallbacks (`var(--x, red)`).
Fallbacks hide missing tokens;
without them a missing token surfaces as an invalid declaration
which is easier to spot in DevTools.
The single exception:
 user-configurable properties
where the fallback represents the default user choice.

## Declarations and !important

Keep declarations minimal.
Each property appears once per rule
(the cascade resolves duplicates,
 but the diff churns).

No `!important`.
If a rule needs `!important` to win the cascade,
the cascade structure is wrong;
fix `@layer` ordering or selector specificity instead.

Prefer fluid approaches (`clamp()`,
 container queries,
 `calc()` with viewport units)
over breakpoints.
Breakpoints jump at specific widths;
 fluid scales smoothly.

## Accessibility minima

`:focus-visible` on every interactive element.
Never remove the default focus ring without replacing it with a visible alternative.

Touch targets:
 minimum 48px via `min-inline-size` and `min-block-size`
(logical equivalents of `min-width` and `min-height`).

```css
button {
  min-inline-size: 3rem;
  min-block-size: 3rem;
}

button:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}
```

## Mixins

Small composable mixins named by what they do,
 not what they style:

- Good:
   `mixin-truncate-line`,
   `mixin-card-elevation`,
   `mixin-scroll-snap-x`.
- Bad:
   `mixin-card`,
   `mixin-header`,
   `mixin-product-tile`.

Style-named mixins fragment as soon as a non-card needs the elevation;
the mixin name should describe the behaviour so it composes.

## Nesting depth and state attributes

Native CSS nesting only.
Shallow depth,
 3 levels maximum:

```css
.card {
  & .title {
    font-weight: 600;

    & .badge {
      /* level 3, stop here */
    }
  }
}
```

Deeper nesting becomes unreadable in the rendered selector
and harder to override.

Use data attributes for state and variant styling,
 not BEM modifiers:

```css
/* Wrong */
.card--featured {
  /* ... */
}
.card__title--large {
  /* ... */
}

/* Right */
.card[data-featured] {
  /* ... */
}
.card[data-size='large'] .title {
  /* ... */
}
```

Data attributes are queryable from JavaScript without string manipulation
and do not require coordinated class-name updates across markup and CSS.

## Quality check before submitting CSS

- All sizes in `rem` (or `calc()` of `rem`);
   no `px` outside device-pixel contexts.
- Logical properties for every margin,
   padding,
   inset,
   and text-align.
- No forbidden shorthands (`margin`,
   `padding`,
   `border`,
   `background`).
- All colors from `var(--color-*)`;
   no literals.
- No `!important`.
- `:focus-visible` styled on every interactive element.
- Touch targets meet the 48px minimum via `min-inline-size`/`min-block-size`.
- Nesting depth 3 or fewer.
- State and variant styling uses `[data-*]`,
   not BEM modifiers.

If any item is unmet,
 fix before merging.
