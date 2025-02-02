// We only need to check if the destination page exists if we've reached a 404 page and we can recover from it
// or if we are about to redirect user to the supposedly existing page in their own language.

/* flowchart (PlantUML):

@startuml
start

if (q?) then (yes)
  :redirect to duckduckgo.com;
  stop
else (no)
endif

if (first path segment after base, named requestedLang isLang?) then (yes)
  switch (pageType?)
  case (404)
    if (fetch supposedSupportedLangs getting at least one ok) then (yes)
      :set var supportedLangsOfPage;
      :tell user "we don't have that content in requestedLang";
      if (supposedSupportedLangs has requestedLang) then (yes)
        :suggest redirecting to one of supportedLangs of that page;
        stop
      else (no)
        :tell user we don't support requestedLang;
        :suggest redirecting to one of supportedLangs of that page;
        stop
      endif
    else (no)
        :tell user we don't have that content;
        if (supposedSupportedLangs has requestedLang) then (yes)
          :suggest redirecting to homepage in requestedLang;
          stop
        else (no)
          :tell user we don't support requestedLang;
          :suggest redirecting to homepage in one of supportedLangs;
          stop
        endif
    endif
  case (home, default)
    ://we've already checked if the page is 404. Since it's not 404, that means we're at the correct place, nothing to do;
    stop
  endswitch
else (no)

  switch (pageType?)
  case (404)
    if (fetch supposedSupportedLangs getting at least one ok) then (yes)
      if (supposedSupportedLangs and navigator.language has overlap) then (yes)
        :redirect to firstLang of that page;
        stop
      else (no)
        :tell user we don't support any of navigator.language;
        :suggest redirecting to one of supportedLangs of that page;
        stop
      endif
    else (no)
        :tell user we don't have that content;
        if (supposedSupportedLangs and navigator.language has overlap) then (yes)
          :suggest redirecting to homepage in firstLang;
          stop
        else (no)
          :tell user we don't support any of navigator.language;
          :suggest redirecting to homepage in one of supportedLangs;
          stop
        endif
    endif
  case (home, default)
    if (sessionStorage redirectedByLangMatching?) then (yes)
      :that means user had already been redirected by langMatching from home but manually switched back, don't bother them with another redirecting by langMatching again;
      :nothing to do;
      stop
    else (no)
      if (supposedSupportedLangs and navigator.language has overlap) then (yes)
        :set sessionStorage redirectedByLangMatching;
        :redirect to firstLang of that page;
        stop
      else (no)
        :no overlap of language we support and user requested. we can warn user of that but that maybe too obstructive;
        :nothing to do;
        stop
      endif
    endif
  endswitch

endif

@enduml

 */

import isLang from '@monochromatic-dev/module-is-lang';
import consts from '../temp/consts';
import exists from '@monochromatic-dev/module-exists';
import trimEndWith from '@monochromatic-dev/module-trim-end-with';
import trimStartWith from '@monochromatic-dev/module-trim-start-with';
import i18nStr from './i18nStr';
import { filterAsync, piped } from 'rambdax';
import c from '@monochromatic-dev/module-console';

/*
const potentialCode = location.pathname.split('/')[1]!;
const isPotentialCodeLang = isLang(potentialCode);
if (document.head.querySelector('meta[name="title"]')!.getAttribute('content') === '404') {
  const p = document.querySelector('main p')!;
  if (isPotentialCodeLang) {
    if (consts.langs.paths.includes(potentialCode)) {
      // TODO: Change the page content.
      // TODO: Use url builder
      // TODO: Change aside to include potential targets.

      const existing = await filterPromise(
        consts.langs.paths.map(
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
      consts.langs.paths.map((langPath) => trimEndWith(`${location.origin}/${langPath}${location.pathname}`, '/')),
      exists,
    );
    const firstLang = navigator.languages.find(
      (lang) =>
        consts.langs.mappings.has(lang) &&
        existing.includes(
          trimEndWith(`${location.origin}/${consts.langs.mappings.get(lang)}${location.pathname}`, '/'),
        ),
    );

    // If we don't support any of user's languages, just leave it as is.
    if (firstLang !== undefined) {
      const i18nPath = consts.langs.mappings.get(firstLang)!;
      if (i18nPath !== potentialCode) {
        console.log(`Your lang ${firstLang} is available!
        Redirecting to ${trimEndWith(`${location.origin}/${i18nPath}${location.pathname}`, '/')}`);
        sessionStorage.setItem('redirectedByLangMatching', 'true');
        location.href = trimEndWith(`${location.origin}/${i18nPath}${location.pathname}`, '/');
      }
    }
  }
}
*/

// Ensure this script is loaded after q.ts

