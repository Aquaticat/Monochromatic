/**
 * A single asset entry directly under `dist` must not bless all of `dist`.
 *
 * `exports["./font"]` names `./dist/Face-Regular.otf`. Taking its containing
 * directory literally would make every intermediate output under `dist/temp`
 * eventual, which is the opposite of what this rule is for. The bare `dist`
 * root is therefore never counted, leaving only the default `dist/final` root.
 *
 * Expected diagnostics: two, for the intermediate and source imports.
 *
 * @module
 */

// Default artifact root, always eventual: allowed.
import { shipped, } from '../dist/final/neutral/index.mjs';
// Intermediate output beside the declared asset: rejected.
import { intermediate, } from '../dist/temp/glyph.mjs';
// Source: rejected.
import { glyph, } from './glyph.ts';

/**
 * Keeps every binding referenced.
 */
export const used: readonly unknown[] = [
  shipped,
  intermediate,
  glyph,
];
