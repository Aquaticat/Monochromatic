/**
 * Type guard that checks if a value is a RegExp object using Object.prototype.toString.
 * This method provides more reliable RegExp detection than instanceof, especially across
 * different execution contexts or when dealing with RegExp objects from different realms.
 *
 * @param value - Value to test for RegExp type
 * @returns True if value is a RegExp object, false otherwise
 * @example
 * ```ts
 * const pattern = /[a-z]+/;
 * const notPattern = "[a-z]+";
 *
 * $(pattern); // true
 * $(notPattern); // false
 * $(new RegExp("test")); // true
 *
 * // Works across different execution contexts
 * const iframe = document.createElement('iframe');
 * document.body.appendChild(iframe);
 * const iframeRegex = new iframe.contentWindow.RegExp("test");
 * $(iframeRegex); // true
 * ```
 */
export function $(
  value: unknown,
): value is RegExp {
  return Object.prototype.toString.call(value,) === '[object RegExp]';
}
