import { readFile, } from 'node:fs/promises';

import { $ as h, } from '@monochromatic-dev/module-es/h-html';
import clientCss from './index.css' with { type: 'text' };
import { l, } from './log.ts';

l.debug(`asset module loading`);

/**
 * CSS source for the exa-search interface.
 * Imported at build time via static asset import.
 * @see {@link indexHtml} for where it is inlined into the page
 */
export const css: string = clientCss;

/**
 * Bundled client-side JavaScript for the exa-search interface.
 * Pre-built by tsdown via `mise run build:js:client` and read from disk at startup.
 * @see {@link indexHtml} for where it is inlined into the page
 */
export const js: string = await readFile('./dist/client/client.js', 'utf8',);

/** Escaped JS source safe for embedding inside a `<script>` tag. */
const safeJs: string = js.replaceAll(/<\/script>/gvi, '<\\/script>',);

//region HTML structure -- Declarative page composition via h-html

/**
 * Builds the search result template element rendered once and cloned by client JS.
 * @returns HTML string for a single result `<li>` with all sub-elements
 */
function buildResultTemplate(): string {
  return h({
    tag: 'li',
    class: 'result',
    attrs: { hidden: '', },
    children: [
      h({
        tag: 'div',
        class: 'result__header',
        children: [
          h({ tag: 'img', class: 'result__favicon', attrs: { src: '', alt: '', }, },),
          h({
            tag: 'h2',
            class: 'result__title',
            children: [
              h({
                tag: 'a',
                class: 'result__link',
                attrs: { href: '#', target: '_blank', rel: 'noopener noreferrer', },
              },),
            ],
          },),
          h({
            tag: 'address',
            class: 'result__author',
            children: [
              h({ tag: 'time', class: 'result__publishedDate', },),
            ],
          },),
        ],
      },),
      h({
        tag: 'div',
        class: 'result__body',
        children: [
          h({
            tag: 'div',
            class: 'result__texturalContent',
            children: [
              h({
                tag: 'details',
                children: [
                  h({
                    tag: 'summary',
                    children: [
                      h({ tag: 'p', class: 'result__summary', },),
                    ],
                  },),
                  h({ tag: 'p', class: 'result__text', },),
                ],
              },),
              h({
                tag: 'ul',
                class: 'result__highlights',
                children: [
                  h({ tag: 'li', class: 'result__highlight', },),
                ],
              },),
            ],
          },),
          h({ tag: 'img', class: 'result__image', attrs: { src: '', alt: '', }, },),
        ],
      },),
    ],
  },);
}

/**
 * Builds the status section with metrics, processing, success, and error indicators.
 * @returns HTML string for the status `<section>`
 */
function buildStatusSection(): string {
  return h({
    tag: 'section',
    class: 'status',
    children: [
      h({
        tag: 'p',
        class: 'metrics',
        attrs: { hidden: '', },
        html: `${h({ tag: 'span', class: 'number numTotalSearches', text: '0', },)} searches total`,
      },),
      h({ tag: 'p', class: 'processing', attrs: { hidden: '', }, text: 'Searching', },),
      h({
        tag: 'p',
        class: 'success',
        attrs: { hidden: '', },
        html: [
          h({ tag: 'span', class: 'number', },),
          ' results in ',
          h({ tag: 'span', class: 'number', },),
          ' costing ',
          h({ tag: 'span', class: 'number costDollars', },),
          ' USD',
        ].join('',),
      },),
      h({
        tag: 'p',
        class: 'fail',
        attrs: { hidden: '', },
        html: `Error: ${h({ tag: 'span', class: 'message', },)}`,
      },),
    ],
  },);
}

/**
 * Builds the search form inside a `<search>` landmark element.
 * @returns HTML string for the search form
 */
function buildSearchForm(): string {
  return h({
    tag: 'search',
    children: [
      h({
        tag: 'form',
        class: 'searchForm',
        children: [
          h({
            tag: 'label',
            attrs: { for: 'search', 'data-sr-only': '', },
            text: 'Search with Exa',
          },),
          h({
            tag: 'input',
            attrs: {
              type: 'text',
              placeholder: 'Search with Exa',
              autocomplete: 'off',
              autofocus: '',
              id: 'search',
            },
          },),
          h({ tag: 'button', class: 'search-button', attrs: { type: 'submit', }, text: 'Search', },),
        ],
      },),
    ],
  },);
}

/**
 * Builds the page header with logo and nav controls.
 * @returns HTML string for the `<header>`
 */
function buildHeader(): string {
  return h({
    tag: 'header',
    class: 'header',
    children: [
      h({ tag: 'h1', class: 'logo', text: 'Unofficial Exa Search', },),
      h({
        tag: 'nav',
        class: 'headerNav',
        children: [
          h({
            tag: 'div',
            class: 'apiKey',
            children: [
              h({
                tag: 'button',
                class: 'changeApiKey',
                attrs: { type: 'button', },
                text: 'Change API Key',
              },),
              h({ tag: 'dialog', class: 'setApiKey', },),
            ],
          },),
          h({
            tag: 'div',
            class: 'numResults',
            children: [
              h({
                tag: 'label',
                html: [
                  'request ',
                  h({
                    tag: 'input',
                    attrs: { type: 'number', name: 'numResults', value: '10', max: '100', min: '1', },
                  },),
                  ' results',
                ].join('',),
              },),
            ],
          },),
        ],
      },),
    ],
  },);
}

/**
 * Complete self-contained HTML page with inlined CSS and JS.
 * Composed declaratively via h-html; served as the response for every GET / request.
 * @see {@link css} for the inlined stylesheet
 * @see {@link js} for the inlined client bundle
 */
export const indexHtml: string = [
  '<!DOCTYPE html>',
  h({
    tag: 'html',
    attrs: { lang: 'en', },
    children: [
      h({
        tag: 'head',
        children: [
          h({ tag: 'meta', attrs: { charset: 'UTF-8', }, },),
          h({ tag: 'meta', attrs: { name: 'viewport', content: 'width=device-width, initial-scale=1.0', }, },),
          h({ tag: 'title', text: 'Exa Search', },),
          h({ tag: 'style', html: css, },),
          h({ tag: 'script', attrs: { type: 'module', }, html: safeJs, },),
        ],
      },),
      h({
        tag: 'body',
        children: [
          buildHeader(),
          h({
            tag: 'main',
            class: 'main',
            children: [
              buildSearchForm(),
              buildStatusSection(),
              h({
                tag: 'ol',
                class: 'results',
                attrs: { hidden: '', },
                children: [buildResultTemplate(),],
              },),
            ],
          },),
        ],
      },),
    ],
  },),
].join('',);

//endregion HTML structure

l.debug(`asset module loaded, css ${css.length} chars, js ${js.length} chars`);
