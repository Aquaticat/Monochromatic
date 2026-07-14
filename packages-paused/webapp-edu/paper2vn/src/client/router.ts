/**
 * Screen router for paper2vn.
 *
 * Each screen is registered with a render function that mounts its
 * DOM into the app root. Switching screens unmounts the previous
 * tree and mounts the next one. There's no history stack; screens
 * read state from the store directly.
 */

/**
 * Symbolic screen id.
 */
export type ScreenId =
  | 'menu'
  | 'select-topic'
  | 'lecture'
  | 'settings'
  | 'saves'
  | 'log';

/**
 * Function that mounts a screen into the given container.
 */
export type ScreenRenderer = (root: HTMLElement,) => void;

/**
 * Function that tears down a previously mounted screen.
 */
export type ScreenTeardown = () => void;

/**
 * Per-screen pair of mount and teardown.
 */
export type ScreenModule = {
  /**
   * Mounts the screen into the container.
   */
  mount: ScreenRenderer;

  /**
   * Optional teardown invoked when the screen is replaced.
   */
  unmount?: ScreenTeardown;
};

/**
 * Registered screens keyed by id.
 */
const screens = new Map<ScreenId, ScreenModule>();

/**
 * Mutable router state.
 *
 * Held inside a single `const` object so individual fields can be
 * reassigned without violating the `no-module-root-let` rule.
 */
const routerState: {
  /**
   * Last screen id activated, used during teardown.
   */
  currentScreen: ScreenId | undefined;
  /**
   * Last teardown function, called before mounting the next screen.
   */
  currentTeardown: ScreenTeardown | undefined;
} = {
  currentScreen: undefined,
  currentTeardown: undefined,
};

/**
 * Registers a screen so {@link navigate} can mount it later.
 *
 * @param id - screen identifier
 *
 * @param module - mount and optional unmount pair
 *
 * @example
 * ```ts
 * registerScreen({ id: 'menu', module: { mount: mountMenu } });
 * ```
 */
export function registerScreen(
  {
    id,
    module,
  }: {
    id: ScreenId;
    module: ScreenModule;
  },
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
 *
 * @example
 * ```ts
 * navigate('menu');
 * ```
 */
export function navigate(id: ScreenId,): void {
  /**
   * Destination screen module, resolved before any teardown work.
   */
  const next = screens.get(id,);
  if (next === undefined)
    throw new Error(`[router] unknown screen: ${id}`,);
  if (routerState.currentTeardown
    !== undefined) {
    routerState.currentTeardown();
    routerState.currentTeardown = undefined;
  }
  /**
   * App-root container where each screen mounts its subtree.
   */
  const root = document.querySelector<HTMLElement>('#app',);
  if (root === null)
    throw new Error('[router] #app root not found',);
  root.replaceChildren();
  next.mount(root,);
  if (next.unmount
    !== undefined)
    routerState.currentTeardown = next.unmount;
  routerState.currentScreen = id;
  console.error(
    '[router] navigated to',
    id,
  );
}

/**
 * Returns the currently active screen id, when one exists.
 *
 * @returns active screen id, or `undefined` before any navigation
 *
 * @example
 * ```ts
 * if (getCurrentScreen() === 'lecture') pauseLecture();
 * ```
 */
export function getCurrentScreen(): ScreenId | undefined {
  return routerState.currentScreen;
}
