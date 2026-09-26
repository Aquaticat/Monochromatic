/**
 Fingerprints of declared external policy inputs.

 A fingerprint is taken once before preparation's first policy pass
 and again before each revalidation,
 for the union of every enabled declared input,
 so a policy re-runs when anything it declared changed in between.
 Process count per snapshot is bounded:
 one `git ls-files` per distinct `worktree` input,
 one `git cat-file --batch-check` for every `revision` input,
 and none for `executable` and `env` inputs.
 A fingerprint that cannot be taken never matches,
 so its policy re-runs.

 @module
 */
import { createHash, } from 'node:crypto';
import { createReadStream, } from 'node:fs';
import {
  access,
  constants,
  lstat,
  readlink,
  realpath,
  stat,
} from 'node:fs/promises';
import {
  delimiter,
  isAbsolute,
  join,
  resolve,
  sep,
} from 'node:path';
import { pipeline, } from 'node:stream/promises';
import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { PolicyInput, } from '../api/policy-input-types.ts';
import { runShadowGit, } from '../shadow-repository/shadow-refs.ts';
import { runTransactionGit, } from './commit-transaction-git.ts';
import { mapBounded, } from './map-bounded.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Strict Git output decoder.
 */
const DECODER = new TextDecoder(
  'utf-8',
  { fatal: true, },
);

/**
 UTF-8 encoder for `cat-file` input.
 */
const ENCODER = new TextEncoder();

/**
 Concurrent file hashes or Git processes of one snapshot.
 */
const FINGERPRINT_CONCURRENCY = 4;

/**
 Pathspec variables unset so declared pathspecs keep Git's default glob semantics.
 */
const PATHSPEC_MODE_VARIABLES: readonly string[] = [
  'GIT_LITERAL_PATHSPECS',
  'GIT_GLOB_PATHSPECS',
  'GIT_NOGLOB_PATHSPECS',
  'GIT_ICASE_PATHSPECS',
];

/**
 A fingerprint that could not be taken, which never matches.
 */
export const FINGERPRINT_UNAVAILABLE: unique symbol = Symbol('policy input fingerprint unavailable',);

/**
 One input's fingerprint.
 */
export type InputFingerprint = string | typeof FINGERPRINT_UNAVAILABLE;

/**
 Fingerprints by {@link policyInputKey}.
 */
export type InputFingerprints = ReadonlyMap<string, InputFingerprint>;

/**
 Where fingerprints are taken.
 */
export type FingerprintLocation = Readonly<{
  /**
   Real Git executable.
   */
  gitPath: string;
  /**
   Worktree root, which `worktree` pathspecs and relative `executable` paths resolve from.
   */
  repositoryRoot: string;
  /**
   Shadow repository whose `HEAD` is the commit's parent, where `revision` inputs resolve.
   */
  shadowPath: string;
  /**
   Environment `env` inputs and `PATH` lookup read.
   */
  environment: NodeJS.ProcessEnv;
}>;

/**
 Stable key of one input.

 @param input - declared input

 @returns key equal for equal inputs

 @example
 ```ts
 policyInputKey({ kind: 'env', name: 'PATH' }); // '["env","PATH"]'
 ```
 */
export function policyInputKey(input: PolicyInput,): string {
  if (input.kind === 'worktree')
    return JSON.stringify([input.kind, ...input.pathspecs,],);
  if (input.kind === 'executable')
    return JSON.stringify([input.kind, input.path,],);
  if (input.kind === 'revision')
    return JSON.stringify([input.kind, input.rev,],);
  return JSON.stringify([input.kind, input.name,],);
}

/**
 SHA-256 of a file's bytes, streamed.

 @param path - file

 @returns hex digest

 @example
 ```ts
 await fileDigest('/usr/bin/git');
 ```
 */
async function fileDigest(path: string,): Promise<string> {
  /**
   Streaming hash.
   */
  const hash = createHash('sha256',);
  await pipeline(
    createReadStream(path,),
    hash,
  );
  return hash.digest('hex',);
}

/**
 Identity fields of a no-follow or followed stat.

 @param path - file

 @param follow - whether to follow a final symbolic link

 @returns device, inode, size, and modification time in nanoseconds

 @example
 ```ts
 await statIdentity({ path: '/usr/bin/git', follow: false });
 ```
 */
async function statIdentity({
  path,
  follow,
}: Readonly<{
  path: string;
  follow: boolean;
}>,): Promise<readonly string[]> {
  /**
   Exact stat.
   */
  const stats = follow
    ? await stat(
      path,
      { bigint: true, },
    )
    : await lstat(
      path,
      { bigint: true, },
    );
  return [
    String(stats.dev,),
    String(stats.ino,),
    String(stats.size,),
    String(stats.mtimeNs,),
  ];
}

/**
 Fingerprint of one worktree path.

 @param root - worktree root

 @param path - repository path

 @returns path with its content digest, link target, or absence

 @example
 ```ts
 await worktreePathFingerprint({ root: '/repo', path: 'rules.txt' });
 ```
 */
