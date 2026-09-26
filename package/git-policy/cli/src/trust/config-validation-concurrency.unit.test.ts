/**
 Concurrent-commit tuning keys: defaults, valid values, and every rejected shape.

 @module
 */
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { internalTestExports, } from '../../dist/final/node/index.mjs';

const {
  ConfigValidationError,
  DEFAULT_CONCURRENCY_CONFIG,
  validateConcurrencyConfig,
  validateConfig,
} = internalTestExports;

/**
 Captures the validation failure message for one config.

 @param config - untrusted top-level config

 @returns failure message
 */
function rejection(config: Readonly<Record<string, unknown>>,): string {
  try {
    validateConcurrencyConfig(config,);
  }
  catch (error: unknown) {
    if (error instanceof ConfigValidationError)
      return error.message;
    throw error;
  }
  throw new Error('Concurrency config unexpectedly validated.',);
}

await describe({
  name: validateConcurrencyConfig.name,
  children: [
    it({
      name: 'applies every default when the keys are absent',
      fn: async function testDefaults(): Promise<void> {
        expect(validateConcurrencyConfig({},),).toEqual(DEFAULT_CONCURRENCY_CONFIG,);
        expect(DEFAULT_CONCURRENCY_CONFIG,).toEqual({
          hooks: { concurrentCommits: false, },
          indexLock: { unprovenOwnerTimeoutMs: 1_000, },
          landing: { reserveAfterLostRaces: 2, },
        },);
        expect(validateConcurrencyConfig({ hooks: {}, indexLock: {}, landing: {}, },),).toEqual(DEFAULT_CONCURRENCY_CONFIG,);
      },
    },),
    it({
      name: 'accepts each valid value, including a zero timeout',
      fn: async function testValidValues(): Promise<void> {
        expect(validateConcurrencyConfig({
          hooks: { concurrentCommits: true, },
          indexLock: { unprovenOwnerTimeoutMs: 0, },
          landing: { reserveAfterLostRaces: 1, },
        },),).toEqual({
          hooks: { concurrentCommits: true, },
          indexLock: { unprovenOwnerTimeoutMs: 0, },
          landing: { reserveAfterLostRaces: 1, },
        },);
        expect(validateConcurrencyConfig({ indexLock: { unprovenOwnerTimeoutMs: 250, }, landing: { reserveAfterLostRaces: 5, }, },),)
          .toEqual({
            hooks: { concurrentCommits: false, },
            indexLock: { unprovenOwnerTimeoutMs: 250, },
            landing: { reserveAfterLostRaces: 5, },
          },);
      },
    },),
    it({
      name: 'rejects zero races, negative, fractional, string, and unsafe numbers',
      fn: async function testRejectedNumbers(): Promise<void> {
        expect(rejection({ landing: { reserveAfterLostRaces: 0, }, },),).toContain('landing.reserveAfterLostRaces',);
        expect(rejection({ indexLock: { unprovenOwnerTimeoutMs: -1, }, },),).toContain('indexLock.unprovenOwnerTimeoutMs',);
        expect(rejection({ indexLock: { unprovenOwnerTimeoutMs: 1.5, }, },),).toContain('indexLock.unprovenOwnerTimeoutMs',);
        expect(rejection({ landing: { reserveAfterLostRaces: '2', }, },),).toContain('landing.reserveAfterLostRaces',);
        expect(rejection({ indexLock: { unprovenOwnerTimeoutMs: Number.MAX_SAFE_INTEGER + 2, }, },),).toContain('safe integer',);
      },
    },),
    it({
      name: 'rejects a non-boolean hook switch, non-object sections, and unknown nested keys',
      fn: async function testRejectedShapes(): Promise<void> {
        expect(rejection({ hooks: { concurrentCommits: 'yes', }, },),).toContain('hooks.concurrentCommits',);
        expect(rejection({ hooks: true, },),).toContain('hooks must be an object',);
        expect(rejection({ landing: [], },),).toContain('landing must be an object',);
        expect(rejection({ indexLock: null, },),).toContain('indexLock must be an object',);
        expect(rejection({ hooks: { concurrent: true, }, },),).toBe('Unknown configuration key: hooks.concurrent',);
      },
    },),
    it({
      name: 'threads through whole-config validation',
      fn: async function testWholeConfig(): Promise<void> {
        expect(validateConfig({ hooks: { concurrentCommits: true, }, },).concurrency.hooks.concurrentCommits,).toBe(true,);
        expect(validateConfig({},).concurrency,).toEqual(DEFAULT_CONCURRENCY_CONFIG,);
        expect(function unknownNested(): void {
          validateConfig({ landing: { extra: 1, }, },);
        },).toThrow('Unknown configuration key: landing.extra',);
      },
    },),
  ],
},);
