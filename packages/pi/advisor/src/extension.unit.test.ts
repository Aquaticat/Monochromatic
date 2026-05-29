/**
 * Unit tests for Advisor extension registration and public prompt helpers.
 *
 * @module
 */

import type { Model, } from '@earendil-works/pi-ai';
import type {
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
  ModelRegistry,
} from '@earendil-works/pi-coding-agent';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { DEFAULT_CONFIG, } from './config.ts';
import {
  ADVISOR_MESSAGE_TYPE,
  ADVISOR_TOOL_NAME,
} from './constants.ts';
import advisor, {
  buildAdvisorStatus,
  buildMainModelGuidance,
} from './index.ts';
import type { AdvisorConfig, } from './types.ts';

//region Fixtures

/** Fixture context window. */
const CONTEXT_WINDOW = 1_000;

/** Fixture max output tokens. */
const MAX_TOKENS = 100;

/** Fixture model used by registration status helpers. */
const fixtureModel: Model<'faux'> = {
  id: 'reviewer',
  name: 'Reviewer',
  api: 'faux',
  provider: 'faux-provider',
  baseUrl: 'https://example.invalid',
  reasoning: false,
  input: ['text',],
  cost: {
    input: 1,
    output: 2,
    cacheRead: 0,
    cacheWrite: 0,
  },
  contextWindow: CONTEXT_WINDOW,
  maxTokens: MAX_TOKENS,
};

/** Advisor config fixture. */
const advisorConfig: AdvisorConfig = {
  ...DEFAULT_CONFIG,
  source: {
    globalPath: '/home/test/.pi/agent/extensions/pi-advisor.json',
    projectPath: '/repo/.pi/extensions/pi-advisor.json',
    globalLoaded: false,
    projectLoaded: false,
  },
};

/** Recorded extension API calls. */
type RecordedPi = {
  /** Registered tool names. */
  tools: string[];
  /** Registered command names. */
  commands: string[];
  /** Registered message renderer types. */
  renderers: string[];
  /** Registered event names. */
  events: string[];
  /** Fake extension API. */
  api: ExtensionAPI;
};

/**
 * Build a minimal model registry mock.
 *
 * @param models - available models
 *
 * @returns model registry mock
 */
function modelRegistryWith(
  models: readonly Model<'faux'>[],
): ModelRegistry {
  return {
    getAvailable() {
      return [...models,];
    },
    getAll() {
      return [...models,];
    },
  } as unknown as ModelRegistry;
}

/**
 * Build a minimal extension context mock.
 *
 * @returns extension context mock
 */
function extensionContext(): ExtensionContext {
  return {
    cwd: '/repo',
    modelRegistry: modelRegistryWith([fixtureModel,],),
    scopedModels: [fixtureModel,],
  } as unknown as ExtensionContext;
}

/**
 * Build a minimal command context mock.
 *
 * @returns command context mock
 */
function commandContext(): ExtensionCommandContext {
  return extensionContext() as unknown as ExtensionCommandContext;
}

/**
 * Build a minimal extension API mock that records registration calls.
 *
 * @returns recorded API state
 */
function recordedPi(): RecordedPi {
  const recorded: Omit<RecordedPi, 'api'> = {
    tools: [],
    commands: [],
    renderers: [],
    events: [],
  };
  return {
    ...recorded,
    api: {
      registerTool(tool: { name: string; },) {
        recorded.tools.push(tool.name,);
      },
      registerCommand(name: string,) {
        recorded.commands.push(name,);
      },
      registerMessageRenderer(customType: string,) {
        recorded.renderers.push(customType,);
      },
      on(event: string,) {
        recorded.events.push(event,);
      },
      getActiveTools() {
        return [];
      },
      setActiveTools() {},
    } as unknown as ExtensionAPI,
  };
}

//endregion Fixtures

await describe({
  name: advisor.name,
  children: [
    it({
      name: 'registers tool, command, renderer, and lifecycle hooks',
      fn: async () => {
        const recorded = recordedPi();
        advisor(recorded.api,);
        expect(recorded.tools,).toEqual([ADVISOR_TOOL_NAME,],);
        expect(recorded.commands,).toEqual([ADVISOR_TOOL_NAME,],);
        expect(recorded.renderers,).toEqual([ADVISOR_MESSAGE_TYPE,],);
        expect(recorded.events,).toEqual([
          'session_start',
          'before_agent_start',
        ],);
      },
    },),
  ],
},);

await describe({
  name: buildMainModelGuidance.name,
  children: [
    it({
      name: 'lists scoped slugs and default model',
      fn: async () => {
        const guidance = buildMainModelGuidance({
          ctx: extensionContext(),
          config: advisorConfig,
        },);
        expect(guidance,).toContain('faux-provider/reviewer',);
        expect(guidance,).toContain('advisor({}) default model: faux-provider/reviewer',);
      },
    },),
  ],
},);

await describe({
  name: buildAdvisorStatus.name,
  children: [
    it({
      name: 'reports enablement and scoped default',
      fn: async () => {
        const status = buildAdvisorStatus({
          ctx: commandContext(),
          config: advisorConfig,
          enabled: true,
        },);
        expect(status,).toContain('Advisor: on',);
        expect(status,).toContain('Default model: faux-provider/reviewer',);
      },
    },),
  ],
},);
