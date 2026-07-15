/**
 * Claude Code tool title registry.
 *
 * Maps Claude Code tool names to shared terminal-title entries.
 *
 * @module
 */

import {
  pathTitleEntry,
  shellCommandTitleEntry,
  textTitleEntry,
  type ToolTitleEntry,
} from '@monochromatic-dev/agent-harness-shared-terminal-title/ts';
import type { BuiltInToolName, } from '@monochromatic-dev/claude-code-plugin-hook-type/ts';
import { EXTENDED_TOOL_TITLES, } from './tool-titles-extended.ts';
import { SEARCH_TOOL_TITLES, } from './tool-titles-search.ts';

/**
 * Built-in tool names held in the core registry segment.
 */
type CoreToolTitleName = 'Bash' | 'Read' | 'Edit' | 'Write' | 'Grep' | 'Glob' | 'Agent';

/**
 * Core Claude Code tool title entries for file, search, and agent tools.
 */
const CORE_TOOL_TITLES: Record<CoreToolTitleName, ToolTitleEntry> = {
  Bash: shellCommandTitleEntry({ field: 'command', },),
  Read: pathTitleEntry({
    field: 'file_path',
    labels: {
      pre: 'Reading',
      post: 'Read',
    },
    noun: 'file',
  },),
  Edit: pathTitleEntry({
    field: 'file_path',
    labels: {
      pre: 'Editing',
      post: 'Edited',
    },
    noun: 'file',
  },),
  Write: pathTitleEntry({
    field: 'file_path',
    labels: {
      pre: 'Writing',
      post: 'Wrote',
    },
    noun: 'file',
  },),
  Grep: textTitleEntry({
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
  Glob: textTitleEntry({
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
  Agent: textTitleEntry({
    field: 'description',
    labels: {
      pre: 'Running agent',
      post: 'Finished agent',
    },
    fallback: {
      pre: 'Running agent',
      post: 'Finished agent',
    },
  },),
};

/**
 * Complete built-in Claude Code tool title registry.
 */
const TOOL_TITLES: Record<BuiltInToolName, ToolTitleEntry> = {
  ...CORE_TOOL_TITLES,
  ...SEARCH_TOOL_TITLES,
  ...EXTENDED_TOOL_TITLES,
};

export type { ToolTitleEntry, } from '@monochromatic-dev/agent-harness-shared-terminal-title/ts';

export { TOOL_TITLES, };
