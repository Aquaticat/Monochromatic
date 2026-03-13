/**
 * Builds the system prompt for code-generation probes at module load time.
 *
 * Reads the actual project configs (oxlintrc, tsconfig) at runtime so the
 * model is graded against the exact same rules that are in force for the project.
 */
import { readFile, } from 'node:fs/promises';
import { join, } from 'node:path';

/** Monorepo root, resolved from this file's location (src/codegen/ → 5 levels up) */
const MONOREPO_ROOT = new URL('../../../../../', import.meta.url).pathname;

/**
 * Reads a project config file relative to the monorepo root.
 *
 * @param relativePath - path relative to monorepo root
 *
 * @returns file content
 */
async function readConfig(relativePath: string): Promise<string> {
  return readFile(join(MONOREPO_ROOT, relativePath), 'utf8');
}

/**
 * Builds the system prompt by reading the actual project configs at runtime.
 *
 * @returns complete system prompt with embedded config contents
 */
async function buildSystemPrompt(): Promise<string> {
  const [oxlintrc, tsconfig] = await Promise.all([
    readConfig('.oxlintrc.json'),
    readConfig('node_modules/@monochromatic-dev/config-typescript/tsconfig.options.json'),
  ]);

  return [
    'You are a senior TypeScript developer writing production-quality code.',
    'Output ONLY the TypeScript source code inside a single fenced code block.',
    'No explanation, no commentary, no imports from external packages.',
    'The code must run directly with `bun run file.ts`.',
    '',
    'Your code will be evaluated against the following project configurations.',
    'Lint errors count 3x more than warnings in scoring. Type errors also reduce score.',
    '',
    '=== oxlint configuration (.oxlintrc.json) ===',
    oxlintrc,
    '',
    '=== TypeScript compiler options (tsconfig) ===',
    tsconfig,
    '',
    'Key rules to pay attention to:',
    '- explicit-function-return-type: error (all functions need explicit return types)',
    '- require-tsdoc: error (all declarations need TSDoc comments)',
    '- import/unambiguous: error (files need import/export to be parsed as modules)',
    '- no-magic-numbers: warn (except -2, -1, 0, 1, 2, 255, 0.1, 10)',
    '- consistent-type-definitions: type aliases, not interfaces',
    '- strict TypeScript: noUncheckedIndexedAccess, exactOptionalPropertyTypes',
    '- verbatimModuleSyntax: use `import type` for type-only imports',
    '- prefer const over let, functional patterns over imperative loops',
    '- never use single-letter variable names',
  ].join('\n');
}

/**
 * System prompt built at module load time via top-level await.
 * Contains the full project configs so the model knows exactly what rules apply.
 */
export const CODE_GEN_SYSTEM = await buildSystemPrompt();
console.log(`[canary] system prompt loaded (${String(CODE_GEN_SYSTEM.length)} chars)`);
