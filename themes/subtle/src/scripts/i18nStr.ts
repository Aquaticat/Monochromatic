import consts from '../../consts';

const i18nStr = (id: string) => {
  const firstLang = navigator.languages.find((lang) => consts.strings.has(lang) && consts.strings.get(lang).has(id));

  return consts.strings.get(firstLang || consts.langs.defaultLang)!.get(id)!;
};

export default i18nStr;
