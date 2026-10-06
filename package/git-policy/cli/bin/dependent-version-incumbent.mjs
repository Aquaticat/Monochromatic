/**
 Evaluate one differential case with the incumbent TypeScript planner and render the canonical result
 the native test renders from the Rust planner.

 The planner is imported from `@monochromatic-dev/git-policy-repository/ts`, its TypeScript source, unchanged.
 A workspace case runs twice over the same content:
 the plan through `planWorkspaceBumps` with the release task's reader semantics
 (`bump-dependents-worktree.ts`: lenient UTF-8, a byte-order mark kept),
 and the policy through `findDependentBumps` over a fake policy context like the unit tests' `contextOf`,
 whose reader is the policy's own (strict UTF-8, a byte-order mark stripped).
 */
// The bin scripts sit outside the package tsconfig's include list; this reference loads the Node types.
/// <reference types="node" />
import {
  ABSENT_GIT_VALUE,
  findDependentBumps,
  importsPackage,
  isNonTestSourcePath,
  ManifestShapeError,
  patchBumpVersion,
  planDependentBumps,
  planWorkspaceBumps,
  readManifestDependencyFacts,
  readPublishableNames,
  replaceManifestVersion,
  UnsupportedVersionError,
} from '@monochromatic-dev/git-policy-repository/ts';

/** A case the harness cannot evaluate; never a planner result. */
export class HarnessError extends Error {
  name = 'HarnessError';
}

/** Glob characters a `:(glob)` pathspec would read as magic; the fake context matches paths literally. */
const globMagic = ['*', '?', '[', '\\'];

/**
 Lower-case hexadecimal of UTF-8 text or bytes.

 @param {string | Uint8Array} value - text, encoded as UTF-8, or bytes
 @returns {string} hexadecimal digits
 */
export function toHex(value) {
  return Buffer.from(typeof value === 'string' ? Buffer.from(value, 'utf8') : value).toString('hex');
}

/**
 Bytes of a hexadecimal fixture string.

 @param {string} hex - lower-case hexadecimal digits
 @returns {Uint8Array} bytes
 */
function fromHex(hex) {
  return new Uint8Array(Buffer.from(hex, 'hex'));
}

/**
 Whether a repository path matches one of the pathspecs the planner asks for.

 @param {string} pathspec - `:(glob)` pathspec or literal path
 @param {string} path - repository path
 @returns {boolean} whether Git would list the path
 */
function matchesPathspec(pathspec, path) {
  if (!pathspec.startsWith(':(glob)'))
    return pathspec === path;
  const pattern = pathspec.slice(':(glob)'.length);
  if (pattern.endsWith('/**')) {
    const prefix = pattern.slice(0, -'**'.length);
    if (globMagic.some(character => prefix.includes(character)))
      throw new HarnessError(`pathspec ${pathspec} holds glob magic the fake context does not model`);
    return path.startsWith(prefix) && path.length > prefix.length;
  }
  const patternSegments = pattern.split('/');
  const pathSegments = path.split('/');
  return patternSegments.length === pathSegments.length
    && patternSegments.every((segment, index) => segment === '*' ? pathSegments[index] !== '' : segment === pathSegments[index]);
}

/**
 The canonical failure of a thrown error.

 @param {unknown} error - what the planner threw
 @returns {{ kind: 'failed', error: string, detail: string }} failure class and, for shape problems, the message
 */
function failed(error) {
  if (error instanceof ManifestShapeError)
    return { kind: 'failed', error: 'shape', detail: error.message };
  if (error instanceof SyntaxError)
    return { kind: 'failed', error: 'syntax', detail: '' };
  if ((error instanceof TypeError) && /encoded data was not valid/u.test(error.message))
    return { kind: 'failed', error: 'decode', detail: '' };
  return { kind: 'failed', error: 'other', detail: String(error) };
}

/**
 Original and replacement bytes of a full-content patch, read back from its unified diff.

 @param {Uint8Array} bytes - patch bytes from `createFullContentPatch`
 @returns {{ original: string, replacement: string }} hexadecimal file contents before and after
 */
