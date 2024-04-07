type constsType = {
  title: string;
  description: string;
  author: string;
  site: string;
  base: string;
  theming: { color: string; shiki: { light: string; dark: string } };
  socials: ReadonlyMap<string, string>;
  links: ReadonlyMap<string, string>;
  langs: {
    defaultLang: string;
    paths: readonly ['', ...string[]];
    langs: readonly string[];
    mappings: ReadonlyMap<string, string>;
  };
  strings: ReadonlyMap<string, ReadonlyMap<string, string>>;
};

const consts: constsType = Object.freeze(
  Object.fromEntries([
    [`title`, `Subtle`],
    [`description`, `Personal Blog Theme for Astro`],
    [`author`, `Aquaticat`],
    [`site`, `https://monochromatic.dev`],
    [`base`, `subtle`],
    [
      `theming`,
      Object.freeze(
        Object.fromEntries([
          [`color`, `#966783`],
          [
            `shiki`,
            Object.freeze(
              Object.fromEntries([
                [`light`, `github-light`],
                [`dark`, `github-dark`],
              ]),
            ),
          ],
        ]),
      ),
    ],
    [
      `socials`,
      Object.freeze(
        new Map([
          [`RSS Feed`, `https://aquati.cat/rss`],
          [`Email`, `mailto:an@aquati.cat?subject=Email author of Monochromatic/Subtle`],
          [`GitHub`, `https://github.com/Aquaticat`],
          [`Telegram`, `https://t.me/Aquaticat`],
        ]),
      ),
    ],
    [
      `links`,
      Object.freeze(
        new Map([
          [`Catoverflow`, `https://c-j.dev`],
          [`dummy1`, `https://example.com`],
          [`big dummy2`, `https://example.com`],
          [`big big dummy1`, `https://example.com`],
          [`big big dummy2`, `https://example.com`],
          [`dummy3`, `https://example.com`],
          [`dummy4`, `https://example.com`],
          [`dummy5`, `https://example.com`],
          [`dummy6`, `https://example.com`],
        ]),
      ),
    ],
    [
      `langs`,
      Object.freeze(
        Object.fromEntries([
          [`defaultLang`, `en`],
          [`paths`, Object.freeze([``, `zh`])],
          [`langs`, Object.freeze([`en`, `zh`])],
          [
            `mappings`,
            Object.freeze(
              new Map([
                [`en`, ``],
                [`en-US`, ``],
                [`en-CA`, ``],
                [`en-UK`, ``],
                [`en-GB`, ``],
                [`zh`, `zh`],
                [`zh-CN`, `zh`],
                [`zh-TW`, `zh`],
              ]),
            ),
          ],
        ]),
      ),
    ],
    [
      `strings`,
      Object.freeze(
        new Map([
          [
            `en`,
            Object.freeze(
              new Map([
                [`404`, `You've landed on an unknown page.`],
                [`tempUnavailable`, `Sorry, this page is not available in your language yet. Please check back later`],
                [`unsupported`, `Sorry, this site is not available in your language.`],
                [`searchPlaceholder`, `Search tags, topics, or snippets`],
              ]),
            ),
          ],
          [
            `zh`,
            Object.freeze(
              new Map([
                [`404`, `未知领域`],
                [`tempUnavailable`, `抱歉，此页暂时无所选语言的版本，请稍后再看。`],
                [`unsupported`, `抱歉，此网站不支持所选语言。`],
                [`searchPlaceholder`, `搜索关键词，话题，或文段`],
              ]),
            ),
          ],
        ]),
      ),
    ],
  ]),
) as constsType;

export default consts;
