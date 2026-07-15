/**
 * File tree read-only operations: expansion restore, recency, expanded dirs.
 *
 * Standalone functions that operate on DOM queries against the
 * tree container element.
 */

import {
  l as rootLogger,
  tagged,
} from '../log.ts';

export {
  revealFiles,
  scrollToFile,
} from './reveal.ts';

/**
 * Tagged logger for the file tree operations subsystem.
 */
const l = tagged({
  tag: 'file-tree-ops',
  l: rootLogger,
},);

/**
 * Restores previously expanded directories by programmatically
 * opening each `<details>` element from root outward.
 *
 * @param tree - tree container element
 *
 * @param dirs - absolute paths of directories to expand
 *
 * @param loadPromises - in-flight load promises keyed by directory path
 *
 * @example
 * ```ts
 * await restoreExpansion({ tree: treeElement, dirs: ['/home/user/project/src', '/home/user/project/src/components'], loadPromises: loadPromises, });
 * ```
 */
export async function restoreExpansion({
  tree,
  dirs,
  loadPromises,
}: {
  readonly tree: HTMLDivElement;
  readonly dirs: readonly string[];
  readonly loadPromises: ReadonlyMap<string, Promise<void>>;
},): Promise<void> {
  /**
   * Pre-compute depths to avoid O(N log N) split calls inside the comparator.
   */
  const depthOf = new Map<string, number>(
    dirs.map(function computeDepth(d,): [
      string,
      number,
    ] {
      return [
        d,
        d.split('/',)
          .length,
      ];
    },),
  );
  /**
   * Dirs sorted shallow-to-deep so each parent is open before its children are looked up.
   */
  const sorted = dirs.toSorted(function byDepth(
    a,
    b,
  ) {
    return (depthOf.get(a,)
      ?? 0) - (depthOf.get(b,)
        ?? 0);
  },);

  for (const dirPath of sorted) {
    /**
     * Summary element marking the directory header; null when the parent has not loaded yet.
     */
    const summary = tree.querySelector<HTMLElement>(
      `summary[data-path="${CSS.escape(dirPath,)}"]`,
    );
    if (summary === null) {
      l.warn(`skipping expansion of ${dirPath}: not found in tree`,);
      continue;
    }
    /**
     * Owning `<details>` wrapper; opening it triggers the toggle handler that loads children.
     */
    const details = summary.parentElement;
    if ((details instanceof HTMLDetailsElement) && (!details.open)) {
      details.open = true;
      details.dispatchEvent(new Event('toggle',),);
      // oxlint-disable-next-line no-await-in-loop -- sequential expansion is intentional: parent directories must render before children can be found in the DOM
      await loadPromises.get(dirPath,);
    }
  }
}

/**
 * Updates recency markers on all file entries in the tree.
 *
 * @param tree - tree container element
 *
 * @param paths - ordered recent file paths (index 0 = most recent)
 *
 * @example
 * ```ts
 * updateRecencyMarkers({ tree: treeElement, paths: ['/home/user/project/src/main.ts', '/home/user/project/src/app.ts'], });
 * ```
 */
export function updateRecencyMarkers({
  tree,
  paths,
}: {
  readonly tree: HTMLDivElement;
  readonly paths: readonly string[];
},): void {
  /**
   * Path-to-position lookup so each tree entry can resolve its recency index in O(1).
   */
  const recencyByPath = new Map<string, number>();
  for (let i = 0; i < paths
    .length; i++) {
    /**
     * Recent entry at index `i`; undefined slots are ignored to keep the map dense.
     */
    const recentPath = paths[i];
    if (recentPath !== undefined) {
      recencyByPath.set(
        recentPath,
        i,
      );
    }
  }

  for (const label of tree.querySelectorAll<HTMLElement>('tree-file-entry[data-path]',)) {
    /**
     * Absolute path this entry represents; undefined when the data attribute is missing or empty.
     */
    const labelPath = label.dataset
      .path;
    /**
     * Position in the recency list, or undefined when this path is not among the recent files.
     */
    const recencyIndex = labelPath !== undefined
      ? recencyByPath.get(labelPath,)
      : undefined;
    /**
     * Inline marker element displaying the numeric recency indicator.
     */
    const toggle = label.querySelector<HTMLElement>('.toggle',);

    if (recencyIndex !== undefined) {
      label.dataset
        .recency = String(recencyIndex,);
      if (toggle !== null)
        toggle.textContent = String(recencyIndex,);
    }
    else if (label.dataset
      .recency
      !== undefined) {
      delete label.dataset
        .recency;
      if (toggle !== null)
        toggle.textContent = '';
    }
  }
}

/**
 * Resolves the directory path of the last-focused element.
 *
 * @param lastFocused - last focused element in the tree, or null
 *
 * @returns directory path, or empty string when nothing has been focused
 *
 * @example
 * ```ts
 * const result = resolveSelectedDir({ lastFocused: lastFocusedEntry, });
 * ```
 */
export function resolveSelectedDir(
  { lastFocused, }: { readonly lastFocused: HTMLElement | null; },
): string {
  if (lastFocused === null)
    return '';
  /**
   * Absolute path of the focused entry, or empty when the entry has no data-path attribute.
   */
  const itemPath = lastFocused.dataset
    .path
    ?? '';
  if (itemPath === '')
    return '';
  if (lastFocused.tagName
    === 'SUMMARY')
    return itemPath;
  /**
   * Index of the last separator; used to derive the parent directory of a file entry.
   */
  const lastSlash = itemPath.lastIndexOf('/',);
  return lastSlash > 0
    ? itemPath.slice(
      0,
      lastSlash,
    )
    : '';
}

/**
 * Collects the absolute paths of all currently expanded directories.
 *
 * @param tree - tree container element
 *
 * @returns array of absolute directory paths that are expanded
 *
 * @example
 * ```ts
 * const dirs = collectExpandedDirs({ tree: treeElement, });
 * ```
 */
export function collectExpandedDirs({ tree, }: { readonly tree: HTMLDivElement; },): string[] {
  /**
   * Accumulator collecting every expanded directory path encountered during the walk.
   */
  const dirs: string[] = [];
  for (const details of tree.querySelectorAll<HTMLDetailsElement>('details[open]',)) {
    /**
     * `<summary>` is always the first child of `<details>` (set in TreeDirEntry.connectedCallback).
     */
    const first = details.firstElementChild;
    /**
     * Path read from the summary's data attribute; empty when the summary lacks a data-path.
     */
    const path = first instanceof HTMLElement ? (first.dataset
      .path
      ?? '') : '';
    if (path !== '')
      dirs.push(path,);
  }
  return dirs;
}
