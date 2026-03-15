/**
 * Pill data construction and rendering for `\<task-detail\>`.
 *
 * Extracted from task-detail.ts to keep each file under the line-count limit.
 */
import {
  $ as h,
} from '@monochromatic-dev/module-es/ts/types/t object/t htmlElement/f/t string jsx/r s/p n/index.ts';
import type { Task, } from '../../lib/types.ts';
import { formatRunningTrackedTime, } from '../lib/format-tracked-time.ts';

/** Single pill descriptor with a field identifier and display text. */
export type PillDatum = {
  /** Metadata field this pill represents. */
  field: string;
  /** Display text shown inside the pill. */
  text: string;
};

/**
 * Builds the pill descriptor array from current task state and metadata overrides.
 *
 * @param task - Task data for non-editable fields like tracked time and due date
 *
 * @param tags - Current tag values (may differ from task.tags during editing)
 *
 * @param locations - Current location values
 *
 * @param priority - Current priority value
 *
 * @param complexity - Current complexity value
 *
 * @returns Array of pill descriptors
 */
export function buildPillData(
  { task, tags, locations, priority, complexity, }: {
    task: Task;
    tags: string[];
    locations: string[];
    priority: string | null;
    complexity: string | null;
  },
): PillDatum[] {
  return [
    { field: 'tags', text: tags.length > 0 ? `# ${tags.join(', ',)}` : '# ?', },
    { field: 'tracked', text: `tracked: ${formatRunningTrackedTime(task,)}`, },
    { field: 'locations', text: locations.length > 0
      ? `where: ${locations.join(', ',)}`
      : 'where: ?', },
    { field: 'priority', text: `priority: ${priority ?? '?'}`, },
    { field: 'due', text: `due: ${task.dueDate ?? '?'}`, },
    { field: 'complexity', text: `complexity: ${complexity ?? '?'}`, },
    { field: 'reminders', text: task.reminders.length > 0
      ? `reminders: ${task.reminders[0]}`
      : 'reminders: None', },
    { field: 'blockedBy', text: task.blockedBy.length > 0
      ? `blockedBy: ${String(task.blockedBy.length,)}`
      : 'blockedBy: none', },
  ];
}

/**
 * Renders pill elements from descriptors, applying loading/autofilled states.
 *
 * @param pills - Pill descriptors from {@link buildPillData}
 *
 * @param loading - Whether the autofill request is in progress
 *
 * @param autofilled - Set of field names that were autofilled by AI
 *
 * @returns Array of pill span elements
 */
export function buildPillElements(
  { pills, loading, autofilled, }: {
    pills: PillDatum[];
    loading: boolean;
    autofilled: Set<string>;
  },
): HTMLElement[] {
  return pills.map(
    function buildPill(pill,): HTMLElement {
      const element = h({ tag: 'span', class: 'pill', text: pill.text, },);
      if (loading)
        element.dataset['loading'] = '';
      else if (autofilled.has(pill.field,))
        element.dataset['autofilled'] = '';
      return element;
    },
  );
}
