import {
  dirname,
} from 'node:path';
import { fileURLToPath, } from 'node:url';

//region Cache account built directory
// Where the as-built suites of the cache-account audit find the command they start.

/**
 Directory holding this package's built commands, found through the package's
 own name so the as-built suites start the audit from here and not from the
 package that owns the shared child fixture.
 */
export const CACHE_ACCOUNT_BUILT_DIRECTORY: string = dirname(fileURLToPath(import.meta.resolve('@monochromatic-dev/translation-repair-slice-cache',),),);

//endregion Cache account built directory
