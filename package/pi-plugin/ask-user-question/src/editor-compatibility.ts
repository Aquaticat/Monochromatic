import { basename, } from 'node:path';

//region Constants

/**
 Terminal identity fragment emitted by terminal-exec for Ghostty.
 */
const GHOSTTY_ID_FRAGMENT = 'ghostty';

/**
 Helix executable names commonly configured by users.
 */
const HELIX_EXECUTABLE_NAMES: ReadonlySet<string> = new Set([
  'helix',
  'hx',
],);

/**
 Warning logged when known terminal and editor pairing is selected.
 */
export const GHOSTTY_HELIX_WARNING = 'Detected Ghostty with Helix. Escape may intermittently fail in this pairing; set editor to another command in the user-level pi-ask-user-question.json config.';

//endregion Constants

//region Detection

/**
 Detects Ghostty terminal paired with Helix editor.
 
 @param terminalEntryId - terminal-exec resolved desktop entry identity
 
 @param editorCommand - effective editor executable and arguments
 
 @returns whether compatibility warning should be emitted
 
 @example
 ```ts
 isGhosttyHelixCombination({ terminalEntryId: 'com.mitchellh.ghostty.desktop', editorCommand: ['hx'] });
 ```
 */
export function isGhosttyHelixCombination({
  terminalEntryId,
  editorCommand,
}: {
  readonly terminalEntryId: string;
  readonly editorCommand: readonly string[];
}): boolean {
  if (!terminalEntryId.toLowerCase()
    .includes(GHOSTTY_ID_FRAGMENT,))
    return false;
  /**
   Effective editor executable before configured arguments.
   */
  const [executable,] = editorCommand;
  if (executable === undefined)
    return false;
  return HELIX_EXECUTABLE_NAMES.has(basename(executable,)
    .toLowerCase(),);
}

//endregion Detection
