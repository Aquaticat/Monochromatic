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

/** Tagged logger for the file tree operations subsystem. */
const l = tagged({ tag: 'file-tree-ops', l: rootLogger, },);

/**
 * Restores previously expanded directories by programmatically
 * opening each `<details>` element from root outward.
 *
 * @param tree - tree container element
 *
 * @param dirs - absolute paths of directories to expand
 *
 * @param loadPromises - in-flight load promises keyed by directory path
 */
export async function restoreExpansion({ tree, dirs, loadPromises, }: {
  tree: HTMLDivElement;
  dirs: string[];
  loadPromises: Map<string, Promise<void>>;
},): Promise<void> {
  const sorted = dirs.toSorted(function byDepth(a, b,) {
    return a.split('/',).length - b.split('/',).length;
  },);

  for (const dirPath of sorted) {
    const summary = tree.querySelector<HTMLElement>(
      `summary[data-path="${CSS.escape(dirPath,)}"]`,
    );
    if (summary === null) {
      l.warn(`skipping expansion of ${dirPath}: not found in tree`,);
      continue;
    }
    const details = summary.parentElement;
    if (details instanceof HTMLDetailsElement && !details.open) {
      details.open = true;
      details.dispatchEvent(new Event('toggle',),);
      // oxlint-disable-next-line eslint(no-await-in-loop) -- sequential expansion is intentional: parent directories must render before children can be found in the DOM
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
 */
export function updateRecencyMarkers({ tree, paths, }: {
  tree: HTMLDivElement;
  paths: string[];
},): void {
  const recencyByPath = new Map<string, number>();
  for (let i = 0; i < paths.length; i++) {
    const recentPath = paths[i];
    if (recentPath !== undefined)
      recencyByPath.set(recentPath, i,);
  }

  for (const label of tree.querySelectorAll<HTMLElement>('tree-file-entry[data-path]',)) {
    const labelPath = label.dataset['path'];
    const recencyIndex = labelPath !== undefined
      ? recencyByPath.get(labelPath,)
      : undefined;
    const toggle = label.querySelector<HTMLElement>('.toggle',);

    if (recencyIndex !== undefined) {
      label.dataset['recency'] = String(recencyIndex,);
      if (toggle !== null)
        toggle.textContent = String(recencyIndex,);
    }
    else if (label.dataset['recency'] !== undefined) {
      delete label.dataset['recency'];
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
 */
export function resolveSelectedDir(
  { lastFocused, }: { lastFocused: HTMLElement | null; },
): string {
  if (lastFocused === null)
    return '';
  const itemPath = lastFocused.dataset['path'] ?? '';
  if (itemPath === '')
    return '';
  if (lastFocused.tagName === 'SUMMARY')
    return itemPath;
  const lastSlash = itemPath.lastIndexOf('/',);
  return lastSlash > 0 ? itemPath.slice(0, lastSlash,) : '';
}

/**
 * Collects the absolute paths of all currently expanded directories.
 *
 * @param tree - tree container element
 *
 * @returns array of absolute directory paths that are expanded
 */
export function collectExpandedDirs({ tree, }: { tree: HTMLDivElement; },): string[] {
  const dirs: string[] = [];
  for (const details of tree.querySelectorAll<HTMLDetailsElement>('details[open]',)) {
    const path = details.querySelector<HTMLElement>('summary',)?.dataset['path'] ?? '';
    if (path !== '')
      dirs.push(path,);
  }
  return dirs;
}
