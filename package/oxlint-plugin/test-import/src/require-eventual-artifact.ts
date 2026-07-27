/**
 * The `require-eventual-artifact` rule.
 *
 * Test files must reach their own package's behavior through the artifact that
 * package ships, not through sibling source. The convention is empirical rather
 * than aesthetic: defects have survived the suite by existing only in built
 * output, so a module tested through source proves nothing about what ships.
 *
 * @module
 */

import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import type {
  Context,
  CreateOnceRule,
  ESTree,
  VisitorWithHooks,
} from '@oxlint/plugins';
import { dirname, } from 'node:path';

import {
  DEFAULT_FIXTURE_PATTERNS,
  isCheckedFile,
} from './checked-file.ts';
import { classifyImport, } from './import-classification.ts';
import {
  type OwningPackage,
  owningPackage,
  PACKAGE_UNRESOLVED,
} from './owning-package.ts';
import { toPosixPath, } from './posix-path.ts';

/**
 * Sentinel meaning the linter offered a file this rule does not inspect.
 */
const FILE_OUT_OF_SCOPE: unique symbol = Symbol(
  'linted path outside the artifact-boundary check, such as ordinary source or a buildless package',
);

/**
 * Everything one checked file needs before its imports can be classified.
 */
type CheckedFileContext = {
  /**
   * Package owning the file under lint.
   */
  readonly owner: OwningPackage;
  /**
   * Directory relative specifiers in this file resolve against.
   */
  readonly containingDirectory: string;
};

/**
 * Narrows an unknown value to a read-only array view.
 *
 * `Array.isArray` alone widens its subject to `any[]`, which presents the
 * mutable `Array` interface at every later call. Landing on `ReadonlyArray`
 * instead keeps traversal on the view TypeScript declares free of receiver
 * mutation.
 *
 * Takes a positional parameter because a type predicate cannot reference a
 * destructured binding.
 *
 * @param value - candidate array
 *
 * @returns true when value is an array
 *
 * @example
 * ```ts
 * isUnknownArray(['**\/fixture.*']);
 * ```
 */
function isUnknownArray(value: unknown,): value is readonly unknown[] {
  return Array.isArray(value,);
}

/**
 * Reads the configured fixture globs from rule options.
 *
 * Falls back to {@link DEFAULT_FIXTURE_PATTERNS} whenever options are absent or
 * carry an unrecognised shape; non-string entries in a supplied array are
 * dropped rather than silently matching nothing.
 *
 * @param options - rule options array; first element optionally carries `fixturePatterns`
 *
 * @returns resolved glob list
 *
 * @example
 * ```ts
 * readFixturePatterns(context.options ?? []);
 * ```
 */
function readFixturePatterns(options: readonly unknown[],): readonly string[] {
  if (!Array.isArray(options,))
    return DEFAULT_FIXTURE_PATTERNS;
  /**
   * First element of the options array, where the option object conventionally sits.
   */
  const first: unknown = options[0];
  if (((typeof first) !== 'object') || (first === null))
    return DEFAULT_FIXTURE_PATTERNS;
  if (!('fixturePatterns' in first))
    return DEFAULT_FIXTURE_PATTERNS;
  /**
   * Configured glob array; absent or mistyped falls back to the defaults.
   */
  const { fixturePatterns, } = first;
  if (!isUnknownArray(fixturePatterns,))
    return DEFAULT_FIXTURE_PATTERNS;
  return fixturePatterns.filter(function keepStrings(value,): value is string {
    return (typeof value) === 'string';
  },);
}

/**
 * Decides whether a file is in scope and gathers what classification needs.
 *
 * Three conditions must hold: the file is a test, benchmark, or test-only
 * helper; it belongs to a package; and that package declares a build task, so
 * that an artifact exists to import in the first place.
 *
 * @param fileName - absolute path reported by the linter
 *
 * @param fixturePatterns - configured fixture globs
 *
 * @returns file context, or {@link FILE_OUT_OF_SCOPE} when the file is not inspected
 *
 * @example
 * ```ts
 * checkedFileContext({ fileName: context.filename, fixturePatterns });
 * ```
 */