function patchContents(bytes) {
  const lines = Buffer.from(bytes).toString('utf8').split('\n');
  const header = /^@@ -1,(\d+) \+1,(\d+) @@$/u.exec(lines[4] ?? '');
  if (header === null)
    throw new HarnessError(`unexpected patch header ${lines[4]}`);
  let cursor = 5;
  /** @param {number} count @param {string} sign */
  const side = (count, sign) => {
    const taken = lines.slice(cursor, cursor + count);
    if (taken.some(line => !line.startsWith(sign)))
      throw new HarnessError('patch side is not uniform');
    cursor += count;
    const missingNewline = lines[cursor] === String.raw`\ No newline at end of file`;
    if (missingNewline)
      cursor += 1;
    return `${taken.map(line => line.slice(1)).join('\n')}${missingNewline ? '' : '\n'}`;
  };
  const original = side(Number(header[1]), '-');
  const replacement = side(Number(header[2]), '+');
  return { original: toHex(original), replacement: toHex(replacement) };
}

/**
 Decoded fixture files of a workspace case, shared files first, then the case's own files replacing by path.

 @param {any} input - workspace case input
 @param {(name: string) => any[]} shared - shared workspace loader
 @returns {{ path: string, mode: string, current: Uint8Array | undefined, base: Uint8Array | undefined }[]} files
 */
function workspaceFiles(input, shared) {
  /** @type {Map<string, { path: string, mode: string, current: Uint8Array | undefined, base: Uint8Array | undefined }>} */
  const files = new Map();
  for (const file of [...(input.workspace === null ? [] : shared(input.workspace)), ...input.files]) {
    const path = Buffer.from(file.path, 'hex').toString('utf8');
    const current = file.current === null ? undefined : fromHex(file.current);
    const base = file.base === null ? undefined : (file.base === true ? current : fromHex(file.base));
    files.set(path, { path, mode: file.mode, current, base });
  }
  return [...files.values()];
}

/**
 Current bytes of a file, failing loudly for one the harness did not provide.

 @param {{ path: string, current: Uint8Array | undefined }} file - fixture file
 @returns {Uint8Array} bytes
 */
function provided(file) {
  if (file.current === undefined)
    throw new HarnessError(`${file.path} was read but not provided`);
  return file.current;
}

/**
 The release task's reader over fixture files: lenient UTF-8 that keeps a byte-order mark.

 @param {ReturnType<typeof workspaceFiles>} files - workspace files
 @returns {import('@monochromatic-dev/git-policy-repository/ts').WorkspaceFileReader} reader
 */
function taskReader(files) {
  const lenient = (/** @type {Uint8Array} */ bytes) => Buffer.from(bytes).toString('utf8');
  return {
    manifests: async () => files
      .filter(file => matchesPathspec(':(glob)package/*/*/package.json', file.path))
      .map(file => ({
        path: file.path,
        text: lenient(provided(file)),
        ...(file.base === undefined ? {} : { baseText: lenient(file.base) }),
      })),
    sourceFiles: async directory => files
      .filter(file => matchesPathspec(`:(glob)${directory}/src/**`, file.path))
      .map(file => ({ path: file.path, text: async () => lenient(provided(file)) })),
    pnprConfigText: async () => files
      .filter(file => file.path === 'package/config/pnpr/config.yaml')
      .map(file => lenient(provided(file))),
  };
}

/**
 A fake policy context over fixture files, shaped like the incumbent unit tests' `contextOf`.

 @param {any} input - workspace case input
 @param {ReturnType<typeof workspaceFiles>} files - workspace files
 @returns {any} policy context
 */
function policyContext(input, files) {
  const subcommand = input.forwardsCommit ? 'commit' : (input.trigger === 'pre-forward' ? 'add' : 'cli-git');
  const tracked = files.map(file => ({
    targetId: `tracked:${file.path}`,
    path: file.path,
    revision: 'a'.repeat(40),
    mode: file.mode,
    headRevision: file.base === undefined ? ABSENT_GIT_VALUE : 'b'.repeat(40),
    bytes: async () => provided(file),
    headBytes: async () => file.base ?? ABSENT_GIT_VALUE,
  }));
  return {
    candidateVersion: 0,
    canApplyPatches: true,
    trigger: input.trigger,
    command: {
      rawArgs: [subcommand],
      transformedArgs: [subcommand],
      subcommand,
      effectiveCwd: '/repo',
      repositoryRoot: '/repo',
      escapedPolicyIds: new Set(),
    },
    git: {
      candidates: async () => input.candidates.map((/** @type {any} */ candidate) => {
        const path = Buffer.from(candidate.path, 'hex').toString('utf8');
        return { targetId: `pre-commit:${path}`, path, revision: ABSENT_GIT_VALUE, mode: 'regular', change: candidate.change, bytes: async () => new Uint8Array() };
      }),
      trackedFiles: async (/** @type {{ pathspecs: readonly string[] }} */ { pathspecs }) => tracked
        .filter(file => pathspecs.some(pathspec => matchesPathspec(pathspec, file.path))),
      headOid: async () => 'head',
      landedCommitOid: async () => ABSENT_GIT_VALUE,
      pushUpdates: async () => [],
    },
    signal: new AbortController().signal,
  };
}

