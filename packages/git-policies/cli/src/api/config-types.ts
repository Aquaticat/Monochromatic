/**
 * Typed plugin and configuration contracts.
 *
 * @module
 */

import type {
  NamedPolicyDefinition,
  PolicyDefinition,
  PolicySeverity,
} from './policy-types.ts';

/**
 * Plugin with policies in declaration order.
 *
 * @example
 * ```ts
 * const plugin: PluginDefinition = { name: 'example', policies: [] };
 * ```
 */
export type PluginDefinition<
  TPolicies extends readonly NamedPolicyDefinition[] =
    readonly NamedPolicyDefinition[],
  TName extends string = string,
> = Readonly<{
  /**
   * Namespace name.
   */
  name: TName;
  /**
   * Declaration-ordered policies.
   */
  policies: TPolicies;
}>;

/**
 * Severity alone or severity plus validated options.
 *
 * @example
 * ```ts
 * const setting: PolicySetting<string> = ['warn', 'value'];
 * ```
 */
export type PolicySetting<TOptions = unknown> =
  | PolicySeverity
  | readonly [
    PolicySeverity,
    TOptions,
  ];

/**
 * Built-in policy IDs accepted by configuration.
 *
 * @example
 * ```ts
 * const id: BuiltInPolicyId = 'require-root';
 * ```
 */
export type BuiltInPolicyId =
  | 'require-root'
  | 'linked-worktree-only'
  | 'branch-worktree-only'
  | 'add-explicit'
  | 'final-newline';

/**
 * Plugin namespace map.
 *
 * @example
 * ```ts
 * const plugins: PluginMap = {};
 * ```
 */
export type PluginMap = Readonly<Record<string, PluginDefinition>>;

/**
 * Consumer cli-git configuration.
 *
 * Precise policy-ID and option checking occurs in {@link defineConfig}.
 *
 * @example
 * ```ts
 * const config: CliGitConfig = {};
 * ```
 */
export type CliGitConfig<TPlugins extends PluginMap = PluginMap> = Readonly<{
  /**
   * Plugins keyed by namespace.
   */
  plugins?: TPlugins;
  /**
   * Explicit policy overrides.
   */
  policies?: Readonly<Record<string, PolicySetting>>;
  /**
   * Trust behavior.
   */
  trust?: Readonly<{
    /**
     * Whether descendant repositories may inherit trust.
     */
    children?: boolean;
  }>;
}>;

/**
 * Broad inference input accepted before precise policy checking.
 *
 * @example
 * ```ts
 * const input: CliGitConfigInput = {};
 * ```
 */
export type CliGitConfigInput = Readonly<{
  /**
   * Consumer plugins.
   */
  plugins?: PluginMap;
  /**
   * Consumer policy settings before ID validation.
   */
  policies?: Readonly<Record<string, unknown>>;
  /**
   * Trust behavior.
   */
  trust?: Readonly<{
    /**
     * Whether descendant repositories may inherit trust.
     */
    children?: boolean;
  }>;
}>;

/**
 * Extracts plugin map.
 *
 * @example
 * ```ts
 * type Plugins = ConfigPlugins<{ plugins: {} }>;
 * ```
 */
export type ConfigPlugins<TConfig extends CliGitConfigInput> =
  TConfig extends { readonly plugins: infer TPlugins extends PluginMap }
    ? TPlugins
    : never;

/**
 * Extracts policy map.
 *
 * @example
 * ```ts
 * type Policies = ConfigPolicies<{ policies: {} }>;
 * ```
 */
export type ConfigPolicies<TConfig extends CliGitConfigInput> =
  TConfig extends {
    readonly policies: infer TPolicies extends Readonly<Record<string, unknown>>;
  }
    ? TPolicies
    : never;

/**
 * Extracts matching plugin policy from namespaced ID.
 *
 * @example
 * ```ts
 * type Policy = PluginPolicyForId<{}, 'example/check'>;
 * ```
 */
export type PluginPolicyForId<
  TPlugins extends PluginMap,
  TId extends string,
> = TId extends `${infer TNamespace}/${infer TName}`
  ? TNamespace extends keyof TPlugins
    ? Extract<TPlugins[TNamespace]['policies'][number], { readonly name: TName }>
    : never
  : never;

/**
 * Determines allowed setting for one policy ID.
 *
 * @example
 * ```ts
 * type Setting = AllowedPolicySetting<{}, 'require-root'>;
 * ```
 */
export type AllowedPolicySetting<
  TConfig extends CliGitConfigInput,
  TId extends PropertyKey,
> = TId extends BuiltInPolicyId
  ? PolicySeverity
  : TId extends string
    ? [PluginPolicyForId<ConfigPlugins<TConfig>, TId>] extends [never]
      ? never
      : PluginPolicyForId<ConfigPlugins<TConfig>, TId> extends PolicyDefinition<infer TOptions>
        ? PolicySetting<TOptions>
        : never
    : never;

/**
 * Rejects unknown IDs and incompatible option outputs.
 *
 * @example
 * ```ts
 * type Checked = CheckedPolicySettings<{}>;
 * ```
 */
export type CheckedPolicySettings<TConfig extends CliGitConfigInput> = Readonly<{
  [TId in keyof ConfigPolicies<TConfig>]:
    ConfigPolicies<TConfig>[TId] extends AllowedPolicySetting<TConfig, TId>
      ? ConfigPolicies<TConfig>[TId]
      : never;
}>;
