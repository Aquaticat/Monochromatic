/**
 Disposable file observations exercise original dependency bytes without touching real policy. @module
 */
import {
  chmod,
  mkdir,
  mkdtemp,
  rm,
  writeFile
} from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createFacadeFixture } from './native-facade-fixture.ts';

/**
 File fixture extends independent capabilities with one privately owned selected path.
 */
type FacadeFileFixture = ReturnType<typeof createFacadeFixture> & AsyncDisposable & Readonly<{
  directory: string;
  path: string;
  bytes: Buffer;
}>;

/** Private scratch storage excludes other users from disposable observation fixtures. */
const privateDirectoryMode = 0o700;

//region Only disposable selected files are mutated during original dependency verification.
/**
 Create an independently owned file root and original byte sequence for synchronous observation.

 @returns disposable file root and independent facade capabilities

 @example await using fixture = await createFacadeFileFixture();
 */
export async function createFacadeFileFixture(): Promise<FacadeFileFixture> {
  /**
   Persistent scratch parent follows the current account rather than a fixed username.
   */
  const scratch = join(
    homedir(),
    'temp',
    'agent'
  );
  await mkdir(
    scratch,
    { recursive: true, mode: privateDirectoryMode }
  );
  await chmod(
    scratch,
    privateDirectoryMode
  );
  /**
   This unique root belongs only to the current test attempt.
   */
  const directory = await mkdtemp(join(
    scratch,
    'pi-dependency-facade-'
  ));
  /**
   Original selected bytes include non-text content to expose accidental string conversion.
   */
  const bytes = Buffer.from('00ff270a41', 'hex');
  /**
   Only this selected original path is supplied to the built facade.
   */
  const path = join(
    directory,
    'policy'
  );
  try {
    await writeFile(
      path,
      bytes,
      { mode: 0o600 }
    );
  } catch (error) {
    await rm(
      directory,
      { recursive: true, force: true }
    );
    throw error;
  }
  /**
   Root and source callbacks stay independent of file ownership.
   */
  const fixture = createFacadeFixture();
  fixture.options
    .rootDirectory = directory;
  fixture.options
    .files = [{
    relativePath: 'policy',
    requiredMode: 0o600
  }];
  return {
    ...fixture,
    directory,
    path,
    bytes,
    async [Symbol.asyncDispose](): Promise<void> { 
      await rm(directory, { recursive: true, force: true }); 
    },
  };
}
//endregion
