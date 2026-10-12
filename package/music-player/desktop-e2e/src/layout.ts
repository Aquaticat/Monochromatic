/**
 Window sizes, focus orders and pointer targets that the checks rely on.
 
 @example
 ```ts
 import { WIDE_WINDOW, } from './layout.ts';
 ```
 
 @packageDocumentation
 */

/**
 The wide window, in which the folder list and the track list sit side by side.
 */
export const WIDE_WINDOW = {
  width: 1_000,
  height: 800,
} as const;

/**
 The narrow window, in which the layout folds and the folder list becomes a picker overlay.
 */
export const NARROW_WINDOW = {
  width: 443,
  height: 900,
} as const;

/**
 Focus labels in Tab order on the player page in the wide layout.
 */
export const UNFOLDED_ORDER: readonly string[] = [
  'open-pill',
  'folder-list',
  'track-list',
  'seek',
  'previous',
  'play',
  'next',
  'mode-group',
  'search',
  'settings',
];

/**
 Focus labels in Tab order on the player page in the folded layout.
 */
export const FOLDED_ORDER: readonly string[] = [
  'folder-trigger',
  'open-pill',
  'track-list',
  'seek',
  'previous',
  'play',
  'next',
  'mode-group',
  'search',
  'settings',
];

/**
 Pointer targets in the wide window, in pixels.
 */
export const WIDE_POINTS = {
  /**
   A folder row in the folder list.
   */
  folderRow: {
    x: 100,
    y: 118,
  },
  /**
   The Search button at the top right, where its badge also sits.
   */
  searchButton: {
    x: 911,
    y: 28,
  },
  /**
   A track row, for the context menu.
   */
  trackRow: {
    x: 700,
    y: 80,
  },
} as const;

/**
 The accents and color schemes the screenshot checks cover.
 */
export const VISUAL_VARIANTS = [
  {
    scheme: 'dark',
    accent: '3B82F6',
  },
  {
    scheme: 'dark',
    accent: '22C55E',
  },
  {
    scheme: 'light',
    accent: '3B82F6',
  },
  {
    scheme: 'light',
    accent: '22C55E',
  },
] as const;
