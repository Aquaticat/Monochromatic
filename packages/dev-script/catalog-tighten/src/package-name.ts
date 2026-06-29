/**
 * npm package-name validation for catalog-tighten.
 *
 * Guards the catalog parser against crafted keys (issue #195): a line such as
 * `__proto__: foo` must not become a result-map key. Validation is a string
 * scan, never a regex, matching this package's deliberate no-regex design
 * (repo rule RG1) and the npm package-name grammar: an optional `@scope/`
 * prefix followed by a name, each segment starting with an ASCII
 * lowercase-alphanumeric character and continuing with `[a-z0-9._-]`.
 *
 * @module
 */

//region Package name validation

/**
 * Reports whether `c` is an ASCII lowercase letter or digit, the only
 * characters allowed to start a package-name segment.
 *
 * @param c - candidate character
 *
 * @returns whether `c` may start a segment
 *
 * @example
 * ```ts
 * isAlphanumeric('a') // true
 * isAlphanumeric('_') // false
 * ```
 */
function isAlphanumeric(c: string,): boolean {
  return ((c >= 'a') && (c <= 'z')) || ((c >= '0') && (c <= '9'));
}

/**
 * Reports whether `c` may appear after the first character of a segment:
 * an ASCII lowercase-alphanumeric, or one of `-`, `.`, `_`.
 *
 * @param c - candidate character
 *
 * @returns whether `c` is a legal interior segment character
 *
 * @example
 * ```ts
 * isSegmentChar('-') // true
 * isSegmentChar('/') // false
 * ```
 */
function isSegmentChar(c: string,): boolean {
  return isAlphanumeric(c,)
    || (c === '-')
    || (c === '.')
    || (c === '_');
}

/**
 * Reports whether `segment` is a non-empty package-name segment: first
 * character lowercase-alphanumeric, so `__proto__`, leading-dot names, and
 * empty segments are rejected; remaining characters in the npm interior set.
 *
 * @param segment - scope or name portion to validate
 *
 * @returns whether `segment` is a legal package-name segment
 *
 * @example
 * ```ts
 * isNameSegment('oxlint') // true
 * isNameSegment('__proto__') // false
 * ```
 */
function isNameSegment(segment: string,): boolean {
  if (segment.length
    === 0)
    return false;
  if (!isAlphanumeric(segment.charAt(0,),))
    return false;
  for (const c of segment) {
    if (!isSegmentChar(c,))
      return false;
  }
  return true;
}

/**
 * Validates an npm package name: an optional `\@scope/` prefix plus a name,
 * each an {@link isNameSegment}. Unscoped names carry no `/`; scoped names
 * carry exactly one, splitting a non-empty scope from a non-empty name (a
 * second `/` lands in the name segment, where {@link isSegmentChar} rejects it).
 *
 * Rejecting non-name-shaped keys is the first layer of the issue #195
 * prototype-pollution guard; the parser's `Object.create(null)` map is the
 * second, neutralising even name-shaped keys such as `constructor`.
 *
 * @param name - catalog key to validate
 *
 * @returns whether `name` matches the npm package-name grammar
 *
 * @example
 * ```ts
 * isValidPackageName('\@anthropic-ai/sdk') // true
 * isValidPackageName('oxlint') // true
 * isValidPackageName('__proto__') // false
 * ```
 */
export function isValidPackageName(name: string,): boolean {
  /**
   * Whether the name carries an `\@scope/` prefix; drives the slash handling below.
   */
  const scoped = name.startsWith('@',);
  /**
   * Name with any leading `@` removed, so segment splitting sees only scope and name.
   */
  const body = scoped ? name.slice(1,) : name;
  /**
   * Position of the scope separator; `-1` when absent.
   */
  const slashIdx = body.indexOf('/',);
  if (scoped) {
    if (slashIdx <= 0)
      return false;
    return isNameSegment(body.slice(
      0,
      slashIdx,
    ),)
      && isNameSegment(body.slice(slashIdx + 1,),);
  }
  if (slashIdx !== (-1))
    return false;
  return isNameSegment(body,);
}

//endregion Package name validation
