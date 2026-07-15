# Non-essential CSS to strip

Audit of `dist/styles.css` after the first round of fixes
(@font-face additions,
 inline link revert,
 post-card bare-bones,
 theme-toggle label sizing,
Material Symbols cleanup,
 double-calc fix).

Everything listed below is decorative,
 defensive,
 or redundant.
Removing it will not break functionality or basic readability.

## `.material-symbols-outlined` (`icons.ts:77-86`)

- `font-weight: normal`:
   defensive;
   icons aren't inside bold contexts in current markup
- `font-style: normal`:
   defensive;
   icons aren't inside italic contexts
- `white-space: nowrap`:
   defensive;
   ligature text won't wrap at icon font-size

## `pre` (`global.ts:155-162`)

- `border-radius: 0.5rem`:
   decorative rounding

## `:focus-visible` (`global.ts:209-215`)

- `outline-offset`:
   decorative;
   default `0` is fine

## `site-header header` (`site-header.ts:40-51`)

- `border-block-end-style: solid`:
   decorative separator
- `border-block-end-width`:
   decorative separator
- `border-block-end-color`:
   decorative separator

After removing these,
 the `BORDER_WIDTH_REM` import from `site-header.ts` becomes unused.

## `site-header .brand` (`site-header.ts:53-72`)

- `font-weight: 600`:
   decorative emphasis

## `theme-toggle label` (`theme-toggle.ts:68-76`)

- `cursor: pointer`:
   UX hint,
   not functional

## `site-search .search-icon` (`site-search.ts:70-83`)

- `transition-property: justify-content`:
   animation polish
- `transition-duration: 0.25s`:
   animation polish
- `transition-timing-function: ease-out`:
   animation polish

## `site-search .search-input` (`site-search.ts:85-150`)

Collapsed state:

- `border-radius: 1.5rem`:
   decorative rounding
- `font-size: 1rem`:
   browser default for inputs
- `cursor: pointer`:
   UX hint
- `transition-property` (5-item comma list):
   animation polish
- `transition-duration: 0.25s`:
   animation polish
- `transition-timing-function: ease-out`:
   animation polish

`&:focus` state:

- `cursor: text`:
   UX hint
- `outline-color`:
   redundant;
   global `:focus-visible` already applies,
   plus border change signals focus
- `outline-style`:
   redundant
- `outline-width`:
   redundant
- `outline-offset`:
   redundant

`&::placeholder`:

- `transition-property: color`:
   animation polish
- `transition-duration: 0.25s`:
   animation polish

## `site-search .search-results` (`site-search.ts:151-225`)

Container:

- `border-radius: 0.5rem`:
   decorative rounding
- `box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.1)`:
   decorative depth

Children:

- `.search-title { font-weight: 600 }`:
   decorative emphasis
- `.search-excerpt { font-size: 0.875rem }`:
   decorative hierarchy
- `.search-excerpt { color: var(--color-muted) }`:
   decorative color
- `.search-excerpt { margin-block-start: 0.25rem }`:
   decorative spacing
- `mark { font-weight: 600 }`:
   decorative emphasis

## `post-card` children (`post-card.ts:55-97`)

- `h2 { margin-block-end: 0.5rem }`:
   decorative spacing preference
- `h2 { font-size: 1.25rem }`:
   decorative sizing;
   browser default h2 is fine
- `.description { color: var(--color-muted) }`:
   decorative muted color
- `.date { font-size: 0.875rem }`:
   decorative sizing
- `.date { color: var(--color-subtle) }`:
   decorative color
- `.tag-link` rule entirely (`font-size: 0.875rem; color: var(--color-subtle)`):
   decorative;
   remove the whole rule

## Cleanup after stripping

Constants in `constants.ts` that become unused:

- `FONT_SIZE_H2` (only used by post-card h2 font-size)
- `FONT_SIZE_SMALL` (only used by post-card date,
   tag-link,
   search-excerpt)
- `FULL_WIDTH` (not referenced anywhere currently)

Imports to clean up:

- `site-header.ts`:
   remove `BORDER_WIDTH_REM`,
   `cssCalc` if header border is stripped
- `post-card.ts`:
   remove `FONT_SIZE_H2`,
   `FONT_SIZE_SMALL`,
   `GAP_SMALL` if h2/date/tag-link styles are stripped
- `site-search.ts`:
   remove `FONT_SIZE_SMALL` if search-excerpt font-size is stripped;
   remove `CssValue` type if all `as CssValue` transitions are stripped
- `icons.ts`:
   remove `CssValue` type import if font-weight/font-style casts are stripped

## Total

47 declarations across 18 rules,
 plus 3 unused constants.
