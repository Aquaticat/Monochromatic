/**
 * New-task panel module for the Inbox page.
 *
 * The FAB button transforms into a fixed panel containing `<task-detail>`
 * in create mode. Uses the Popover API for top-layer stacking without a
 * blocking backdrop, so the side-drawer remains visible and interactive.
 *
 * Exceeds 100 lines: the blank task template (18 fields), event listener
 * with save/close branches, and panel open/close logic form a single cohesive
 * unit; splitting further would scatter the lifecycle across files.
 */
import { hDom as h, } from '@monochromatic-dev/module-hyperscript/ts';
import type { Task, } from '../lib/types.ts';
import type { TaskDetail, } from './components/task-detail.ts';
import { api, } from './lib/api.ts';
// Side-effect import: registers the `<task-detail>` custom element
// oxlint-disable-next-line import/no-unassigned-import -- side-effect: register custom elements
import './components/task-detail.ts';

/** Blank task template used when creating a new task. */
const emptyTask: Task = {
  id: '',
  title: '',
  description: null,
  tags: [],
  locations: [],
  priority: null,
  dueDate: null,
  complexity: null,
  reminders: [],
  blockedBy: [],
  trackedTime: 0,
  timerStartedAt: null,
  status: 'inbox',
  source: 'local',
  sourceId: null,
  sourceMeta: null,
  createdAt: '',
  updatedAt: '',
};

/**
 * Return value of {@link createNewTaskDialog}.
 */
type NewTaskDialog = {
  /** Fixed panel element to append to the document body. */
  panel: HTMLElement;
  /** FAB button element to append to the document body. */
  fab: HTMLElement;
};

/**
 * Builds the new-task panel and its trigger FAB button.
 *
 * Clicking the FAB hides it and reveals a fixed panel in the same
 * bottom-right region. Closing or saving collapses the panel and
 * restores the FAB. The panel uses `popover="manual"` for top-layer
 * stacking without a blocking backdrop.
 *
 * @returns panel and fab elements ready for DOM insertion
 *
 * @example
 * ```ts
 * const { panel, fab } = createNewTaskDialog();
 * document.body.append(panel, fab);
 * ```
 */
export function createNewTaskDialog(): NewTaskDialog {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- createElement returns HTMLElement but task-detail is registered as TaskDetail
  const detail = document.createElement('task-detail',) as TaskDetail;

  const panel = h({
    tag: 'div',
    class: 'new-task-panel',
  },);
  panel.setAttribute(
    'popover',
    'manual',
  );
  panel.append(detail,);

  /** Reference to the FAB so open/close can toggle its visibility. */
  let fabElement: HTMLElement | null = null;

  /** Hides the panel popover and restores the FAB. */
  function closePanel(): void {
    panel.hidePopover();
    if (fabElement !== null)
      fabElement.hidden = false;
  }

  detail.addEventListener(
    'action',
    function handleAction(event,) {
      if (!(event instanceof CustomEvent))
        throw new TypeError("Expected CustomEvent for 'action' listener",);
      const {
        action,
        title,
        description,
        // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- event.detail shape is controlled by the task-detail component
      } = event.detail as {
        action: string;
        title: string;
        description: string;
      };

      if (action === 'close') {
        closePanel();
        return;
      }

      if (action === 'save') {
        const trimmedTitle = title.trim();
        if (trimmedTitle.length === 0)
          return;

        const metadata = detail.getMetadata();
        void (async function saveTask(): Promise<void> {
          await api(
            '/api/tasks',
            {
              method: 'POST',
              body: JSON.stringify({
                title: trimmedTitle,
                description: description.length === 0 ? null : description,
                tags: metadata.tags,
                locations: metadata.locations,
                priority: metadata.priority,
                complexity: metadata.complexity,
              },),
            },
          );
          globalThis.location.reload();
        })();
      }
    },
  );

  /** Opens the panel with a fresh empty task, hiding the FAB and playing the expand animation. */
  function openPanel(): void {
    console.log(
      '[new-task-dialog] openPanel(), detail.configure is:',
      typeof detail.configure,
    );
    detail.configure({
      task: emptyTask,
      blockerSummaries: [],
      mode: 'create',
    },);
    if (fabElement !== null)
      fabElement.hidden = true;

    // Restart the expand animation by toggling the data attribute
    delete panel.dataset['animating'];
    panel.showPopover();
    requestAnimationFrame(function animatePanel() {
      panel.dataset['animating'] = '';
      const titleInput =
        detail.shadowRoot?.querySelector<HTMLInputElement>('.title-input',) ?? null;
      titleInput?.focus();
    },);
  }

  const fab = h({
    tag: 'fab-button',
    attrs: { label: 'Add task', },
    on: { click: openPanel, },
  },);
  // let bindings justified: fabElement is set once after creation, read in open/close callbacks
  fabElement = fab;

  return {
    panel,
    fab,
  };
}
