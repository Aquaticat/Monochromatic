import { join, } from 'node:path';
import {
  mergeConfig,
} from 'vite';
import type {
  ViteUserConfig as VitestUserConfig,
  ViteUserConfigFnObject as VitestUserConfigFnObject,
} from 'vitest/config';
import { createBaseConfig, } from './base-configs.ts';
import { createModeConfig, } from './config-modifiers.ts';
import {
  DEFAULT_TEST_TIMEOUT,
  MAX_CONCURRENCY,
  VITEST_API_PORT,
  vitestExcludeCommon,
} from './constants.ts';

//region Vitest Configurations -- Test runner configurations

export const vitestOnlyConfigWorkspace: VitestUserConfig = {
  test: {
    name: 'workspace',
    api: {
      host: '0.0.0.0',
      port: VITEST_API_PORT,
    },

    reporters: ['dot',],

    deps: {
      // Never importing CJS module's default export via `import {x} from 'y'`.
      interopDefault: false,
    },
    benchmark: {
      outputJson: join('bak', new Date().toISOString().replaceAll(':', '',),
        'vitest.benchmark.json',),
    },
    outputFile: join('bak', new Date().toISOString().replaceAll(':', '',),
      'vitest.result.json',),
    pool: 'vmThreads',

    maxWorkers: 16,
    testTimeout: DEFAULT_TEST_TIMEOUT,
    silent: 'passed-only',
    logHeapUsage: true,
    maxConcurrency: MAX_CONCURRENCY,
    sequence: {
      concurrent: true,
    },
    typecheck: {
      enabled: true,
      // Overwrite this to vue-tsc in packages that use Vue.
      checker: 'tsgo',
    },
    chaiConfig: {
      includeStack: true,
    },
    expect: {
      requireAssertions: true,
    },

    // Coverage configuration at workspace level - only runs for unit tests
    coverage: {
      provider: 'v8',
      enabled: true,
      excludeAfterRemap: true,
      reportOnFailure: true,
      skipFull: true,

      reporter: [
        join(import.meta.dirname, '..', '..', '..', 'src', 'coverage-reporter.cjs',),
        'html',
        'clover',
        'json',
      ],

      thresholds: {
        perFile: true,
        // Error: Failed to update coverage thresholds. The Configuration file is too complex.
        autoUpdate: false,
      },
      // Excluding some files in this file would source map remapping not working.
      // Therefore, coverage for irrelevant files is ignored in custom coverage reporter.
      // Only this works for coverage to follow sourcemap.
      // include: [
      //   'packages/*/*/**/dist/final/**/*.js',
      //   'packages/*/*/**/src/**/*.ts',
      // ],
      // exclude: [
      //   ...vitestExcludeCommon,
      //   ...(vitestExcludeCommonConfig.coverageAdditionalPatterns),
      // ],
    },
  },
};

export const vitestOnlyUnitConfigWorkspace: VitestUserConfig = {
  test: {
    ...vitestOnlyConfigWorkspace.test,
    name: 'unit',

    exclude: [...vitestExcludeCommon, '**/*.browser.test.ts',],
    projects: [
      {
        extends: true,
        test: {
          include: ['packages/*/*/src/**/*.unit.test.ts',],
        },
      },
    ],
  },
};

export const createVitestBaseUnitConfigWorkspace = (
  configDir: string,
): VitestUserConfig =>
  mergeConfig(
    createBaseConfig(configDir,),
    vitestOnlyUnitConfigWorkspace,
  );

export const getVitestUnitWorkspace = (configDir: string,): VitestUserConfigFnObject =>
  createModeConfig(configDir, createVitestBaseUnitConfigWorkspace,);

//endregion Vitest Configurations

export {
  // eslint-disable-next-line unicorn/prefer-export-from -- false alarm.
  type VitestUserConfigFnObject,
};
