/**
 * Tool title mapping for terminal tab display.
 *
 * Maps Claude Code tool names to human-readable title formatters with
 * tense-aware labels (present for PreToolUse, past for PostToolUse).
 *
 * @module
 */

import {
  field,
  pathFormat,
  quotedFormat,
  shortCommand,
  type ToolTitleEntry,
  truncate,
} from './formatter-utils.ts';
import { EXTENDED_TOOL_TITLES, } from './tool-titles-extended.ts';
import { SEARCH_TOOL_TITLES, } from './tool-titles-search.ts';

/**
 * Core tool title entries for file, search, and agent tools. Combined with
 * `EXTENDED_TOOL_TITLES` and `SEARCH_TOOL_TITLES` to form the full
 * `TOOL_TITLES` registry.
 */
const CORE_TOOL_TITLES: Record<string, ToolTitleEntry> = {
  Bash: {
    extract: field('command',),
    format(v,) { return shortCommand(v,); },
    fallback: { pre: 'Running command', post: 'Ran command', },
  },
  Read: {
    extract: field('file_path',),
    format: pathFormat({ pre: 'Reading', post: 'Read', },),
    fallback: { pre: 'Reading file', post: 'Read file', },
  },
  Edit: {
    extract: field('file_path',),
    format: pathFormat({ pre: 'Editing', post: 'Edited', },),
    fallback: { pre: 'Editing file', post: 'Edited file', },
  },
  Write: {
    extract: field('file_path',),
    format: pathFormat({ pre: 'Writing', post: 'Wrote', },),
    fallback: { pre: 'Writing file', post: 'Wrote file', },
  },
  Grep: {
    extract: field('pattern',),
    format: quotedFormat({ pre: 'Searching', post: 'Searched', },),
    fallback: { pre: 'Searching', post: 'Searched', },
  },
  Glob: {
    extract: field('pattern',),
    format: quotedFormat({ pre: 'Finding', post: 'Found', },),
    fallback: { pre: 'Finding files', post: 'Found files', },
  },
  Agent: {
    extract: field('description',),
    format(v, tense,) {
      return `${tense === 'pre' ? 'Agent' : 'Agent done'}: ${v}`;
    },
    fallback: { pre: 'Agent working', post: 'Agent done', },
  },
};

/**
 * Maps tool names to their title formatting rules. Each entry specifies how to
 * extract a display string from `tool_input`, how to format it per tense, and
 * fallbacks.
 */
const TOOL_TITLES: Record<string, ToolTitleEntry> = {
  ...CORE_TOOL_TITLES,
  ...SEARCH_TOOL_TITLES,
  ...EXTENDED_TOOL_TITLES,
};

export type { ToolTitleEntry, };

export {
  TOOL_TITLES,
  truncate,
};
