/**
 * Directory granularity from a `main` entry outside `dist/final`.
 *
 * `main` names one file, `dist/app/main.mjs`, and the whole of `dist/app`
 * counts as eventual. Exact-file matching would reject every sibling the
 * bundler emits next to that entry.
 *
 * Expected diagnostics: one, for the source import only.
 *
 * @module
 */

// Sibling of the declared `main` entry: allowed by directory granularity.
import { strip, } from '../dist/app/strip.js';
// The declared entry itself: allowed.
import { boot, } from '../dist/app/main.mjs';
// Source: rejected, since `exports` serves only `./ts/*` here.
import { helper, } from './helper.ts';

/**
 * Keeps every binding referenced.
 */
export const used: readonly unknown[] = [
  strip,
  boot,
  helper,
];
