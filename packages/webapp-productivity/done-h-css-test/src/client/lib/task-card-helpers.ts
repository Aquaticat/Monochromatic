/**
 * Helper functions and types for `<task-card>`.
 */
import type { Task } from "../../lib/types.ts";

/** Configuration for a `<task-card>` instance, passed via `createTaskCard`. */
export type TaskCardOptions = {
  /** Whether to show a red "blocked" badge chip. */
  showBlockedBadge?: boolean;
  /** Callback when the card body is clicked (navigates to task detail). */
  onOpen: (taskId: string) => void;
  /** Callback when the checkbox is clicked (completes the task). */
  onToggleComplete?: (taskId: string) => Promise<void>;
};

/**
 * Formats a duration in seconds as a human-readable string (e.g. "1h30min15s").
 *
 * @param seconds - Non-negative duration in seconds
 *
 * @example
 * ```ts
 * formatTrackedTime(3661) // "1h1min1s"
 * ```
 */
export function formatTrackedTime(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) {
    const dayHours = Math.floor(hours / 24);
    const remainHours = hours % 24;
    if (dayHours > 0) {
      return `${dayHours}d${remainHours}h${minutes}min${remainingSeconds}s`;
    }
    return `${hours}h${minutes}min${remainingSeconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}min${remainingSeconds}s`;
  }

  return `${totalSeconds}s`;
}

/**
 * Collects all metadata chip labels for a task (tags, tracked time, location, etc.).
 * Each entry becomes a `<span class="chip">` in the card's shadow DOM.
 *
 * @param task - Task to build chip labels for
 *
 * @returns Array of chip label strings
 */
export function buildChipTexts(task: Task): string[] {
  const chips: string[] = [];

  if (task.tags.length > 0) {
    chips.push(`# ${task.tags.join(", ")}`);
  }
  chips.push(`tracked: ${formatTrackedTime(task.trackedTime)}`);
  if (task.locations.length > 0) {
    chips.push(`where: ${task.locations.join(", ")}`);
  }
  if (task.priority !== null) {
    chips.push(`priority: ${task.priority}`);
  }
  if (task.dueDate !== null) {
    chips.push(`due: ${task.dueDate}`);
  }
  if (task.complexity !== null) {
    chips.push(`complexity: ${task.complexity}`);
  }
  if (task.reminders.length > 0) {
    chips.push(`reminders: ${task.reminders[0]}`);
  }
  if (task.blockedBy.length > 0) {
    chips.push(`blockedBy: ${task.blockedBy.length}`);
  } else {
    chips.push("blockedBy: none");
  }

  return chips;
}
