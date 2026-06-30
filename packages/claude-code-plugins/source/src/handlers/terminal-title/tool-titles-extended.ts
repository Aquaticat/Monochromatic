/**
 * Extended tool title entries for plan mode, worktrees, tasks, and cron tools.
 *
 * Separated from the core registry to stay within the max-lines budget.
 *
 * @module
 */

import {
  field,
  FIELD_ABSENT,
  MAX_PATTERN_LENGTH,
  type ToolTitleEntry,
  truncate,
} from './formatter-utils.ts';

/**
 * Throws when a formatter is called for an entry whose extractor never returns
 * text. The fallback path should handle these entries before formatting.
 */
function absentFieldFormatter(): never {
  throw new Error('terminal-title formatter called for absent field entry',);
}

/**
 * Title entries for plan mode, worktree, task, and cron tools. Merged into the
 * main {@link TOOL_TITLES} registry by `tool-titles.ts`.
 */
const EXTENDED_TOOL_TITLES: Record<string, ToolTitleEntry> = {
  EnterPlanMode: {
    extract() {
      return FIELD_ABSENT;
    },
    format: absentFieldFormatter,
    fallback: {
      pre: 'Entering plan mode',
      post: 'In plan mode',
    },
  },
  ExitPlanMode: {
    extract() {
      return FIELD_ABSENT;
    },
    format: absentFieldFormatter,
    fallback: {
      pre: 'Exiting plan mode',
      post: 'Exited plan mode',
    },
  },
  EnterWorktree: {
    extract: field('name',),
    format(
      v,
      tense,
    ) {
      return `${tense === 'pre' ? 'Creating' : 'Created'} worktree: ${v}`;
    },
    fallback: {
      pre: 'Creating worktree',
      post: 'Created worktree',
    },
  },
  TaskCreate: {
    extract: field('subject',),
    format(
      v,
      tense,
    ) {
      return `${tense === 'pre' ? 'Creating' : 'Created'} task: ${
        truncate({
          value: v,
          maxLength: MAX_PATTERN_LENGTH,
        },)
      }`;
    },
    fallback: {
      pre: 'Creating task',
      post: 'Created task',
    },
  },
  TaskGet: {
    extract: field('taskId',),
    format(v,) {
      return `Task #${v}`;
    },
    fallback: {
      pre: 'Getting task',
      post: 'Got task',
    },
  },
  TaskList: {
    extract() {
      return FIELD_ABSENT;
    },
    format: absentFieldFormatter,
    fallback: {
      pre: 'Listing tasks',
      post: 'Listed tasks',
    },
  },
  TaskOutput: {
    extract: field('task_id',),
    format(
      v,
      tense,
    ) {
      return `${tense === 'pre' ? 'Reading' : 'Read'} task output #${v}`;
    },
    fallback: {
      pre: 'Reading task output',
      post: 'Read task output',
    },
  },
  TaskStop: {
    extract: field('task_id',),
    format(
      v,
      tense,
    ) {
      return `${tense === 'pre' ? 'Stopping' : 'Stopped'} task #${v}`;
    },
    fallback: {
      pre: 'Stopping task',
      post: 'Stopped task',
    },
  },
  TaskUpdate: {
    extract: field('taskId',),
    format(
      v,
      tense,
    ) {
      return `${tense === 'pre' ? 'Updating' : 'Updated'} task #${v}`;
    },
    fallback: {
      pre: 'Updating task',
      post: 'Updated task',
    },
  },
  CronCreate: {
    extract: field('prompt',),
    format(
      v,
      tense,
    ) {
      return `${tense === 'pre' ? 'Scheduling' : 'Scheduled'}: ${
        truncate({
          value: v,
          maxLength: MAX_PATTERN_LENGTH,
        },)
      }`;
    },
    fallback: {
      pre: 'Scheduling cron',
      post: 'Scheduled cron',
    },
  },
  CronDelete: {
    extract: field('id',),
    format(
      v,
      tense,
    ) {
      return `${tense === 'pre' ? 'Deleting' : 'Deleted'} cron #${v}`;
    },
    fallback: {
      pre: 'Deleting cron',
      post: 'Deleted cron',
    },
  },
  CronList: {
    extract() {
      return FIELD_ABSENT;
    },
    format: absentFieldFormatter,
    fallback: {
      pre: 'Listing cron jobs',
      post: 'Listed cron jobs',
    },
  },
};

export { EXTENDED_TOOL_TITLES, };
