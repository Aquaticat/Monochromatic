import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  aggregateParsedReports,
  mutationScore,
  parseStatus,
} from '../dist/final/node/index.mjs';

await describe({
  name: parseStatus.name,
  children: [
    it({
      name: 'maps unknown statuses to runtime errors',
      fn: async () => {
        expect(parseStatus('Killed',),).toBe('Killed',);
        expect(parseStatus('Mystery',),).toBe('RuntimeError',);
      },
    },),
  ],
},);

await describe({
  name: mutationScore.name,
  children: [
    it({
      name: 'weights by raw mutant counts and excludes compile errors from denominator',
      fn: async () => {
        expect(mutationScore({
          killed: 1,
          survived: 1,
          timeout: 0,
          compileError: 100,
          runtimeError: 0,
          noCoverage: 0,
          ignored: 0,
        },),).toBe(50,);
      },
    },),
  ],
},);

await describe({
  name: aggregateParsedReports.name,
  children: [
    it({
      name: 'aggregates raw statuses and lists survivors by file',
      fn: async () => {
        const aggregate = aggregateParsedReports([
          {
            path: 'one.json',
            json: {
              files: {
                'src/a.ts': {
                  mutants: [
                    {
                      id: '1',
                      status: 'Killed',
                      mutatorName: 'StringLiteral',
                      replacement: '""',
                      location: { start: { line: 1, column: 0, }, },
                    },
                    {
                      id: '2',
                      status: 'Survived',
                      mutatorName: 'BooleanLiteral',
                      replacement: 'false',
                      description: 'replaced true with false',
                      location: { start: { line: 2, column: 1, }, end: { line: 2, column: 5, }, },
                    },
                  ],
                },
              },
            },
          },
        ],);

        expect(aggregate.totals.killed,).toBe(1,);
        expect(aggregate.totals.survived,).toBe(1,);
        expect(aggregate.score,).toBe(50,);
        expect(aggregate.findings,).toHaveLength(1,);
        expect(aggregate.findings[0]?.file,).toBe('src/a.ts',);
        expect(aggregate.findings[0]?.location,).toBe('2:1-2:5',);
      },
    },),
  ],
},);
