/**
 Fixture files as the incumbent planner reads them: the release task's reader and a fake policy context.

 The release reader follows `bump-dependents-worktree.ts`: lenient UTF-8 that keeps a byte-order mark.
 The policy context is shaped like the incumbent unit tests' `contextOf`; its reader is the policy's own.
 Pathspecs are matched literally, so a directory name holding glob magic is refused instead of modelled.
 */
// The bin scripts sit outside the package tsconfig's include list; this reference loads the Node types.
/// <reference types="node" />
import { ABSENT_GIT_VALUE } from '@monochromatic-dev/git-policy-repository/ts';

/** @typedef {import('./dependent-version-types.mjs').WorkspaceInput} WorkspaceInput */
/** @typedef {import('./dependent-version-types.mjs').SharedWorkspace} SharedWorkspace */
/** @typedef {import('@monochromatic-dev/git-policy-repository/ts').WorkspaceFileReader} WorkspaceFileReader */
/** @typedef {import('@monochromatic-dev/git-policy-repository/ts').RepositoryPolicyContext} PolicyContext */
/** @typedef {import('@monochromatic-dev/git-policy-repository/ts').RepositoryTrackedFile} TrackedFile */
/** @typedef {import('@monochromatic-dev/git-policy-repository/ts').RepositoryCandidateFile} CandidateFile */

/**
 A decoded fixture file.

 @typedef {{ path: string, mode: CandidateFile['mode'], current: Uint8Array | undefined, base: Uint8Array | undefined }}
   DecodedFile
 */

/** A case the harness cannot evaluate; never a planner result. */
export class HarnessError extends Error {
  name = 'HarnessError';
}

/** Glob characters a `:(glob)` pathspec would read as magic. */
const globMagic = [
  '*',
  '?',
  '[',
  '\\',
];

/** The pathspec prefix of glob magic. */
const globPrefix = ':(glob)';

/** The suffix of a recursive directory pathspec. */
const recursiveSuffix = '/**';

/** The registry configuration path. */
const configPath = 'package/config/pnpr/config.yaml';

/** The manifest pathspec. */
const manifestPathspec = ':(glob)package/*/*/package.json';

/** Length of a SHA-1 object name, for fake revisions. */
const revisionLength = 40;

/**
 Lower-case hexadecimal of UTF-8 text or bytes.

 @param {string | Uint8Array} value - text, encoded as UTF-8, or bytes
 @returns {string} hexadecimal digits
 */
export function toHex(value) {
  return Buffer.from(value)
    .toString('hex');
}

/**
 UTF-8 text of hexadecimal bytes, with replacement characters for bytes that are not UTF-8.

 @param {string} hex - hexadecimal digits
 @returns {string} text
 */
export function hexText(hex) {
  return Buffer.from(
    hex,
    'hex',
  )
    .toString('utf8');
}

/**
 Bytes of hexadecimal digits.

 @param {string} hex - hexadecimal digits
 @returns {Uint8Array} bytes
 */
function fromHex(hex) {
  return new Uint8Array(Buffer.from(
    hex,
    'hex',
  ));
}

/**
 Whether a repository path matches one of the pathspecs the planner asks for.

 @param {{ pathspec: string, path: string }} request - pathspec and repository path
 @returns {boolean} whether Git would list the path
 */
function matchesPathspec({
  pathspec,
  path
}) {
  if (!pathspec.startsWith(globPrefix))
    return pathspec === path;
  const pattern = pathspec.slice(globPrefix.length);
  if (pattern.endsWith(recursiveSuffix)) {
    const prefix = pattern.slice(
      0,
      1 - recursiveSuffix.length,
    );
    if (globMagic.some(function isMagic(character) {
      return prefix.includes(character);
    }))
      throw new HarnessError(`pathspec ${pathspec} holds glob magic the fake context does not model`);
    return path.startsWith(prefix) && (path.length > prefix.length);
  }
  const patternSegments = pattern.split('/');
  const pathSegments = path.split('/');
  return (patternSegments.length === pathSegments.length)
    && patternSegments.every(function segmentMatches(
      segment,
      index
    ) {
      return segment === '*' ? pathSegments[index] !== '' : segment === pathSegments[index];
    });
}

