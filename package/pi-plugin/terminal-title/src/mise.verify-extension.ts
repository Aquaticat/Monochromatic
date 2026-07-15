/**
 * Verifies built terminal-title extension behavior at the package output boundary.
 *
 * @module
 */

import type {
  ExtensionAPI,
  ExtensionFactory,
} from '@earendil-works/pi-coding-agent';

//region Constants

/**
 * Built extension path consumed by Pi package loading.
 */
const BUILT_EXTENSION_PATH = '../dist/final/node/index.mjs';

/**
 * Tool-start event name used by Pi extension hooks.
 */
const TOOL_START_EVENT = 'tool_execution_start';

/**
 * Tool-end event name used by Pi extension hooks.
 */
const TOOL_END_EVENT = 'tool_execution_end';

/**
 * Tool call id shared between start and end events in this verification.
 */
const TOOL_CALL_ID = 'verify-call-1';

/**
 * Command whose details must survive into the completion title.
 */
const VERIFY_COMMAND = 'ls -l';

/**
 * Expected terminal title after command completion.
 */
const EXPECTED_TITLE = 'π Ran ls -l';

//endregion Constants

//region Types

/**
 * Minimal handler signature registered through Pi's extension API.
 */
type HandlerFn = (
  event: unknown,
  ctx: TitleContext,
) => unknown;

/**
 * Map of extension event names to registered handlers.
 */
type RegistrationMap = Map<string, HandlerFn[]>;

/**
 * Minimal context shape needed to capture title writes.
 */
type TitleContext = {
  readonly ui: {
    readonly setTitle: (title: string,) => void;
  };
};

/**
 * Built terminal-title extension module shape.
 */
type TerminalTitleExtensionModule = {
  /**
   * Pi extension factory exported by the built package.
   */
  default: ExtensionFactory;
};

//endregion Types

//region Harness

/**
 * Creates fake Pi API that records extension event registrations.
 *
 * @returns fake API and registration map for verification
 *
 * @example
 * ```ts
 * const harness = createFakePiApi();
 * ```
 */
function createFakePiApi(): Readonly<{
  api: ExtensionAPI;
  registrations: RegistrationMap;
}> {
  /**
   * Mutable registration map populated by the fake `on()` implementation.
   */
  const registrations: RegistrationMap = new Map();

  /* oxlint-disable typescript/no-unsafe-type-assertion -- verification harness implements the `on()` surface this extension uses */
  /**
   * Fake Pi API passed to the built extension factory.
   */
  const api = {
    on(
      event: string,
      handler: HandlerFn,
    ): void {
      /**
       * Existing handlers for this event, if any.
       */
      const existing = registrations.get(event,)
        ?? [];
      registrations.set(
        event,
        [
          ...existing,
          handler,
        ],
      );
    },
  } as unknown as ExtensionAPI;
  /* oxlint-enable typescript/no-unsafe-type-assertion */

  return {
    api,
    registrations,
  };
}

/**
 * Creates title-capturing context for built extension handlers.
 *
 * @returns fake context and captured title list
 *
 * @example
 * ```ts
 * const { ctx, titles } = createTitleContext();
 * ```
 */
function createTitleContext(): Readonly<{
  ctx: TitleContext;
  titles: string[];
}> {
  /**
   * Titles written by the extension under verification.
   */
  const titles: string[] = [];

  return {
    ctx: {
      ui: {
        setTitle(title: string,): void {
          titles.push(title,);
        },
      },
    },
    titles,
  };
}

/**
 * Retrieves first handler registered for an event.
 *
 * @param handlers - because built extension registers handlers through fake API
 *
 * @param event - because verification needs specific tool lifecycle hooks
 *
 * @returns registered handler
 *
 * @throws when no handler exists for event
 *
 * @example
 * ```ts
 * getHandler({ handlers: [], event: TOOL_START_EVENT });
 * ```
 */
function getHandler(
  {
    handlers,
    event,
  }: Readonly<{
    handlers: readonly HandlerFn[];
    event: string;
  }>,
): HandlerFn {
  /**
   * First registered handler. This extension registers one handler per event.
   */
  const [
    handler,
  ] = handlers;
  if (handler === undefined)
    throw new Error(`missing handler for event: ${event}`,);
  return handler;
}

//endregion Harness

//region Verification

/**
 * Detects built terminal-title extension module shape.
 *
 * @param value - imported module namespace from built package output
 *
 * @returns whether module matches {@link TerminalTitleExtensionModule}, exporting a Pi extension factory
 *
 * @example
 * ```ts
 * isTerminalTitleExtensionModule(await import('../dist/final/node/index.mjs'));
 * ```
 */
function isTerminalTitleExtensionModule(
  value: unknown,
): value is TerminalTitleExtensionModule {
  if (value === null)
    return false;
  if ((typeof value) !== 'object')
    return false;
  return ('default' in value)
    && ((typeof value.default) === 'function');
}

/**
 * Verifies built extension preserves command details from start to end titles.
 *
 * Confirms the import via {@link isTerminalTitleExtensionModule}, registers
 * handlers through {@link createFakePiApi}, captures titles with
 * {@link createTitleContext}, and looks up handlers with {@link getHandler}.
 *
 * @returns verification result text
 *
 * @throws when built import, registration, or title behavior fails
 *
 * @example
 * ```ts
 * console.log(await verifyBuiltExtension());
 * ```
 */
async function verifyBuiltExtension(): Promise<string> {
  /**
   * Built extension module imported through package output.
   */
  const mod: unknown = await import(BUILT_EXTENSION_PATH);
  if (!isTerminalTitleExtensionModule(mod,)) {
    throw new Error(
      'built terminal-title extension does not export a default extension factory',
    );
  }

  /**
   * Fake Pi API capturing built extension registrations.
   */
  const harness = createFakePiApi();
  await mod.default(harness.api,);

  /**
   * Capturing context passed to built extension handlers.
   */
  const {
    ctx,
    titles,
  } = createTitleContext();
  /**
   * Registered built start handlers.
   */
  const startHandlers = harness
    .registrations
    .get(TOOL_START_EVENT,);
  if (startHandlers === undefined)
    throw new Error(`missing event registration: ${TOOL_START_EVENT}`,);
  /**
   * Built start handler registered through Pi API.
   */
  const startHandler = getHandler({
    handlers: startHandlers,
    event: TOOL_START_EVENT,
  },);
  /**
   * Registered built end handlers.
   */
  const endHandlers = harness
    .registrations
    .get(TOOL_END_EVENT,);
  if (endHandlers === undefined)
    throw new Error(`missing event registration: ${TOOL_END_EVENT}`,);
  /**
   * Built end handler registered through Pi API.
   */
  const endHandler = getHandler({
    handlers: endHandlers,
    event: TOOL_END_EVENT,
  },);

  await startHandler(
    {
      toolCallId: TOOL_CALL_ID,
      toolName: 'bash',
      args: {
        command: VERIFY_COMMAND,
      },
    },
    ctx,
  );
  await endHandler(
    {
      toolCallId: TOOL_CALL_ID,
      toolName: 'bash',
      result: {},
      isError: false,
    },
    ctx,
  );

  /**
   * Completion title emitted by the built extension.
   */
  const actualTitle = titles.at(-1,);
  if (actualTitle !== EXPECTED_TITLE) {
    throw new Error(
      `expected completion title ${EXPECTED_TITLE}, got ${actualTitle ?? '<none>'}`,
    );
  }

  return `terminal-title extension verified: completed bash title ${EXPECTED_TITLE}`;
}

//endregion Verification

console.log(await verifyBuiltExtension(),);
