// Hand-authored to match typesafe-i18n generator output.
/* eslint-disable */

import { initFormatters, } from './formatters.ts';
import type {
  Locales,
  Translations,
} from './i18n-types.ts';
import {
  loadedFormatters,
  loadedLocales,
  locales,
} from './i18n-util.ts';

import en from './en/index.ts';
import ja from './ja/index.ts';
import ru from './ru/index.ts';
import zh from './zh/index.ts';

const localeTranslations = {
  en,
  zh,
  ja,
  ru,
};

export const loadLocale = (locale: Locales,): void => {
  if (loadedLocales[locale])
    return;

  loadedLocales[locale] = localeTranslations[locale] as unknown as Translations;
  loadFormatters(locale,);
};

export const loadAllLocales = (): void => locales.forEach(loadLocale,);

export const loadFormatters = (locale: Locales,): void =>
  void (loadedFormatters[locale] = initFormatters(locale,));
