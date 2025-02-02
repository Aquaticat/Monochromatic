export default function onDomContentLoaded(): void {
  document.querySelectorAll('details').forEach((details) => {
    details.addEventListener('toggle', () => {
      if (details.hasAttribute('open')) {
        let parentDetails: HTMLDetailsElement | null;
        do {
          parentDetails = details.parentElement!.closest('details:not([open])');

          if (parentDetails) {
            parentDetails.open = true;
          }
        } while (parentDetails !== null);
      }
    });
  });
}
