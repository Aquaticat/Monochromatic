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
import {
  lstat,
  readlink,
} from 'node:fs/promises';
import { join, } from 'node:path';
import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { PolicyInput, } from '../api/policy-input-types.ts';
import { runShadowGit, } from '../shadow-repository/shadow-refs.ts';
import { runTransactionGit, } from './commit-transaction-git.ts';
import {
  type ExecutableLocation,
  executableFingerprint,
  fileDigest,
} from './policy-input-executable.ts';
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
export type FingerprintLocation = ExecutableLocation & Readonly<{
  /**
   Real Git executable.
   */
  gitPath: string;
  /**
   Shadow repository whose `HEAD` is the commit's parent, where `revision` inputs resolve.
   */
  shadowPath: string;
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
    return JSON.stringify([
      input.kind,
      ...input.pathspecs,
    ],);
  if (input.kind === 'executable')
    return JSON.stringify([
      input.kind,
      input.path,
    ],);
  if (input.kind === 'revision')
    return JSON.stringify([
      input.kind,
      input.rev,
    ],);
  return JSON.stringify([
    input.kind,
    input.name,
  ],);
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
      return [
        path,
        'symlink',
        await readlink(absolute,),
      ];
    if (stats.isFile())
      return [
        path,
        'file',
        await fileDigest(absolute,),
      ];
    return [
      path,
      'other',
    ];
  }
  catch (error: unknown) {
    if (Error.isError(error,) && ('code' in error)
      && (error.code === 'ENOENT'))
      return [
        path,
        'missing',
      ];
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
  revisions: readonly Readonly<{
    kind: 'revision';
    rev: string
  }>[];
}>,): Promise<readonly (readonly [
  string,
  InputFingerprint
])[]> {
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
    return revisions.map(function fingerprintOf(
      input,
      index,
    ): readonly [
      string,
      InputFingerprint
    ] {
      return [
        policyInputKey(input,),
        JSON.stringify([lines[index] ?? '',],),
      ];
    },);
  }
  catch (error: unknown) {
    l.debug(`revision inputs cannot be fingerprinted, so their policies re-run: ${caughtValueText(error,)}`,);
    return revisions.map(function unavailable(input,): readonly [
      string,
      InputFingerprint
    ] {
      return [
        policyInputKey(input,),
        FINGERPRINT_UNAVAILABLE,
      ];
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
    ...new Map(inputs.map(function keyed(input,): readonly [
      string,
      PolicyInput
    ] {
      return [
        policyInputKey(input,),
        input,
      ];
    },),)
      .values(),
  ];
  /**
   Revision fingerprints, resolved together.
   */
  const revisions = await revisionFingerprints({
    location,
    revisions: distinct.flatMap(function revisionOf(input,): readonly Readonly<{
      kind: 'revision';
      rev: string
    }>[] {
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
    map: async function fingerprintOne({ value: input, },): Promise<readonly [
      string,
      InputFingerprint
    ]> {
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
  return new Map([
    ...revisions,
    ...others,
  ],);
}
