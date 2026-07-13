/**
 * Verifies the built thinking-defaults extension registers expected Pi events.
 *
 * @module
 */

import {
  createEventBus,
  type ExecResult,
  type ExtensionAPI,
  type ExtensionFactory,
} from '@earendil-works/pi-coding-agent';

//region Constants

/**
 * Built extension path consumed by Pi.
 */
const BUILT_EXTENSION_PATH = '../dist/final/node/index.mjs';

/**
 * Expected event registrations from the extension entry point.
 */
const EXPECTED_REGISTRATIONS = [
  'event:session_start',
  'event:model_select',
] as const;

//endregion Constants

//region Types

/**
 * Built thinking-defaults extension module shape.
 */
type ThinkingDefaultsExtensionModule = {
  /**
   * Pi extension factory.
   */
  readonly default: ExtensionFactory;
};

//endregion Types

//region Verification

/**
 * Verifies that the built extension exports and registers correctly,
 * checking the import with {@link isThinkingDefaultsExtensionModule} and
 * registering through {@link fakePiApi}.
 *
 * @returns verification result text
 *
 * @throws when built extension import or registration fails
 *
 * @example
 * ```typescript
 * console.log(await verifyBuiltExtension());
 * ```
 */
async function verifyBuiltExtension(): Promise<string> {
  /**
   * Built extension module imported through package output.
   */
  const mod: unknown = await import(BUILT_EXTENSION_PATH);
  if (!isThinkingDefaultsExtensionModule(mod,)) {
    throw new Error(
      'built thinking-defaults extension does not export a default extension factory',
    );
  }

  /**
   * Fake Pi API plus its captured registration log.
   */
  const {
    api,
    registrations,
  } = fakePiApi();
  await mod.default(api,);

  /**
   * Expected registrations not observed.
   */
  const missing = EXPECTED_REGISTRATIONS.filter(function isMissing(expected,) {
    return !registrations.includes(expected,);
  },);
  if (missing.length
    > 0) {
    throw new Error(
      `missing thinking-defaults registrations: ${missing.join(', ',)}`,
    );
  }

  return `thinking-defaults extension verified: ${registrations.join(', ',)}`;
}

/**
 * Detects built thinking-defaults extension module shape.
 *
 * @param value - imported module namespace
 *
 * @returns whether module matches {@link ThinkingDefaultsExtensionModule}, exporting an extension factory
 *
 * @example
 * ```typescript
 * isThinkingDefaultsExtensionModule(await import('../dist/final/node/index.mjs'));
 * ```
 */
function isThinkingDefaultsExtensionModule(
  value: unknown,
): value is ThinkingDefaultsExtensionModule {
  if ((value === null) || ((typeof value) !== 'object'))
    return false;
  return ('default' in value) && ((typeof value.default) === 'function');
}

/**
 * Builds fake Pi API used to verify extension registration.
 *
 * @returns fake Pi extension API plus its captured registration log
 *
 * @example
 * ```typescript
 * const { api, registrations } = fakePiApi();
 * ```
 */
function fakePiApi(): {
  readonly api: ExtensionAPI;
  readonly registrations: readonly string[];
} {
  /**
   * Mutable registration call log captured by the fake API.
   */
  const registrations: string[] = [];
  /**
   * Fake Pi API recording each registration into the captured log.
   */
  const api: ExtensionAPI = {
    on(event: string,) {
      registrations.push(`event:${event}`,);
    },
    registerTool(tool: { readonly name: string; },) {
      registrations.push(`tool:${tool.name}`,);
    },
    registerCommand(name: string,) {
      registrations.push(`command:${name}`,);
    },
    registerShortcut(shortcut: string,) {
      registrations.push(`shortcut:${shortcut}`,);
    },
    registerFlag(name: string,) {
      registrations.push(`flag:${name}`,);
    },
    getFlag() {
      return undefined;
    },
    registerMessageRenderer(customType: string,) {
      registrations.push(`renderer:${customType}`,);
    },
    registerEntryRenderer(customType: string,) {
      registrations.push(`entry-renderer:${customType}`,);
    },
    sendMessage(message: { readonly customType: string; },) {
      registrations.push(`message:${message.customType}`,);
    },
    sendUserMessage(content: unknown,) {
      void content;
    },
    appendEntry(customType: string,) {
      registrations.push(`entry:${customType}`,);
    },
    setSessionName(name: string,) {
      void name;
    },
    getSessionName() {
      return undefined;
    },
    setLabel(
      entryId: string,
      label?: string,
    ) {
      void entryId;
      void label;
    },
    exec(
      command: string,
      args: readonly string[],
    ): Promise<ExecResult> {
      void command;
      void args;
      return Promise.resolve({
        stdout: '',
        stderr: '',
        code: 0,
        killed: false,
      },);
    },
    getActiveTools() {
      return [];
    },
    getAllTools() {
      return [];
    },
    setActiveTools(toolNames: readonly string[],) {
      void toolNames;
    },
    getCommands() {
      return [];
    },
    setModel(model: unknown,) {
      void model;
      return Promise.resolve(false,);
    },
    getThinkingLevel() {
      return 'high';
    },
    setThinkingLevel(level: string,) {
      void level;
    },
    registerProvider(name: string,) {
      registrations.push(`provider:${name}`,);
    },
    unregisterProvider(name: string,) {
      registrations.push(`unprovider:${name}`,);
    },
    events: createEventBus(),
  };
  return {
    api,
    registrations,
  };
}

//endregion Verification

console.log(await verifyBuiltExtension(),);
