/**
 Plans patch bumps for workspace packages that depend on a hand-bumped package.

 Decision: `doc/decision/private-npm-registry.md` ("Versions change only by manual bumps").

 @module
 */

//region Types

/**
 Workspace manifest facts that decide dependent bumps.

 @example
 ```ts
 const manifest: WorkspaceManifest = { name: '@scope/a', directory: 'package/module/a', version: '1.0.0', edgeNames: ['@scope/b'] };
 ```
 */
export type WorkspaceManifest = Readonly<{
  /**
   Package name from the manifest.
   */
  name: string;
  /**
   Repository-relative package directory without trailing slash.
   */
  directory: string;
  /**
   Current manifest version, absent when the manifest declares none.
   */
  version?: string;
  /**
   Workspace package names this package reaches through runtime fields or bundled development imports.
   */
  edgeNames: readonly string[];
}>;

/**
 One dependent manifest version change.

 @example
 ```ts
 const bump: PlannedBump = { name: '@scope/a', directory: 'package/module/a', from: '1.0.0', to: '1.0.1' };
 ```
 */
export type PlannedBump = Readonly<{
  /**
   Dependent package name.
   */
  name: string;
  /**
   Repository-relative package directory.
   */
  directory: string;
  /**
   Version before the bump.
   */
  from: string;
  /**
   Version after the patch bump.
   */
  to: string;
}>;

//endregion Types

//region Versions

/**
 Number of dot-separated numeric components in a release version.
 */
const RELEASE_COMPONENT_COUNT = 3;

/**
 Position of the patch component in a release version.
 */
const PATCH_COMPONENT_INDEX = 2;

/**
 Thrown when a dependent's version is not a plain `major.minor.patch` release.

 @example
 ```ts
 throw new UnsupportedVersionError({ name: '@scope/a', version: '1.0.0-alpha.1' });
 ```
 */
export class UnsupportedVersionError extends Error {
  /**
   Creates an error naming the package and its version.

   @param name - Package whose version cannot be patch-bumped.

   @param version - Version text found in its manifest.
   */
  constructor({
    name,
    version,
  }: Readonly<{
    name: string;
    version: string;
  }>,) {
    super(`${name} has version ${JSON.stringify(version,)}, which is not a plain major.minor.patch release; bump it by hand in the same commit.`,);
    this.name = 'UnsupportedVersionError';
  }
}

/**
 Reports whether text is a non-empty run of ASCII digits without a leading zero.

 @param text - One version component.

 @returns Whether semver accepts it as a numeric release component.

 @example
 ```ts
 isReleaseComponent('10');
 // => true
 ```
 */
function isReleaseComponent(text: string,): boolean {
  if ((text === '') || ((text.length > 1) && text.startsWith('0',)))
    return false;
  // Index scan over UTF-16 units: any non-ASCII unit is outside '0' to '9'.
  for (let index = 0; index < text.length; index += 1) {
    /**
     Character at this position.
     */
    const character = text.charAt(index,);
    if ((character < '0') || (character > '9'))
      return false;
  }
  return true;
}

/**
 Increments the patch component of a plain release version.

 @param name - Package owning the version, named in the error.

 @param version - Current `major.minor.patch` version.

 @returns Version with the patch component increased by one.

 @throws UnsupportedVersionError when the version has a prerelease, build metadata, or non-numeric components.

 @example
 ```ts
 patchBumpVersion({ name: '@scope/a', version: '1.2.9' });
 // => '1.2.10'
 ```
 */
export function patchBumpVersion({
  name,
  version,
}: Readonly<{
  name: string;
  version: string;
}>,): string {
  /**
   Dot-separated components.
   */
  const components = version.split('.',);
  if ((components.length !== RELEASE_COMPONENT_COUNT) || (!components.every(isReleaseComponent,)))
    throw new UnsupportedVersionError({
      name,
      version,
    },);
  return components.map(function bumpPatch(
    component,
    index,
  ): string {
    return index === PATCH_COMPONENT_INDEX
      ? String(Number(component,) + 1,)
      : component;
  },)
    .join('.',);
}

//endregion Versions

//region Dependent closure

/**
 Maps each workspace package name to the names of workspace packages that depend on it.

 @param manifests - Every workspace manifest.

 @returns Dependent names keyed by dependency name.

 @example
 ```ts
 dependentsByName([{ name: 'a', directory: 'a', edgeNames: ['b'] }]).get('b');
 // => ['a']
 ```
 */
