<script
  setup
  lang='ts'>
import { inject } from 'vue';
const fm: { title: string; } = inject('frontmatter')!;
</script>

<template>
  <article class='Article'>
    <h1>{{ fm.title }}</h1>
    <slot></slot>
  </article>
</template>
