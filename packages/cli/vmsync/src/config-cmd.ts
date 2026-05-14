/**
 * Config command; updates boot settings for a managed VM.
 *
 * @module
 */

import {
  readConfig,
  writeConfig,
} from './config.ts';
import {
  l,
  tagged,
} from './log.ts';

/**
 * Updates the boot configuration for a named VM.
 *
 * @param name - VM name
 *
 * @param memory - New memory allocation (e.g. "8G"), or undefined to keep current
 *
 * @param cpus - New CPU count, or undefined to keep current
 *
 * @throws Error when the VM config is missing
 *
 * @example
 * ```ts
 * await updateConfig({ name: 'alpine', memory: '8G', cpus: 8 });
 * ```
 */
export async function updateConfig(
  {
    name,
    memory,
    cpus,
  }: {
    name: string;
    memory: string | undefined;
    cpus: number | undefined;
  },
): Promise<void> {
  /** Tagged logger so config-update entries are scoped to `updateConfig` in the output. */
  const rl = tagged({
    tag: updateConfig.name,
    l,
  },);
  rl.info(`updating config for "${name}"`,);

  /** Current configuration to modify. */
  const config = await readConfig(name,);

  /** Updated boot config with overrides applied. */
  const updatedBoot = {
    memory: memory ?? config.boot.memory,
    cpus: cpus ?? config.boot.cpus,
  };

  /** New config with updated boot settings. */
  const updatedConfig = {
    ...config,
    boot: updatedBoot,
  };

  await writeConfig({
    name,
    config: updatedConfig,
  },);

  console.log(
    `updated "${name}": memory=${updatedBoot.memory}, cpus=${String(updatedBoot.cpus,)}`,
  );
}
