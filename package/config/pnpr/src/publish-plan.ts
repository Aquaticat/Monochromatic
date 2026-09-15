import { parse, } from 'yaml';

import {
  fieldOf,
  firstItem,
  isStringArray,
} from './json-shape.ts';

//region Registry target from the generated config

/**
 Registry facts the publish run needs, all read from the generated `config.yaml`.
 */
export type PnprPublishTarget = {
  /**
   Public registry origin, which is also the OIDC audience.
   */
  readonly origin: string;
  /**
   Hosted registry name that workload publishes must target as `/~<name>/`.
   */
  readonly registryName: string;
  /**
   Exact package names trusted for workload publishing, in config order.
   */
  readonly packageNames: readonly string[];
};

/**
 Error for a generated config that lacks a field the publish run depends on.
 */
export class PnprConfigShapeError extends Error {
  /**
   Creates the error with the missing field path.

   @param field - Dotted path of the missing or malformed field.

   @example
   ```ts
   throw new PnprConfigShapeError('auth.oidc[0].audience');
   ```
   */
  constructor(field: string,) {
    super(`pnpr config.yaml is missing or malformed at ${field}; regenerate it with mise run sync:files`,);
    this.name = 'PnprConfigShapeError';
  }
}

/**
 Reads the publish target from the generated pnpr config, so selection has a single owner.

 @param configText - Contents of `package/config/pnpr/config.yaml`.

 @returns Origin, hosted registry name, and trusted package names.

 @throws {@link PnprConfigShapeError} when the OIDC workload or its fields are absent.

 @example
 ```ts
 readPnprPublishTarget(await readFile('package/config/pnpr/config.yaml', 'utf8'));
 ```
 */
export function readPnprPublishTarget(configText: string,): PnprPublishTarget {
  /**
   Parsed YAML document, untrusted until each field is checked.
   */
  const document: unknown = parse(configText,);
  /**
   First OIDC provider, which the generator always writes for GitHub.
   */
  const provider = firstItem(fieldOf({
    value: fieldOf({
      value: document,
      key: 'auth',
    },),
    key: 'oidc',
  },),);
  /**
   Audience string of that provider.
   */
  const origin = fieldOf({
    value: provider,
    key: 'audience',
  },);
  /**
   First workload binding under the provider.
   */
  const workload = firstItem(fieldOf({
    value: provider,
    key: 'workloads',
  },),);
  /**
   Registry name the workload may publish to.
   */
  const registryName = fieldOf({
    value: workload,
    key: 'registry',
  },);
  /**
   Trusted package names for that workload.
   */
  const packageNames = fieldOf({
    value: workload,
    key: 'packages',
  },);
  if ((typeof origin) !== 'string')
    throw new PnprConfigShapeError('auth.oidc[0].audience',);
  if ((typeof registryName) !== 'string')
    throw new PnprConfigShapeError('auth.oidc[0].workloads[0].registry',);
  if (!isStringArray(packageNames,))
    throw new PnprConfigShapeError('auth.oidc[0].workloads[0].packages',);
  return {
    origin,
    registryName,
    packageNames,
  };
}

//endregion Registry target from the generated config

//region Published manifest shape

/**
 Removes `./ts` subpaths from a subpath exports map; condition maps and strings pass through.

 @param exportsField - Value of `exports` or `publishConfig.exports`.

 @returns Exports without TypeScript-source subpaths that Node refuses under `node_modules`.

 @example
 ```ts
 stripTsSubpaths({ '.': './dist/index.mjs', './ts': './src/index.ts' });
 // => { '.': './dist/index.mjs' }
 ```
 */
function stripTsSubpaths(exportsField: unknown,): unknown {
  if (((typeof exportsField) !== 'object') || (exportsField === null)
    || Array.isArray(exportsField,))
    return exportsField;
  /**
   Export entries of the map.
   */
  const entries = Object.entries(exportsField,);
  if (!entries.some(function isSubpath([key,],) {
    return key.startsWith('.',);
  },))
    return exportsField;
  return Object.fromEntries(entries.filter(function isNotTsSubpath([key,],) {
    return (key !== './ts') && (!key.startsWith('./ts/',));
  },),);
}

