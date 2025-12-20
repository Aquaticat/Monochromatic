import { join } from 'node:path';
import {
  mergeConfig,
  type UserConfig,
} from 'vite';
import type {
  ViteUserConfig as VitestUserConfig,
  ViteUserConfigFnObject as VitestUserConfigFnObject,
} from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { createModeConfig } from './config-modifiers.js';
import { createBaseConfig } from './base-configs.js';
import {
  VITEST_API_PORT,
  VITEST_BROWSER_API_PORT,
  DEFAULT_TEST_TIMEOUT,
  BROWSER_TEST_TIMEOUT,
  MAX_CONCURRENCY,
  vitestExcludeCommon,
} from './constants.js';

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
      // checker: 'tsc',
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
        join(import.meta.dirname, 'coverage-reporter.cjs',),
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
    include: ['packages/*/*/**/src/**/*.unit.test.ts',],
    exclude: [...vitestExcludeCommon, '**/*.browser.test.ts',],
  },
};

export const vitestOnlyBrowserConfigWorkspace: VitestUserConfig = {
  test: {
    ...vitestOnlyConfigWorkspace.test,

    coverage: {
      // Turned off for browsers. See https://github.com/vitest-dev/vitest/issues/5477
      enabled: false,
    },
    name: 'browser',
    include: ['packages/*/*/**/src/**/*.browser.test.ts',],
    exclude: [...vitestExcludeCommon, '**/*.unit.test.ts',],

    browser: {
      provider: playwright(
        {
          contextOptions: {
            acceptDownloads: false,
          },
          launchOptions: {
            channel: 'chromium',
            chromiumSandbox: true,
          },
        },
      ),
      enabled: true,
      headless: true,

      api: {
        host: '0.0.0.0',
        port: VITEST_BROWSER_API_PORT,
      },

      instances: [
        {
          browser: 'chromium',
          testTimeout: BROWSER_TEST_TIMEOUT,
        },
        // @vitest/coverage-v8 doesn't work with firefox because Firefox doesn't use v8 engine.
        { browser: 'firefox', testTimeout: BROWSER_TEST_TIMEOUT, },
      ],
    },
  },
};

export const createVitestBaseUnitConfigWorkspace = (
  configDir: string,
): VitestUserConfig =>
  mergeConfig(
    createBaseConfig(configDir,),
    vitestOnlyUnitConfigWorkspace,
  );

export const createVitestBaseBrowserConfigWorkspace = (
  configDir: string,
): VitestUserConfig =>
  mergeConfig(
    createBaseConfig(configDir,),
    vitestOnlyBrowserConfigWorkspace,
  );

export const getVitestUnitWorkspace = (configDir: string,): VitestUserConfigFnObject =>
  createModeConfig(configDir, createVitestBaseUnitConfigWorkspace,);
export const getVitestBrowserWorkspace = (configDir: string,): VitestUserConfigFnObject =>
  createModeConfig(configDir, createVitestBaseBrowserConfigWorkspace,);

//endregion Vitest Configurations

export {
  type VitestUserConfigFnObject,
};
