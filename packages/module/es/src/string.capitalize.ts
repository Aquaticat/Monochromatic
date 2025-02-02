// From https://stackoverflow.com/a/53930826 under https://creativecommons.org/licenses/by-sa/4.0/

export function capitalize(str: string, locale?: string): string {
  return str.replace(/^\p{CWU}/u, (char) => char.toLocaleUpperCase(locale));
}
