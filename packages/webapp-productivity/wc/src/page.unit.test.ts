/**
 * Tests for the complete HTML document assembly.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { renderPage, } from './page.ts';

await describe({
  name: renderPage.name,
  children: [
    it({
      name: 'inlines the given CSS and JS into the document',
      fn: async function inlinesCssAndJs(): Promise<void> {
        /**
         * Complete document rendered from fixture CSS/JS strings.
         */
        const html = renderPage(
          {
            css: 'body{color:red}',
            js: 'console.log(1)',
          },
        );

        expect(html.startsWith('<!DOCTYPE html>',),).toBe(true,);
        expect(html,).toContain('<style>body{color:red}</style>',);
        expect(html,).toContain('<script type="module">console.log(1)</script>',);
      },
    },),
    it({
      name: 'includes the input textarea and the frequency body rowgroup',
      fn: async function includesInputAndFrequencyBody(): Promise<void> {
        /**
         * Complete document rendered from empty CSS/JS strings.
         */
        const html = renderPage(
          {
            css: '',
            js: '',
          },
        );

        expect(html,).toContain('id="wc-input"',);
        expect(html,).toContain('id="frequency-body"',);
      },
    },),
    it({
      name: 'marks the frequency section up as an ARIA table, not a native table',
      fn: async function usesAriaTableRoles(): Promise<void> {
        /**
         * Complete document rendered from empty CSS/JS strings.
         */
        const html = renderPage(
          {
            css: '',
            js: '',
          },
        );

        expect(html,).toContain('role="table"',);
        expect(html,).toContain('role="rowgroup"',);
        expect(html,).toContain('role="columnheader"',);
        expect(html,).not
          .toContain('<table',);
      },
    },),
    it({
      name: 'orders frequency column headers as Count, %, Word',
      fn: async function ordersColumnHeaders(): Promise<void> {
        /**
         * Complete document rendered from empty CSS/JS strings.
         */
        const html = renderPage(
          {
            css: '',
            js: '',
          },
        );

        /**
         * Index of the Count header inside the document.
         */
        const countIndex = html.indexOf('>Count</span>',);
        /**
         * Index of the % header inside the document.
         */
        const pctIndex = html.indexOf('>%</span>',);
        /**
         * Index of the Word header inside the document.
         */
        const wordIndex = html.indexOf('>Word</span>',);

        expect(countIndex,).toBeGreaterThan(0,);
        expect(pctIndex,).toBeGreaterThan(countIndex,);
        expect(wordIndex,).toBeGreaterThan(pctIndex,);
      },
    },),
    it({
      name: 'wraps content in a viewport-filling page scaffold with a masthead',
      fn: async function wrapsInPageScaffold(): Promise<void> {
        /**
         * Complete document rendered from empty CSS/JS strings.
         */
        const html = renderPage(
          {
            css: '',
            js: '',
          },
        );

        expect(html,).toContain('class="page"',);
        expect(html,).toContain('class="masthead"',);
        expect(html,).toContain('<h1>wc</h1>',);
        expect(html,).toContain('<title>wc: text stats</title>',);
      },
    },),
  ],
},);
