// PROTOTYPE ONLY: Candidate G single-owner run-root lease.

import { randomUUID, } from 'node:crypto';
import { link, readFile, rm, writeFile, } from 'node:fs/promises';
import { basename, join, } from 'node:path';

import { isJsonRecord, } from './json-guard.ts';

/** Raised when another live runtime already owns same immutable run root. */
export class RealizationRuntimeBusyError extends Error {
  public readonly messageNamesOnly: true = true;

  public constructor() {
    super('realization runtime output root already has live owner',);
    this.name = 'RealizationRuntimeBusyError';
  }
}

/** Whether filesystem error reports existing path. */
function isExistingPath(error: unknown,): boolean {
  return isJsonRecord(error,) && (error.code === 'EEXIST');
}

/** Whether filesystem error reports absent path. */
function isMissingPath(error: unknown,): boolean {
  return isJsonRecord(error,) && (error.code === 'ENOENT');
}

/** Reads Linux process incarnation identity from proc start-time field. */
async function processStartIdentity({ pid, }: { readonly pid: number; }): Promise<string> {
  const processStat = await readFile(`/proc/${String(pid,)}/stat`, 'utf8',);
  const commEnd = processStat.lastIndexOf(')',);
  const fields = processStat.slice(commEnd + 2,).split(' ',);
  const startIdentity = fields[19];
  if ((commEnd < 0) || (startIdentity === undefined) || (startIdentity.length === 0))
    throw new Error('realization runtime process incarnation differs');
  return startIdentity;
}

/** Validated lease identity needed for liveness and atomic reclaim election. */
type RealizationLeaseIdentity = {
  readonly pid: number;
  readonly processStartIdentity: string;
  readonly token: string;
};

/** Whether token is bounded path-safe ASCII identity. */
function leaseTokenIsSafe({ token, }: { readonly token: string; }): boolean {
  return (token.length > 0) && (token.length <= 64)
    && Array.from({ length: token.length, }, function character(_value, index,) {
      return token.charAt(index,);
    },).every(function safe(character,) {
      return ((character >= 'a') && (character <= 'z'))
        || ((character >= 'A') && (character <= 'Z'))
        || ((character >= '0') && (character <= '9'))
        || (character === '-');
    },);
}

/** Reads one lease identity from exact path. */
async function readLeaseIdentity({ path, }: { readonly path: string; }): Promise<RealizationLeaseIdentity> {
  const value: unknown = JSON.parse(await readFile(path, 'utf8',),);
  if (!isJsonRecord(value,) || (typeof value.pid !== 'number')
    || (typeof value.processStartIdentity !== 'string') || (typeof value.token !== 'string')
    || !leaseTokenIsSafe({ token: value.token, }))
    throw new Error('realization runtime lease record differs');
  return {
    pid: value.pid,
    processStartIdentity: value.processStartIdentity,
    token: value.token,
  };
}

/** Whether lease still names same live process incarnation. */
async function leaseIsLive({ identity, }: { readonly identity: RealizationLeaseIdentity; }): Promise<boolean> {
  try {
    return await processStartIdentity({ pid: identity.pid, }) === identity.processStartIdentity;
  }
  catch {
    return false;
  }
}

/** Removes lease only when it still belongs to current owner token. */
async function releaseLease({ path, token, }: {
  readonly path: string;
  readonly token: string;
}): Promise<void> {
  const identity = await readLeaseIdentity({ path, });
  if (identity.token !== token)
    throw new Error('realization runtime lease owner differs during release');
  await rm(path,);
}

/** Writes exclusive lease and returns token-bound async disposer. */
async function writeLease({ path, text, token, }: {
  readonly path: string;
  readonly text: string;
  readonly token: string;
}): Promise<AsyncDisposable> {
  await writeFile(path, text, { flag: 'wx', });
  return {
    [Symbol.asyncDispose]: async function dispose() {
      await releaseLease({ path, token, });
    },
  };
}

