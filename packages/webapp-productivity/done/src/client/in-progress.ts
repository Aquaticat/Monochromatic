/**
 * Client entry script for the In-Progress page.
 *
 * Same hydration pattern as inbox.ts: injectCSS -\> readPageData -\> build DOM into #app.
 * Additionally runs a 1-second interval to live-update tracked-time chip text.
 */
import {
  hDom as h,
} from '@monochromatic-dev/module-hyperscript/ts';
import styles from '../../dist/css/styles.css' with { type: 'text', };
import type { Task, } from '../lib/types.ts';
import { api, } from './lib/api.ts';
import { injectCSS, } from './lib/inject-css.ts';
import { readPageData, } from './lib/page-data.ts';
import {
  createTaskCard,
  formatRunningTrackedTime,
} from './lib/task-card.ts';
// oxlint-disable-next-line import/no-unassigned-import -- side-effect: register custom elements
import './components/side-drawer.ts';
// oxlint-disable-next-line import/no-unassigned-import -- side-effect: register custom elements
import './components/top-nav.ts';

/** Shape of the JSON blob embedded in the in-progress page by the server. */
type InProgressPageData = {
  /** Active in-progress tasks with running timers. */
  tasks: Task[];
};

/**
 * Navigates to the task detail page.
 *
 * @param taskId - UUID of the task to open
 */
function openTask(taskId: string,): void {
  globalThis.location.href = `/tasks/${taskId}`;
}

injectCSS(styles,);

/** Deserialized page data from the server-rendered JSON blob. */
const pageData = readPageData<InProgressPageData>();

/** Root app container element. */
const appElement = document.querySelector<HTMLElement>('#app',);
if (!(appElement instanceof HTMLElement))
  throw new Error('Missing app element',);

/** Typed reference to the app container. */
const app = appElement;

if (pageData.tasks.length === 0) {
  app.append(h({
    tag: 'p',
    class: 'empty',
    text: 'No active timers.',
  },),);
}

/** Task card list for in-progress tasks. */
const list = h({
  tag: 'ul',
  class: 'task-list',
},);

for (const task of pageData.tasks) {
  list.append(
    createTaskCard(
      task,
      {
        onOpen: openTask,
        onToggleComplete: async function stopTimer(taskId,) {
          await api(`/api/tasks/${taskId}/stop`, { method: 'POST', },);
          globalThis.location.reload();
        },
      },
    ),
  );
}

if (pageData.tasks.length > 0)
  app.append(list,);

/** Timer update interval in milliseconds. */
const TIMER_UPDATE_MS = 1_000;

// Live timer updates -- correlate each card with its task by DOM order
setInterval(
  function updateTimers() {
    const cards = list.querySelectorAll<HTMLElement>('task-card',);
    cards.forEach(function updateCard(card, cardIndex,) {
      const task = pageData.tasks[cardIndex];
      if (task === undefined)
        return;
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- custom element has getChipElement method
      const chipEl = (card as unknown as {
        getChipElement?: (prefix: string,) => HTMLSpanElement | null;
      })
        .getChipElement?.('tracked:',);
      if (chipEl instanceof HTMLSpanElement)
        chipEl.textContent = `tracked: ${formatRunningTrackedTime(task,)}`;
    },);
  },
  TIMER_UPDATE_MS,
);
