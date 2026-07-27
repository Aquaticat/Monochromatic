/**
 * A package declaring no build task ships no artifact, so the rule is vacuous.
 *
 * This directory deliberately has no `mise.toml`. Keying the exemption on the
 * build task rather than on file layout makes it self-healing: adding a build
 * task re-arms the rule with no change to the plugin.
 *
 * Expected diagnostics: none.
 *
 * @module
 */

// Source import that any building package would have rejected.
import { thing, } from './thing.ts';
// Own `/ts` subpath, likewise rejected in any building package.
import { thing as thingThroughSource, } from '@monochromatic-dev/test-fixture-case-buildless/ts';

/**
 * Keeps every binding referenced.
 */
export const used: readonly unknown[] = [
  thing,
  thingThroughSource,
];
