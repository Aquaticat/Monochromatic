// biome-ignore format: otherwise biome swallows the entire file?
import { autoFocus } from '@monochromatic.dev/module-supports';

if (!autoFocus) {
  document.querySelector('#search')!.addEventListener('toggle', (event) => {
    if (event.newState === 'open') {
      (document.querySelector('input[name="q"]') as HTMLInputElement).focus();
    }
  });
}
