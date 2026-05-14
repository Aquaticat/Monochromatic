/**
 * JSDoc-to-TSDoc tag migration suggestions.
 *
 * Maps JSDoc-only tag names to human-readable replacement guidance,
 * used by the tag-names validation rule.
 *
 * @module
 */

/**
 * JSDoc tags that have no TSDoc equivalent or have a different name.
 * Each value is a user-facing suggestion for how to migrate.
 *
 * @example
 * ```ts
 * JSDOC_TO_TSDOC_MAP.get('\@type');
 * // => 'Remove \@type; TypeScript handles types.'
 * ```
 */
export const JSDOC_TO_TSDOC_MAP: ReadonlyMap<string, string> = new Map([
  [
    '@type',
    'Remove @type: TypeScript handles types.',
  ],
  [
    '@typedef',
    'Remove @typedef: use TypeScript type alias instead.',
  ],
  [
    '@callback',
    'Remove @callback: use TypeScript type alias instead.',
  ],
  [
    '@property',
    'Remove @property: use TypeScript type members instead.',
  ],
  [
    '@prop',
    'Remove @prop: use TypeScript type members instead.',
  ],
  [
    '@memberof',
    'Remove @memberof: not needed in TSDoc.',
  ],
  [
    '@augments',
    'Remove @augments: use TypeScript extends instead.',
  ],
  [
    '@extends',
    'Remove @extends: use TypeScript extends instead.',
  ],
  [
    '@class',
    'Remove @class: use TypeScript class syntax instead.',
  ],
  [
    '@constructor',
    'Remove @constructor: use TypeScript class syntax instead.',
  ],
  [
    '@function',
    'Remove @function: not needed in TSDoc.',
  ],
  [
    '@method',
    'Remove @method: not needed in TSDoc.',
  ],
  [
    '@namespace',
    'Remove @namespace: use TypeScript namespace instead.',
  ],
  [
    '@module',
    'Remove @module: use @packageDocumentation instead.',
  ],
  [
    '@member',
    'Remove @member: not needed in TSDoc.',
  ],
  [
    '@var',
    'Remove @var: not needed in TSDoc.',
  ],
  [
    '@global',
    'Remove @global: not needed in TSDoc.',
  ],
  [
    '@enum',
    'Remove @enum: use TypeScript enum instead.',
  ],
  [
    '@lends',
    'Remove @lends: not needed in TSDoc.',
  ],
  [
    '@fires',
    'Remove @fires: not needed in TSDoc.',
  ],
  [
    '@listens',
    'Remove @listens: not needed in TSDoc.',
  ],
  [
    '@mixes',
    'Remove @mixes: not needed in TSDoc.',
  ],
  [
    '@mixin',
    'Remove @mixin: not needed in TSDoc.',
  ],
  [
    '@interface',
    'Remove @interface: use TypeScript interface instead.',
  ],
  [
    '@return',
    'Use @returns (with "s") instead.',
  ],
  [
    '@yield',
    'Use @yields (with "s") instead.',
  ],
  [
    '@template',
    'Use @typeParam instead.',
  ],
  [
    '@access',
    'Use @public, @internal, @alpha, or @beta modifier tags instead.',
  ],
],);
