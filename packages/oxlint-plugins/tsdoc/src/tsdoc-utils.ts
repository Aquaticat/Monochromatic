/**
 * TSDoc utility barrel module.
 *
 * Re-exports parser configuration, file filtering, and comment discovery
 * utilities from focused sub-modules.
 *
 * @module
 */

/**
 * File extensions excluded from TSDoc rules.
 */
export const IGNORED_EXTENSIONS: readonly string[] = [
  '.test.ts',
  '.spec.ts',
  '.bench.ts',
  '.js',
  '.d.ts',
  '.mjs',
  '.cjs',
  '.d.mts',
  '.d.cts',
];

/**
 * Checks whether given file should be skipped by TSDoc rules, based on
 * {@link IGNORED_EXTENSIONS}.
 *
 * @param filename - absolute path of file being linted
 *
 * @returns true when file has an ignored extension
 *
 * @example
 * ```ts
 * if (shouldIgnoreFile(context.filename)) return false;
 * ```
 */
export function shouldIgnoreFile(filename: string,): boolean {
  return IGNORED_EXTENSIONS.some(function endsWithIgnored(ext,): boolean {
    return filename.endsWith(ext,);
  },);
}

export {
  FALLBACK_ELIGIBLE_TYPES,
  findTsdocComment,
  NO_TSDOC,
  parseTsdocComment,
  parseTsdocForNode,
  type ParsedCommentFacts,
  type TsdocParseResult,
} from './tsdoc-comments.ts';

export {
  extractDestructuredParamNames,
  extractDocParamNames,
  extractParamNames,
  functionReturnsValue,
  isGeneratorFunction,
} from './tsdoc-params.ts';
