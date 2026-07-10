/**
 * Git-native manual-push update discovery.
 *
 * @module
 */
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';
import nanoSpawn, { SubprocessError, } from 'nano-spawn';
import {
  ABSENT_GIT_VALUE,
  type PushUpdate,
} from '../api/context-types.ts';
import { parseGlobalOptions, } from '../parse-global-options.ts';

/** Maximum pre-push hook input accepted from one remote. */
const MAX_HOOK_INPUT_BYTES = 16 * 1_024 * 1_024;
/** Environment variable carrying private capture directory. */
const CAPTURE_DIRECTORY_ENV = 'CLI_GIT_PUSH_FACTS_DIRECTORY';

/** Git-native push update plus destination used for authority query. */
type ProbedPushUpdate = Readonly<{
  /** Local source ref expression reported by Git. */
  localRef: string;
  /** Local object ID reported by Git. */
  localOid: string;
  /** Destination remote location used by Git. */
  remoteLocation: string;
  /** Destination name supplied to pre-push hook. */
  remoteName: string;
  /** Advertised remote object ID reported by push negotiation. */
  advertisedRemoteOid: string;
  /** Fully qualified destination ref. */
  remoteRef: string;
}>;

/** Serialized capture emitted by private pre-push hook. */
type HookCapture = Readonly<{
  /** Raw pre-push stdin. */
  input: string;
  /** Destination location argument. */
  remoteLocation: string;
  /** Destination name argument. */
  remoteName: string;
}>;

/** Manual-push discovery failure. */
export class ManualPushProbeError extends Error {
  /**
   * Creates stable update-discovery failure.
   *
   * @param message - safe failure explanation
   *
   * @param options - optional cause
   */
  public constructor(message: string, options?: Readonly<ErrorOptions>,) {
    super(message, options,);
    this.name = 'ManualPushProbeError';
  }
}

/**
 * Reports whether object ID is Git's format-width zero sentinel.
 *
 * @param oid - object ID text
 *
 * @returns whether every character is zero
 */
function isZeroOid(oid: string,): boolean {
  return (oid.length > 0) && [...oid,].every(function isZero(character,) {
    return character === '0';
  },);
}

/**
 * Inserts private dry-run and hook-enabling options before Git's option terminator.
 *
 * @param args - transformed wrapper arguments
 *
 * @param hooksDirectory - private hook directory
 *
 * @returns real-Git probe arguments
 */
function probeArgs({
  args,
  hooksDirectory,
}: Readonly<{
  args: readonly string[];
  hooksDirectory: string;
}>,): readonly string[] {
  const layout = parseGlobalOptions(args,);
  const postSubcommand = args.slice(layout.subcommandIndex + 1,);
  const separatorIndex = postSubcommand.indexOf('--',);
  const insertionIndex = separatorIndex === (-1)
    ? postSubcommand.length
    : separatorIndex;
  return [
    ...args.slice(0, layout.subcommandIndex,),
    '-c',
    `core.hooksPath=${hooksDirectory}`,
    'push',
    ...postSubcommand.slice(0, insertionIndex,),
    '--dry-run',
    '--verify',
    ...postSubcommand.slice(insertionIndex,),
  ];
}

/**
 * Produces executable Node hook source without shell interpolation.
 *
 * @returns complete CommonJS hook source
 */
function hookSource(): string {
  if (process.execPath.includes('\n',) || process.execPath.includes('\r',))
    throw new ManualPushProbeError('Node executable path cannot be represented in hook shebang.',);
  return `#!${process.execPath}
const { readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const directory = process.env.${CAPTURE_DIRECTORY_ENV};
if (directory === undefined) throw new Error('Missing push-facts capture directory.');
const input = readFileSync(0);
if (input.byteLength > ${String(MAX_HOOK_INPUT_BYTES)}) throw new Error('Pre-push input exceeded capture limit.');
const capture = {
  remoteName: process.argv[2],
  remoteLocation: process.argv[3],
  input: input.toString('utf8'),
};
writeFileSync(join(directory, String(process.pid) + '.json'), JSON.stringify(capture), { flag: 'wx', mode: 0o600 });
`;
}

