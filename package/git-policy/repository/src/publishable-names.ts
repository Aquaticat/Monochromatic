/**
 Reads the publishable package names from the generated pnpr registry config.

 @module
 */

/**
 Repository path of the generated pnpr config, whose OIDC package list is the publish set.
 */
export const PNPR_CONFIG_PATH = 'package/config/pnpr/config.yaml';

/**
 Key line that opens the OIDC workload package list.
 */
const PACKAGES_KEY = 'packages:';

/**
 Prefix of one single-quoted list item.
 */
const ITEM_PREFIX = "- '";

/**
 Lists package names from the `packages:` list of the generated pnpr config.

 The generator writes each name as a single-quoted YAML list item on its own line,
 so a line scan reads exactly what it wrote without a YAML parser in the policy bundle.

 @param configText - generated config text

 @returns names in config order

 @example
 ```ts
 readPublishableNames("packages:\n  - '@scope/a'\nnext: 1\n");
 // => ['@scope/a']
 ```
 */
export function readPublishableNames(configText: string,): readonly string[] {
  /**
   Lines of the config.
   */
  const lines = configText.split('\n',);
  /**
   Index of the list's key line.
   */
  const keyIndex = lines.findIndex(function isPackagesKey(line,): boolean {
    return line.trim() === PACKAGES_KEY;
  },);
  if (keyIndex === -1)
    return [];
  /**
   Lines after the key, up to the first line that is not a quoted list item.
   */
  const following = lines.slice(keyIndex + 1,);
  /**
   Position of the first line that ends the list.
   */
  const endOffset = following.findIndex(function endsList(line,): boolean {
    /**
     Line without indentation.
     */
    const trimmed = line.trim();
    return !(trimmed.startsWith(ITEM_PREFIX,) && trimmed.endsWith("'",) && (trimmed.length > ITEM_PREFIX.length + 1));
  },);
  return (endOffset === -1 ? following : following.slice(
    0,
    endOffset,
  ))
    .map(function unquote(line,): string {
    /**
     Line without indentation.
     */
    const trimmed = line.trim();
    return trimmed.slice(
      ITEM_PREFIX.length,
      -1,
    );
  },);
}