export const pathSegmentAfterBase = piped(
  location.pathname,
  (val) => trimStartWith(val, '/'),
  (val) => trimStartWith(val, consts.base),
  (val) => trimStartWith(val, '/'),
);

export const firstPathSegmentAfterBase = pathSegmentAfterBase
  ? pathSegmentAfterBase.includes('/')
    ? pathSegmentAfterBase.split('/')[0]!
    : pathSegmentAfterBase
  : '';

export const isFirstPathSegmentAfterBaseLang = isLang(firstPathSegmentAfterBase);

export const pathSegmentAfterBaseWithoutLang = isFirstPathSegmentAfterBaseLang
  ? piped(
      pathSegmentAfterBase,
      (val) => trimStartWith(val, firstPathSegmentAfterBase),
      (val) => trimStartWith(val, '/'),
    )
  : trimStartWith(pathSegmentAfterBase, '/');

export const originWithBase = `${location.origin}/${consts.base}`;

export const originWithBaseWithLang = isFirstPathSegmentAfterBaseLang
  ? `${originWithBase}/${firstPathSegmentAfterBase}`
  : originWithBase;

export const is404 = document.head.querySelector('meta[name="title"]')!.getAttribute('content') === '404';

export const urlsOfActualSupportedLangsForPage = await filterAsync(
  exists,
  consts.langs.paths.map((langPath) =>
    langPath === ''
      ? `${originWithBase}/${pathSegmentAfterBaseWithoutLang}`
      : `${originWithBase}/${langPath}/${pathSegmentAfterBaseWithoutLang}`,
  ),
);

export const actualSupportedLangsForPage: string[] = urlsOfActualSupportedLangsForPage.map((url) => {
  const path = piped(
    url,
    (val) => trimStartWith(val, `${originWithBase}/`),
    (val) => trimEndWith(val, pathSegmentAfterBaseWithoutLang),
    (val) => trimEndWith(val, '/'),
  );
  return path === '' ? consts.langs.defaultLang : path;
});

export const requestedLangs = isFirstPathSegmentAfterBaseLang ? [firstPathSegmentAfterBase] : navigator.languages;

export const isSupportedLangsOverlappingWithRequestedLangs: boolean = consts.langs.langs.some((lang) =>
  requestedLangs.includes(lang),
);

export const isActualSupportedLangsForPageOverlappingWithRequestedLangs: boolean = actualSupportedLangsForPage.some(
  (lang) => requestedLangs.includes(lang),
);

// Only matters if isActualSupportedLangsForPageOverlappingWithRequestedLangs
export const firstActualSupportedRequestedLang = requestedLangs.find((lang) =>
  actualSupportedLangsForPage.includes(lang),
);

export const allHomepages = consts.langs.paths.map((path) => (path ? `${originWithBase}/${path}` : originWithBase));

export default function onDomContentLoaded() {
  if (isFirstPathSegmentAfterBaseLang) {
    const requestedLang = firstPathSegmentAfterBase;
    if (is404) {
      if (actualSupportedLangsForPage.length === 0) {
        if (consts.langs.langs.includes(requestedLang)) {
          c.log(`${originWithBase}/${requestedLang}`);
        } else {
          document.querySelectorAll(`[data-id='unsupported']`).forEach((elm) => {
            elm.removeAttribute('hidden');
          });
          document.querySelectorAll(`[data-id='404']`).forEach((elm) => {
            elm.setAttribute('hidden', 'true');
          });
          c.log(allHomepages);
        }
      } else {
        if (consts.langs.langs.includes(requestedLang)) {
          document.querySelectorAll(`[data-id='tempUnavailable']`).forEach((elm) => {
            elm.removeAttribute('hidden');
          });
          document.querySelectorAll(`[data-id='404']`).forEach((elm) => {
            elm.setAttribute('hidden', 'true');
          });
        } else {
          document.querySelectorAll(`[data-id='unsupported']`).forEach((elm) => {
            elm.removeAttribute('hidden');
          });
          document.querySelectorAll(`[data-id='404']`).forEach((elm) => {
            elm.setAttribute('hidden', 'true');
          });
        }

        /* TODO: Better communicate to user that those are available versions of this page.
                 Maybe use an aside.
                 Maybe we'll have to implement https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Internationalization */
        c.log(urlsOfActualSupportedLangsForPage);
      }
    }
  } else {
    if (is404) {
      if (actualSupportedLangsForPage.length === 0) {
      } else {
        if (isActualSupportedLangsForPageOverlappingWithRequestedLangs) {
          c.log(`${originWithBase}/${firstActualSupportedRequestedLang}`);
        }
      }
    }
  }
}

// TODO: Migrate the fetch-to-check-existance logic to Astro's build step.
