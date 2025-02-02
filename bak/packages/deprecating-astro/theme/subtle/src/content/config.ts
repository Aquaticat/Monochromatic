import { stat, opendir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { z, defineCollection } from 'astro:content';
import consts from '../temp/consts';

import chrono from 'chrono-node';

import remarkFrontmatter from 'remark-frontmatter';
import { remark } from 'remark';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { toString as mdastToString } from 'mdast-util-to-string';
import { read } from 'to-vfile';
import { matter } from 'vfile-matter';

import { notFalsyOrThrow } from '@monochromatic-dev/module-not-or-throw';

const postDir = join(resolve(), 'src', 'content', 'post');

const postDirLs = await opendir(postDir);

type fileMatterType = { title: string };

const fileMatters: Map<string, { lang: string; basename: string; fileExtension: string; summary: string }> = new Map();

for await (const postDirDr of postDirLs) {
  if (postDirDr.isDirectory()) {
    // @ts-expect-error wait for fix from @types/node
    const postLangDirLs = await opendir(join(postDirDr.parentPath, postDirDr.name));
    for await (const postDr of postLangDirLs) {
      if (postDr.isFile()) {
        // @ts-expect-error wait for fix from @types/node
        const file = await read(join(postDr.parentPath, postDr.name));
        const fileMatter: fileMatterType = (
          await remark()
            .use(remarkFrontmatter)
            .use(function yamlMatter() {
              return (_tree, file) => {
                matter(file);
              };
            })
            .process(file)
        ).data.matter as fileMatterType;
        if (typeof fileMatter.title !== 'string') {
          throw new TypeError(`invalid title ${fileMatter.title} in ${file}`);
        }
        if (fileMatters.has(fileMatter.title)) {
          throw new TypeError(`duplicate title ${fileMatter.title} in ${file}`);
        }
        const fileStrArr = file.toString().split('\n');
        const summary = fileStrArr
          .slice(fileStrArr.indexOf('---', 1))
          .join('\n')
          .split('\n\n')
          .filter((ln) => ln)
          .map((ln) => mdastToString(fromMarkdown(ln)))
          .filter((ln) => ln)
          .join('\n\n')
          .split('\n')
          .filter((ln) => ln)
          .join(' ')
          .slice(0, 512)
          .trim();
        fileMatters.set(fileMatter.title, {
          lang: postDirDr.name,
          basename: postDr.name.slice(0, postDr.name.lastIndexOf('.')),
          fileExtension: postDr.name.slice(postDr.name.lastIndexOf('.')),
          summary: summary,
        });
      }
    }
  }
}

Object.freeze(fileMatters);
console.dir(fileMatters);

const zChronoDate = z.string().transform((maybeDate) => notFalsyOrThrow(chrono.parseDate(maybeDate)));

const zAuthor = z.object({ name: z.string(), url: z.string().url() }).strict();

const zBlame = z.object({ date: zChronoDate, author: zAuthor }).strict();

const zBlames = z.array(zBlame).nonempty();

const blamesBase = z.union([
  zChronoDate.transform((date) => [{ date: date, author: consts.author }]),
  zBlame.transform((obj) => [obj]),
  z.array(zChronoDate.transform((date) => ({ date: date, author: consts.author }))).nonempty(),
  zBlames,
]);

const zPost = z
  .object({
    title: z.string(),
    published: z.optional(blamesBase),
    description: z.optional(z.string()),
    tags: z.array(z.string()).default([]),
    modified: z.optional(blamesBase),
  })
  .transform(function ensureDescription(zBase) {
    return zBase.description ? zBase : { ...zBase, description: zBase.title };
  })
  .transform(function mergeMatter(ensuredDescription) {
    return {
      ...ensuredDescription,
      ...fileMatters.get(ensuredDescription.title)!,
    };
  })
  .transform(async function ensureModified(mergedMatter) {
    return mergedMatter.modified
      ? mergedMatter
      : {
          ...mergedMatter,
          modified: [
            {
              date: (
                await stat(join(postDir, mergedMatter.lang, `${mergedMatter.basename}.${mergedMatter.fileExtension}`))
              ).mtime,
              author: consts.author,
            },
          ],
        };
  })
  .transform(async function ensurePublished(mergedMatter) {
    return mergedMatter.published
      ? mergedMatter
      : {
          ...mergedMatter,
          published: [
            {
              date: (
                await stat(join(postDir, mergedMatter.lang, `${mergedMatter.basename}.${mergedMatter.fileExtension}`))
              ).ctime,
              author: consts.author,
            },
          ],
        };
  })
  .pipe(
    z.object({
      title: z.string(),
      description: z.string(),
      lang: z.string(),
      basename: z.string(),
      fileExtension: z.string(),
      summary: z.string(),
      tags: z.array(z.string()),
      published: z
        .array(z.object({ date: z.date(), author: z.object({ name: z.string(), url: z.string().url() }) }))
        .nonempty(),
      modified: z
        .array(z.object({ date: z.date(), author: z.object({ name: z.string(), url: z.string().url() }) }))
        .nonempty(),
    }),
  );

const postCollection = defineCollection({
  type: 'content',
  schema: zPost,
});

export const collections = {
  post: postCollection,
};
