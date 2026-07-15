# Generalize ssg-test into @monochromatic-dev/ssg

Extract the site-specific data from ssg-test so it becomes a publishable,
general-purpose static site generator.
The Aquaticat blog content moves to a new sibling package (`site-aquaticat`).

## Phase 1: Define the config schema and `defineConfig`

**Goal**:
 Create a Zod schema for site config and export a `defineConfig` helper.

The SSG looks for `site.config.ts` in the current working directory by convention.

- [ ] Create `src/config/schema.ts` with a Zod schema covering:
  - `url` (string,
     required):
     site base URL
  - `contentDir` (string,
     default `'content'`):
     path to MDX content directory,
     relative to config file
  - `languages` (record of language code to `{ siteName, siteDescription, i18n? }`,
     required)
    - `i18n` is an optional partial record of UI string keys to override values
    - All UI string keys (`chooseALang`,
       `searchPlaceholder`,
       `noResults`,
       `page`,
      `postNotInLang`,
       `redirectingToLangChooser`,
       `themeToggle`,
       `langSwitcher`) are optional;
      SSG defaults fill in anything not provided
  - `tickerQuotes` (string array,
     required):
     footer ticker content
  - `favicon.source` (string,
     default `'public/favicon.svg'`):
     path to source SVG
  - `favicon.backgroundColor` (object `{ r, g, b }`,
     required):
     background for apple-touch/maskable icons
- [ ] Create `src/config/load.ts` that resolves `site.config.ts` from `process.cwd()` and validates with the schema
- [ ] Export `defineConfig` from the package entry point for type-safe config authoring

### Values that stay as SSG defaults (not configurable)

These are standard web conventions or internal implementation details:

- Favicon output paths (`favicon.ico`,
   `apple-touch-icon.png`,
   etc.)
- Icon dimensions (180px apple,
   192/512px PWA)
- Maskable safe zone (409px)
- SVG render density (384px)
- Output directory (`dist`)
- Public directory (`public`)
- Pipeline source paths for cache invalidation
- All CSS design tokens (overridden via CSS custom properties,
   not config)

### typesafe-i18n UI strings: SSG defaults, user-overridable

The SSG ships these as defaults.
 Users can override any of them per language
via `config.languages[lang].i18n`:

- `chooseALang` (default:
   `'choose a language'` / `'语言选择'`)
- `searchPlaceholder` (default:
   `'Search keyword, topic, text'` / `'搜索关键词，话题，或文段'`)
- `noResults` (default:
   `'No results'` / `'无结果'`)
- `page` (default:
   `'page'` / `'页面'`)
- `postNotInLang` (default:
   `"Post doesn't exist in specified language"` / `'无该语言的页面'`)
- `redirectingToLangChooser` (default:
   `'Choose a language for'` / `'的语言选择'`)
- `themeToggle` (default:
   `'Invert theme'` / `'反转主题'`)
- `langSwitcher` (default:
   `'Switch language'` / `'切换语言'`)

## Phase 2: Thread config through the build pipeline

**Goal**:
 Replace every hardcoded site-specific constant with a value read from the config object.

### `src/build.ts`

- [ ] Remove `const SITE_URL = 'https://aquati.cat'` (`src/build.ts:62`):
       read from `config.url`
- [ ] Remove `const CONTENT_DIR = 'src/content'` (`src/build.ts:66`):
       read from `config.contentDir`
- [ ] Load config at the top of the build script via `loadConfig()`
- [ ] Pass config (or relevant fields) to every function that currently reads a hardcoded value

### `src/i18n/`

- [ ] Remove `siteName` and `siteDescription` from `en/index.ts` and `zh/index.ts`
- [ ] At build time,
       deep-merge three layers into each typesafe-i18n translation object:
      1.
       SSG default UI strings (built-in `chooseALang`,
       `searchPlaceholder`,
       etc.)
      2.
       `config.languages[lang].siteName` and `config.languages[lang].siteDescription`
      3.
       `config.languages[lang].i18n` overrides (if present)
- [ ] Update `i18n-types.ts` to include `siteName` and `siteDescription` as fields
      that come from the merged config,
       not from the base translation

### `src/component/site-footer.ts`

- [ ] Remove or parameterize the hardcoded `TICKER_QUOTES` array
- [ ] Pass ticker quotes into the footer renderer from config

### `src/build/render.ts`

- [ ] Remove hardcoded `SVG_SOURCE` path (`src/build/render.ts:9`):
       read from `config.favicon.source`
