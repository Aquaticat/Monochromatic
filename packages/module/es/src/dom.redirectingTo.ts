export function onLoadRedirectingTo(delayTime: number = 5000): void {
  const potentialRedirectingToElement: HTMLAnchorElement | null = document
    .querySelector('a.redirectingTo');
  if (potentialRedirectingToElement) {
    setTimeout(function redirect() {
      globalThis.location.replace(
        potentialRedirectingToElement.href,
      );
    }, delayTime);
  }
}
