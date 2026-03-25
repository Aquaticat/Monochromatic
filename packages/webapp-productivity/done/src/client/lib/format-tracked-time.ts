/**
 * Duration formatting utilities for tracked task time.
 *
 * Pure functions with no component dependencies -- used by both
 * `\<task-card\>` and `\<task-detail\>` to display elapsed time.
 */
import type { Task, } from '../../lib/types.ts';

/** Seconds per minute. */
const SECONDS_PER_MINUTE = 60;

/** Seconds per hour. */
const SECONDS_PER_HOUR = 3_600;

/** Hours per day. */
const HOURS_PER_DAY = 24;

/** Milliseconds per second. */
const MS_PER_SECOND = 1_000;

/**
 * Formats a duration in seconds as a human-readable string (e.g. "1h30min15s").
 *
 * @param seconds - Non-negative duration in seconds
 *
 * @returns Formatted duration string
 */
export function formatTrackedTime(seconds: number,): string {
  const totalSeconds = Math.max(
    0,
    Math.floor(seconds,),
  );
  const hours = Math.floor(totalSeconds / SECONDS_PER_HOUR,);
  const minutes = Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE,);
  const remainingSeconds = totalSeconds % SECONDS_PER_MINUTE;

  if (hours > 0) {
    const dayHours = Math.floor(hours / HOURS_PER_DAY,);
    const remainHours = hours % HOURS_PER_DAY;
    if (dayHours > 0) {
      return `${String(dayHours,)}d${String(remainHours,)}h${String(minutes,)}min${
        String(remainingSeconds,)
      }s`;
    }
    return `${String(hours,)}h${String(minutes,)}min${String(remainingSeconds,)}s`;
  }

  if (minutes > 0)
    return `${String(minutes,)}min${String(remainingSeconds,)}s`;

  return `${String(totalSeconds,)}s`;
}

/**
 * Formats tracked time including elapsed seconds from a running timer.
 * If no timer is active, returns the static `trackedTime` formatted.
 *
 * @param task - Task with optional running timer
 *
 * @returns Formatted duration string
 */
export function formatRunningTrackedTime(task: Task,): string {
  if (task.timerStartedAt === null)
    return formatTrackedTime(task.trackedTime,);

  const elapsedSeconds = Math.max(
    0,
    Math.floor((Date.now() - Date.parse(task.timerStartedAt,)) / MS_PER_SECOND,),
  );
  return formatTrackedTime(task.trackedTime + elapsedSeconds,);
}
