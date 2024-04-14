import { stat, opendir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { z, defineCollection } from 'astro:content';
import consts from '../temp/consts';

import chrono from 'chrono-node';

import remarkParse from 'remark-parse';
import remarkFrontmatter from 'remark-frontmatter';
import remarkMdx from 'remark-mdx';
import remarkGfm from 'remark-gfm';
import { remark } from 'remark';
import { toString as mdastToString } from 'mdast-util-to-string';
import remarkStringify from 'remark-stringify';
import retextStringify from 'retext-stringify';
import { read, write } from 'to-vfile';
import { unified, type Plugin } from 'unified';
import { matter } from 'vfile-matter';

import { notFalsyOrThrow } from '@monochromatic.dev/module-not-or-throw';

const postDir = join(resolve(), 'src', 'content', 'post');

const postDirLs = await opendir(postDir);

type fileMatterType = { title: string };

const fileMatters: Map<string, { lang: string; filename: string; summary: string }> = new Map();

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
        const summary = mdastToString((await remark().use(remarkGfm).process(file)).toString())
          .split('\n')
          .join(' ')
          .slice(0, 512);
        fileMatters.set(fileMatter.title, { lang: postDirDr.name, filename: postDr.name, summary: summary });
      }
    }
  }
}

Object.freeze(fileMatters);
console.dir(fileMatters);

const postSchema = z
  .object({
    title: z.string(),
    published: z.union([
      z
        .string()
        .transform((maybeDate) => notFalsyOrThrow(chrono.parseDate(maybeDate)))
        .transform((publishedDate) => ({ date: publishedDate, author: consts.author })),
      z.object({ date: z.date(), author: z.object({ name: z.string(), url: z.string().url() }) }),
    ]),
    description: z.optional(z.string()),
    tags: z.array(z.string()).default([]),
    modified: z.optional(
      z.union([
        z
          .union([
            z.date().transform((modifiedDate) => ({ date: modifiedDate, author: consts.author })),
            z.object({ date: z.date(), author: z.object({ name: z.string(), url: z.string().url() }) }),
          ])
          .transform((obj) => [obj]),
        z
          .array(
            z.union([
              z.date().transform((modifiedDate) => ({ date: modifiedDate, author: consts.author })),
              z.object({ date: z.date(), author: z.object({ name: z.string(), url: z.string().url() }) }),
            ]),
          )
          .nonempty(),
      ]),
    ),
  })
  .transform((baseSchema) => {
    const ensuredDescription = baseSchema.description ? baseSchema : { ...baseSchema, description: baseSchema.title };

    /*
    const currentBasePost = basePosts.find(
      (basePost) => basePost.data.title === postSchema.title,
    ) as (typeof basePosts)[number];
    const [lang, fileNameWithoutExtension] = currentBasePost.slug.split('/') as [string, string];

    return postSchema.modified
      ? postSchema
      : {
          ...postSchema,
          modified: [
            {
              date: statSync(join(resolve(), 'src', 'content', 'post', lang, `${fileNameWithoutExtension}.mdx`)).mtime,
              author: consts.author,
            },
          ],
        }; */
    const currentBasePost = fileMatters.get(baseSchema.title)!;
    return ensuredDescription;
  });

const postCollection = defineCollection({
  type: 'content',
  schema: postSchema,
});

export const collections = {
  post: postCollection,
};
