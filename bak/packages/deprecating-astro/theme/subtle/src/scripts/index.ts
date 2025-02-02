import expandAllDetailsOnDomContentLoaded from '@monochromatic-dev/snippet-expand-all-details';
import prefersOnDomContentLoaded from '@monochromatic-dev/snippet-prefers';
import qOnDomContentLoaded from '@monochromatic-dev/snippet-q-duckduckgo';
import dataIdOnDomContentLoaded from '@monochromatic-dev/snippet-data-id';
import mainOnLoad from '@components/Main.ts';
import headerOnDomContentLoaded from '@components/Header.ts';
// import fourOFourOnDomContentLoaded from './404.ts';

document.addEventListener('DOMContentLoaded', () => {
  qOnDomContentLoaded();
  // fourOFourOnDomContentLoaded();
  headerOnDomContentLoaded();
  dataIdOnDomContentLoaded();
  prefersOnDomContentLoaded();
  expandAllDetailsOnDomContentLoaded();
});

window.addEventListener('load', () => {
  mainOnLoad();
});