async function worktreePathFingerprint({
  root,
  path,
}: Readonly<{
  root: string;
  path: string;
}>,): Promise<readonly string[]> {
  /**
   Absolute path.
   */
  const absolute = join(
    root,
    path,
  );
  try {
    /**
     No-follow file type.
     */
    const stats = await lstat(absolute,);
    if (stats.isSymbolicLink())
      return [path, 'symlink', await readlink(absolute,),];
    if (stats.isFile())
      return [path, 'file', await fileDigest(absolute,),];
    return [path, 'other',];
  }
  catch (error: unknown) {
    if (Error.isError(error,) && ('code' in error) && (error.code === 'ENOENT'))
      return [path, 'missing',];
    throw error;
  }
}

/**
 Fingerprint of a `worktree` input:
 every tracked or untracked path,
 ignored or not,
 the pathspecs match,
 with each file's digest.

 @param location - where fingerprints are taken

 @param pathspecs - declared pathspecs

 @returns serialized fingerprint

 @example
 ```ts
 await worktreeFingerprint({ location, pathspecs: ['rules.txt'] });
 ```
 */
async function worktreeFingerprint({
  location,
  pathspecs,
}: Readonly<{
  location: FingerprintLocation;
  pathspecs: readonly string[];
}>,): Promise<string> {
  /**
   Matching paths, deduplicated across unmerged stages and sorted.
   */
  const paths = [
    ...new Set(DECODER.decode((await runTransactionGit({
      gitPath: location.gitPath,
      cwd: location.repositoryRoot,
      args: [
        'ls-files',
        '-z',
        '--cached',
        '--others',
        '--',
        ...pathspecs,
      ],
      unsetEnvironment: PATHSPEC_MODE_VARIABLES,
    },)).stdout,)
      .split('\0',)
      .filter(function nonempty(path,): boolean {
        return path.length > 0;
      },),),
  ].toSorted();
  return JSON.stringify(await mapBounded({
    values: paths,
    concurrency: FINGERPRINT_CONCURRENCY,
    map: async function fingerprintPath({ value, },): Promise<readonly string[]> {
      return await worktreePathFingerprint({
        root: location.repositoryRoot,
        path: value,
      },);
    },
  },),);
}

/**
 Whether a path is an executable regular file, following links as `execvp` does.

 @param path - candidate

 @returns whether it can be executed

 @example
 ```ts
 await isExecutableFile('/usr/bin/git'); // true
 ```
 */
async function isExecutableFile(path: string,): Promise<boolean> {
  try {
    await access(
      path,
      constants.X_OK,
    );
    return (await stat(path,)).isFile();
  }
  catch (error: unknown) {
    l.debug(`${path} is not an executable file: ${caughtValueText(error,)}`,);
    return false;
  }
}

/**
 Resolves an `executable` input the way a spawn from the worktree root resolves its command.

 @param location - where fingerprints are taken

 @param path - declared path or name

 @returns resolved path, or undefined when no executable file exists there

 @example
 ```ts
 await resolveExecutable({ location, path: 'git' });
 ```
 */
async function resolveExecutable({
  location,
  path,
}: Readonly<{
  location: FingerprintLocation;
  path: string;
}>,): Promise<string | undefined> {
  if (isAbsolute(path,) || path.includes('/',) || path.includes(sep,))
    return resolve(
      location.repositoryRoot,
      path,
    );
  /**
   `PATH` candidates in lookup order; an empty entry names the working directory.
   */
  const candidates = (location.environment
    .PATH ?? '').split(delimiter,)
    .map(function candidate(directory,): string {
      return resolve(
        location.repositoryRoot,
        directory,
        path,
      );
    },);
  /**
   Whether each candidate is executable, checked concurrently and read in lookup order.
   */
  const executable = await Promise.all(candidates.map(isExecutableFile,),);
  return candidates.find(function firstExecutable(_candidate, index,): boolean {
    return executable[index] === true;
  },);
}

/**
 Fingerprint of an `executable` input:
 the resolved path with its no-follow identity,
 the final target with its identity,
 and the target's digest.

 @param location - where fingerprints are taken

 @param path - declared path or name

 @returns serialized fingerprint

 @example
 ```ts
 await executableFingerprint({ location, path: 'git' });
 ```
 */
async function executableFingerprint({
  location,
  path,
}: Readonly<{
  location: FingerprintLocation;
  path: string;
}>,): Promise<string> {
  /**
   Resolved path.
   */
  const resolved = await resolveExecutable({
    location,
    path,
  },);
  if ((resolved === undefined) || (!(await isExecutableFile(resolved,))))
    return JSON.stringify(['missing', resolved ?? '',],);
  /**
   Final target of every link.
   */
  const target = await realpath(resolved,);
  /**
   Identity and content, read concurrently.
   */
  const [link, targetIdentity, digest,] = await Promise.all([
    statIdentity({
      path: resolved,
      follow: false,
    },),
    statIdentity({
      path: target,
      follow: true,
    },),
    fileDigest(target,),
  ],);
  return JSON.stringify([resolved, link, target, targetIdentity, digest,],);
}

