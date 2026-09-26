/**
 Tests for the bounded compiled-pattern cache.
 
 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  cacheKey,
  cacheSize,
  clearPatternCache,
  getPattern,
  isMatch,
} from '../dist/final/neutral/index.mjs';

await describe({
  name: '',
  children: [
    describe({
      name: cacheKey.name,
      children: [
        it({
          name: 'prefixes the raw pattern by sensitivity',
          fn: async () => {
            expect(cacheKey({
              pattern: 'a*',
              caseSensitive: true,
            },),).toBe('Sa*',);
            expect(cacheKey({
              pattern: 'a*',
              caseSensitive: false,
            },),).toBe('Ia*',);
          },
        },),
      ],
    },),

    describe({
      name: getPattern.name,
      children: [
        it({
          name: 'returns the same entry for the same key',
          fn: async () => {
            clearPatternCache();
            /**
             First compilation under this key.
             */
            const first = getPattern({
              pattern: 'same*',
              caseSensitive: false,
            },);
            /**
             Second compilation under the same key.
             */
            const second = getPattern({
              pattern: 'same*',
              caseSensitive: false,
            },);
            expect(second,).toBe(first,);
            expect(cacheSize(),).toBe(1,);
          },
        },),

        it({
          name: 'separates entries by case-sensitivity',
          fn: async () => {
            clearPatternCache();
            getPattern({
              pattern: 'same*',
              caseSensitive: false,
            },);
            getPattern({
              pattern: 'same*',
              caseSensitive: true,
            },);
            expect(cacheSize(),).toBe(2,);
          },
        },),

        it({
          name: 'evicts the oldest entry past the bound',
          fn: async () => {
            clearPatternCache();
            /**
             Maximum entries the cache holds, matching upstream's bound.
             */
            const maximumCacheSize = 1_000;
            for (let index = 0; index <= maximumCacheSize; index += 1)
              getPattern({
                pattern: `pattern-${String(index,)}*`,
                caseSensitive: false,
              },);
            expect(cacheSize(),).toBe(maximumCacheSize,);
            expect(isMatch({
              inputs: 'pattern-0-suffix',
              patterns: 'pattern-0*',
            },),).toBe(true,);
          },
        },),
      ],
    },),
  ],
},);
