/**
 * Tool title entries for search, web, and miscellaneous tools.
 *
 * Separated from the core registry to stay within the max-lines budget.
 *
 * @module
 */

import {
  field,
  FIELD_ABSENT,
  MAX_PATTERN_LENGTH,
  pathFormat,
  quotedFormat,
  type ToolTitleEntry,
  truncate,
} from './formatter-utils.ts';

/**
 * Title entries for search, web, notebook, LSP, skill, and discovery tools.
 * Merged into the main `TOOL_TITLES` registry by `tool-titles.ts`.
 */
const SEARCH_TOOL_TITLES: Record<string, ToolTitleEntry> = {
  WebSearch: {
    extract: field('query',),
    format: quotedFormat({
      pre: 'Searching',
      post: 'Searched',
    },),
    fallback: {
      pre: 'Web search',
      post: 'Web search done',
    },
  },
  AskUserQuestion: {
    extract(input,): string | typeof FIELD_ABSENT {
      /**
       * Questions array from the AskUserQuestion tool input; non-array shapes are rejected below.
       */
      const { questions, } = input;
      if (!Array.isArray(questions,))
        return FIELD_ABSENT;
      /* oxlint-disable typescript/no-unsafe-type-assertion -- untyped tool_input; structure verified by Array.isArray guard */
      /**
       * First entry destructured from the questions array; only one question's title is shown.
       */
      const [first,] = questions as Record<string, unknown>[];
      /* oxlint-enable typescript/no-unsafe-type-assertion */
      if (first === undefined)
        return FIELD_ABSENT;
      /**
       * Question text pulled from the first entry; non-string shapes fall through to `FIELD_ABSENT`.
       */
      const { question, } = first;
      if ((typeof question) === 'string')
        return question;
      return FIELD_ABSENT;
    },
    format(
      v,
      tense,
    ) {
      return `${tense === 'pre' ? 'Asking' : 'Asked'}: ${
        truncate({
          value: v,
          maxLength: MAX_PATTERN_LENGTH,
        },)
      }`;
    },
    fallback: {
      pre: 'Asking question',
      post: 'Asked question',
    },
  },
  WebFetch: {
    extract: field('url',),
    format(
      v,
      tense,
    ) {
      /**
       * Verb form chosen by tense; reused in both the URL hostname and the error fallback.
       */
      const verb = tense === 'pre' ? 'Fetching' : 'Fetched';
      try {
        return `${verb} ${new URL(v,).hostname}`;
      }
      catch {
        return `${verb} URL`;
      }
    },
    fallback: {
      pre: 'Fetching URL',
      post: 'Fetched URL',
    },
  },
  NotebookEdit: {
    extract: field('notebook_path',),
    format: pathFormat({
      pre: 'Editing notebook',
      post: 'Edited notebook',
    },),
    fallback: {
      pre: 'Editing notebook',
      post: 'Edited notebook',
    },
  },
  LSP: {
    extract: field('operation',),
    format(
      v,
      tense,
    ) {
      return `${tense === 'pre' ? 'LSP' : 'LSP done'}: ${v}`;
    },
    fallback: {
      pre: 'LSP query',
      post: 'LSP done',
    },
  },
  Skill: {
    extract: field('skill',),
    format(
      v,
      tense,
    ) {
      return `${tense === 'pre' ? 'Skill' : 'Skill done'}: ${v}`;
    },
    fallback: {
      pre: 'Running skill',
      post: 'Ran skill',
    },
  },
  ToolSearch: {
    extract: field('query',),
    format(
      v,
      tense,
    ) {
      return `${tense === 'pre' ? 'Discovering' : 'Discovered'}: ${
        truncate({
          value: v,
          maxLength: MAX_PATTERN_LENGTH,
        },)
      }`;
    },
    fallback: {
      pre: 'Discovering tools',
      post: 'Discovered tools',
    },
  },
};

export { SEARCH_TOOL_TITLES, };
