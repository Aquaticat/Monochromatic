import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  memoryBytes,
  parseCliOptions,
  reportNameForSource,
  resolveRequestedSources,
} from '../dist/final/node/index.mjs';

await describe({
  name: parseCliOptions.name,
  children: [
    it({
      name: 'parses package, flags, resources, and source files',
      fn: async () => {
        const options = parseCliOptions([
          '--package',
          'packages/dev-script/file-enforcer',
          '--full-suite',
          '--dry-run-only',
          '--workers',
          '2',
          '--memory',
          '3g',
          '--typescript-performance-mode',
          'src/io/glob.ts',
        ],);

        expect(options.packagePath,).toBe('packages/dev-script/file-enforcer',);
        expect(options.fullSuite,).toBe(true,);
        expect(options.dryRunOnly,).toBe(true,);
        expect(options.workers,).toBe(2,);
        expect(options.memory,).toBe('3g',);
        expect(options.prioritizePerformanceOverAccuracy,).toBe(true,);
        expect(options.sourceFiles,).toEqual(['src/io/glob.ts',],);
      },
    },),
    it({
      name: 'rejects missing package path',
      fails: true,
      fn: async () => {
        parseCliOptions([],);
      },
    },),
  ],
},);

await describe({
  name: 'host utilities',
  children: [
    it({
      name: 'parses memory limits and report names',
      fn: async () => {
        expect(memoryBytes('1g',),).toBe(1024 * 1024 * 1024,);
        expect(memoryBytes('512m',),).toBe(512 * 1024 * 1024,);
        expect(reportNameForSource('src/io/glob.ts',),).toBe('src__io__glob.ts.json',);
      },
    },),
    it({
      name: 'resolves requested sources against dynamic source list',
      fn: async () => {
        expect(resolveRequestedSources({ allSources: ['src/a.ts',], requested: [], },),)
          .toEqual(['src/a.ts',],);
        expect(resolveRequestedSources({ allSources: ['src/a.ts',], requested: ['src/a.ts',], },),)
          .toEqual(['src/a.ts',],);
      },
    },),
    it({
      name: 'rejects requested tests or non-production files',
      fails: true,
      fn: async () => {
        resolveRequestedSources({ allSources: ['src/a.ts',], requested: ['src/a.unit.test.ts',], },);
      },
    },),
  ],
},);
