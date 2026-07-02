/**
 * HTML document structure for the wc text-stats tool.
 *
 * Uses h-html to produce a self-contained page with inlined CSS and
 * JavaScript: an input textarea, a Stats definition list (`./page-stats.ts`),
 * and a Frequency table, both populated live by the client script.
 */
import { hHtml as h, } from '@monochromatic-dev/module-hyperscript/ts';

import { renderStatsSection, } from './page-stats.ts';

export {
  STAT_ROWS,
  type StatRow,
} from './page-stats.ts';

/**
 * Renders the input panel: a label and a textarea the client script reads
 * text from.
 *
 * @returns HTML string for the input panel
 */
function renderInputPanel(): string {
  return h(
    {
      tag: 'div',
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
 * Renders the Frequency section: a heading and an empty table body the
 * client script fills with word-frequency rows.
 *
 * @returns HTML string for the Frequency section
 */
function renderFrequencySection(): string {
  return h(
    {
      tag: 'section',
      children: [
        h(
          {
            tag: 'h2',
            text: 'Frequency',
          },
        ),
        h(
          {
            tag: 'table',
            attrs: { class: 'frequency', },
            children: [
              h(
                {
                  tag: 'thead',
                  children: [
                    h(
                      {
                        tag: 'tr',
                        children: [
                          h(
                            {
                              tag: 'th',
                              text: 'Word',
                            },
                          ),
                          h(
                            {
                              tag: 'th',
                              text: 'Count',
                            },
                          ),
                          h(
                            {
                              tag: 'th',
                              text: '%',
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
                  tag: 'tbody',
                  attrs: { id: 'frequency-body', },
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
 * Renders the complete HTML document with all content inlined, combining
 * {@link renderInputPanel}, {@link renderStatsSection}
 * (`./page-stats.ts`), and {@link renderFrequencySection}.
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
                    text: 'wc — text stats',
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
