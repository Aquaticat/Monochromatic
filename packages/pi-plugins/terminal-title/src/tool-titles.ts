/**
 * Tool title mapping for terminal tab display.
 *
 * Maps pi tool names to human-readable title formatters with
 * tense-aware labels (present for `tool_execution_start`,
 * past for `tool_execution_end`).
 *
 * pi uses `path` for file-oriented tools (read, edit, write, ls)
 * and `pattern` for search-oriented tools (grep, find).
 * `bash` uses `command`.
 *
 * @module
 */

import {
  field,
  pathFormat,
  quotedFormat,
  shortCommand,
  type ToolTitleEntry as FormatterToolTitleEntry,
} from '@monochromatic-dev/module-terminal-title/ts';

/**
 * Tool title entries for all pi built-in tools. Each entry specifies how to
 * extract a display string from tool input, how to format it per tense, and
 * fallbacks when extraction returns `undefined`.
 *
 * Custom/MCP tools (via `CustomToolCallEvent`) are handled generically in
 * {@link titleForTool} rather than registered here; their `toolName` is dynamic
 * and their inputs are untyped `Record<string, unknown>`.
 */
const TOOL_TITLES: Record<string, FormatterToolTitleEntry> = {
  bash: {
    extract: field('command',),
    format(v,) {
      return shortCommand(v,);
    },
    fallback: {
      pre: 'Running command',
      post: 'Ran command',
    },
  },
  read: {
    extract: field('path',),
    format: pathFormat({
      pre: 'Reading',
      post: 'Read',
    },),
    fallback: {
      pre: 'Reading file',
      post: 'Read file',
    },
  },
  edit: {
    extract: field('path',),
    format: pathFormat({
      pre: 'Editing',
      post: 'Edited',
    },),
    fallback: {
      pre: 'Editing file',
      post: 'Edited file',
    },
  },
  write: {
    extract: field('path',),
    format: pathFormat({
      pre: 'Writing',
      post: 'Wrote',
    },),
    fallback: {
      pre: 'Writing file',
      post: 'Wrote file',
    },
  },
  grep: {
    extract: field('pattern',),
    format: quotedFormat({
      pre: 'Searching',
      post: 'Searched',
    },),
    fallback: {
      pre: 'Searching',
      post: 'Searched',
    },
  },
  find: {
    extract: field('pattern',),
    format: quotedFormat({
      pre: 'Finding',
      post: 'Found',
    },),
    fallback: {
      pre: 'Finding files',
      post: 'Found files',
    },
  },
  ls: {
    extract: field('path',),
    format: pathFormat({
      pre: 'Listing',
      post: 'Listed',
    },),
    fallback: {
      pre: 'Listing directory',
      post: 'Listed directory',
    },
  },
};

export { TOOL_TITLES, };

export type { ToolTitleEntry, } from '@monochromatic-dev/module-terminal-title/ts';
