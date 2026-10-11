/**
 Evaluate one differential case with the incumbent TypeScript planner and render the canonical result the native
 test renders from the Rust planner.

 The planner is imported from `@monochromatic-dev/git-policy-repository/ts`, its TypeScript source, unchanged.
 A workspace case runs the plan through `planWorkspaceBumps` with the release task's reader
 and the policy through `findDependentBumps` over a fake policy context.
 */
// The bin scripts sit outside the package tsconfig's include list; this reference loads the Node types.
/// <reference types="node" />
import {
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

import {
  HarnessError,
  policyContext,
  taskReader,
  toHex,
  workspaceFiles,
} from './dependent-version-incumbent-reader.mjs';

/** @typedef {import('./dependent-version-types.mjs').DifferentialCase} DifferentialCase */
/** @typedef {import('./dependent-version-types.mjs').CaseResult} CaseResult */
/** @typedef {import('./dependent-version-types.mjs').FailedResult} FailedResult */
/** @typedef {import('./dependent-version-types.mjs').PlanResult} PlanResult */
/** @typedef {import('./dependent-version-types.mjs').PolicyResult} PolicyResult */
/** @typedef {import('./dependent-version-types.mjs').SharedWorkspace} SharedWorkspace */
/** @typedef {import('./dependent-version-types.mjs').WorkspaceInput} WorkspaceInput */
/** @typedef {import('./dependent-version-types.mjs').WorkspaceResult} WorkspaceResult */

/** The message `TextDecoder` throws for bytes a fatal decoder refuses. */
const decodeMessage = 'encoded data was not valid';

/** The marker Git writes after a line without a final newline. */
const noNewline = String.raw`\ No newline at end of file`;

/** Index of the hunk header among the patch lines. */
const hunkHeaderLine = 4;

/** Text before the counts of the hunk header. */
const hunkHeaderStart = '@@ -1,';

/**
 The canonical failure of a thrown error.

 @param {unknown} error - what the planner threw
 @returns {FailedResult} failure class and, for shape problems, the message
 */
function failed(error) {
  if (error instanceof ManifestShapeError)
    return {
      kind: 'failed',
      error: 'shape',
      detail: error.message,
    };
  if (error instanceof SyntaxError)
    return {
      kind: 'failed',
      error: 'syntax',
      detail: '',
    };
  if ((error instanceof TypeError)
    && error.message
    .includes(decodeMessage))
    return {
      kind: 'failed',
      error: 'decode',
      detail: '',
    };
  return {
    kind: 'failed',
    error: 'other',
    detail: String(error),
  };
}

/**
 One side of a full-content patch: the content of `count` lines with `sign`, and the cursor after them.

 @param {{ lines: readonly string[], cursor: number, count: number, sign: string }} request - patch lines and position
 @returns {{ text: string, cursor: number }} content and next position
 */
function patchSide({
  lines,
  cursor,
  count,
  sign
}) {
  const taken = lines.slice(
    cursor,
    cursor + count,
  );
  if (taken.some(function differentSign(line) {
    return !line.startsWith(sign);
  }))
    throw new HarnessError('patch side is not uniform');
  const missingNewline = lines[cursor + count] === noNewline;
  const content = taken.map(function strip(line) {
    return line.slice(sign.length);
  })
    .join('\n');
  return {
    text: missingNewline ? content : `${content}\n`,
    cursor: cursor + count
      + (missingNewline ? 1 : 0),
  };
}

/**
 Original and replacement bytes of a full-content patch, read back from its unified diff.

 @param {Uint8Array} bytes - patch bytes from `createFullContentPatch`
 @returns {{ original: string, replacement: string }} hexadecimal file contents before and after
 */
function patchContents(bytes) {
  const lines = Buffer.from(bytes)
    .toString('utf8')
    .split('\n');
  const header = lines[hunkHeaderLine] ?? '';
  const counts = header.slice(
    hunkHeaderStart.length,
    -' @@'.length,
  )
    .split(' +1,');
  if ((!header.startsWith(hunkHeaderStart)) || (counts.length !== 2))
    throw new HarnessError(`unexpected patch header ${header}`);
  const original = patchSide({
    lines,
    cursor: hunkHeaderLine + 1,
    count: Number(counts[0]),
    sign: '-',
  });
  const replacement = patchSide({
    lines,
    cursor: original.cursor,
    count: Number(counts[1]),
    sign: '+',
  });
  return {
    original: toHex(original.text),
    replacement: toHex(replacement.text),
  };
}

/**
 The canonical plan result of the release task's reader.

 @param {import('@monochromatic-dev/git-policy-repository/ts').WorkspaceFileReader} reader - workspace reader
 @returns {Promise<PlanResult>} plan result
 */
async function planResult(reader) {
  try {
    const planned = await planWorkspaceBumps(reader);
    return {
      kind: 'planned',
      bumpedNames: [...planned.bumpedNames],
      bumps: planned.bumps
        .map(function toBump(bump) {
        return {
          name: bump.name,
          directory: toHex(bump.directory),
          from: bump.from,
          to: bump.to,
          path: toHex(bump.path),
          original: toHex(bump.text),
          replacement: toHex(bump.replacement),
        };
      }),
    };
  } catch (error) {
    if (error instanceof UnsupportedVersionError)
      return {
        kind: 'unsupported',
        message: error.message,
      };
    return failed(error);
  }
}

/**
 The canonical policy result over a fake policy context.

 @param {import('@monochromatic-dev/git-policy-repository/ts').RepositoryPolicyContext} context - policy context
 @returns {Promise<PolicyResult>} policy result
 */
async function policyResult(context) {
  try {
    const findings = await findDependentBumps(context);
    return {
      kind: 'findings',
      findings: findings.map(function toFinding(finding) {
        return {
          code: finding.code,
          message: finding.message,
          path: finding.path === undefined ? null : toHex(finding.path),
          patch: finding.patch === undefined
            ? null
            : {
              path: toHex(finding.patch
                .path),
              ...patchContents(finding.patch
                .bytes),
            },
        };
      }),
    };
  } catch (error) {
    return failed(error);
  }
}

/**
 The canonical plan and policy results of a workspace case.

 @param {{ input: WorkspaceInput, shared: SharedWorkspace }} request - case input and shared workspace loader
 @returns {Promise<WorkspaceResult>} canonical result
 */
async function workspaceCase({
  input,
  shared
}) {
  const files = workspaceFiles({
    input,
    shared,
  });
  return {
    plan: await planResult(taskReader(files)),
    policy: await policyResult(policyContext({
      input,
      files,
    })),
  };
}

/**
 Run an evaluation that may throw an incumbent error, rendering the error canonically.

 @param {() => CaseResult} run - evaluation
 @returns {CaseResult} its result, the unsupported message, or the canonical failure
 */
function guarded(run) {
  try {
    return run();
  } catch (error) {
    if (error instanceof UnsupportedVersionError)
      return {
        kind: 'unsupported',
        message: error.message,
      };
    return failed(error);
  }
}

/**
 Evaluate a function-level case with the incumbent.

 @param {Exclude<DifferentialCase, { kind: 'workspace' }>} testCase - case
 @returns {CaseResult} canonical result
 */
function functionCase(testCase) {
  return guarded(function evaluate() {
    if (testCase.kind === 'patchBumpVersion')
      return {
        kind: 'ok',
        value: patchBumpVersion(testCase.input),
      };
    if (testCase.kind === 'planDependentBumps')
      return {
        kind: 'bumps',
        value: [
          ...planDependentBumps({
            ...testCase.input,
            manifests: testCase.input
              .manifests
              .map(function toManifest(manifest) {
              return {
                name: manifest.name,
                directory: manifest.directory,
                ...(manifest.version === null ? {} : { version: manifest.version }),
                edgeNames: manifest.edgeNames,
              };
            }),
          }),
        ],
      };
    if (testCase.kind === 'readManifestDependencyFacts') {
      const facts = readManifestDependencyFacts(testCase.input);
      return {
        kind: 'facts',
        name: facts.name,
        version: facts.version ?? null,
        runtime: facts.runtimeDependencyNames,
        dev: facts.devDependencyNames,
      };
    }
    if (testCase.kind === 'replaceManifestVersion')
      return {
        kind: 'ok',
        value: replaceManifestVersion(testCase.input),
      };
    if (testCase.kind === 'importsPackage')
      return {
        kind: 'bool',
        value: importsPackage(testCase.input),
      };
    if (testCase.kind === 'isNonTestSourcePath')
      return {
        kind: 'bool',
        value: isNonTestSourcePath(testCase.input),
      };
    return {
      kind: 'names',
      value: readPublishableNames(testCase.input
        .configText),
    };
  });
}

/**
 Evaluate one case of any kind with the incumbent.

 @param {{ testCase: DifferentialCase, shared: SharedWorkspace }} request - case and shared workspace loader
 @returns {Promise<CaseResult>} canonical result
 */
export function evaluateIncumbent({
  testCase,
  shared
}) {
  if (testCase.kind === 'workspace')
    return workspaceCase({
      input: testCase.input,
      shared,
    });
  return Promise.resolve(functionCase(testCase));
}
