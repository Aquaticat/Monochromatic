/**
 * Claude Code title entries for search, web, notebook, LSP, and discovery tools.
 *
 * @module
 */

import {
  fieldTitleEntry,
  inputTitleEntry,
  pathTitleEntry,
  textTitleEntry,
  type ToolTitleEntry,
  type ToolTitleInput,
} from '@monochromatic-dev/module-terminal-title/ts';
import type { BuiltInToolName, } from '@monochromatic-dev/claude-code-plugins-hook-types/ts';

//region AskUserQuestion helpers

/**
 * Checks whether object owns question field.
 *
 * @param value - because AskUserQuestion array items are untyped payload objects
 *
 * @returns whether value exposes question field for safe reading
 *
 * @example
 * ```ts
 * hasQuestionField({ question: 'Continue?' });
 * // true
 * ```
 */
function hasQuestionField(value: object,): value is { readonly question: unknown } {
  return Object.hasOwn(value, 'question',);
}

/**
 * Extracts first question text from AskUserQuestion input.
 *
 * @param input - because AskUserQuestion nests text inside questions array
 *
 * @returns first question string or undefined when input shape is absent
 *
 * @example
 * ```ts
 * firstQuestionText({ questions: [{ question: 'Continue?' }] });
 * // 'Continue?'
 * ```
 */
function firstQuestionText(input: ToolTitleInput,): string | undefined {
  /**
   * Candidate questions value from tool input.
   */
  const { questions, } = input;
  if (!Array.isArray(questions,))
    return undefined;
  /**
   * First question candidate.
   */
  const first = questions[0];
  if ((first === null) || ((typeof first) !== 'object'))
    return undefined;
  if (!hasQuestionField(first,))
    return undefined;
  /**
   * Question text from first question object.
   */
  const { question, } = first;
  if ((typeof question) === 'string')
    return question;
  return undefined;
}

//endregion AskUserQuestion helpers

//region URL helpers

/**
 * Formats URL host for title text.
 *
 * @param url - because WebFetch titles should show destination host
 *
 * @returns URL hostname or generic URL text when parsing fails
 *
 * @example
 * ```ts
 * webFetchValue('https://example.com/a');
 * // 'example.com'
 * ```
 */
function webFetchValue(url: string,): string {
  try {
    return new URL(url,).hostname;
  }
  catch {
    return 'URL';
  }
}

//endregion URL helpers

/**
 * Title entries for search, web, notebook, LSP, skill, and discovery tools.
 */
const SEARCH_TOOL_TITLES = {
  WebSearch: textTitleEntry({
    field: 'query',
    labels: { pre: 'Searching web for', post: 'Searched web for', },
    fallback: { pre: 'Searching web', post: 'Searched web', },
  },),
  AskUserQuestion: inputTitleEntry({
    fallback: { pre: 'Asking question', post: 'Asked question', },
    format({ input, tense, }): string | undefined {
      /**
       * First question text from nested input.
       */
      const question = firstQuestionText(input,);
      if (question === undefined)
        return undefined;
      return `${tense === 'pre' ? 'Asking' : 'Asked'}: ${question}`;
    },
  },),
  WebFetch: fieldTitleEntry({
    field: 'url',
    fallback: { pre: 'Fetching URL', post: 'Fetched URL', },
    format({ value, tense, }): string {
      return `${tense === 'pre' ? 'Fetching' : 'Fetched'} ${webFetchValue(value,)}`;
    },
  },),
  NotebookEdit: pathTitleEntry({
    field: 'notebook_path',
    labels: { pre: 'Editing notebook', post: 'Edited notebook', },
    noun: 'notebook',
  },),
  LSP: textTitleEntry({
    field: 'operation',
    labels: { pre: 'Running LSP', post: 'Finished LSP', },
    fallback: { pre: 'Running LSP query', post: 'Finished LSP query', },
  },),
  Skill: textTitleEntry({
    field: 'skill',
    labels: { pre: 'Running skill', post: 'Finished skill', },
    fallback: { pre: 'Running skill', post: 'Finished skill', },
  },),
  ToolSearch: textTitleEntry({
    field: 'query',
    labels: { pre: 'Discovering tools for', post: 'Discovered tools for', },
    fallback: { pre: 'Discovering tools', post: 'Discovered tools', },
  },),
} satisfies Partial<Record<BuiltInToolName, ToolTitleEntry>>;

export { SEARCH_TOOL_TITLES, };
