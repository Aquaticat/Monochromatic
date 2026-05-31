/**
 * CSS @import specifier parsing utilities.
 *
 * Extracts bare specifiers from CSS @import syntax (quoted strings, `url()` wrappers),
 * classifies them as relative or package references, and splits package specifiers
 * into name and subpath components.
 */

//region Specifier Parsing

/**
 * Strips quotes and `url()` wrapper from a CSS \@import specifier.
 * Handles: `'foo.css'`, `"foo.css"`, `url('foo.css')`, `url("foo.css")`, `url(foo.css)`
 *
 * @param raw - Raw \@import params string
 *
 * @returns Bare specifier without quotes or url() wrapper
 *
 * @example
 * ```ts
 * stripImportSpecifier("url('\@scope/pkg/style.css')") // → '\@scope/pkg/style.css'
 * ```
 */
export function stripImportSpecifier(raw: string,): string {
  /**
   * Trimmed input for consistent handling
   */
  const trimmed = raw.trim();

  /**
   * Length of the "url(" prefix.
   */
  const URL_PREFIX_LENGTH = 4;

  // url(...) wrapper
  if (trimmed.startsWith('url(',)
    && trimmed
    .endsWith(')',)) {
    /**
     * Inner content of url()
     */
    const inner = trimmed
      .slice(
        URL_PREFIX_LENGTH,
        -1,
      )
      .trim();
    // Strip inner quotes if present
    if ((inner.startsWith("'",)
      && inner
      .endsWith("'",))
      || (inner.startsWith('"',)
        && inner
        .endsWith('"',)))
    {
      return inner.slice(
        1,
        -1,
      );
    }
    return inner;
  }

  // Quoted string
  if ((trimmed.startsWith("'",)
    && trimmed
    .endsWith("'",))
    || (trimmed.startsWith('"',)
      && trimmed
      .endsWith('"',)))
  {
    return trimmed.slice(
      1,
      -1,
    );
  }

  return trimmed;
}

/**
 * Whether a specifier looks like a package reference (not relative or absolute).
 *
 * @param specifier - Bare import specifier
 *
 * @returns True for package-like specifiers (`\@scope/pkg/...` or `pkg/...`)
 *
 * @example
 * ```ts
 * isPackageSpecifier('\@scope/pkg/style.css') // → true
 * isPackageSpecifier('./local.css')          // → false
 * ```
 */
export function isPackageSpecifier(specifier: string,): boolean {
  return (!specifier.startsWith('.',)) && (!specifier.startsWith('/',));
}

/**
 * Splits a package specifier into package name and subpath.
 * Handles scoped (`\@scope/pkg/sub.css`) and unscoped (`pkg/sub.css`) packages.
 *
 * @param specifier - Bare package specifier
 *
 * @returns Tuple of [packageName, subpath] where subpath starts with `./` or is `.`
 *
 * @example
 * ```ts
 * splitPackageSpecifier('\@scope/pkg/sub/path.css') // → ['\@scope/pkg', './sub/path.css']
 * splitPackageSpecifier('pkg')                     // → ['pkg', '.']
 * ```
 */
export function splitPackageSpecifier(specifier: string,): [
  string,
  string,
] {
  if (specifier.startsWith('@',)) {
    // Scoped: @scope/pkg or @scope/pkg/sub/path.css
    /**
     * Index of the second slash (after \@scope/pkg).
     */
    const secondSlash = specifier.indexOf(
      '/',
      specifier.indexOf('/',)
        + 1,
    );
    if (secondSlash === (-1)) {
      return [
        specifier,
        '.',
      ];
    }
    return [
      specifier.slice(
        0,
        secondSlash,
      ),
      `./${specifier.slice(secondSlash + 1,)}`,
    ];
  }

  // Unscoped: pkg or pkg/sub/path.css
  /**
   * Index of the first slash
   */
  const firstSlash = specifier.indexOf('/',);
  if (firstSlash === (-1)) {
    return [
      specifier,
      '.',
    ];
  }
  return [
    specifier.slice(
      0,
      firstSlash,
    ),
    `./${specifier.slice(firstSlash + 1,)}`,
  ];
}

//endregion Specifier Parsing
