export const isShortLang = function isShortLang(str: string) {
  return str.length === 2 && /^[a-z]+$/.test(str);
};

export const isFullLang = function isFullLang(str: string) {
  return str.length === 5 && /^[a-z]{2}-[A-Z]{2}$/.test(str);
};

export default function isLang(str: string) {
  return isShortLang(str) || isFullLang(str);
}
