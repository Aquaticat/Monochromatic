export function injectCSS(css: string): void {
  const styleElement = document.createElement("style");
  styleElement.textContent = css;
  document.head.append(styleElement);
}
