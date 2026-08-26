import { access, } from 'node:fs/promises';

import type {
  ExtensionAPI,
  ExtensionFactory,
} from '@earendil-works/pi-coding-agent';

//region Constants

/**
 * Built extension path consumed by Pi package discovery.
 */
const BUILT_EXTENSION_PATH = '../dist/final/node/index.mjs';

/**
 * Built helper launched in detached terminal.
 */
const BUILT_HELPER_PATH = new URL(
  '../dist/final/node/answer-helper.mjs',
  import.meta.url,
);

/**
 * Expected model-facing tool identity.
 */
const EXPECTED_TOOL_NAME = 'ask_user_question';

//endregion Constants

//region Types

/**
 * Minimum built module shape required by Pi package.
 */
type AskUserQuestionModule = {
  readonly default: ExtensionFactory;
};

/**
 * Minimum tool metadata captured from registration.
 */
type RegisteredTool = {
  readonly name: string;
  readonly executionMode?: string;
  readonly parameters: {
    readonly properties?: Readonly<Record<string, unknown>>;
  };
};

/**
 * Fake registration state.
 */
type RegistrationState = {
  readonly tools: RegisteredTool[];
  readonly events: string[];
};

//endregion Types

//region Guards

/**
 * Narrows dynamic module namespace to extension entry.
 *
 * @param value - imported built module
 *
 * @returns whether default extension factory exists
 */
function isAskUserQuestionModule(value: unknown,): value is AskUserQuestionModule {
  if (value === null)
    return false;
  if ((typeof value) !== 'object')
    return false;
  return ('default' in value)
    && ((typeof value.default) === 'function');
}

/**
 * Narrows tool registration to metadata used by verifier.
 *
 * @param value - registered tool candidate
 *
 * @returns whether required metadata exists
 */
function isRegisteredTool(value: unknown,): value is RegisteredTool {
  if (value === null)
    return false;
  if ((typeof value) !== 'object')
    return false;
  return ('name' in value)
    && ((typeof value.name) === 'string')
    && ('parameters' in value)
    && (value.parameters !== null)
    && ((typeof value.parameters) === 'object');
}

//endregion Guards

//region Harness

/**
 * Creates fake Pi API capturing tool and event registration.
 *
 * @returns API and mutable registration arrays
 */
function createHarness(): {
  readonly api: ExtensionAPI;
  readonly state: RegistrationState;
} {
  /**
   * Mutable registration state.
   */
  const state: RegistrationState = {
    tools: [],
    events: [],
  };
  /**
   * Minimal fake Pi host.
   */
  const fake = {
    registerTool(value: unknown): void {
      if (!isRegisteredTool(value,))
        throw new Error('Built extension registered malformed tool.',);
      state.tools
        .push(value,);
    },
    on(event: string,): void {
      state.events
        .push(event,);
    },
  };
  return {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Verifier implements only registration methods used during extension initialization.
    api: fake as unknown as ExtensionAPI,
    state,
  };
}

//endregion Harness

//region Verification

/**
 * Verifies built extension,
 * helper artifact,
 * and registration contract.
 *
 * @returns verification evidence text
 *
 * @throws when artifact or registration differs from contract
 */
async function verifyBuiltExtension(): Promise<string> {
  await access(BUILT_HELPER_PATH,);
  /**
   * Built module loaded through same path Pi package metadata uses.
   */
  const mod: unknown = await import(BUILT_EXTENSION_PATH);
  if (!isAskUserQuestionModule(mod,))
    throw new Error('Built ask-user-question package has unexpected export shape.',);
  /**
   * Registration capture from default extension factory.
   */
  const harness = createHarness();
  await mod.default(harness.api,);
  if (harness.state
    .tools
    .length
    !== 1)
    throw new Error(`Expected one registered tool, received ${String(harness.state
      .tools
      .length,)}`,);
  /**
   * Sole registered tool.
   */
  const [tool,] = harness.state
    .tools;
  if (tool === undefined)
    throw new Error('Built extension did not register tool.',);
  if (tool.name !== EXPECTED_TOOL_NAME)
    throw new Error(`Expected ${EXPECTED_TOOL_NAME}, received ${tool.name}`,);
  if (tool.executionMode !== 'sequential')
    throw new Error('Ask-user tool must execute sequentially.',);
  if (tool.parameters
    .properties
    ?.question
    === undefined)
    throw new Error('Ask-user tool schema must expose question string.',);
  if ((harness.state
    .events
    .length
    !== 1) || (harness.state
      .events[0]
      !== 'session_shutdown'))
    throw new Error('Built extension must register only session_shutdown cleanup.',);
  return 'ask-user-question extension verified: sequential question tool, shutdown cleanup, and detached helper artifact';
}

//endregion Verification

console.log(await verifyBuiltExtension(),);
