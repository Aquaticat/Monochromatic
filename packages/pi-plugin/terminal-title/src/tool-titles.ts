/**
 * pi tool title registry.
 *
 * Maps pi tool names to shared terminal-title entries.
 * Host-specific code owns tool-name and input-field vocabulary;
 * shared terminal-title owns entry semantics.
 *
 * @module
 */

import {
  pathTitleEntry,
  shellCommandTitleEntry,
  textTitleEntry,
  type ToolTitleEntry,
} from '@monochromatic-dev/agent-harness-shared-terminal-title/ts';

/**
 * Tool title entries for pi built-in tools.
 *
 * Custom and MCP tools are handled by the shared generic unknown-tool fallback.
 */
const TOOL_TITLES: Record<string, ToolTitleEntry> = {
  bash: shellCommandTitleEntry({ field: 'command', },),
  read: pathTitleEntry({
    field: 'path',
    labels: {
      pre: 'Reading',
      post: 'Read',
    },
    noun: 'file',
  },),
  edit: pathTitleEntry({
    field: 'path',
    labels: {
      pre: 'Editing',
      post: 'Edited',
    },
    noun: 'file',
  },),
  write: pathTitleEntry({
    field: 'path',
    labels: {
      pre: 'Writing',
      post: 'Wrote',
    },
    noun: 'file',
  },),
  grep: textTitleEntry({
    field: 'pattern',
    labels: {
      pre: 'Searching for',
      post: 'Searched for',
    },
    fallback: {
      pre: 'Searching',
      post: 'Searched',
    },
  },),
  find: textTitleEntry({
    field: 'pattern',
    labels: {
      pre: 'Finding',
      post: 'Found',
    },
    fallback: {
      pre: 'Finding files',
      post: 'Found files',
    },
  },),
  ls: pathTitleEntry({
    field: 'path',
    labels: {
      pre: 'Listing',
      post: 'Listed',
    },
    noun: 'directory',
  },),
};

export { TOOL_TITLES, };

export type { ToolTitleEntry, } from '@monochromatic-dev/agent-harness-shared-terminal-title/ts';