/** Maximum crashed reclaim owners traversed before bounded refusal. */
const MAX_RECLAIM_ELECTION_DEPTH = 8;

/** One uniquely elected stale-lease replacer and its cleanup paths. */
type RealizationReclaimElection = {
  readonly electionPath: string;
  readonly candidatePath: string;
};

/** Elects exactly one live process, chaining past crashed prior winners. */
async function winReclaimElection({ path, staleToken, contenderIdentity, contenderText, }: {
  readonly path: string;
  readonly staleToken: string;
  readonly contenderIdentity: RealizationLeaseIdentity;
  readonly contenderText: string;
}): Promise<RealizationReclaimElection> {
  const directory = join(path, '..',);
  const candidatePath = join(directory, `.${basename(path,)}.candidate-${contenderIdentity.token}`,);
  await writeFile(candidatePath, contenderText, { flag: 'wx', });
  const cursor = { token: staleToken, };
  for (const _generation of Array.from({ length: MAX_RECLAIM_ELECTION_DEPTH, })) {
    const electionPath = join(directory, `.${basename(path,)}.reclaim-${cursor.token}`,);
    try {
      await link(candidatePath, electionPath,);
      return { electionPath, candidatePath, };
    }
    catch (error) {
      if (!isExistingPath(error,))
        throw error;
      const elected = await readLeaseIdentity({ path: electionPath, });
      if (await leaseIsLive({ identity: elected, }))
        throw new RealizationRuntimeBusyError();
      cursor.token = elected.token;
    }
  }
  throw new RealizationRuntimeBusyError();
}

/** Replaces stale lease only after unique crash-recoverable election. */
async function reclaimStaleLease({ path, identity, text, token, contenderIdentity, }: {
  readonly path: string;
  readonly identity: RealizationLeaseIdentity;
  readonly text: string;
  readonly token: string;
  readonly contenderIdentity: RealizationLeaseIdentity;
}): Promise<AsyncDisposable> {
  await winReclaimElection({
    path,
    staleToken: identity.token,
    contenderIdentity,
    contenderText: text,
  },);
  try {
    const current = await readLeaseIdentity({ path, });
    if (current.token !== identity.token)
      throw new RealizationRuntimeBusyError();
    await rm(path,);
  }
  catch (error) {
    if (!isMissingPath(error,))
      throw error;
  }
  try {
    return await writeLease({ path, text, token, });
  }
  catch (error) {
    if (isExistingPath(error,))
      throw new RealizationRuntimeBusyError();
    throw error;
  }
}

/** Acquires exclusive run-root ownership with inode-bound stale replacement. */
export async function acquireRealizationRuntimeLease({ outputDir, afterExistingObserved, }: {
  readonly outputDir: string;
  readonly afterExistingObserved?: () => Promise<void>;
}): Promise<AsyncDisposable> {
  const path = join(outputDir, 'realization-runtime.lock',);
  const token = randomUUID();
  const processIdentity = await processStartIdentity({ pid: process.pid, });
  const contenderIdentity: RealizationLeaseIdentity = {
    pid: process.pid,
    processStartIdentity: processIdentity,
    token,
  };
  const text = `${JSON.stringify(contenderIdentity, null, 2,)}\n`;
  for (const _handoffAttempt of [0, 1,]) {
    try {
      return await writeLease({ path, text, token, });
    }
    catch (error) {
      if (!isExistingPath(error,))
        throw error;
    }
    if (afterExistingObserved !== undefined)
      await afterExistingObserved();
    let identity: RealizationLeaseIdentity;
    try {
      identity = await readLeaseIdentity({ path, });
    }
    catch (error) {
      if (isMissingPath(error,))
        continue;
      throw error;
    }
    if (await leaseIsLive({ identity, }))
      throw new RealizationRuntimeBusyError();
    return await reclaimStaleLease({ path, identity, text, token, contenderIdentity, });
  }
  throw new RealizationRuntimeBusyError();
}
