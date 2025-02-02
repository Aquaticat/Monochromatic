// 1. Import utilities from `astro:content`
import {
  defineCollection,
  z,
} from 'astro:content';

// 2. Import loader(s)
import { glob } from 'astro/loaders';

// 3. Define your collection(s)
const blog = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/collections/blog' }),

  // title = "Using MDX"
  // description = "Here is a sample of some syntax that can be used when writing mdx content in this Astro theme."
  // published = "2022-07-01"
  // tags = ["guide"]
  schema: z.object({
    title: z.string(),
    description: z.string(),
    published: z.date(),
    updated: z.date(),
    tags: z.array(z.string()),
  }),
});

// 4. Export a single `collections` object to register your collection(s)
export const collections = { blog };
