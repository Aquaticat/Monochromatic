import { autoFocus } from '@monochromatic.dev/module-supports';

if (!autoFocus) {
  document.querySelector('#search')!.addEventListener('toggle', (event) => {
    if (event.newState === 'open') {
      document.querySelector('input[name="q"]')!.focus();
    }
  });
}