/**
 One decoded fixture file.

 @param {import('./dependent-version-types.mjs').FixtureFile} file - fixture file
 @returns {DecodedFile} decoded file
 */
function decoded(file) {
  const current = file.current === null ? undefined : fromHex(file.current);
  return {
    path: hexText(file.path),
    mode: candidateMode(file.mode),
    current,
    base: file.base === null ? undefined : (file.base === true ? current : fromHex(file.base)),
  };
}

/** Shared workspaces already decoded, so concurrent cases hold one copy. */
/** @type {WeakMap<object, DecodedFile[]>} */
const decodedShared = new WeakMap();

/**
 Decoded fixture files of a workspace case: shared files first, then the case's own files replacing by path.

 @param {{ input: WorkspaceInput, shared: SharedWorkspace }} request - case input and shared workspace loader
 @returns {DecodedFile[]} files
 */
export function workspaceFiles({
  input,
  shared
}) {
  const sharedFiles = input.workspace === null ? [] : shared(input.workspace);
  /** @type {DecodedFile[] | undefined} */
  const cached = decodedShared.get(sharedFiles);
  const base = cached ?? sharedFiles.map(decoded);
  decodedShared.set(
    sharedFiles,
    base
  );
  /** @type {Map<string, DecodedFile>} */
  const files = new Map(base.map(function entry(file) {
    return [
      file.path,
      file
    ];
  }));
  for (const file of input.files
    .map(decoded))
    files.set(
      file.path,
      file
    );
  return [...files.values()];
}

/**
 Current bytes of a file, failing loudly for one the harness did not provide.

 @param {DecodedFile} file - fixture file
 @returns {Uint8Array} bytes
 */
function provided(file) {
  if (file.current === undefined)
    throw new HarnessError(`${file.path} was read but not provided`);
  return file.current;
}

/**
 Lenient UTF-8 text that keeps a byte-order mark, as `readFile(path, 'utf8')` reads it.

 @param {Uint8Array} bytes - file bytes
 @returns {string} text
 */
function lenient(bytes) {
  return Buffer.from(bytes)
    .toString('utf8');
}

/**
 The release task's reader over fixture files.

 @param {DecodedFile[]} files - workspace files
 @returns {WorkspaceFileReader} reader
 */
export function taskReader(files) {
  return {
    manifests: function listManifests() {
      return Promise.resolve(files
        .filter(function isManifest(file) {
          return matchesPathspec({
            pathspec: manifestPathspec,
            path: file.path,
          });
        })
        .map(function toManifest(file) {
          return {
            path: file.path,
            text: lenient(provided(file)),
            ...(file.base === undefined ? {} : { baseText: lenient(file.base) }),
          };
        }));
    },
    sourceFiles: function listSources(directory) {
      return Promise.resolve(files
        .filter(function isSource(file) {
          return matchesPathspec({
            pathspec: `${globPrefix}${directory}/src/**`,
            path: file.path,
          });
        })
        .map(function toSource(file) {
          return {
            path: file.path,
            text: function loadText() {
              return Promise.resolve(
                lenient(provided(file)),
              );
            },
          };
        }));
    },
    pnprConfigText: function readConfig() {
      return Promise.resolve(files
        .filter(function isConfig(file) {
          return file.path === configPath;
        })
        .map(function toText(file) {
          return lenient(provided(file));
        }));
    },
  };
}

/**
 A tracked file of the fake context.

 @param {DecodedFile} file - fixture file
 @returns {TrackedFile} tracked file
 */
function trackedFile(file) {
  return {
    targetId: `tracked:${file.path}`,
    path: file.path,
    revision: 'a'.repeat(revisionLength),
    mode: file.mode,
    headRevision: file.base === undefined ? ABSENT_GIT_VALUE : 'b'.repeat(revisionLength),
    bytes: function currentBytes() {
      return Promise.resolve(provided(file));
    },
    headBytes: function baseBytes() {
      return Promise.resolve(file.base ?? ABSENT_GIT_VALUE);
    },
  };
}

