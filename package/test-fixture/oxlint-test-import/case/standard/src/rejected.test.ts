/**
 * Every import form the rule rejects in a package that builds normally.
 *
 * Expected diagnostics: four, one per import below.
 *
 * @module
 */

// Sibling source, the case the convention exists to prevent.
import { parse, } from './parse.ts';
// Type-only sibling source; type imports are checked exactly like value imports.
import type { Parsed, } from './parse.ts';
// The package's own source through its own `/ts` subpath.
import { parse as parseThroughOwnSource, } from '@monochromatic-dev/test-fixture-case-standard/ts';
// A deeper own-source subpath.
import { parse as parseThroughOwnFile, } from '@monochromatic-dev/test-fixture-case-standard/ts/parse.ts';

/**
 * Keeps every rejected binding referenced.
 */
export const rejected: readonly unknown[] = [
  parse,
  parseThroughOwnSource,
  parseThroughOwnFile,
];

/**
 * Keeps the type-only import referenced.
 */
export type Echoed = Parsed;
