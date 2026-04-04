/**
 * DOM building helpers for the `<task-detail>` render method.
 */
import {
  hDom as h,
} from '@monochromatic-dev/module-hyperscript/ts';
import type { Task, } from '../../lib/types.ts';

/** Options for building the task detail DOM tree. */
type RenderOptions = {
  /** Task being displayed. */
  task: Task;
  /** Whether the component is in create mode. */
  isCreate: boolean;
  /** Compiled CSS string for styles. */
  styles: string;
};

/** References to dynamic elements within the rendered tree. */
export type RenderRefs = {
  /** Title text input. */
  titleInput: HTMLInputElement;
  /** Description textarea. */
  descInput: HTMLTextAreaElement;
  /** Container for metadata pill elements. */
  pillsContainer: HTMLElement;
  /** Action button row (start/stop/complete/delete). */
  btnRow: HTMLElement;
};

/** Result of building the task detail DOM tree. */
type RenderResult = {
  /** Top-level elements to insert into the shadow root. */
  elements: (HTMLElement | HTMLStyleElement)[];
  /** References to elements that need post-render interaction. */
  refs: RenderRefs;
};

/**
 * Builds the complete `<task-detail>` Shadow DOM tree.
 *
 * Returns both the element list and refs to interactive elements
 * so the caller can wire up event listeners without querying the DOM.
 *
 * @returns Elements and refs
 */
export function buildTaskDetailTree(
  {
    task,
    isCreate,
    styles,
  }: RenderOptions,
): RenderResult {
  // Close button uses innerHTML for SVG because h() creates HTML-namespace
  // elements -- SVG requires the SVG namespace.
  const closeButton = h({
    tag: 'button',
    class: 'close',
    attrs: {
      'data-action': 'close',
      'aria-label': 'Close',
    },
  },);
  closeButton.innerHTML =
    `<svg viewBox="0 0 48 48" fill="none"><line x1="14" y1="14" x2="34" y2="34"/><line x1="34" y1="14" x2="14" y2="34"/></svg>`;

  const titleInput = h({
    tag: 'input',
    class: 'title-input',
    attrs: {
      type: 'text',
      value: task.title,
      placeholder: 'Title',
      required: '',
    },
  },);

  const descInput = h({
    tag: 'textarea',
    class: 'desc-input',
    attrs: { placeholder: 'description', },
  },);
  if (task.description !== null)
    descInput.textContent = task.description;

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

  const pillsContainer = h({
    tag: 'div',
    class: 'pills',
  },);

  const elements = [
    h({
      tag: 'style',
      text: styles,
    },),
    h({
      tag: 'div',
      class: 'header',
      children: [
        closeButton,
        h({
          tag: 'span',
          class: 'heading',
          text: isCreate ? 'New task' : 'Task details',
        },),
        h({
          tag: 'button',
          class: isCreate ? 'btn-primary' : 'btn-outline',
          attrs: { 'data-action': 'save', },
          text: isCreate ? 'Create' : 'Save',
        },),
      ],
    },),
    titleInput,
    descInput,
    h({
      tag: 'div',
      class: 'actions',
      children: [
        h({
          tag: 'button',
          class: 'btn-outline',
          attrs: { 'data-action': 'attach', },
          text: 'Attach file',
        },),
        h({
          tag: 'button',
          class: 'btn-outline',
          attrs: { 'data-action': 'photo', },
          text: 'Take photo',
        },),
      ],
    },),
    pillsContainer,
    btnRow,
  ];

  return {
    elements,
    refs: { titleInput, descInput, pillsContainer, btnRow, },
  };
}
