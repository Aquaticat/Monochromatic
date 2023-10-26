const documentString = (document: Document): string =>
  [...document.children].map((documentChild) => documentChild.outerHTML)
    .join('');

export default documentString;
