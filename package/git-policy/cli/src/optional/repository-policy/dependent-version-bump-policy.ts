// Generated from `package/git-policy/repository/src/dependent-version-bump-policy.ts` by file-enforcer; edit canonical source owner.
/**
 cli-git policy that patch-bumps publishable dependents of a hand-bumped workspace package in the same commit.

 Decision: `doc/decision/private-npm-registry.md` ("Versions change only by manual bumps").

 @module
 */
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import {
  ABSENT_GIT_VALUE,
  definePolicy,
  type PolicyContext,
  type PolicyDefinition,
  type PolicyFinding,
  type TrackedFile,
} from '../../api/index.ts';
import { createFullContentPatch, } from '../markdown-lint/index.ts';

import {
  MANIFEST_PATHSPEC,
  planWorkspaceBumps,
  type WorkspaceFileReader,
  type WorkspaceManifestFile,
} from './dependent-bump-workflow.ts';
import { UnsupportedVersionError, } from './dependent-version-bump.ts';
import { PNPR_CONFIG_PATH, } from './publishable-names.ts';

//region Policy facts reader

/**
 Number of path segments in `package/<category>/<name>/package.json`.
 */
const MANIFEST_PATH_SEGMENTS = 4;

/**
 Strict UTF-8 decoder; manifests and configs that fail to decode are malformed.
 */
const DECODER = new TextDecoder(
  'utf-8',
  { fatal: true, },
);

/**
 Lenient decoder for source files, which only need import scanning.
 */
const SOURCE_DECODER = new TextDecoder();

/**
 Replacement text encoder.
 */
const ENCODER = new TextEncoder();

/**
 Reports whether a repository path is a workspace package manifest.

 @param path - repository path

 @returns whether the path is `package/<category>/<name>/package.json`

 @example
 ```ts
 isWorkspaceManifestPath('package/module/a/package.json');
 // => true
 ```
 */
function isWorkspaceManifestPath(path: string,): boolean {
  /**
   Slash-separated segments.
   */
  const segments = path.split('/',);
  return (segments.length === MANIFEST_PATH_SEGMENTS) && (segments[0] === 'package')
    && (segments[MANIFEST_PATH_SEGMENTS - 1] === 'package.json');
}

/**
 Reads a tracked manifest's current and `HEAD` text.

 @param file - tracked manifest

 @returns reader manifest
 */
async function manifestFileOf(file: TrackedFile,): Promise<WorkspaceManifestFile> {
  /**
   `HEAD` bytes, or absence for a new manifest.
   */
  const headBytes = await file.headBytes();
  return {
    path: file.path,
    text: DECODER.decode(await file.bytes(),),
    ...(headBytes === ABSENT_GIT_VALUE ? {} : { baseText: DECODER.decode(headBytes,), }),
  };
}

/**
 Builds a workspace reader over policy facts, keeping tracked manifests for patch targets.

 @param context - policy context

 @param trackedManifests - receives every tracked manifest by path

 @returns reader comparing the current candidate state with `HEAD`

 @mutates trackedManifests - fills it when manifests are listed.
 */
function policyReader({
  context,
  trackedManifests,
}: Readonly<{
  context: ForeignBorrowed<PolicyContext>;
  trackedManifests: Map<string, TrackedFile>;
}>,): WorkspaceFileReader {
  return {
    manifests: async function listManifests() {
      /**
       Tracked manifests in the current candidate state.
       */
      const files = await context.git
        .trackedFiles({ pathspecs: [MANIFEST_PATHSPEC,], },);
      files.forEach(function remember(file,) {
        trackedManifests.set(
          file.path,
          file,
        );
      },);
      return Promise.all(files.map(manifestFileOf,),);
    },
    sourceFiles: async function listSources(directory,) {
      return (await context.git
        .trackedFiles({ pathspecs: [`:(glob)${directory}/src/**`,], },))
        .map(function toSource(file,) {
        return {
          path: file.path,
          text: async function loadText() {
            return SOURCE_DECODER.decode(await file.bytes(),);
          },
        };
      },);
    },
    pnprConfigText: async function readConfig() {
      /**
       Generated config, when tracked.
       */
      const [config,] = await context.git
        .trackedFiles({ pathspecs: [PNPR_CONFIG_PATH,], },);
      return config === undefined ? [] : [DECODER.decode(await config.bytes(),),];
    },
  };
}

