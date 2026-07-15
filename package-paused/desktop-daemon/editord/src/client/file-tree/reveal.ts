/**
 * File tree reveal and scroll operations.
 *
 * Expands ancestor directories to make files visible
 * and scrolls entries into view.
 */

import {
  l as rootLogger,
  tagged,
} from '../log.ts';

/**
 * Tagged logger for the reveal subsystem.
 */
const l = tagged({
  tag: 'file-tree-reveal',
  l: rootLogger,
},);

/**
 * Collects all ancestor directory paths between each file and the root.
 *
 * @param paths - absolute file paths to reveal
 *
 * @param rootLength - character length of the root path
 *
 * @returns set of ancestor directory paths
 *
 * @example
 * ```ts
 * const result = collectAncestorDirs({ paths: ['/home/user/project/src/main.ts'], rootLength: 22, });
 * ```
 */
export function collectAncestorDirs({
  paths,
  rootLength,
}: {
  readonly paths: readonly string[];
  readonly rootLength: number;
},): Set<string> {
  /**
   * Set deduplicates ancestors that appear under multiple input paths.
   */
  const dirs = new Set<string>();
  for (const filePath of paths) {
    /**
     * Mutated upward to the root by the inner loop.
     */
    let current = filePath.slice(
      0,
      filePath.lastIndexOf('/',),
    );
    while (current.length
      > rootLength) {
      dirs.add(current,);
      current = current.slice(
        0,
        current.lastIndexOf('/',),
      );
    }
  }
  return dirs;
}

/**
 * Finds the first visible element at or below the current scroll position.
 *
 * @param tree - tree container element
 *
 * @param hostElement - host custom element for viewport rect
 *
 * @returns anchor element and viewport offset, or null
 *
 * @example
 * ```ts
 * const result = findScrollAnchor({ tree: treeElement, hostElement: fileTreeHost, });
 * ```
 */
export function findScrollAnchor({
  tree,
  hostElement,
}: {
  readonly tree: HTMLDivElement;
  readonly hostElement: HTMLElement;
},): {
  readonly element: HTMLElement;
  readonly offsetFromViewport: number;
} | null {
  /**
   * Reused as the viewport reference frame for every candidate compare below.
   */
  const hostRect = hostElement.getBoundingClientRect();
  /**
   * Cached top edge so the loop does not re-read the rect property on every iteration.
   */
  const viewportTop = hostRect.top;

  for (const candidate of tree.querySelectorAll<HTMLElement>(
    'summary, tree-file-entry',
  )) {
    /**
     * Per-candidate rect compared against the viewport reference frame.
     */
    const rect = candidate.getBoundingClientRect();
    if (rect.bottom
      > viewportTop) {
      return {
        element: candidate,
        offsetFromViewport: rect.top
          - viewportTop,
      };
    }
  }

  return null;
}

/**
 * Scrolls the tree so that the file entry with the given path is visible.
 *
 * @param tree - tree container element
 *
 * @param path - absolute file path to scroll into view
 *
 * @example
 * ```ts
 * scrollToFile({ tree: treeElement, path: '/home/user/project/src/main.ts', });
 * ```
 */
export function scrollToFile({
  tree,
  path,
}: {
  readonly tree: HTMLDivElement;
  readonly path: string;
},): void {
  /**
   * Null when the file is not yet rendered; scroll skipped in that case.
   */
  const label = tree.querySelector<HTMLElement>(
    `tree-file-entry[data-path="${CSS.escape(path,)}"]`,
  );
  if (label !== null)
    label.scrollIntoView({ block: 'nearest', },);
}

/**
 * Expands ancestor directories for file paths, preserving scroll context.
 *
 * @param tree - tree container element
 *
 * @param hostElement - host custom element for scroll anchoring
 *
 * @param rootPath - absolute root directory path
 *
 * @param paths - absolute file paths to reveal
 *
 * @param restoreExpansion - function to restore expansion state
 *
 * @example
 * ```ts
 * await revealFiles({
 *   tree: treeElement,
 *   hostElement: fileTreeHost,
 *   rootPath: '/home/user/project',
 *   paths: ['/home/user/project/src/main.ts'],
 *   restoreExpansion: restoreExpansionFn,
 * });
 * ```
 */
export async function revealFiles(
  {
    tree,
    hostElement,
    rootPath,
    paths,
    restoreExpansion,
  }: {
    readonly tree: HTMLDivElement;
    readonly hostElement: HTMLElement;
    readonly rootPath: string;
    readonly paths: readonly string[];
    readonly restoreExpansion: (opts: { readonly dirs: readonly string[]; },) => Promise<void>;
  },
): Promise<void> {
  /**
   * Deduped ancestor directories that need expanding to reveal `paths`.
   */
  const dirs = collectAncestorDirs({
    paths,
    rootLength: rootPath.length,
  },);
  if (dirs.size
    === 0)
    return;
  l.info(
    `revealing ${String(dirs.size,)} ancestor dirs for ${
      String(paths.length,)
    } recent files`,
  );
  /**
   * Anchor captured before expansion so its post-expansion shift can be measured.
   */
  const anchor = findScrollAnchor({
    tree,
    hostElement,
  },);
  await restoreExpansion({ dirs: [...dirs,], },);
  if (anchor !== null) {
    /**
     * Difference from {@link anchor.offsetFromViewport} drives the scroll correction.
     */
    const newTop = anchor.element
      .getBoundingClientRect()
      .top;
    hostElement.scrollTop += newTop - anchor
      .offsetFromViewport;
  }
}
