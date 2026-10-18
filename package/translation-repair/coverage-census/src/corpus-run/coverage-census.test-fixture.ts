/**
 Census stretches the coverage census tests read their baselines and runs
 from. Paths and names are cat-themed invention.

 @module
 */

import {
  dirname,
} from 'node:path';
import { fileURLToPath, } from 'node:url';

import type { CensusStretch, } from '../../dist/final/node/index.mjs';

/**
 Directory holding this package's built commands, found through the package's
 own name so the as-built suites start the census's commands from here and not
 from the package that owns the shared child fixture.
 */
export const BUILT_DIRECTORY: string = dirname(
  fileURLToPath(import.meta.resolve('@monochromatic-dev/translation-repair-coverage-census',),),
);

/**
 A recorded stretch in one source over some lines.

 @param source - source file

 @param startLine - first line

 @param endLine - last line

 @returns The stretch

 @example
 ```ts
 const stretch = recorded({ source: 'src/nap.ts', startLine: 3, endLine: 5, },);
 ```
 */
export function recorded(
  {
    source,
    startLine,
    endLine,
  }: {
    readonly source: string;
    readonly startLine: number;
    readonly endLine: number;
  },
): CensusStretch {
  return {
    bundle: 'nap.mjs',
    start: 0,
    end: 1,
    name: '',
    source,
    startLine,
    endLine,
  };
}
