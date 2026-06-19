/**
 * Client entry point.
 *
 * Loaded as `<script type="module" defer>` from every page. Two jobs:
 *
 * 1. Install a synchronous form-submit interceptor so a click on
 *    "send" before the composer module finishes loading does not fall
 *    through to a native POST against the no-JS endpoint.
 * 2. Lazy-import the composer module on first user interaction.
 *
 * The interceptor calls `preventDefault()` immediately, then queues
 * the submission to fire as soon as the composer bootstraps. This
 * removes the race where the user clicks "send" milliseconds before
 * `attachComposer` registers its own submit handler.
 */

/* oxlint-disable no-restricted-syntax/no-module-root-let -- bootstrap flags: `composerBooted` is flipped once when the composer module finishes loading; `pendingSubmit` is set by the submit interceptor when a click arrives before bootstrap and cleared inside `bootComposer` after redispatch */
/**
 * Whether the composer module has been loaded and bootstrapped.
 */
let composerBooted = false;

/**
 * Pending submit event waiting for the composer to bootstrap.
 */
let pendingSubmit = false;
/* oxlint-enable no-restricted-syntax/no-module-root-let */

/**
 * One-shot loader: dynamic-imports the composer module, calls its
 * bootstrap, then if a submit was queued during loading, dispatches it
 * onto the now-attached handler.
 */
async function bootComposer(): Promise<void> {
  if (composerBooted)
    return;
  composerBooted = true;
  /**
   * Lazily-loaded composer module; `bootstrap` registers the real submit handler.
   */
  const composer = await import('./composer.ts');
  await composer.bootstrap();
  if (pendingSubmit) {
    pendingSubmit = false;
    /**
     * Composer form element; redispatch fires the freshly-attached submit handler.
     */
    const form = document.querySelector<HTMLFormElement>('#composer',);
    if (form !== null) {
      form.dispatchEvent(new Event(
        'submit',
        {
          cancelable: true,
          bubbles: true,
        },
      ),);
    }
  }
}

/**
 * Wires the synchronous interceptor + the lazy loader.
 */
function attachComposerLoaders(): void {
  /**
   * Composer form element; null exits early on pages without a composer.
   */
  const form = document.querySelector<HTMLFormElement>('#composer',);
  if (form === null)
    return;

  // Synchronous submit interceptor. Always preventDefault. If the
  // composer module is already booted its handler will run via the
  // dispatched submit event; otherwise we mark the submit pending and
  // re-dispatch after bootstrap.
  form.addEventListener(
    'submit',
    function onSubmit(event,) {
      if (composerBooted)
        return;
      event.preventDefault();
      pendingSubmit = true;
      void bootComposer();
    },
    { capture: true, },
  );

  /**
   * Single-shot user interaction handler that triggers the lazy load.
   */
  function onInteraction(): void {
    void bootComposer();
  }
  form.addEventListener(
    'focusin',
    onInteraction,
    { once: true, },
  );
  form.addEventListener(
    'pointerdown',
    onInteraction,
    { once: true, },
  );
}

if (document.readyState
  === 'loading') {
  document.addEventListener(
    'DOMContentLoaded',
    attachComposerLoaders,
  );
}
else {
  attachComposerLoaders();
}

export {};
