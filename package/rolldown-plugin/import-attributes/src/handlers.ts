/**
 * Attribute type handlers that transform raw file content
 * into JavaScript module source strings.
 *
 * @module
 */

//region Types

/**
 * Handler that transforms raw file content into a JavaScript module source string.
 *
 * @param content - Raw file content as a string
 *
 * @param id - Resolved file path (without query parameters)
 *
 * @returns JavaScript module source code
 */
export type AttributeTypeHandler = (
  content: string,
  id: string,
) => string;

//endregion Types

//region Built-in handlers

/**
 * Built-in handler for `type: 'text'` attributes.
 * Exports the raw file content as a default string export.
 *
 * @param content - Raw file content
 *
 * @returns JavaScript module that default-exports the content string
 *
 * @example
 * ```ts
 * textHandler('SELECT 1'); // 'export default "SELECT 1";'
 * ```
 */
export function textHandler(content: string,): string {
  return `export default ${JSON.stringify(content,)};`;
}

/**
 * Map of supported attribute type names to their handlers.
 * To add a new type, add a handler function and register it here.
 */
export const HANDLERS: Record<string, AttributeTypeHandler> = {
  text: textHandler,
};

//endregion Built-in handlers
