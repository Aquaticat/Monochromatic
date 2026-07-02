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

        expect(html,).toContain('class="wc-input"',);
        expect(html,).toContain('class="frequency-body"',);
      },
    },),
    it({
      name: 'nests the textarea inside its label for an implicit association',
      fn: async function nestsTextareaInLabel(): Promise<void> {
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
         * Index of the opening `<label>` tag.
         */
        const labelIndex = html.indexOf('<label class="input-label">',);
        /**
         * Index of the nested textarea, which must fall inside the label
         * (no `for`/`id` pair exists to associate them otherwise).
         */
        const textareaIndex = html.indexOf('<textarea class="wc-input"',);
        /**
         * Index of the label's closing tag.
         */
        const labelCloseIndex = html.indexOf(
          '</label>',
          labelIndex,
        );

        expect(labelIndex,).toBeGreaterThan(-1,);
        expect(textareaIndex,).toBeGreaterThan(labelIndex,);
        expect(labelCloseIndex,).toBeGreaterThan(textareaIndex,);
      },
    },),
    it({
      name: 'never emits an id or an inline style attribute',
      fn: async function omitsIdsAndInlineStyles(): Promise<void> {
        /**
         * Complete document rendered from empty CSS/JS strings.
         */
        const html = renderPage(
          {
            css: '',
            js: '',
          },
        );

        expect(html,).not
          .toContain(' id="',);
        expect(html,).not
          .toContain(' style="',);
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
        expect(html,).not
          .toContain('<table',);
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
