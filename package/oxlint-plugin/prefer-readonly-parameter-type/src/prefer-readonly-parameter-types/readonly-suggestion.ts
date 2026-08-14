import type { Suggestion, } from '@oxlint/plugins';

/**
 * Verified Oxlint replacement plus one-line diagnostic instruction.
 *
 * Suggestion descriptions may quote authored multiline syntax.
 * Diagnostic guidance instead names exact transformation without copying source trivia,
 * so CLI output remains one physical line.
 *
 * @example
 * ```ts
 * const suggestion: ReadonlySuggestion = {
 *   diagnosticGuidance: 'Prefix authored array type with `readonly`.',
 *   desc: 'Replace Row[] with readonly Row[].',
 *   fix,
 * };
 * ```
 */
export type ReadonlySuggestion = Suggestion & {
  readonly diagnosticGuidance: string;
};
