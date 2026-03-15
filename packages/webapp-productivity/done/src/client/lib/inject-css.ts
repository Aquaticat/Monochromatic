/**
 * Injects the compiled global stylesheet into the document `\<head\>`.
 *
 * Each client entry script imports `dist/css/styles.css` as a text string
 * (via `with \{ type: "text" \}` import attribute) and passes it here.
 * This avoids a network request for the CSS -- it's inlined in the JS bundle.
 *
 * @param css - Compiled CSS text to inject
 */
export function injectCSS(css: string,): void {
  const styleElement = document.createElement('style',);
  styleElement.textContent = css;
  document.head.append(styleElement,);
}
