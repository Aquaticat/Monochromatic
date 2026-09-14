import {
  createHash,
  randomUUID,
} from 'node:crypto';
import {
  lstat,
  mkdir,
  open,
  realpath,
} from 'node:fs/promises';
import { join, } from 'node:path';
import { ProducerInputRunError, } from './producer-input-error.ts';
import type { ProducerInputFileIdentity, } from './producer-input-file.ts';

//region Exclusive unqualified input-run ownership

/**
 Private directory permission floor for run control, writable output and child home.
 */
const PRIVATE_DIRECTORY_MODE = 0o700;
/**
 Control files are created only by this caller and are never overwritten.
 */
const PRIVATE_FILE_MODE = 0o600;
/**
 Group or other permission bits make an output parent unsuitable for private corpus artifacts.
 */
const NON_PRIVATE_MODE = 0o077;

/**
 An input-run location is not a reviewed preparation attempt or acquisition lease.
 
 @example
 ```ts
 const run: ProducerInputRun = { dir, outputDir, launchPath, containerIdPath, runId, uid, gid };
 ```
 */
export type ProducerInputRun = {
  /**
   Exclusive host run directory, retained on every later failure.
   */
  readonly dir: string;
  /**
   Only this child directory is mounted writable for the application.
   */
  readonly outputDir: string;
  /**
   Exact launch snapshot is mounted read-only outside the writable output alias.
   */
  readonly launchPath: string;
  /**
   Podman writes its container ID into a new control-file path.
   */
  readonly containerIdPath: string;
  /**
   Random identity for this input run, never reused automatically.
   */
  readonly runId: string;
  /**
   Host identity that must own both control and child-created files.
   */
  readonly uid: number;
  /**
   Host group identity retained for namespace and output checks.
   */
  readonly gid: number;
};

/**
 Writes one fixed host control record with exclusive creation and content synchronization.
 
 @param dir - already created private run directory
 
 @param file - fixed host control-file role
 
 @param bytes - owned exact serialization, never logged
 
 @throws ProducerInputRunError when creation, writing or synchronization fails
 
 @example
 ```ts
 await writeProducerInputControl({ dir, file: 'container-terminal.json', bytes });
 ```
 */
export async function writeProducerInputControl({
  dir,
  file,
  bytes,
}: {
  readonly dir: string;
  readonly file: 'launch.json' | 'created.json' | 'container-terminal.json' | 'verified-completion.json' | 'cleanup-complete.json' | 'stop-observation.json';
  readonly bytes: Uint8Array;
},): Promise<void> {
  if (![
    'launch.json',
    'created.json',
    'container-terminal.json',
    'verified-completion.json',
    'cleanup-complete.json',
    'stop-observation.json'
  ].includes(file))
    throw new ProducerInputRunError({
      operation: 'write-output',
      locator: dir,
    });
  /**
   Caller mutation cannot alter an in-flight control record.
   */
  const owned = new Uint8Array(bytes);
  /**
   Fixed role names cannot escape the private run directory.
   */
  const path = join(
    dir,
    file
  );
  try {
    /**
     Existing complete or partial state is never reused.
     */
    await using handle = await open(
      path,
      'wx',
      PRIVATE_FILE_MODE
    );
    await handle.writeFile(owned);
    await handle.sync();
  }
  catch (error) {
    if (error instanceof ProducerInputRunError)
      throw error;
    throw new ProducerInputRunError({
      operation: 'write-output',
      locator: path,
    });
  }
}

/**
 Creates a private unqualified input run before reading referenced corpus or supporting bodies.
 The host must first establish that the output parent is disjoint from its read-only input resources.
 No cleanup or automatic resume occurs after exclusive creation succeeds.
 
 @param parent - existing canonical private caller-owned output parent
 
 @param launchBytes - exact independently verified launch bytes
 
 @param expected - separately recorded launch extent and SHA-256
 
 @returns Complete host-owned run locations after synchronized control records exist
 
 @throws ProducerInputRunError when ownership, bytes or exclusive creation differs
 
 @example
 ```ts
 const run = await createProducerInputRun({ parent, launchBytes, expected });
 ```
 */
export async function createProducerInputRun({
  parent,
  launchBytes,
  expected,
}: {
  readonly parent: string;
  readonly launchBytes: Uint8Array;
  readonly expected: ProducerInputFileIdentity;
},): Promise<ProducerInputRun> {
  /**
   Capture primitive identity and raw bytes before filesystem work can yield.
   */
  const {
    bytes,
    sha256,
  } = expected;
  /**
   The launch snapshot remains independent of caller buffers.
   */
  const owned = new Uint8Array(launchBytes);
  if ((owned.length !== bytes) || (createHash('sha256')
    .update(owned)
    .digest('hex')
    !== sha256)
    || ((typeof process.getuid) !== 'function')
    || ((typeof process.getgid) !== 'function'))
    throw new ProducerInputRunError({
      operation: 'read-launch',
      locator: parent,
    });
  /**
   Host account identity is fixed before creating any run state.
   */
  const uid = process.getuid();
  /**
   Group identity is retained rather than inferred from container defaults.
   */
  const gid = process.getgid();
  /**
   A fresh intended location remains available to diagnose partial creation failures.
   */
  const runId = randomUUID();
  /**
   This directory never carries a reviewed root-plan or acquisition marker.
   */
  const dir = join(
    parent,
    `producer-input-${runId}`
  );
  try {
    /**
     Symbolic output parents cannot redirect creation outside the validated host layout.
     */
    const canonical = await realpath(parent);
    /**
     Parent privacy is checked without following a leaf symlink.
     */
    const state = await lstat(parent);
    if ((canonical !== parent) || (!state.isDirectory())
      || (state.uid !== uid)
      || ((state.mode & NON_PRIVATE_MODE) !== 0))
      throw new ProducerInputRunError({
        operation: 'write-output',
        locator: parent,
      });
    await mkdir(
      dir,
      { mode: PRIVATE_DIRECTORY_MODE }
    );
    await writeProducerInputControl({
      dir,
      file: 'launch.json',
      bytes: owned
    });
    await writeProducerInputControl({
      dir,
      file: 'created.json',
      bytes: new TextEncoder().encode(JSON.stringify({
        version: 1,
        kind: 'producer-preparation-input-created',
        runId,
        launchSha256: sha256,
        launchBytes: bytes,
        uid,
        gid,
      }))
    });
    /**
     Writable application state is separated from read-only control records.
     */
    const outputDir = join(
      dir,
      'output'
    );
    await mkdir(
      outputDir,
      { mode: PRIVATE_DIRECTORY_MODE }
    );
    await mkdir(
      join(
        outputDir,
        'home'
      ),
      { mode: PRIVATE_DIRECTORY_MODE }
    );
    return {
      dir,
      outputDir,
      launchPath: join(
        dir,
        'launch.json'
      ),
      containerIdPath: join(
        dir,
        'container.id'
      ),
      runId,
      uid,
      gid,
    };
  }
  catch (error) {
    if (error instanceof ProducerInputRunError)
      throw error;
    throw new ProducerInputRunError({
      operation: 'write-output',
      locator: dir,
    });
  }
}

//endregion Exclusive unqualified input-run ownership
