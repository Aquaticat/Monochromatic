import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  renderIssue,
  type NormalizedFinding,
} from '../dist/final/node/index.mjs';

await describe({
  name: renderIssue.name,
  children: [
    it({
      name: 'renders the complete deterministic Issue contract',
      fn: async () => {
        /**
         * Finding carrying every rendered section and raw Markdown prose.
         */
        const finding: NormalizedFinding = {
          position: {
            kind: 'record',
            value: 1,
          },
          path: 'src/example.ts',
          content: '## Preserve this heading\n\nNotify @maintainer.',
          existingCode: 'return value + 1;\n',
          suggestionCode: 'return value;\n',
          startLine: 4,
          endLine: 5,
          category: 'bug',
          severity: 'high',
        };

        /**
         * Fully rendered Issue draft without destination label.
         */
        const issue = renderIssue({
          finding,
          needsTriageLabel: false,
        },);

        expect(issue,).toStrictEqual({
          position: {
            kind: 'record',
            value: 1,
          },
          security: false,
          title: '[needs-triage] [bug] src/example.ts: ## Preserve this heading',
          body: [
            '## Finding',
            '',
            '## Preserve this heading',
            '',
            'Notify @maintainer.',
            '',
            '## Source',
            '',
            '- Location: src/example.ts:4-5',
            '- Category: `bug`',
            '- Severity: `high`',
            '',
            '## Existing code',
            '',
            '    return value + 1;',
            '    ',
            '',
            '## Suggested code',
            '',
            '    return value;',
            '    ',
            '',
            '## OpenCodeReview',
            '',
            'Generated from OpenCodeReview structured output.',
          ].join('\n',),
          labels: [],
        },);
      },
    },),
  ],
},);
