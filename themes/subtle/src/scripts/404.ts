// We only need to check if the destination page exists if we've reached a 404 page and we can recover from it
// or if we are about to redirect user to the supposedly existing page in their own language.

import isLang from '@monochromatic.dev/module-is-lang';
import { I18N, LANG_PATHS } from '../consts';
import exists from '@monochromatic.dev/module-exists';
import trimEndWith from '@monochromatic.dev/module-trim-end-with';
import filterPromise from '@monochromatic.dev/module-filter-promise';
import i18nStr from './i18nStr';

const potentialCode = location.pathname.split('/')[1]!;
const isPotentialCodeLang = isLang(potentialCode);
if (document.head.querySelector('meta[name="title"]')!.getAttribute('content') === '404') {
  const p = document.querySelector('main p')!;
  if (isPotentialCodeLang) {
    if (LANG_PATHS.includes(potentialCode)) {
      // TODO: Change the page content.
      // TODO: Use url builder
      // TODO: Change aside to include potential targets.

      const existing = await filterPromise(
        LANG_PATHS.map(
          (langPath) => `${location.origin}/${langPath}${location.pathname.split('/').slice(2).join('/')}`,
        ),
        exists,
      );
      p.textContent = i18nStr('tempUnavailable');

      console.log(`Sorry, this page isn't available in the language ${potentialCode} yet, please check back later.
      Meanwhile you can check out this page in ${existing}`);
    } else {
      p.textContent = i18nStr('unsupported');
      console.log(`Sorry, this site doesn't support the language ${potentialCode}`);
    }
  } else {
    document.querySelector('main p')!.textContent = i18nStr('404');
  }
} else {
  // find first navigator lang matching available

  // In this situation, we only want to redirect when potentialCode isn't lang AND when the redirect target actually exists AND when the user isn't already redirected by lang matching AND when the user went back to browse the default lang page after being redirected.
  if (!sessionStorage.getItem('redirectedByLangMatching') && !isPotentialCodeLang) {
    const existing = await filterPromise(
      LANG_PATHS.map((langPath) => trimEndWith(`${location.origin}/${langPath}${location.pathname}`, '/')),
      exists,
    );
    const firstLang = navigator.languages.find(
      (lang) =>
        I18N.has(lang) &&
        existing.includes(trimEndWith(`${location.origin}/${I18N.get(lang)}${location.pathname}`, '/')),
    );

    // If we don't support any of user's languages, just leave it as is.
    if (firstLang !== undefined) {
      const i18nPath = I18N.get(firstLang)!;
      if (i18nPath !== potentialCode) {
        console.log(`Your lang ${firstLang} is available!
        Redirecting to ${trimEndWith(`${location.origin}/${i18nPath}${location.pathname}`, '/')}`);
        sessionStorage.setItem('redirectedByLangMatching', 'true');
        location.href = trimEndWith(`${location.origin}/${i18nPath}${location.pathname}`, '/');
      }
    }
  }
}
