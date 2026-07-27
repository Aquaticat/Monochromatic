/**
 * Manifest entries pointing into `src` are discarded, never blessed.
 *
 * `main` and `bin` here both name files under `src`. Honouring them as
 * shipping directories would make all of `src` eventual, blessing exactly the
 * imports this rule exists to reject. The sanctioned source channel is the
 * `./ts` export, so a runtime entry naming source is a misconfiguration.
 *
 * Expected diagnostics: two, for both source imports.
 *
 * @module
 */

// Default artifact root, always eventual: allowed.
import { shipped, } from '../dist/final/node/index.mjs';
// The declared `main`, which points into source: rejected.
import { entry, } from './index.ts';
// The declared `bin`, which also points into source: rejected.
import { run, } from './cli.ts';

/**
 * Keeps every binding referenced.
 */
export const used: readonly unknown[] = [
  shipped,
  entry,
  run,
];
