const removeXVariables = (document: Document) => {
  document.body.querySelector(':scope x-variables')?.remove();
};

export default removeXVariables;
