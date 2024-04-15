import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import Post from './content/post/en/mdx.mdx';
/* const app = createSSRApp({
  data: () => ({ count: 1 }),
  template: `<button @click="count++">{{ count }}</button><MDXProvider></MDXProvider>`,
}); */

const app = createSSRApp(Post);

renderToString(app).then((html) => {
  console.log(html);
});
