/**
 * Editor buffer Web Worker.
 *
 * Holds the authoritative buffer for the custom editor as a piece
 * table. The main thread sends `apply`, `query`, `snapshot`, `undo`,
 * `redo`, and `init` messages; the worker replies with the post-edit
 * length, the substring requested, and the inverse changeset (for
 * `apply`) so the main thread can mirror the state.
 *
 * The piece-table primitives live in `buffer-table.ts`; this worker
 * file owns the table instance, the undo / redo stacks, the collapse
 * scheduler, and the message dispatch.
 *
 * Inbound messages:
 *
 *   { kind: 'init', initialText }
 *   { kind: 'apply', id, changeset }     // id used by main to correlate
 *   { kind: 'query', id, from, to }
 *   { kind: 'snapshot', id }             // full text (used by send)
 *   { kind: 'undo', id }
 *   { kind: 'redo', id }
 *
 * Outbound messages:
 *
 *   { kind: 'applied', id, length, inverse }
 *   { kind: 'queried', id, text }
 *   { kind: 'snapshotted', id, text }
 *   { kind: 'undone' | 'redone', id, length, applied }
 *   { kind: 'error', id, message }
 */

import {
  applyToTable,
  materialise,
  resetTable,
  substring,
  type Table,
} from './buffer-table.ts';
import type { Changeset, } from './changeset.ts';

/**
 * Maximum number of inverse changesets retained in the undo stack.
 */
const MAX_UNDO = 1_000;

/**
 * Node count above which the piece table collapses to one piece on idle.
 */
const COLLAPSE_THRESHOLD_NODES = 4_096;

/**
 * Idle delay before a collapse runs, in milliseconds.
 */
const COLLAPSE_DEBOUNCE_MS = 250;

/**
 * Pending or applied undo entry: (inverse changeset, pre-edit length).
 */
type UndoEntry = {
  readonly inverse: Changeset;
  readonly preLength: number;
};

/**
 * Inbound message variants.
 */
type InboundMessage =
  | {
    readonly kind: 'init';
    readonly initialText: string;
  }
  | {
    readonly kind: 'apply';
    readonly id: number;
    readonly changeset: Changeset;
  }
  | {
    readonly kind: 'query';
    readonly id: number;
    readonly from: number;
    readonly to: number;
  }
  | {
    readonly kind: 'snapshot';
    readonly id: number;
  }
  | {
    readonly kind: 'undo';
    readonly id: number;
  }
  | {
    readonly kind: 'redo';
    readonly id: number;
  };

/**
 * Outbound message variants.
 */
type OutboundMessage =
  | {
    readonly kind: 'applied';
    readonly id: number;
    readonly length: number;
    readonly inverse: Changeset;
  }
  | {
    readonly kind: 'queried';
    readonly id: number;
    readonly text: string;
  }
  | {
    readonly kind: 'snapshotted';
    readonly id: number;
    readonly text: string;
  }
  | {
    readonly kind: 'undone' | 'redone';
    readonly id: number;
    readonly length: number;
    readonly applied?: Changeset;
  }
  | {
    readonly kind: 'error';
    readonly id: number;
    readonly message: string;
  };

/**
 * The single piece-table instance for this worker.
 */
const table: Table = {
  original: '',
  add: '',
  pieces: [],
  length: 0,
};

/**
 * Inverse changesets stacked for undo (most-recent at the end).
 */
const undoStack: UndoEntry[] = [];

/**
 * Inverse changesets popped by undo, available to redo. Cleared on edit.
 */
const redoStack: UndoEntry[] = [];

/**
 * Sentinel for "no collapse queued". A unique `Symbol` rather than
 * `null`: a live timer handle is the only other value, so the scheduler
 * gates with `!== NO_TIMER`.
 */
const NO_TIMER: unique symbol = Symbol('messages-demo:no-collapse-timer',);

/* oxlint-disable no-restricted-syntax/no-module-root-let -- singleton timer handle: set when a collapse is scheduled, cleared from inside the timeout and from `scheduleCollapseIfNeeded` after re-check; wrapping in a Map adds noise without a key to hang state off */
/**
 * Pending collapse timer; `NO_TIMER` when no collapse is queued.
 */
let collapseTimer: ReturnType<typeof setTimeout> | typeof NO_TIMER = NO_TIMER;
/* oxlint-enable no-restricted-syntax/no-module-root-let */

/**
 * Schedules a node-count collapse on the next idle. If the table grew
 * past the threshold, the collapse re-anchors the document into a
 * single original piece (clearing the add buffer). Undo / redo are
 * preserved; the offsets are document-relative and the underlying
 * text is identical.
 *
 * Bounded so it never blocks an in-flight `apply`: the collapse runs
 * inside a `setTimeout(0)`, which yields to any queued message before
 * doing the work.
 */
function scheduleCollapseIfNeeded(): void {
  if (table.pieces
    .length
    < COLLAPSE_THRESHOLD_NODES)
    return;
  if (collapseTimer !== NO_TIMER)
    return;
  collapseTimer = setTimeout(
    function runCollapse() {
      collapseTimer = NO_TIMER;
      if (table.pieces
        .length
        < COLLAPSE_THRESHOLD_NODES)
        return;
      resetTable({
        table,
        text: materialise({ table, },),
      },);
    },
    COLLAPSE_DEBOUNCE_MS,
  );
}

/**
 * Pushes `entry` onto the undo stack, evicting the oldest entry when
 * the stack would exceed `MAX_UNDO`. Clears the redo stack; a fresh
 * edit invalidates any previously undone edits.
 *
 * @param input - the undo entry to record
 */
