#!/usr/bin/env node
/**
 * Cli-git authoring exports and direct executable entry.
 *
 * @module
 */

import { runCliGit, } from './bin.ts';

export * from './authoring.ts';

// Direct execution runs the wrapper; module import remains inert.
if (import.meta.main)
  await runCliGit();
