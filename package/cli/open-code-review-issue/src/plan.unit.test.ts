import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  buildNonInteractivePreview,
  buildPublicationPlan,
  type NormalizedInput,
} from '../dist/final/node/index.mjs';

await describe({
  name: buildPublicationPlan.name,
  children: [
    it({
      name: 'redacts security content from non-interactive preview',
      fn: async () => {
        /**
         * Mixed input containing ordinary and secret security content.
         */
        const input: NormalizedInput = {
          inputKind: 'comments',
          findings: [
            {
              position: {
                kind: 'record',
                value: 1,
              },
              path: 'src/ordinary.ts',
              content: 'Ordinary finding.',
              existingCode: '',
              suggestionCode: '',
              startLine: 1,
              endLine: 1,
              category: 'bug',
              severity: 'medium',
            },
            {
              position: {
                kind: 'record',
                value: 2,
              },
              path: 'src/private.ts',
              content: 'SECRET SECURITY CONTENT',
              existingCode: 'SECRET EXISTING CODE',
              suggestionCode: '',
              startLine: 7,
              endLine: 8,
              category: 'security',
              severity: 'critical',
            },
          ],
        };

        /**
         * Internal complete publication plan.
         */
        const plan = buildPublicationPlan({
          input,
          repository: 'https://github.com/Aquaticat/issues-api',
          needsTriageLabel: true,
        },);
        /**
         * Machine-readable preview safe for standard output.
         */
        const preview = buildNonInteractivePreview(plan,);

        expect(preview,).toStrictEqual({
          outcome: 'preview',
          repository: 'https://github.com/Aquaticat/issues-api',
          labelStrategy: 'needs-triage-label',
          sourceReference: 'plain',
          issues: [
            {
              position: {
                kind: 'record',
                value: 1,
              },
              title: '[bug] src/ordinary.ts: Ordinary finding.',
              body: [
                '## Finding',
                '',
                'Ordinary finding.',
                '',
                '## Source',
                '',
                '- Location: src/ordinary.ts:1-1',
                '- Category: `bug`',
                '- Severity: `medium`',
                '',
                '## OpenCodeReview',
                '',
                'Generated from OpenCodeReview structured output.',
              ].join('\n',),
              labels: ['needs-triage',],
            },
          ],
          security: {
            count: 1,
            positions: [
              {
                kind: 'record',
                value: 2,
              },
            ],
          },
        },);
        expect(JSON.stringify(preview,),).not.toContain('SECRET',);
      },
    },),
  ],
},);
