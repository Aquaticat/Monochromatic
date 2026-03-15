/**
 * Collapsible detail sections for probe overlays.
 *
 * Renders reasoning traces, responses, fix prompts, and config
 * as `<details>` elements that can be expanded to inspect run internals.
 */
import { micromark, } from 'micromark';

import { $ as h, } from '@monochromatic-dev/module-es/h-html';

import type { ConfigSnapshot, ProbeDetail, } from '../data/viewer-types.ts';

import { formatNumber, } from './overlay-meta.ts';

/**
 * Renders collapsible detail sections for reasoning, fix prompt, and config.
 * Sections with no data are omitted entirely.
 *
 * @param detail - probe detail
 *
 * @returns HTML string with `<details>` elements
 *
 * @example
 * ```ts
 * renderCollapsibles(detail);
 * // '<details class="collapsible-section">...'
 * ```
 */
export function renderCollapsibles(detail: ProbeDetail): string {
  const sections: string[] = [];

  if (detail.reasoning !== undefined && detail.reasoning !== '') {
    sections.push(h({
      tag: 'details',
      class: 'collapsible-section',
      children: [
        h({ tag: 'summary', text: `Thinking (${formatNumber(detail.reasoning.length)} chars)`, }),
        h({ tag: 'div', class: 'rendered-markdown', html: micromark(detail.reasoning), }),
      ],
    }));
  }

  if (detail.initialResponse !== undefined && detail.initialResponse !== '') {
    sections.push(h({
      tag: 'details',
      class: 'collapsible-section',
      children: [
        h({ tag: 'summary', text: `Response (${formatNumber(detail.initialResponse.length)} chars)`, }),
        h({ tag: 'div', class: 'rendered-markdown', html: micromark(detail.initialResponse), }),
      ],
    }));
  }

  if (detail.fixReasoning !== undefined && detail.fixReasoning !== '') {
    sections.push(h({
      tag: 'details',
      class: 'collapsible-section',
      children: [
        h({ tag: 'summary', text: `Fix thinking (${formatNumber(detail.fixReasoning.length)} chars)`, }),
        h({ tag: 'div', class: 'rendered-markdown', html: micromark(detail.fixReasoning), }),
      ],
    }));
  }

  if (detail.fixResponse !== undefined && detail.fixResponse !== '') {
    sections.push(h({
      tag: 'details',
      class: 'collapsible-section',
      children: [
        h({ tag: 'summary', text: `Fix response (${formatNumber(detail.fixResponse.length)} chars)`, }),
        h({ tag: 'div', class: 'rendered-markdown', html: micromark(detail.fixResponse), }),
      ],
    }));
  }

  if (detail.fixPrompt !== undefined && detail.fixPrompt !== '') {
    sections.push(h({
      tag: 'details',
      class: 'collapsible-section',
      children: [
        h({ tag: 'summary', text: 'Fix prompt', }),
        h({ tag: 'div', class: 'rendered-markdown', html: micromark(detail.fixPrompt), }),
      ],
    }));
  }

  if (detail.config !== undefined) {
    sections.push(renderConfig(detail.config));
  }

  return sections.join('\n');
}

/**
 * Renders a collapsible config snapshot section.
 *
 * @param config - runner configuration snapshot
 *
 * @returns HTML `<details>` element
 */
function renderConfig(config: ConfigSnapshot): string {
  return h({
    tag: 'details',
    class: 'collapsible-section',
    children: [
      h({ tag: 'summary', text: 'Config', }),
      h({
        tag: 'dl',
        class: 'metadata-grid',
        children: [
          h({ tag: 'dt', text: 'Verbosity', }),
          h({ tag: 'dd', text: config.verbosity, }),
          h({ tag: 'dt', text: 'Reasoning', }),
          h({ tag: 'dd', text: String(config.reasoning), }),
          h({ tag: 'dt', text: 'Max tokens', }),
          h({ tag: 'dd', text: formatNumber(config.maxTokens), }),
          h({ tag: 'dt', text: 'Consistency runs', }),
          h({ tag: 'dd', text: String(config.consistencyRuns), }),
        ],
      }),
    ],
  });
}
