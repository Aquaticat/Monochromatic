import { dirname, } from 'node:path';
import { ResolverFactory, } from 'oxc-resolver';

//region Types

/** Build options for the CSS processor */
export type BuildOptions = {
  /** Input CSS file path */
  input: string;
  /** Output CSS file path */
  output: string;
  /** Enable watch mode */
  watch?: boolean;
};

//endregion Types

//region Resolver

/**
 * Creates an oxc-resolver instance configured for CSS module resolution.
 * Supports package.json exports fields and style-specific main fields.
 * @returns Configured ResolverFactory
 */
export function createResolver(): ResolverFactory {
  return new ResolverFactory({
    extensions: ['.css'],
    mainFields: ['style', 'main'],
    conditionNames: ['style', 'default', 'import'],
    exportsFields: [['exports']],
  });
}

/**
 * Resolves a CSS import specifier to an absolute file path.
 * Uses oxc-resolver for node_modules and package.json exports resolution.
 * Falls back to relative resolution for bare specifiers that CSS treats as
 * relative paths (e.g. `\@import 'tods.css'` without `./` prefix).
 * @param resolver - Configured oxc-resolver instance
 * @param specifier - Import path from \@import statement
 * @param from - Absolute path of the importing file
 * @returns Resolved absolute path
 * @throws When the specifier cannot be resolved by any strategy
 */
export function resolveImport(resolver: ResolverFactory, specifier: string, from: string): string {
  const fromDir = dirname(from);
  const result = resolver.sync(fromDir, specifier);

  if (result.path !== undefined) {
    return result.path;
  }

  // CSS @import treats bare specifiers like 'tods.css' as relative paths,
  // unlike JS where they would be package references. Try with './' prefix.
  if (!specifier.startsWith('.') && !specifier.startsWith('/') && !specifier.startsWith('@')) {
    const relativeResult = resolver.sync(fromDir, `./${specifier}`);
    if (relativeResult.path !== undefined) {
      return relativeResult.path;
    }
  }

  throw new Error(
    `Failed to resolve CSS import '${specifier}' from '${from}': ${result.error ?? 'unknown error'}`,
  );
}

//endregion Resolver
