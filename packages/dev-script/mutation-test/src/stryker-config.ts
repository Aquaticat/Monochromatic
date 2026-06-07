/**
 * Stryker configuration builder for one source file.
 *
 * @example
 * ```ts
 * buildStrykerConfig({
 *   mutateFile: 'src/a.ts',
 *   reportFile: '/out/a.json',
 *   dryRunOnly: false,
 *   timeoutMS: 5000,
 *   prioritizePerformanceOverAccuracy: false,
 *   tsconfigFile: 'tsconfig.json',
 * });
 * ```
 */

import { buildNuCommand, } from './inline-nu.ts';
import type { StrykerConfigOptions, } from './types.ts';

/**
 * JSON-compatible Stryker options emitted into the container work tree.
 */
export type StrykerJsonConfig = {
  readonly testRunner: 'command';
  readonly commandRunner: {
    readonly command: string;
  };
  readonly mutate: readonly string[];
  readonly coverageAnalysis: 'off';
  readonly inPlace: true;
  readonly checkers: readonly ['typescript'];
  readonly tsconfigFile: string;
  readonly typescriptChecker: {
    readonly prioritizePerformanceOverAccuracy: boolean;
  };
  readonly reporters: readonly ['clear-text', 'json'];
  readonly jsonReporter: {
    readonly fileName: string;
  };
  readonly concurrency: 1;
  readonly dryRunOnly: boolean;
  readonly timeoutMS: number;
  readonly thresholds: {
    readonly high: 0;
    readonly low: 0;
    readonly break: null;
  };
};

/**
 * Builds one Stryker config object for a single mutate target.
 *
 * @param options - Per-file Stryker configuration inputs.
 *
 * @returns JSON-serialisable Stryker configuration.
 *
 * @example
 * ```ts
 * const config = buildStrykerConfig({
 *   mutateFile: 'src/a.ts',
 *   reportFile: '/out/a.json',
 *   dryRunOnly: false,
 *   timeoutMS: 5000,
 *   prioritizePerformanceOverAccuracy: false,
 *   tsconfigFile: 'tsconfig.json',
 * });
 * config.inPlace;
 * // true
 * ```
 */
export function buildStrykerConfig(options: StrykerConfigOptions,): StrykerJsonConfig {
  return {
    testRunner: 'command',
    commandRunner: {
      command: buildNuCommand(),
    },
    mutate: [options.mutateFile,],
    coverageAnalysis: 'off',
    inPlace: true,
    checkers: ['typescript',],
    tsconfigFile: options.tsconfigFile,
    typescriptChecker: {
      prioritizePerformanceOverAccuracy: options.prioritizePerformanceOverAccuracy,
    },
    reporters: [
      'clear-text',
      'json',
    ],
    jsonReporter: {
      fileName: options.reportFile,
    },
    concurrency: 1,
    dryRunOnly: options.dryRunOnly,
    timeoutMS: options.timeoutMS,
    thresholds: {
      high: 0,
      low: 0,
      break: null,
    },
  };
}