- [ ] Remove hardcoded `BACKGROUND` color (`src/build/render.ts:12-18`):
       read from `config.favicon.backgroundColor`

### `src/lib/rss.ts`

- [ ] Confirm site URL is already passed as a parameter (not hardcoded in this file)
- [ ] If not,
       thread `config.url` through

### Functions that need a config parameter added

Approximately 10 functions across these files:

- `build.ts` (orchestrator)
- `build/assets.ts` (CSS,
   RSS,
   static files)
- `build/favicon.ts` (only if source/background are referenced)
- `build/render.ts` (SVG rendering)
- `templates/footer.ts` (ticker quotes)
- `templates/layout.ts` (passes data to header/footer)
- `templates/head.ts` (if site name is used in `<title>`)
- `pages/index.ts`,
   `pages/lang.ts`,
   `pages/post.ts`,
   `pages/name.ts` (pass config to templates)

## Phase 3: Separate content into site-aquaticat

**Goal**:
 Create `packages/webapp-content/site-aquaticat/` containing only Aquaticat-specific content and config.

- [ ] Create `packages/webapp-content/site-aquaticat/` with:
  - `package.json` depending on `@monochromatic-dev/ssg` via `workspace:*`
  - `mise.toml` with build/dev tasks that invoke the SSG
  - `site.config.ts` with Aquaticat-specific values
  - `content/en/*.mdx` (moved from `ssg-test/src/content/en/`)
  - `content/zh/*.mdx` (moved from `ssg-test/src/content/zh/`)
  - `public/` (moved from `ssg-test/public/`:
     favicon source,
     static images)
  - `Caddyfile` (moved from `ssg-test/`)
- [ ] Move all MDX content files
- [ ] Move all static assets (images,
       favicon SVG)
- [ ] Move `Caddyfile` (dev server config is site-specific)
- [ ] Verify the site builds and serves correctly from the new package

### `site.config.ts` content

```typescript
import { defineConfig, } from '@monochromatic-dev/ssg';

export default defineConfig({
  url: 'https://aquati.cat',
  contentDir: 'content',
  languages: {
    en: {
      siteName: 'Aquaticat',
      siteDescription: 'Changing the world, one design at a time',
      // i18n overrides are optional -- SSG defaults apply for omitted keys
      // i18n: {
      //   searchPlaceholder: 'Find posts...',
      //   themeToggle: 'Toggle dark mode',
      // },
    },
    zh: {
      siteName: 'Aquaticat',
      siteDescription: '用设计改变世界',
    },
  },
  tickerQuotes: [
    'flavor text flavored flavorless',
    'sloppiest sloppy slop',
    'programmable blogging program programmed for blogging',
    'ErrorError: ErrorError in erroring Error to ErrorError',
    'pipeline operator stuck in pipeline',
  ],
  favicon: {
    source: 'public/favicon.svg',
    backgroundColor: { r: 45, g: 27, b: 78, },
  },
},);
```

## Phase 4: Rename and restructure the SSG package

**Goal**:
 Rename `ssg-test` to `ssg` and update all references.

- [ ] Rename directory `packages/ssg/aquati.cat/` to `packages/webapp-content/ssg/`
- [ ] Update `package.json` name to `@monochromatic-dev/ssg`
- [ ] Add proper `exports` field for the public API (`defineConfig`,
       build entry point)
- [ ] Update `pnpm-workspace.yaml` if the path is listed explicitly
- [ ] Update any cross-references in other packages or root config
- [ ] Remove `src/content/` directory (now lives in site-aquaticat)
- [ ] Remove content-specific entries from `.gitignore` if any

## Phase 5: Publish preparation

**Goal**:
 Make the package publishable to npm.

- [ ] Add `README.md` documenting:
       what it is,
       how to create a site,
       config reference
- [ ] Ensure `package.json` has correct `files`,
       `main`/`exports`,
       `license`,
       `repository` fields
- [ ] Add `prepublishOnly` script or mise task that builds the package
- [ ] Verify a clean install + build works from the site-aquaticat package
- [ ] Run linting with zero errors
- [ ] Confirm tests pass (add tests if coverage is missing for config loading)

## Estimated effort

- **Phase 1** (config schema):
   ~2 hours
- **Phase 2** (threading config):
   ~4 hours;
   most files,
   but each change is small
- **Phase 3** (content separation):
   ~2 hours;
   file moves + verification
- **Phase 4** (rename):
   ~1 hour
- **Phase 5** (publish prep):
   ~2 hours

**Total**:
 roughly 1.5 days of focused work.
The risk is low:
 no architectural changes,
 just plumbing a config object through existing code.
