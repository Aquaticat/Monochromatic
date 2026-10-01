/**
 * Disposable workspace and agent storage isolated from every real pi home.
 *
 * @module
 */
import { mkdir, mkdtemp, rm, } from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

//region Workspace ownership: remove only test-created storage.

/** Paths and cleanup authority for one independently owned fixture home. */
export class FixtureHome {
  /** Root containing only files created by this fixture. */
  readonly root: string;
  /** Synthetic project directory given to createAgentSession. */
  readonly cwd: string;
  /** Disposable agent configuration directory, never the actual pi home. */
  readonly agentDir: string;
  /** Optional synthetic models.json consumed by the real host. */
  readonly modelsPath: string;
  /** Disposable cached catalog used to test cached-only discovery. */
  readonly modelsStorePath: string;
  /** Session persistence directory for real resume and branch tests. */
  readonly sessionDir: string;

  /**
   * Derive storage paths within the owned temporary root.
   *
   * @param root - newly created private fixture directory
   */
  constructor(root: string,) {
    this.root = root;
    this.cwd = join(root, 'workspace',);
    this.agentDir = join(root, 'agent',);
    this.modelsPath = join(this.agentDir, 'models.json',);
    this.modelsStorePath = join(this.agentDir, 'models-store.json',);
    this.sessionDir = join(this.agentDir, 'sessions',);
  }

  /** Delete only this fixture's temporary root after dependent sessions close. */
  async [Symbol.asyncDispose](): Promise<void> {
    await rm(this.root, { recursive: true, force: true, },);
  }
}

/**
 * Create independent workspace, config, cache, and session storage paths.
 *
 * @returns asynchronously disposable home for native-host scenarios
 * @example
 * ```ts
 * await using home = await fixtureHome();
 * ```
 */
export async function fixtureHome(): Promise<FixtureHome> {
  /** Newly created storage is owned immediately, even if initialization fails. */
  const home = new FixtureHome(await mkdtemp(join(tmpdir(), 'openai-fast-host-',),),);
  /** Ownership transfers only after both directories initialize successfully. */
  await using initialization = {
    transferred: false,
    [Symbol.asyncDispose]: async function dispose(): Promise<void> {
      if (!this.transferred)
        await home[Symbol.asyncDispose]();
    },
  };
  await Promise.all([mkdir(home.cwd,), mkdir(home.agentDir,),],);
  initialization.transferred = true;
  return home;
}

//endregion Workspace ownership
