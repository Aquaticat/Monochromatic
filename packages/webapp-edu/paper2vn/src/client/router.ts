/**
 * Screen router for paper2vn.
 *
 * Each screen is registered with a render function that mounts its
 * DOM into the app root. Switching screens unmounts the previous
 * tree and mounts the next one. There's no history stack -- screens
 * read state from the store directly.
 */

/** Symbolic screen id. */
export type ScreenId =
  | 'menu'
  | 'select-topic'
  | 'lecture'
  | 'settings'
  | 'saves'
  | 'log';

/** Function that mounts a screen into the given container. */
export type ScreenRenderer = (root: HTMLElement,) => void;

/** Function that tears down a previously mounted screen. */
export type ScreenTeardown = () => void;

/** Per-screen pair of mount and teardown. */
export type ScreenModule = {
  /** Mounts the screen into the container. */
  mount: ScreenRenderer;

  /** Optional teardown invoked when the screen is replaced. */
  unmount?: ScreenTeardown;
};

/** Registered screens keyed by id. */
const screens = new Map<ScreenId, ScreenModule>();

/** Last screen id activated, used during teardown. */
let currentScreen: ScreenId | undefined;

/** Last teardown function, called before mounting the next screen. */
let currentTeardown: ScreenTeardown | undefined;

/** Registers a screen. */
export function registerScreen(
  id: ScreenId,
  module: ScreenModule,
): void {
  screens.set(
    id,
    module,
  );
}

/**
 * Switches to the named screen.
 *
 * @param id - screen to activate
 *
 * @throws when the screen has not been registered
 */
export function navigate(id: ScreenId,): void {
  const next = screens.get(id,);
  if (next === undefined)
    throw new Error(`[router] unknown screen: ${id}`,);
  if (currentTeardown !== undefined) {
    currentTeardown();
    currentTeardown = undefined;
  }
  const root = document.querySelector<HTMLElement>('#app',);
  if (root === null)
    throw new Error('[router] #app root not found',);
  root.replaceChildren();
  next.mount(root,);
  if (next.unmount !== undefined)
    currentTeardown = next.unmount;
  currentScreen = id;
  console.error(
    '[router] navigated to',
    id,
  );
}

/** Returns the currently active screen id, when one exists. */
export function getCurrentScreen(): ScreenId | undefined {
  return currentScreen;
}
