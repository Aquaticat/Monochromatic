// oxlint-disable tsdoc/require-tsdoc -- Astro content config with framework-dictated structure
// 1. Import utilities from `astro:content`
import type {
  BaseSchema,
  CollectionConfig,
} from 'astro/content/config';
import { z, } from 'astro/zod';
import { defineCollection, } from 'astro:content';

/* vale Microsoft.Plurals = NO */
// 2. Import loaders
/* vale Microsoft.Plurals = YES */
import {
  glob,
  type Loader,
} from 'astro/loaders';

/* vale Microsoft.Plurals = NO */
// 3. Define your collections
/* vale Microsoft.Plurals = YES */

/* vale Microsoft.Plurals = NO */
// 4. Export a single `collections` object to register your collections
/* vale Microsoft.Plurals = YES */
export const collections: {
  blog: CollectionConfig<z.ZodObject<{
    title: z.ZodString;
    description: z.ZodString;
    published: z.ZodDate;
    updated: z.ZodDate;
    tags: z.ZodArray<z.ZodString>;
  }>, Loader>;
} = { blog: defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/collections/blog', },),

  // title = "Using MDX"
  // description = "Here is a sample of some syntax that can be used when writing mdx content in this Astro theme."
  // published = "2022-07-01"
  // tags = ["guide"]
  schema: z.object({
    title: z.string(),
    description: z.string(),
    published: z.date(),
    updated: z.date(),
    tags: z.array(z.string(),),
  },),
},), };
