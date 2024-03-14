const header = document.querySelector('header')!!;
const footer = document.querySelector('footer')!!;

// Stolen from https://stackoverflow.com/a/56825511
const addCSS = (css: string) => (document.head.appendChild(document.createElement('style')).innerHTML = css);

addCSS(
  `main {
  min-block-size: calc(100dvb - ${window.getComputedStyle(header).getPropertyValue('block-size')} - ${window
    .getComputedStyle(footer)
    .getPropertyValue('block-size')});
}`,
);
