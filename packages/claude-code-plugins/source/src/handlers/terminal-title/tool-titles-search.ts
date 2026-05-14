/**
 * Tool title entries for search, web, and miscellaneous tools.
 *
 * Separated from the core registry to stay within the max-lines budget.
 *
 * @module
 */

import {
  field,
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
    extract(input,): string | undefined {
      const { questions, } = input;
      if (!Array.isArray(questions,))
        return undefined;
      /* oxlint-disable-next-line typescript/no-unsafe-type-assertion -- untyped tool_input; structure verified by Array.isArray guard */
      const [first,] = questions as Record<string, unknown>[];
      if (first === undefined)
        return undefined;
      const { question, } = first;
      if (typeof question === 'string')
        return question;
      return undefined;
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
