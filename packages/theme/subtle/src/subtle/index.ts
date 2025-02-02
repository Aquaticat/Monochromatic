import dataIdOnDomContentLoaded from '@monochromatic-dev/snippet-data-id';
import expandAllDetailsOnDomContentLoaded from '@monochromatic-dev/snippet-expand-all-details';
import prefersOnDomContentLoaded from '@monochromatic-dev/snippet-prefers';
import qOnDomContentLoaded from '@monochromatic-dev/snippet-q-duckduckgo';
import headerOnDomContentLoaded from '../_/Header';
import mainOnLoad from '../_/Main';
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
