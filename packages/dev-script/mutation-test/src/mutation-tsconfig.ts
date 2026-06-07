/**
 * Container-side TypeScript checker config generation.
 *
 * @example
 * ```ts
 * await writeMutationTsconfig({ packageCwd: '/work/packages/dev-script/file-enforcer' });
 * ```
 */

import { writeFile, } from 'node:fs/promises';
import { join, } from 'node:path';

/**
 * Generated mutation tsconfig file name inside target package work tree.
 */
export const MUTATION_TSCONFIG_NAME = 'tsconfig.mutation.json';

/**
 * JSON-compatible TypeScript config written for Stryker's TypeScript checker.
 */
type MutationTsconfig = {
  readonly include: readonly string[];
  readonly exclude: readonly string[];
  readonly compilerOptions: {
    readonly rootDirs: readonly string[];
    readonly paths: Readonly<Record<string, readonly string[]>>;
    readonly outDir: string;
    readonly strict: true;
    readonly exactOptionalPropertyTypes: true;
    readonly noFallthroughCasesInSwitch: true;
    readonly noImplicitAny: true;
    readonly noImplicitOverride: true;
    readonly noImplicitReturns: true;
    readonly noPropertyAccessFromIndexSignature: false;
    readonly noUncheckedIndexedAccess: true;
    readonly noUnusedLocals: false;
    readonly noUnusedParameters: true;
    readonly noUncheckedSideEffectImports: true;
    readonly preserveWatchOutput: true;
    readonly allowImportingTsExtensions: true;
    readonly module: 'preserve';
    readonly moduleResolution: 'bundler';
    readonly resolveJsonModule: true;
    readonly types: readonly ['bun'];
    readonly noEmit: true;
    readonly declaration: true;
    readonly isolatedDeclarations: true;
    readonly newLine: 'lf';
    readonly noEmitOnError: false;
    readonly verbatimModuleSyntax: true;
    readonly erasableSyntaxOnly: true;
    readonly preserveConstEnums: true;
    readonly allowJs: false;
    readonly checkJs: false;
    readonly disableSizeLimit: true;
    readonly esModuleInterop: true;
    readonly jsx: 'preserve';
    readonly jsxImportSource: 'vue';
    readonly lib: readonly [
      'ESNext',
      'DOM',
      'WebWorker'
    ];
    readonly libReplacement: false;
    readonly target: 'esnext';
    readonly composite: true;
    readonly noErrorTruncation: true;
    readonly skipLibCheck: true;
    readonly assumeChangesOnlyAffectDirectDependencies: true;
  };
};

/**
 * Generated config used by Stryker's TypeScript checker.
 *
 * @returns TypeScript config without package-export `extends` indirection.
 *
 * @example
 * ```ts
 * buildMutationTsconfig().compilerOptions.allowImportingTsExtensions;
 * // true
 * ```
 */
export function buildMutationTsconfig(): MutationTsconfig {
  return {
    include: [
      '**/*.ts',
      '**/*.json',
    ],
    exclude: [
      'dist',
      'bak',
      'node_modules',
      '**/deprecated/**',
      '**/*.svg',
      '**/*.png',
      '**/*.jpg',
      '**/*.jpeg',
      '**/*.gif',
      '**/*.webp',
      '**/*.ico',
      '**/*.woff',
      '**/*.woff2',
      '**/*.ttf',
      '**/*.eot',
      '**/*.mp3',
      '**/*.mp4',
      '**/*.webm',
      '**/*.pdf',
    ],
    compilerOptions: {
      rootDirs: [
        'src',
        '.',
      ],
      paths: {
        '@/*': ['*',],
        '@_/*': ['src/*',],
      },
      outDir: 'dist/final/types',
      strict: true,
      exactOptionalPropertyTypes: true,
      noFallthroughCasesInSwitch: true,
      noImplicitAny: true,
      noImplicitOverride: true,
      noImplicitReturns: true,
      noPropertyAccessFromIndexSignature: false,
      noUncheckedIndexedAccess: true,
      noUnusedLocals: false,
      noUnusedParameters: true,
      noUncheckedSideEffectImports: true,
      preserveWatchOutput: true,
      allowImportingTsExtensions: true,
      module: 'preserve',
      moduleResolution: 'bundler',
      resolveJsonModule: true,
      types: ['bun',],
      noEmit: true,
      declaration: true,
      isolatedDeclarations: true,
      newLine: 'lf',
      noEmitOnError: false,
      verbatimModuleSyntax: true,
      erasableSyntaxOnly: true,
      preserveConstEnums: true,
      allowJs: false,
      checkJs: false,
      disableSizeLimit: true,
      esModuleInterop: true,
      jsx: 'preserve',
      jsxImportSource: 'vue',
      lib: [
        'ESNext',
        'DOM',
        'WebWorker',
      ],
      libReplacement: false,
      target: 'esnext',
      composite: true,
      noErrorTruncation: true,
      skipLibCheck: true,
      assumeChangesOnlyAffectDirectDependencies: true,
    },
  };
}

/**
 * Writes flattened TypeScript checker config inside target package work tree.
 *
 * @param options - Target package working directory.
 *
 * @returns Package-relative generated tsconfig path.
 *
 * @example
 * ```ts
 * await writeMutationTsconfig({ packageCwd: '/work/packages/dev-script/file-enforcer' });
 * // 'tsconfig.mutation.json'
 * ```
 */
export async function writeMutationTsconfig(options: {
  readonly packageCwd: string;
},): Promise<string> {
  /**
   * Absolute generated config path in writable package work tree.
   */
  const configPath = join(
    options.packageCwd,
    MUTATION_TSCONFIG_NAME,
  );
  await writeFile(
    configPath,
    `${JSON.stringify(
      buildMutationTsconfig(),
      null,
      2,
    )}\n`,
    'utf8',
  );
  return MUTATION_TSCONFIG_NAME;
}
