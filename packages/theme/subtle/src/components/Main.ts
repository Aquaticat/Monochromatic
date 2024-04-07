export default function onLoad() {
  const header = document.querySelector('header')!;
  const footer = document.querySelector('footer')!;

  document.head.appendChild(document.createElement('style')).innerHTML = `main {
    min-block-size: calc(100dvb - ${window.getComputedStyle(header).getPropertyValue('block-size')} - ${window
      .getComputedStyle(footer)
      .getPropertyValue('block-size')});
    }`;
}
