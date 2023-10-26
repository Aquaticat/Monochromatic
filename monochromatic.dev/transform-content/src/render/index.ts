import {
  DOMParser,
  parseHTML,
} from 'linkedom';

import {
  marked,
} from 'marked';

const render = (file: string, format = 'html'): string => {
  let htmlFile = '';

  switch (format) {
    case 'html':
      {
        htmlFile = file;
      }

      break;

    case 'md':
      {
        htmlFile = marked.parse(file);
      }

      break;

    default: {
      throw TypeError(`${format} is not one of supported types.
      Supported types:
      'html',
      'md' (GitHub flavored markdown),
      'mdx' (Support for mdx is work in progress)`);
    }
  }

  const documentFragment = (new DOMParser())
    .parseFromString(htmlFile, 'text/html');

  const { document } = parseHTML(`
<html lang="en"
  style="
  --light: #f9f9f9;
  --dark: #1b1b1b;
  background-color: black;">
<head>
<meta charset="UTF-8">
<meta name="viewport"
    content="width=device-width">
<title></title>
<link type="text/css"
    rel="stylesheet"
    blocking="render"
    fetchpriority="high"
    href="/index.css">
<script type="module"
      rel="script"
      async
      src="/index.js"></script>
</head>
<body>
</body>
</html>
`);

  document.body.innerHTML = [...documentFragment.children].map((documentFragmentChild) =>
    documentFragmentChild.outerHTML
  ).join('');

  return [...document.children].map((documentChild) => documentChild.outerHTML).join('');
};

export default render;