/**
 * Narrows parsed JSON to hook capture.
 *
 * @param value - parsed JSON value
 *
 * @returns whether required string fields exist
 */
function isHookCapture(value: unknown,): value is HookCapture {
  return ((typeof value) === 'object')
    && (value !== null)
    && ('input' in value)
    && ((typeof value.input) === 'string')
    && ('remoteLocation' in value)
    && ((typeof value.remoteLocation) === 'string')
    && ('remoteName' in value)
    && ((typeof value.remoteName) === 'string');
}

/**
 * Parses Git-documented pre-push records.
 *
 * @param capture - validated hook capture
 *
 * @returns updates reported by Git negotiation
 */
function parseCapture(capture: HookCapture,): readonly ProbedPushUpdate[] {
  return capture.input.split('\n',)
    .filter(function isRecord(line,) {
      return line.length > 0;
    },)
    .map(function parseRecord(line,): ProbedPushUpdate {
      const parts = line.split(' ',);
      if (parts.length !== 4)
        throw new ManualPushProbeError(`Malformed pre-push update record: ${line}`,);
      const [localRef, localOid, remoteRef, advertisedRemoteOid,] = parts;
      if ((localRef === undefined) || (localOid === undefined)
        || (remoteRef === undefined) || (advertisedRemoteOid === undefined))
        throw new ManualPushProbeError(`Incomplete pre-push update record: ${line}`,);
      return {
        localRef,
        localOid,
        remoteLocation: capture.remoteLocation,
        remoteName: capture.remoteName,
        advertisedRemoteOid,
        remoteRef,
      };
    },);
}

/**
 * Parses authoritative `git ls-remote --refs` output.
 *
 * @param output - exact command stdout
 *
 * @returns remote ref to object-ID map
 */
function parseRemoteRefs(output: string,): ReadonlyMap<string, string> {
  return new Map(output.split('\n',)
    .filter(function isRecord(line,) {
      return line.length > 0;
    },)
    .map(function parseRecord(line,): readonly [string, string] {
      const separator = line.indexOf('\t',);
      if (separator === (-1))
        throw new ManualPushProbeError(`Malformed ls-remote record: ${line}`,);
      return [
        line.slice(separator + 1,),
        line.slice(0, separator,),
      ];
    },),);
}

/**
 * Resolves authoritative remote object IDs and validates negotiation freshness.
 *
 * @param gitPath - resolved real Git executable
 *
 * @param cwd - effective repository directory
 *
 * @param updates - Git-negotiated destination updates
 *
 * @returns public push updates
 */
async function resolveRemoteOids({
  gitPath,
  cwd,
  updates,
}: Readonly<{
  gitPath: string;
  cwd: string;
  updates: readonly ProbedPushUpdate[];
}>,): Promise<readonly PushUpdate[]> {
  const byLocation = Map.groupBy(updates, function remoteLocation(update,) {
    return update.remoteLocation;
  },);
  const resolvedGroups = await Promise.all([...byLocation.entries(),]
    .map(async function resolveLocation([remoteLocation, locationUpdates,],) {
      const result = await nanoSpawn(
        gitPath,
        [
          'ls-remote',
          '--refs',
          remoteLocation,
          ...locationUpdates.map(function remoteRef(update,) {
            return update.remoteRef;
          },),
        ],
        { cwd, },
      );
      const remoteRefs = parseRemoteRefs(result.stdout,);
      return locationUpdates.map(function publicUpdate(update,): PushUpdate {
        const authoritativeOid = remoteRefs.get(update.remoteRef,);
        const advertisedAbsent = isZeroOid(update.advertisedRemoteOid,);
        if ((authoritativeOid === undefined) !== advertisedAbsent)
          throw new ManualPushProbeError(`Remote ref changed during manual-push discovery: ${update.remoteRef}`,);
        if ((authoritativeOid !== undefined) && (authoritativeOid !== update.advertisedRemoteOid))
          throw new ManualPushProbeError(`Remote ref changed during manual-push discovery: ${update.remoteRef}`,);
        return {
          localOid: isZeroOid(update.localOid,) ? ABSENT_GIT_VALUE : update.localOid,
          remoteOid: authoritativeOid ?? ABSENT_GIT_VALUE,
          remoteName: update.remoteName,
          remoteRef: update.remoteRef,
        };
      },);
    },),);
  return resolvedGroups.flat();
}

