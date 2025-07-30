/**
 * Sets CSS properties on the `:root` element based on URL query parameters.
 *
 * For each URL query parameter, the parameter name becomes the CSS property name,
 * and its value becomes the CSS property value. This enables dynamic styling
 * through URL parameters, useful for theming, debugging, or configuration.
 *
 * @param allowedProperties - Optional iterable of CSS property names to filter which
 *   parameters are processed. If provided, only properties listed in this iterable
 *   will be applied from the URL parameters. If omitted, all URL parameters are
 *   processed as CSS properties.
 * @returns Nothing (void). Modifies the document's root element styles directly.
 * @example
 * ```ts
 * // URL: https://example.com/?background-color=red&font-size=16px&margin=10px
 *
 * // Apply all URL parameters as CSS properties
 * onLoadSetCssFromUrlParams();
 * // Sets: --background-color: red, --font-size: 16px, --margin: 10px
 *
 * // Apply only specific allowed properties
 * onLoadSetCssFromUrlParams(['background-color', 'font-size']);
 * // Sets: --background-color: red, --font-size: 16px (margin ignored)
 *
 * // With no matching parameters
 * onLoadSetCssFromUrlParams(['non-existent-prop']);
 * // Sets: nothing (no matching parameters found)
 * ```
 */
export function onLoadSetCssFromUrlParams(allowedProperties?: Iterable<string>,): void {
  const params = new URLSearchParams(globalThis.location.search,);

  if (allowedProperties) {
    const allowedSet = new Set(allowedProperties,);
    for (const [key, value,] of params.entries()) {
      if (allowedSet.has(key,))
        document.documentElement.style.setProperty(key, value,);
    }
  }
  else {
    // No allowedProperties, so process all parameters
    for (const [key, value,] of params.entries())
      document.documentElement.style.setProperty(key, value,);
  }
}
