import { DEFAULT_LANG, STRINGS } from '../consts';

const i18nStr = (id: string) => {
  const firstLang = navigator.languages.find((lang) => STRINGS.get(id)!.has(lang));

  return STRINGS.get(id)!.get(firstLang || DEFAULT_LANG)!;
};

export default i18nStr;
