/**
 * Extended tool title entries for plan mode, worktrees, tasks, and cron tools.
 *
 * Separated from the core registry to stay within the max-lines budget.
 *
 * @module
 */

import {
  field,
  MAX_PATTERN_LENGTH,
  type ToolTitleEntry,
  truncate,
} from './formatter-utils.ts';

/**
 * Title entries for plan mode, worktree, task, and cron tools.
 * Merged into the main {@link TOOL_TITLES} registry by `tool-titles.ts`.
 *
 * @example
 * ```ts
 * EXTENDED_TOOL_TITLES['TaskCreate']
 * // { extract: field('subject'), format: ..., fallback: { pre: 'Creating task', post: 'Created task' } }
 * ```
 */
export const EXTENDED_TOOL_TITLES: Record<string, ToolTitleEntry> = {
  EnterPlanMode: {
    extract() {/* No extractable value */},
    format() {
      return '';
    },
    fallback: { pre: 'Entering plan mode', post: 'In plan mode', },
  },
  ExitPlanMode: {
    extract() {/* No extractable value */},
    format() {
      return '';
    },
    fallback: { pre: 'Exiting plan mode', post: 'Exited plan mode', },
  },
  EnterWorktree: {
    extract: field('name',),
    format(v, tense,) {
      return `${tense === 'pre' ? 'Creating' : 'Created'} worktree: ${v}`;
    },
    fallback: { pre: 'Creating worktree', post: 'Created worktree', },
  },
  TaskCreate: {
    extract: field('subject',),
    format(v, tense,) {
      return `${tense === 'pre' ? 'Creating' : 'Created'} task: ${
        truncate(v, MAX_PATTERN_LENGTH,)
      }`;
    },
    fallback: { pre: 'Creating task', post: 'Created task', },
  },
  TaskGet: {
    extract: field('taskId',),
    format(v,) {
      return `Task #${v}`;
    },
    fallback: { pre: 'Getting task', post: 'Got task', },
  },
  TaskList: {
    extract() {/* No extractable value */},
    format() {
      return '';
    },
    fallback: { pre: 'Listing tasks', post: 'Listed tasks', },
  },
  TaskOutput: {
    extract: field('task_id',),
    format(v, tense,) {
      return `${tense === 'pre' ? 'Reading' : 'Read'} task output #${v}`;
    },
    fallback: { pre: 'Reading task output', post: 'Read task output', },
  },
  TaskStop: {
    extract: field('task_id',),
    format(v, tense,) {
      return `${tense === 'pre' ? 'Stopping' : 'Stopped'} task #${v}`;
    },
    fallback: { pre: 'Stopping task', post: 'Stopped task', },
  },
  TaskUpdate: {
    extract: field('taskId',),
    format(v, tense,) {
      return `${tense === 'pre' ? 'Updating' : 'Updated'} task #${v}`;
    },
    fallback: { pre: 'Updating task', post: 'Updated task', },
  },
  CronCreate: {
    extract: field('prompt',),
    format(v, tense,) {
      return `${tense === 'pre' ? 'Scheduling' : 'Scheduled'}: ${
        truncate(v, MAX_PATTERN_LENGTH,)
      }`;
    },
    fallback: { pre: 'Scheduling cron', post: 'Scheduled cron', },
  },
  CronDelete: {
    extract: field('id',),
    format(v, tense,) {
      return `${tense === 'pre' ? 'Deleting' : 'Deleted'} cron #${v}`;
    },
    fallback: { pre: 'Deleting cron', post: 'Deleted cron', },
  },
  CronList: {
    extract() {/* No extractable value */},
    format() {
      return '';
    },
    fallback: { pre: 'Listing cron jobs', post: 'Listed cron jobs', },
  },
};
