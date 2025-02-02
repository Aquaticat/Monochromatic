<script
  setup
  lang='ts'>
import { inject } from 'vue';
const fm: { links: ReadonlyMap<string, string>; } = inject('frontmatter')!;
</script>

<template>
  <ul class='Links'>
    <li v-for='([name, url]) of fm.links'>
      <a :href='url'>
        <span>{{ name }}</span>
      </a>
    </li>
  </ul>
</template>
