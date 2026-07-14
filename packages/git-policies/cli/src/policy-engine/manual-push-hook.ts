/**
 * Private pre-push hook probe for Git-resolved update mappings.
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
import nanoSpawn from 'nano-spawn';
import { parseGlobalOptions, } from '../parse-global-options.ts';
import {
  ManualPushProbeError,
  type ProbedPushUpdate,
} from './manual-push-probe-types.ts';

/**
 * Binary kibibyte size.
 */
const KIBIBYTE = 1_024;
/**
 * Binary mebibyte size.
 */
const MEBIBYTE = KIBIBYTE * KIBIBYTE;
/**
 * Maximum pre-push hook input accepted from one remote.
 */
const MAX_HOOK_INPUT_BYTES = 16 * MEBIBYTE;
/**
 * Number of fields in documented pre-push record.
 */
const PRE_PUSH_FIELD_COUNT = 4;
/**
 * Private executable hook mode.
 */
const PRIVATE_HOOK_MODE = 0o700;
/**
 * Environment variable carrying private capture directory.
 */
const CAPTURE_DIRECTORY_ENV = 'CLI_GIT_PUSH_FACTS_DIRECTORY';
/**
 * Serialized capture emitted by private pre-push hook.
 */
type HookCapture = Readonly<{
  /**
   * Raw pre-push stdin.
   */
  input: string;
  /**
   * Destination location argument.
   */
  remoteLocation: string;
  /**
   * Destination name argument.
   */
  remoteName: string;
}>;

/**
 * Disposable private probe directory.
 */
type ProbeDirectory = {
  /**
   * Captured hook records directory.
   */
  readonly captureDirectory: string;
  /**
   * Private hooks directory.
   */
  readonly hooksDirectory: string;
  /**
   * Removes complete probe state.
   */
  readonly [Symbol.asyncDispose]: () => Promise<void>;
};

/**
 * Creates disposable private hook and capture directories.
 *
 * @returns initialized private probe scope
 */
