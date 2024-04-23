
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { MDXProvider } from '@mdx-js/vue';
import { writeFile } from 'node:fs/promises';
import Layout from './../index.vue';
import Post from './index.mdx';
import frontmatter from './index.toml';
import frontmatters from '@/dist/temp/gen-html/_fms.ts';

const app = createSSRApp({
  template: '<Layout><MDXProvider :components><Post /></MDXProvider></Layout>',
  components: { Layout, MDXProvider, Post },
});

app.provide('frontmatter', frontmatter);

app.provide('frontmatters', frontmatters);

const html = await renderToString(app);

await writeFile('index.mdx.html', html);
