const insertFooter = (document: Document): void => {
  document.body.innerHTML = `
${document.body.innerHTML}

<footer id="footer">
<section id="#Powered_By">
<h1>
  Powered By:
</h1>

<ul>
  <li>
    <a href="https://monochromatic.dev/">Monochromatic</a> @ <a href="https://aquati.cat/">Aquaticat</a>
  </li>
</ul>
</section>

<section id="#Copyright">
<h1>
  Copyright:
</h1>

<ul>
  <li>
    <a href="https://anonymous.invalid">d</a> ©
    <address>
      <a href="https://anonymous.invalid/">e</a>
      <a href="mailto:anonymous@anonymous.invalid">✉</a>
    </address>
  </li>
</ul>
</section>
</footer>
`;
};

export default insertFooter;
