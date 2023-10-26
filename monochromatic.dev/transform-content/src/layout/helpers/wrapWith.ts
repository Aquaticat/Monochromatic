/* FIXME: Do not wrap with wrapper at the start.
          Right, maybe I should just do a check: if there is no separator, then just skip this
          No, that won't work, that way I cannot just wrap something.
          Okay, I think I got it:
          If the separator is specified but not found, then just skip this.
          If the separator is specified and found, then do it normally, but do not wrap what is above the first separator.
          If the separator is unspecified, do not skip the process of wrapping. */

/**
 * @param {Document} document
 *
 * @param {string} wrapperTagName
 *
 * @param {string} separatorTagName
 *
 *                 Defaults to an empty string
 *                 (means no separated wrapping separated by separator)
 *                 if this parameter is not provided or is an empty string.
 *
 * @param {string} parentSelectors
 *
 *                 Defaults to an empty string (means <body>)
 *                 if this parameter is not provided or is an empty string.
 *                 Scoped to `document.body`, so don't include 'body' at the start!
 *                 To target direct children of body (first), include '>' at the start.
 */
const wrapWith = (document: Document, wrapperTagName: string, separatorTagName = '', parentSelectors = ''): void => {
  /* console.debug('\n\nwrapWith\n', (parentSelectors
                                      ? [...document.body.querySelectorAll(`:scope ${parentSelectors}`)]
                                      : [document.body])); */

  (parentSelectors
    ? [...document.body.querySelectorAll(`:scope ${parentSelectors}`)]
    : [document.body])
    .forEach((parentElement) => {
      parentElement.innerHTML = separatorTagName
        ? [...parentElement.querySelectorAll(':scope > *')]
          .reduce((html, htmlElement) => {
            const trimmedHtml = html.trim();

            if (trimmedHtml) {
              if (htmlElement.localName === separatorTagName) {
                return `
${trimmedHtml}
</${wrapperTagName}>

<${wrapperTagName}>
${htmlElement.outerHTML}
`;
              }

              return `
${trimmedHtml}
${htmlElement.outerHTML}
`;
            }

            if (htmlElement.localName === separatorTagName) {
              return `
<${wrapperTagName}>
${htmlElement.outerHTML}
`;
            }

            return htmlElement.outerHTML;
          }, '')
        : `
<${wrapperTagName}>
${parentElement.innerHTML}
</${wrapperTagName}>
`;
    });
};

export default wrapWith;
