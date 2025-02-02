<script
  setup
  lang='ts'>
import Error from '@_/Error.vue';
import Post from '@_/Post.vue';
import { inject } from 'vue';
defineProps<
  {
    posts?: {
      title: string;
      slug: string;
      description: string;
      summary: string;
      published: [{ date: Date; }];
      updated: [{ date: Date; }];
      tags: string[];
    }[];
  }
>();
const fms: {
  title: string;
  slug: string;
  description: string;
  summary: string;
  published: [{ date: Date; }];
  updated: [{ date: Date; }];
  tags: string[];
  lang: string;
  isPost: boolean;
  is404: boolean;
}[] = inject('frontmatters')!;

const fm: { lang: string; } = inject('frontmatter')!;

const fmsMatchedLang = fms.filter((potentialFmMatchedLang) =>
  potentialFmMatchedLang.lang === fm.lang
  && !potentialFmMatchedLang.is404
  && potentialFmMatchedLang.isPost
);
</script>

<template>
  <ul class='Posts'>
    <Post
      v-if='posts'
      v-for='post of posts'
      :post></Post>
    <Post
      v-else-if='fmsMatchedLang'
      v-for='post of fmsMatchedLang'
      :post></Post>
    <Error v-else>Could not load either {{ posts }} from props or {{ fms }} from
      inject</Error>
  </ul>
</template>
