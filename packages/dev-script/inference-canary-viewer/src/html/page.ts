/**
 * Top-level HTML document shell.
 *
 * Produces a complete `<!DOCTYPE html>` page linking to the external stylesheet.
 * All content is static -- viewable with JavaScript disabled.
 */

/**
 * Wraps body content in a full HTML document.
 * @param body - inner body HTML
 * @param title - page title
 * @returns complete HTML document string
 */
export function renderPage(body: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <title>${title}</title>
  <style>html { background-color: light-dark(#fafafa, #1a1a1a) }</style>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header class="site-header">
    <h1>${title}</h1>
  </header>
  <main>
    ${body}
  </main>
</body>
</html>`;
}
