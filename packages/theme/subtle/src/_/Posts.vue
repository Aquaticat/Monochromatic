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
}[] = inject('frontmatters')!;
</script>

<template>
  <ul class='Posts'>
    <Post
      v-if='posts'
      v-for='post of posts'
      :post></Post>
    <Post
      v-else-if='fms'
      v-for='post of fms'
      :post></Post>
    <Error v-else>Could not load either {{ posts }} from props or {{ fms }} from inject</Error>
  </ul>
</template>
