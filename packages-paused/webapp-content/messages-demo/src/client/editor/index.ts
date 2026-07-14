/**
 * Public custom-editor surface.
 *
 * Composes the four layers documented in plan §1:
 *
 * - **buffer.worker.ts**: piece-table source of truth, off the main
 *   thread; receives `apply`/`query`/`snapshot`/`undo`/`redo` messages
 * - **viewport.ts**: main-thread virtual scroller; renders only the
 *   visible window
 * - **input.ts**: `beforeinput` / IME / paste interceptor
 * - **selection.ts**: cursor + selection overlay
 *
 * The worker is the authoritative buffer; the main thread keeps a
 * **mirror cache** updated on every applied changeset so `editor.text`
 * is a synchronous getter. The mirror is eventually consistent within
 * one event-loop tick; tests should `await editor.flushed()` if they
 * need to compare against the worker's authoritative snapshot.
 *
 * Why the mirror is non-obvious: the plan's `Editor` interface
 * declares `readonly text: string` but also says "proxy to the worker's
 * buffer (async)". Those are incompatible without a mirror. We chose
 * the mirror over making `text` async because:
 *
 * 1. `tier3.ts`'s `saveCurrentTier3Chunk` and `composer/send.ts`'s
 *    `handleSend` read the body synchronously (`textarea.value`); going
 *    async there would ripple into a half-dozen call sites for no
 *    user-visible benefit.
 * 2. The mirror is updated locally immediately on `apply` before the
 *    worker round-trips, so the only invariant we owe is "the mirror
 *    matches what the worker will report once `applied` arrives".
 *    That's what verification 16a (DOM-as-source-of-truth) checks.
 *
 * The editor mounts onto a host `<div>` and shadows it with a
 * `<div contenteditable>` it owns. Callers are expected to keep a
 * sibling element (typically the existing `<textarea>`) as the
 * downstream-readable copy of `editor.text` so server-bound code
 * (`send.ts`, `tier3.ts`) does not need to depend on the editor.
 *
 * @example
 * ```ts
 * const editor = await mountEditor({ host });
 * editor.on('change', (cs) => textarea.value = editor.text);
 * await editor.setText('hello');
 * editor.text; // 'hello'
 * await editor.destroy();
 * ```
 */

import {
  applyChangeset,
  type Changeset,
  invertChangeset,
} from './changeset.ts';
import { attachInput, } from './input.ts';
import { mountSelection, } from './selection.ts';
import { mountViewport, } from './viewport.ts';

/**
 * Public Editor handle returned by `mountEditor`.
 */
export type Editor = {
  /**
   * Synchronous mirror of the worker buffer. Updated optimistically on
   * every applied change before the worker round-trips. Eventually
   * consistent within one event-loop tick.
   */
  readonly text: string;

  /**
   * Replace the entire buffer with `text`. Resets undo history.
   *
   * @param text - new buffer contents
   */
  setText(text: string,): Promise<void>;

  /**
   * Apply a changeset locally as if it had been typed. Used by paste
   * and import handlers; not normally called by application code.
   *
   * @param changeset - the change to apply
   */
  apply(changeset: Changeset,): Promise<void>;

  /**
   * Subscribe to applied-changeset notifications. Listeners run after
   * the mirror has been updated and the viewport has been notified.
   *
   * @param event - event name (only `'change'` for now)
   *
   * @param listener - callback receiving the applied changeset
   */
  on(
    event: 'change',
    listener: (changeset: Changeset,) => void,
  ): void;

  /**
   * Awaits any in-flight worker round-trip. After this resolves, the
   * mirror is guaranteed to equal the worker's authoritative snapshot.
   * Used by verification 16a's invariant assertion.
   */
  flushed(): Promise<void>;

  /**
   * Tear down the editor and release the worker.
   */
  destroy(): void;
};

/**
 * Outbound shape from the buffer worker.
 */
type WorkerMessage =
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
 * Listener registry for `editor.on('change', ...)`.
 */
type ChangeListener = (changeset: Changeset,) => void;


/**
 * Mounts the custom editor on a host element. Spawns the buffer
 * worker, attaches the viewport renderer, the input interceptor, and
 * the selection overlay. Idempotent: calling twice on the same host
 * returns the existing editor.
 *
 * @param input - host element (the editor injects its DOM here),
 *                optional initial text, optional debug flag
 *
 * @returns the public Editor handle
 *
 * @example
 * ```ts
 * const editor = await mountEditor({ host: someDiv, initialText: 'hi' });
 * ```
 */
