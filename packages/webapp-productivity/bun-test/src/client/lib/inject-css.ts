// Injects a CSS string into a <style> tag in <head>.
// Called once per page entrypoint to load styles.
export function injectCSS(css: string): void {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);
}