/**
 The bytes of a fake candidate, which the policy never reads.

 @returns {Promise<Uint8Array>} no bytes
 */
function noBytes() {
  return Promise.resolve(new Uint8Array());
}

/**
 The fake context's `HEAD`.

 @returns {Promise<string>} a fixed name
 */
function headOid() {
  return Promise.resolve('head');
}

/**
 The fake context's landed commit, which a pre-commit lifecycle lacks.

 @returns {Promise<typeof ABSENT_GIT_VALUE>} absence
 */
function landedCommitOid() {
  return Promise.resolve(ABSENT_GIT_VALUE);
}

/**
 The fake context's push updates, which a commit lifecycle lacks.

 @returns {Promise<[]>} none
 */
function pushUpdates() {
  return Promise.resolve([]);
}

/** Git file modes a fixture may name. */
const candidateModes = /** @type {const} */ ([
  'regular',
  'executable',
  'symlink',
  'submodule'
]);

/**
 A fixture mode as a candidate mode.

 @param {string} mode - fixture mode
 @returns {CandidateFile['mode']} candidate mode
 */
function candidateMode(mode) {
  const found = candidateModes.find(function same(candidate) {
    return candidate === mode;
  });
  if (found === undefined)
    throw new HarnessError(`unknown mode ${mode}`);
  return found;
}

/** Changes a fixture candidate may name. */
const candidateChanges = /** @type {const} */ ([
  'added',
  'modified',
  'deleted'
]);

/**
 A fixture change as a candidate change.

 @param {string} change - fixture change
 @returns {CandidateFile['change']} candidate change
 */
function candidateChange(change) {
  const found = candidateChanges.find(function same(candidate) {
    return candidate === change;
  });
  if (found === undefined)
    throw new HarnessError(`unknown change ${change}`);
  return found;
}

/** Lifecycle points a fixture may name. */
const policyTriggers = /** @type {const} */ ([
  'pre-forward',
  'post-commit',
  'manual-push',
  'direct-check',
  'direct-fix'
]);

/**
 A fixture trigger as a policy trigger.

 @param {string} trigger - fixture trigger
 @returns {PolicyContext['trigger']} policy trigger
 */
function policyTrigger(trigger) {
  const found = policyTriggers.find(function same(candidate) {
    return candidate === trigger;
  });
  if (found === undefined)
    throw new HarnessError(`unknown trigger ${trigger}`);
  return found;
}

/**
 A fake policy context over fixture files, shaped like the incumbent unit tests' `contextOf`.

 @param {{ input: WorkspaceInput, files: DecodedFile[] }} request - case input and workspace files
 @returns {PolicyContext} policy context
 */
export function policyContext({
  input,
  files
}) {
  const subcommand = input.forwardsCommit ? 'commit' : (input.trigger === 'pre-forward' ? 'add' : 'cli-git');
  const tracked = files.map(trackedFile);
  return {
    candidateVersion: 0,
    canApplyPatches: true,
    trigger: policyTrigger(input.trigger),
    command: {
      rawArgs: [subcommand],
      transformedArgs: [subcommand],
      subcommand,
      effectiveCwd: '/repo',
      repositoryRoot: '/repo',
      escapedPolicyIds: new Set(),
    },
    git: {
      candidates: function candidates() {
        return Promise.resolve(input.candidates
          .map(function toCandidate(candidate) {
          const path = hexText(candidate.path);
          return {
            targetId: `pre-commit:${path}`,
            path,
            revision: ABSENT_GIT_VALUE,
            mode: 'regular',
            change: candidateChange(candidate.change),
            bytes: noBytes,
          };
        }));
      },
      trackedFiles: function trackedFiles({ pathspecs }) {
        return Promise.resolve(tracked.filter(function matchesAny(file) {
          return pathspecs.some(function matches(pathspec) {
            return matchesPathspec({
              pathspec,
              path: file.path,
            });
          });
        }));
      },
      headOid,
      landedCommitOid,
      pushUpdates,
    },
    signal: new AbortController().signal,
  };
}
