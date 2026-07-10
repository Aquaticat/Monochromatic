/**
 * Trusted configuration resolution for command execution.
 *
 * @module
 */
import { resolveAccountRegistryRoot, } from './account-root.ts';
import { classifyConfigLoading, } from './command-classification.ts';
import {
  CONFIG_ABSENT,
  discoverConfig,
} from './config-discovery.ts';
import { loadTrustedConfig, } from './trust-service.ts';
import type { LoadedTrustedConfig, } from './types.ts';

/**
 * No trusted config is needed or present for invocation.
 */
export const RUNTIME_CONFIG_ABSENT: unique symbol = Symbol('trusted runtime configuration is absent',);

/**
 * Loads trusted stored config when command classification requires it.
 *
 * @param args - exact wrapper or Git-global direct arguments
 *
 * @param forceLoad - direct command requires trusted config regardless of Git subcommand absence
 *
 * @param registryRoot - internal test registry override
 *
 * @returns loaded config or absence sentinel
 *
 * @example
 * ```ts
 * await resolveRuntimeConfig({ args: ['status'] });
 * ```
 */
export async function resolveRuntimeConfig({
  args,
  forceLoad = false,
  registryRoot,
}: Readonly<{
  args: readonly string[];
  forceLoad?: boolean;
  registryRoot?: string;
}>,): Promise<LoadedTrustedConfig | typeof RUNTIME_CONFIG_ABSENT> {
  if ((!forceLoad) && (classifyConfigLoading(args,) === 'skip-config'))
    return RUNTIME_CONFIG_ABSENT;
  /**
   * Canonical repository config when present.
   */
  const discovered = await discoverConfig(args,);
  if (discovered === CONFIG_ABSENT)
    return RUNTIME_CONFIG_ABSENT;
  /**
   * Injected test root or OS-account production root.
   */
  const effectiveRegistryRoot = registryRoot ?? await resolveAccountRegistryRoot();
  return await loadTrustedConfig({
    discovered,
    registryRoot: effectiveRegistryRoot,
  },);
}
