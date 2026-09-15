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
} from '@monochromatic-dev/git-policy-api/ts';
import { createFullContentPatch, } from '@monochromatic-dev/git-policy-markdown-lint/ts';

import {
  planDependentBumps,
  transitiveDependentNames,
  UnsupportedVersionError,
  type WorkspaceManifest,
} from './dependent-version-bump.ts';
import {
  type ManifestDependencyFacts,
  readManifestDependencyFacts,
  replaceManifestVersion,
} from './manifest-text.ts';
import {
  PNPR_CONFIG_PATH,
  readPublishableNames,
} from './publishable-names.ts';
import {
  importsPackage,
  isNonTestSourcePath,
} from './source-imports.ts';

//region Manifest state

/**
 Git pathspec selecting every workspace package manifest.
 */
const MANIFEST_PATHSPEC = ':(glob)package/*/*/package.json';

/**
 Number of path segments in `package/<category>/<name>/package.json`.
 */
const MANIFEST_PATH_SEGMENTS = 4;

/**
 Strict UTF-8 decoder; manifests and source that fail to decode are malformed.
 */
const DECODER = new TextDecoder(
  'utf-8',
  { fatal: true, },
);

/**
 Replacement text encoder.
 */
const ENCODER = new TextEncoder();

/**
 Current and `HEAD` facts for one workspace manifest.
 */
type ManifestState = Readonly<{
  /**
   Tracked manifest file.
   */
  file: TrackedFile;
  /**
   Repository-relative package directory.
   */
  directory: string;
  /**
   Current manifest text.
   */
  text: string;
  /**
   Current dependency facts.
   */
  current: ManifestDependencyFacts;
  /**
   Version at `HEAD`, absent for a manifest `HEAD` lacks or that declared no version there.
   */
  headVersion?: string;
}>;

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
 Reads current and `HEAD` facts for one manifest.

 @param file - tracked manifest

 @returns manifest state

 @throws ManifestShapeError when either version of the manifest is malformed
 */
async function readManifestState(file: TrackedFile,): Promise<ManifestState> {
  /**
   Current manifest text.
   */
  const text = DECODER.decode(await file.bytes(),);
  /**
   `HEAD` bytes, or absence for a new manifest.
   */
  const headBytes = await file.headBytes();
  /**
   `HEAD` facts, when `HEAD` has the manifest.
   */
  const head = headBytes === ABSENT_GIT_VALUE
    ? []
    : [readManifestDependencyFacts({
      path: file.path,
      text: DECODER.decode(headBytes,),
    },),];
  /**
   Version at `HEAD`.
   */
  const headVersion = head[0]?.version;
  return {
    file,
    directory: file.path.slice(
      0,
      -'/package.json'.length,
    ),
    text,
    current: readManifestDependencyFacts({
      path: file.path,
      text,
    },),
    ...(headVersion === undefined ? {} : { headVersion, }),
  };
}

//endregion Manifest state

//region Bundled development edges

/**
 Decides which development dependencies each dependent bundles, checking only edges that can reach a bumped package.

 @param context - policy context exposing tracked files

 @param states - every manifest state

 @param bumpedNames - packages bumped in this commit

 @returns confirmed bundled development dependency names by dependent name

 @example
 ```ts
 await bundledDevelopmentEdges({ context, states, bumpedNames: ['@scope/b'] });
 ```
 */
