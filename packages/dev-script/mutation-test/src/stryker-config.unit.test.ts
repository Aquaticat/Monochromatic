import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { buildStrykerConfig, } from '../dist/final/node/index.mjs';

await describe({
  name: buildStrykerConfig.name,
  children: [
    it({
      name: 'enables command runner, in-place mutation, JSON reporting, and TypeScript checker',
      fn: async () => {
        const config = buildStrykerConfig({
          mutateFile: 'src/io/glob.ts',
          reportFile: '/out/glob.json',
          dryRunOnly: false,
          timeoutMS: 5_000,
          prioritizePerformanceOverAccuracy: false,
          tsconfigFile: 'tsconfig.json',
        },);

        expect(config.testRunner,).toBe('command',);
        expect(config.coverageAnalysis,).toBe('off',);
        expect(config.inPlace,).toBe(true,);
        expect(config.checkers,).toEqual(['typescript',],);
        expect(config.typescriptChecker.prioritizePerformanceOverAccuracy,).toBe(false,);
        expect(config.reporters,).toEqual(['clear-text', 'json',],);
        expect(config.jsonReporter.fileName,).toBe('/out/glob.json',);
        expect(config.concurrency,).toBe(1,);
        expect(config.commandRunner.command,).toContain('nu -c',);
      },
    },),
    it({
      name: 'keeps thresholds non-breaking so survivors are reported rather than hiding JSON',
      fn: async () => {
        const config = buildStrykerConfig({
          mutateFile: 'src/a.ts',
          reportFile: '/out/a.json',
          dryRunOnly: true,
          timeoutMS: 1_234,
          prioritizePerformanceOverAccuracy: true,
          tsconfigFile: 'tsconfig.json',
        },);

        expect(config.dryRunOnly,).toBe(true,);
        expect(config.timeoutMS,).toBe(1_234,);
        expect(config.thresholds.break,).toBeNull();
        expect(config.typescriptChecker.prioritizePerformanceOverAccuracy,).toBe(true,);
      },
    },),
  ],
},);
