import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { SANDBOX_NOISE_PREDICATES, } from './filter-patterns.ts';

/**
 * Classifies a line as sandbox noise via the exported predicate array.
 * `isSandboxMiseCacheNoise` is the sole entry; it is not exported directly,
 * so the test exercises it through the array that production code consults.
 *
 * @param line - candidate output line
 *
 * @returns whether any sandbox-noise predicate matches
 */
function isNoise(line: string,): boolean {
  return SANDBOX_NOISE_PREDICATES.some(function test(predicate,) {
    return predicate(line,);
  },);
}

/** Canonical mise read-only cache warning the predicate is built to match. */
const FULL = 'mise WARN failed to write cache file: /x/y Read-only file system';

await describe({
  name: 'filter-patterns sandbox noise',
  children: [
    describe({
      name: 'isSandboxMiseCacheNoise (via SANDBOX_NOISE_PREDICATES)',
      children: [
        it({
          name: 'matches the canonical warning',
          fn: async () => {
            expect(isNoise(FULL,),).toBe(true,);
          },
        },),
        it({
          name: 'matches with leading whitespace',
          fn: async () => {
            expect(isNoise(`   ${FULL}`,),).toBe(true,);
          },
        },),
        it({
          name: 'matches with an optional bracketed prefix',
          fn: async () => {
            expect(isNoise(`[INFO] ${FULL}`,),).toBe(true,);
          },
        },),
        it({
          name: 'rejects the empty string',
          fn: async () => {
            expect(isNoise('',),).toBe(false,);
          },
        },),
        it({
          name: 'rejects all-whitespace input',
          fn: async () => {
            expect(isNoise('        ',),).toBe(false,);
          },
        },),
        it({
          name: 'rejects a warning without the failed-to-write segment',
          fn: async () => {
            expect(isNoise('mise WARN something unrelated happened',),).toBe(false,);
          },
        },),
        it({
          name: 'rejects when no whitespace follows the WARN token',
          fn: async () => {
            expect(isNoise('mise WARNfailed to write cache file: x Read-only file system',),)
              .toBe(false,);
          },
        },),
        it({
          name: 'rejects when the read-only-fs marker is absent',
          fn: async () => {
            expect(isNoise('mise WARN failed to write cache file: /x permission denied',),)
              .toBe(false,);
          },
        },),
        it({
          name: 'rejects unrelated prose',
          fn: async () => {
            expect(isNoise('hello world',),).toBe(false,);
          },
        },),
        it({
          name: 'matches with a long leading-whitespace run (linear scan)',
          fn: async () => {
            expect(isNoise(`${' '.repeat(200_000,)}${FULL}`,),).toBe(true,);
          },
        },),
      ],
    },),
  ],
},);