async function bundledDevelopmentEdges({
  context,
  states,
  bumpedNames,
}: Readonly<{
  context: ForeignBorrowed<PolicyContext>;
  states: readonly ManifestState[];
  bumpedNames: readonly string[];
}>,): Promise<ReadonlyMap<string, readonly string[]>> {
  /**
   Every package that could depend on a bumped package if all development dependencies were bundled.
   */
  const superset = transitiveDependentNames({
    manifests: states.map(function everyEdge(state,): WorkspaceManifest {
      return {
        name: state.current.name,
        directory: state.directory,
        edgeNames: [
          ...state.current.runtimeDependencyNames,
          ...state.current.devDependencyNames,
        ],
      };
    },),
    bumpedNames,
  },);
  /**
   Packages whose change can matter to a dependent.
   */
  const relevant = new Set([
    ...superset,
    ...bumpedNames,
  ],);
  /**
   Dependents with development edges to relevant packages, each with those candidate edges.
   */
  const toScan = states.flatMap(function scanTargets(state,) {
    /**
     Development dependencies that could carry a bump.
     */
    const candidateEdges = state.current.devDependencyNames
      .filter(function isRelevant(name,): boolean {
      return relevant.has(name,) && (name !== state.current.name);
    },);
    return superset.has(state.current.name,) && (candidateEdges.length > 0)
      ? [{
        state,
        candidateEdges,
      },]
      : [];
  },);
  /**
   Confirmed edges per dependent.
   */
  const confirmed = await Promise.all(toScan.map(async function scanDependent({
    state,
    candidateEdges,
  },): Promise<readonly [
    string,
    readonly string[],
  ]> {
    /**
     Non-test source files of the dependent.
     */
    const sources = (await context.git
      .trackedFiles({ pathspecs: [`:(glob)${state.directory}/src/**`,], },))
      .filter(function isSource(file,): boolean {
      return isNonTestSourcePath({
        directory: state.directory,
        path: file.path,
      },);
    },);
    /**
     Decoded source texts.
     */
    const texts = await Promise.all(sources.map(async function decodeSource(file,): Promise<string> {
      return new TextDecoder().decode(await file.bytes(),);
    },),);
    return [
      state.current.name,
      candidateEdges.filter(function isImported(name,): boolean {
        return texts.some(function importsEdge(sourceText,): boolean {
          return importsPackage({
            sourceText,
            packageName: name,
          },);
        },);
      },),
    ];
  },),);
  return new Map(confirmed,);
}

//endregion Bundled development edges

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
  /**
   Candidate manifests that might carry a hand bump; checked first so ordinary commits stay cheap.
   */
  const changedManifests = (await context.git
    .candidates())
    .filter(function isModifiedManifest(candidate,): boolean {
    return (candidate.change === 'modified') && isWorkspaceManifestPath(candidate.path,);
  },);
  if (changedManifests.length === 0)
    return [];
  /**
   Every workspace manifest with current and `HEAD` facts.
   */
  const states = await Promise.all((await context.git
    .trackedFiles({ pathspecs: [MANIFEST_PATHSPEC,], },))
    .map(readManifestState,),);
  /**
   Packages whose version differs from `HEAD`.
   */
  const bumpedNames = states
    .filter(function isBumped(state,): boolean {
    return (state.headVersion !== undefined) && (state.current.version !== state.headVersion);
  },)
    .map(function toName(state,): string {
    return state.current.name;
  },);
  if (bumpedNames.length === 0)
    return [];
  /**
   Generated pnpr config holding the publish set.
   */
  const [config,] = await context.git
    .trackedFiles({ pathspecs: [PNPR_CONFIG_PATH,], },);
  if (config === undefined)
    return [];
  /**
   Packages the registry publishes.
   */
  const publishableNames = readPublishableNames(DECODER.decode(await config.bytes(),),);
  /**
   Confirmed bundled development edges.
   */
  const bundled = await bundledDevelopmentEdges({
    context,
    states,
    bumpedNames,
  },);
  /**
   Manifest states by package name.
   */
  const byName = new Map(states.map(function toEntry(state,) {
    return [
      state.current.name,
      state,
    ] as const;
  },),);
  try {
    return planDependentBumps({
      manifests: states.map(function toManifest(state,): WorkspaceManifest {
        return {
          name: state.current.name,
          directory: state.directory,
          ...(state.current.version === undefined ? {} : { version: state.current.version, }),
          edgeNames: [
            ...state.current.runtimeDependencyNames,
            ...(bundled.get(state.current.name,) ?? []),
          ],
        };
      },),
      bumpedNames,
      publishableNames,
    },)
      .flatMap(function toFinding(bump,): readonly PolicyFinding[] {
      /**
       Manifest state for the dependent.
       */
      const state = byName.get(bump.name,);
      if ((state === undefined) || ((state.file.mode !== 'regular') && (state.file.mode !== 'executable')))
        return [];
      return [{
        code: DEPENDENT_VERSION_STALE_CODE,
        message: `${bump.name} reaches a package bumped in this commit (${bumpedNames.join(', ',)}); bump it from ${bump.from} to ${bump.to} in the same commit.`,
        path: state.file.path,
        patch: createFullContentPatch({
          targetId: state.file.targetId,
          path: state.file.path,
          revision: state.file.revision,
          mode: state.file.mode,
          original: ENCODER.encode(state.text,),
          replacement: ENCODER.encode(replaceManifestVersion({
            path: state.file.path,
            text: state.text,
            from: bump.from,
            to: bump.to,
          },),),
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
  async check({ context, }: {
    readonly context: ForeignBorrowed<PolicyContext>;
  },): Promise<readonly PolicyFinding[]> {
    return findDependentBumps(context,);
  },
},);

//endregion Policy
