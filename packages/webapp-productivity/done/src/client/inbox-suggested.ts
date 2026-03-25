/**
 * Suggested section builder for the Inbox page.
 *
 * Builds the collapsible "Suggested" section with location autodetect
 * toggle, focus preset dropdown, and the suggested task list.
 */
import {
  $ as h,
} from '@monochromatic-dev/module-es/ts/types/t object/t htmlElement/f/t string jsx/r s/p n/index.ts';
import type {
  BlockedTaskLink,
  Task,
} from '../lib/types.ts';

/**
 * Builds the suggested section with controls and task list.
 *
 * @param suggestedTasks - Tasks to display in the suggested section
 *
 * @param blockedTasksByBlocker - Map of blocker ID to blocked task links
 *
 * @param buildTaskList - Function to build a task list element
 *
 * @returns Suggested section element ready for DOM insertion
 */
export function buildSuggestedSection(
  {
    suggestedTasks,
    blockedTasksByBlocker,
    buildTaskList,
  }: {
    suggestedTasks: readonly Task[];
    blockedTasksByBlocker: Record<string, BlockedTaskLink[] | undefined>;
    buildTaskList: (tasks: readonly Task[],
      blocked: Record<string, BlockedTaskLink[] | undefined>,) => HTMLUListElement;
  },
): HTMLElement {
  /** Collapsible section heading for suggested tasks. */
  const suggestedSection = h({
    tag: 'section-heading',
    attrs: { icon: '\u2728', label: 'Suggested', },
  },);

  /** Content container for the suggested tasks section. */
  const suggestedContent = h({
    tag: 'div',
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--gap)',
    },
    children: [
      h({
        tag: 'div',
        class: 'controls',
        children: [
          h({
            tag: 'div',
            class: 'control-group',
            children: [
              h({
                tag: 'h3',
                class: 'subsection-heading',
                text: 'My location',
              },),
              h({
                tag: 'p',
                class: 'subsection-desc',
                text: 'Suggesting tasks can be done near the location.',
              },),
              h({
                tag: 'div',
                class: 'location-options',
                children: [
                  h({
                    tag: 'button',
                    class: 'autodetect-toggle',
                    children: [
                      h({
                        tag: 'span',
                        text: 'autodetect',
                      },),
                      h({
                        tag: 'toggle-switch',
                        attrs: { on: '', },
                      },),
                    ],
                  },),
                ],
              },),
            ],
          },),
          h({
            tag: 'div',
            class: 'control-group',
            children: [
              h({
                tag: 'h3',
                class: 'subsection-heading',
                text: 'My focus',
              },),
              h({
                tag: 'p',
                class: 'subsection-desc',
                text: 'Additional instructions on which tasks to suggest.',
              },),
              h({
                tag: 'focus-dropdown',
                attrs: { value: 'Adulting tasks first', },
              },),
            ],
          },),
        ],
      },),
      suggestedTasks.length === 0
        ? h({
          tag: 'p',
          class: 'empty',
          text: 'No tasks yet.',
        },)
        : buildTaskList(
          suggestedTasks,
          blockedTasksByBlocker,
        ),
    ],
  },);

  suggestedSection.append(suggestedContent,);
  return suggestedSection;
}