function dependentsByName(manifests: readonly WorkspaceManifest[],): ReadonlyMap<string, readonly string[]> {
  /**
   Workspace names, so edges to external packages are ignored.
   */
  const workspaceNames = new Set(manifests.map(function toName(manifest,): string {
    return manifest.name;
  },),);
  return manifests.reduce(
    function addEdges(
      dependents,
      manifest,
    ) {
    manifest.edgeNames
      .filter(function isWorkspaceEdge(edgeName,): boolean {
      return workspaceNames.has(edgeName,) && (edgeName !== manifest.name);
    },)
      .forEach(function recordDependent(edgeName,) {
      dependents.set(
        edgeName,
        [
          ...(dependents.get(edgeName,) ?? []),
          manifest.name,
        ],
      );
    },);
    return dependents;
  },
    new Map<string, string[]>(),
  );
}

/**
 Lists every package that transitively depends on any bumped package.

 @param manifests - Every workspace manifest.

 @param bumpedNames - Packages whose version already changed in this commit.

 @returns Reached dependent names, including bumped packages reached from other bumped packages.

 @example
 ```ts
 transitiveDependentNames({ manifests, bumpedNames: ['@scope/b'] });
 ```
 */
function transitiveDependentNames({
  manifests,
  bumpedNames,
}: Readonly<{
  manifests: readonly WorkspaceManifest[];
  bumpedNames: readonly string[];
}>,): ReadonlySet<string> {
  /**
   Reverse dependency edges.
   */
  const dependents = dependentsByName(manifests,);
  /**
   Names whose dependents still need visiting; a work stack keeps traversal iterative.
   */
  const pending = [...bumpedNames,];
  /**
   Dependents reached so far.
   */
  const reached = new Set<string>();
  while (pending.length > 0) {
    /**
     Next dependency to expand.
     */
    const current = pending.pop() ?? '';
    for (const dependent of dependents.get(current,) ?? []) {
      if (reached.has(dependent,))
        continue;
      reached.add(dependent,);
      pending.push(dependent,);
    }
  }
  return reached;
}

/**
 Plans patch bumps for publishable dependents of hand-bumped packages.

 @param manifests - Every workspace manifest, with current versions.

 @param bumpedNames - Packages whose current version differs from `HEAD`.

 @param publishableNames - Packages the registry publishes; only these receive bumps.

 @returns Bumps sorted by package name, excluding packages already bumped or without a version.

 @throws UnsupportedVersionError when a dependent that needs a bump has a non-release version.

 @example
 ```ts
 planDependentBumps({ manifests, bumpedNames: ['@scope/b'], publishableNames: ['@scope/a', '@scope/b'] });
 // => [{ name: '@scope/a', directory: 'package/module/a', from: '1.0.0', to: '1.0.1' }]
 ```
 */
export function planDependentBumps({
  manifests,
  bumpedNames,
  publishableNames,
}: Readonly<{
  manifests: readonly WorkspaceManifest[];
  bumpedNames: readonly string[];
  publishableNames: readonly string[];
}>,): readonly PlannedBump[] {
  /**
   Dependents reached through runtime and bundled edges.
   */
  const reached = transitiveDependentNames({
    manifests,
    bumpedNames,
  },);
  /**
   Fast membership for already-bumped names.
   */
  const bumped = new Set(bumpedNames,);
  /**
   Fast membership for publishable names.
   */
  const publishable = new Set(publishableNames,);
  return manifests
    .filter(function needsBump(manifest,): boolean {
    return reached.has(manifest.name,)
      && (!bumped.has(manifest.name,))
      && publishable.has(manifest.name,)
      && (manifest.version !== undefined);
  },)
    .map(function toBump(manifest,): PlannedBump {
    /**
     Current version, present by the filter.
     */
    const from = manifest.version ?? '';
    return {
      name: manifest.name,
      directory: manifest.directory,
      from,
      to: patchBumpVersion({
        name: manifest.name,
        version: from,
      },),
    };
  },)
    .toSorted(function byName(
      left,
      right,
    ): number {
    return left.name < right.name
      ? -1
      : left.name > right.name
      ? 1
      : 0;
  },);
}

//endregion Dependent closure
