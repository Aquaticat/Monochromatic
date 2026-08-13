import {
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { resolve, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import type { Context, } from '@oxlint/plugins';

import {
  readonlySourceEvidence,
  readonlySourceEvidenceCacheStats,
} from '../dist/final/node/index.mjs';

/**
 * Configured fixture source root.
 */
const FIXTURE_SOURCE_ROOT = resolve(
  import.meta.dirname,
  '../../../test-fixture/oxlint-no-restricted-syntax/src',
);

/**
 * Disposable configured directory used by one evidence test.
 *
 * @example
 * ```ts
 * using directory = disposableDirectory();
 * ```
 */
type DisposableDirectory = {
  readonly path: string;
  readonly [Symbol.dispose]: () => void;
};

/**
 * Creates disposable directory inside configured fixture source root.
 *
 * @returns directory removed when test scope ends.
 *
 * @example
 * ```ts
 * using directory = disposableDirectory();
 * ```
 */
function disposableDirectory(): DisposableDirectory {
  /**
   * Unique configured source directory.
   */
  const path = mkdtempSync(resolve(FIXTURE_SOURCE_ROOT, 'readonly-evidence-',),);
  return {
    path,
    [Symbol.dispose](): void {
      rmSync(path, {
        recursive: true,
        force: true,
      },);
    },
  };
}

/**
 * Minimal rule context needed before reporting begins.
 *
 * @param filePath - Configured TypeScript source path.
 *
 * @param sourceText - Exact semantic overlay text.
 *
 * @returns distinct foreign context carrying shared source snapshot.
 *
 * @example
 * ```ts
 * evidenceContext({ filePath, sourceText });
 * ```
 */
function evidenceContext({
  filePath,
  sourceText,
}: {
  readonly filePath: string;
  readonly sourceText: string;
}): ForeignBorrowed<Context> {
  return {
    filename: filePath,
    sourceCode: {
      text: sourceText,
      hasBOM: false,
    },
  } as ForeignBorrowed<Context>;
}

await describe({
  name: readonlySourceEvidence.name,
  children: [
    it({
      name: 'computes once for four distinct rule contexts over one snapshot',
      fn: async () => {
        /**
         * Disposable directory removed after evidence assertions.
         */
        using directory = disposableDirectory();
        /**
         * Source path admitted by fixture TypeScript project.
         */
        const filePath = resolve(directory.path, 'input.ts',);
        /**
         * Source text sufficient to exercise parameter evidence.
         */
        const sourceText = `export function readValue(input: { value: string }): string {\n  return input.value;\n}\n`;
        writeFileSync(filePath, sourceText,);
        /**
         * Cache counters before exact source enters process.
         */
        const before = readonlySourceEvidenceCacheStats();
        /**
         * Four contexts model four public rule visitors in one worker.
         */
        const results = [
          'preference',
          'mutation',
          'opaque-effect',
          'effect-contract',
        ].map(function analyzeFromDistinctContext(): ReturnType<typeof readonlySourceEvidence> {
          return readonlySourceEvidence({
            context: evidenceContext({
              filePath,
              sourceText,
            },),
          },);
        },);
        /**
         * Cache counters after all reporter contexts requested evidence.
         */
        const after = readonlySourceEvidenceCacheStats();
        expect(after.computations - before.computations,).toBe(1,);
        expect(after.misses - before.misses,).toBe(1,);
        expect(after.hits - before.hits,).toBe(3,);
        expect(results.every(function sharesFirst(result,): boolean {
          return result === results[0];
        },),).toBe(true,);
      },
    },),
  ],
},);
