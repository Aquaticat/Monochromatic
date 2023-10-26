const insertNavFooter = (document: Document): void => {
  const navDetailsWrapperBlock = document.body.querySelector(':scope > nav > details > wrapper-block')!;

  navDetailsWrapperBlock.innerHTML = `
${navDetailsWrapperBlock.innerHTML}

<section id="Jump_to_footer">
  <a href="#footer">Jump to bottom</a>
</section>
  `;
};

export default insertNavFooter;
