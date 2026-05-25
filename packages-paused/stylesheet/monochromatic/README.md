# stylesheet-monochromatic

Design system stylesheet for Monochromatic web applications.

## What it provides

- **CSS reset** via [the-new-css-reset](https://github.com/elad2412/the-new-css-reset)
- **Design tokens**: color palette (light/dark with `prefers-color-scheme`),
  typography scale (h1--h6, paragraph), spacing lengths, and font stacks
- **Reusable mixins**: `--sr-only`, `--touch-target`, `--flex-center`, heading styles,
  `--text` (full prose formatting), `--mono`, `--button-text`
- **Global styles**: `color-scheme`, smooth scrolling, `font-variant-numeric`,
  box-sizing, accent/caret colors, counter styles (`dash`, `wave`)
- **TODS** integration for typographic defaults
- **Fallback styles** for progressive enhancement

## Color system

Eight base colors (`--light-lighter` through `--dark-darker`, `--subtle`, `--primary`)
mapped to semantic aliases (`--fg`, `--bg`, `--fg-stronger`, etc.) that automatically
invert in dark mode.

## Usage

```css
@import '@monochromatic-dev/stylesheet-monochromatic/index.css';
```

Import individual layers:

```css
@import '@monochromatic-dev/stylesheet-monochromatic/mixin.css';
```
