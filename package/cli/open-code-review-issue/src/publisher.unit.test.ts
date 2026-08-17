import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  publishIssues,
  type GitHubApiClient,
  type RenderedIssue,
} from '../dist/final/node/index.mjs';

await describe({
  name: publishIssues.name,
  children: [
    it({
      name: 'creates Issues serially with pacing between mutations',
      fn: async () => {
        /**
         * Create request titles observed by fake API.
         */
        const createdTitles: string[] = [];
        /**
         * Requested pacing delays.
         */
        const waits: number[] = [];
        /**
         * Next synthetic Issue number.
         */
        let nextNumber = 1;
        /**
         * Fake GitHub API for high-water reads and successful creates.
         */
        const api: GitHubApiClient = async (request,) => {
          if (request.method === 'GET') {
            return {
              status: 200,
              headers: {},
              body: [],
            };
          }
          /**
           * Create request body required by publisher.
           */
          const body = request.body;
          if (body === undefined || typeof body.title !== 'string') {
            throw new Error('missing create title',);
          }
          createdTitles.push(body.title,);
          /**
           * Number allocated to current fake Issue.
           */
          const number = nextNumber;
          nextNumber += 1;
          return {
            status: 201,
            headers: {},
            body: {
              number,
              html_url: `https://github.com/Aquaticat/issues-api/issues/${String(number,)}`,
            },
          };
        };
        /**
         * Two complete rendered Issue requests.
         */
        const issues: readonly RenderedIssue[] = [
          {
            position: { kind: 'record', value: 1, },
            security: false,
            title: 'First',
            body: 'First body',
            labels: ['needs-triage',],
          },
          {
            position: { kind: 'record', value: 2, },
            security: false,
            title: 'Second',
            body: 'Second body',
            labels: ['needs-triage',],
          },
        ];

        expect(await publishIssues({
          repository: {
            owner: 'Aquaticat',
            name: 'issues-api',
            url: 'https://github.com/Aquaticat/issues-api',
          },
          issues,
          api,
          wait: async (milliseconds,) => {
            waits.push(milliseconds,);
          },
        },),).toStrictEqual({
          created: [
            {
              position: { kind: 'record', value: 1, },
              number: 1,
              url: 'https://github.com/Aquaticat/issues-api/issues/1',
            },
            {
              position: { kind: 'record', value: 2, },
              number: 2,
              url: 'https://github.com/Aquaticat/issues-api/issues/2',
            },
          ],
        },);
        expect(createdTitles,).toStrictEqual(['First', 'Second',],);
        expect(waits,).toStrictEqual([1_000,],);
      },
    },),
  ],
},);
