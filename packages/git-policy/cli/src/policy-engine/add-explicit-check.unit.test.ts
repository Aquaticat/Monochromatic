import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { checkAddExplicit as addExplicit, } from './add-explicit-check.ts';

/** Bulk-staging patterns rejected by the add-explicit rule. */
const BULK_ADD_CASES: readonly string[] = [
  '.',
  './',
  '*',
  ':/',
  '-A',
  '--all',
  '-u',
  '--update',
];

/**
 * Captures synchronous error from add-explicit invocation.
 *
 * @param args - Git argv to pass through add-explicit rule.
 *
 * @returns Error thrown by rule, or `undefined` when rule passes.
 *
 * @example
 * ```ts
 * const caught = catchAddExplicitError(['add', '.']);
 * expect(caught).toBeInstanceOf(Error);
 * ```
 */
function catchAddExplicitError(args: readonly string[],): unknown {
  try {
    addExplicit(args,);
  }
  catch (error) {
    return error;
  }
  return undefined;
}

await describe({
  name: addExplicit.name,
  children: [
    it({
      name: 'passes non-add commands through unchanged',
      fn: async function testNonAddCommand(): Promise<void> {
        /** Non-add argv that should not be transformed. */
        const args = [
          'status',
          '--short',
        ] as const;

        expect(addExplicit(args,),).toBe(args,);
      },
    },),
    it({
      name: 'passes explicit file path unchanged',
      fn: async function testExplicitFile(): Promise<void> {
        expect(addExplicit([
          'add',
          'packages/git-policy/cli/src/index.ts',
        ],),)
          .toEqual([
            'add',
            'packages/git-policy/cli/src/index.ts',
          ],);
      },
    },),
    it({
      name: 'strips escape hatch and forwards remaining args',
      fn: async function testEscapeHatch(): Promise<void> {
        expect(addExplicit([
          'add',
          '.',
          '--no-enforce-bulk-add',
        ],),)
          .toEqual([
            'add',
            '.',
          ],);
      },
    },),
    it({
      name: 'rejects bulk add after global options',
      fn: async function testGlobalOptionBulkAdd(): Promise<void> {
        /** Error thrown for `git -C /repo add -A`. */
        const caught = catchAddExplicitError([
          '-C',
          '/tmp/repo',
          'add',
          '-A',
        ],);

        expect(caught,).toBeInstanceOf(Error,);
        expect((caught as Error).message,).toContain('bulk-staging patterns (-A)',);
      },
    },),
    it({
      name: 'rejects bulk pathspec after pathspec separator',
      fn: async function testBulkPathspecAfterSeparator(): Promise<void> {
        /** Error thrown for `git add -- .`. */
        const caught = catchAddExplicitError([
          'add',
          '--',
          '.',
        ],);

        expect(caught,).toBeInstanceOf(Error,);
        expect((caught as Error).message,).toContain('bulk-staging patterns (.)',);
      },
    },),
    ...BULK_ADD_CASES.map(function mapBulkAddCase(pattern,) {
      return it({
        name: `rejects bulk-staging pattern ${pattern}`,
        fn: async function testBulkAddPattern(): Promise<void> {
          /** Error thrown for this bulk-staging pattern. */
          const caught = catchAddExplicitError([
            'add',
            pattern,
          ],);

          expect(caught,).toBeInstanceOf(Error,);
          expect((caught as Error).message,).toContain(
            `bulk-staging patterns (${pattern})`,
          );
        },
      },);
    },),
  ],
},);
