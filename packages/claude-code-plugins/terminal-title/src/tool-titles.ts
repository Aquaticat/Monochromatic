/**
 * Tool title mapping for terminal tab display.
 *
 * Maps Claude Code tool names to human-readable title formatters
 * with tense-aware labels (present for PreToolUse, past for PostToolUse).
 *
 * @module
 */

import {
  field,
  MAX_PATTERN_LENGTH,
  pathFormat,
  quotedFormat,
  shortCommand,
  type ToolTitleEntry,
  truncate,
} from './formatter-utils.ts';
import { EXTENDED_TOOL_TITLES, } from './tool-titles-extended.ts';

export {
  type ToolTitleEntry,
  truncate,
};

/**
 * Core tool title entries for file, search, agent, and web tools.
 * Combined with {@link EXTENDED_TOOL_TITLES} to form the full {@link TOOL_TITLES} registry.
 */
const CORE_TOOL_TITLES: Record<string, ToolTitleEntry> = {
  Bash: {
    extract: field('command',),
    format(v,) {
      return shortCommand(v,);
    },
    fallback: { pre: 'Running command', post: 'Ran command', },
  },
  Read: { extract: field('file_path',),
    format: pathFormat({ pre: 'Reading', post: 'Read', },),
    fallback: { pre: 'Reading file', post: 'Read file', }, },
  Edit: { extract: field('file_path',),
    format: pathFormat({ pre: 'Editing', post: 'Edited', },),
    fallback: { pre: 'Editing file', post: 'Edited file', }, },
  Write: { extract: field('file_path',),
    format: pathFormat({ pre: 'Writing', post: 'Wrote', },),
    fallback: { pre: 'Writing file', post: 'Wrote file', }, },
  Grep: { extract: field('pattern',),
    format: quotedFormat({ pre: 'Searching', post: 'Searched', },),
    fallback: { pre: 'Searching', post: 'Searched', }, },
  Glob: { extract: field('pattern',),
    format: quotedFormat({ pre: 'Finding', post: 'Found', },),
    fallback: { pre: 'Finding files', post: 'Found files', }, },
  Agent: {
    extract: field('description',),
    format(v, tense,) {
      return `${tense === 'pre' ? 'Agent' : 'Agent done'}: ${v}`;
    },
    fallback: { pre: 'Agent working', post: 'Agent done', },
  },
  WebSearch: { extract: field('query',),
    format: quotedFormat({ pre: 'Searching', post: 'Searched', },),
    fallback: { pre: 'Web search', post: 'Web search done', }, },
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
    format(v, tense,) {
      return `${tense === 'pre' ? 'Asking' : 'Asked'}: ${
        truncate(v, MAX_PATTERN_LENGTH,)
      }`;
    },
    fallback: { pre: 'Asking question', post: 'Asked question', },
  },
  WebFetch: {
    extract: field('url',),
    format(v, tense,) {
      /** Verb prefix matching the hook tense. */
      const verb = tense === 'pre' ? 'Fetching' : 'Fetched';
      try {
        return `${verb} ${new URL(v,).hostname}`;
      }
      catch {
        return `${verb} URL`;
      }
    },
    fallback: { pre: 'Fetching URL', post: 'Fetched URL', },
  },
  NotebookEdit: { extract: field('notebook_path',),
    format: pathFormat({ pre: 'Editing notebook', post: 'Edited notebook', },),
    fallback: { pre: 'Editing notebook', post: 'Edited notebook', }, },
  LSP: {
    extract: field('operation',),
    format(v, tense,) {
      return `${tense === 'pre' ? 'LSP' : 'LSP done'}: ${v}`;
    },
    fallback: { pre: 'LSP query', post: 'LSP done', },
  },
  Skill: {
    extract: field('skill',),
    format(v, tense,) {
      return `${tense === 'pre' ? 'Skill' : 'Skill done'}: ${v}`;
    },
    fallback: { pre: 'Running skill', post: 'Ran skill', },
  },
  ToolSearch: {
    extract: field('query',),
    format(v, tense,) {
      return `${tense === 'pre' ? 'Discovering' : 'Discovered'}: ${
        truncate(v, MAX_PATTERN_LENGTH,)
      }`;
    },
    fallback: { pre: 'Discovering tools', post: 'Discovered tools', },
  },
};

/**
 * Maps tool names to their title formatting rules.
 * Each entry specifies how to extract a display string from `tool_input`, how to format it per tense, and fallbacks.
 *
 * @example
 * ```ts
 * TOOL_TITLES['Read']
 * // { extract: field('file_path'), format: pathFormat(...), fallback: { pre: 'Reading file', post: 'Read file' } }
 * ```
 */
export const TOOL_TITLES: Record<string, ToolTitleEntry> = {
  ...CORE_TOOL_TITLES,
  ...EXTENDED_TOOL_TITLES,
};
