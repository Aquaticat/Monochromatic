import { e as createAstro, f as createComponent, r as renderTemplate, h as addAttribute, m as maybeRenderHead, o as renderComponent, k as renderSlot, p as renderHead } from "./astro_B03jorkr.mjs";
import "kleur/colors";
import "html-escaper";
import "clsx";
/* empty css                         */
import { C as COLOR, T as TITLE, D as DESCRIPTION, a as DEFAULT_LANG, S as STRINGS, L as LINKS, b as SOCIALS, A as AUTHOR } from "./prerender_F0F3vfVj.mjs";
const $$Astro$d = createAstro("https://monochromatic.dev");
const $$BaseHead = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$d, $$props, $$slots);
  Astro2.self = $$BaseHead;
  const canonicalURL = new URL(Astro2.url.pathname, Astro2.site);
  const { title, description, keywords } = Astro2.props;
  const fullTitle = title === TITLE ? title : `${title} | ${TITLE}`;
  const keywordsStr = keywords?.join();
  const descriptionFallback = description || DESCRIPTION;
  console.log(consts);
  return renderTemplate`<!-- Global Metadata --><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" type="image/svg+xml" href="/favicon.svg"><meta name="generator"${addAttribute(Astro2.generator, "content")}><!-- Canonical URL --><link rel="canonical"${addAttribute(canonicalURL, "href")}><!-- Primary Meta Tags --><title>${fullTitle}</title><meta name="title"${addAttribute(title, "content")}><meta name="description"${addAttribute(descriptionFallback, "content")}><meta name="theme-color"${addAttribute(COLOR, "content")}>${keywords && renderTemplate`<meta name="keywords"${addAttribute(keywordsStr, "content")}>`}
../../../../bak/consts
../../../../bak/scripts/consts`;
}, "/home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/themes/subtle/src/components/BaseHead.astro", void 0);
const $$Astro$c = createAstro("https://monochromatic.dev");
const $$PrettyDate = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$c, $$props, $$slots);
  Astro2.self = $$PrettyDate;
  const { date } = Astro2.props;
  const dateDate = new Date(date);
  const readable = dateDate.toLocaleDateString(void 0, { year: "numeric", month: "short", day: "2-digit" });
  return renderTemplate`${maybeRenderHead()}<time${addAttribute(dateDate.toString(), "datetime")}> ${readable} </time>`;
}, "/home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/themes/subtle/src/components/PrettyDate.astro", void 0);
const $$Astro$b = createAstro("https://monochromatic.dev");
const $$Post = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$b, $$props, $$slots);
  Astro2.self = $$Post;
  const { post } = Astro2.props;
  return renderTemplate`${maybeRenderHead()}<li class="Post a"> <a class="overlay"${addAttribute(post.url, "href")}>${post.frontmatter.title}</a> <div class="Post__content"> <h2>${post.frontmatter.title}</h2> <p class="Post__description">${post.frontmatter.description}</p> <p class="Post__summary">${post.frontmatter.summary}</p> <aside> <ul class="Post__tags"> ${post.frontmatter.tags.map((tag) => renderTemplate`<li class="Post__tag"> <a${addAttribute(`/tag/${tag}`, "href")}> <span>${tag}</span> </a> </li>`)} </ul> <span class="date"> ${renderComponent($$result, "PrettyDate", $$PrettyDate, { "date": post.frontmatter.published })}
-
${renderComponent($$result, "PrettyDate", $$PrettyDate, { "date": post.frontmatter.updated })} </span> </aside> </div> </li>`;
}, "/home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/themes/subtle/src/components/Post.astro", void 0);
const $$Astro$a = createAstro("https://monochromatic.dev");
const Astro = $$Astro$a;
const langsPosts = /* @__PURE__ */ new Map([
  ["", await Astro.glob(/* @__PURE__ */ Object.assign({ "../pages/post/first-post.mdx": () => import("./prerender_F0F3vfVj.mjs").then((n) => n.c), "../pages/post/markdown-style-guide.mdx": () => import("./prerender_F0F3vfVj.mjs").then((n) => n.d), "../pages/post/second-post.mdx": () => import("./prerender_F0F3vfVj.mjs").then((n) => n.e), "../pages/post/third-post.mdx": () => import("./prerender_F0F3vfVj.mjs").then((n) => n.f), "../pages/post/using-mdx.mdx": () => import("./prerender_F0F3vfVj.mjs").then((n) => n.g) }), () => "../pages/post/*.mdx")],
  ["zh", await Astro.glob(/* @__PURE__ */ Object.assign({ "../pages/zh/post/first-post.mdx": () => import("./prerender_F0F3vfVj.mjs").then((n) => n.h), "../pages/zh/post/markdown-style-guide.mdx": () => import("./prerender_F0F3vfVj.mjs").then((n) => n.i), "../pages/zh/post/second-post.mdx": () => import("./prerender_F0F3vfVj.mjs").then((n) => n.j), "../pages/zh/post/using-mdx.mdx": () => import("./prerender_F0F3vfVj.mjs").then((n) => n.k) }), () => "../pages/zh/post/*.mdx")]
]);
const $$Globs = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$a, $$props, $$slots);
  Astro2.self = $$Globs;
  return renderTemplate``;
}, "/home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/themes/subtle/src/components/_globs.astro", void 0);
const $$Astro$9 = createAstro("https://monochromatic.dev");
const $$Posts = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$9, $$props, $$slots);
  Astro2.self = $$Posts;
  const lang = Astro2.currentLocale;
  const posts = Astro2.props.posts || langsPosts.get(lang === DEFAULT_LANG ? "" : lang);
  return renderTemplate`${maybeRenderHead()}<ul class="Posts"> ${posts.map((post) => renderTemplate`${renderComponent($$result, "Post", $$Post, { "post": post })}`)} </ul>
../../../../bak/consts
../../../../bak/scripts/consts`;
}, "/home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/themes/subtle/src/components/Posts.astro", void 0);
const $$Astro$8 = createAstro("https://monochromatic.dev");
const $$Header = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$8, $$props, $$slots);
  Astro2.self = $$Header;
  const lang = Astro2.currentLocale;
  const posts = langsPosts.get(lang === DEFAULT_LANG ? "" : lang);
  const uniqueTags = [...new Set(posts.flatMap((post) => post.frontmatter.tags))];
  const tagPost = new Map(uniqueTags.map((tag) => [tag, posts.filter((post) => post.frontmatter.tags.includes(tag))]));
  const tagPostArr = Array.from(tagPost);
  return renderTemplate`${maybeRenderHead()}<header> <div> <a${addAttribute(`/${lang === DEFAULT_LANG ? "" : lang}`, "href")}> <img src="/favicon.svg" alt="avatar"> </a> <nav> <button popovertarget="search"> <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M18.7441 19.0893L14.03 14.3752M16.8333 9.33333C16.8333 13.0152 13.8486 16 10.1667 16C6.48477 16 3.5 13.0152 3.5 9.33333C3.5 5.65143 6.48477 2.66666 10.1667 2.66666C13.8486 2.66666 16.8333 5.65143 16.8333 9.33333Z" stroke="currentColor" stroke-width="2.5"></path> </svg> </button> <div popover id="search"> <!-- TODO: Handle get requests to this own site https://my-site/?my-query --> <form method="get"> <input autofocus name="q" type="search" required${addAttribute(STRINGS.get("searchPlaceholder").get(lang), "placeholder")}> </form> <ul class="Header__tags"> ${tagPostArr.map(([tag, posts2]) => renderTemplate`<li><details><summary><span>${tag}</span></summary> ${renderComponent($$result, "Posts", $$Posts, { "posts": posts2 })} </details></li>`)} </ul> </div> <a${addAttribute(`${lang === DEFAULT_LANG ? "" : `/${lang}`}/links`, "href")}><span>Links</span></a> </nav> </div> </header>
../../../../bak/consts
../../../../bak/scripts/consts`;
}, "/home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/themes/subtle/src/components/Header.astro", void 0);
const $$Astro$7 = createAstro("https://monochromatic.dev");
const $$Article = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$7, $$props, $$slots);
  Astro2.self = $$Article;
  const { title } = Astro2.props;
  return renderTemplate`${maybeRenderHead()}<article class="Article"> <h1>${title}</h1> ${renderSlot($$result, $$slots["default"])} </article>`;
}, "/home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/themes/subtle/src/components/Article.astro", void 0);
const $$Astro$6 = createAstro("https://monochromatic.dev");
const $$Links = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$6, $$props, $$slots);
  Astro2.self = $$Links;
  const linksArr = Array.from(LINKS);
  return renderTemplate`${maybeRenderHead()}<ul class="Links"> ${linksArr.map((link) => renderTemplate`<li> <a${addAttribute(link[1], "href")}> <span>${link[0]}</span> </a> </li>`)} </ul>
../../../../bak/consts
../../../../bak/scripts/consts`;
}, "/home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/themes/subtle/src/components/Links.astro", void 0);
const $$Astro$5 = createAstro("https://monochromatic.dev");
const $$Aside = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$5, $$props, $$slots);
  Astro2.self = $$Aside;
  const { title } = Astro2.props;
  const isHome = title === TITLE;
  const isMeta = title === "Links";
  const is404 = title === "404";
  return renderTemplate`${maybeRenderHead()}<aside class="Aside"> ${isHome ? renderTemplate`${renderComponent($$result, "Posts", $$Posts, {})}` : isMeta ? renderTemplate`${renderComponent($$result, "Links", $$Links, {})}` : is404 ? renderTemplate`<div class="FourOFour">404</div>` : renderTemplate`<div class="Related">not</div>`} </aside>
../../../../bak/consts
../../../../bak/scripts/consts`;
}, "/home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/themes/subtle/src/components/Aside.astro", void 0);
const $$Astro$4 = createAstro("https://monochromatic.dev");
const $$Main = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$4, $$props, $$slots);
  Astro2.self = $$Main;
  const { title } = Astro2.props;
  return renderTemplate`${maybeRenderHead()}<main> <div> ${renderComponent($$result, "Article", $$Article, { "title": title }, { "default": ($$result2) => renderTemplate` ${renderSlot($$result2, $$slots["default"])} ` })} ${renderComponent($$result, "Aside", $$Aside, { "title": title })} </div> </main>`;
}, "/home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/themes/subtle/src/components/Main.astro", void 0);
const $$Astro$3 = createAstro("https://monochromatic.dev");
const $$ExistencePeriod = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$3, $$props, $$slots);
  Astro2.self = $$ExistencePeriod;
  const allPosts = await Astro2.glob(/* @__PURE__ */ Object.assign({ "../pages/post/first-post.mdx": () => import("./prerender_F0F3vfVj.mjs").then((n) => n.c), "../pages/post/markdown-style-guide.mdx": () => import("./prerender_F0F3vfVj.mjs").then((n) => n.d), "../pages/post/second-post.mdx": () => import("./prerender_F0F3vfVj.mjs").then((n) => n.e), "../pages/post/third-post.mdx": () => import("./prerender_F0F3vfVj.mjs").then((n) => n.f), "../pages/post/using-mdx.mdx": () => import("./prerender_F0F3vfVj.mjs").then((n) => n.g) }), () => "../pages/post/*.mdx");
  const years = allPosts.flatMap((post) => [new Date(post.frontmatter.published).getFullYear(), new Date(post.frontmatter.updated).getFullYear()]);
  const earliestYear = Math.min(...years);
  const latestYear = Math.max(...years);
  return renderTemplate`${maybeRenderHead()}<span class="existence-period"> <time${addAttribute(earliestYear.toString(), "datetime")}>${earliestYear}</time>
-
<time${addAttribute(latestYear.toString(), "datetime")}>${latestYear}</time> </span>`;
}, "/home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/themes/subtle/src/components/ExistencePeriod.astro", void 0);
const $$Astro$2 = createAstro("https://monochromatic.dev");
const $$Socials = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$2, $$props, $$slots);
  Astro2.self = $$Socials;
  const socialsArr = Array.from(SOCIALS);
  return renderTemplate`${maybeRenderHead()}<ul class="socials-list"> ${socialsArr.map((social) => renderTemplate`<li> <a${addAttribute(social[1], "href")}> <span>${social[0]}</span> </a> </li>`)} </ul>
../../../../bak/consts
../../../../bak/scripts/consts`;
}, "/home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/themes/subtle/src/components/Socials.astro", void 0);
const $$Astro$1 = createAstro("https://monochromatic.dev");
const $$Footer = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$1, $$props, $$slots);
  Astro2.self = $$Footer;
  return renderTemplate`${maybeRenderHead()}<footer> <div> <small> <span> <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/deed.en"> <span>CC-BY-NC-SA</span> </a> ${renderComponent($$result, "ExistencePeriod", $$ExistencePeriod, {})} </span> <span> <span>by</span> <a href="/"> <span>${AUTHOR}</span> </a> </span> </small> ${renderComponent($$result, "Socials", $$Socials, {})} <small> <span> <a href="https://monochromatic.dev/subtle"> <span>Subtle</span> </a> <span>@</span> <a href="https://astro.build"> <span>Astro</span> </a> </span> <span> <span>by</span> <a href="https://aquati.cat"> <span>Aquaticat</span> </a> </span> </small> </div> </footer>
../../../../bak/consts
../../../../bak/scripts/consts`;
}, "/home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/themes/subtle/src/components/Footer.astro", void 0);
const $$Astro = createAstro("https://monochromatic.dev");
const $$Global = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Global;
  const { title, description } = Astro2.props.frontmatter;
  const lang = Astro2.currentLocale;
  return renderTemplate`<html${addAttribute(lang, "lang")}> <head>${renderComponent($$result, "BaseHead", $$BaseHead, { "title": title, "description": description })}${renderHead()}</head> <body> ${renderComponent($$result, "Header", $$Header, {})} ${renderComponent($$result, "Main", $$Main, { "title": title }, { "default": ($$result2) => renderTemplate` ${renderSlot($$result2, $$slots["default"])} ` })} ${renderComponent($$result, "Footer", $$Footer, {})} </body></html>`;
}, "/home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/themes/subtle/src/layouts/global.astro", void 0);
export {
  $$Global as default
};
