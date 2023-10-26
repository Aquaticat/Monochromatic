const insertNavStructureOnly = (document: Document): void => {
  document.body.innerHTML = `
<nav id="nav">
  <!-- Set it to open in JavaScript,
  because we don't want the navbar to be expanded on mobile devices without JavaScript. -->
  <details>
  <summary>
    <h1>
      <a href="/index.html/#title">Home</a>
    </h1>
  </summary>

  <wrapper-block>
  <a href="#title" id="Skip_to_content">Skip to content</a>

  </wrapper-block>
  </details>
</nav>

${document.body.innerHTML}
`;
};

export default insertNavStructureOnly;