/**
 The canonical plan and policy results of a workspace case.

 @param {any} input - workspace case input
 @param {(name: string) => any[]} shared - shared workspace loader
 @returns {Promise<object>} canonical result
 */
async function workspaceCase(input, shared) {
  const files = workspaceFiles(input, shared);
  /** @type {object} */
  let plan;
  try {
    const planned = await planWorkspaceBumps(taskReader(files));
    plan = {
      kind: 'planned',
      bumpedNames: planned.bumpedNames,
      bumps: planned.bumps.map(bump => ({
        name: bump.name,
        directory: toHex(bump.directory),
        from: bump.from,
        to: bump.to,
        path: toHex(bump.path),
        original: toHex(bump.text),
        replacement: toHex(bump.replacement),
      })),
    };
  } catch (error) {
    plan = error instanceof UnsupportedVersionError ? { kind: 'unsupported', message: error.message } : failed(error);
  }
  /** @type {object} */
  let policy;
  try {
    const findings = await findDependentBumps(policyContext(input, files));
    policy = {
      kind: 'findings',
      findings: findings.map(finding => ({
        code: finding.code,
        message: finding.message,
        path: finding.path === undefined ? null : toHex(finding.path),
        patch: finding.patch === undefined ? null : { path: toHex(finding.patch.path), ...patchContents(finding.patch.bytes) },
      })),
    };
  } catch (error) {
    policy = failed(error);
  }
  return { plan, policy };
}

/**
 Run a function that may throw an unsupported version.

 @param {() => object} run - evaluation
 @returns {object} its result, or the unsupported message
 */
function orUnsupported(run) {
  try {
    return run();
  } catch (error) {
    if (error instanceof UnsupportedVersionError)
      return { kind: 'unsupported', message: error.message };
    throw error;
  }
}

/**
 Run a function that may throw a planner failure.

 @param {() => object} run - evaluation
 @returns {object} its result, or the canonical failure
 */
function orFailed(run) {
  try {
    return run();
  } catch (error) {
    return failed(error);
  }
}

/**
 Evaluate one case of any kind with the incumbent.

 @param {any} testCase - case with `kind` and `input`
 @param {(name: string) => any[]} shared - shared workspace loader
 @returns {Promise<object>} canonical result
 */
export async function evaluateIncumbent(testCase, shared) {
  const { input } = testCase;
  switch (testCase.kind) {
    case 'workspace':
      return workspaceCase(input, shared);
    case 'patchBumpVersion':
      return orUnsupported(() => ({ kind: 'ok', value: patchBumpVersion(input) }));
    case 'planDependentBumps':
      return orUnsupported(() => ({
        kind: 'bumps',
        value: planDependentBumps({
          ...input,
          manifests: input.manifests.map((/** @type {any} */ manifest) => ({
            name: manifest.name,
            directory: manifest.directory,
            ...(manifest.version === null ? {} : { version: manifest.version }),
            edgeNames: manifest.edgeNames,
          })),
        }),
      }));
    case 'readManifestDependencyFacts':
      return orFailed(() => {
        const facts = readManifestDependencyFacts(input);
        return { kind: 'facts', name: facts.name, version: facts.version ?? null, runtime: facts.runtimeDependencyNames, dev: facts.devDependencyNames };
      });
    case 'replaceManifestVersion':
      return orFailed(() => ({ kind: 'ok', value: replaceManifestVersion(input) }));
    case 'importsPackage':
      return { kind: 'bool', value: importsPackage(input) };
    case 'isNonTestSourcePath':
      return { kind: 'bool', value: isNonTestSourcePath(input) };
    case 'readPublishableNames':
      return { kind: 'names', value: readPublishableNames(input.configText) };
    default:
      throw new HarnessError(`unknown case kind ${testCase.kind}`);
  }
}