/**
 Resolves every `revision` input in one `git cat-file --batch-check` in the shadow.

 @param location - where fingerprints are taken

 @param revisions - revision inputs

 @returns fingerprint by key: the object ID, or Git's `missing` or `ambiguous` line; every one unavailable when Git fails

 @example
 ```ts
 await revisionFingerprints({ location, revisions: [{ kind: 'revision', rev: 'HEAD' }] });
 ```
 */
async function revisionFingerprints({
  location,
  revisions,
}: Readonly<{
  location: FingerprintLocation;
  revisions: readonly Readonly<{ kind: 'revision'; rev: string; }>[];
}>,): Promise<readonly (readonly [string, InputFingerprint])[]> {
  if (revisions.length === 0)
    return [];
  try {
    /**
     One output line per input line.
     */
    const lines = DECODER.decode((await runShadowGit({
      gitPath: location.gitPath,
      shadowPath: location.shadowPath,
      args: [
        'cat-file',
        '--batch-check=%(objectname)',
      ],
      input: ENCODER.encode(`${revisions.map(function revOf(input,): string {
        return input.rev;
      },)
        .join('\n',)}\n`,),
    },)).stdout,)
      .split('\n',);
    return revisions.map(function fingerprintOf(input, index,): readonly [string, InputFingerprint] {
      return [policyInputKey(input,), JSON.stringify([lines[index] ?? '',],),];
    },);
  }
  catch (error: unknown) {
    l.debug(`revision inputs cannot be fingerprinted, so their policies re-run: ${caughtValueText(error,)}`,);
    return revisions.map(function unavailable(input,): readonly [string, InputFingerprint] {
      return [policyInputKey(input,), FINGERPRINT_UNAVAILABLE,];
    },);
  }
}

/**
 Settles one fingerprint, logging and marking a failure unavailable.

 @param input - input being fingerprinted

 @param take - takes the fingerprint

 @returns fingerprint, or {@link FINGERPRINT_UNAVAILABLE}

 @example
 ```ts
 await settle({ input, take: () => worktreeFingerprint({ location, pathspecs }) });
 ```
 */
async function settle({
  input,
  take,
}: Readonly<{
  input: PolicyInput;
  take: () => Promise<string>;
}>,): Promise<InputFingerprint> {
  try {
    return await take();
  }
  catch (error: unknown) {
    l.debug(`input ${policyInputKey(input,)} cannot be fingerprinted, so its policies re-run: ${caughtValueText(error,)}`,);
    return FINGERPRINT_UNAVAILABLE;
  }
}

/**
 Fingerprints every distinct input.

 @param location - where fingerprints are taken

 @param inputs - declared inputs, possibly repeated

 @returns fingerprints by {@link policyInputKey}

 @example
 ```ts
 await fingerprintPolicyInputs({ location, inputs: [{ kind: 'env', name: 'PATH' }] });
 ```
 */
export async function fingerprintPolicyInputs({
  location,
  inputs,
}: Readonly<{
  location: FingerprintLocation;
  inputs: readonly PolicyInput[];
}>,): Promise<InputFingerprints> {
  /**
   Tagged snapshot logger.
   */
  const rl = tagged({
    tag: fingerprintPolicyInputs.name,
    l,
  },);
  /**
   Distinct inputs by key.
   */
  const distinct = [
    ...new Map(inputs.map(function keyed(input,): readonly [string, PolicyInput] {
      return [policyInputKey(input,), input,];
    },),)
      .values(),
  ];
  /**
   Revision fingerprints, resolved together.
   */
  const revisions = await revisionFingerprints({
    location,
    revisions: distinct.flatMap(function revisionOf(input,): readonly Readonly<{ kind: 'revision'; rev: string; }>[] {
      return input.kind === 'revision' ? [input,] : [];
    },),
  },);
  /**
   Fingerprints of the other kinds.
   */
  const others = await mapBounded({
    values: distinct.filter(function notRevision(input,): boolean {
      return input.kind !== 'revision';
    },),
    concurrency: FINGERPRINT_CONCURRENCY,
    map: async function fingerprintOne({ value: input, },): Promise<readonly [string, InputFingerprint]> {
      return [
        policyInputKey(input,),
        await settle({
          input,
          take: async function take(): Promise<string> {
            if (input.kind === 'env')
              return JSON.stringify([location.environment[input.name] ?? null,],);
            if (input.kind === 'worktree')
              return await worktreeFingerprint({
                location,
                pathspecs: input.pathspecs,
              },);
            if (input.kind === 'executable')
              return await executableFingerprint({
                location,
                path: input.path,
              },);
            throw new TypeError(`Unexpected input kind ${input.kind}`,);
          },
        },),
      ];
    },
  },);
  rl.debug(`fingerprinted ${String(distinct.length,)} policy inputs`,);
  return new Map([...revisions, ...others,],);
}
