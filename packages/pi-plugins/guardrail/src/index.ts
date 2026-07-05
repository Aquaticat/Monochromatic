/**
 * Pi guardrail extension entry point.
 *
 * Blocks misleading `bun test` Bash invocations and refuses edit/write tool
 * calls for configured gitignore-style protected paths.
 *
 * @module
 */

import type {
  ExtensionAPI,
  ExtensionContext,
  ToolCallEvent,
} from '@earendil-works/pi-coding-agent';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { evaluateBashGuard, } from './bash-guard.ts';
import { loadGuardrailConfig, } from './config.ts';
import {
  createPathGuardMatcher,
  evaluatePathGuard,
} from './path-guard.ts';
import type {
  GuardrailBlockDecision,
  GuardrailConfig,
} from './types.ts';

//region Logger

/**
 * Logger root for pi guardrail.
 *
 * @example
 * ```typescript
 * const child = tagged({ tag: someFunction.name, l });
 * ```
 */
const l = tagged({ tag: 'pi-guardrail', },);

//endregion Logger

//region Types

/**
 * Dependencies used while registering the extension.
 */
type RegisterGuardrailOptions = {
  /**
   * Pi extension API.
   */
  readonly pi: ExtensionAPI;
  /**
   * Config loader dependency; defaults to global config file loading.
   */
  readonly loadConfig?: () => Promise<GuardrailConfig>;
};

//endregion Types

//region Extension entry point

/**
 * Registers pi guardrail event handlers.
 *
 * @param pi - pi extension API
 *
 * @param loadConfig - optional config loader dependency for tests
 *
 * @example
 * ```typescript
 * await registerGuardrail({ pi });
 * ```
 */
async function registerGuardrail(
  {
    pi,
    loadConfig = loadGuardrailConfig,
  }: RegisterGuardrailOptions,
): Promise<void> {
  /**
   * Function-scoped logger for extension registration.
   */
  const innerL = tagged({
    tag: registerGuardrail.name,
    l,
  },);
  /**
   * Runtime config loaded once per extension load.
   */
  const config = await loadConfig();
  /**
   * Compiled protected-path matcher using gitignore semantics.
   */
  const pathMatcher = createPathGuardMatcher(config.pathRules,);

  innerL.debug(
    `loaded guardrail config from ${config.source.path}; present=${String(config.source.loaded,)}; rules=${String(config.pathRules.length,)}; blockBunTest=${String(config.blockBunTest,)}`,
  );

  pi.on(
    'tool_call',
    function handleToolCall(
      event: ToolCallEvent,
      ctx: ExtensionContext,
    ): GuardrailBlockDecision | undefined {
      /**
       * Decision from the first guardrail matching this tool call.
       */
      const decision = evaluateToolCall({
        event,
        ctx,
        config,
        pathMatcher,
      },);
      if (decision === undefined)
        return undefined;

      innerL.warn(
        `blocked ${event.toolName} tool call: ${decision.reason}`,
      );
      if (ctx.hasUI) {
        ctx.ui.notify(
          decision.reason,
          'warning',
        );
      }
      return decision;
    },
  );
}

/**
 * Pi guardrail extension.
 *
 * @param pi - pi extension API
 *
 * @example
 * ```json
 * { "packages": ["/var/home/user/Monochromatic/packages/pi-plugins/guardrail"] }
 * ```
 */
export default async function piGuardrail(pi: ExtensionAPI,): Promise<void> {
  await registerGuardrail({ pi, },);
}

//endregion Extension entry point

//region Tool dispatch

/**
 * Evaluates guardrails for a single pi tool call.
 *
 * @param event - pi tool-call event
 *
 * @param ctx - pi extension context
 *
 * @param config - loaded guardrail config
 *
 * @param pathMatcher - compiled path matcher
 *
 * @returns block decision when a guardrail matches, otherwise `undefined`
 *
 * @example
 * ```typescript
 * evaluateToolCall({ event, ctx, config, pathMatcher });
 * ```
 */
function evaluateToolCall(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- pi event/context types are external mutable interfaces; guardrail reads only.
  {
    event,
    ctx,
    config,
    pathMatcher,
  }: {
    readonly event: ToolCallEvent;
    readonly ctx: ExtensionContext;
    readonly config: GuardrailConfig;
    readonly pathMatcher: ReturnType<typeof createPathGuardMatcher>;
  },
): GuardrailBlockDecision | undefined {
  if ((event.toolName === 'bash') && config.blockBunTest)
    return evaluateBashGuard(event.input,);

  if ((event.toolName !== 'edit') && (event.toolName !== 'write'))
    return undefined;

  return evaluatePathGuard({
    input: event.input,
    cwd: ctx.cwd,
    matcher: pathMatcher,
  },);
}

//endregion Tool dispatch

export {
  evaluateToolCall,
  registerGuardrail,
};
export type { RegisterGuardrailOptions, };
