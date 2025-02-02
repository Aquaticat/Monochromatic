import { autoFocus } from '@monochromatic-dev/module-dom/ts';

type HTMLPopoverElement = {
  addEventListener: (
    type: string,
    callback: (event: { newState: 'open' | 'closed'; }) => void,
  ) => void;
} & HTMLDivElement;

export default function onDomContentLoaded() {
  const search: HTMLPopoverElement = document.querySelector('#search')!;

  if (autoFocus()) {
    search.querySelector('input[name=q]')!.setAttribute('autofocus', 'true');
  } else {
    search.addEventListener('toggle', (event) => {
      if (event.newState === 'open') {
        (document.querySelector('input[name="q"]') as HTMLInputElement).focus();
      }
    });
  }
}
