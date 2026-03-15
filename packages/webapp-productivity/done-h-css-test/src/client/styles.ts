/**
 * Global stylesheet assembled from token, layout, and panel modules.
 *
 * Imported by page entry scripts and passed to `injectCSS()`.
 */
import { primitiveTokens, semanticTokens, darkMode } from "./styles-tokens.ts";
import { resets, layoutShell } from "./styles-layout.ts";
import { utilities } from "./styles-utilities.ts";
import { newTaskPanel } from "./styles-panel.ts";

/** Complete global stylesheet string. */
export const globalStyles = [
  primitiveTokens,
  semanticTokens,
  darkMode,
  resets,
  layoutShell,
  utilities,
  newTaskPanel,
].join('');
