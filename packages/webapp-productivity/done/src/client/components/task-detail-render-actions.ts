/**
 * Button row construction and action event wiring for task-detail.
 *
 * Extracted from task-detail-render.ts to keep each file
 * under the line-count limit.
 */
import {
  $ as h,
} from '@monochromatic-dev/module-es/ts/types/t object/t htmlElement/f/t string jsx/r s/p n/index.ts';
import type { Task, } from '../../lib/types.ts';

/**
 * Builds the start/stop/complete/delete button row for a task.
 *
 * @param task - Task whose state determines button disabled states
 *
 * @param isCreate - Whether the detail panel is in create mode
 *
 * @returns Button row element
 */
export function buildActionButtonRow(
  {
    task,
    isCreate,
  }: {
    task: Task;
    isCreate: boolean
  },
): HTMLElement {
  const startAttrs: Record<string, string> = { 'data-action': 'start', };
  if (task.timerStartedAt !== null)
    startAttrs['disabled'] = '';
  const stopAttrs: Record<string, string> = { 'data-action': 'stop', };
  if (task.timerStartedAt === null)
    stopAttrs['disabled'] = '';
  const completeAttrs: Record<string, string> = { 'data-action': 'complete', };
  if (task.blockedBy.length > 0)
    completeAttrs['disabled'] = '';

  const btnRow = h({
    tag: 'div',
    class: 'btn-row',
    children: [
      h({
        tag: 'button',
        class: 'btn-outline',
        attrs: startAttrs,
        text: 'Start',
      },),
      h({
        tag: 'button',
        class: 'btn-outline',
        attrs: stopAttrs,
        text: 'Stop',
      },),
      h({
        tag: 'button',
        class: 'btn-primary',
        attrs: completeAttrs,
        text: 'Complete',
      },),
      h({
        tag: 'button',
        class: 'btn-outline',
        attrs: { 'data-action': 'delete', },
        text: 'Delete',
      },),
    ],
  },);
  if (isCreate)
    btnRow.dataset['hidden'] = '';
  return btnRow;
}

/**
 * Wires a click-delegation handler on the shadow root that dispatches
 * `action` custom events from `[data-action]` buttons.
 *
 * @param shadow - Shadow root to listen on
 *
 * @param host - Host element that receives the dispatched events
 *
 * @param titleInput - Title input whose value is included in the event detail
 *
 * @param descInput - Description textarea whose value is included in the event detail
 */
export function attachActionHandler(
  {
    shadow,
    host,
    titleInput,
    descInput,
  }: {
    shadow: ShadowRoot;
    host: HTMLElement;
    titleInput: HTMLInputElement;
    descInput: HTMLTextAreaElement;
  },
): void {
  shadow.addEventListener(
    'click',
    function onAction(event,): void {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- event.target is always an Element in shadow DOM click handlers
    const target = event.target as HTMLElement;
    const button = target.closest<HTMLElement>('[data-action]',);
    if (button === null)
      return;
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- closest returns HTMLElement with dataset
    const { action, } = (button as HTMLElement).dataset;

    host.dispatchEvent(new CustomEvent('action', {
      bubbles: true,
      detail: {
        action,
        title: titleInput.value,
        description: descInput.value,
      },
    },),);
  },
  );
}
