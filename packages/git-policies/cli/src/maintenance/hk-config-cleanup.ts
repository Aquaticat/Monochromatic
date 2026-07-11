/**
 * Exact Git-config cleanup for retired hk hook registrations.
 *
 * @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import nanoSpawn from 'nano-spawn';

/**
 * Logger root for hk migration cleanup.
 */
const l = tagged({ tag: 'hk-config-cleanup', },);
/**
 * Exact Git-config prefix owned by hk's config-based installer.
 */
const HK_HOOK_PREFIX = 'hook.hk-';

/**
 * Git configuration scope eligible for hk cleanup.
 */
export type HkConfigScope = 'global' | 'local';

/**
 * Completed exact cleanup summary.
 */
export type HkConfigCleanupResult = Readonly<{
  /**
   * Git configuration scope inspected.
   */
  scope: HkConfigScope;
  /**
   * Sorted unique hk-owned keys removed from that scope.
   */
  removedKeys: readonly string[];
}>;

/**
 * Removes only `hook.hk-*` keys from one explicit Git configuration scope.
 *
 * @param gitPath - real Git executable
 *
 * @param scope - local or global configuration boundary
 *
 * @param cwd - repository for local scope and stable process directory for global scope
 *
 * @param env - optional environment override used by disposable global-config fixtures
 *
 * @returns exact removed keys; an empty list proves idempotent no-op behavior
 *
 * @example
 * ```ts
 * await cleanupHkGitConfig({ gitPath: '/usr/bin/git', scope: 'local', cwd: '/work/repository' });
 * ```
 */
export async function cleanupHkGitConfig({
  gitPath,
  scope,
  cwd,
  env,
}: Readonly<{
  gitPath: string;
  scope: HkConfigScope;
  cwd: string;
  env?: Readonly<Record<string, string>>;
}>,): Promise<HkConfigCleanupResult> {
  /**
   * Function-boundary logger for one explicit configuration scope.
   */
  const rl = tagged({
    tag: cleanupHkGitConfig.name,
    l,
  },);
  rl.info(`inspecting ${scope} Git configuration`,);
  /**
   * Effective scoped key list; aggregate listing remains successful when a global config file is absent.
   */
  const listed = await nanoSpawn(
    gitPath,
    [
      'config',
      '--null',
      '--show-scope',
      '--name-only',
      '--list',
    ],
    {
      cwd,
      ...(env === undefined ? {} : { env, }),
    },
  );
  /**
   * Alternating scope and key fields emitted by Git.
   */
  const scopedFields = listed.stdout
    .split('\0')
    .filter(function omitTerminalEmpty(
      field,
      index,
      fields,
    ) {
      return (field !== '') || (index < (fields.length - 1));
    },);
  /**
   * Sorted unique keys within hk's exact installer namespace and selected scope.
   */
  const removedKeys = [...new Set(scopedFields
    .filter(function selectScopeField(
      _field,
      index,
    ) {
      return (index % 2) === 0;
    },)
    .flatMap(function selectHkHookKey(
      fieldScope,
      scopeIndex,
    ) {
      /**
       * Key paired with current scope field.
       */
      const key = scopedFields[(scopeIndex * 2) + 1];
      if (key === undefined)
        throw new TypeError('Git config emitted a scope without a key.',);
      return (fieldScope === scope) && key.startsWith(HK_HOOK_PREFIX,)
        ? [key,]
        : [];
    },),),]
    .toSorted();
  await removedKeys.reduce(
    async function removeKey(
      previous,
      key,
    ) {
      await previous;
      rl.info(`removing ${scope} key ${key}`,);
      await nanoSpawn(
        gitPath,
        [
          'config',
          `--${scope}`,
          '--unset-all',
          key,
        ],
        {
          cwd,
          ...(env === undefined ? {} : { env, }),
        },
      );
    },
    Promise.resolve(),
  );
  rl.info(`removed ${String(removedKeys.length,)} ${scope} hk keys`,);
  return {
    scope,
    removedKeys,
  };
}
