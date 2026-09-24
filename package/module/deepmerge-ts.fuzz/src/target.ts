/**
 The deepmerge-ts build under test.

 By default the installed npm release (`deepmerge-ts` from the workspace
 catalog), which is what consumers run. Setting `DEEPMERGE_FUZZ_TARGET` to a
 module path (for example a local fork build) runs every property and
 known-defect test against that build instead, so a fix can be verified
 before a PR (Q9 in `doc/handover/deepmerge-ts-hardening.md`).

 @module
 */

import { isAbsolute, resolve, } from 'node:path';
import { pathToFileURL, } from 'node:url';

import type * as DeepmergeTs from 'deepmerge-ts';

/**
 Module shape every target build must provide.
 */
export type DeepmergeTarget = typeof DeepmergeTs;

/**
 Environment variable naming an alternative build to test.
 */
export const TARGET_ENV_NAME = 'DEEPMERGE_FUZZ_TARGET';

/**
 Resolve the import specifier of the build under test.

 @returns Package name for the npm release, or a file URL for an override
   path (relative paths resolve against the working directory).

 @example
 ```ts
 const specifier = targetSpecifier();
 ```
 */
export function targetSpecifier(): string {
  /**
   Override path, when one is configured.
   */
  const override = process.env[TARGET_ENV_NAME];
  if ((override === undefined) || (override === ''))
    return 'deepmerge-ts';
  return pathToFileURL(isAbsolute(override,) ? override : resolve(override,),).href;
}

/**
 Loaded build under test, shared by every test file.
 */
export const target: DeepmergeTarget = await import(targetSpecifier());
