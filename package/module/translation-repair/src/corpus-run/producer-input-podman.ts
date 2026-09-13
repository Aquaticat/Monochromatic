import {
  mkdir,
  open,
  readFile,
} from 'node:fs/promises';
import { join, } from 'node:path';
import { ProducerInputRunError, } from './producer-input-error.ts';
import type { ProducerInputRun, } from './producer-input-run.ts';

//region Owned Podman configuration for the fixed input launcher

/**
 * Host invocation context suppresses ambient configuration without exporting host environment values to records.
 *
 * @example
 * ```ts
 * const context: ProducerInputPodmanContext = { prefix, environment, configPath, mountsPath };
 * ```
 */
export type ProducerInputPodmanContext = {
  /**
   * Fixed local-mode and default-mount-file arguments precede the owned Podman operation.
   */
  readonly prefix: readonly string[];
  /**
   * Host-only environment; never serialize or forward this whole map into the container.
   */
  readonly environment: Readonly<NodeJS.ProcessEnv>;
  /**
   * Exact generated configuration remains in the private control directory.
   */
  readonly configPath: string;
  /**
   * Empty default subscription mount file prevents ambient host-data injection.
   */
  readonly mountsPath: string;
};

/**
 * Private control files do not expose environment-independent run metadata to other accounts.
 */
const PRIVATE_FILE_MODE = 0o600;
/**
 * An explicitly empty private hook directory replaces host hook discovery.
 */
const PRIVATE_DIRECTORY_MODE = 0o700;

/**
 * Creates and synchronizes only the fixed configuration files needed by the preparation launch.
 * The Podman executable is separately identity-bound by the caller.
 *
 * @param run - newly created private input-run control directory
 *
 * @returns Owned host-only invocation context, not an arbitrary subprocess interface
 *
 * @throws ProducerInputRunError when the measured non-FIPS host profile or exclusive control writes differ
 *
 * @example
 * ```ts
 * const context = await createProducerInputPodmanContext(run);
 * ```
 */
export async function createProducerInputPodmanContext(run: ProducerInputRun): Promise<ProducerInputPodmanContext> {
  try {
    /**
     * Podman can add host FIPS mounts independently of default-mount files; this profile does not disable FIPS.
     */
    const fips = await readFile(
      '/proc/sys/crypto/fips_enabled',
      'utf8'
    );
    if (fips.trim() !== '0')
      throw new ProducerInputRunError({
        operation: 'launch-container',
        locator: 'host FIPS profile',
      });
    /**
     * Host hook discovery is replaced, not merged with an ambient directory.
     */
    const hooks = join(
      run.dir,
      'empty-hooks'
    );
    await mkdir(
      hooks,
      { mode: PRIVATE_DIRECTORY_MODE }
    );
    /**
     * Only generated configuration is read through CONTAINERS_CONF.
     */
    const configPath = join(
      run.dir,
      'containers.conf'
    );
    {
      /**
       * JSON quoting supplies basic escapes; TOML additionally requires escaping ASCII DEL.
       */
      const encodedHooks = JSON.stringify(hooks)
        .replaceAll('\u007f', '\\u007F');
      /**
       * No user-controlled text crosses the TOML string boundary without final encoding.
       */
      const text = `[containers]\nmounts = []\n[engine]\nhooks_dir = [${encodedHooks}]\n`;
      /**
       * Exclusive creation preserves an incomplete control record for diagnosis.
       */
      await using file = await open(
        configPath,
        'wx',
        PRIVATE_FILE_MODE
      );
      await file.writeFile(
        text,
        'utf8'
      );
      await file.sync();
    }
    /**
     * The pinned Podman implementation exposes this testing-only override; its actual invocation is verified.
     */
    const mountsPath = join(
      run.dir,
      'default-mounts.conf'
    );
    {
      /**
       * An empty file is intentional control data, not missing configuration.
       */
      await using file = await open(
        mountsPath,
        'wx',
        PRIVATE_FILE_MODE
      );
      await file.sync();
    }
    /**
     * Storage and account context remain host-owned; launch-changing overrides are explicitly removed.
     */
    const environment: NodeJS.ProcessEnv = {
      ...process.env,
      CONTAINERS_CONF: configPath,
    };
    delete environment.CONTAINERS_CONF_OVERRIDE;
    delete environment.CONTAINER_HOST;
    delete environment.CONTAINER_CONNECTION;
    return {
      prefix: ['--remote=false', '--default-mounts-file', mountsPath],
      environment,
      configPath,
      mountsPath,
    };
  }
  catch (error) {
    if (error instanceof ProducerInputRunError)
      throw error;
    throw new ProducerInputRunError({
      operation: 'launch-container',
      locator: run.dir,
    });
  }
}

//endregion Owned Podman configuration for the fixed input launcher