/** Disposable private probe directory. */
type ProbeDirectory = Readonly<{
  /** Captured hook records directory. */
  captureDirectory: string;
  /** Private hooks directory. */
  hooksDirectory: string;
  /** Removes complete probe state. */
  [Symbol.asyncDispose]: () => Promise<void>;
}>;

/**
 * Creates disposable private hook and capture directories.
 *
 * @returns initialized private probe scope
 */
async function createProbeDirectory(): Promise<ProbeDirectory> {
  const directory = await mkdtemp(join(tmpdir(), 'cli-git-push-facts-',),);
  const hooksDirectory = join(directory, 'hooks',);
  const captureDirectory = join(directory, 'captures',);
  await Promise.all([
    mkdir(hooksDirectory,),
    mkdir(captureDirectory,),
  ],);
  return {
    hooksDirectory,
    captureDirectory,
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(directory, { recursive: true, force: true, },);
    },
  };
}

/**
 * Discovers exact updates Git would push without updating remote refs.
 *
 * @param gitPath - resolved real Git executable
 *
 * @param cwd - effective repository directory
 *
 * @param args - transformed push arguments
 *
 * @returns authoritative push updates
 *
 * @example
 * ```ts
 * await probeManualPushUpdates({ gitPath: '/usr/bin/git', cwd: '/repo', args: ['push', 'origin', 'main'] });
 * ```
 */
export async function probeManualPushUpdates({
  gitPath,
  cwd,
  args,
}: Readonly<{
  gitPath: string;
  cwd: string;
  args: readonly string[];
}>,): Promise<readonly PushUpdate[]> {
  await using directory = await createProbeDirectory();
  const hookPath = join(directory.hooksDirectory, 'pre-push',);
    await writeFile(hookPath, hookSource(), { mode: 0o700, },);
    await chmod(hookPath, 0o700,);
    let probeFailure: unknown;
    try {
      await nanoSpawn(
        gitPath,
        [...probeArgs({ args, hooksDirectory: directory.hooksDirectory, }),],
        {
          cwd,
          env: { [CAPTURE_DIRECTORY_ENV]: directory.captureDirectory, },
        },
      );
    }
    catch (error: unknown) {
      probeFailure = error;
    }
    const captureFiles = (await readdir(directory.captureDirectory,))
      .filter(function isCapture(path,) {
        return path.endsWith('.json',);
      },);
    if (captureFiles.length === 0) {
      const detail = probeFailure instanceof SubprocessError
        ? probeFailure.stderr
        : String(probeFailure,);
      throw new ManualPushProbeError(`Git could not determine push updates: ${detail}`, { cause: probeFailure, },);
    }
    const captures = await Promise.all(captureFiles.map(async function readCapture(path,) {
      const parsed: unknown = JSON.parse(await readFile(join(directory.captureDirectory, path,), 'utf8',),);
      if (!isHookCapture(parsed,))
        throw new ManualPushProbeError(`Invalid pre-push capture: ${path}`,);
      return parsed;
    },),);
    const updates = captures.flatMap(parseCapture,);
    return await resolveRemoteOids({ gitPath, cwd, updates, },);
}