export function mountEditor(
  input: {
    host: HTMLElement;
    initialText?: string;
    debug?: boolean;
  },
): Promise<Editor> {
  /**
   * Reused when the same host is mounted again; avoids spawning a second worker.
   */
  const existing = mounted.get(input.host,);
  if (existing !== undefined)
    return Promise.resolve(existing,);

  // The URL is resolved against the chunk's runtime URL. tsdown emits
  // the editor worker at `dist/client/editor/buffer.worker.js`; the
  // composer chunk that contains this code lives at
  // `dist/client/composer-*.js`, so the relative path is
  // `editor/buffer.worker.js`.
  /**
   * Per-host dedicated worker that owns the authoritative piece table.
   */
  const worker = new Worker(
    new URL(
      'editor/buffer.worker.js',
      import.meta.url,
    ),
    { type: 'module', },
  );

  /**
   * Promise registry keyed by request id; resolved by `dispatch`.
   */
  const pending = new Map<
    number,
    {
      resolve: (message: WorkerMessage,) => void;
      reject: (error: Error,) => void;
    }
  >();
  /* oxlint-disable no-restricted-syntax/no-function-root-let -- per-instance request counter: incremented by every `request()` call and read inside `dispatch` to correlate replies; closure scope is exactly the editor instance */
  /**
   * Monotonically incrementing request id; correlates worker replies with their resolvers.
   */
  let nextId = 1;
  /* oxlint-enable no-restricted-syntax/no-function-root-let */

  worker.addEventListener(
    'message',
    function dispatch(event: MessageEvent<WorkerMessage>,) {
      /**
       * Destructured early so the dispatch logic can read `kind` and `id` directly.
       */
      const { data, } = event;
      /**
       * Resolver / rejecter pair registered when the request was issued; undefined means a stale reply.
       */
      const entry = pending.get(data.id,);
      if (entry === undefined)
        return;
      pending.delete(data.id,);
      if (data.kind
        === 'error')
        entry.reject(new Error(data.message,),);
      else
        entry.resolve(data,);
    },
  );

  /**
   * Sends a request to the worker and resolves with its reply. The
   * parameter is a distributive Omit over the message union so each
   * variant keeps its discriminator fields after `id` is dropped.
   *
   * @param requestInput - message body without the `id` field
   *
   * @returns the worker's reply
   */
  function request(
    requestInput: WorkerRequest,
  ): Promise<WorkerMessage> {
    /**
     * Captured before increment so the resolver registers under this exact id.
     */
    const id = nextId;
    nextId += 1;
    /* oxlint-disable typescript/no-unsafe-type-assertion -- distributive Omit */
    /**
     * Augmented payload with the assigned id; the cast widens past the distributive `Omit<id>`.
     */
    const message = {
      ...requestInput,
      id,
    } as WorkerInbound;
    /* oxlint-enable typescript/no-unsafe-type-assertion */
    // The worker's reply will resolve this promise via `dispatch`.
    // oxlint-disable-next-line eslint-plugin-promise/avoid-new -- bridges async messaging
    return new Promise<WorkerMessage>(function register(
      resolve,
      reject,
    ) {
      pending.set(
        id,
        {
          resolve,
          reject,
        },
      );
      // Worker.postMessage has no targetOrigin parameter.
      // oxlint-disable-next-line eslint-plugin-unicorn/require-post-message-target-origin -- Worker channel
      worker.postMessage(message,);
    },);
  }

  // Initialise the worker with the seed text. `init` has no reply.
  /**
   * Effective initial text; defaulted to empty so the mirror and worker buffer start aligned.
   */
  const initialText = input.initialText
    ?? '';
  /* oxlint-disable eslint-plugin-unicorn/require-post-message-target-origin -- Worker channel */
  worker.postMessage({
    kind: 'init',
    initialText,
  } satisfies WorkerInbound,);
  /* oxlint-enable eslint-plugin-unicorn/require-post-message-target-origin */

  /* oxlint-disable no-restricted-syntax/no-function-root-let -- coordinator state: `mirror` follows the worker buffer across every applied changeset; `inflight` is the rolling promise chain that `flushed()` and `apply()` extend so concurrent calls observe a single tail */
  /**
   * Main-thread mirror of the worker buffer.
   */
  let mirror = initialText;

  /**
   * In-flight worker requests; `flushed()` waits on this.
   */
  let inflight: Promise<unknown> = Promise.resolve();
  /* oxlint-enable no-restricted-syntax/no-function-root-let */

  /**
   * Subscribers for `on('change', ...)`.
   */
  const changeListeners: ChangeListener[] = [];

  /**
   * Notifies registered listeners that a changeset was applied.
   * Catches and logs listener errors so one bad subscriber does not
   * break the chain.
   *
   * @param changeset - the change that was just applied
   */
  function emitChange(changeset: Changeset,): void {
    for (const listener of changeListeners) {
      try {
        listener(changeset,);
      }
      catch (error) {
        // Subscriber errors are non-fatal; surface to console for dev.
        console.error(
          'editor change listener threw',
          error,
        );
      }
    }
  }

  /**
   * Applies a changeset to the mirror locally, then sends it to the
   * worker. Returns the inverse for the local undo path.
   *
   * @param changeset - the change to apply
   *
   * @returns inverse changeset (for parity with the worker reply)
   */
  async function applyLocal(changeset: Changeset,): Promise<Changeset> {
    /**
     * Captured before mutating `mirror` so `applyChangeset` and `invertChangeset` see the pre-edit state.
     */
    const before = mirror;
    mirror = applyChangeset({
      changeset,
      before,
    },);
    /**
     * Pre-computed inverse so the undo stack can stash it before the worker round-trip lands.
     */
    const inverse = invertChangeset({
      changeset,
      before,
    },);
    /**
     * Fire-and-await worker reply; captured so `inflight` and `await` reference the same promise.
     */
    const reply = request({
      kind: 'apply',
      changeset,
    },);
    inflight = reply;
    emitChange(changeset,);
    await reply;
    return inverse;
  }

  // Mount the renderer layers. The viewport reads from the mirror;
  // selection sits on top of the viewport; input translates DOM events
  // into changesets and feeds them through `applyLocal`.
  /**
   * Renders the visible window; consumed by the change listener and the selection mount.
   */
  const viewport = mountViewport({
    host: input.host,
    initialText,
  },);
  /**
   * Selection overlay anchored on the viewport's surface; passed to the input layer.
   */
  const selection = mountSelection({
    host: input.host,
    surface: viewport.surface,
  },);
  /**
   * Disposer returned by the input wiring; invoked from `destroy`.
   */
  const inputCleanup = attachInput({
    surface: viewport.surface,
    apply: applyLocal,
    selection,
    getMirror: function getMirror() {
      return mirror;
    },
  },);

  // Repaint the viewport on every change AND restore the cursor.
  // viewport.render replaces every line element, which invalidates
  // the browser's selection Range; without restoring, every
  // subsequent insert would land at end-of-buffer because
  // `selection.get()` returns null and `currentRange()` falls back to
  // the buffer end. The cursor lands at the end of the just-inserted
  // text (or at `changeset.from` for a pure delete, since
  // `insert.length === 0`).
  changeListeners.push(function repaint(changeset,) {
    viewport.render(mirror,);
    /**
     * Cursor lands at the end of the inserted text, or at `from` for pure deletes (insert length 0).
     */
    const cursor = changeset.from
      + changeset
      .insert
      .length;
    selection.set({
      from: cursor,
      to: cursor,
    },);
  },);

  /**
   * Optional debug invariant; gated on `input.debug`. After every
   * change, awaits the worker round-trip and asserts the mirror equals
   * the worker's authoritative snapshot. Logs (does not throw) on
   * mismatch so the invariant violation is loud but recoverable.
   */
  if (input.debug
    === true) {
    changeListeners.push(function checkInvariant() {
      void (async function check(): Promise<void> {
        /**
         * Worker snapshot reply; compared against `mirror` for the invariant check.
         */
        const reply = await request({ kind: 'snapshot', },);
        if (reply.kind
          !== 'snapshotted')
          return;
        if (reply.text
          !== mirror) {
          console.error(
            'editor invariant violated: mirror !== worker snapshot',
            {
              mirrorLength: mirror.length,
              workerLength: reply.text
                .length,
            },
          );
        }
      })();
    },);
  }

  /**
   * Public handle returned to the caller; threaded through `mounted` so re-mounts reuse it.
   */
  const editor: Editor = {
    /**
     * Synchronous mirror of the worker buffer; see module TSDoc.
     */
    get text() {
      return mirror;
    },
    setText(text: string,) {
      mirror = text;
      /* oxlint-disable eslint-plugin-unicorn/require-post-message-target-origin -- Worker channel */
      worker.postMessage({
        kind: 'init',
        initialText: text,
      } satisfies WorkerInbound,);
      /* oxlint-enable eslint-plugin-unicorn/require-post-message-target-origin */
      viewport.render(text,);
      // No reply for init; resolve immediately so callers can chain.
      return Promise.resolve();
    },
    async apply(changeset: Changeset,) {
      await applyLocal(changeset,);
    },
    on(
      event: 'change',
      listener: ChangeListener,
    ) {
      if (event === 'change')
        changeListeners.push(listener,);
    },
    async flushed() {
      await inflight;
    },
    destroy() {
      inputCleanup();
      selection.destroy();
      viewport.destroy();
      worker.terminate();
      mounted.delete(input.host,);
    },
  };

  mounted.set(
    input.host,
    editor,
  );
  return Promise.resolve(editor,);
}

/**
 * Distributive Omit so each union variant keeps its own fields when
 * `id` is removed. A plain `Omit<U, 'id'>` collapses to the
 * intersection's omit and loses discriminators.
 */
type DistributiveOmit<T, K extends keyof T | string,> = T extends unknown
  ? Omit<T, Extract<K, keyof T>>
  : never;

/**
 * Variant of `WorkerInbound` accepted by `request` (no `id`).
 */
type WorkerRequest = DistributiveOmit<WorkerInbound, 'id'>;

/**
 * Inbound message shape used by `request` and `setText`.
 */
type WorkerInbound =
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
 * Idempotency map: one editor per host element.
 */
const mounted = new WeakMap<HTMLElement, Editor>();
