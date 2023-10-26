import createElementFromSelector from '@aquaticat/create-element-from-selector';

{
  document.querySelector('body > wrapper-block')!
    .addEventListener('click', () => {
      document.querySelector('body > #nav > details')!
        .removeAttribute('open');
    });
}
