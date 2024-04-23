<script
  setup
  lang='ts'>
import { inject } from 'vue';
const fm: { socials: ReadonlyMap<string, string>; } = inject('frontmatter')!;
</script>

<template>
  <ul class='Socials'>
    <li v-for='([name, url]) of fm.socials'>
      <a :href='url'>
        <span>{{ name }}</span>
      </a>
    </li>
  </ul>
</template>
