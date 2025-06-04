/**
 * Sets CSS properties on the `:root` element based on URL query parameters.
 *
 * For each URL query parameter, its name is the CSS property name, and its value is used as the CSS property value.
 *
 * @example
 * If the current URL is https://example.com/?background-color=red&font-size=16px
 * setCssFromUrlParams();
 * This will set:
 * document.documentElement.style.setProperty('background-color', 'red');
 * document.documentElement.style.setProperty('font-size', '16px');
 */
export function setCssFromUrlParams(): void {
  const params = new URLSearchParams(globalThis.location.search);

  for (const [key, value] of params.entries()) {
    document.documentElement.style.setProperty(key, value);
  }
}
