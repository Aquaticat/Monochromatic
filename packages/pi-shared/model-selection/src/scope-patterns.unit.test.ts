/**
 * Unit tests for scope pattern resolution.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { resolveModelPatterns, } from './scope.ts';
import { fixtureModel, } from './test-fixtures.ts';

//region Fixtures

/** Cheap model fixture. */
const cheapModel = fixtureModel({
  provider: 'cheap',
  id: 'reviewer',
},);

/** Expensive model fixture. */
const expensiveModel = fixtureModel({
  provider: 'expensive',
  id: 'reviewer',
},);

/** Model list used by pattern resolution tests. */
const availableModels = [
  cheapModel,
  expensiveModel,
] as const;

//endregion Fixtures

await describe({
  name: resolveModelPatterns.name,
  children: [
    it({
      name: 'resolves glob and literal patterns in order',
      fn: async function testPatternOrder() {
        const result = resolveModelPatterns({
          patterns: [
            'expensive/*:high',
            'cheap/reviewer',
          ],
          availableModels,
        },);
        expect(result.map(function mapEntry(entry,) {
          return entry.canonicalSlug;
        },),)
          .toEqual([
            'expensive/reviewer',
            'cheap/reviewer',
          ],);
        expect(result[0]?.thinkingLevel,).toBe('high',);
      },
    },),
    it({
      name: 'deduplicates provider/id matches',
      fn: async function testDeduplication() {
        const result = resolveModelPatterns({
          patterns: [
            'cheap/*',
            'cheap/reviewer',
          ],
          availableModels,
        },);
        expect(result,).toHaveLength(1,);
      },
    },),
    it({
      name: 'matches glob patterns case-insensitively against slugs and ids',
      fn: async function testCaseInsensitiveGlobMatching() {
        /**
         * Result matched through canonical provider/model slug.
         */
        const canonicalResult = resolveModelPatterns({
          patterns: ['EXPENSIVE/REVIEW*',],
          availableModels,
        },);
        expect(canonicalResult.map(function mapCanonicalEntry(entry,) {
          return entry.canonicalSlug;
        },),)
          .toEqual(['expensive/reviewer',],);

        /**
         * Result matched through bare model id fallback.
         */
        const bareIdResult = resolveModelPatterns({
          patterns: ['REVIEW*',],
          availableModels,
        },);
        expect(bareIdResult.map(function mapBareIdEntry(entry,) {
          return entry.canonicalSlug;
        },),)
          .toEqual([
            'cheap/reviewer',
            'expensive/reviewer',
          ],);
      },
    },),
  ],
},);
