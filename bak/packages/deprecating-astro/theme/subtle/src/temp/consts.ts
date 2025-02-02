type constsType = {
  title: string;
  description: string;
  author: {
    name: string;
    url: string;
  };
  site: string;
  base: string;
  license: {
    name: string;
    url: string;
  };
  theming: { color: string; shiki: { light: string; dark: string } };
  socials: ReadonlyMap<string, string>;
  links: ReadonlyMap<string, string>;
  strings: ReadonlyMap<string, ReadonlyMap<string, string>>;
};

const consts: constsType = Object.freeze(Object.fromEntries([[`title`, `Subtle`],[`description`, `Personal Blog Theme for Astro`],[`author`, Object.freeze(Object.fromEntries([[`name`, `Aquaticat`],[`url`, `https://aquati.cat`]]))],[`site`, `https://monochromatic.dev`],[`base`, `subtle`],[`license`, Object.freeze(Object.fromEntries([[`name`, `Creative Commons Attribution Share Alike 4.0 International`],[`url`, `https://creativecommons.org/licenses/by-sa/4.0/legalcode`]]))],[`theming`, Object.freeze(Object.fromEntries([[`color`, `#966783`],[`shiki`, Object.freeze(Object.fromEntries([[`light`, `github-light`],[`dark`, `github-dark`]]))]]))],[`socials`, Object.freeze(new Map([[`RSS Feed`, `https://aquati.cat/rss`],[`Email`, `mailto:an@aquati.cat?subject=Email author of Monochromatic/Subtle`],[`GitHub`, `https://github.com/Aquaticat`],[`Telegram`, `https://t.me/Aquaticat`]]))],[`links`, Object.freeze(new Map([[`Catoverflow`, `https://c-j.dev`],[`dummy1`, `https://example.com`],[`big dummy2`, `https://example.com`],[`big big dummy1`, `https://example.com`],[`big big dummy2`, `https://example.com`],[`dummy3`, `https://example.com`],[`dummy4`, `https://example.com`],[`dummy5`, `https://example.com`],[`dummy6`, `https://example.com`]]))],[`strings`, Object.freeze(new Map([[`en`, Object.freeze(new Map([[`searchPlaceholder`, `Search tags, topics, or snippets with DuckDuckGo`]]))],[`zh`, Object.freeze(new Map([[`searchPlaceholder`, `搜索关键词，话题，或文段（DuckDuckGo）`]]))]]))]])) as constsType;

export default consts;