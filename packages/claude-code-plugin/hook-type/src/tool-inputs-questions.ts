/**
 * Question tool input shapes for user interaction prompts.
 *
 * Separated from `tool-inputs-extended.ts` to keep each file under the max-lines limit.
 *
 * @module
 */

/**
 * Single selectable choice within an {@link AskUserQuestionEntry}.
 *
 * @example
 * ```ts
 * const option: AskUserQuestionOption = {
 *   label: 'Yes',
 *   description: 'Proceed with the operation',
 * };
 * ```
 */
export type AskUserQuestionOption = {
  /**
   * Display text for this option.
   */
  label: string;

  /**
   * Explanation of what this option means.
   */
  description: string;

  /**
   * Optional preview content rendered when focused.
   */
  preview?: string;
};

/**
 * Single question within an {@link AskUserQuestionToolInput}.
 *
 * @example
 * ```ts
 * const entry: AskUserQuestionEntry = {
 *   question: 'How should we proceed?',
 *   header: 'Action',
 *   options: [{ label: 'Continue', description: 'Keep going' }],
 *   multiSelect: false,
 * };
 * ```
 */
export type AskUserQuestionEntry = {
  /**
   * Question text to display to the user.
   */
  question: string;

  /**
   * Short label displayed as a chip/tag (max 12 chars).
   */
  header: string;

  /**
   * Available choices (2-4 options).
   */
  options: AskUserQuestionOption[];

  /**
   * Whether multiple options can be selected.
   */
  multiSelect: boolean;
};

/**
 * Input shape for the `AskUserQuestion` tool.
 *
 * @example
 * ```ts
 * if (event.tool_name === 'AskUserQuestion') {
 *   const { questions } = event.tool_input as AskUserQuestionToolInput;
 * }
 * ```
 */
export type AskUserQuestionToolInput = {
  /**
   * Questions to present to the user (1-4).
   */
  questions: AskUserQuestionEntry[];
};
