/**
 Plans dependent manifest bumps from any source of workspace files.

 The cli-git policy reads files through policy facts and the changesets job reads the worktree;
 both hand this module the same reader shape so the ripple rules live in one place.

 @module
 */
import {
  type PlannedBump,
  planDependentBumps,
  transitiveDependentNames,
  type WorkspaceManifest,
} from './dependent-version-bump.ts';
import {
  type ManifestDependencyFacts,
  readManifestDependencyFacts,
  replaceManifestVersion,
} from './manifest-text.ts';
import { readPublishableNames, } from './publishable-names.ts';
import {
  importsPackage,
  isNonTestSourcePath,
} from './source-imports.ts';

//region Reader

/**
 Git pathspec selecting every workspace package manifest.
 */
export const MANIFEST_PATHSPEC = ':(glob)package/*/*/package.json';

/**
 One workspace manifest as a reader supplies it.
 */
export type WorkspaceManifestFile = Readonly<{
  /**
   Repository-relative manifest path.
   */
  path: string;
  /**
   Current manifest text.
   */
  text: string;
  /**
   Manifest text at the comparison base, absent when the base lacks the manifest.
   */
  baseText?: string;
}>;

/**
 One source file as a reader supplies it.
 */
export type WorkspaceSourceFile = Readonly<{
  /**
   Repository-relative path.
   */
  path: string;
  /**
   Loads the current text.
   */
  text: () => Promise<string>;
}>;

/**
 Workspace file access the ripple needs.
 */
export type WorkspaceFileReader = Readonly<{
  /**
   Lists every workspace manifest with its current and base text.
   */
  manifests: () => Promise<readonly WorkspaceManifestFile[]>;
  /**
   Lists files under one package's `src/` directory.
   */
  sourceFiles: (directory: string) => Promise<readonly WorkspaceSourceFile[]>;
  /**
   Reads the generated pnpr config, or nothing when it is absent.
   */
  pnprConfigText: () => Promise<readonly string[]>;
}>;

//endregion Reader

//region Plan

/**
 Manifest facts the plan works from.
 */
type ManifestState = Readonly<{
  /**
   Reader-supplied file.
   */
  file: WorkspaceManifestFile;
  /**
   Repository-relative package directory.
   */
  directory: string;
  /**
   Current dependency facts.
   */
  current: ManifestDependencyFacts;
  /**
   Version at the comparison base, absent for a new manifest or one without a version there.
   */
  baseVersion?: string;
}>;

/**
 One dependent bump with the manifest text change that performs it.
 */
export type ManifestBump = PlannedBump & Readonly<{
  /**
   Repository-relative manifest path.
   */
  path: string;
  /**
   Current manifest text.
   */
  text: string;
  /**
   Manifest text with the bumped version.
   */
  replacement: string;
}>;

/**
 Outcome of planning a ripple.
 */
export type WorkspaceBumpPlan = Readonly<{
  /**
   Packages whose version already differs from the base.
   */
  bumpedNames: readonly string[];
  /**
   Dependent bumps to apply, sorted by package name.
   */
  bumps: readonly ManifestBump[];
}>;

/**
 Parses current and base facts for one manifest.

 @param file - reader-supplied manifest

 @returns manifest state

 @throws ManifestShapeError when either text is malformed
 */
function readManifestState(file: WorkspaceManifestFile,): ManifestState {
  /**
   Version at the base.
   */
  const baseVersion = file.baseText === undefined
    ? undefined
    : readManifestDependencyFacts({
      path: file.path,
      text: file.baseText,
    },).version;
  return {
    file,
    directory: file.path.slice(
      0,
      -'/package.json'.length,
    ),
    current: readManifestDependencyFacts({
      path: file.path,
      text: file.text,
    },),
    ...(baseVersion === undefined ? {} : { baseVersion, }),
  };
}

/**
 Decides which development dependencies each dependent bundles, scanning only edges that can reach a bumped package.

 @param reader - workspace file access

 @param states - every manifest state

 @param bumpedNames - packages already bumped

 @returns confirmed bundled development dependency names by dependent name

 @example
 ```ts
 await bundledDevelopmentEdges({ reader, states, bumpedNames: ['@scope/b'] });
 ```
 */
async function bundledDevelopmentEdges({
  reader,
  states,
  bumpedNames,
}: Readonly<{
  reader: WorkspaceFileReader;
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
   Confirmed edges per dependent that needed a scan.
   */
  const confirmed = await Promise.all(states.map(async function scanDependent(state,): Promise<readonly [
    string,
    readonly string[],
  ]> {
    /**
     Development dependencies that could carry a bump.
     */
    const candidateEdges = state.current.devDependencyNames.filter(function isRelevant(name,): boolean {
      return relevant.has(name,) && (name !== state.current.name);
    },);
    if ((!superset.has(state.current.name,)) || (candidateEdges.length === 0))
      return [
        state.current.name,
        [],
      ];
    /**
     Texts of the dependent's non-test source files.
     */
    const texts = await Promise.all((await reader.sourceFiles(state.directory,))
      .filter(function isSource(file,): boolean {
      return isNonTestSourcePath({
        directory: state.directory,
        path: file.path,
      },);
    },)
      .map(function loadText(file,): Promise<string> {
      return file.text();
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

/**
 Plans patch bumps for publishable dependents of packages whose version differs from the base.

 @param reader - workspace file access

 @returns already-bumped names and the dependent bumps with their manifest text changes

 @throws UnsupportedVersionError when a dependent needing a bump has a non-release version

 @throws ManifestShapeError when a manifest is malformed

 @example
 ```ts
 await planWorkspaceBumps(reader);
 ```
 */
export async function planWorkspaceBumps(reader: WorkspaceFileReader,): Promise<WorkspaceBumpPlan> {
  /**
   Every manifest with current and base facts.
   */
  const states = (await reader.manifests()).map(readManifestState,);
  /**
   Packages whose version differs from the base.
   */
  const bumpedNames = states
    .filter(function isBumped(state,): boolean {
    return (state.baseVersion !== undefined) && (state.current.version !== state.baseVersion);
  },)
    .map(function toName(state,): string {
    return state.current.name;
  },);
  /**
   Generated config, when present.
   */
  const [configText,] = bumpedNames.length === 0 ? [] : await reader.pnprConfigText();
  if (configText === undefined)
    return {
      bumpedNames,
      bumps: [],
    };
  /**
   Confirmed bundled development edges.
   */
  const bundled = await bundledDevelopmentEdges({
    reader,
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
  return {
    bumpedNames,
    bumps: planDependentBumps({
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
      publishableNames: readPublishableNames(configText,),
    },)
      .flatMap(function withText(bump,): readonly ManifestBump[] {
      /**
       Manifest state for the dependent.
       */
      const state = byName.get(bump.name,);
      return state === undefined
        ? []
        : [{
          ...bump,
          path: state.file.path,
          text: state.file.text,
          replacement: replaceManifestVersion({
            path: state.file.path,
            text: state.file.text,
            from: bump.from,
            to: bump.to,
          },),
        },];
    },),
  };
}

//endregion Plan
