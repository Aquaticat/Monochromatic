/**
 * Pill element builder for the `<task-detail>` web component.
 */
import {
  $ as h,
} from '@monochromatic-dev/module-es/ts/types/t object/t htmlElement/f/t string jsx/r s/p n/index.ts';
import type { Task, } from '../../lib/types.ts';
import { formatRunningTrackedTime, } from '../lib/task-card.ts';
import type { MetadataState, } from './task-detail-types.ts';

/**
 * Builds pill elements from current metadata state and autofill status.
 *
 * @returns Array of pill span elements
 */
export function buildPillElements({ task, metadata, autofillLoading, autofilled, }: {
  task: Task;
  metadata: MetadataState;
  autofillLoading: boolean;
  autofilled: Set<string>;
},): HTMLElement[] {
  const pillData = [
    { field: 'tags',
      text: metadata.tags.length > 0 ? `# ${metadata.tags.join(', ',)}` : '# ?', },
    { field: 'tracked', text: `tracked: ${formatRunningTrackedTime(task,)}`, },
    { field: 'locations', text: metadata.locations.length > 0
      ? `where: ${metadata.locations.join(', ',)}`
      : 'where: ?', },
    { field: 'priority', text: `priority: ${metadata.priority ?? '?'}`, },
    { field: 'due', text: `due: ${task.dueDate ?? '?'}`, },
    { field: 'complexity', text: `complexity: ${metadata.complexity ?? '?'}`, },
    { field: 'reminders', text: task.reminders.length > 0
      ? `reminders: ${task.reminders[0]}`
      : 'reminders: None', },
    { field: 'blockedBy', text: task.blockedBy.length > 0
      ? `blockedBy: ${String(task.blockedBy.length,)}`
      : 'blockedBy: none', },
  ];

  return pillData.map(function toPillElement(pill,) {
    const element = h({ tag: 'span', class: 'pill', text: pill.text, },);
    if (autofillLoading)
      element.dataset['loading'] = '';
    else if (autofilled.has(pill.field,))
      element.dataset['autofilled'] = '';
    return element;
  },);
}