//endregion Policy facts reader

//region Policy

/**
 Finding code for a dependent whose version must move with a bumped dependency.
 */
export const DEPENDENT_VERSION_STALE_CODE = 'dependent-version-stale';

/**
 Finding code for a dependent whose version cannot be patch-bumped automatically.
 */
export const DEPENDENT_VERSION_UNSUPPORTED_CODE = 'dependent-version-unsupported';

/**
 Finds publishable dependents of hand-bumped manifests and proposes their patch bumps.

 @param context - policy context exposing candidates and tracked files

 @returns one finding per dependent, with a patch when the bump is automatic

 @throws ManifestShapeError when a workspace manifest is malformed

 @example
 ```ts
 await findDependentBumps(context);
 ```
 */
export async function findDependentBumps(context: ForeignBorrowed<PolicyContext>,): Promise<readonly PolicyFinding[]> {
  // Ordinary commits touch no manifest, so they skip listing every manifest.
  if (!(await context.git
    .candidates()).some(function isModifiedManifest(candidate,): boolean {
    return (candidate.change === 'modified') && isWorkspaceManifestPath(candidate.path,);
  },))
    return [];
  /**
   Tracked manifests by path, filled while planning.
   */
  const trackedManifests = new Map<string, TrackedFile>();
  try {
    /**
     Planned ripple for the current candidate state.
     */
    const plan = await planWorkspaceBumps(policyReader({
      context,
      trackedManifests,
    },),);
    return plan.bumps
      .flatMap(function toFinding(bump,): readonly PolicyFinding[] {
      /**
       Tracked manifest the patch targets.
       */
      const file = trackedManifests.get(bump.path,);
      if ((file === undefined) || ((file.mode !== 'regular') && (file.mode !== 'executable')))
        return [];
      return [{
        code: DEPENDENT_VERSION_STALE_CODE,
        message: `${bump.name} reaches a package bumped in this commit (${plan.bumpedNames
          .join(', ',)}); bump it from ${bump.from} to ${bump.to} in the same commit.`,
        path: file.path,
        patch: createFullContentPatch({
          targetId: file.targetId,
          path: file.path,
          revision: file.revision,
          mode: file.mode,
          original: ENCODER.encode(bump.text,),
          replacement: ENCODER.encode(bump.replacement,),
        },),
      },];
    },);
  }
  catch (error: unknown) {
    if (!(error instanceof UnsupportedVersionError))
      throw error;
    return [{
      code: DEPENDENT_VERSION_UNSUPPORTED_CODE,
      message: error.message,
    },];
  }
}

/**
 Patch-bumps publishable workspace packages that depend on a package bumped in the same commit.

 @example
 ```ts
 dependentVersionBump.name;
 // => 'dependent-version-bump'
 ```
 */
export const dependentVersionBump: PolicyDefinition<undefined, 'dependent-version-bump'> = definePolicy({
  name: 'dependent-version-bump',
  defaultSeverity: 'error',
  warnSafe: false,
  triggers: [
    'pre-forward',
    'direct-check',
  ],
  /**
   Proposes dependent bumps for the current candidate state.

   @param context - Policy context exposing candidates and tracked files.

   @returns findings with version patches.
   */
  check({ context, }: {
    readonly context: ForeignBorrowed<PolicyContext>;
  },): Promise<readonly PolicyFinding[]> {
    return findDependentBumps(context,);
  },
},);

//endregion Policy
