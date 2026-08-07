/**
 * Progress release for forced continuation.
 *
 * The depth guard bounds a runaway. It does not stop the opposite waste: a
 * session with nothing to do, blocked on an external event, where every forced
 * turn produces another restatement of the same blocker and no work at all.
 * Observed in a real session where the hook forced eleven such turns before
 * Claude Code's own cap overrode it.
 *
 * The release condition is that the previous forced continuation issued no tool
 * call. An agent that was pushed and still did nothing is either finished or
 * genuinely blocked, and pushing it again buys text rather than work. This is
 * measurable from the transcript and never asks the agent whether it is done,
 * so it stays outside the model's control in the way the goal feature and the
 * `loop` skill are not.
 *
 * @module
 */

import type {
  BackgroundTask,
  TranscriptRecord,
} from '@monochromatic-dev/claude-code-plugin-hook-type/ts';

import {
  isForcedContinuationRecord,
  parseRecord,
  UNPARSABLE,
} from './continuation-depth.ts';

/**
 * Task status meaning the work has not finished.
 */
const RUNNING_STATUS = 'running' as const;

/**
 * Reports whether the session is waiting on a background task.
 *
 * A running task is work the agent cannot advance by taking another turn, so
 * pushing it produces a restatement of the wait. This is the condition that
 * would have released the session observed forcing eleven turns while blocked
 * on a long shell run.
 *
 * Reads the `Stop` payload rather than the transcript, since Claude Code
 * reports live task state on the event itself.
 *
 * @param backgroundTasks - `background_tasks` from the `Stop` event
 *
 * @returns whether any task is still running
 *
 * @example
 * ```ts
 * hasRunningBackgroundTask([{ id: 'x', type: 'shell', status: 'running' }]); // true
 * ```
 */
function hasRunningBackgroundTask(backgroundTasks: readonly BackgroundTask[] = [],): boolean {
  return backgroundTasks.some(isRunningTask,);
}

/**
 * Reports whether one background task has not finished.
 *
 * @param task - background task from the `Stop` event
 *
 * @returns whether this task is still running
 *
 * @example
 * ```ts
 * isRunningTask({ id: 'x', type: 'shell', status: 'completed' }); // false
 * ```
 */
function isRunningTask(task: BackgroundTask,): boolean {
  return task.status === RUNNING_STATUS;
}

/**
 * Reports whether the agent issued any tool call since the most recent forced
 * continuation.
 *
 * Scans newest first and stops at the first forced-continuation record, so only
 * the turn that block produced is examined. A transcript with no forced
 * continuation in range answers `true`, because nothing has been pushed yet and
 * the first block should not be suppressed.
 *
 * Any tool counts, including read-only ones. A turn that only searched is still
 * a turn that engaged with the task, and treating research as idleness would
 * release exactly when the agent is orienting.
 *
 * @param transcriptLines - transcript JSONL lines, oldest first
 *
 * @returns whether work followed the last forced continuation
 *
 * @example
 * ```ts
 * workedSinceLastForcedContinuation(lines);
 * ```
 */
function workedSinceLastForcedContinuation(transcriptLines: readonly string[],): boolean {
  for (let index = transcriptLines.length - 1; index >= 0; index--) {
    /**
     * Raw transcript line under inspection.
     */
    const line = transcriptLines[index] ?? '';

    if (line === '') {
      continue;
    }

    /**
     * Parsed record, or the sentinel for a truncated line.
     */
    const record = parseRecord(line,);

    if (record === UNPARSABLE) {
      continue;
    }
    if (isForcedContinuationRecord(record,)) {
      return false;
    }
    if (recordCarriesToolUse(record,)) {
      return true;
    }
  }
  return true;
}

/**
 * Reports whether an assistant record contains at least one tool call.
 *
 * @param record - parsed transcript record
 *
 * @returns whether this record issued a tool call
 *
 * @example
 * ```ts
 * recordCarriesToolUse({ type: 'assistant', message: { content: [{ type: 'tool_use' }] } });
 * ```
 */
function recordCarriesToolUse(record: TranscriptRecord,): boolean {
  /**
   * Assistant content blocks, an array only for structured messages.
   */
  const content = record
    .message
    ?.content;

  if ((record.type !== 'assistant')
    || (content === undefined)
    || ((typeof content) === 'string')) {
    return false;
  }
  return content.some(isToolUseBlock,);
}

/**
 * Reports whether a content block is a tool call.
 *
 * @param block - one content block from an assistant message
 *
 * @returns whether this block issued a tool call
 *
 * @example
 * ```ts
 * isToolUseBlock({ type: 'tool_use' }); // true
 * ```
 */
function isToolUseBlock(block: unknown,): boolean {
  return ((typeof block) === 'object')
    && (block !== null)
    && (('type' in block))
    && ((block as { readonly type?: unknown; }).type === 'tool_use');
}

export {
  hasRunningBackgroundTask,
  isRunningTask,
  isToolUseBlock,
  recordCarriesToolUse,
  RUNNING_STATUS,
  workedSinceLastForcedContinuation,
};
