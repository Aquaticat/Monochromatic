const insertHeaderStructureOnly = (document: Document): void => {
  document.body.innerHTML = `
<header>
<hgroup>
<h1>
</h1>
</hgroup>
</header>

${document.body.innerHTML}
    `;
};

export default insertHeaderStructureOnly;
