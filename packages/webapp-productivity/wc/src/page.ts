/**
 * HTML document structure for the wc text-stats tool.
 *
 * Uses h-html to produce a self-contained page with inlined CSS and
 * JavaScript: a viewport-filling flex column holding a masthead, an input
 * textarea, six stat tiles (`./page-stats.ts`), and a Frequency section
 * marked up as flex rows with ARIA table roles so per-row
 * `content-visibility: auto` works (`content-visibility` is ignored on
 * internal table boxes like `tr`).
 */
import { hHtml as h, } from '@monochromatic-dev/module-hyperscript/ts';

import { renderStatsSection, } from './page-stats.ts';

export {
  STAT_FIELDS,
  STAT_TILES,
  type StatField,
  type StatSub,
  type StatTile,
} from './page-stats.ts';

/**
 * Renders the input panel: a label and a textarea the client script reads
 * text from. The textarea flexes to fill the remaining viewport height
 * and auto-grows with content via the client script.
 *
 * @returns HTML string for the input panel
 */
function renderInputPanel(): string {
  return h(
    {
      tag: 'section',
      attrs: { class: 'input-panel', },
      children: [
        h(
          {
            tag: 'label',
            attrs: { for: 'wc-input', },
            text: 'Text to analyze',
          },
        ),
        h(
          {
            tag: 'textarea',
            attrs: {
              id: 'wc-input',
              placeholder: 'Paste or type text here…',
            },
          },
        ),
      ],
    },
  );
}

/**
 * Renders the Frequency column-header row. The trailing bar column is
 * decorative, so its header stays empty.
 *
 * @returns HTML string for the header row
 */
function renderFrequencyHead(): string {
  return h(
    {
      tag: 'div',
      class: 'frequency-row frequency-head',
      attrs: { role: 'row', },
      children: [
        h(
          {
            tag: 'span',
            class: 'freq-count',
            attrs: { role: 'columnheader', },
            text: 'Count',
          },
        ),
        h(
          {
            tag: 'span',
            class: 'freq-pct',
            attrs: { role: 'columnheader', },
            text: '%',
          },
        ),
        h(
          {
            tag: 'span',
            class: 'freq-word',
            attrs: { role: 'columnheader', },
            text: 'Word',
          },
        ),
        h(
          {
            tag: 'span',
            class: 'freq-bar-track',
            attrs: { role: 'columnheader', },
          },
        ),
      ],
    },
  );
}

/**
 * Renders the Frequency section: a heading and an ARIA table (flex rows,
 * not a native `<table>`, so per-row `content-visibility: auto` takes
 * effect) whose body rowgroup the client script fills with
 * word-frequency rows.
 *
 * @returns HTML string for the Frequency section
 */
function renderFrequencySection(): string {
  return h(
    {
      tag: 'section',
      class: 'frequency-section',
      children: [
        h(
          {
            tag: 'h2',
            text: 'Frequency',
          },
        ),
        h(
          {
            tag: 'div',
            class: 'frequency',
            attrs: {
              role: 'table',
              'aria-label': 'Word frequency',
            },
            children: [
              h(
                {
                  tag: 'div',
                  attrs: { role: 'rowgroup', },
                  children: [renderFrequencyHead(),],
                },
              ),
              h(
                {
                  tag: 'div',
                  attrs: {
                    id: 'frequency-body',
                    role: 'rowgroup',
                  },
                },
              ),
            ],
          },
        ),
      ],
    },
  );
}

/**
 * Renders the masthead: the tool name and a one-line description.
 *
 * @returns HTML string for the masthead
 */
function renderMasthead(): string {
  return h(
    {
      tag: 'header',
      class: 'masthead',
      children: [
        h(
          {
            tag: 'h1',
            text: 'wc',
          },
        ),
        h(
          {
            tag: 'p',
            attrs: { class: 'description', },
            text:
              'Byte, character, line, word, sentence, and paragraph statistics, plus word frequency, computed live in the browser as you type.',
          },
        ),
      ],
    },
  );
}

/**
 * Renders the complete HTML document with all content inlined, combining
 * {@link renderMasthead}, {@link renderInputPanel},
 * {@link renderStatsSection} (`./page-stats.ts`), and
 * {@link renderFrequencySection}.
 *
 * @param css - CSS stylesheet string
 *
 * @param js - client-side JavaScript string
 *
 * @returns complete HTML document string
 *
 * @example
 * ```ts
 * const html = renderPage({ css: 'body {}', js: 'console.log("ok")' });
 * ```
 */
export function renderPage(
  {
    css,
    js,
  }: Readonly<{
    css: string;
    js: string;
  }>,
): string {
  return `<!DOCTYPE html>\n${
    h(
      {
        tag: 'html',
        attrs: { lang: 'en', },
        children: [
          h(
            {
              tag: 'head',
              children: [
                h(
                  {
                    tag: 'meta',
                    attrs: { charset: 'utf8', },
                  },
                ),
                h(
                  {
                    tag: 'meta',
                    attrs: {
                      name: 'viewport',
                      content: 'width=device-width, initial-scale=1',
                    },
                  },
                ),
                h(
                  {
                    tag: 'title',
                    text: 'wc: text stats',
                  },
                ),
                h(
                  {
                    tag: 'style',
                    html: css,
                  },
                ),
              ],
            },
          ),
          h(
            {
              tag: 'body',
              children: [
                h(
                  {
                    tag: 'div',
                    attrs: { class: 'page', },
                    children: [
                      renderMasthead(),
                      h(
                        {
                          tag: 'div',
                          attrs: { class: 'layout', },
                          children: [
                            renderInputPanel(),
                            h(
                              {
                                tag: 'div',
                                attrs: { class: 'results-panel', },
                                children: [
                                  renderStatsSection(),
                                  renderFrequencySection(),
                                ],
                              },
                            ),
                          ],
                        },
                      ),
                    ],
                  },
                ),
                h(
                  {
                    tag: 'script',
                    attrs: { type: 'module', },
                    html: js,
                  },
                ),
              ],
            },
          ),
        ],
      },
    )
  }`;
}
