/**
 * Direct Inquirer prompt adapters with explicit streams and themes.
 *
 * @module
 */

import checkbox from '@inquirer/checkbox';
import inputPrompt from '@inquirer/input';
import { styleText, } from 'node:util';

import type { RenderedIssue, } from './issue-model.ts';
import type {
  PromptStreams,
  SquareCheckboxTheme,
} from './interactive-model.ts';

/**
 * Applies terminal-aware color at final output stream boundary.
 *
 * @param color - Native Node red or green style.
 *
 * @param value - Prompt text to style.
 *
 * @param output - TTY output whose capability and color environment are honored.
 *
 * @returns Styled or plain text according to native color policy.
 */
function colorize({
  color,
  value,
  output,
}: {
  readonly color: 'red' | 'green';
  readonly value: string;
  readonly output: NodeJS.WritableStream;
},): string {
  return styleText(color, value, { stream: output, },);
}

/**
 * Creates square checkbox override for ordinary or security picker.
 *
 * @param security - Whether all visible states need red security styling.
 *
 * @param output - TTY output used for native color capability validation.
 *
 * @returns Inquirer checkbox theme subset with `☐` and `☑` indicators.
 *
 * @example
 * ```ts
 * createSquareCheckboxTheme({ security: true, output: process.stdout });
 * ```
 */
export function createSquareCheckboxTheme({
  security,
  output,
}: {
  readonly security: boolean;
  readonly output: NodeJS.WritableStream;
},): SquareCheckboxTheme {
  /**
   * Selected indicator colored red for security and green otherwise.
   */
  const checked = colorize({
    color: security ? 'red' : 'green',
    value: '☑',
    output,
  });
  /**
   * Unselected indicator red only in security picker.
   */
  const unchecked = security
    ? colorize({ color: 'red', value: '☐', output, })
    : '☐';
  /**
   * Security-aware text style or identity for ordinary picker.
   */
  const textStyle = security
    ? function red(value: string,): string {
      return colorize({ color: 'red', value, output, });
    }
    : function unchanged(value: string,): string {
      return value;
    };
  return {
    icon: {
      checked,
      unchecked,
      disabledChecked: checked,
      disabledUnchecked: unchecked,
    },
    style: {
      message: textStyle,
      highlight: textStyle,
    },
  };
}

/**
 * Prompts for one-line pasted structured JSON.
 *
 * @param streams - Explicit TTY streams.
 *
 * @returns One submitted line.
 *
 * @example
 * ```ts
 * await promptForPastedInput({ streams });
 * ```
 */
export async function promptForPastedInput({
  streams,
}: {
  readonly streams: PromptStreams;
},): Promise<string> {
  return inputPrompt({
    message: 'Paste one-line OCR JSON:',
    required: true,
  }, streams,);
}

/**
 * Prompts one explicit yes-or-no decision with no default.
 *
 * @param message - Decision question naming its authority consequence.
 *
 * @param streams - Explicit TTY streams.
 *
 * @returns True only for exact case-insensitive `yes`.
 *
 * @example
 * ```ts
 * await promptForExplicitDecision({ message: 'Create?', streams });
 * ```
 */
export async function promptForExplicitDecision({
  message,
  streams,
}: {
  readonly message: string;
  readonly streams: PromptStreams;
},): Promise<boolean> {
  /**
   * Validated explicit decision text.
   */
  const answer = await inputPrompt({
    message,
    validate(value,) {
      /**
       * Case-folded trimmed decision candidate.
       */
      const normalized = value.trim().toLowerCase();
      return normalized === 'yes' || normalized === 'no'
        ? true
        : 'Type yes or no';
    },
  }, streams,);
  return answer.trim().toLowerCase() === 'yes';
}

/**
 * Prompts one ordinary or security checkbox stage.
 *
 * @param issues - Issues available in this picker.
 *
 * @param security - Whether picker is disclosure-sensitive.
 *
 * @param required - Whether this stage must select at least one.
 *
 * @param streams - Explicit TTY streams.
 *
 * @returns Selected issues in picker order.
 *
 * @example
 * ```ts
 * await promptForIssues({ issues, security: false, required: true, streams });
 * ```
 */
export async function promptForIssues({
  issues,
  security,
  required,
  streams,
}: {
  readonly issues: readonly RenderedIssue[];
  readonly security: boolean;
  readonly required: boolean;
  readonly streams: PromptStreams;
},): Promise<readonly RenderedIssue[]> {
  if (issues.length === 0) {
    return [];
  }
  /**
   * Selected zero-based issue indexes.
   */
  const selected = await checkbox<number>({
    message: security
      ? 'SECURITY findings: select only findings safe to disclose publicly'
      : 'Select findings to create as GitHub Issues',
    choices: issues.map(function issueChoice(issue, index,) {
      return {
        name: security ? `SECURITY ${issue.title}` : issue.title,
        value: index,
        checked: !security,
      };
    },),
    required,
    ...(security
      ? {
        shortcuts: {
          all: null,
          invert: null,
        },
      }
      : {}),
    theme: createSquareCheckboxTheme({ security, output: streams.output, }),
  }, streams,);
  return selected.map(function selectedIssue(index,) {
    /**
     * Selected issue indexed by library-owned choice value.
     */
    const issue = issues[index];
    if (issue === undefined) {
      throw new Error(`prompt returned unknown Issue index ${String(index,)}`,);
    }
    return issue;
  },);
}

/**
 * Identifies clean Inquirer Ctrl+C cancellation without importing transitive error class.
 *
 * @param error - Unknown caught prompt failure.
 *
 * @returns Whether Inquirer reported its documented exit prompt error.
 *
 * @example
 * ```ts
 * isPromptCancellation({ name: 'ExitPromptError' }); // true
 * ```
 */
export function isPromptCancellation(error: unknown,): boolean {
  return error instanceof Error && error.name === 'ExitPromptError';
}
