/**
 * Sets CSS properties on the `:root` element based on address query parameters.
 *
 * For each address query parameter, its name is the CSS property name, and its value is used as the CSS property value.
 *
 * @example
 * If the current address is https://example.com/?background-color=red&font-size=16px
 * setCssFromUrlParams();
 * This will set:
 * document.documentElement.style.setProperty('background-color', 'red');
 * document.documentElement.style.setProperty('font-size', '16px');
 *
 * @param allowedProperties Optional iterable of CSS property names. If provided, only properties listed in this iterable will be set from the address parameters.
 */
export function setCssFromUrlParams(allowedProperties?: Iterable<string>): void {
  const params = new URLSearchParams(globalThis.location.search);

  if (allowedProperties) {
    const allowedSet = new Set(allowedProperties);
    for (const [key, value] of params.entries()) {
      if (allowedSet.has(key)) {
        document.documentElement.style.setProperty(key, value);
      }
    }
  } else {
    // No allowedProperties, so process all parameters
    for (const [key, value] of params.entries()) {
      document.documentElement.style.setProperty(key, value);
    }
  }
}
