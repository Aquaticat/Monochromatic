/**
 * Sets CSS properties on the `:root` element based on URL query parameters.
 *
 * For each URL query parameter, its name is converted from camelCase to kebab-case
 * to determine the CSS property name, and its value is used as the CSS property value.
 *
 * @example
 * // If the current URL is https://example.com/?backgroundColor=red&fontSize=16px
 * setCssFromUrlParams();
 * // This will set:
 * // document.documentElement.style.setProperty('--background-color', 'red');
 * // document.documentElement.style.setProperty('--font-size', '16px');
 * // Note: It actually sets the direct style property, not a CSS variable,
 * // e.g. document.documentElement.style.backgroundColor = 'red';
 * // To align with the example in the original request (setting on :root),
 * // we will use setProperty on document.documentElement.style.
 */
export function setCssFromUrlParams(): void {
  const params = new URLSearchParams(window.location.search);

  for (const [key, value] of params.entries()) {
    // Convert camelCase to kebab-case
    // Example: backgroundColor -> background-color
    const cssProperty = key.replace(/([A-Z])/g, '-$1').toLowerCase();
    document.documentElement.style.setProperty(cssProperty, value);
  }
}
