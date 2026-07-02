# wc

Generates a single self-contained HTML file that computes text statistics
and word frequency live in the browser, with no server and no network
requests after the page loads.

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

The build script reads pre-bundled client JS from `dist/client/main.js`,
then inlines HTML (via `h-html`), CSS (via `h-css`), and JS into a single
`dist/final/index.html` file. `src/stats/` holds the pure, framework-free
tokenization and analysis logic (unit tested independently of the DOM);
`src/client/main.ts` wires a debounced `input` listener on the textarea to
that logic and writes results into the page.

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