function pushUndo(input: { readonly entry: UndoEntry; },): void {
  undoStack.push(input.entry,);
  if (undoStack.length
    > MAX_UNDO)
    undoStack.shift();
  redoStack.length = 0;
}

/**
 * Type-safe `postMessage` to the main thread.
 *
 * @param message - outbound payload
 */
function post(message: OutboundMessage,): void {
  // DedicatedWorkerGlobalScope.postMessage has no targetOrigin parameter.
  /* oxlint-disable eslint-plugin-unicorn/require-post-message-target-origin -- Worker channel */
  self.postMessage(message,);
  /* oxlint-enable eslint-plugin-unicorn/require-post-message-target-origin */
}

/**
 * Handles one inbound message. Dispatches by `kind` and reports any
 * error back on the outbound `error` channel with the request id so
 * the main thread can resolve the matching pending promise.
 *
 * @param event - inbound `message` event
 */
function onMessage(event: MessageEvent<InboundMessage>,): void {
  /**
   * Destructured early so the kind switch reads `data.kind` directly without repeated access.
   */
  const { data, } = event;
  try {
    if (data.kind
      === 'init') {
      resetTable({
        table,
        text: data.initialText,
      },);
      undoStack.length = 0;
      redoStack.length = 0;
    }
    else if (data.kind
      === 'apply')
      handleApply(data,);
    else if (data.kind
      === 'query')
      handleQuery(data,);
    else if (data.kind
      === 'snapshot')
      handleSnapshot(data,);
    else if ((data.kind
      === 'undo') || (data.kind
        === 'redo'))
      handleUndoRedo(data,);
  }
  catch (error) {
    /**
     * Default text overwritten when the caught value has a usable message; sent as the error envelope.
     */
    let message = 'unknown buffer-worker error';
    if (error instanceof Error)
      ({ message, } = error);
    else if ((typeof error) === 'string')
      message = error;
    /**
     * Echoed back so the main thread can resolve the right pending promise; `-1` signals no-id.
     */
    const id = 'id' in data ? data.id : -1;
    post({
      kind: 'error',
      id,
      message,
    },);
  }
}

/**
 * Routes the `apply` message: applies the changeset to the table,
 * pushes the inverse onto the undo stack, schedules a collapse if
 * needed, and replies with the post-edit length.
 *
 * @param data - apply message
 */
function handleApply(data: Extract<InboundMessage, { kind: 'apply'; }>,): void {
  /**
   * Pre-apply length captured so the undo entry remembers the buffer size at edit time.
   */
  const preLength = table.length;
  /**
   * Inverse changeset returned by the apply helper; consumed by undo and forwarded in the reply.
   */
  const inverse = applyToTable({
    table,
    changeset: data.changeset,
  },);
  pushUndo({
    entry: {
      inverse,
      preLength,
    },
  },);
  scheduleCollapseIfNeeded();
  post({
    kind: 'applied',
    id: data.id,
    length: table.length,
    inverse,
  },);
}

/**
 * Routes the `query` message: returns the requested substring span.
 *
 * @param data - query message
 */
function handleQuery(data: Extract<InboundMessage, { kind: 'query'; }>,): void {
  post({
    kind: 'queried',
    id: data.id,
    text: substring({
      table,
      from: data.from,
      to: data.to,
    },),
  },);
}

/**
 * Routes the `snapshot` message: returns the full document text.
 *
 * @param data - snapshot message
 */
function handleSnapshot(
  data: Extract<InboundMessage, { kind: 'snapshot'; }>,
): void {
  post({
    kind: 'snapshotted',
    id: data.id,
    text: materialise({ table, },),
  },);
}

/**
 * Routes the `undo` and `redo` messages: pops the corresponding stack
 * and re-applies the inverse, mirroring the result onto the opposite
 * stack so the user can step back and forth.
 *
 * @param data - undo or redo message
 */
function handleUndoRedo(
  data: Extract<InboundMessage, { kind: 'undo' | 'redo'; }>,
): void {
  /**
   * Stack to pop the next step from (undo pops undo, redo pops redo).
   */
  const sourceStack = data.kind
    === 'undo' ? undoStack : redoStack;
  /**
   * Stack to push the inverse re-application onto so the user can reverse direction.
   */
  const sinkStack = data.kind
    === 'undo' ? redoStack : undoStack;
  /**
   * Popped step; undefined means the stack was empty so the reply omits `applied`.
   */
  const entry = sourceStack.pop();
  /**
   * Reply discriminant chosen by direction (`undone` or `redone`).
   */
  const replyKind = data.kind
    === 'undo' ? 'undone' : 'redone';
  if (entry === undefined) {
    post({
      kind: replyKind,
      id: data.id,
      length: table.length,
    },);
    return;
  }
  /**
   * Inverse of the popped step; pushed onto the sink stack so the user can reverse direction.
   */
  const reapplied = applyToTable({
    table,
    changeset: entry.inverse,
  },);
  sinkStack.push({
    inverse: reapplied,
    preLength: entry.preLength,
  },);
  scheduleCollapseIfNeeded();
  post({
    kind: replyKind,
    id: data.id,
    length: table.length,
    applied: entry.inverse,
  },);
}

self.addEventListener(
  'message',
  function dispatch(event,): void {
    // The DOM lib types `event` as `MessageEvent<any>`; we contract a
    // narrower payload via `InboundMessage`.
    // oxlint-disable-next-line typescript/no-unsafe-argument -- typed channel
    onMessage(event,);
  },
);

/**
 * Worker entry has no exports; everything is by message channel.
 */
export {};
