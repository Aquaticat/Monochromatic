#!/usr/bin/env node
/**
 Cli-git authoring exports and direct executable entry.
 
 @module
 */

import { runCliGit, } from './bin.ts';

export * from './authoring.ts';
/**
 Transaction internals for built-artifact unit tests; not authoring API.

 @internal
 */
export { internalTestExports, } from './internal-test-exports.ts';

// Direct execution runs the wrapper; module import remains inert.
if (import.meta.main)
  await runCliGit();