function checkedFileContext({
  fileName,
  fixturePatterns,
}: {
  /**
   * Absolute path reported by the linter.
   */
  readonly fileName: string;
  /**
   * Configured fixture globs.
   */
  readonly fixturePatterns: readonly string[];
},): CheckedFileContext | typeof FILE_OUT_OF_SCOPE {
  if (!isCheckedFile({
    patterns: fixturePatterns,
    path: toPosixPath({ path: fileName, },),
  },))
    return FILE_OUT_OF_SCOPE;

  /**
   * Package owning the file, absent when no ancestor holds a named manifest.
   */
  const owner = owningPackage({ fileName, },);
  if (owner === PACKAGE_UNRESOLVED)
    return FILE_OUT_OF_SCOPE;
  // A package that builds nothing ships nothing, so the rule is vacuous there.
  if (!owner.buildsArtifact)
    return FILE_OUT_OF_SCOPE;

  return {
    owner,
    containingDirectory: dirname(fileName,),
  };
}

/**
 * Requires test files to import their own package's built artifact.
 *
 * Checks every static `import` declaration, including `import type`. A relative
 * specifier is allowed when it lands inside a directory the package ships, or
 * when it names a test-only fixture or helper. The package's own bare name is
 * allowed because it resolves through the exports map, which is the one form
 * that exercises the export map itself. The package's own `/ts` subpath is
 * rejected: it is the sanctioned channel for reaching *another* package's
 * source, never for reaching your own.
 *
 * Specifiers naming other packages are left alone entirely.
 *
 * @example
 * ```ts
 * // Bad; reaches sibling source, so the built artifact goes untested
 * import { parse } from './parse.ts';
 *
 * // Bad; the package's own source through its own `/ts` subpath
 * import { parse } from '\@scope/my-package/ts/parse.ts';
 *
 * // Good; the artifact consumers load
 * import { parse } from '../dist/final/node/index.mjs';
 *
 * // Good; resolves through the exports map
 * import { parse } from '\@scope/my-package';
 * ```
 *
 * @internal
 */
export const requireEventualArtifact: CreateOnceRule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require test files to import their own package\'s built artifact instead of its source.',
      recommended: true,
    },
    messages: {
      relativeSource: 'Test imports `{{specifier}}`, which resolves to package source rather than built output. '
        + 'Import the artifact the package ships (for example `../dist/final/node/index.mjs`) so the test exercises what consumers load. '
        + 'If the symbol is not exported yet, export it from the package entry and mark it `@internal`.',
      ownSourceSubpath: 'Test imports `{{specifier}}`, its own package\'s source through the `/ts` subpath. '
        + 'The `/ts` subpath exists for reaching another package\'s source; within a package, import the built artifact or the package\'s own bare name.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          fixturePatterns: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [
      {
        fixturePatterns: [...DEFAULT_FIXTURE_PATTERNS,],
      },
    ],
  },
  /**
   * Handles foreign Oxlint callback.
   *
   * @param context - Foreign rule context receiving diagnostics.
   *
   * @mutates context - Emits Oxlint diagnostics through foreign rule context.
   *
   * @example
   * ```ts
   * createOnce(context);
   * ```
   */
  createOnce(context: ForeignBorrowed<Context>,): VisitorWithHooks {
    /**
     * Raw rule options; oxlint omits this until config supplies them.
     */
    const { options, } = context;
    /**
     * Fixture globs resolved once for the whole lint run.
     */
    const fixturePatterns = readFixturePatterns(options ?? [],);

    return {
      before() {
        // Skipping the whole traversal is what keeps the rule cheap on the
        // vast majority of files, which are neither tests nor test helpers.
        if (checkedFileContext({
          fileName: context.filename,
          fixturePatterns,
        },) === FILE_OUT_OF_SCOPE)
          return false;
        return undefined;
      },
      ImportDeclaration(node: ForeignBorrowed<ESTree.ImportDeclaration>,): void {
        /**
         * File context; recomputed per import from memoized package data rather
         * than held in visitor state, so nothing has to be reset between files.
         */
        const fileContext = checkedFileContext({
          fileName: context.filename,
          fixturePatterns,
        },);
        if (fileContext === FILE_OUT_OF_SCOPE)
          return;

        /**
         * Literal specifier text of this import declaration.
         */
        const specifier = node
          .source
          .value;
        if ((typeof specifier) !== 'string')
          return;

        /**
         * Verdict for this specifier against the owning package.
         */
        const outcome = classifyImport({
          specifier,
          containingDirectory: fileContext.containingDirectory,
          owner: fileContext.owner,
          fixturePatterns,
        },);

        if (outcome === 'relative-source') {
          context.report({
            node: node.source,
            messageId: 'relativeSource',
            data: { specifier, },
          },);
          return;
        }
        if (outcome === 'own-source-subpath') {
          context.report({
            node: node.source,
            messageId: 'ownSourceSubpath',
            data: { specifier, },
          },);
        }
      },
    } as VisitorWithHooks;
  },
};
