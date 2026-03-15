/**
 * Transform hook implementation that rewrites import attributes
 * into query-parameter-tagged specifiers.
 *
 * @module
 */

import { HANDLERS, } from './handlers.ts';
import {
  ATTR_QUERY_KEY,
  DYNAMIC_IMPORT_WITH_RE,
  STATIC_IMPORT_WITH_RE,
} from './patterns.ts';

/**
 * Rewrites import/export statements that use `with { type: '...' }` attributes.
 * Strips the `with` clause and appends `?__importattr=<type>` to the specifier
 * so that `resolveId` and `load` can intercept it.
 *
 * Static imports are handled by matching the `with { type: '...' }` syntax.
 * Dynamic imports are matched via the `{ with: { type: '...' } }` options form.
 *
 * @param code - Source code to transform
 *
 * @returns Transformed code object, or `null` if no attributes were found
 */
export function transformImportAttributes(code: string): { code: string } | null {
  if (!code.includes(' with ') && !code.includes(' with{')) {
    return null;
  }

  let transformed = code;
  let didTransform = false;

  //region Static imports/exports
  transformed = transformed.replace(
    STATIC_IMPORT_WITH_RE,
    function staticReplacer(_match: string, prefix: string, quote: string, specifier: string, _withClause: string, attrType: string) {
      if (HANDLERS[attrType] === undefined) {
        return _match;
      }
      didTransform = true;
      return `${prefix}${quote}${specifier}?${ATTR_QUERY_KEY}=${attrType}${quote}`;
    },
  );
  //endregion Static imports/exports

  //region Dynamic imports
  transformed = transformed.replace(
    DYNAMIC_IMPORT_WITH_RE,
    function dynamicReplacer(_match: string, prefix: string, quote: string, specifier: string, _withClause: string, attrType: string) {
      if (HANDLERS[attrType] === undefined) {
        return _match;
      }
      didTransform = true;
      return `${prefix}${quote}${specifier}?${ATTR_QUERY_KEY}=${attrType}${quote}`;
    },
  );
  //endregion Dynamic imports

  // oxlint-disable-next-line typescript/no-unnecessary-condition -- didTransform is mutated inside replace callbacks; linter cannot follow callback side effects
  if (!didTransform) {
    return null;
  }
  return { code: transformed, };
}
