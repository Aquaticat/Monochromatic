const insertNavArticlesOrH2s = (document: Document) => {
  const navDetailsWrapperBlock = document.body.querySelector(':scope > nav > details > wrapper-block')!;

  if (document.body.querySelectorAll(':scope > wrapper-block > main > article').length >= 2) {
    navDetailsWrapperBlock.innerHTML = `
${navDetailsWrapperBlock.innerHTML}

<section>
<h2>
On this page:
</h2>

<ol>
${
      [...document.body.querySelectorAll(':scope > wrapper-block > main > article')].map((article) => `
<li>
<a href="#${article.id || '1'}">${article.querySelector(':scope > wrapper-block > h1')!.textContent}</a>
</li>
`).join('')
    }
</ol>
</section>
    `;
  }
  else if (
    document.body.querySelectorAll(':scope > wrapper-block > main > article > wrapper-block > section > h2').length
      >= 2
  ) {
    navDetailsWrapperBlock.innerHTML = `
${navDetailsWrapperBlock.innerHTML}

<section>
<h2>
On this page:
</h2>

<ol>
${
      [...document.body.querySelectorAll(':scope > wrapper-block > main > article > wrapper-block > section:has(> h2)')]
        .map(
          (
            h2Section,
          ) => `
<li>
<a href="#${h2Section.id || '1'}">${h2Section.querySelector(':scope > h2')!.textContent}</a>
</li>
`,
        )
        .join(
          '',
        )
    }
</ol>
</section>
      `;
  }
};

export default insertNavArticlesOrH2s;
