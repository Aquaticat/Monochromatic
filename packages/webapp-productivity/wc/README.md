# wc

Generates a single self-contained HTML file that computes text statistics
and word frequency live in the browser, with no server and no network
requests after the page loads.

## Design

- **Palette**: strictly five opaque grayscale stops, `oklch(L 0 0)` for L
  in 0, 0.1, 0.5, 0.9, 1. No other lightness values, no alpha; subtlety
  comes from adjacent stops (0.9 surfaces on a 1 background in light mode,
  0 surfaces on a 0.1 background in dark mode). A unit test scans the
  palette fragments and rejects any other `oklch()` value.
- **Type**: everything renders in Inter (variable, weights 100 to 900),
  auto-subsetted (see the fonts section) and inlined as a woff2 data URI.
  Frequency numbers use tabular numerals; tile headline numbers keep
  Inter's default proportional figures.
- **Layout**: flexbox only; CSS grid is not allowed in this package. At
  wide viewports the input sits beside a sticky results column; below
  64rem they stack. The input box prefers 100% of its column, clamped
  between `min(60ch, 100%)` and `90ch`.
- **Stats**: six tiles. Lines, words, sentences, and paragraphs pair
  their headline count with a "longest" sub-stat (max line/word length in
  chars, max sentence length in words, max paragraph length in
  sentences); bytes and chars stand alone.
- **Frequency rows**: flex rows with ARIA table roles instead of a native
  `<table>`, because `content-visibility: auto` (used to keep unbounded
  row counts cheap) is ignored on internal table boxes like `tr`. Counts
  and percentages come first, padded with figure spaces (U+2007) so the
  columns align purely through tabular numerals, with no column-width
  CSS. Each row ends in a fixed-width bar track (equal tracks keep bar
  lengths comparable); bars carry a mid-stop border so even the smallest
  bar stays visible.

### Known limitations

- Hard linebreaks render at the same height as soft-wrapped lines. Giving
  true linebreaks taller spacing requires per-line styling, which a
  native `<textarea>` cannot do (that needs a contenteditable editor);
  keeping the textarea was the chosen trade.
- The textarea's growth is scripted (an `input` listener raises
  `min-block-size` to the scroll height) because `field-sizing: content`
  is missing from the Firefox ESR baseline. Without JavaScript the box
  stays at its viewport-filling flex size and scrolls internally.
- User text in scripts outside the embedded subset (the charset is page
  chrome plus printable ASCII) falls back to `system-ui`; only page
  chrome is guaranteed to render in Inter.

## Fonts

The full upstream Inter variable woff2 lives in `fonts-source/`
(committed, never shipped). `mise run format:fonts` runs
`src/subset-fonts.ts`, which collects the charset from every `src/**/*.ts`
file plus a printable-ASCII floor and an explicit figure space (U+2007),
subsets via `hb-subset-wasm` (decode `wawoff2`, re-encode
`woff2-encode-wasm`), and writes `public/inter.woff2`. That subset is
committed, and `src/build.ts` inlines it into the final HTML as a base64
data URI. Re-run `format:fonts` after adding non-ASCII page text (the
scan picks up literal characters, not escape sequences). Inter is
licensed under the SIL OFL 1.1 (`LICENSES/OFL-1.1.txt`).

## What is computed

Paste or type text into the box; a debounced (150ms) recompute updates two
sections.

### Stats

- **Bytes**: UTF-8 encoded byte length.
- **Chars**: grapheme cluster count (`Intl.Segmenter`,
  `granularity: 'grapheme'`), so combining accents and multi-codepoint
  emoji count as one character each, matching what a person would count by
  eye.
- **Lines**: editor-style line count. A single trailing newline does not
  add a phantom empty line (`'a\n'` is 1 line), but a blank line that
  exists before end-of-text still counts (`'a\n\n'` is 2 lines).
- **Max line length**: grapheme cluster length of the longest line.
- **Words**: word-like segments (`Intl.Segmenter`, `granularity: 'word'`,
  `isWordLike` segments only), so CJK text with no spaces between words
  tokenizes correctly and punctuation-only segments are dropped.
- **Max word length**: grapheme cluster length of the longest word.
- **Sentences**: sentence segments (`Intl.Segmenter`,
  `granularity: 'sentence'`), trimmed of surrounding whitespace.
- **Max sentence length**: word count of the longest sentence (the
  standard readability-analysis unit).
- **Paragraphs**: blocks of text separated by one or more blank
  (whitespace-only) lines.
- **Max paragraph length**: sentence count of the longest paragraph.

### Frequency

A table of every word that occurs 2 or more times, case-folded to
lowercase before counting (`The` and `the` count together, displayed as
`the`). Sorted by count descending, ties broken alphabetically. The
percentage is each word's count divided by the total word count in the
text (not just the words shown in the table), to one decimal place. Words
that occur only once are omitted; an input with no repeated words shows a
placeholder row instead of an empty table.

## How it works

The build script reads pre-bundled client JS from `dist/client/main.js`
and the subsetted font from `public/inter.woff2`, then inlines HTML (via
`h-html`), CSS (via `h-css`), JS, and the font into a single
`dist/final/index.html` file. `src/stats/` holds the pure, framework-free
tokenization and analysis logic (unit tested independently of the DOM);
`src/client/main.ts` wires a debounced `input` listener on the textarea to
that logic, writes results into the page, and auto-grows the textarea.

Colors are CSS custom properties with light defaults, overridden inside a
`prefers-color-scheme: dark` media query, so the page follows the OS theme
automatically with no client-side toggle; `color-scheme: light dark` on
`:root` also switches native form-control chrome (the textarea's resize
handle, scrollbars).

## Build

```sh
mise run //packages/webapp-productivity/wc:build
```

This runs `build:js:client` first to bundle `src/client/main.ts` into
`dist/client/main.js`, then runs `src/build.ts` to assemble the final HTML.

Output: `dist/final/index.html`.

## Open

The output is a single self-contained HTML file with no external
dependencies, so any of these works:

```sh
# native browser
xdg-open packages/webapp-productivity/wc/dist/final/index.html

# agent-browser (for AI agents or headless inspection)
agent-browser open file://$PWD/packages/webapp-productivity/wc/dist/final/index.html
```

You can also paste a `file://` URL directly into any browser's address bar.

## Interact

- Type or paste text into the textarea; Stats and Frequency update about
  150ms after you stop typing.
- The Frequency table lists repeated words only, most frequent first.
