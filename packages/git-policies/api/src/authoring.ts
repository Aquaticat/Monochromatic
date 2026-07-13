/**
 * Side-effect-free authoring helpers.
 *
 * @module
 */

import type {
  GenericSchema,
} from 'valibot';

import type {
  CheckedPolicySettings,
  CliGitConfig,
  CliGitConfigInput,
  ConfigPlugins,
  PluginDefinition,
} from './config-types.ts';
import type {
  NamedPolicyDefinition,
  PolicyDefinition,
} from './policy-types.ts';

/**
 * Preserves a Valibot policy-options schema without widening its output.
 *
 * @param schema - Schema whose output becomes policy options
 *
 * @returns Same schema instance
 *
 * @example
 * ```ts
 * import * as v from 'valibot';
 * const options = definePolicyOptions(v.object({ suffix: v.string() }));
 * ```
 */
export function definePolicyOptions<const TInput, const TOutput>(
  schema: Readonly<GenericSchema<TInput, TOutput>>,
): GenericSchema<TInput, TOutput> {
  return schema;
}

/**
 * Preserves policy name and options output.
 *
 * @param definition - Policy declaration
 *
 * @returns Same declaration instance
 *
 * @example
 * ```ts
 * const policy = definePolicy({
 *   name: 'check',
 *   defaultSeverity: 'error',
 *   warnSafe: true,
 *   triggers: ['direct-check'],
 *   check: async () => [],
 * });
 * ```
 */
export function definePolicy<
  const TName extends string,
  const TOptions = undefined,
>(
  definition: Readonly<PolicyDefinition<Readonly<TOptions>, TName>>,
): PolicyDefinition<Readonly<TOptions>, TName> {
  return definition;
}

/**
 * Preserves plugin namespace and policy declarations.
 *
 * @param definition - Plugin declaration
 *
 * @returns Same declaration instance
 *
 * @example
 * ```ts
 * const plugin = definePlugin({ name: 'example', policies: [policy] });
 * ```
 */
export function definePlugin<
  const TName extends string,
  const TPolicies extends readonly NamedPolicyDefinition[],
>(
  definition: PluginDefinition<TPolicies, TName>,
): PluginDefinition<TPolicies, TName> {
  return definition;
}

/**
 * Checks consumer configuration against declared plugin policy IDs and options.
 *
 * JavaScript spread and merge behavior remains consumer-owned.
 *
 * @param config - Consumer configuration
 *
 * @returns Same configuration instance
 *
 * @example
 * ```ts
 * export default defineConfig({
 *   plugins: { example: plugin },
 *   policies: { 'example/check': 'warn' },
 * });
 * ```
 */
export function defineConfig<const TConfig extends CliGitConfigInput>(
  config: Readonly<
    TConfig
    & CliGitConfig<ConfigPlugins<TConfig>>
    & { readonly policies?: CheckedPolicySettings<TConfig> }
  >,
): TConfig {
  return config;
}