async function createProbeDirectory(): Promise<ProbeDirectory> {
  /**
   * Private root directory.
   */
  const directory = await mkdtemp(join(
    tmpdir(),
    'cli-git-push-facts-',
  ),);
  /**
   * Hook path override directory.
   */
  const hooksDirectory = join(
    directory,
    'hooks',
  );
  /**
   * Per-remote hook capture directory.
   */
  const captureDirectory = join(
    directory,
    'captures',
  );
  await Promise.all([
    mkdir(hooksDirectory,),
    mkdir(captureDirectory,),
  ],);
  return {
    hooksDirectory,
    captureDirectory,
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(
        directory,
        {
          recursive: true,
          force: true,
        },
      );
    },
  };
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
  /**
   * Parsed global command location.
   */
  const layout = parseGlobalOptions(args,);
  /**
   * Arguments following push subcommand.
   */
  const postSubcommand = args.slice(layout.subcommandIndex + 1,);
  /**
   * User's explicit option terminator.
   */
  const separatorIndex = postSubcommand.indexOf('--',);
  /**
   * Last option position that remains interpreted by Git.
   */
  const insertionIndex = separatorIndex === (-1)
    ? postSubcommand.length
    : separatorIndex;
  return [
    ...args.slice(
      0,
      layout.subcommandIndex,
    ),
    '-c',
    `core.hooksPath=${hooksDirectory}`,
    'push',
    ...postSubcommand.slice(
      0,
      insertionIndex,
    ),
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
  if (process.execPath
    .includes('\n',)
    || process.execPath
    .includes('\r',))
    throw new ManualPushProbeError('Node executable path cannot be represented in hook shebang.',);
  return `#!${process.execPath}
const { readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const directory = process.env.${CAPTURE_DIRECTORY_ENV};
if (directory === undefined) throw new Error('Missing push-facts capture directory.');
const input = readFileSync(0);
if (input.byteLength > ${String(MAX_HOOK_INPUT_BYTES)}) throw new Error('Pre-push input exceeded capture limit.');
const capture = { remoteName: process.argv[2], remoteLocation: process.argv[3], input: input.toString('utf8') };
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
  return capture.input
    .split('\n',)
    .filter(function isRecord(line,) {
      return line.length > 0;
    },)
    .map(function parseRecord(line,): ProbedPushUpdate {
      /**
       * Space-delimited fields guaranteed by Git ref grammar.
       */
      const parts = line.split(' ',);
      if (parts.length !== PRE_PUSH_FIELD_COUNT)
        throw new ManualPushProbeError(`Malformed pre-push update record: ${line}`,);
      /**
       * Required fields in documented order.
       */
      const [localRef, localOid, remoteRef, advertisedRemoteOid,] = parts;
      if ((localRef === undefined) || (localOid === undefined)
        || (remoteRef === undefined)
        || (advertisedRemoteOid === undefined))
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
 * Runs private dry-run probe while retaining expected Git failure details.
 *
 * @returns success sentinel or thrown probe value
 */
async function runProbe({
  gitPath,
  cwd,
  args,
  directory,
}: Readonly<{
  gitPath: string;
  cwd: string;
  args: readonly string[];
  directory: ProbeDirectory;
}>,): Promise<unknown> {
  try {
    await nanoSpawn(
      gitPath,
      [...probeArgs({
        args,
        hooksDirectory: directory.hooksDirectory,
      },),],
      {
        cwd,
        env: { [CAPTURE_DIRECTORY_ENV]: directory.captureDirectory, },
      },
    );
    return undefined;
  }
  catch (error: unknown) {
    return error;
  }
}

/**
 * Reads and validates one hook capture.
 *
 * @param directory - capture directory
 *
 * @param path - capture filename
 *
 * @returns validated capture
 */
async function readCapture({
  directory,
  path,
}: Readonly<{
  directory: string;
  path: string;
}>,): Promise<HookCapture> {
  /**
   * Parsed untrusted capture JSON.
   */
  const parsed: unknown = JSON.parse(await readFile(
    join(
      directory,
      path,
    ),
    'utf8',
  ),);
  if (!isHookCapture(parsed,))
    throw new ManualPushProbeError(`Invalid pre-push capture: ${path}`,);
  return parsed;
}

/**
 * Captures exact updates Git would push without updating remote refs.
 *
 * @param gitPath - resolved real Git executable
 *
 * @param cwd - effective repository directory
 *
 * @param args - transformed push arguments
 *
 * @returns Git-negotiated push updates
 *
 * @example
 * ```ts
 * await captureProbedPushUpdates({ gitPath: '/usr/bin/git', cwd: '/repo', args: ['push', 'origin', 'main'] });
 * ```
 */
export async function captureProbedPushUpdates({
  gitPath,
  cwd,
  args,
}: Readonly<{
  gitPath: string;
  cwd: string;
  args: readonly string[];
}>,): Promise<readonly ProbedPushUpdate[]> {
  /**
   * Disposable private hook scope.
   */
  await using directory = await createProbeDirectory();
  /**
   * Executable private pre-push hook.
   */
  const hookPath = join(
    directory.hooksDirectory,
    'pre-push',
  );
  await writeFile(
    hookPath,
    hookSource(),
    { mode: PRIVATE_HOOK_MODE, },
  );
  await chmod(
    hookPath,
    PRIVATE_HOOK_MODE,
  );
  /**
   * Probe result retained because Git may exit after hook still supplied facts.
   */
  const probeResult = await runProbe({
    gitPath,
    cwd,
    args,
    directory,
  },);
  /**
   * Capture files emitted once per destination remote.
   */
  const captureFiles = (await readdir(directory.captureDirectory,))
    .filter(function isCapture(path,) {
      return path.endsWith('.json',);
    },);
  if (captureFiles.length === 0) {
    throw new ManualPushProbeError(
      `Git could not determine push updates: ${String(probeResult,)}`,
      { cause: probeResult, },
    );
  }
  /**
   * Validated per-remote captures.
   */
  const captures = await Promise.all(captureFiles.map(function loadCapture(path,) {
    return readCapture({
      directory: directory.captureDirectory,
      path,
    },);
  },),);
  return captures.flatMap(parseCapture,);
}
