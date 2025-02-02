import {
  fs,
  path,
} from '@monochromatic-dev/module-fs-path';
import isLang from '@monochromatic-dev/module-is-lang';
import * as chrono from 'chrono-node';
import { findUp } from 'find-up';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { toString as mdastToString } from 'mdast-util-to-string';
import { tryCatchAsync } from 'rambdax';
import * as spdxLicenseList from 'spdx-license-list/spdx.json' with { type: 'json' };
import { z } from 'zod';

// @ts-expect-error No, spdxLicenseList is in fact wrapped in a default json.
const spdxLicenseMap = new Map(Object.entries(spdxLicenseList.default));

export const zChronoDate = z.preprocess(
  (maybeDate) =>
    maybeDate instanceof Date ? maybeDate : (chrono.parseDate(String(maybeDate))),
  z.date(),
);

export const zAuthor = z.object({ name: z.string(), url: z.string().url() }).strict();

export const zBlame = z.object({ date: zChronoDate, author: zAuthor }).strict().pipe(
  z.object({ date: z.date(), author: zAuthor }),
);

export const zBlames = z.array(zBlame).nonempty().pipe(
  z.array(z.object({ date: z.date(), author: zAuthor })).nonempty(),
);

const zPost = z
  .object({
    //region Injected by @monochromatic-dev/esbuild-plugin-toml

    path: z.object({ dir: z.string(), name: z.string() }),

    pkgJsonAbsPath: z.string(),

    //endregion

    author: zAuthor,

    earliest: z.optional(zChronoDate),

    isHome: z.optional(z.boolean()),
    isLinks: z.optional(z.boolean()),
    is404: z.optional(z.boolean()),
    isPost: z.optional(z.boolean()),

    lang: z.string(),

    latest: z.optional(zChronoDate),

    license: z
      .union([
        z
          .string()
          .transform((val, ctx) => {
            const license = spdxLicenseMap.get(val);

            if (!license) {
              ctx.addIssue(
                {
                  code: z.ZodIssueCode.custom,
                  message: `${val} not one of ${
                    JSON.stringify(Array.from(spdxLicenseMap.keys()))
                  }`,
                },
              );
              return z.NEVER;
            }

            return license;
          }),
        z.object({ name: z.string(), url: z.string().url() }),
      ])
      .pipe(z.object({ name: z.string(), url: z.string().url() }).readonly()),

    links: z
      .union([
        z
          .record(z.string(), z.string().url())
          .transform((val) => new Map(Object.entries(val))),
        z.map(z.string(), z.string().url()),
      ])
      .pipe(z.map(z.string(), z.string().url()))
      .readonly(),

    updated: z.optional(z.unknown()),

    published: z.optional(z.unknown()),

    site: z.string().url(),

    siteTitle: z.string(),

    socials: z
      .union([
        z
          .record(z.string(), z.string().url())
          .transform((val) => new Map(Object.entries(val))),
        z.map(z.string(), z.string().url()),
      ])
      .pipe(z.map(z.string(), z.string().url()))
      .readonly(),

    tags: z.array(z.string()).default([]),

    theming: z
      .object({ color: z.string() }),

    title: z.string(),
  })
  .passthrough()
  .transform(async function ensureDependents(zBase) {
    return {
      ...zBase,

      defaultLang: zBase.lang,

      description: z.string().default(zBase.title).parse(zBase.description),

      earliest: zBase.earliest
        ? zBase.earliest
        : await zChronoDate.parseAsync(
          (await fs.stat(path.join(zBase.pkgJsonAbsPath, 'package.json'))).ctime,
        ),

      frontmatterPath: path.relative(
        path.join(zBase.pkgJsonAbsPath, 'dist', 'temp', 'gen-html'),
        path.join(zBase.path.dir, `${zBase.path.name}.toml`),
      ),

      fullTitle: zBase.title === zBase.siteTitle
        ? zBase.title
        : `${zBase.title} | ${zBase.siteTitle}`,

      fullUrlWIndexWExt: new URL(
        path.relative(
          path.join(zBase.pkgJsonAbsPath, 'dist', 'temp', 'gen-html'),
          path.join(zBase.path.dir, `${zBase.path.name}.html`),
        ),
        zBase.site,
      ),

      fullUrlWIndexWoExt: new URL(
        path.relative(
          path.join(zBase.pkgJsonAbsPath, 'dist', 'temp', 'gen-html'),
          path.join(zBase.path.dir, zBase.path.name),
        ),
        zBase.site,
      ),

      layoutPath: path.relative(
        path.join(zBase.pkgJsonAbsPath, 'dist', 'temp', 'gen-html'),
        (await findUp('index.vue', {
          cwd: zBase.path.dir,
          stopAt: zBase.pkgJsonAbsPath,
        }))!,
      ),

      isHome: zBase.isHome ?? zBase.path.name === 'index',
      isLinks: zBase.isLinks ?? zBase.path.name === 'links',
      is404: zBase.is404 ?? zBase.path.name === '404',

      lang: (path.split(zBase.path.dir)).find((pathSeg) => isLang(pathSeg)) || zBase.lang,

      latest: zBase.latest ? zBase.latest : new Date(),

      mdxContent: await fs.readFileU(path.join(zBase.path.dir, `${zBase.path.name}.mdx`)),

      updated: await z
        .union([
          zChronoDate.transform((date) => [{ date: date, author: zBase.author }]),
          zBlame.transform((obj) => [obj]),
          z
            .array(
              zChronoDate.transform((date) => ({ date: date, author: zBase.author })),
            )
            .nonempty(),
          zBlames,
        ])
        .transform((updated) =>
          updated.toSorted((a, b) => a.date.getTime() - b.date.getTime())
        )
        .readonly()
        .catch([
          {
            date: await zChronoDate.parseAsync(
              (await fs.stat(
                `${path.join(zBase.path.dir, zBase.path.name)}.mdx`,
              ))
                .mtime,
            ),
            author: zBase.author,
          },
        ])
        .parseAsync(zBase.updated),

      published: await z
        .union([
          zChronoDate.transform((date) => [{ date: date, author: zBase.author }]),
          zBlame.transform((obj) => [obj]),
          z
            .array(
              zChronoDate.transform((date) => ({ date: date, author: zBase.author })),
            )
            .nonempty(),
          zBlames,
        ])
        .transform((published) =>
          published.toSorted((a, b) => a.date.getTime() - b.date.getTime())
        )
        .readonly()
        .catch([
          {
            date: await zChronoDate.parseAsync(
              (await fs.stat(
                `${path.join(zBase.path.dir, zBase.path.name)}.mdx`,
              ))
                .ctime,
            ),
            author: zBase.author,
          },
        ])
        .parseAsync(zBase.published),

      slugWIndexWExt: path.relative(
        path.join(zBase.pkgJsonAbsPath, 'dist', 'temp', 'gen-html'),
        path.join(zBase.path.dir, `${zBase.path.name}.html`),
      ),
      slugWIndexWoExt: path.relative(
        path.join(zBase.pkgJsonAbsPath, 'dist', 'temp', 'gen-html'),
        path.join(zBase.path.dir, `${zBase.path.name}`),
      ),

      siteBase: await tryCatchAsync(
        async () => {
          await fs.access(
            path.join(zBase.pkgJsonAbsPath, 'dist', 'temp', 'gen-html', 'index.mdx'),
          );
          return '';
        },
        path
          .split(path.relative(
            path.join(zBase.pkgJsonAbsPath, 'dist', 'temp', 'gen-html'),
            zBase
              .path
              .dir,
          ))[0]!,
      )(null),
    };
  })
  .transform(async function ensure2(z1) {
    return {
      ...z1,

      canonicalUrl: z1.fullUrlWIndexWoExt.pathname.endsWith('/index')
        ? new URL(z1.fullUrlWIndexWoExt.pathname.slice(0, -'/index'.length), z1.site)
        : z1.fullUrlWIndexWoExt,

      frontmatterImportName: z1
        .frontmatterPath
        .replaceAll('.', 'ReplacedDot')
        .replaceAll('/', 'ReplacedSlash')
        .replaceAll('-', 'ReplacedHyphen'),
      layoutImportName: z1
        .layoutPath
        .replaceAll('.', 'ReplacedDot')
        .replaceAll('/', 'ReplacedSlash')
        .replaceAll('-', 'ReplacedHyphen'),

      isPost: z1.isPost ?? !(z1.isHome || z1.isLinks || z1.is404),

      postImportName: `${z1.slugWIndexWoExt}.mdx`
        .replaceAll('.', 'ReplacedDot')
        .replaceAll('/', 'ReplacedSlash')
        .replaceAll('-', 'ReplacedHyphen'),

      siteWithBase: z1.siteBase ? new URL(z1.siteBase, z1.site) : z1.site,

      slashSiteBase: z1.siteBase ? `/${z1.siteBase}` : z1.siteBase,

      slug: z1.slugWIndexWoExt.endsWith('/index')
        ? z1.slugWIndexWoExt.slice(0, -'/index'.length)
        : z1.slugWIndexWoExt,

      summary: z1
        .mdxContent
        .split('\n\n')
        .filter((ln) => ln)
        .map((ln) => mdastToString(fromMarkdown(ln)))
        .filter((ln) => ln)
        .join(' ')
        .slice(0, 512)
        .trim(),
    };
  })
  .transform(async function ensure3(z2) {
    return {
      ...z2,

      slashSiteBaseWSlash: z2.slashSiteBase ? `${z2.slashSiteBase}/` : z2.slashSiteBase,

      slashSiteBaseWLang: z2.defaultLang === z2.lang
        ? z2.slashSiteBase
        : `${z2.slashSiteBase}/${z2.lang}`,
    };
  })
  .transform(async function ensure4(z3) {
    return {
      ...z3,

      slashSiteBaseWLangWSlash: z3.slashSiteBaseWLang
        ? `${z3.slashSiteBaseWLang}/`
        : z3.slashSiteBaseWLang,
    };
  })
  .pipe(
    z.object({
      //region: Injected by @monochromatic-dev/esbuild-plugin-toml

      path: z.object({ dir: z.string(), name: z.string() }).readonly(),

      pkgJsonAbsPath: z.string(),

      //endregion

      author: z.object({ name: z.string(), url: z.string().url() }).readonly(),

      canonicalUrl: z.coerce.string().url(),

      defaultLang: z.string(),

      description: z.string(),

      earliest: z.date(),

      frontmatterImportName: z.string(),

      frontmatterPath: z.string(),

      fullTitle: z.string(),

      fullUrlWIndexWExt: z.coerce.string().url(),

      fullUrlWIndexWoExt: z.coerce.string().url(),

      isHome: z.boolean(),

      isLinks: z.boolean(),

      is404: z.boolean(),

      isPost: z.boolean(),

      lang: z.string(),

      latest: z.date(),

      layoutImportName: z.string(),

      layoutPath: z.string(),

      license: z.object({ name: z.string(), url: z.string().url() }).readonly(),

      links: z.map(z.string(), z.string().url()).readonly(),

      mdxContent: z.string(),

      postImportName: z.string(),

      published: z
        .array(
          z.object({
            date: z.date(),
            author: z
              .object({ name: z.string(), url: z.string().url() })
              .readonly(),
          }),
        )
        .nonempty()
        .readonly(),

      slashSiteBase: z.string(),

      slashSiteBaseWSlash: z.string(),

      slashSiteBaseWLang: z.string(),

      slashSiteBaseWLangWSlash: z.string(),

      site: z.coerce.string().url(),

      siteBase: z.string(),

      siteTitle: z.string(),

      siteWithBase: z.coerce.string().url(),

      slugWIndexWExt: z.string(),

      slugWIndexWoExt: z.string(),

      slug: z.string(),

      socials: z.map(z.string(), z.string().url()).readonly(),

      summary: z.string(),

      tags: z.array(z.string()),

      theming: z
        .object({ color: z.string() })
        .readonly(),

      title: z.string(),

      updated: z
        .array(
          z.object({
            date: z.date(),
            author: z
              .object({ name: z.string(), url: z.string().url() })
              .readonly(),
          }),
        )
        .nonempty()
        .readonly(),
    }),
  );

export default zPost;
