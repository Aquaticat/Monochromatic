const potentialRedirectingToElement: HTMLAnchorElement | null = document
  .querySelector('a.redirectingTo');
if (potentialRedirectingToElement) {
  setTimeout(function redirect() {
    window.location.replace(
      potentialRedirectingToElement.href,
    );
  }, 5000);
}
