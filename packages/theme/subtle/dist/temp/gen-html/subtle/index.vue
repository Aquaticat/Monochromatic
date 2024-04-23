<script
  setup
  lang='ts'>
import BaseHead from '@_/BaseHead.vue';
import Footer from '@_/Footer.vue';
import Header from '@_/Header.vue';
import Main from '@_/Main.vue';
import { inject } from 'vue';

// TODO: Use https://github.com/remcohaszing/remark-mdx-frontmatter
const frontmatter: { lang: string; } = inject('frontmatter')!;
</script>

<template>
  <html :lang='frontmatter.lang'>
    <head>
      <BaseHead />
    </head>

    <body>
      <Header />
      <Main>
        <slot />
      </Main>
      <Footer />
    </body>
  </html>
</template>