/**
 Rewrites a packed manifest for pnpr: drops `private`, `./ts` subpaths, and npmjs-only publish settings.

 @param manifest - Manifest read from the packed tarball.

 @returns New manifest object; the input is not modified.

 @example
 ```ts
 prepareManifestForPnpr({ name: '@monochromatic-dev/x', private: true, exports: { './ts': './src/index.ts' } });
 // => { name: '@monochromatic-dev/x', exports: {} }
 ```
 */
export function prepareManifestForPnpr(
  manifest: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  /**
   Fields rewritten for pnpr, and everything else copied through unchanged.
   `private` is taken out here and never re-added, since npm refuses to publish private manifests.
   */
  const {
    private: _private,
    publishConfig,
    exports: exportsField,
    ...rest
  } = manifest;
  void _private;
  /**
   Publish settings kept for pnpr; provenance and registry target npmjs only.
   */
  const keptPublishConfig = (((typeof publishConfig) === 'object') && (publishConfig !== null))
    ? Object.fromEntries(Object.entries(publishConfig,)
      .filter(function isKept([key,],) {
        return (key !== 'provenance') && (key !== 'registry');
      },)
      .map(function stripNested([
        key,
        value,
      ],) {
        return [
          key,
          key === 'exports' ? stripTsSubpaths(value,) : value,
        ];
      },),)
    : undefined;
  return {
    ...rest,
    ...(exportsField === undefined ? {} : { exports: stripTsSubpaths(exportsField,), }),
    ...(keptPublishConfig === undefined ? {} : { publishConfig: keptPublishConfig, }),
  };
}

//endregion Published manifest shape

//region Publish order

/**
 One package waiting to publish, with the workspace packages it builds or runs against.
 */
export type PublishCandidate = {
  /**
   Package name.
   */
  readonly name: string;
  /**
   Workspace package names from every dependency field.
   */
  readonly dependencyNames: readonly string[];
};

/**
 Orders candidates so dependencies publish first; cycle members follow in name order.

 @param candidates - Packages with missing versions.

 @returns Names in publish order and the names that sat in dependency cycles.

 @example
 ```ts
 orderForPublishing([{ name: 'b', dependencyNames: ['a'] }, { name: 'a', dependencyNames: [] }]);
 // => { order: ['a', 'b'], cycleMembers: [] }
 ```
 */
export function orderForPublishing(
  candidates: readonly PublishCandidate[],
): {
  readonly order: readonly string[];
  readonly cycleMembers: readonly string[]
} {
  /**
   Candidate names, since only edges inside the batch constrain order.
   */
  const batch: ReadonlySet<string> = new Set(candidates.map(function toName(candidate,) {
    return candidate.name;
  },),);
  /**
   Remaining in-batch dependencies per candidate.
   */
  const pending = new Map(candidates.map(function toPending(candidate,) {
    return [
      candidate.name,
      new Set(candidate.dependencyNames
        .filter(function inBatch(name,) {
        return batch.has(name,) && (name !== candidate.name);
      },),),
    ];
  },),);
  /**
   Names in publish order, from Kahn's algorithm over the in-batch edges.
   */
  const order = (function placeReadyNames(): readonly string[] {
    /**
     Names placed so far.
     */
    const placed: string[] = [];
    /**
     Names whose dependencies are all placed, sorted for deterministic output.
     */
    // Kahn's algorithm needs a moving frontier; each pass rebinds it to a new sorted array.
    let ready = [...pending.entries(),]
    .filter(function isReady([, dependencies,],) {
      return dependencies.size === 0;
    },)
      .map(function toName([name,],) {
      return name;
    },)
      .toSorted();
  while (ready.length > 0) {
    /**
     Next name to place.
     */
    const [
      next,
      ...rest
    ] = ready;
    if (next === undefined)
      break;
    placed.push(next,);
    pending.delete(next,);
    /**
     Names unblocked by placing `next`.
     */
    const unblocked = [...pending.entries(),]
      .filter(function dependsOnNext([, dependencies,],) {
        return dependencies.delete(next,) && (dependencies.size === 0);
      },)
      .map(function toName([name,],) {
        return name;
      },);
    ready = [
      ...rest,
      ...unblocked,
    ].toSorted();
  }
    return placed;
  })();
  /**
   Names left in cycles, appended so they still publish.
   */
  const cycleMembers = [...pending.keys(),].toSorted();
  return {
    order: [
      ...order,
      ...cycleMembers,
    ],
    cycleMembers,
  };
}

//endregion Publish order
