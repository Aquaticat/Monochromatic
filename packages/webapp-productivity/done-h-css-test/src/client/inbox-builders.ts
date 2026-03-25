/**
 * DOM building helpers for the Inbox page.
 */
import {
  $ as h,
} from '@monochromatic-dev/module-es/ts/types/t object/t htmlElement/f/t string jsx/r s/p n/index.ts';
import type {
  BlockedTaskLink,
  Task,
} from '../lib/types.ts';
import { createTaskCard, } from './lib/task-card.ts';

/** Shape of the JSON blob embedded in the inbox page by the server. */
export type InboxPageData = {
  /** AI-prioritized suggested tasks for the current context. */
  suggestedTasks: Task[];
  /** All inbox tasks. */
  allTasks: Task[];
  /** Map of blocker task ID to the tasks it blocks. */
  blockedTasksByBlocker: Record<string, BlockedTaskLink[] | undefined>;
};

/**
 * Builds a task list with optional blocked-child nesting.
 *
 * @returns UL element containing task cards with nested blocker children
 */
export function buildTaskList(
  {
    tasks,
    blockedTasksByBlocker,
    onOpen,
    onToggleComplete,
  }: {
    tasks: readonly Task[];
    blockedTasksByBlocker: Record<string, BlockedTaskLink[] | undefined>;
    onOpen: (taskId: string,) => void;
    onToggleComplete: (taskId: string,) => Promise<void>;
  },
): HTMLUListElement {
  const list = h({
    tag: 'ul',
    class: 'task-list',
  },);

  for (const task of tasks) {
    list.append(createTaskCard(
      task,
      { onOpen, onToggleComplete, },
    ),);

    const childLinks = blockedTasksByBlocker[task.id] ?? [];
    if (childLinks.length > 0) {
      list.append(
        h({
          tag: 'div',
          class: 'task-children',
          children: [
            h({
              tag: 'ul',
              class: 'task-list',
              children: childLinks.map(function buildBlockedCard(childLink,) {
                return createTaskCard(
                  childLink.task,
                  { showBlockedBadge: true, onOpen,
                  onToggleComplete, },
                );
              },),
            },),
          ],
        },),
      );
    }
  }

  return list;
}
