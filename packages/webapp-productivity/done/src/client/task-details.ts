/**
 * Client entry script for the Task Detail page.
 *
 * Same hydration pattern as inbox.ts: injectCSS -\> readPageData -\> build DOM into #app.
 * The server renders its own HTML shell (not via renderPage) without `\<top-nav\>`,
 * because the `\<task-detail\>` component provides its own back-button header.
 */
import styles from '../../dist/css/styles.css' with { type: 'text', };
import type { Task, } from '../lib/types.ts';
import { api, } from './lib/api.ts';
import { injectCSS, } from './lib/inject-css.ts';
import { readPageData, } from './lib/page-data.ts';
// oxlint-disable-next-line import/no-unassigned-import -- side-effect: register custom elements
import './components/side-drawer.ts';
import type { TaskDetail, } from './components/task-detail.ts';
// oxlint-disable-next-line import/no-unassigned-import -- side-effect: registers the task-detail custom element
import './components/task-detail.ts';

/** Minimal task info shown in the blocker picker dropdown. */
type BlockerCandidate = {
  /** UUID of the candidate blocker task. */
  id: string;
  /** Title of the candidate blocker task. */
  title: string;
};

/** Summary of a task that blocks the current task (shown as a chip/badge). */
type BlockerSummary = {
  /** UUID of the blocking task. */
  id: string;
  /** Title of the blocking task. */
  title: string;
  /** Current status of the blocking task. */
  status: string;
};

/** Shape of the JSON blob embedded in the task detail page by the server. */
type TaskDetailsPageData = {
  /** Task being viewed/edited. */
  task: Task;
  /** Available tasks that could be selected as blockers. */
  blockerCandidates: BlockerCandidate[];
  /** Current blockers for this task. */
  blockerSummaries: BlockerSummary[];
};

injectCSS(styles,);

/** Deserialized page data from the server-rendered JSON blob. */
const pageData = readPageData<TaskDetailsPageData>();
/** Task being viewed, extracted from the page data blob. */
const { task, } = pageData;

/** Root app container element. */
const appElement = document.querySelector<HTMLElement>('#app',);
if (!(appElement instanceof HTMLElement))
  throw new Error('Missing app element',);

/** Typed reference to the app container. */
const app = appElement;

/** Task detail web component instance for displaying/editing the task. */
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- custom element registered as "task-detail" returns TaskDetail
const detail = document.createElement('task-detail',) as TaskDetail;
detail.configure({
  task,
  blockerSummaries: pageData.blockerSummaries,
},);

// oxlint-disable-next-line typescript/no-misused-promises -- addEventListener does not await the handler
detail.addEventListener('action', async function onAction(event,) {
  if (!(event instanceof CustomEvent))
    throw new TypeError("Expected CustomEvent for 'action' listener",);
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- CustomEvent detail shape matches the action payload
  const { action, title, description, } = event.detail as {
    action: string;
    title: string;
    description: string;
  };

  if (action === 'close')
    globalThis.location.href = '/';
  else if (action === 'save') {
    const metadata = detail.getMetadata();
    const payload = {
      title,
      description: description.length === 0 ? null : description,
      tags: metadata.tags,
      locations: metadata.locations,
      priority: metadata.priority,
      complexity: metadata.complexity,
      dueDate: task.dueDate,
      blockedBy: task.blockedBy,
    };
    await api(`/api/tasks/${task.id}`, {
      method: 'PUT',
      body: JSON.stringify(payload,),
    },);
    globalThis.location.reload();
  }
  else if (action === 'start') {
    await api(`/api/tasks/${task.id}/start`, { method: 'POST', },);
    globalThis.location.reload();
  }
  else if (action === 'stop') {
    await api(`/api/tasks/${task.id}/stop`, { method: 'POST', },);
    globalThis.location.reload();
  }
  else if (action === 'complete') {
    await api(`/api/tasks/${task.id}/complete`, { method: 'POST', },);
    globalThis.location.href = '/';
  }
  else if (action === 'delete') {
    await api(`/api/tasks/${task.id}`, { method: 'DELETE', },);
    globalThis.location.href = '/';
  }
},);

app.append(detail,);
