/**
 * Builds the system prompt for code-generation probes at module load time.
 *
 * Reads the actual project configs (oxlintrc, tsconfig) at runtime so the
 * model is graded against the exact same rules that are in force for the project.
 *
 * The root `oxlint.config.ts` is a thin re-export of `@monochromatic-dev/config-oxlint`,
 * so on its own it tells the model nothing about which rules are active.
 * To close that gap, we also embed every rule module source file from the
 * shared config package. These files contain the actual severity mappings
 * and inline comments explaining each rule; enough for a model to comply
 * without a hand-curated cheat sheet.
 *
 * Custom JS plugin rules (`tsdoc/*`, `no-restricted-syntax/*`, `stylistic/*`)
 * are not printed by `oxlint --print-config`, so the rule modules are the
 * only source of truth for their severity.
 */
import {
  readdir,
  readFile,
} from 'node:fs/promises';
import {
  join,
  relative,
} from 'node:path';

import { l, } from '../log.ts';

/**
 * Monorepo root, resolved from this file's location (src/codegen/ → 5 levels up)
 */
const MONOREPO_ROOT = new URL(
  '../../../../../',
  import.meta.url,
)
  .pathname;

/**
 * Reads a project config file relative to the monorepo root.
 *
 * @param relativePath - path relative to monorepo root
 *
 * @returns file content
 */
async function readConfig(relativePath: string,): Promise<string> {
  return await readFile(
    join(
      MONOREPO_ROOT,
      relativePath,
    ),
    'utf8',
  );
}

/**
 * Directory containing the shared oxlint config source modules.
 */
const OXLINT_CONFIG_SRC = 'packages/config/oxlint/src';

/**
 * Discovers every rule module under the shared oxlint config package.
 *
 * Recursively walks `packages/config/oxlint/src/`, collecting all `.ts`
 * files except the entry-point `index.ts` (which only composes and
 * re-exports the rule modules). Results are sorted for deterministic
 * prompt output.
 *
 * @returns sorted relative paths (from monorepo root)
 */
async function discoverRuleModules(): Promise<string[]> {
  /**
   * Absolute path to the shared oxlint config source tree; resolves relative paths returned by `readdir`.
   */
  const absoluteDir = join(
    MONOREPO_ROOT,
    OXLINT_CONFIG_SRC,
  );
  /**
   * Directory entries under `absoluteDir` traversed recursively to discover every rule module.
   */
  const entries = await readdir(
    absoluteDir,
    {
      recursive: true,
      withFileTypes: true,
    },
  );

  return entries
    .filter(function isRuleModule(entry,): boolean {
      return entry.isFile()
        && entry
        .name
        .endsWith('.ts',)
        && (entry.name
          !== 'index.ts');
    },)
    .map(function toRelativePath(entry,): string {
      return join(
        OXLINT_CONFIG_SRC,
        relative(
          absoluteDir,
          join(
            entry.parentPath,
            entry.name,
          ),
        ),
      );
    },)
    .toSorted();
}

/**
 * Builds the system prompt by reading the actual project configs at runtime.
 *
 * @returns complete system prompt with embedded config contents
 */
async function buildSystemPrompt(): Promise<string> {
  /**
   * Discovered rule module paths; iterated below to read each module's source and align it with the awaited result.
   */
  const ruleModulePaths = await discoverRuleModules();

  /**
   * Awaited config sources: oxlintrc, tsconfig, then each rule module in `ruleModulePaths` order.
   */
  const [oxlintrc, tsconfig, ...ruleModules] = await Promise.all([
    readConfig('oxlint.config.ts',),
    readConfig(
      'node_modules/@monochromatic-dev/config-typescript/tsconfig.options.json',
    ),
    ...ruleModulePaths.map(function readRuleModule(path,): Promise<string> {
      return readConfig(path,);
    },),
  ],);

  /**
   * Rendered "=== path === \\n source" sections, one per rule module, embedded into the prompt below.
   */
  const ruleModuleSections = ruleModulePaths.map(
    function formatRuleModule(
      path,
      index,
    ): string {
      return `=== ${path} ===\n${ruleModules[index]}`;
    },
  );

  return [
    'You are a senior TypeScript developer writing production-quality code.',
    'Output ONLY the TypeScript source code inside a single fenced code block.',
    'No explanation, no commentary, no imports from external packages.',
    'The code must run directly with `bun run file.ts`.',
    '',
    'Your code will be evaluated against the following project configurations.',
    'Lint errors count 3x more than warnings in scoring. Type errors also reduce score.',
    '',
    '=== oxlint configuration (oxlint.config.ts) ===',
    oxlintrc,
    '',
    'The root config re-exports from @monochromatic-dev/config-oxlint.',
    'Below are the actual rule modules that define every rule severity.',
    'Rules from custom JS plugins (tsdoc/*, no-restricted-syntax/*, stylistic/*)',
    'are defined here and not visible in oxlint --print-config output.',
    '',
    ...ruleModuleSections,
    '',
    '=== TypeScript compiler options (tsconfig) ===',
    tsconfig,
    '',
    'Note: the eslint/max-lines rule is disabled for your output. There is no line count limit.',
  ]
    .join('\n',);
}

/**
 * System prompt built at module load time via top-level await.
 * Contains the full project configs so the model knows exactly what rules apply.
 */
export const CODE_GEN_SYSTEM: string = await buildSystemPrompt();
l.info(`system prompt loaded (${String(CODE_GEN_SYSTEM.length,)} chars)`,);
