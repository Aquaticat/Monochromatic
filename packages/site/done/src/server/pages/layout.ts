type LayoutOptions = {
  title: string;
  heading: string;
  entryScriptPath: string;
  pageData: unknown;
  hideTopNav?: boolean;
};

function serializePageData(data: unknown): string {
  return JSON.stringify(data).replaceAll("<", "\\u003c");
}

export function renderPage(options: LayoutOptions): Response {
  const topNav = options.hideTopNav
    ? ""
    : `<top-nav heading="${options.heading}"></top-nav>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${options.title}</title>
</head>
<body>
  <side-drawer id="drawer"></side-drawer>
  <div class="page-wrapper">
    ${topNav}
    <main id="app"></main>
  </div>
  <script type="application/json" id="page-data">${serializePageData(options.pageData)}</script>
  <script type="module" src="${options.entryScriptPath}"></script>
  <script>
    document.addEventListener('menu-open', function() {
      var drawer = document.getElementById('drawer');
      if (drawer) drawer.open = true;
    });
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
