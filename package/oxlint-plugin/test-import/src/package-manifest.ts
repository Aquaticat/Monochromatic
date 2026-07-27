/**
 * Package manifest reading and shipping-entry extraction.
 *
 * Collects every path a manifest declares as something consumers load, from
 * `exports`, `main`, and `bin`. The `./ts` and `./ts/*` export keys are skipped
 * because they are the sanctioned source channel, not a shipped artifact.
 *
 * @module
 */

/**
 * Fields of a `package.json` this plugin reads.
 */
export type PackageManifest = {
  /**
   * Package name, required for a directory to count as a package root.
   */
  readonly name: string;
  /**
   * Subpath exports map, string target, or absent.
   */
  readonly exports?: unknown;
  /**
   * Legacy single entry point.
   */
  readonly main?: unknown;
  /**
   * Executable entry point, string or name-to-path map.
   */
  readonly bin?: unknown;
};

/**
 * Export key naming the TypeScript source entry.
 */
const SOURCE_EXPORT_KEY = './ts';

/**
 * Prefix of export keys naming TypeScript source subpaths.
 */
const SOURCE_EXPORT_PREFIX = './ts/';

/**
 * Narrows parsed JSON to a manifest carrying a package name.
 *
 * A directory without a named manifest is not a package root, so the ancestor
 * walk keeps going rather than stopping at, say, a bare `tsconfig` folder that
 * happens to hold a nameless `package.json`.
 *
 * @param value - parsed `package.json` contents
 *
 * @returns true when value carries a string `name`
 *
 * @example
 * ```ts
 * isPackageManifest(JSON.parse(text));
 * ```
 */
export function isPackageManifest(value: unknown,): value is PackageManifest {
  if (((typeof value) !== 'object') || (value === null))
    return false;
  if (!('name' in value))
    return false;
  return (typeof value.name) === 'string';
}

/**
 * Collects every string leaf of one `exports` subtree.
 *
 * Conditional exports nest objects and arrays to arbitrary depth, so the walk
 * uses an explicit work stack rather than recursion.
 *
 * @param root - `exports` value, one condition subtree, `main`, or `bin`
 *
 * @returns every string target found beneath root, in discovery order
 *
 * @example
 * ```ts
 * stringTargets({ node: { types: './a.d.mts', default: './a.mjs' } });
 * ```
 */
export function stringTargets({ node, }: {
  /**
   * Manifest value to flatten into its string leaves.
   */
  readonly node: unknown;
},): readonly string[] {
  /**
   * Collected string leaves.
   */
  const targets: string[] = [];
  /**
   * Pending subtrees, popped until the whole value is flattened.
   */
  const pending: unknown[] = [node,];
  while (pending.length > 0) {
    /**
     * Next subtree to inspect; the guard above proves the pop is present.
     */
    const current = pending.pop();
    if ((typeof current) === 'string') {
      targets.push(current,);
      continue;
    }
    if (Array.isArray(current,)) {
      pending.push(...current,);
      continue;
    }
    if (((typeof current) === 'object') && (current !== null))
      pending.push(...Object.values(current,),);
  }
  return targets;
}

/**
 * Collects declared shipping targets from one manifest.
 *
 * Reads `exports` (skipping the source subpath keys), `main`, and `bin`. A
 * `null` export target flattens to nothing, so blocked subpaths contribute no
 * directory.
 *
 * @param manifest - parsed package manifest
 *
 * @returns package-relative or absolute target specifiers, unfiltered
 *
 * @example
 * ```ts
 * shippingTargets({ manifest });
 * ```
 */
export function shippingTargets({ manifest, }: {
  /**
   * Parsed package manifest to read entries from.
   */
  readonly manifest: PackageManifest;
},): readonly string[] {
  /**
   * Manifest entry fields that name something consumers load.
   */
  const {
    exports: exportsField,
    main,
    bin,
  } = manifest;

  /**
   * Export targets, with the source subpath keys removed.
   */
  const exportTargets = isSubpathMap({ node: exportsField, },)
    ? Object.entries(exportsField,)
      .filter(function keepShippingKey([key,],): boolean {
        return (key !== SOURCE_EXPORT_KEY) && (!key.startsWith(SOURCE_EXPORT_PREFIX,));
      },)
      .flatMap(function targetsOfEntry([, value,],): readonly string[] {
        return stringTargets({ node: value, },);
      },)
    : stringTargets({ node: exportsField, },);

  return [
    ...exportTargets,
    ...stringTargets({ node: main, },),
    ...stringTargets({ node: bin, },),
  ];
}

/**
 * Tests whether an `exports` value is a subpath map rather than a shorthand.
 *
 * A subpath map keys on `.`-prefixed paths; a condition map keys on names like
 * `types` or `default`. Only the former carries source subpath keys worth
 * skipping, and only its keys are safe to inspect for that purpose.
 *
 * @param node - `exports` field value
 *
 * @returns true when node is an object whose every key names a subpath
 */
function isSubpathMap({ node, }: {
  /**
   * `exports` field value to classify.
   */
  readonly node: unknown;
},): node is Record<string, unknown> {
  if (((typeof node) !== 'object') || (node === null) || Array.isArray(node,))
    return false;
  /**
   * Declared keys, used to tell a subpath map from a condition map.
   */
  const keys = Object.keys(node,);
  if (keys.length === 0)
    return false;
  return keys.every(function namesSubpath(key,): boolean {
    return key.startsWith('.',);
  },);
}
