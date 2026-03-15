/**
 * Content generators for the performance benchmark fixture.
 * Produces deterministic documentation, TypeScript, and JSON content
 * for simulated packages.
 */

/** Lines per documentation file (~3KB each at 100 lines) */
const LINES_PER_DOC = 100;

/** Lines per TypeScript source file (~2KB each at 50 lines) */
const LINES_PER_TS = 50;

/** Base timeout in milliseconds for generated package settings */
const BASE_TIMEOUT_MS = 1_000;

/** Timeout increment per package index in generated settings */
const TIMEOUT_INCREMENT_MS = 100;

/**
 * Generates deterministic documentation content for a package.
 * First line is shared across all packages (for dedup testing).
 *
 * @param pkgIndex - Package index (0-19)
 *
 * @param docName - Document basename
 *
 * @returns Multi-line markdown content
 */
export function generateDocContent(pkgIndex: number, docName: string,): string {
  /** Shared header enables meaningful dedup testing across packages */
  const sharedHeader =
    '# Package Documentation\n\nThis is shared boilerplate across all packages.';
  const uniqueLines = Array.from(
    { length: LINES_PER_DOC - 2, },
    function mapDocLine(_unused: unknown, lineIndex: number,) {
      return `Line ${String(lineIndex,)} of ${docName} in package-${
        String(pkgIndex,).padStart(2, '0',)
      }`;
    },
  );
  return `${sharedHeader}\n${uniqueLines.join('\n',)}`;
}

/**
 * Generates deterministic TypeScript source content.
 *
 * @param pkgIndex - Package index (0-19)
 *
 * @param fileName - Source file basename
 *
 * @returns Multi-line TypeScript content
 */
export function generateTsContent(pkgIndex: number, fileName: string,): string {
  return Array
    .from(
      { length: LINES_PER_TS, },
      function mapTsLine(_unused: unknown, lineIndex: number,) {
        return `export const pkg${String(pkgIndex,).padStart(2, '0',)}_${fileName}_line${
          String(lineIndex,)
        } = ${String(lineIndex,)};`;
      },
    )
    .join('\n',);
}

/**
 * Generates a feature name for a given index.
 *
 * @param _unused - Unused array element placeholder
 *
 * @param featureIndex - Feature index within the package
 *
 * @returns Feature name string
 */
function generateFeatureName(_unused: unknown, featureIndex: number,): string {
  return `feature-${String(featureIndex,)}`;
}

/**
 * Generates a dependency entry for a given index.
 *
 * @param _unused - Unused array element placeholder
 *
 * @param depIndex - Dependency index within the package
 *
 * @returns Tuple of dependency name and version
 */
function generateDepEntry(_unused: unknown, depIndex: number,): [string, string,] {
  return [`dep-${String(depIndex,)}`, `^${String(depIndex + 1,)}.0.0`,];
}

/**
 * Generates a settings.json with nested structure for getProperty testing.
 *
 * @param pkgIndex - Package index (0-19)
 *
 * @returns Formatted JSON string (~500 bytes)
 */
export function generateSettingsJson(pkgIndex: number,): string {
  /** Feature count per package, enough to test array extraction */
  const FEATURES_PER_PACKAGE = 10;
  /** Dependency count per package */
  const DEPS_PER_PACKAGE = 5;

  return JSON.stringify(
    {
      name: `package-${String(pkgIndex,).padStart(2, '0',)}`,
      version: '1.0.0',
      config: {
        debug: pkgIndex % 2 === 0,
        timeout: BASE_TIMEOUT_MS + pkgIndex * TIMEOUT_INCREMENT_MS,
        features: Array.from(
          { length: FEATURES_PER_PACKAGE, },
          generateFeatureName,
        ),
      },
      dependencies: Object.fromEntries(
        Array.from(
          { length: DEPS_PER_PACKAGE, },
          generateDepEntry,
        ),
      ),
    },
    null,
    2,
  );
}
