/**
 * Static UI label vocabulary for the Aquaticat site.
 *
 * Every key is a plain, static UI string with no interpolation, plural,
 * or formatter behaviour, so each maps to a `label` entry in
 * `@monochromatic-dev/module-i18n-compose` rather than a noun, verb, or
 * subject. The union is shared verbatim across the `ca`, `en`, and `zh`
 * locale tables; `createI18n` rejects any locale whose label table omits
 * a key another locale defines.
 *
 * @module
 */

/**
 * Consumer-owned label key union; identical across every supported locale.
 */
export type Label =
  | 'siteName'
  | 'siteDescription'
  | 'chooseALang'
  | 'searchPlaceholder'
  | 'noResults'
  | 'page'
  | 'postNotInLang'
  | 'redirectingToLangChooser'
  | 'themeToggle'
  | 'langSwitcher'
  | 'published'
  | 'updated';
