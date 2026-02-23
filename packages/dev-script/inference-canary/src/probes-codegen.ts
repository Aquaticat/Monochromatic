/**
 * Complex code-generation probes designed at the boundary of model capability.
 *
 * Each probe asks the model to write a TypeScript CLI that does something
 * genuinely hard -- tasks where even a healthy model won't score 100%.
 * This makes subtle degradation detectable: a drop from 70% to 40% is clear signal.
 *
 * Scoring combines three dimensions:
 * 1. **Correctness** (40%): does the code execute and produce correct output?
 * 2. **Lint quality** (30%): oxlint violations split by severity (errors weighted 3x warnings)
 * 3. **Type safety** (30%): TypeScript type errors from tsgo with the monorepo's strict tsconfig
 */
import { readFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import { runInContainer, } from './container.ts';
import { lintSource, } from './linter.ts';

import type { LintResult, } from './linter.ts';
import type { Probe, ScoreContext, } from './probes.ts';

//region Shared

/** Monorepo root, resolved from this file's location */
const MONOREPO_ROOT = new URL('../../../../', import.meta.url).pathname;

/**
 * Reads a project config file and returns its content as a string.
 * @param relativePath - path relative to the monorepo root
 * @returns file content
 */
async function readConfig(relativePath: string): Promise<string> {
  return readFile(join(MONOREPO_ROOT, relativePath), 'utf8');
}

/**
 * Builds the system prompt by reading the actual project configs at runtime.
 * This keeps the prompt in sync with the real rules the code will be graded against.
 * @returns complete system prompt with embedded config contents
 */
async function buildSystemPrompt(): Promise<string> {
  const [oxlintrc, tsconfig, eslintConfig] = await Promise.all([
    readConfig('.oxlintrc.json'),
    readConfig('node_modules/@monochromatic-dev/config-typescript/tsconfig.options.json'),
    readConfig('packages/config/eslint/src/index.ts'),
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
    '=== ESLint configuration (eslint.config.ts) ===',
    eslintConfig,
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
const CODE_GEN_SYSTEM = await buildSystemPrompt();
console.log(`[canary] system prompt loaded (${String(CODE_GEN_SYSTEM.length)} chars)`);

/**
 * Extracts TypeScript code from a model response, stripping markdown fences.
 * @param response - raw model output that may contain markdown code blocks
 * @returns extracted TypeScript source, or the raw response if no fences found
 */
function extractCode(response: string): string {
  // Try matching a complete fenced block first
  const closedFence = /```(?:typescript|ts)?\n([\s\S]*?)```/.exec(response);
  if (closedFence !== null && closedFence[1] !== undefined) return closedFence[1];

  // Handle unclosed fence: model output the opening but not the closing
  const openFence = /```(?:typescript|ts)?\n([\s\S]*)/.exec(response);
  if (openFence !== null && openFence[1] !== undefined) return openFence[1];

  return response;
}

//region Scoring weights and ceilings

/** Weight for each scoring dimension */
const CORRECTNESS_WEIGHT = 0.4;
const LINT_WEIGHT = 0.3;
const TYPE_WEIGHT = 0.3;

/**
 * Lint errors are weighted 3x warnings because errors indicate correctness
 * or security issues, while warnings are stylistic.
 */
const ERROR_MULTIPLIER = 3;

/**
 * Weighted lint violation count at which the lint score becomes 0.
 * With -W all, a healthy model produces ~30 warnings and ~10 errors,
 * giving a weighted count of ~60. Ceiling at 100 gives room above.
 */
const LINT_WEIGHTED_CEILING = 100;

/**
 * Number of type errors at which the type score becomes 0.
 * Generated code is standalone (no project imports), so a healthy model
 * should produce few type errors under strict mode.
 */
const TYPE_ERROR_CEILING = 20;

//endregion Scoring weights and ceilings

/**
 * Combines correctness, lint quality, and type safety into a final score.
 *
 * Lint score uses weighted violations: errors count 3x more than warnings.
 * Type score decays linearly with the number of tsgo errors.
 *
 * @param correctness - 0-1 score from output verification
 * @param lint - full lint result with severity breakdown and type errors
 * @returns weighted combined score
 */
function combinedScore(correctness: number, lint: LintResult): number {
  const weightedViolations =
    (lint.severity.errors * ERROR_MULTIPLIER) + lint.severity.warnings;
  const lintScore = Math.max(0, 1 - (weightedViolations / LINT_WEIGHTED_CEILING));

  const typeScore = Math.max(0, 1 - (lint.typeErrors / TYPE_ERROR_CEILING));

  return (correctness * CORRECTNESS_WEIGHT)
    + (lintScore * LINT_WEIGHT)
    + (typeScore * TYPE_WEIGHT);
}

/**
 * Runs oxlint and tsgo on generated source, logs results per probe.
 * @param source - TypeScript source to analyze
 * @param probeName - probe name for log prefixes
 * @param context - model identity and pass for artifact organization
 * @returns full lint result for scoring
 */
async function lintAndLog(source: string, probeName: string, context: ScoreContext): Promise<LintResult> {
  const lint = await lintSource(source, {
    model: context.modelId,
    probe: probeName,
    pass: context.pass,
    timestamp: new Date().toISOString(),
  });
  if (lint.linterRan) {
    console.log(
      `    [lint:${probeName}] errors=${String(lint.severity.errors)}`
      + ` warnings=${String(lint.severity.warnings)}`
      + ` rules=[${lint.violatedRules.slice(0, 5).join(', ')}]`,
    );
  }
  if (lint.typeCheckerRan) {
    console.log(`    [type:${probeName}] errors=${String(lint.typeErrors)}`);
  }
  return lint;
}

/**
 * Builds a fix prompt for the second pass: sends the model its own code
 * plus the linter/type-checker diagnostics and asks it to fix everything.
 * Returns undefined if there are no diagnostics to fix.
 * @param response - raw model output from the first pass
 * @param context - model identity and pass for artifact organization
 * @returns follow-up user message, or undefined to skip
 */
async function buildCodeGenFixPrompt(response: string, context: ScoreContext): Promise<string | undefined> {
  const source = extractCode(response);
  const lint = await lintSource(source, {
    model: context.modelId,
    probe: 'fix-prompt',
    pass: context.pass,
    timestamp: new Date().toISOString(),
  });
  const totalIssues = lint.violationCount + lint.typeErrors;

  if (totalIssues === 0 || lint.rawDiagnostics.length === 0) return undefined;

  return [
    'Here is your code from the previous response:',
    '',
    '```typescript',
    source,
    '```',
    '',
    `It has ${String(lint.severity.errors)} lint errors, ${String(lint.severity.warnings)} lint warnings, and ${String(lint.typeErrors)} type errors.`,
    'Here are the diagnostics:',
    '',
    lint.rawDiagnostics,
    '',
    'Fix all the issues. Output ONLY the complete fixed TypeScript source in a single fenced code block.',
  ].join('\n');
}

//endregion Shared

//region Probe: RFC 4180 CSV parser with escaping edge cases

/**
 * Full RFC 4180 CSV parser including escaped quotes, multiline fields,
 * and mixed line endings. This is hard because most models get the
 * escaped-quote-within-quoted-field case wrong.
 */
const csvRfc4180: Probe = {
  name: 'csv-rfc4180',
  category: 'code-gen',
  system: CODE_GEN_SYSTEM,
  buildFixPrompt: buildCodeGenFixPrompt,
  prompt: [
    'Write a TypeScript CLI that parses RFC 4180 compliant CSV from stdin and outputs a JSON array to stdout.',
    'Requirements:',
    '- First row is the header; each subsequent row becomes an object keyed by header names',
    '- Handle quoted fields containing commas, newlines, and escaped quotes (doubled: "")',
    '- Handle fields that are NOT quoted alongside fields that ARE quoted in the same row',
    '- Trim whitespace from unquoted values only (preserve whitespace in quoted values)',
    '- Handle both \\r\\n and \\n line endings',
    '- Print the JSON array with 2-space indentation',
    '',
    'Example input (note the escaped quote and newline inside a quoted field):',
    'name,bio,age',
    '"O\'Brien, ""Bob""","likes\\ntravel",30',
    'Jane,simple,25',
  ].join('\n'),
  score: async (response, context) => {
    const source = extractCode(response);

    // Container execution and host-side linting are independent -- run in parallel
    const testInput = 'name,bio,age\n"O\'Brien, ""Bob""","likes\ntravel",30\nJane,simple,25\n';
    const [result, lint] = await Promise.all([
      runInContainer(source, testInput),
      lintAndLog(source, 'csv-rfc4180', context),
    ]);

    if (result.timedOut || result.exitCode !== 0) return combinedScore(0, lint);

    try {
      const parsed = JSON.parse(result.stdout.trim()) as Record<string, string>[];
      if (!Array.isArray(parsed) || parsed.length !== 2) return combinedScore(0.1, lint);

      const first = parsed[0];
      if (first === undefined) return combinedScore(0.1, lint);

      /** The hardest part: escaped quote inside quoted field */
      const nameCorrect = first['name'] === 'O\'Brien, "Bob"';
      /** Newline preserved inside quoted field */
      const bioCorrect = first['bio'] === 'likes\ntravel';
      const ageCorrect = first['age'] === '30';

      const second = parsed[1];
      if (second === undefined) return combinedScore(0.2, lint);
      const name2Correct = second['name'] === 'Jane';
      const bio2Correct = second['bio'] === 'simple';

      const TOTAL_CHECKS = 5;
      const correctCount = [nameCorrect, bioCorrect, ageCorrect, name2Correct, bio2Correct]
        .filter(Boolean).length;

      return combinedScore(correctCount / TOTAL_CHECKS, lint);
    } catch {
      return combinedScore(0.05, lint);
    }
  },
};

//endregion Probe: RFC 4180 CSV parser

//region Probe: expression evaluator with operator precedence

/**
 * Asks the model to implement a recursive-descent parser for arithmetic expressions
 * with correct operator precedence and parentheses. This requires understanding
 * grammar rules and recursive parsing -- a task where models frequently get
 * precedence wrong or fail on nested parentheses.
 */
const expressionEvaluator: Probe = {
  name: 'expr-eval',
  category: 'code-gen',
  system: CODE_GEN_SYSTEM,
  buildFixPrompt: buildCodeGenFixPrompt,
  prompt: [
    'Write a TypeScript CLI that reads arithmetic expressions from stdin (one per line) and prints results to stdout (one per line).',
    'Requirements:',
    '- Support +, -, *, / with standard mathematical precedence (* and / before + and -)',
    '- Support parentheses for grouping with arbitrary nesting depth',
    '- Support negative numbers (e.g., -3, --5)',
    '- Support floating point numbers (e.g., 3.14)',
    '- Division by zero should output "ERR"',
    '- Invalid expressions should output "ERR"',
    '- Do NOT use eval(), new Function(), or any equivalent',
    '- Implement the parser yourself using recursive descent',
    '',
    'Example input:',
    '2 + 3 * 4',
    '(2 + 3) * 4',
    '10 / (5 - 5)',
    '-3 + 4 * -2',
    '((1 + 2) * (3 + 4))',
    '',
    'Expected output:',
    '14',
    '20',
    'ERR',
    '-11',
    '21',
  ].join('\n'),
  score: async (response, context) => {
    const source = extractCode(response);

    const testInput = '2 + 3 * 4\n(2 + 3) * 4\n10 / (5 - 5)\n-3 + 4 * -2\n((1 + 2) * (3 + 4))\n3.5 * 2 + 1.5\n';
    const [result, lint] = await Promise.all([
      runInContainer(source, testInput),
      lintAndLog(source, 'expr-eval', context),
    ]);

    if (result.timedOut || result.exitCode !== 0) return combinedScore(0, lint);

    const lines = result.stdout.trim().split('\n').map((line) => line.trim());
    /** Expected results for each expression */
    const expected = ['14', '20', 'ERR', '-11', '21', '8.5'];

    const TOTAL = expected.length;
    const correctCount = expected.filter((exp, index) => {
      const actual = lines[index];
      if (actual === undefined) return false;
      if (exp === 'ERR') return actual === 'ERR';
      /** Allow floating point tolerance */
      return Math.abs(Number(actual) - Number(exp)) < 0.001;
    }).length;

    return combinedScore(correctCount / TOTAL, lint);
  },
};

//endregion Probe: expression evaluator

//region Probe: concurrent task scheduler with dependency resolution

/**
 * Asks the model to implement a concurrent task scheduler that respects
 * dependencies and parallelism limits. This combines algorithm knowledge
 * (topological sort), async programming, and resource management.
 * Models often get the concurrency limiting wrong or deadlock.
 */
const taskScheduler: Probe = {
  name: 'task-scheduler',
  category: 'code-gen',
  slow: true,
  buildFixPrompt: buildCodeGenFixPrompt,
  system: CODE_GEN_SYSTEM,
  prompt: [
    'Write a TypeScript CLI that simulates a concurrent task scheduler.',
    'Read a task graph from stdin in this format (one task per line):',
    '  taskName duration [dep1 dep2 ...]',
    'where duration is in milliseconds and deps are space-separated task names that must complete first.',
    '',
    'Simulate execution with these rules:',
    '- Maximum 2 tasks run concurrently',
    '- A task starts as soon as all its dependencies are complete AND a slot is available',
    '- Use actual async delays (e.g., setTimeout/Bun.sleep) with the given durations',
    '- Print each task as it completes: "DONE taskName @<elapsed_ms>"',
    '  where elapsed_ms is milliseconds since start, rounded to nearest 10',
    '- After all tasks, print "TOTAL <elapsed_ms>" with total time rounded to nearest 10',
    '',
    'Example input:',
    'A 100',
    'B 100',
    'C 50 A B',
    '',
    'Expected behavior: A and B run in parallel (2 slots), C waits for both, total ~150ms.',
    'Expected output (approximately):',
    'DONE A @100',
    'DONE B @100',
    'DONE C @150',
    'TOTAL 150',
  ].join('\n'),
  score: async (response, context) => {
    const source = extractCode(response);

    const testInput = 'A 100\nB 100\nC 50 A B\n';
    const [result, lint] = await Promise.all([
      runInContainer(source, testInput),
      lintAndLog(source, 'task-scheduler', context),
    ]);

    if (result.timedOut || result.exitCode !== 0) return combinedScore(0, lint);

    const lines = result.stdout.trim().split('\n').map((line) => line.trim());

    /** Check that all tasks completed */
    const doneA = lines.some((line) => line.startsWith('DONE A'));
    const doneB = lines.some((line) => line.startsWith('DONE B'));
    const doneC = lines.some((line) => line.startsWith('DONE C'));
    const hasTotal = lines.some((line) => line.startsWith('TOTAL'));

    if (!doneA || !doneB || !doneC || !hasTotal) {
      return combinedScore(0.1, lint);
    }

    /** Extract timing from DONE lines */
    const extractTime = (prefix: string): number | undefined => {
      const line = lines.find((lineItem) => lineItem.startsWith(`DONE ${prefix}`));
      if (line === undefined) return undefined;
      const timeMatch = /@(\d+)/.exec(line);
      return timeMatch !== null ? Number(timeMatch[1]) : undefined;
    };

    const timeA = extractTime('A');
    const timeB = extractTime('B');
    const timeC = extractTime('C');

    if (timeA === undefined || timeB === undefined || timeC === undefined) {
      return combinedScore(0.2, lint);
    }

    /** A and B should finish around 100ms (parallel) */
    const TIMING_TOLERANCE = 40;
    const EXPECTED_AB_TIME = 100;
    const EXPECTED_C_TIME = 150;
    const aOnTime = Math.abs(timeA - EXPECTED_AB_TIME) < TIMING_TOLERANCE;
    const bOnTime = Math.abs(timeB - EXPECTED_AB_TIME) < TIMING_TOLERANCE;
    /** C should finish around 150ms (after A and B + its own 50ms) */
    const cOnTime = Math.abs(timeC - EXPECTED_C_TIME) < TIMING_TOLERANCE;
    /** C must finish after both A and B */
    const cAfterDeps = timeC > timeA && timeC > timeB;

    const TOTAL_CHECKS = 4;
    const correctCount = [aOnTime, bOnTime, cOnTime, cAfterDeps].filter(Boolean).length;

    return combinedScore(correctCount / TOTAL_CHECKS, lint);
  },
};

//endregion Probe: concurrent task scheduler

//region Probe: CSS native mixin transpiler

/**
 * Asks the model to build a single-file CSS transpiler that resolves
 * native `@mixin` declarations and `@apply` rules.
 *
 * CSS native mixins are new enough that models won't have canned solutions.
 * The task tests string parsing, brace-depth tracking, and state management --
 * failure modes that surface differently from algorithmic probes.
 */
const cssMixinTranspiler: Probe = {
  name: 'css-mixin-transpiler',
  category: 'code-gen',
  system: CODE_GEN_SYSTEM,
  buildFixPrompt: buildCodeGenFixPrompt,
  prompt: [
    'Write a TypeScript CLI that reads CSS from stdin and writes transpiled CSS to stdout.',
    'It must resolve CSS native mixins:',
    '',
    '1. Parse `@mixin --name { ...declarations... }` blocks and collect their contents',
    '2. Replace every `@apply --name;` rule with the collected declarations from that mixin',
    '3. Remove `@mixin` blocks from the output entirely',
    '4. Preserve all other CSS exactly as-is (selectors, properties, comments, whitespace between rules)',
    '5. A rule block may contain multiple `@apply` rules -- expand each in order',
    '6. The same mixin may be referenced from multiple rule blocks',
    '7. Mixin names always start with `--` (CSS custom property convention)',
    '8. Mixin bodies can contain declarations, nested rules, AND `@apply` of other mixins (recursive expansion)',
    '9. `@apply` can appear inside nested rules (CSS nesting with `&`) -- resolve them at any depth',
    '10. `@apply` at the top level (outside any rule block) expands the mixin body directly into the stylesheet',
    '',
    'Example 1 -- basic:',
    '```css',
    '@mixin --flex-center {',
    '  display: flex;',
    '  align-items: center;',
    '}',
    '.card { @apply --flex-center; padding: 1rem; }',
    '```',
    'Becomes:',
    '```css',
    '.card { display: flex; align-items: center; padding: 1rem; }',
    '```',
    '',
    'Example 2 -- top-level apply:',
    '```css',
    '@mixin --reset { body { margin: 0; } }',
    '@apply --reset;',
    '```',
    'Becomes:',
    '```css',
    'body { margin: 0; }',
    '```',
  ].join('\n'),
  score: async (response, context) => {
    const source = extractCode(response);

    const testCss = [
      // Base mixin
      '@mixin --flex-center {',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '}',
      '',
      // Mixin that @apply's another mixin (recursive)
      '@mixin --card-base {',
      '  @apply --flex-center;',
      '  padding-block: 1rem;',
      '  padding-inline: 2rem;',
      '}',
      '',
      '@mixin --visually-hidden {',
      '  position: absolute;',
      '  clip-path: inset(50%);',
      '  overflow: hidden;',
      '}',
      '',
      // Top-level mixin with a full rule inside
      '@mixin --reset {',
      '  body {',
      '    margin: 0;',
      '    padding: 0;',
      '  }',
      '}',
      '',
      // Top-level @apply -- expands the reset mixin directly into the stylesheet
      '@apply --reset;',
      '',
      // Simple @apply via recursive mixin
      '.card {',
      '  @apply --card-base;',
      '  border-radius: 0.5rem;',
      '}',
      '',
      // @apply inside nested rule
      '.nav {',
      '  background-color: var(--surface-bg);',
      '',
      '  & .link {',
      '    @apply --flex-center;',
      '    color: var(--link-fg);',
      '  }',
      '}',
      '',
      // Multiple @apply in one block
      '.hero {',
      '  @apply --card-base;',
      '  @apply --visually-hidden;',
      '}',
      '',
    ].join('\n');

    const [result, lint] = await Promise.all([
      runInContainer(source, testCss),
      lintAndLog(source, 'css-mixin', context),
    ]);

    if (result.timedOut || result.exitCode !== 0) return combinedScore(0, lint);

    // Normalize: collapse whitespace runs so cosmetic differences don't affect scoring.
    // "display:  flex" and "display: flex" are functionally identical.
    const output = result.stdout.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n');

    // Check 1: no @mixin blocks remain
    const mixinsRemoved = !output.includes('@mixin');

    // Check 2: no @apply rules remain
    const appliesResolved = !output.includes('@apply');

    // Check 3: top-level @apply expanded the reset mixin's body (a full rule) into stylesheet
    const resetExpanded = output.includes('margin: 0') && output.includes('padding: 0');

    // Check 4: .card has flex-center declarations (expanded through --card-base)
    const cardHasFlex = output.includes('display: flex')
      && output.includes('align-items: center');

    // Check 5: .card has card-base's own declarations
    const cardHasPadding = output.includes('padding-block: 1rem')
      && output.includes('padding-inline: 2rem');

    // Check 6: .card preserves its own property
    const cardHasBorder = output.includes('border-radius: 0.5rem');

    // Check 7: nested .nav .link has flex-center expanded + its own property
    const navLinkHasFlex = output.includes('color: var(--link-fg)');

    // Check 8: .nav preserves its own background
    const navHasBg = output.includes('background-color: var(--surface-bg)');

    // Check 9: .hero gets both --card-base (which includes --flex-center) and --visually-hidden
    const heroHasHidden = output.includes('clip-path: inset(50%)')
      && output.includes('overflow: hidden');

    // Check 10: recursive expansion -- flex-center through card-base
    // flex-center should appear in .card, .nav .link, and .hero = 3 occurrences
    const flexOccurrences = output.split('display: flex').length - 1;
    const heroGotRecursiveFlex = flexOccurrences >= 3;

    const TOTAL_CHECKS = 10;
    const checks = [
      mixinsRemoved,
      appliesResolved,
      resetExpanded,
      cardHasFlex,
      cardHasPadding,
      cardHasBorder,
      navLinkHasFlex,
      navHasBg,
      heroHasHidden,
      heroGotRecursiveFlex,
    ];
    const correctCount = checks.filter(Boolean).length;

    return combinedScore(correctCount / TOTAL_CHECKS, lint);
  },
};

//endregion Probe: CSS native mixin transpiler

/** All code-generation probes */
const allCodeGenProbes: readonly Probe[] = [
  csvRfc4180,
  expressionEvaluator,
  cssMixinTranspiler,
  taskScheduler,
];

/** Fast probes only (default) -- excludes slow probes like task-scheduler */
export const codeGenProbes: readonly Probe[] = allCodeGenProbes.filter(
  (probe) => probe.slow !== true,
);

/** All probes including slow ones (--slow flag) */
export const codeGenProbesAll: readonly Probe[] = allCodeGenProbes;
